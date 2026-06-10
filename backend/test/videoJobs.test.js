import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import request from "supertest";
import { describe, expect, test, vi } from "vitest";
import { createApp } from "../src/app.js";

async function waitForJob(app, jobId) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const response = await request(app).get(`/api/v1/video-jobs/${jobId}`).expect(200);
    if (["COMPLETED", "FAILED_PLANNING", "FAILED_RENDER", "FAILED_INPUT_UNSAFE"].includes(response.body.status)) {
      return response.body;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }

  throw new Error(`Timed out waiting for job ${jobId}`);
}

describe("Video job API", () => {
  test("creates a local async video job with persisted artifacts, logs, and metrics", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "visualexplain-"));
    const dataDirectory = path.join(root, "data");
    const databasePath = path.join(dataDirectory, "visualexplain.sqlite");
    const generatedDirectory = path.join(root, "generated");
    const logDirectory = path.join(root, "logs");
    const generateLesson = vi.fn(async () => ({
      opening: "A coordinate plane is a map made from two perpendicular number lines.",
      steps: [
        { atSeconds: 0, text: "Draw the horizontal x-axis." },
        { atSeconds: 2, text: "Draw the vertical y-axis." },
        { atSeconds: 4, text: "Mark a point as an ordered pair." },
      ],
      followUpQuestion: "What does the first number in (2, 3) mean?",
    }));
    const generateVideo = vi.fn(async ({ requestId, template }) => {
      const fileName = `${requestId}.mp4`;
      await fs.mkdir(generatedDirectory, { recursive: true });
      await fs.writeFile(path.join(generatedDirectory, fileName), Buffer.from("fake mp4"));
      return {
        templateId: template.id,
        url: `/generated/${fileName}`,
        mimeType: "video/mp4",
        durationSeconds: 10,
        generated: true,
      };
    });
    const app = createApp({
      dataDirectory,
      databasePath,
      generatedDirectory,
      logDirectory,
      generateLesson,
      generateVideo,
      hasOpenAIKey: () => true,
    });

    const createResponse = await request(app)
      .post("/api/v1/video-jobs")
      .send({
        concept: "Giải thích hệ toạ độ Decartes",
        domain: "auto",
        level: "beginner",
        duration_sec: 60,
        language: "vi",
        voiceover: false,
        style: "visual_proof",
      })
      .expect(202);

    expect(createResponse.body).toMatchObject({
      status: "PENDING",
    });
    expect(createResponse.body.job_id).toEqual(expect.any(String));
    expect(createResponse.body.project_id).toEqual(expect.any(String));

    const completedJob = await waitForJob(app, createResponse.body.job_id);

    expect(completedJob).toMatchObject({
      status: "COMPLETED",
      current_stage: "COMPLETED",
      progress: 100,
    });
    expect(completedJob.config).toMatchObject({
      normalized_concept: "Giải thích hệ toạ độ Decartes",
      duration_sec: 10,
      level: "beginner",
      style: "visual_proof",
    });
    expect(completedJob.pipeline_steps.map((step) => step.stage)).toEqual(
      expect.arrayContaining([
        "VALIDATING_INPUT",
        "CONCEPT_ANALYSIS",
        "KNOWLEDGE_PLAN",
        "VISUAL_PLAN",
        "STORYBOARD",
        "SCENE_DSL",
        "RENDERING",
        "RENDER_QA",
        "POSTPROCESSING",
      ]),
    );
    expect(completedJob.artifacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ artifact_type: "knowledge_plan_json" }),
        expect.objectContaining({ artifact_type: "storyboard_json" }),
        expect.objectContaining({ artifact_type: "scene_dsl_json" }),
        expect.objectContaining({ artifact_type: "video_mp4" }),
      ]),
    );
    expect(generateLesson).toHaveBeenCalledOnce();
    expect(generateVideo).toHaveBeenCalledOnce();

    const projectResponse = await request(app)
      .get(`/api/v1/projects/${createResponse.body.project_id}`)
      .expect(200);

    expect(projectResponse.body).toMatchObject({
      project_id: createResponse.body.project_id,
      latest_job_id: createResponse.body.job_id,
      status: "COMPLETED",
    });
    expect(projectResponse.body.storyboard.scenes.length).toBeGreaterThan(0);
    expect(projectResponse.body.scene_dsl.scenes.length).toBeGreaterThan(0);
    expect(projectResponse.body.artifacts).toEqual(
      expect.arrayContaining([expect.objectContaining({ artifact_type: "video_mp4" })]),
    );

    const metricsResponse = await request(app).get("/api/v1/metrics").expect(200);
    expect(metricsResponse.body.counters.video_jobs_created).toBe(1);
    expect(metricsResponse.body.counters.video_jobs_completed).toBe(1);
    expect(metricsResponse.body.stageDurationsMs.RENDERING.count).toBe(1);
    expect(metricsResponse.body.storage).toMatchObject({
      projects: 1,
      video_jobs: 1,
    });
    expect(metricsResponse.body.storage.artifacts).toBeGreaterThanOrEqual(3);

    const logText = await fs.readFile(path.join(logDirectory, "app.jsonl"), "utf8");
    expect(logText).toContain(createResponse.body.job_id);
    expect(logText).toContain("stage_completed");

    await request(app)
      .get(completedJob.artifacts.find((artifact) => artifact.artifact_type === "video_mp4").url)
      .expect(200);

    const db = new DatabaseSync(databasePath, { readOnly: true });
    expect(db.prepare("SELECT COUNT(*) AS count FROM video_jobs").get().count).toBe(1);
    expect(db.prepare("SELECT COUNT(*) AS count FROM projects").get().count).toBe(1);
    expect(db.prepare("SELECT COUNT(*) AS count FROM artifacts").get().count).toBeGreaterThanOrEqual(3);
    expect(db.prepare("SELECT COUNT(*) AS count FROM pipeline_steps").get().count).toBeGreaterThanOrEqual(8);
    db.close();

    const restartedApp = createApp({
      dataDirectory,
      databasePath,
      generatedDirectory,
      logDirectory,
      hasOpenAIKey: () => false,
    });
    const persistedJob = await request(restartedApp)
      .get(`/api/v1/video-jobs/${createResponse.body.job_id}`)
      .expect(200);
    expect(persistedJob.body.status).toBe("COMPLETED");
  });

  test("rejects overly broad local generation requests", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "visualexplain-"));
    const app = createApp({
      dataDirectory: path.join(root, "data"),
      databasePath: path.join(root, "data", "visualexplain.sqlite"),
      generatedDirectory: path.join(root, "generated"),
      logDirectory: path.join(root, "logs"),
      hasOpenAIKey: () => false,
    });

    const response = await request(app)
      .post("/api/v1/video-jobs")
      .send({ concept: "math", duration_sec: 10 })
      .expect(400);

    expect(response.body.error.code).toBe("INPUT_TOO_BROAD");
  });

  test("fails planning without OpenAI instead of rendering from a fallback template", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "visualexplain-"));
    const dataDirectory = path.join(root, "data");
    const databasePath = path.join(dataDirectory, "visualexplain.sqlite");
    const logDirectory = path.join(root, "logs");
    const generateVideo = vi.fn(async () => ({
      url: "/generated/should-not-exist.mp4",
      mimeType: "video/mp4",
      durationSeconds: 10,
      generated: true,
    }));
    const app = createApp({
      dataDirectory,
      databasePath,
      generatedDirectory: path.join(root, "generated"),
      logDirectory,
      generateVideo,
      hasOpenAIKey: () => false,
    });

    const createResponse = await request(app)
      .post("/api/v1/video-jobs")
      .send({
        concept: "Giải thích hệ toạ độ Decartes",
        language: "vi",
      })
      .expect(202);

    const failedJob = await waitForJob(app, createResponse.body.job_id);

    expect(failedJob).toMatchObject({
      status: "FAILED_PLANNING",
      current_stage: "CONCEPT_ANALYSIS",
      error_code: "OPENAI_NOT_CONFIGURED",
    });
    expect(generateVideo).not.toHaveBeenCalled();
    expect(failedJob.artifacts).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ artifact_type: "video_mp4" })]),
    );

    const projectResponse = await request(app)
      .get(`/api/v1/projects/${createResponse.body.project_id}`)
      .expect(200);
    expect(projectResponse.body).toMatchObject({
      status: "FAILED_PLANNING",
      error_code: "OPENAI_NOT_CONFIGURED",
    });

    const metricsResponse = await request(app).get("/api/v1/metrics").expect(200);
    expect(metricsResponse.body.counters.video_jobs_failed).toBe(1);
    expect(metricsResponse.body.counters.video_jobs_completed).toBe(0);

    const logText = await fs.readFile(path.join(logDirectory, "app.jsonl"), "utf8");
    expect(logText).toContain("stage_failed");
    expect(logText).toContain("OPENAI_NOT_CONFIGURED");

    const db = new DatabaseSync(databasePath, { readOnly: true });
    expect(
      db
        .prepare("SELECT COUNT(*) AS count FROM artifacts WHERE artifact_type = ?")
        .get("video_mp4").count,
    ).toBe(0);
    expect(
      db
        .prepare("SELECT COUNT(*) AS count FROM pipeline_steps WHERE stage = ? AND status = ?")
        .get("CONCEPT_ANALYSIS", "failed").count,
    ).toBe(1);
    db.close();
  });
});
