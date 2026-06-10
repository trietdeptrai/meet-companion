import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import cors from "cors";
import express from "express";
import { createLogger } from "./observability/logger.js";
import { createMetrics } from "./observability/metrics.js";
import { createOpenAITutor } from "./services/openaiTutor.js";
import { createSqliteJobStore } from "./services/sqliteJobStore.js";
import { createTutorService } from "./services/tutorService.js";
import { createVideoJobPipeline } from "./services/videoJobPipeline.js";
import { createVideoGenerator } from "./services/videoGenerator.js";
import { getTemplateSummaries } from "./templates.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const videoDirectory = path.resolve(__dirname, "../public/videos");
const defaultGeneratedDirectory = path.resolve(__dirname, "../public/generated");
const defaultDataDirectory = path.resolve(__dirname, "../data");
const defaultLogDirectory = path.resolve(__dirname, "../logs");
const defaultFrontendDirectory = path.resolve(__dirname, "../../frontend/dist");

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
  generateVideo,
  hasOpenAIKey = defaultHasOpenAIKey,
  generatedDirectory = defaultGeneratedDirectory,
  dataDirectory = process.env.LOCAL_DATA_DIR || defaultDataDirectory,
  databasePath = process.env.SQLITE_DB_PATH || path.join(dataDirectory, "visualexplain.sqlite"),
  logDirectory = process.env.LOG_DIR || defaultLogDirectory,
  frontendDirectory = process.env.FRONTEND_DIST_DIR || defaultFrontendDirectory,
} = {}) {
  const app = express();
  const openaiConfigured = hasOpenAIKey();
  const lessonGenerator =
    generateLesson ??
    (openaiConfigured ? createOpenAITutor().generateLesson : undefined);
  const tutorService = createTutorService({
    generateLesson: lessonGenerator,
    generateVideo: generateVideo ?? createVideoGenerator({ outputDirectory: generatedDirectory }),
    hasOpenAIKey,
  });
  const metrics = createMetrics();
  const logger = createLogger({
    logDirectory,
    consoleEnabled: process.env.LOG_TO_CONSOLE === "true",
  });
  const videoJobPipeline = createVideoJobPipeline({
    store: createSqliteJobStore({ dataDirectory, databasePath }),
    logger,
    metrics,
    generateLesson: lessonGenerator,
    generateVideo: generateVideo ?? createVideoGenerator({ outputDirectory: generatedDirectory }),
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
  app.use(
    "/generated",
    express.static(generatedDirectory, {
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
      storage: "sqlite-local-files",
      templates: getTemplateSummaries().map((template) => template.id),
    });
  });

  app.get("/ready", async (req, res, next) => {
    try {
      await videoJobPipeline.isReady();
      res.json({
        status: "ready",
        storage: {
          dataDirectory,
          databasePath,
          generatedDirectory,
          logDirectory,
        },
      });
    } catch (error) {
      next(error);
    }
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

  app.post("/api/v1/video-jobs", async (req, res, next) => {
    try {
      const job = await videoJobPipeline.createJob(req.body);
      res.status(202).json({
        job_id: job.job_id,
        project_id: job.project_id,
        status: job.status,
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/v1/video-jobs/:jobId", async (req, res, next) => {
    try {
      const job = await videoJobPipeline.getJob(req.params.jobId);
      if (!job) {
        res.status(404).json({
          error: {
            code: "JOB_NOT_FOUND",
            message: "Video job was not found.",
          },
        });
        return;
      }
      res.json(job);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/v1/video-jobs/:jobId/events", async (req, res, next) => {
    try {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const sendSnapshot = async () => {
        const job = await videoJobPipeline.getJob(req.params.jobId);
        if (!job) {
          res.write(`event: error\ndata: ${JSON.stringify({ code: "JOB_NOT_FOUND" })}\n\n`);
          res.end();
          return true;
        }
        res.write(`event: job\ndata: ${JSON.stringify({
          job_id: job.job_id,
          status: job.status,
          current_stage: job.current_stage,
          progress: job.progress,
          message: job.message,
        })}\n\n`);
        if (job.status === "COMPLETED" || job.status.startsWith("FAILED_")) {
          res.end();
          return true;
        }
        return false;
      };

      if (await sendSnapshot()) return;
      const interval = setInterval(async () => {
        if (await sendSnapshot()) {
          clearInterval(interval);
        }
      }, 500);
      req.on("close", () => clearInterval(interval));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/v1/projects/:projectId", async (req, res, next) => {
    try {
      const project = await videoJobPipeline.getProject(req.params.projectId);
      if (!project) {
        res.status(404).json({
          error: {
            code: "PROJECT_NOT_FOUND",
            message: "Project was not found.",
          },
        });
        return;
      }
      res.json(project);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/v1/metrics", async (req, res, next) => {
    try {
      res.json({
        ...metrics.snapshot(),
        storage: await videoJobPipeline.getStorageCounts(),
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/metrics", (req, res) => {
    res.type("text/plain").send(metrics.prometheus());
  });

  if (fs.existsSync(path.join(frontendDirectory, "index.html"))) {
    app.use(express.static(frontendDirectory));
    app.use((req, res, next) => {
      if (
        req.method !== "GET" ||
        req.path.startsWith("/api/") ||
        req.path.startsWith("/videos/") ||
        req.path.startsWith("/generated/")
      ) {
        next();
        return;
      }

      res.sendFile(path.join(frontendDirectory, "index.html"));
    });
  }

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
