# PitMind — F1 Telemetry Platform

Real Formula 1 telemetry data from 2020–2026, visualised in a full-stack web dashboard.

## Features

- **Race Results** — Full classification, gaps, points, fastest laps
- **Lap Times** — Multi-driver lap time chart with team colors
- **Tyre Strategy** — Visual stint chart for all 22 drivers, colour-coded by compound
- **Telemetry** — Speed trace, throttle, brake, gear, RPM for any driver/lap
- **Driver Compare** — Overlaid speed traces + speed delta chart
- **Sector Times** — Best sector breakdown with gold highlighting for session bests
- **Pit Stops** — Full pit stop log with compound and tyre age

## Stack

| Layer    | Tech                              |
|----------|-----------------------------------|
| Data     | FastF1 (official F1 timing feed)  |
| Backend  | FastAPI + Uvicorn                 |
| Frontend | React 18 + Recharts               |

## Local Setup

### Backend

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env        # fill in your API key
python -m uvicorn main:app --reload
```

Backend runs at `http://localhost:8000`

### Frontend

```bash
cd frontend
npm install
cp .env.example .env        # fill in your API key
npm start
```

Frontend runs at `http://localhost:3000`

## File Structure

```
pitmind/
├── backend/
│   ├── main.py              # FastAPI — all endpoints, security, caching
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── App.jsx          # Full React dashboard
│   │   └── index.js
│   ├── public/
│   │   └── index.html
│   ├── package.json
│   └── .env.example
├── docs/
│   └── api.md               # API endpoint reference
├── .gitignore
├── README.md
└── roadmap.md
```

## Disclaimer

Data sourced from FastF1 via the official F1 timing feed. For educational and non-commercial purposes only. Formula 1 and related trademarks are the property of Formula One World Championship Limited.

## License

MIT
