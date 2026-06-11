import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import request from "supertest";
import { describe, expect, test, vi } from "vitest";
import { createApp } from "../src/app.js";

const terminalStatuses = new Set([
  "COMPLETED",
  "FAILED_INPUT_UNSAFE",
  "FAILED_PLANNING",
  "FAILED_RENDER",
  "FAILED_POSTPROCESS",
]);

async function waitForJob(app, jobId) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const response = await request(app).get(`/api/v2/video-jobs/${jobId}`).expect(200);
    if (terminalStatuses.has(response.body.status)) {
      return response.body;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }

  throw new Error(`Timed out waiting for job ${jobId}`);
}

function createGradientDescentPlannerOutput() {
  return {
    opening:
      "Gradient descent giống như đi xuống một thung lũng: mỗi bước nhìn độ dốc rồi bước về phía thấp hơn.",
    steps: [
      { atSeconds: 0, text: "Trước hết ta nhìn một bề mặt lỗi có điểm cao và điểm thấp." },
      { atSeconds: 2.5, text: "Ở mỗi vị trí, mũi tên gradient chỉ hướng dốc tăng nhanh nhất." },
      { atSeconds: 5, text: "Ta đi ngược hướng đó bằng những bước nhỏ để giảm lỗi." },
      { atSeconds: 7.5, text: "Các bước lặp lại cho tới khi gần đáy thung lũng." },
    ],
    followUpQuestion: "Nếu bước học quá lớn thì đường đi xuống đáy có thể gặp vấn đề gì?",
    conceptUnderstanding: {
      concept_id: "gradient_descent_valley",
      domain: "math",
      subdomain: "optimization",
      learning_objective: "Understand gradient descent as repeated movement against slope to reduce a loss.",
      prerequisites: ["slope", "function graph"],
      key_ideas: [
        "A loss function assigns height to each possible parameter value.",
        "The gradient points uphill.",
        "Gradient descent moves opposite the gradient in small steps.",
      ],
      misconceptions: ["The gradient itself is the direction we should move.", "One step always reaches the minimum."],
      visual_affordances: ["loss landscape", "arrows", "moving point", "final formula"],
    },
    knowledgeDecomposition: {
      atoms: [
        {
          id: "loss_landscape",
          idea: "Show loss as a valley-shaped curve.",
          visual_need: "Plot a smooth curve with a highlighted starting point.",
        },
        {
          id: "gradient_arrow",
          idea: "Gradient points uphill at the current point.",
          visual_need: "Draw a local tangent arrow.",
        },
        {
          id: "opposite_step",
          idea: "Move opposite that arrow to lower loss.",
          visual_need: "Animate a dot stepping downhill.",
        },
        {
          id: "update_rule",
          idea: "Connect repeated steps to the update rule.",
          visual_need: "Reveal a compact formula after the motion.",
        },
      ],
    },
    creativeTreatments: {
      concept: "gradient descent as going down a valley",
      treatments: [
        {
          treatment_id: "valley_walk",
          title: "Walking Down The Loss Valley",
          one_liner: "A point walks down a glowing valley by stepping opposite the uphill arrow.",
          visual_hook: "A dot starts high on a curve and follows small downhill arrows toward the minimum.",
          components: ["HookTitle", "GraphPlot", "MovingPoint", "FormulaReveal"],
          estimated_quality: 0.93,
          estimated_feasibility: 0.91,
          style_notes: ["low text", "cyan curve", "yellow moving point"],
        },
        {
          treatment_id: "contour_map",
          title: "Contour Map Descent",
          one_liner: "A dot crosses contour rings toward the center.",
          visual_hook: "Nested rings make every downhill step feel spatial.",
          components: ["HookTitle", "ProbabilityTiles", "MovingPoint", "VisualRecap"],
          estimated_quality: 0.82,
          estimated_feasibility: 0.78,
          style_notes: ["map-like", "more abstract"],
        },
        {
          treatment_id: "slope_meter",
          title: "Slope Meter",
          one_liner: "A meter shows steepness shrinking as the learner approaches the bottom.",
          visual_hook: "The slope meter calms down near the minimum.",
          components: ["HookTitle", "GraphPlot", "TangentReveal", "VisualRecap"],
          estimated_quality: 0.79,
          estimated_feasibility: 0.84,
          style_notes: ["decorative gauge", "secondary explanation"],
        },
      ],
    },
    treatmentRanking: {
      selected_treatment_id: "valley_walk",
      reason: "It has the clearest visual analogy and uses available graph/motion components.",
      rejected_treatments: [
        { id: "contour_map", reason: "More abstract for beginners." },
        { id: "slope_meter", reason: "The gauge adds cognitive load." },
      ],
      scores: [
        {
          treatment_id: "valley_walk",
          concept_accuracy_score: 0.95,
          visual_clarity_score: 0.94,
          component_availability_score: 0.9,
          animation_beauty_score: 0.88,
          pacing_score: 0.86,
          feasibility_score: 0.91,
          complexity_penalty: 0.08,
          cognitive_load_penalty: 0.07,
          final_score: 0.91,
        },
      ],
    },
    creativeBrief: {
      tone: "curious, clean, precise",
      visual_style: "clean_dark_explainer",
      density: "low_text_high_visual",
      camera_style: "gentle push-in with static recap",
      color_strategy: {
        background: "deep navy",
        primary_math: "soft cyan",
        secondary_highlight: "warm yellow",
        inactive_objects: "muted gray",
      },
      motion_rules: [
        "One main motion per shot.",
        "Show the visual intuition before the formula.",
        "Use color consistently for point, slope, and minimum.",
      ],
    },
    storyboard: {
      title: "Gradient Descent As A Valley Walk",
      duration_sec: 24,
      shots: [
        {
          shot_id: "sh01_hook",
          duration_sec: 5,
          visual_goal: "Introduce the loss valley.",
          main_component: "HookTitle",
          camera: "slow_push_in",
          text_policy: "title_only",
          narration: "Imagine the error as a valley.",
          formula: "",
        },
        {
          shot_id: "sh02_landscape",
          duration_sec: 7,
          visual_goal: "Show a starting point on the loss curve.",
          main_component: "GraphPlot",
          camera: "static_center",
          text_policy: "minimal_label",
          narration: "We start high on the loss curve.",
          formula: "",
        },
        {
          shot_id: "sh03_steps",
          duration_sec: 7,
          visual_goal: "Show a point stepping downhill against the slope.",
          main_component: "MovingPoint",
          camera: "center_on_point",
          text_policy: "no_text",
          narration: "Each step moves opposite the uphill gradient.",
          formula: "",
        },
        {
          shot_id: "sh04_formula",
          duration_sec: 5,
          visual_goal: "Reveal the update rule after the motion.",
          main_component: "FormulaReveal",
          camera: "wide_summary",
          text_policy: "final_formula",
          narration: "That repeated rule is the update step.",
          formula: "theta <- theta - alpha * grad L(theta)",
        },
      ],
    },
    componentGraph: {
      graph_id: "gradient_descent_component_graph",
      nodes: [
        {
          id: "n1",
          shot_id: "sh01_hook",
          component: "HookTitle",
          props: { title: "Gradient descent", subtitle: "walk downhill on loss" },
          style: { theme: "clean_dark_explainer", highlight_color_token: "primary" },
          narration: "Imagine the error as a valley.",
        },
        {
          id: "n2",
          shot_id: "sh02_landscape",
          component: "GraphPlot",
          props: { function: "convex loss curve", caption: "loss landscape" },
          style: { theme: "clean_dark_explainer", highlight_color_token: "primary" },
          narration: "We start high on the loss curve.",
        },
        {
          id: "n3",
          shot_id: "sh03_steps",
          component: "MovingPoint",
          props: { path: "downhill steps", direction: "opposite gradient", caption: "step against the slope" },
          style: { theme: "clean_dark_explainer", highlight_color_token: "secondary" },
          narration: "Each step moves opposite the uphill gradient.",
        },
        {
          id: "n4",
          shot_id: "sh04_formula",
          component: "FormulaReveal",
          props: { formula: "theta <- theta - alpha * grad L(theta)", reveal_style: "after_visual" },
          style: { theme: "clean_dark_explainer", highlight_color_token: "primary" },
          narration: "That repeated rule is the update step.",
        },
      ],
      edges: [
        { from: "n1", to: "n2", relation: "sets_context" },
        { from: "n2", to: "n3", relation: "reveals_motion" },
        { from: "n3", to: "n4", relation: "abstracts_to_formula" },
      ],
    },
  };
}

