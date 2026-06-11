# Meet Companion

Combined Visual Tutor demo with a real backend and a Vite frontend.

## Local Setup

```bash
npm --prefix backend install
npm --prefix frontend install
cp backend/.env.example backend/.env
```

Add `OPENAI_API_KEY` to `backend/.env` before using the async job API. The PRD
v2 pipeline requires OpenAI planning; without it, `/api/v2/video-jobs` fails
during planning instead of rendering a fake fallback video. The backend uses
`ffmpeg` to create a fresh adaptive-length MP4 after planning succeeds. Component
graph videos render through the local SVG craft renderer first, so output uses
real text, vector curves, glow, and component-specific layouts instead of the
older primitive drawbox-only look.
For local simplicity, backend job/project state is stored in SQLite at
`backend/data/visualexplain.sqlite`, generated videos go to
`backend/public/generated/`, intermediate JSON artifacts go to
`backend/data/artifacts/`, and logs go to `backend/logs/app.jsonl`.

## Run Combined App

Build the frontend once, then start the backend. The backend serves both the API
and the built frontend.

```bash
npm run build
npm start
```

Open `http://localhost:8787`.

## Dev Mode

Run backend and frontend in separate terminals:

```bash
npm run dev:backend
npm run dev:frontend
```

Open `http://localhost:5173`. Vite proxies `/api` and `/videos` to the backend.

## Backend Job API

```bash
curl -X POST http://localhost:8787/api/v2/video-jobs \
  -H 'Content-Type: application/json' \
  -d '{"concept":"Giải thích gradient descent như đi xuống thung lũng","output_language":"en","duration_sec":24,"quality_mode":"balanced"}'
```

Then poll:

```bash
curl http://localhost:8787/api/v2/video-jobs/<job_id>
curl http://localhost:8787/api/v2/projects/<project_id>
curl http://localhost:8787/api/v2/projects/<project_id>/component-graph
curl http://localhost:8787/api/v2/metrics
```

## Test

```bash
npm test
```
