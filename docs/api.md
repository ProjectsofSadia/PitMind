# PitMind API Reference

All endpoints require the `X-API-Key` header.

Base URL: `http://localhost:8000/api` (local) or your Railway URL (production)

## Endpoints

| Method | Endpoint | Rate Limit | Description |
|--------|----------|-----------|-------------|
| GET | `/health` | 60/min | API status check |
| GET | `/schedule/{year}` | 30/min | Race calendar for a season |
| GET | `/results/{year}/{round}` | 15/min | Race classification |
| GET | `/laps/{year}/{round}/{session}` | 10/min | All lap times |
| GET | `/telemetry/{year}/{round}/{session}/{driver}` | 8/min | Driver telemetry |
| GET | `/stints/{year}/{round}` | 10/min | Tyre stints |
| GET | `/pitstops/{year}/{round}` | 10/min | Pit stop log |
| GET | `/sectors/{year}/{round}/{session}` | 10/min | Sector times |
| GET | `/compare/{year}/{round}/{session}` | 6/min | Driver comparison |
| GET | `/fastest/{year}/{round}/{session}` | 10/min | Fastest lap leaderboard |

## Parameters

- `year` — 2020 to 2026
- `round` — 1 to 24
- `session` — R, Q, S, FP1, FP2, FP3
- `driver` — 3-letter code e.g. VER, LEC, HAM

## Query Parameters

- `/laps/...?driver=VER` — filter by driver
- `/telemetry/...?lap_number=34` — specific lap (omit for fastest)
- `/compare/...?drivers=VER,LEC` — comma-separated drivers (2–4)
