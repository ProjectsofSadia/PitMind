import { useState, useEffect } from "react";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from "recharts";

const API = process.env.REACT_APP_API_URL || "http://localhost:8000/api";
const API_KEY = process.env.REACT_APP_API_KEY || "";

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (s) => {
  if (s == null) return "—";
  const min = Math.floor(s / 60);
  const sec = (s % 60).toFixed(3).padStart(6, "0");
  return min > 0 ? `${min}:${sec}` : `${sec}s`;
};

const fmtGap = (s) => {
  if (s == null) return "—";
  if (s === 0) return "LEADER";
  return `+${s.toFixed(3)}s`;
};

async function apiFetch(path) {
  const r = await fetch(`${API}${path}`, {
    headers: { "X-API-Key": API_KEY },
  });
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`${r.status}: ${text}`);
  }
  return r.json();
}

// ── Design tokens ─────────────────────────────────────────────────────────────
const R = "#E10600";
const BORDER = "rgba(255,255,255,0.1)";
const DIM = "rgba(255,255,255,0.06)";
const YEARS = [2026, 2025, 2024, 2023, 2022, 2021, 2020];
const TT = {
  backgroundColor: "#0d0d12",
  border: `1px solid ${BORDER}`,
  borderRadius: 4,
  fontSize: 11,
  fontFamily: "monospace",
};

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;900&family=JetBrains+Mono:wght@400;600&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #06060A; color: #fff; font-family: 'JetBrains Mono', monospace; overflow-x: hidden; }
  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-track { background: #111; }
  ::-webkit-scrollbar-thumb { background: #E10600; border-radius: 2px; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes fade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
  .fade { animation: fade .25s ease-out; }
  select option { background: #0d0d12; }
  input::placeholder { color: rgba(255,255,255,0.3); }
  .tbl { width: 100%; border-collapse: collapse; font-size: 12px; }
  .tbl th { text-align: left; font-size: 10px; letter-spacing: 1.5px; text-transform: uppercase; color: #E10600; padding: 6px 12px; border-bottom: 1px solid rgba(255,255,255,0.08); }
  .tbl td { padding: 8px 12px; border-bottom: 1px solid rgba(255,255,255,0.04); color: #fff; }
  .tbl tr:hover td { background: rgba(255,255,255,0.03); }
`;

// ── Shared components ─────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: 48 }}>
      <div style={{
        width: 32, height: 32,
        border: "2px solid rgba(225,6,0,0.2)",
        borderTop: `2px solid ${R}`,
        borderRadius: "50%",
        animation: "spin .8s linear infinite",
      }} />
      <span style={{ fontSize: 11, letterSpacing: 2, color: "rgba(255,255,255,0.4)" }}>
        LOADING TELEMETRY
      </span>
    </div>
  );
}

function ErrBox({ msg }) {
  return (
    <div style={{
      padding: "14px 18px",
      background: "rgba(225,6,0,0.08)",
      border: "1px solid rgba(225,6,0,0.3)",
      borderRadius: 4,
      fontSize: 12,
      color: "#ff6b6b",
      fontFamily: "monospace",
    }}>
      ⚠ {msg}
    </div>
  );
}

function Card({ children, style = {} }) {
  return (
    <div style={{
      background: "rgba(12,12,18,0.9)",
      border: `1px solid ${BORDER}`,
      borderRadius: 6,
      padding: "20px 24px",
      ...style,
    }}>
      {children}
    </div>
  );
}

function Tag({ children, color = R }) {
  return (
    <span style={{
      display: "inline-block",
      padding: "2px 7px",
      borderRadius: 3,
      background: `${color}22`,
      border: `1px solid ${color}55`,
      color,
      fontSize: 10,
      letterSpacing: 1,
      fontWeight: 700,
      fontFamily: "monospace",
    }}>
      {children}
    </span>
  );
}

function Lbl({ children }) {
  return (
    <div style={{
      fontSize: 9, letterSpacing: 2, textTransform: "uppercase",
      color: R, fontWeight: 700, marginBottom: 6,
    }}>
      {children}
    </div>
  );
}

function Sel({ value, onChange, children, style = {} }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        background: "rgba(255,255,255,0.04)",
        border: `1px solid ${BORDER}`,
        color: "#fff",
        padding: "8px 12px",
        borderRadius: 4,
        fontSize: 12,
        outline: "none",
        cursor: "pointer",
        fontFamily: "'JetBrains Mono', monospace",
        ...style,
      }}
    >
      {children}
    </select>
  );
}

function Btn({ children, onClick, disabled, active }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: active ? R : disabled ? "rgba(255,255,255,0.04)" : "transparent",
        border: `1px solid ${active ? R : BORDER}`,
        color: disabled ? "rgba(255,255,255,0.3)" : "#fff",
        padding: "8px 16px",
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 1.5,
        textTransform: "uppercase",
        cursor: disabled ? "not-allowed" : "pointer",
        fontFamily: "monospace",
        transition: "all .15s",
      }}
    >
      {children}
    </button>
  );
}

function TeamBar({ color }) {
  return <div style={{ width: 3, height: 16, background: color, borderRadius: 2, flexShrink: 0 }} />;
}

// ── Session selector ──────────────────────────────────────────────────────────

function SessionSelector({ year, setYear, round, setRound, sessionType, setSessionType, schedule, onLoad }) {
  return (
    <Card style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div>
          <Lbl>Season</Lbl>
          <Sel value={year} onChange={v => { setYear(v); setRound(""); }}>
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </Sel>
        </div>
        <div>
          <Lbl>Race</Lbl>
          <Sel value={round} onChange={setRound} style={{ minWidth: 220 }}>
            <option value="">Select race...</option>
            {schedule.map(e => (
              <option key={e.round} value={e.round}>R{e.round} · {e.name}</option>
            ))}
          </Sel>
        </div>
        <div>
          <Lbl>Session</Lbl>
          <Sel value={sessionType} onChange={setSessionType}>
            {[
              ["R", "Race"], ["Q", "Qualifying"], ["S", "Sprint"],
              ["FP1", "Practice 1"], ["FP2", "Practice 2"], ["FP3", "Practice 3"],
            ].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Sel>
        </div>
        <Btn onClick={onLoad} disabled={!round} active>Load Data</Btn>
      </div>
    </Card>
  );
}

// ── Tab: Race Results ─────────────────────────────────────────────────────────

function ResultsTab({ schedule, year, setYear }) {
  const [round, setRound] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  const load = async () => {
    setLoading(true); setErr(null); setData(null);
    try { setData(await apiFetch(`/results/${year}/${round}`)); }
    catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="fade">
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <Lbl>Season</Lbl>
            <Sel value={year} onChange={v => { setYear(v); setRound(""); }}>
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </Sel>
          </div>
          <div>
            <Lbl>Race</Lbl>
            <Sel value={round} onChange={setRound} style={{ minWidth: 220 }}>
              <option value="">Select race...</option>
              {schedule.map(e => (
                <option key={e.round} value={e.round}>R{e.round} · {e.name}</option>
              ))}
            </Sel>
          </div>
          <Btn onClick={load} disabled={!round} active>Load Results</Btn>
        </div>
      </Card>

      {loading && <Spinner />}
      {err && <ErrBox msg={err} />}
      {data && (
        <Card>
          <div style={{
            fontSize: 18, fontFamily: "'Barlow Condensed', sans-serif",
            fontWeight: 900, letterSpacing: 2, marginBottom: 20,
          }}>
            {data.race.toUpperCase()} <span style={{ color: R }}>{data.year}</span>
          </div>
          <table className="tbl">
            <thead>
              <tr>
                <th>Pos</th><th>Grid</th><th>Driver</th><th>Team</th>
                <th>Status</th><th>Pts</th><th>Gap</th><th>Fastest Lap</th>
              </tr>
            </thead>
            <tbody>
              {data.results.map((r, i) => (
                <tr key={i}>
                  <td>
                    <span style={{
                      background: i < 3 ? R : "transparent",
                      padding: i < 3 ? "2px 6px" : 0,
                      borderRadius: 2, fontWeight: 700,
                    }}>
                      {r.ClassifiedPosition ?? r.Position ?? "—"}
                    </span>
                  </td>
                  <td style={{ color: "rgba(255,255,255,0.5)" }}>{r.GridPosition ?? "—"}</td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <TeamBar color={r.TeamColor} />
                      <span style={{ fontWeight: 600 }}>{r.Abbreviation}</span>
                      <span style={{ color: "rgba(255,255,255,0.45)", fontSize: 11 }}>{r.FullName}</span>
                    </div>
                  </td>
                  <td style={{ color: "rgba(255,255,255,0.6)", fontSize: 11 }}>{r.TeamName}</td>
                  <td><Tag color={r.Status === "Finished" ? "#39b54a" : R}>{r.Status || "—"}</Tag></td>
                  <td style={{ color: "#FFD700", fontWeight: 700 }}>{r.Points ?? "—"}</td>
                  <td style={{ color: "rgba(255,255,255,0.5)" }}>
                    {r.Time != null ? fmtGap(r.Time) : "—"}
                  </td>
                  <td style={{ color: "rgba(255,255,255,0.6)" }}>{fmt(r.FastestLapTime)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

// ── Tab: Lap Times ────────────────────────────────────────────────────────────

function LapTimesTab({ schedule, year, setYear }) {
  const [round, setRound] = useState("");
  const [sessionType, setSessionType] = useState("R");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [selectedDrivers, setSelectedDrivers] = useState([]);

  const load = async () => {
    setLoading(true); setErr(null); setData(null); setSelectedDrivers([]);
    try {
      const d = await apiFetch(`/laps/${year}/${round}/${sessionType}`);
      setData(d);
      setSelectedDrivers([...new Set(d.laps.map(l => l.Driver))].slice(0, 3));
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  const allDrivers = data ? [...new Set(data.laps.map(l => l.Driver))].sort() : [];
  const colorMap = {};
  if (data) data.laps.forEach(l => { colorMap[l.Driver] = l.TeamColor || "#888"; });

  const buildChartData = () => {
    if (!data || !data.laps.length) return [];
    const maxLap = Math.max(...data.laps.map(l => l.LapNumber || 0));
    const result = [];
    for (let lap = 1; lap <= maxLap; lap++) {
      const pt = { lap };
      for (const drv of selectedDrivers) {
        const row = data.laps.find(x => x.Driver === drv && x.LapNumber === lap);
        if (row && row.LapTime != null && row.LapTime < 200) {
          pt[drv] = +row.LapTime.toFixed(3);
        }
      }
      result.push(pt);
    }
    return result;
  };

  const chartData = buildChartData();

  return (
    <div className="fade">
      <SessionSelector
        year={year} setYear={v => { setYear(v); setRound(""); }}
        round={round} setRound={setRound}
        sessionType={sessionType} setSessionType={setSessionType}
        schedule={schedule} onLoad={load}
      />
      {loading && <Spinner />}
      {err && <ErrBox msg={err} />}
      {data && (
        <>
          <Card style={{ marginBottom: 16 }}>
            <Lbl>Select Drivers</Lbl>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
              {allDrivers.map(d => (
                <button
                  key={d}
                  onClick={() => setSelectedDrivers(prev =>
                    prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]
                  )}
                  style={{
                    padding: "4px 10px", borderRadius: 3, fontSize: 11,
                    cursor: "pointer", fontFamily: "monospace", fontWeight: 700,
                    border: `1px solid ${selectedDrivers.includes(d) ? colorMap[d] : BORDER}`,
                    background: selectedDrivers.includes(d) ? `${colorMap[d]}22` : "transparent",
                    color: selectedDrivers.includes(d) ? colorMap[d] : "rgba(255,255,255,0.5)",
                    transition: "all .15s",
                  }}
                >
                  {d}
                </button>
              ))}
            </div>
          </Card>
          <Card>
            <Lbl>Lap Times — {data.race}</Lbl>
            <ResponsiveContainer width="100%" height={340}>
              <LineChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="lap" stroke="rgba(255,255,255,0.2)" tick={{ fontSize: 10, fill: "#fff" }}
                  label={{ value: "Lap", position: "insideBottomRight", offset: -5, fill: "rgba(255,255,255,0.4)", fontSize: 10 }} />
                <YAxis stroke="rgba(255,255,255,0.2)" tick={{ fontSize: 10, fill: "#fff" }} tickFormatter={fmt} width={70} />
                <Tooltip contentStyle={TT} formatter={(v, n) => [fmt(v), n]} labelFormatter={l => `Lap ${l}`} />
                <Legend wrapperStyle={{ fontSize: 11, fontFamily: "monospace" }} />
                {selectedDrivers.map(d => (
                  <Line key={d} type="monotone" dataKey={d}
                    stroke={colorMap[d]} strokeWidth={1.5} dot={false} connectNulls={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </>
      )}
    </div>
  );
}

// ── Tab: Tyre Strategy ────────────────────────────────────────────────────────

function TyreStrategyTab({ schedule, year, setYear }) {
  const [round, setRound] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  const load = async () => {
    setLoading(true); setErr(null); setData(null);
    try { setData(await apiFetch(`/stints/${year}/${round}`)); }
    catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  const driverOrder = data ? [...new Set((data.drivers || []).map(d => d.Abbreviation))] : [];
  const maxLap = data ? Math.max(...data.stints.map(s => s.EndLap || 0)) : 60;

  return (
    <div className="fade">
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <Lbl>Season</Lbl>
            <Sel value={year} onChange={v => { setYear(v); setRound(""); }}>
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </Sel>
          </div>
          <div>
            <Lbl>Race</Lbl>
            <Sel value={round} onChange={setRound} style={{ minWidth: 220 }}>
              <option value="">Select race...</option>
              {schedule.map(e => <option key={e.round} value={e.round}>R{e.round} · {e.name}</option>)}
            </Sel>
          </div>
          <Btn onClick={load} disabled={!round} active>Load Strategy</Btn>
        </div>
      </Card>

      {loading && <Spinner />}
      {err && <ErrBox msg={err} />}
      {data && (
        <Card>
          <Lbl>Tyre Strategy — {data.race} {data.year}</Lbl>
          <div style={{ marginBottom: 12, display: "flex", gap: 12, flexWrap: "wrap" }}>
            {[
              ["SOFT", "#E8002D"], ["MEDIUM", "#FFF200"], ["HARD", "#fff"],
              ["INTERMEDIATE", "#39B54A"], ["WET", "#0067FF"],
            ].map(([c, col]) => (
              <div key={c} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10 }}>
                <div style={{ width: 12, height: 12, borderRadius: "50%", background: col }} />
                <span style={{ color: "rgba(255,255,255,0.6)" }}>{c}</span>
              </div>
            ))}
          </div>
          <div style={{ overflowX: "auto" }}>
            {driverOrder.map(drv => {
              const driverInfo = (data.drivers || []).find(d => d.Abbreviation === drv);
              const driverStints = data.stints.filter(s => s.Driver === drv);
              return (
                <div key={drv} style={{ display: "flex", alignItems: "center", marginBottom: 6, gap: 10 }}>
                  <div style={{
                    width: 36, fontSize: 11, fontWeight: 700,
                    flexShrink: 0, textAlign: "right",
                    color: driverInfo ? driverInfo.TeamColor : "#fff",
                  }}>{drv}</div>
                  <div style={{ position: "relative", flex: 1, height: 20 }}>
                    {driverStints.map((stint, i) => {
                      const left = ((stint.StartLap - 1) / maxLap) * 100;
                      const width = ((stint.EndLap - stint.StartLap + 1) / maxLap) * 100;
                      return (
                        <div key={i}
                          title={`${stint.Compound} — L${stint.StartLap}–${stint.EndLap} (${stint.Laps} laps)`}
                          style={{
                            position: "absolute", left: `${left}%`, width: `${width}%`,
                            height: "100%", background: stint.CompoundColor || "#888",
                            borderRadius: 2, borderRight: "2px solid #06060A", opacity: 0.9,
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
              <div style={{ width: 36 }} />
              <div style={{ flex: 1, display: "flex", justifyContent: "space-between", fontSize: 9, color: "rgba(255,255,255,0.3)" }}>
                {Array.from({ length: 11 }, (_, i) => Math.round(i * maxLap / 10)).map(l => (
                  <span key={l}>{l}</span>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

// ── Tab: Telemetry ────────────────────────────────────────────────────────────

function TelemetryTab({ schedule, year, setYear }) {
  const [round, setRound] = useState("");
  const [sessionType, setSessionType] = useState("Q");
  const [driver, setDriver] = useState("VER");
  const [lapNum, setLapNum] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  const load = async () => {
    setLoading(true); setErr(null); setData(null);
    try {
      const lapQ = lapNum ? `?lap_number=${lapNum}` : "";
      setData(await apiFetch(`/telemetry/${year}/${round}/${sessionType}/${driver}${lapQ}`));
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  const tc = data?.teamColor || R;

  return (
    <div className="fade">
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <Lbl>Season</Lbl>
            <Sel value={year} onChange={v => { setYear(v); setRound(""); }}>
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </Sel>
          </div>
          <div>
            <Lbl>Race</Lbl>
            <Sel value={round} onChange={setRound} style={{ minWidth: 200 }}>
              <option value="">Select race...</option>
              {schedule.map(e => <option key={e.round} value={e.round}>R{e.round} · {e.name}</option>)}
            </Sel>
          </div>
          <div>
            <Lbl>Session</Lbl>
            <Sel value={sessionType} onChange={setSessionType}>
              {["R","Q","S","FP1","FP2","FP3"].map(s => <option key={s} value={s}>{s}</option>)}
            </Sel>
          </div>
          <div>
            <Lbl>Driver Code</Lbl>
            <input value={driver} onChange={e => setDriver(e.target.value.toUpperCase())}
              maxLength={3} placeholder="VER"
              style={{
                background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`,
                color: "#fff", padding: "8px 12px", borderRadius: 4,
                fontSize: 12, outline: "none", width: 80,
                fontFamily: "'JetBrains Mono', monospace",
              }} />
          </div>
          <div>
            <Lbl>Lap (blank = fastest)</Lbl>
            <input value={lapNum} onChange={e => setLapNum(e.target.value)}
              type="number" min={1} placeholder="—"
              style={{
                background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`,
                color: "#fff", padding: "8px 12px", borderRadius: 4,
                fontSize: 12, outline: "none", width: 80,
                fontFamily: "'JetBrains Mono', monospace",
              }} />
          </div>
          <Btn onClick={load} disabled={!round || !driver} active>Load Telemetry</Btn>
        </div>
      </Card>

      {loading && <Spinner />}
      {err && <ErrBox msg={err} />}
      {data && (
        <>
          <div style={{ display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
            {[["Driver", data.driver], ["Lap", data.lap], ["Lap Time", fmt(data.laptime)], ["Compound", data.compound]].map(([l, v]) => (
              <Card key={l} style={{ padding: "12px 18px", flex: 1, minWidth: 120 }}>
                <Lbl>{l}</Lbl>
                <div style={{ fontSize: 20, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, color: tc }}>{v}</div>
              </Card>
            ))}
          </div>

          <Card style={{ marginBottom: 12 }}>
            <Lbl>Speed Trace</Lbl>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={data.telemetry} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={tc} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={tc} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="Distance" stroke="rgba(255,255,255,0.2)" tick={{ fontSize: 9, fill: "#fff" }} tickFormatter={v => `${Math.round(v)}m`} />
                <YAxis stroke="rgba(255,255,255,0.2)" tick={{ fontSize: 9, fill: "#fff" }} domain={[0, 380]} unit=" km/h" />
                <Tooltip contentStyle={TT} formatter={v => [`${v} km/h`, "Speed"]} labelFormatter={v => `${Math.round(v)}m`} />
                <Area type="monotone" dataKey="Speed" stroke={tc} strokeWidth={1.5} fill="url(#sg)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </Card>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <Card>
              <Lbl>Throttle %</Lbl>
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={data.telemetry}>
                  <defs>
                    <linearGradient id="tg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#39b54a" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#39b54a" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="Distance" tick={false} />
                  <YAxis tick={{ fontSize: 9, fill: "#fff" }} domain={[0, 100]} />
                  <Tooltip contentStyle={TT} formatter={v => [`${v}%`, "Throttle"]} />
                  <Area type="monotone" dataKey="Throttle" stroke="#39b54a" strokeWidth={1.5} fill="url(#tg)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
            <Card>
              <Lbl>Brake</Lbl>
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={data.telemetry}>
                  <defs>
                    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={R} stopOpacity={0.5} />
                      <stop offset="95%" stopColor={R} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="Distance" tick={false} />
                  <YAxis tick={{ fontSize: 9, fill: "#fff" }} />
                  <Tooltip contentStyle={TT} formatter={v => [v ? "Braking" : "Off", "Brake"]} />
                  <Area type="monotone" dataKey="Brake" stroke={R} strokeWidth={1.5} fill="url(#bg)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Card>
              <Lbl>Gear</Lbl>
              <ResponsiveContainer width="100%" height={140}>
                <LineChart data={data.telemetry}>
                  <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="Distance" tick={false} />
                  <YAxis tick={{ fontSize: 9, fill: "#fff" }} domain={[0, 8]} />
                  <Tooltip contentStyle={TT} formatter={v => [v, "Gear"]} />
                  <Line type="stepAfter" dataKey="nGear" stroke="#FFD700" strokeWidth={1.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
            <Card>
              <Lbl>RPM</Lbl>
              <ResponsiveContainer width="100%" height={140}>
                <AreaChart data={data.telemetry}>
                  <defs>
                    <linearGradient id="rg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#9b59b6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#9b59b6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="Distance" tick={false} />
                  <YAxis tick={{ fontSize: 9, fill: "#fff" }} />
                  <Tooltip contentStyle={TT} />
                  <Area type="monotone" dataKey="RPM" stroke="#9b59b6" strokeWidth={1.5} fill="url(#rg)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

// ── Tab: Driver Compare ───────────────────────────────────────────────────────

function CompareTab({ schedule, year, setYear }) {
  const [round, setRound] = useState("");
  const [sessionType, setSessionType] = useState("Q");
  const [driver1, setDriver1] = useState("VER");
  const [driver2, setDriver2] = useState("LEC");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  const load = async () => {
    setLoading(true); setErr(null); setData(null);
    try {
      setData(await apiFetch(`/compare/${year}/${round}/${sessionType}?drivers=${driver1},${driver2}`));
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  const drivers = data ? Object.entries(data.drivers) : [];

  const buildMerged = () => {
    if (drivers.length < 2) return [];
    const [d1name, d1data] = drivers[0];
    const [d2name, d2data] = drivers[1];
    const map = {};
    d1data.telemetry.forEach(p => { map[Math.round(p.Distance)] = { dist: p.Distance, [d1name]: p.Speed }; });
    d2data.telemetry.forEach(p => {
      const k = Math.round(p.Distance);
      if (!map[k]) map[k] = { dist: p.Distance };
      map[k][d2name] = p.Speed;
    });
    return Object.values(map).sort((a, b) => a.dist - b.dist);
  };

  const merged = buildMerged();

  const buildDelta = () => {
    if (drivers.length < 2) return [];
    const [d1name] = drivers[0];
    const [d2name] = drivers[1];
    return merged
      .map(p => ({
        dist: p.dist,
        delta: p[d1name] != null && p[d2name] != null
          ? +(p[d1name] - p[d2name]).toFixed(1) : null,
      }))
      .filter(p => p.delta != null);
  };

  const delta = buildDelta();

  return (
    <div className="fade">
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <Lbl>Season</Lbl>
            <Sel value={year} onChange={v => { setYear(v); setRound(""); }}>
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </Sel>
          </div>
          <div>
            <Lbl>Race</Lbl>
            <Sel value={round} onChange={setRound} style={{ minWidth: 200 }}>
              <option value="">Select race...</option>
              {schedule.map(e => <option key={e.round} value={e.round}>R{e.round} · {e.name}</option>)}
            </Sel>
          </div>
          <div>
            <Lbl>Session</Lbl>
            <Sel value={sessionType} onChange={setSessionType}>
              {["R","Q","S","FP1","FP2","FP3"].map(s => <option key={s} value={s}>{s}</option>)}
            </Sel>
          </div>
          {[["Driver 1", driver1, setDriver1], ["Driver 2", driver2, setDriver2]].map(([lbl, val, set]) => (
            <div key={lbl}>
              <Lbl>{lbl}</Lbl>
              <input value={val} onChange={e => set(e.target.value.toUpperCase())} maxLength={3}
                style={{
                  background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`,
                  color: "#fff", padding: "8px 12px", borderRadius: 4,
                  fontSize: 12, outline: "none", width: 72,
                  fontFamily: "'JetBrains Mono', monospace",
                }} />
            </div>
          ))}
          <Btn onClick={load} disabled={!round} active>Compare</Btn>
        </div>
      </Card>

      {loading && <Spinner />}
      {err && <ErrBox msg={err} />}
      {data && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            {drivers.map(([drv, dd]) => (
              <Card key={drv} style={{ borderTop: `3px solid ${dd.teamColor}` }}>
                <div style={{ fontSize: 28, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, color: dd.teamColor }}>{drv}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 8 }}>{dd.team}</div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{fmt(dd.laptime)}</div>
                <Tag color={dd.teamColor}>{dd.compound}</Tag>
              </Card>
            ))}
          </div>

          <Card style={{ marginBottom: 12 }}>
            <Lbl>Speed Comparison</Lbl>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={merged} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="dist" tick={{ fontSize: 9, fill: "#fff" }} tickFormatter={v => `${Math.round(v)}m`} />
                <YAxis tick={{ fontSize: 9, fill: "#fff" }} unit=" km/h" domain={[0, 380]} />
                <Tooltip contentStyle={TT} formatter={(v, n) => [`${v} km/h`, n]} labelFormatter={v => `${Math.round(v)}m`} />
                <Legend wrapperStyle={{ fontSize: 11, fontFamily: "monospace" }} />
                {drivers.map(([drv, dd]) => (
                  <Line key={drv} type="monotone" dataKey={drv}
                    stroke={dd.teamColor} strokeWidth={1.5} dot={false} connectNulls />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </Card>

          <Card>
            <Lbl>Speed Delta ({drivers[0]?.[0]} vs {drivers[1]?.[0]}) km/h</Lbl>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={delta} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="dg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={drivers[0]?.[1]?.teamColor || R} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={drivers[0]?.[1]?.teamColor || R} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="dist" tick={{ fontSize: 9, fill: "#fff" }} tickFormatter={v => `${Math.round(v)}m`} />
                <YAxis tick={{ fontSize: 9, fill: "#fff" }} />
                <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" strokeDasharray="4 4" />
                <Tooltip contentStyle={TT} formatter={v => [`${v > 0 ? "+" : ""}${v} km/h`, "ΔSpeed"]} />
                <Area type="monotone" dataKey="delta" stroke={drivers[0]?.[1]?.teamColor || R}
                  strokeWidth={1.5} fill="url(#dg)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </>
      )}
    </div>
  );
}

