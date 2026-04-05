"""
PitMind F1 Analytics — FastAPI Backend v2.0
Real telemetry via FastF1 · 2020–2026
Security: Rate limiting, API key auth, input validation, caching, timeouts
"""

import os
import math
import asyncio
import time
from functools import lru_cache
from typing import Optional

import numpy as np
import pandas as pd
import fastf1
from fastapi import FastAPI, HTTPException, Query, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security.api_key import APIKeyHeader
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from dotenv import load_dotenv

load_dotenv()

# ── Cache setup ───────────────────────────────────────────────────────────────
CACHE_DIR = os.path.join(os.path.dirname(__file__), "cache")
os.makedirs(CACHE_DIR, exist_ok=True)
fastf1.Cache.enable_cache(CACHE_DIR)

# ── In-memory response cache (saves Railway compute + FastF1 re-fetches) ─────
_mem_cache: dict = {}
MEM_CACHE_TTL = 60 * 60  # 1 hour — F1 data doesn't change

def cache_get(key: str):
    entry = _mem_cache.get(key)
    if entry and (time.time() - entry["ts"]) < MEM_CACHE_TTL:
        return entry["data"]
    return None

def cache_set(key: str, data):
    _mem_cache[key] = {"data": data, "ts": time.time()}

# ── Rate limiter ──────────────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address, default_limits=["200/day", "50/hour"])

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="PitMind F1 API",
    version="2.0.0",
    docs_url=None,      # Disable public Swagger UI in production
    redoc_url=None,     # Disable public ReDoc in production
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── Security headers ──────────────────────────────────────────────────────────
@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response

# ── Request timeout ───────────────────────────────────────────────────────────
@app.middleware("http")
async def timeout_middleware(request: Request, call_next):
    try:
        return await asyncio.wait_for(call_next(request), timeout=90.0)
    except asyncio.TimeoutError:
        return JSONResponse({"error": "Request timed out"}, status_code=504)

# ── CORS ──────────────────────────────────────────────────────────────────────
ALLOWED_ORIGIN = os.environ.get("ALLOWED_ORIGIN", "http://localhost:3000")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[ALLOWED_ORIGIN, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["GET"],
    allow_headers=["*"],
)

# ── API Key ───────────────────────────────────────────────────────────────────
API_KEY = os.environ.get("PITMIND_API_KEY", "")
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

async def verify_key(key: str = Depends(api_key_header)):
    if API_KEY and key != API_KEY:
        raise HTTPException(status_code=403, detail="Forbidden")
    return key

# ── Constants ─────────────────────────────────────────────────────────────────
AVAILABLE_YEARS = list(range(2020, 2027))

TEAM_COLORS = {
    "Red Bull Racing": "#3671C6",
    "Ferrari": "#E8002D",
    "Mercedes": "#27F4D2",
    "McLaren": "#FF8000",
    "Aston Martin": "#229971",
    "Alpine": "#FF87BC",
    "Williams": "#64C4FF",
    "RB": "#6692FF",
    "Kick Sauber": "#52E252",
    "Haas F1 Team": "#B6BABD",
}

COMPOUND_COLORS = {
    "SOFT": "#E8002D",
    "MEDIUM": "#FFF200",
    "HARD": "#FFFFFF",
    "INTERMEDIATE": "#39B54A",
    "WET": "#0067FF",
    "UNKNOWN": "#888888",
}

VALID_SESSIONS = {"R", "Q", "S", "FP1", "FP2", "FP3"}

# ── Helpers ───────────────────────────────────────────────────────────────────
def safe_val(v):
    if v is None:
        return None
    if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
        return None
    if isinstance(v, (np.integer,)):
        return int(v)
    if isinstance(v, (np.floating,)):
        return float(v) if not (math.isnan(v) or math.isinf(v)) else None
    if isinstance(v, np.bool_):
        return bool(v)
    if hasattr(v, "total_seconds"):
        ts = v.total_seconds()
        return None if (math.isnan(ts) or math.isinf(ts)) else ts
    if isinstance(v, pd.Timestamp):
        return v.isoformat()
    return v


