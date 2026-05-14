# SymbolTutor

A TypeScript frontend for an AI tutor app that turns a concept prompt into a symbol-based animated lesson preview.

## Run locally

```bash
npm install
npm run dev
```

## Backend connection

By default, the frontend calls relative `/api/tutor/explain` and `/videos/...`.
In dev, Vite proxies those paths to the backend at `http://localhost:8787`.

```bash
VITE_API_BASE_URL=
VITE_USE_MOCK_API=false
```

For a deployed frontend hosted separately from the backend, set
`VITE_API_BASE_URL` to the backend origin.

The frontend calls `POST /api/tutor/explain` and maps the backend tutor response
into a lesson preview. See [src/types/lesson.ts](./src/types/lesson.ts) and
[src/api/lessonApi.ts](./src/api/lessonApi.ts).
