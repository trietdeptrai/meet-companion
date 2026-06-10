# Visual Tutor

A TypeScript frontend for the VisualExplain backend job flow.

## Run locally

```bash
npm install
npm run dev
```

## Backend connection

By default, the frontend calls relative `/api/v1/video-jobs`, polls
`/api/v1/video-jobs/:jobId`, and plays `/generated/...` MP4 outputs. In dev,
Vite proxies those paths to the backend at `http://localhost:8787`.

```bash
VITE_API_BASE_URL=
```

For a deployed frontend hosted separately from the backend, set
`VITE_API_BASE_URL` to the backend origin.

The frontend creates a backend video job and maps the completed job response
into a lesson preview. See [src/types/lesson.ts](./src/types/lesson.ts) and
[src/api/lessonApi.ts](./src/api/lessonApi.ts).