def clean_records(df: pd.DataFrame) -> list:
    records = []
    for row in df.itertuples(index=False):
        rec = {}
        for field, val in zip(df.columns, row):
            rec[field] = safe_val(val)
        records.append(rec)
    return records


def validate_year(year: int):
    if year not in AVAILABLE_YEARS:
        raise HTTPException(400, f"Year must be between 2020 and 2026")


def validate_round(round_num: int):
    if round_num not in range(1, 25):
        raise HTTPException(400, "Round must be between 1 and 24")


def validate_session(session_type: str):
    if session_type not in VALID_SESSIONS:
        raise HTTPException(400, f"Session must be one of: {', '.join(VALID_SESSIONS)}")


def validate_driver(driver: str) -> str:
    d = driver.upper().strip()
    if not d.isalpha() or len(d) != 3:
        raise HTTPException(400, "Driver code must be exactly 3 letters e.g. VER")
    return d


def load_session(year: int, identifier, session_type: str, **kwargs):
    try:
        s = fastf1.get_session(year, identifier, session_type)
        s.load(**kwargs)
        return s
    except Exception as e:
        raise HTTPException(500, f"FastF1 error: {e}")


def team_color(team: str) -> str:
    return TEAM_COLORS.get(team, "#888888")


def compound_color(compound: str) -> str:
    return COMPOUND_COLORS.get((compound or "UNKNOWN").upper(), "#888888")


# ── Health ────────────────────────────────────────────────────────────────────
@app.get("/api/health", dependencies=[Depends(verify_key)])
@limiter.limit("60/minute")
def health(request: Request):
    return {"status": "ok", "version": "2.0.0", "years": AVAILABLE_YEARS}


# ── Schedule ──────────────────────────────────────────────────────────────────
@app.get("/api/schedule/{year}", dependencies=[Depends(verify_key)])
@limiter.limit("30/minute")
def get_schedule(request: Request, year: int):
    validate_year(year)

    cache_key = f"schedule:{year}"
    cached = cache_get(cache_key)
    if cached:
        return cached

    try:
        schedule = fastf1.get_event_schedule(year, include_testing=False)
        events = []
        for _, row in schedule.iterrows():
            events.append({
                "round":    safe_val(row.get("RoundNumber")),
                "name":     str(row.get("EventName", "")),
                "country":  str(row.get("Country", "")),
                "location": str(row.get("Location", "")),
                "date":     str(row.get("EventDate", ""))[:10],
                "format":   str(row.get("EventFormat", "")),
            })
        result = {"year": year, "events": events}
        cache_set(cache_key, result)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))


# ── Race Results ──────────────────────────────────────────────────────────────
@app.get("/api/results/{year}/{round_num}", dependencies=[Depends(verify_key)])
@limiter.limit("15/minute")
def get_results(request: Request, year: int, round_num: int):
    validate_year(year)
    validate_round(round_num)

    cache_key = f"results:{year}:{round_num}"
    cached = cache_get(cache_key)
    if cached:
        return cached

    session = load_session(year, round_num, "R",
                           laps=False, telemetry=False,
                           weather=False, messages=False)
    res = session.results
    if res is None or res.empty:
        raise HTTPException(404, "No results found")

    wanted = ["DriverNumber", "Abbreviation", "FullName", "TeamName",
              "GridPosition", "Position", "ClassifiedPosition",
              "Status", "Points", "Time", "FastestLapTime", "FastestLapNumber"]
    cols = [c for c in wanted if c in res.columns]
    records = clean_records(res[cols])

    for r in records:
        r["TeamColor"] = team_color(r.get("TeamName", ""))

    result = {
        "race":    session.event["EventName"],
        "year":    year,
        "round":   round_num,
        "results": records,
    }
    cache_set(cache_key, result)
    return result


