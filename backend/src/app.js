import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import { createOpenAITutor } from "./services/openaiTutor.js";
import { createTutorService } from "./services/tutorService.js";
import { getTemplateSummaries } from "./templates.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const videoDirectory = path.resolve(__dirname, "../public/videos");

function defaultHasOpenAIKey() {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

function parseCorsOrigin() {
  const origin = process.env.CORS_ORIGIN;
  if (!origin) return true;
  return origin.split(",").map((entry) => entry.trim()).filter(Boolean);
}

export function createApp({
  generateLesson,
  hasOpenAIKey = defaultHasOpenAIKey,
} = {}) {
  const app = express();
  const openaiConfigured = hasOpenAIKey();
  const lessonGenerator =
    generateLesson ??
    (openaiConfigured ? createOpenAITutor().generateLesson : undefined);
  const tutorService = createTutorService({
    generateLesson: lessonGenerator,
    hasOpenAIKey,
  });

  app.use(cors({ origin: parseCorsOrigin() }));
  app.use(express.json({ limit: "1mb" }));
  app.use(
    "/videos",
    express.static(videoDirectory, {
      etag: true,
      fallthrough: false,
      immutable: false,
      maxAge: "5m",
    }),
  );

  app.get("/health", (req, res) => {
    res.json({
      status: "ok",
      openaiConfigured,
      templates: getTemplateSummaries().map((template) => template.id),
    });
  });

  app.get("/api/templates", (req, res) => {
    res.json({ templates: getTemplateSummaries() });
  });

  app.post("/api/tutor/explain", async (req, res, next) => {
    try {
      const result = await tutorService.explain({
        prompt: req.body?.prompt,
        language: req.body?.language,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.use((req, res) => {
    res.status(404).json({
      error: {
        code: "NOT_FOUND",
        message: `No route for ${req.method} ${req.path}`,
      },
    });
  });

  app.use((error, req, res, next) => {
    const status = error.status ?? 500;
    const code = error.code ?? "INTERNAL_ERROR";
    const message =
      status >= 500 ? "The tutor backend hit an unexpected error." : error.message;

    res.status(status).json({
      error: {
        code,
        message,
        details: error.details,
      },
    });
  });

  return app;
}
