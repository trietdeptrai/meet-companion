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

function createIntegralPlannerOutput() {
  return {
    opening: "Tích phân có thể hiểu như cách cộng rất nhiều mảnh diện tích nhỏ dưới một đường cong.",
    steps: [
      { atSeconds: 0, text: "Vẽ trục tọa độ và một đường cong." },
      { atSeconds: 2, text: "Chia vùng dưới đường cong thành các hình chữ nhật mỏng." },
      { atSeconds: 5, text: "Khi các hình chữ nhật mỏng dần, tổng diện tích tiến gần tích phân." },
    ],
    followUpQuestion: "Nếu chia khoảng thành nhiều hình chữ nhật hơn, ước lượng sẽ thay đổi thế nào?",
    conceptAnalysis: {
      concept_id: "integral_area",
      domain: "math",
      subdomain: "calculus",
      prerequisites: ["area", "function graph"],
      key_claims: ["An integral accumulates small quantities.", "Area under a curve can approximate accumulation."],
      common_misconceptions: ["Thinking integral is only a formula."],
      best_explanation_modes: ["accumulation_rectangles"],
    },
    visualPlan: {
      selected_pattern_id: "accumulation_rectangles",
      visual_core: "A curve sits above the x-axis while rectangles accumulate under it.",
      visual_rules: ["Show axes first.", "Make rectangles visibly approximate the curved region."],
      color_logic: {
        primary: "cyan",
        secondary: "yellow",
        highlight: "green",
      },
    },
    storyboard: {
      total_duration_sec: 10,
      scenes: [
        {
          scene_id: "s1_axes_curve",
          duration_sec: 3,
          learning_goal: "Introduce the function graph.",
          visual_goal: "Show axes and a curve.",
          objects: ["x_axis", "y_axis", "curve"],
          animations: ["fade_in"],
          camera: "static_center",
          labels: ["f(x)"],
        },
        {
          scene_id: "s2_rectangles",
          duration_sec: 4,
          learning_goal: "Approximate area with rectangles.",
          visual_goal: "Show rectangles under the curve.",
          objects: ["rect_1", "rect_2", "rect_3", "rect_4"],
          animations: ["grow"],
          camera: "static_center",
          labels: ["sum"],
        },
        {
          scene_id: "s3_takeaway",
          duration_sec: 3,
          learning_goal: "Connect accumulation to integral notation.",
          visual_goal: "Show final integral label.",
          objects: ["area", "formula"],
          animations: ["highlight", "write_label"],
          camera: "static_center",
          labels: ["integral"],
        },
      ],
    },
    sceneDsl: {
      canvas: {
        background: "dark",
        resolution: "1280x720",
        style: "3Blue1Brown-like dark canvas with accumulation rectangles",
      },
      scenes: [
        {
          scene_id: "s1_axes_curve",
          objects: [
            { id: "x_axis", type: "axis", params: { orientation: "horizontal", y: 0.76 }, style: { stroke: "muted" } },
            { id: "y_axis", type: "axis", params: { orientation: "vertical", x: 0.18 }, style: { stroke: "muted" } },
            {
              id: "curve",
              type: "curve",
              params: {
                points: [
                  { x: 0.18, y: 0.68 },
                  { x: 0.34, y: 0.5 },
                  { x: 0.55, y: 0.34 },
                  { x: 0.78, y: 0.26 },
                ],
              },
              style: { stroke: "cyan" },
            },
          ],
          animations: [{ type: "fade_in", target: "curve", duration: 1 }],
          camera: [{ type: "static_center", duration: 1 }],
        },
        {
          scene_id: "s2_rectangles",
          objects: [
            { id: "x_axis", type: "axis", params: { orientation: "horizontal", y: 0.76 }, style: { stroke: "muted" } },
            { id: "curve", type: "curve", params: { points: [{ x: 0.18, y: 0.68 }, { x: 0.34, y: 0.5 }, { x: 0.55, y: 0.34 }, { x: 0.78, y: 0.26 }] }, style: { stroke: "cyan" } },
            { id: "rect_1", type: "rectangle", params: { x: 0.24, y: 0.6, width: 0.08, height: 0.16 }, style: { fill: "green", stroke: "green", opacity: 0.28 } },
            { id: "rect_2", type: "rectangle", params: { x: 0.34, y: 0.52, width: 0.08, height: 0.24 }, style: { fill: "green", stroke: "green", opacity: 0.28 } },
            { id: "rect_3", type: "rectangle", params: { x: 0.44, y: 0.44, width: 0.08, height: 0.32 }, style: { fill: "green", stroke: "green", opacity: 0.28 } },
            { id: "rect_4", type: "rectangle", params: { x: 0.54, y: 0.38, width: 0.08, height: 0.38 }, style: { fill: "green", stroke: "green", opacity: 0.28 } },
          ],
          animations: [{ type: "grow", target: "rect_1", duration: 1 }],
          camera: [{ type: "static_center", duration: 1 }],
        },
        {
          scene_id: "s3_takeaway",
          objects: [
            { id: "area", type: "region", params: { x: 0.24, y: 0.38, width: 0.42, height: 0.38 }, style: { fill: "green", stroke: "green", opacity: 0.18 } },
            { id: "formula", type: "formula", params: { x: 0.64, y: 0.2, text: "∫ f(x) dx" }, style: { stroke: "white" } },
            { id: "dot", type: "dot", params: { x: 0.64, y: 0.76 }, style: { fill: "yellow" } },
          ],
          animations: [{ type: "write_label", target: "formula", duration: 1 }],
          camera: [{ type: "static_center", duration: 1 }],
        },
      ],
    },
  };
}

