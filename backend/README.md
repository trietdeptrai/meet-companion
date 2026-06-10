# Visual Tutor Backend

Backend for the Google Meet visual tutor demo. It turns a learner prompt like
`Giải thích định lý Pytagore` into a generated 10-second MP4 plus a tutor script,
captions, storyboard, and follow-up question.

## Setup

```bash
npm install
cp .env.example .env
```

Add an OpenAI key to `.env` before using the PRD job pipeline at
`POST /api/v1/video-jobs`. The async pipeline requires OpenAI planning and will
fail with `FAILED_PLANNING` / `OPENAI_NOT_CONFIGURED` instead of rendering a
fake fallback video when the key is missing.

```bash
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-5.4-mini
FFMPEG_PATH=ffmpeg
```

The legacy synchronous demo endpoint can still use a local fallback script, but
that behavior is intentionally not used by `/api/v1/video-jobs`.

Video generation uses `ffmpeg` and writes request-specific MP4 files to
`backend/public/generated/`.

Local PRD mode stores job/project metadata in SQLite at
`backend/data/visualexplain.sqlite`. Intermediate JSON artifacts are written
under `backend/data/artifacts/`. Structured logs are written to
`backend/logs/app.jsonl`.

## Run

```bash
npm run dev
```

Default URL: `http://localhost:8787`

If `../frontend/dist` exists, the backend also serves the built frontend from
`GET /`.

## API

```bash
curl http://localhost:8787/health
curl http://localhost:8787/ready
```

### Local Job Pipeline

```bash
curl -X POST http://localhost:8787/api/v1/video-jobs \
  -H 'Content-Type: application/json' \
  -d '{
    "concept":"Giải thích hệ toạ độ Decartes",
    "domain":"auto",
    "level":"beginner",
    "duration_sec":60,
    "language":"vi",
    "voiceover":false,
    "style":"visual_proof"
  }'
```

The local MVP returns immediately with a `job_id` and processes the job in the
same Node process. The requested duration is capped to 10 seconds for local
speed. If OpenAI is not configured, the job stops during planning and does not
create a `video_mp4` artifact.

```bash
curl http://localhost:8787/api/v1/video-jobs/<job_id>
curl http://localhost:8787/api/v1/projects/<project_id>
curl http://localhost:8787/api/v1/video-jobs/<job_id>/events
```

Monitoring endpoints:

```bash
curl http://localhost:8787/api/v1/metrics
curl http://localhost:8787/metrics
```

SQLite tables mirror the PRD's local data model:

- `projects`
- `video_jobs`
- `artifacts`
- `pipeline_steps`
- `render_attempts`

### Legacy Synchronous Demo API

```bash
curl -X POST http://localhost:8787/api/tutor/explain \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"Giải thích định lý Pytagore"}'
```

The response includes:

- `video.url`: `/generated/<request-id>.mp4`
- `tutor.opening`
- `tutor.steps`
- `tutor.followUpQuestion`
- `intelligenceSource`: `openai` or `template-fallback`

## Test

```bash
npm test
```