describe("Video job API", () => {
  test("runs the v2 local quality pipeline with treatments, component graph, preview QA, final render, logs, and metrics", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "visualexplain-"));
    const dataDirectory = path.join(root, "data");
    const databasePath = path.join(dataDirectory, "visualexplain.sqlite");
    const generatedDirectory = path.join(root, "generated");
    const logDirectory = path.join(root, "logs");
    const generateLesson = vi.fn(async () => createGradientDescentPlannerOutput());
    const generateVideo = vi.fn(async ({ requestId, requestContext, componentGraph, timeline, renderPass }) => {
      const fileName = `${requestId}.mp4`;
      await fs.mkdir(generatedDirectory, { recursive: true });
      await fs.writeFile(path.join(generatedDirectory, fileName), Buffer.from("fake mp4"));
      return {
        conceptId: requestContext.id,
        renderer: "component-graph-ffmpeg",
        renderPass,
        url: `/generated/${fileName}`,
        mimeType: "video/mp4",
        durationSeconds: timeline.duration_sec,
        generated: true,
        componentCount: componentGraph.nodes.length,
        timelineShotCount: timeline.shots.length,
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
      .post("/api/v2/video-jobs")
      .send({
        concept: "Giải thích gradient descent như đi xuống thung lũng",
        domain: "auto",
        level: "beginner",
        duration_sec: 24,
        language: "vi",
        voiceover: false,
        style_preset: "clean_dark_explainer",
        quality_mode: "best",
      })
      .expect(202);

    expect(createResponse.body).toMatchObject({
      status: "PENDING",
      quality_mode: "best",
    });
    expect(createResponse.body.job_id).toEqual(expect.any(String));
    expect(createResponse.body.project_id).toEqual(expect.any(String));

    const completedJob = await waitForJob(app, createResponse.body.job_id);

    expect(completedJob).toMatchObject({
      status: "COMPLETED",
      current_stage: "COMPLETED",
      progress: 100,
      quality_mode: "best",
    });
    expect(completedJob.config).toMatchObject({
      normalized_concept: "Giải thích gradient descent như đi xuống thung lũng",
      duration_sec: 24,
      level: "beginner",
      language: "en",
      input_language: "vi",
      style_preset: "clean_dark_explainer",
      quality_mode: "best",
    });
    expect(completedJob.pipeline_steps.map((step) => step.stage)).toEqual([
      "INPUT_INTAKE",
      "CONCEPT_UNDERSTANDING",
      "KNOWLEDGE_DECOMPOSITION",
      "TREATMENT_CANDIDATES",
      "TREATMENT_RANKING",
      "CREATIVE_BRIEF",
      "STORYBOARD_SHOTLIST",
      "MOTION_COMPONENT_GRAPH",
      "TIMELINE_COMPILER",
      "RENDERER_ALLOCATION",
      "STATIC_PREFLIGHT",
      "PREVIEW_RENDER",
      "FRAME_SAMPLING_QA",
      "REPAIR_POLISH",
      "FINAL_RENDER",
      "POSTPROCESSING",
      "DELIVERY_SAVE",
    ]);
    expect(completedJob.artifacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ artifact_type: "concept_understanding_json" }),
        expect.objectContaining({ artifact_type: "knowledge_decomposition_json" }),
        expect.objectContaining({ artifact_type: "creative_treatments_json" }),
        expect.objectContaining({ artifact_type: "treatment_ranking_json" }),
        expect.objectContaining({ artifact_type: "creative_brief_json" }),
        expect.objectContaining({ artifact_type: "storyboard_shotlist_json" }),
        expect.objectContaining({ artifact_type: "component_graph_json" }),
        expect.objectContaining({ artifact_type: "timeline_json" }),
        expect.objectContaining({ artifact_type: "renderer_allocation_json" }),
        expect.objectContaining({ artifact_type: "preflight_json" }),
        expect.objectContaining({ artifact_type: "preview_video_mp4" }),
        expect.objectContaining({ artifact_type: "qa_report_json" }),
        expect.objectContaining({ artifact_type: "repair_polish_json" }),
        expect.objectContaining({ artifact_type: "video_mp4" }),
        expect.objectContaining({ artifact_type: "postprocess_json" }),
        expect.objectContaining({ artifact_type: "delivery_project_json" }),
      ]),
    );
    expect(generateLesson).toHaveBeenCalledOnce();
    expect(generateLesson.mock.calls[0][0]).toMatchObject({
      prompt: "Giải thích gradient descent như đi xuống thung lũng",
      requestContext: {
        title: "gradient descent như đi xuống thung lũng",
        duration_sec: 24,
        language: "en",
      },
      qualityMode: "best",
    });
    expect(generateLesson.mock.calls[0][0]).not.toHaveProperty("template");
    expect(generateVideo).toHaveBeenCalledTimes(2);
    expect(generateVideo.mock.calls[0][0]).toMatchObject({ renderPass: "preview" });
    expect(generateVideo.mock.calls[1][0]).toMatchObject({ renderPass: "final" });
    expect(generateVideo.mock.calls[1][0]).not.toHaveProperty("template");
    expect(generateVideo.mock.calls[1][0]).not.toHaveProperty("sceneDsl");
    expect(generateVideo.mock.calls[1][0].componentGraph.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ component: "GraphPlot" }),
        expect.objectContaining({ component: "MovingPoint" }),
        expect.objectContaining({ component: "FormulaReveal" }),
      ]),
    );
    expect(generateVideo.mock.calls[1][0].timeline.duration_sec).toBe(24);
    expect(generateVideo.mock.calls[1][0].timeline.shots).toHaveLength(4);
    expect(generateVideo.mock.calls[1][0].timeline.shots.at(-1)).toMatchObject({
      component: "FormulaReveal",
    });
    expect(completedJob.video.url).toMatch(/-final\.mp4$/);
    expect(completedJob.qa_reports[0]).toMatchObject({
      qa_type: "visual",
      passed: true,
    });

    const projectResponse = await request(app)
      .get(`/api/v2/projects/${createResponse.body.project_id}`)
      .expect(200);

    expect(projectResponse.body).toMatchObject({
      project_id: createResponse.body.project_id,
      latest_job_id: createResponse.body.job_id,
      status: "COMPLETED",
      component_graph: {
        nodes: expect.arrayContaining([expect.objectContaining({ component: "GraphPlot" })]),
      },
      timeline: {
        duration_sec: 24,
      },
      logs_url: `/api/v2/video-jobs/${createResponse.body.job_id}`,
    });
    expect(projectResponse.body.storyboard.shots[0].main_component).toBe("HookTitle");
    expect(projectResponse.body.qa_reports[0].sampled_frames).toHaveLength(8);
    expect(projectResponse.body.render_passes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ pass_type: "preview", status: "completed" }),
        expect.objectContaining({ pass_type: "final", status: "completed" }),
      ]),
    );

    const graphResponse = await request(app)
      .get(`/api/v2/projects/${createResponse.body.project_id}/component-graph`)
      .expect(200);
    expect(graphResponse.body.nodes).toEqual(
      expect.arrayContaining([expect.objectContaining({ component: "FormulaReveal" })]),
    );

    const metricsResponse = await request(app).get("/api/v2/metrics").expect(200);
    expect(metricsResponse.body.counters.video_jobs_created).toBe(1);
    expect(metricsResponse.body.counters.video_jobs_completed).toBe(1);
    expect(metricsResponse.body.stageDurationsMs.FINAL_RENDER.count).toBe(1);
    expect(metricsResponse.body.storage).toMatchObject({
      projects: 1,
      video_jobs: 1,
      creative_treatments: 3,
      component_graphs: 1,
      timelines: 1,
      qa_reports: 1,
      render_passes: 2,
    });

    const logText = await fs.readFile(path.join(logDirectory, "app.jsonl"), "utf8");
    expect(logText).toContain(createResponse.body.job_id);
    expect(logText).toContain("FRAME_SAMPLING_QA");

    await request(app)
      .get(completedJob.artifacts.find((artifact) => artifact.artifact_type === "video_mp4").url)
      .expect(200);

    const db = new DatabaseSync(databasePath, { readOnly: true });
    expect(db.prepare("SELECT COUNT(*) AS count FROM video_jobs").get().count).toBe(1);
    expect(db.prepare("SELECT COUNT(*) AS count FROM projects").get().count).toBe(1);
    expect(db.prepare("SELECT COUNT(*) AS count FROM creative_treatments").get().count).toBe(3);
    expect(db.prepare("SELECT COUNT(*) AS count FROM component_graphs").get().count).toBe(1);
    expect(db.prepare("SELECT COUNT(*) AS count FROM timelines").get().count).toBe(1);
    expect(db.prepare("SELECT COUNT(*) AS count FROM qa_reports").get().count).toBe(1);
    expect(db.prepare("SELECT COUNT(*) AS count FROM render_passes").get().count).toBe(2);
    expect(db.prepare("SELECT COUNT(*) AS count FROM motion_components").get().count).toBeGreaterThan(5);
    db.close();

    const restartedApp = createApp({
      dataDirectory,
      databasePath,
      generatedDirectory,
      logDirectory,
      hasOpenAIKey: () => false,
    });
    const persistedJob = await request(restartedApp)
      .get(`/api/v2/video-jobs/${createResponse.body.job_id}`)
      .expect(200);
    expect(persistedJob.body.status).toBe("COMPLETED");
  });

  test("keeps v1 video jobs on the v2 quality pipeline for backward compatibility", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "visualexplain-"));
    const generatedDirectory = path.join(root, "generated");
    const app = createApp({
      dataDirectory: path.join(root, "data"),
      databasePath: path.join(root, "data", "visualexplain.sqlite"),
      generatedDirectory,
      logDirectory: path.join(root, "logs"),
      generateLesson: vi.fn(async () => createGradientDescentPlannerOutput()),
      generateVideo: vi.fn(async ({ requestId }) => {
        await fs.mkdir(generatedDirectory, { recursive: true });
        await fs.writeFile(path.join(generatedDirectory, `${requestId}.mp4`), Buffer.from("fake mp4"));
        return {
          url: `/generated/${requestId}.mp4`,
          mimeType: "video/mp4",
          durationSeconds: 10,
          generated: true,
        };
      }),
      hasOpenAIKey: () => true,
    });

    const createResponse = await request(app)
      .post("/api/v1/video-jobs")
      .send({ concept: "Giải thích gradient descent như đi xuống thung lũng", language: "vi" })
      .expect(202);

    const completedJob = await waitForJob(app, createResponse.body.job_id);
    expect(completedJob.pipeline_steps.map((step) => step.stage)).toContain("MOTION_COMPONENT_GRAPH");
    expect(completedJob.artifacts).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ artifact_type: "scene_dsl_json" })]),
    );
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
      .post("/api/v2/video-jobs")
      .send({ concept: "math", duration_sec: 10 })
      .expect(400);

    expect(response.body.error.code).toBe("INPUT_TOO_BROAD");
  });

  test("fails planning without OpenAI instead of rendering from a fallback component", async () => {
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
      .post("/api/v2/video-jobs")
      .send({
        concept: "Giải thích gradient descent như đi xuống thung lũng",
        language: "vi",
      })
      .expect(202);

    const failedJob = await waitForJob(app, createResponse.body.job_id);

    expect(failedJob).toMatchObject({
      status: "FAILED_PLANNING",
      current_stage: "CONCEPT_UNDERSTANDING",
      error_code: "OPENAI_NOT_CONFIGURED",
    });
    expect(generateVideo).not.toHaveBeenCalled();
    expect(failedJob.artifacts).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ artifact_type: "video_mp4" })]),
    );

    const projectResponse = await request(app)
      .get(`/api/v2/projects/${createResponse.body.project_id}`)
      .expect(200);
    expect(projectResponse.body).toMatchObject({
      status: "FAILED_PLANNING",
      error_code: "OPENAI_NOT_CONFIGURED",
    });

    const metricsResponse = await request(app).get("/api/v2/metrics").expect(200);
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
        .get("CONCEPT_UNDERSTANDING", "failed").count,
    ).toBe(1);
    db.close();
  });
});