# ── Lap Times ─────────────────────────────────────────────────────────────────
@app.get("/api/laps/{year}/{round_num}/{session_type}", dependencies=[Depends(verify_key)])
@limiter.limit("10/minute")
def get_laps(
    request: Request,
    year: int,
    round_num: int,
    session_type: str,
    driver: Optional[str] = None,
):
    validate_year(year)
    validate_round(round_num)
    validate_session(session_type)

    drv_clean = validate_driver(driver) if driver else None
    cache_key = f"laps:{year}:{round_num}:{session_type}:{drv_clean or 'all'}"
    cached = cache_get(cache_key)
    if cached:
        return cached

    session = load_session(year, round_num, session_type,
                           telemetry=False, weather=False, messages=False)
    laps = session.laps

    if drv_clean:
        laps = laps.pick_drivers(drv_clean)

    wanted = ["Driver", "Team", "LapNumber", "LapTime", "Stint", "Compound",
              "TyreLife", "FreshTyre", "Sector1Time", "Sector2Time",
              "Sector3Time", "SpeedI1", "SpeedI2", "SpeedFL", "SpeedST",
              "IsPersonalBest", "PitInTime", "PitOutTime"]
    cols = [c for c in wanted if c in laps.columns]
    records = clean_records(laps[cols])

    team_map = {}
    if session.results is not None:
        for _, row in session.results.iterrows():
            team_map[str(row.get("Abbreviation", ""))] = str(row.get("TeamName", ""))

    for r in records:
        r["CompoundColor"] = compound_color(r.get("Compound"))
        r["TeamColor"] = team_color(team_map.get(r.get("Driver", ""), ""))

    result = {
        "session": session_type,
        "race":    session.event["EventName"],
        "year":    year,
        "round":   round_num,
        "laps":    records,
    }
    cache_set(cache_key, result)
    return result


