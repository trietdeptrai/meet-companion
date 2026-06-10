import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { ApiError } from "./tutorService.js";
import { createPromptTemplate } from "../templates.js";

const terminalStatuses = new Set([
  "COMPLETED",
  "FAILED_INPUT_UNSAFE",
  "FAILED_PLANNING",
  "FAILED_RENDER",
  "FAILED_POSTPROCESS",
]);

function now() {
  return new Date().toISOString();
}

function isBroadConcept(concept) {
  const normalized = concept.trim().toLowerCase();
  return [
    "math",
    "mathematics",
    "biology",
    "chemistry",
    "physics",
    "science",
    "all of calculus",
    "calculus",
  ].includes(normalized);
}

function detectLanguage(prompt) {
  if (
    /[ăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựỳýỷỹỵ]/i.test(prompt) ||
    prompt.toLowerCase().includes("giải thích")
  ) {
    return "vi";
  }
  return "en";
}

function validateRequest(payload) {
  const concept = String(payload?.concept ?? payload?.prompt ?? "").trim();
  if (!concept) {
    throw new ApiError(400, "PROMPT_REQUIRED", "Please provide a concept to explain.");
  }
  if (isBroadConcept(concept)) {
    throw new ApiError(
      400,
      "INPUT_TOO_BROAD",
      "Please provide a more specific concept, such as 'derivative as local slope'.",
    );
  }

  return {
    concept,
    normalized_concept: concept,
    domain: payload?.domain || "auto",
    level: payload?.level || "beginner",
    duration_sec: Math.min(Math.max(Number(payload?.duration_sec) || 10, 5), 10),
    voiceover: Boolean(payload?.voiceover),
    language: payload?.language || detectLanguage(concept),
    style: payload?.style || "visual_proof",
  };
}

function assertOpenAIPlanningAvailable(hasOpenAIKey, generateLesson) {
  if (!hasOpenAIKey() || typeof generateLesson !== "function") {
    throw new ApiError(
      503,
      "OPENAI_NOT_CONFIGURED",
      "OpenAI planning is required for /api/v1/video-jobs. Set OPENAI_API_KEY and OPENAI_MODEL before generating a video job.",
    );
  }
}

function normalizeLesson(lesson, template) {
  if (
    !lesson ||
    typeof lesson.opening !== "string" ||
    !Array.isArray(lesson.steps) ||
    lesson.steps.length === 0 ||
    typeof lesson.followUpQuestion !== "string"
  ) {
    throw new ApiError(
      502,
      "PLANNER_RESPONSE_INVALID",
      "OpenAI planning returned an invalid tutor script.",
    );
  }

  return {
    opening: lesson.opening.trim(),
    steps: lesson.steps.map((step, index) => {
      const text = String(step?.text ?? "").trim();
      if (!text) {
        throw new ApiError(
          502,
          "PLANNER_RESPONSE_INVALID",
          "OpenAI planning returned an empty tutor step.",
        );
      }

      return {
        atSeconds: Number.isFinite(Number(step.atSeconds))
          ? Number(step.atSeconds)
          : template.captionTimings[index] ?? 0,
        text,
      };
    }),
    followUpQuestion: lesson.followUpQuestion.trim(),
  };
}

function createStoryboard(template, config) {
  const sceneDuration = Math.max(1, Math.floor(config.duration_sec / template.storyboard.length));
  return {
    title: template.title,
    total_duration_sec: config.duration_sec,
    scenes: template.storyboard.map((goal, index) => ({
      scene_id: `s${index + 1}`,
      duration_sec: sceneDuration,
      learning_goal: goal,
      visual_goal: goal,
      objects:
        template.visualKind === "coordinate-plane"
          ? ["x_axis", "y_axis", "origin", "point"]
          : ["shape_a", "shape_b", "relationship", "highlight"],
      animations: ["fade_in", "highlight", "move_or_transform"],
      camera: index === 0 ? "static_center" : "gentle_zoom",
      labels: index === template.storyboard.length - 1 ? ["key takeaway"] : [],
    })),
  };
}

