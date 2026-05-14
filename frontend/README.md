# SymbolTutor

A TypeScript frontend for an AI tutor app that turns a concept prompt into a symbol-based animated lesson preview.

## Run locally

```bash
npm install
npm run dev
```

## Backend connection

Create `.env` from `.env.example` and point `VITE_API_BASE_URL` to the backend.

```bash
VITE_API_BASE_URL=http://localhost:8000
VITE_USE_MOCK_API=false
```

The frontend calls `POST /lessons` with a typed `GenerateLessonRequest`. See [src/types/lesson.ts](./src/types/lesson.ts) and [src/api/lessonApi.ts](./src/api/lessonApi.ts).
