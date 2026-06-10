# Meet Companion

Combined Visual Tutor demo with a real backend and a Vite frontend.

## Local Setup

```bash
npm --prefix backend install
npm --prefix frontend install
cp backend/.env.example backend/.env
```

Add `OPENAI_API_KEY` to `backend/.env` before using the async job API. The PRD
pipeline requires OpenAI planning; without it, `/api/v1/video-jobs` fails during
planning instead of rendering a fake fallback video. The backend uses `ffmpeg`
to create a fresh 10-second MP4 after planning succeeds.
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
curl -X POST http://localhost:8787/api/v1/video-jobs \
  -H 'Content-Type: application/json' \
  -d '{"concept":"Giải thích hệ toạ độ Decartes","language":"vi"}'
```

Then poll:

```bash
curl http://localhost:8787/api/v1/video-jobs/<job_id>
curl http://localhost:8787/api/v1/projects/<project_id>
curl http://localhost:8787/api/v1/metrics
```

## Test

```bash
npm test
```