# ── Telemetry ─────────────────────────────────────────────────────────────────
@app.get("/api/telemetry/{year}/{round_num}/{session_type}/{driver}", dependencies=[Depends(verify_key)])
@limiter.limit("8/minute")
def get_telemetry(
    request: Request,
    year: int,
    round_num: int,
    session_type: str,
    driver: str,
    lap_number: Optional[int] = None,
):
    validate_year(year)
    validate_round(round_num)
    validate_session(session_type)
    drv = validate_driver(driver)

    if lap_number is not None and lap_number not in range(1, 100):
        raise HTTPException(400, "Lap number must be between 1 and 99")

    cache_key = f"telemetry:{year}:{round_num}:{session_type}:{drv}:{lap_number or 'fastest'}"
    cached = cache_get(cache_key)
    if cached:
        return cached

    session = load_session(year, round_num, session_type,
                           weather=False, messages=False)
    drv_laps = session.laps.pick_drivers(drv)

    if drv_laps.empty:
        raise HTTPException(404, f"No laps found for {drv}")

    if lap_number:
        mask = drv_laps["LapNumber"] == lap_number
        if not mask.any():
            raise HTTPException(404, f"Lap {lap_number} not found")
        lap = drv_laps[mask].iloc[0]
    else:
        lap = drv_laps.pick_fastest()

    tel = lap.get_telemetry()
    if tel is None or tel.empty:
        raise HTTPException(404, "No telemetry for this lap")

    step = max(1, len(tel) // 600)
    tel = tel.iloc[::step].copy()

    wanted = ["Distance", "Speed", "RPM", "nGear", "Throttle", "Brake", "DRS"]
    cols = [c for c in wanted if c in tel.columns]

    team_name = str(lap.get("Team", ""))
    result = {
        "driver":    drv,
        "lap":       safe_val(lap["LapNumber"]),
        "laptime":   safe_val(lap["LapTime"]),
        "compound":  str(lap.get("Compound", "UNKNOWN")),
        "team":      team_name,
        "teamColor": team_color(team_name),
        "telemetry": clean_records(tel[cols]),
    }
    cache_set(cache_key, result)
    return result


# ── Tyre Stints ───────────────────────────────────────────────────────────────
@app.get("/api/stints/{year}/{round_num}", dependencies=[Depends(verify_key)])
@limiter.limit("10/minute")
def get_stints(request: Request, year: int, round_num: int):
    validate_year(year)
    validate_round(round_num)

    cache_key = f"stints:{year}:{round_num}"
    cached = cache_get(cache_key)
    if cached:
        return cached

    session = load_session(year, round_num, "R",
                           telemetry=False, weather=False, messages=False)
    laps = session.laps

    stints = (
        laps.groupby(["Driver", "Stint"])
        .agg(
            Compound=("Compound", "first"),
            StartLap=("LapNumber", "min"),
            EndLap=("LapNumber", "max"),
            TyreLife=("TyreLife", "max"),
            Laps=("LapNumber", "count"),
        )
        .reset_index()
    )

    records = clean_records(stints)
    for r in records:
        r["CompoundColor"] = compound_color(r.get("Compound"))

    driver_info = []
    if session.results is not None:
        wanted = ["Abbreviation", "FullName", "TeamName", "Position"]
        dr_cols = [c for c in wanted if c in session.results.columns]
        driver_info = clean_records(session.results[dr_cols])
        for d in driver_info:
            d["TeamColor"] = team_color(d.get("TeamName", ""))

    result = {
        "race":    session.event["EventName"],
        "year":    year,
        "round":   round_num,
        "stints":  records,
        "drivers": driver_info,
    }
    cache_set(cache_key, result)
    return result


# ── Pit Stops ─────────────────────────────────────────────────────────────────
@app.get("/api/pitstops/{year}/{round_num}", dependencies=[Depends(verify_key)])
@limiter.limit("10/minute")
def get_pitstops(request: Request, year: int, round_num: int):
    validate_year(year)
    validate_round(round_num)

    cache_key = f"pitstops:{year}:{round_num}"
    cached = cache_get(cache_key)
    if cached:
        return cached

    session = load_session(year, round_num, "R",
                           telemetry=False, weather=False, messages=False)
    laps = session.laps
    pit_laps = laps[laps["PitInTime"].notna() | laps["PitOutTime"].notna()].copy()

    wanted = ["Driver", "Team", "LapNumber", "Stint",
              "Compound", "TyreLife", "PitInTime", "PitOutTime"]
    cols = [c for c in wanted if c in pit_laps.columns]
    records = clean_records(pit_laps[cols])

    for r in records:
        r["CompoundColor"] = compound_color(r.get("Compound"))
        r["TeamColor"] = team_color(r.get("Team", ""))

    result = {
        "race":     session.event["EventName"],
        "year":     year,
        "round":    round_num,
        "pitstops": records,
    }
    cache_set(cache_key, result)
    return result


# ── Sector Times ──────────────────────────────────────────────────────────────
@app.get("/api/sectors/{year}/{round_num}/{session_type}", dependencies=[Depends(verify_key)])
@limiter.limit("10/minute")
def get_sectors(request: Request, year: int, round_num: int, session_type: str):
    validate_year(year)
    validate_round(round_num)
    validate_session(session_type)

    cache_key = f"sectors:{year}:{round_num}:{session_type}"
    cached = cache_get(cache_key)
    if cached:
        return cached

    session = load_session(year, round_num, session_type,
                           telemetry=False, weather=False, messages=False)
    laps = session.laps

    def fastest_lap(grp):
        valid = grp.dropna(subset=["LapTime"])
        if valid.empty:
            return None
        return valid.loc[valid["LapTime"].idxmin()]

    best = (
        laps.groupby("Driver")
        .apply(fastest_lap)
        .dropna()
        .reset_index(drop=True)
    )

    wanted = ["Driver", "Team", "LapNumber", "LapTime",
              "Sector1Time", "Sector2Time", "Sector3Time", "Compound"]
    cols = [c for c in wanted if c in best.columns]
    records = clean_records(best[cols])

    for r in records:
        r["TeamColor"] = team_color(r.get("Team", ""))
        r["CompoundColor"] = compound_color(r.get("Compound"))

    records.sort(key=lambda x: x.get("LapTime") or 9999)

    result = {
        "session": session_type,
        "race":    session.event["EventName"],
        "year":    year,
        "round":   round_num,
        "sectors": records,
    }
    cache_set(cache_key, result)
    return result


# ── Driver Comparison ─────────────────────────────────────────────────────────
@app.get("/api/compare/{year}/{round_num}/{session_type}", dependencies=[Depends(verify_key)])
@limiter.limit("6/minute")
def compare_drivers(
    request: Request,
    year: int,
    round_num: int,
    session_type: str,
    drivers: str = Query(..., description="Comma-separated 3-letter codes e.g. VER,LEC"),
):
    validate_year(year)
    validate_round(round_num)
    validate_session(session_type)

    raw = [d.strip() for d in drivers.split(",") if d.strip()]
    if len(raw) < 2:
        raise HTTPException(400, "Provide at least 2 driver codes")
    if len(raw) > 4:
        raise HTTPException(400, "Maximum 4 drivers")

    driver_list = [validate_driver(d) for d in raw]
    cache_key = f"compare:{year}:{round_num}:{session_type}:{'-'.join(sorted(driver_list))}"
    cached = cache_get(cache_key)
    if cached:
        return cached

    session = load_session(year, round_num, session_type,
                           weather=False, messages=False)

    result_drivers = {}
    for drv in driver_list:
        drv_laps = session.laps.pick_drivers(drv)
        if drv_laps.empty:
            continue
        fastest = drv_laps.pick_fastest()
        tel = fastest.get_telemetry()
        if tel is None or tel.empty:
            continue

        step = max(1, len(tel) // 400)
        tel = tel.iloc[::step].copy()

        wanted = ["Distance", "Speed", "Throttle", "Brake", "nGear"]
        cols = [c for c in wanted if c in tel.columns]
        team_name = str(fastest.get("Team", ""))

        result_drivers[drv] = {
            "laptime":   safe_val(fastest["LapTime"]),
            "compound":  str(fastest.get("Compound", "UNKNOWN")),
            "team":      team_name,
            "teamColor": team_color(team_name),
            "telemetry": clean_records(tel[cols]),
        }

    if not result_drivers:
        raise HTTPException(404, "No telemetry found for any driver")

    result = {
        "session": session_type,
        "race":    session.event["EventName"],
        "year":    year,
        "round":   round_num,
        "drivers": result_drivers,
    }
    cache_set(cache_key, result)
    return result


# ── Fastest Laps ──────────────────────────────────────────────────────────────
@app.get("/api/fastest/{year}/{round_num}/{session_type}", dependencies=[Depends(verify_key)])
@limiter.limit("10/minute")
def get_fastest(request: Request, year: int, round_num: int, session_type: str):
    validate_year(year)
    validate_round(round_num)
    validate_session(session_type)

    cache_key = f"fastest:{year}:{round_num}:{session_type}"
    cached = cache_get(cache_key)
    if cached:
        return cached

    session = load_session(year, round_num, session_type,
                           telemetry=False, weather=False, messages=False)
    laps = session.laps.pick_quicklaps()

    fastest = (
        laps.groupby("Driver")
        .apply(lambda g: g.loc[g["LapTime"].idxmin()] if not g["LapTime"].dropna().empty else None)
        .dropna()
        .reset_index(drop=True)
    )

    wanted = ["Driver", "Team", "LapNumber", "LapTime", "Compound",
              "Sector1Time", "Sector2Time", "Sector3Time",
              "SpeedI1", "SpeedI2", "SpeedFL"]
    cols = [c for c in wanted if c in fastest.columns]
    records = clean_records(fastest[cols])
    records.sort(key=lambda x: x.get("LapTime") or 9999)

    best_time = records[0]["LapTime"] if records else None
    for i, r in enumerate(records):
        r["Rank"] = i + 1
        r["TeamColor"] = team_color(r.get("Team", ""))
        r["CompoundColor"] = compound_color(r.get("Compound"))
        if best_time and r.get("LapTime"):
            r["GapToFastest"] = round(r["LapTime"] - best_time, 3)

    result = {
        "session": session_type,
        "race":    session.event["EventName"],
        "year":    year,
        "round":   round_num,
        "fastest": records,
    }
    cache_set(cache_key, result)
    return result


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