describe("Video job API", () => {
  test("creates a local async video job with persisted artifacts, logs, and metrics", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "visualexplain-"));
    const dataDirectory = path.join(root, "data");
    const databasePath = path.join(dataDirectory, "visualexplain.sqlite");
    const generatedDirectory = path.join(root, "generated");
    const logDirectory = path.join(root, "logs");
    const generateLesson = vi.fn(async () => createIntegralPlannerOutput());
    const generateVideo = vi.fn(async ({ requestId, requestContext, sceneDsl, visualPlan }) => {
      const fileName = `${requestId}.mp4`;
      await fs.mkdir(generatedDirectory, { recursive: true });
      await fs.writeFile(path.join(generatedDirectory, fileName), Buffer.from("fake mp4"));
      return {
        conceptId: requestContext.id,
        renderer: "scene-dsl-ffmpeg",
        patternId: visualPlan.selected_pattern_id,
        url: `/generated/${fileName}`,
        mimeType: "video/mp4",
        durationSeconds: 10,
        generated: true,
        sceneCount: sceneDsl.scenes.length,
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
        concept: "Giải thích tích phân là diện tích dưới đường cong",
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
      normalized_concept: "Giải thích tích phân là diện tích dưới đường cong",
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
    expect(generateLesson.mock.calls[0][0]).toMatchObject({
      prompt: "Giải thích tích phân là diện tích dưới đường cong",
      requestContext: {
        title: "tích phân là diện tích dưới đường cong",
        duration_sec: 10,
      },
    });
    expect(generateLesson.mock.calls[0][0]).not.toHaveProperty("template");
    expect(generateVideo).toHaveBeenCalledOnce();
    expect(generateVideo.mock.calls[0][0]).not.toHaveProperty("template");
    expect(generateVideo.mock.calls[0][0].sceneDsl.scenes[1].objects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "rectangle" }),
        expect.objectContaining({ type: "curve" }),
      ]),
    );

    const projectResponse = await request(app)
      .get(`/api/v1/projects/${createResponse.body.project_id}`)
      .expect(200);

    expect(projectResponse.body).toMatchObject({
      project_id: createResponse.body.project_id,
      latest_job_id: createResponse.body.job_id,
      status: "COMPLETED",
    });
    expect(projectResponse.body.storyboard.scenes[0].visual_goal).toContain("curve");
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
        concept: "Giải thích đạo hàm như độ dốc tức thời",
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