function createSceneDsl(template, storyboard) {
  return {
    canvas: {
      background: "dark",
      resolution: "1280x720",
      style: template.videoStyle,
    },
    scenes: storyboard.scenes.map((scene) => ({
      scene_id: scene.scene_id,
      canvas: {
        background: "dark",
        resolution: "1280x720",
      },
      objects: scene.objects.map((objectId) => ({
        id: objectId,
        type: objectId.includes("axis") ? "axis" : "geometric_object",
        params: {},
        style: {
          stroke: "white",
          fill: "accent",
        },
      })),
      animations: scene.animations.map((animation) => ({
        type: animation,
        target: scene.objects[0] ?? "scene",
        params: {},
        duration: 0.8,
      })),
      camera: [{ type: scene.camera, duration: 0.8 }],
    })),
  };
}

function createVisualPlan(template) {
  return {
    selected_pattern_id: template.visualKind,
    visual_core: template.storyboard.join(" "),
    visual_rules: [
      "Use a dark background and high-contrast geometric objects.",
      "Introduce one idea at a time.",
      "Show the visual intuition before the formula or summary.",
    ],
    color_logic: {
      primary: "cyan",
      secondary: "yellow",
      highlight: "orange",
    },
    camera_logic: ["static intro", "gentle zoom", "final wide frame"],
  };
}

function createConceptAnalysis(template, config) {
  return {
    concept_id: template.id,
    normalized_name: config.normalized_concept,
    domain: config.domain === "auto" ? "math" : config.domain,
    subdomain: template.visualKind,
    prerequisites: [],
    key_claims: template.storyboard,
    common_misconceptions: [],
    recommended_visual_patterns: [template.visualKind],
    unsafe_or_inappropriate: false,
    rejection_reason: null,
  };
}

