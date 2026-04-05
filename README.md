# PitMind 🏎️ — F1 Telemetry Platform

Real Formula 1 telemetry data from 2020–2026, visualised in a full-stack web dashboard.

## Features

- **Race Results** — Full classification, gaps, points, fastest laps
- **Lap Times** — Multi-driver lap time chart with team colors
- **Tyre Strategy** — Visual stint chart for all 20 drivers, colour-coded by compound
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

## Environment Variables

### backend/.env
```
PITMIND_API_KEY=your-secret-key-here
ALLOWED_ORIGIN=http://localhost:3000
```

### frontend/.env
```
REACT_APP_API_KEY=your-secret-key-here
REACT_APP_API_URL=http://localhost:8000/api
```

Both keys must match.

## Deployment

**Backend → Railway**
1. Push repo to GitHub
2. Connect Railway to the `backend/` folder
3. Set environment variables in Railway dashboard
4. Set a monthly spend limit in Railway settings

**Frontend → Vercel**
1. Connect Vercel to the `frontend/` folder
2. Set `REACT_APP_API_KEY` and `REACT_APP_API_URL` in Vercel environment variables
3. Update `ALLOWED_ORIGIN` in Railway to your Vercel URL

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

## Security

- API key authentication on every endpoint
- Rate limiting per IP (slowapi)
- CORS locked to frontend origin only
- Input validation on all parameters
- 90 second request timeout
- Security headers on all responses
- In-memory response cache (reduces compute and repeat FastF1 calls)

## Disclaimer

Data sourced from FastF1 via the official F1 timing feed. For educational and non-commercial purposes only. Formula 1 and related trademarks are the property of Formula One World Championship Limited.

## License

MIT