// ── Tab: Sectors ──────────────────────────────────────────────────────────────

function SectorsTab({ schedule, year, setYear }) {
  const [round, setRound] = useState("");
  const [sessionType, setSessionType] = useState("Q");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  const load = async () => {
    setLoading(true); setErr(null); setData(null);
    try { setData(await apiFetch(`/sectors/${year}/${round}/${sessionType}`)); }
    catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  const bestS1 = data ? Math.min(...data.sectors.filter(s => s.Sector1Time != null).map(s => s.Sector1Time)) : Infinity;
  const bestS2 = data ? Math.min(...data.sectors.filter(s => s.Sector2Time != null).map(s => s.Sector2Time)) : Infinity;
  const bestS3 = data ? Math.min(...data.sectors.filter(s => s.Sector3Time != null).map(s => s.Sector3Time)) : Infinity;

  const barData = data ? data.sectors.map(s => ({
    driver: s.Driver,
    S1: s.Sector1Time ? +s.Sector1Time.toFixed(3) : null,
    S2: s.Sector2Time ? +s.Sector2Time.toFixed(3) : null,
    S3: s.Sector3Time ? +s.Sector3Time.toFixed(3) : null,
  })) : [];

  return (
    <div className="fade">
      <SessionSelector
        year={year} setYear={v => { setYear(v); setRound(""); }}
        round={round} setRound={setRound}
        sessionType={sessionType} setSessionType={setSessionType}
        schedule={schedule} onLoad={load}
      />
      {loading && <Spinner />}
      {err && <ErrBox msg={err} />}
      {data && (
        <>
          <Card style={{ marginBottom: 12 }}>
            <Lbl>Fastest Lap per Driver — {data.race}</Lbl>
            <table className="tbl">
              <thead>
                <tr><th>Pos</th><th>Driver</th><th>Lap Time</th><th>S1</th><th>S2</th><th>S3</th><th>Compound</th></tr>
              </thead>
              <tbody>
                {data.sectors.map((s, i) => (
                  <tr key={i}>
                    <td style={{ color: "rgba(255,255,255,0.5)" }}>{i + 1}</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <TeamBar color={s.TeamColor} />
                        <span style={{ fontWeight: 700 }}>{s.Driver}</span>
                      </div>
                    </td>
                    <td style={{ fontWeight: 700 }}>{fmt(s.LapTime)}</td>
                    {[s.Sector1Time, s.Sector2Time, s.Sector3Time].map((sec, j) => {
                      const best = [bestS1, bestS2, bestS3][j];
                      const isBest = sec != null && Math.abs(sec - best) < 0.001;
                      return (
                        <td key={j} style={{
                          color: isBest ? "#FFD700" : "#fff",
                          fontWeight: isBest ? 700 : 400,
                          background: isBest ? "rgba(255,215,0,0.08)" : "transparent",
                        }}>{fmt(sec)}</td>
                      );
                    })}
                    <td><Tag color={s.CompoundColor}>{s.Compound || "—"}</Tag></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <Card>
            <Lbl>Sector Time Breakdown</Lbl>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={barData} layout="vertical" margin={{ top: 5, right: 20, left: 30, bottom: 5 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 9, fill: "#fff" }} tickFormatter={fmt} />
                <YAxis type="category" dataKey="driver" tick={{ fontSize: 11, fill: "#fff", fontFamily: "monospace" }} />
                <Tooltip contentStyle={TT} formatter={fmt} />
                <Legend wrapperStyle={{ fontSize: 11, fontFamily: "monospace" }} />
                <Bar dataKey="S1" name="Sector 1" fill="#3671C6" stackId="a" />
                <Bar dataKey="S2" name="Sector 2" fill="#E8002D" stackId="a" />
                <Bar dataKey="S3" name="Sector 3" fill="#FF8000" stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </>
      )}
    </div>
  );
}

// ── Tab: Pit Stops ────────────────────────────────────────────────────────────

function PitStopsTab({ schedule, year, setYear }) {
  const [round, setRound] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  const load = async () => {
    setLoading(true); setErr(null); setData(null);
    try { setData(await apiFetch(`/pitstops/${year}/${round}`)); }
    catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="fade">
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <Lbl>Season</Lbl>
            <Sel value={year} onChange={v => { setYear(v); setRound(""); }}>
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </Sel>
          </div>
          <div>
            <Lbl>Race</Lbl>
            <Sel value={round} onChange={setRound} style={{ minWidth: 220 }}>
              <option value="">Select race...</option>
              {schedule.map(e => <option key={e.round} value={e.round}>R{e.round} · {e.name}</option>)}
            </Sel>
          </div>
          <Btn onClick={load} disabled={!round} active>Load Pit Stops</Btn>
        </div>
      </Card>

      {loading && <Spinner />}
      {err && <ErrBox msg={err} />}
      {data && (
        <Card>
          <Lbl>Pit Stop Log — {data.race} {data.year}</Lbl>
          <table className="tbl">
            <thead>
              <tr><th>Driver</th><th>Team</th><th>Lap</th><th>Stint</th><th>Compound</th><th>Tyre Age</th></tr>
            </thead>
            <tbody>
              {data.pitstops.map((p, i) => (
                <tr key={i}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <TeamBar color={p.TeamColor} />
                      <span style={{ fontWeight: 700 }}>{p.Driver}</span>
                    </div>
                  </td>
                  <td style={{ color: "rgba(255,255,255,0.5)", fontSize: 11 }}>{p.Team}</td>
                  <td style={{ fontWeight: 700 }}>L{p.LapNumber}</td>
                  <td style={{ color: "rgba(255,255,255,0.5)" }}>Stint {p.Stint}</td>
                  <td><Tag color={p.CompoundColor}>{p.Compound || "—"}</Tag></td>
                  <td style={{ color: "rgba(255,255,255,0.6)" }}>
                    {p.TyreLife != null ? `${p.TyreLife} laps` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────

const TABS = [
  { id: "results",   label: "Race Results",  icon: "🏆" },
  { id: "laps",      label: "Lap Times",     icon: "⏱" },
  { id: "strategy",  label: "Tyre Strategy", icon: "🔴" },
  { id: "telemetry", label: "Telemetry",     icon: "📡" },
  { id: "compare",   label: "Driver Compare",icon: "⚔" },
  { id: "sectors",   label: "Sector Times",  icon: "📊" },
  { id: "pitstops",  label: "Pit Stops",     icon: "🔧" },
];

export default function App() {
  const [tab, setTab] = useState("results");
  const [year, setYear] = useState(2026);
  const [schedule, setSchedule] = useState([]);
  const [schedErr, setSchedErr] = useState(null);
  const [apiOk, setApiOk] = useState(null);

  useEffect(() => {
    apiFetch("/health")
      .then(() => setApiOk(true))
      .catch(() => setApiOk(false));
  }, []);

  useEffect(() => {
    setSchedule([]);
    setSchedErr(null);
    apiFetch(`/schedule/${year}`)
      .then(d => setSchedule(d.events))
      .catch(e => setSchedErr(e.message));
  }, [year]);

  const tabProps = { schedule, year, setYear };

  return (
    <>
      <style>{css}</style>

      {/* Sticky header */}
      <div style={{
        position: "sticky", top: 0, zIndex: 200,
        background: "rgba(6,6,10,0.97)",
        backdropFilter: "blur(16px)",
        borderBottom: `1px solid ${BORDER}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 28px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <img
                src="/PitMind.png"
                alt="PitMind"
                style={{
                  height: 40,
                  width: "auto",
                  borderRadius: 6,
                  display: "block",
                }}
              />
              <div style={{ fontSize: 9, letterSpacing: 2, color: "rgba(255,255,255,0.35)", paddingLeft: 2 }}>
                F1 TELEMETRY PLATFORM 2020–2026
              </div>
            </div>
          </div>
          <div style={{
            fontSize: 10, letterSpacing: 1, fontFamily: "monospace",
            padding: "4px 10px", borderRadius: 20,
            background: apiOk === null ? DIM : apiOk ? "rgba(57,181,74,0.15)" : "rgba(225,6,0,0.15)",
            border: `1px solid ${apiOk === null ? BORDER : apiOk ? "rgba(57,181,74,0.4)" : "rgba(225,6,0,0.4)"}`,
            color: apiOk === null ? "rgba(255,255,255,0.4)" : apiOk ? "#39b54a" : R,
          }}>
            {apiOk === null ? "● CONNECTING" : apiOk ? "● API LIVE" : "● API OFFLINE"}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", overflowX: "auto", padding: "0 28px" }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              background: "none", border: "none", cursor: "pointer",
              padding: "10px 16px", fontSize: 11, fontWeight: 700,
              letterSpacing: 1.5, textTransform: "uppercase",
              fontFamily: "monospace", whiteSpace: "nowrap",
              color: tab === t.id ? "#fff" : "rgba(255,255,255,0.35)",
              borderBottom: `2px solid ${tab === t.id ? R : "transparent"}`,
              transition: "all .15s", marginBottom: "-1px",
              display: "flex", gap: 6, alignItems: "center",
            }}>
              <span style={{ fontSize: 13 }}>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 24px" }}>
        {apiOk === false && (
          <div style={{ marginBottom: 20 }}>
            <ErrBox msg="Cannot reach the backend API. Make sure the server is running." />
          </div>
        )}
        {schedErr && (
          <div style={{ marginBottom: 12 }}>
            <ErrBox msg={`Schedule error: ${schedErr}`} />
          </div>
        )}
        {tab === "results"   && <ResultsTab      {...tabProps} />}
        {tab === "laps"      && <LapTimesTab     {...tabProps} />}
        {tab === "strategy"  && <TyreStrategyTab {...tabProps} />}
        {tab === "telemetry" && <TelemetryTab    {...tabProps} />}
        {tab === "compare"   && <CompareTab      {...tabProps} />}
        {tab === "sectors"   && <SectorsTab      {...tabProps} />}
        {tab === "pitstops"  && <PitStopsTab     {...tabProps} />}
      </div>
    </>
  );
}