export function createVideoJobPipeline({
  store,
  logger,
  metrics,
  generateLesson,
  generateVideo,
  hasOpenAIKey,
}) {
  async function saveJob(job) {
    job.updated_at = now();
    await store.saveJob(job);
  }

  async function addArtifact(job, artifact) {
    job.artifacts.push(artifact);
    return artifact;
  }

  async function recordStage(job, stage, status, startedAt, outputRef, logs) {
    const endedAt = Date.now();
    const durationMs = endedAt - startedAt;
    job.pipeline_steps.push({
      id: randomUUID(),
      job_id: job.job_id,
      stage,
      status,
      output_ref: outputRef,
      logs,
      started_at: new Date(startedAt).toISOString(),
      ended_at: new Date(endedAt).toISOString(),
      duration_ms: durationMs,
    });
    metrics.observeStage(stage, durationMs);
    const fields = {
      job_id: job.job_id,
      project_id: job.project_id,
      stage,
      status,
      duration_ms: durationMs,
      output_ref: outputRef,
      logs,
    };

    if (status === "failed") {
      await logger.error("stage_failed", fields);
    } else {
      await logger.info("stage_completed", fields);
    }
  }

  async function runStage(job, stage, progress, fn) {
    const startedAt = Date.now();
    job.status = "RUNNING";
    job.current_stage = stage;
    job.progress = progress;
    await saveJob(job);
    await logger.info("stage_started", {
      job_id: job.job_id,
      project_id: job.project_id,
      stage,
    });

    try {
      const output = await fn();
      let outputRef;
      if (output?.artifactType) {
        const artifact = await store.saveArtifact(
          job.job_id,
          output.artifactType,
          output.fileName,
          output.content,
          output.metadata,
        );
        await addArtifact(job, artifact);
        outputRef = artifact.storage_key;
      }
      await recordStage(job, stage, "completed", startedAt, outputRef);
      await saveJob(job);
      return output?.value ?? output;
    } catch (error) {
      const logs = error.code ? `${error.code}: ${error.message}` : error.message;
      await recordStage(job, stage, "failed", startedAt, null, logs);
      await saveJob(job);
      throw error;
    }
  }

  async function finalizeProject(job, extra = {}) {
    const project = {
      project_id: job.project_id,
      latest_job_id: job.job_id,
      title: job.title,
      concept: job.config.normalized_concept,
      status: job.status,
      created_at: job.created_at,
      updated_at: now(),
      storyboard: job.storyboard,
      scene_dsl: job.scene_dsl,
      artifacts: job.artifacts,
      logs_url: `/api/v1/video-jobs/${job.job_id}`,
      ...extra,
    };
    await store.saveProject(project);
    return project;
  }

  async function runJob(jobId) {
    const job = await store.getJob(jobId);
    if (!job || terminalStatuses.has(job.status)) return;

    try {
      const config = job.config;
      const template = createPromptTemplate(config.normalized_concept, config.language);
      job.title = template.title;

      const conceptAnalysis = await runStage(job, "CONCEPT_ANALYSIS", 20, async () => {
        assertOpenAIPlanningAvailable(hasOpenAIKey, generateLesson);
        const value = createConceptAnalysis(template, config);
        return {
          artifactType: "concept_analysis_json",
          fileName: "concept-analysis.json",
          content: value,
          value,
        };
      });

      const tutor = await runStage(job, "KNOWLEDGE_PLAN", 30, async () => {
        let lesson;
        try {
          lesson = await generateLesson({
            prompt: config.normalized_concept,
            language: config.language,
            template,
          });
        } catch (error) {
          throw new ApiError(
            502,
            "OPENAI_PLANNING_FAILED",
            `OpenAI planning failed: ${error.message}`,
          );
        }

        const value = normalizeLesson(lesson, template);
        job.tutor = value;
        job.intelligenceSource = "openai";
        return {
          artifactType: "knowledge_plan_json",
          fileName: "knowledge-plan.json",
          content: {
            intelligence_source: "openai",
            tutor: value,
          },
          value,
        };
      });

      const visualPlan = await runStage(job, "VISUAL_PLAN", 40, async () => ({
        artifactType: "visual_plan_json",
        fileName: "visual-plan.json",
        content: createVisualPlan(template, conceptAnalysis),
        value: createVisualPlan(template, conceptAnalysis),
      }));

      const storyboard = await runStage(job, "STORYBOARD", 52, async () => {
        const value = createStoryboard(template, config);
        job.storyboard = value;
        return {
          artifactType: "storyboard_json",
          fileName: "storyboard.json",
          content: value,
          value,
        };
      });

      const sceneDsl = await runStage(job, "SCENE_DSL", 64, async () => {
        const value = createSceneDsl(template, storyboard, visualPlan);
        job.scene_dsl = value;
        return {
          artifactType: "scene_dsl_json",
          fileName: "scene-dsl.json",
          content: value,
          value,
        };
      });

      const renderResult = await runStage(job, "RENDERING", 78, async () => {
        const video = await generateVideo({
          requestId: job.job_id,
          prompt: config.normalized_concept,
          template,
          tutor,
        });
        job.tutor = tutor;
        job.intelligenceSource = "openai";
        job.video = video;
        const videoArtifact = {
          artifact_id: `${job.job_id}:video_mp4`,
          artifact_type: "video_mp4",
          storage_key: video.url,
          url: video.url,
          mime_type: video.mimeType,
          size_bytes: null,
          metadata: video,
          created_at: now(),
        };
        await addArtifact(job, videoArtifact);
        if (store.saveRenderAttempt) {
          await store.saveRenderAttempt({
            id: randomUUID(),
            job_id: job.job_id,
            attempt_no: 1,
            scene_name: template.id,
            command: "local-ffmpeg-render",
            status: "completed",
            stdout: null,
            stderr: null,
            output_ref: video.url,
            created_at: now(),
          });
        }
        return { value: { tutor, video, sceneDsl } };
      });

      await runStage(job, "RENDER_QA", 90, async () => {
        if (!renderResult.video?.url) {
          throw new Error("Generated video URL is missing.");
        }
        if (renderResult.video.durationSeconds > 10) {
          throw new Error("Generated video exceeds local 10 second limit.");
        }
        return {
          artifactType: "render_qa_json",
          fileName: "render-qa.json",
          content: {
            playable: true,
            duration_sec: renderResult.video.durationSeconds,
            checks: ["video_url_present", "duration_within_limit"],
          },
        };
      });

      await runStage(job, "POSTPROCESSING", 96, async () => ({
        artifactType: "postprocess_json",
        fileName: "postprocess.json",
        content: {
          output: job.video.url,
          subtitles: "not_generated_local_mvp",
          voiceover: "not_generated_local_mvp",
        },
      }));

      job.status = "COMPLETED";
      job.current_stage = "COMPLETED";
      job.progress = 100;
      job.completed_at = now();
      metrics.increment("video_jobs_completed");
      await saveJob(job);
      await finalizeProject(job);
      await logger.info("job_completed", {
        job_id: job.job_id,
        project_id: job.project_id,
        template_version: job.video?.templateId,
      });
    } catch (error) {
      job.status = job.current_stage === "RENDERING" ? "FAILED_RENDER" : "FAILED_PLANNING";
      job.error_code = error.code || "PIPELINE_FAILED";
      job.error_message = error.message;
      metrics.increment("video_jobs_failed");
      await saveJob(job);
      await finalizeProject(job, {
        error_code: job.error_code,
        error_message: job.error_message,
      });
      await logger.error("job_failed", {
        job_id: job.job_id,
        project_id: job.project_id,
        stage: job.current_stage,
        error_code: job.error_code,
        error_message: job.error_message,
      });
    }
  }

  return {
    async createJob(payload) {
      await store.ensureReady();
      const config = validateRequest(payload);
      const jobId = randomUUID();
      const projectId = randomUUID();
      const createdAt = now();
      const validationStartedAt = Date.now();
      const job = {
        job_id: jobId,
        project_id: projectId,
        status: "PENDING",
        current_stage: "PENDING",
        progress: 0,
        message: "Job accepted for local processing.",
        retry_count: 0,
        config,
        artifacts: [],
        pipeline_steps: [
          {
            id: randomUUID(),
            job_id: jobId,
            stage: "VALIDATING_INPUT",
            status: "completed",
            output_ref: null,
            logs: "Input normalized for local MVP pipeline.",
            started_at: new Date(validationStartedAt).toISOString(),
            ended_at: now(),
            duration_ms: Date.now() - validationStartedAt,
          },
        ],
        created_at: createdAt,
        updated_at: createdAt,
        completed_at: null,
      };

      await store.saveProject({
        project_id: projectId,
        latest_job_id: jobId,
        title: config.normalized_concept,
        concept: config.normalized_concept,
        status: "PENDING",
        created_at: createdAt,
        updated_at: createdAt,
        artifacts: [],
      });
      await store.saveJob(job);
      metrics.increment("video_jobs_created");
      metrics.observeStage("VALIDATING_INPUT", Date.now() - validationStartedAt);
      await logger.info("job_created", {
        job_id: jobId,
        project_id: projectId,
        stage: "PENDING",
      });

      setTimeout(() => {
        runJob(jobId);
      }, 0);

      return job;
    },

    async getJob(jobId) {
      return store.getJob(jobId);
    },

    async getProject(projectId) {
      return store.getProject(projectId);
    },

    async isReady() {
      await store.ensureReady();
      return true;
    },

    async getStorageCounts() {
      return store.getCounts?.() ?? {};
    },
  };
}
