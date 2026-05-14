# Meet Companion

Combined Visual Tutor demo with a real backend and a Vite frontend.

## Local Setup

```bash
npm --prefix backend install
npm --prefix frontend install
cp backend/.env.example backend/.env
```

Add `OPENAI_API_KEY` to `backend/.env` for OpenAI-generated tutor scripts. The
backend uses `ffmpeg` to create a fresh 10-second MP4 per lesson request.

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

## Test

```bash
npm test
```
