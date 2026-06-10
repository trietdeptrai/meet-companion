import { randomUUID } from "node:crypto";
import { ApiError } from "./tutorService.js";

const terminalStatuses = new Set([
  "COMPLETED",
  "FAILED_INPUT_UNSAFE",
  "FAILED_PLANNING",
  "FAILED_RENDER",
  "FAILED_POSTPROCESS",
]);

const defaultCaptionTimings = [0, 2, 4, 6];

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

function searchableText(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function slugifyConcept(prompt) {
  const normalized = searchableText(prompt)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return normalized.slice(0, 48) || "visual-math-concept";
}

function titleFromConcept(concept) {
  return concept.replace(/^giải thích\s+/i, "").trim() || concept;
}

function createRequestContext(config) {
  return {
    id: slugifyConcept(config.normalized_concept),
    title: titleFromConcept(config.normalized_concept),
    duration_sec: config.duration_sec,
    language: config.language,
    level: config.level,
    style: config.style,
  };
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

function normalizeLesson(lesson) {
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
          : defaultCaptionTimings[index] ?? 0,
        text,
      };
    }),
    followUpQuestion: lesson.followUpQuestion.trim(),
  };
}

function stringArray(value) {
  return Array.isArray(value) ? value.map((entry) => String(entry)).filter(Boolean) : [];
}

function assertObject(value, code, message) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiError(502, code, message);
  }
}

function normalizeConceptAnalysis(plannerOutput, requestContext, config) {
  const source = plannerOutput?.conceptAnalysis;
  assertObject(
    source,
    "PLANNER_RESPONSE_INVALID",
    "OpenAI planning did not include concept analysis.",
  );

  return {
    concept_id: String(source.concept_id || requestContext.id),
    normalized_name: config.normalized_concept,
    domain: String(source.domain || (config.domain === "auto" ? "math" : config.domain)),
    subdomain: String(source.subdomain || "general"),
    prerequisites: stringArray(source.prerequisites),
    key_claims: stringArray(source.key_claims),
    common_misconceptions: stringArray(source.common_misconceptions),
    best_explanation_modes: stringArray(source.best_explanation_modes),
    unsafe_or_inappropriate: Boolean(source.unsafe_or_inappropriate),
    rejection_reason: source.rejection_reason ?? null,
  };
}

function normalizeVisualPlan(plannerOutput) {
  const source = plannerOutput?.visualPlan;
  assertObject(
    source,
    "PLANNER_RESPONSE_INVALID",
    "OpenAI planning did not include a visual plan.",
  );

  return {
    selected_pattern_id: String(source.selected_pattern_id || "scene_dsl"),
    visual_core: String(source.visual_core || ""),
    visual_rules: stringArray(source.visual_rules),
    color_logic: {
      primary: String(source.color_logic?.primary || "cyan"),
      secondary: String(source.color_logic?.secondary || "yellow"),
      highlight: String(source.color_logic?.highlight || "orange"),
    },
  };
}

function normalizeStoryboard(plannerOutput, config) {
  const source = plannerOutput?.storyboard;
  assertObject(
    source,
    "PLANNER_RESPONSE_INVALID",
    "OpenAI planning did not include a storyboard.",
  );
  if (!Array.isArray(source.scenes) || source.scenes.length === 0) {
    throw new ApiError(502, "PLANNER_RESPONSE_INVALID", "OpenAI storyboard has no scenes.");
  }

  return {
    total_duration_sec: config.duration_sec,
    scenes: source.scenes.slice(0, 5).map((scene, index) => ({
      scene_id: String(scene.scene_id || `s${index + 1}`),
      duration_sec: Math.max(1, Number(scene.duration_sec) || 2),
      learning_goal: String(scene.learning_goal || scene.goal || "Explain the concept visually."),
      visual_goal: String(scene.visual_goal || scene.learning_goal || "Show the visual idea."),
      objects: stringArray(scene.objects),
      animations: stringArray(scene.animations),
      camera: String(scene.camera || "static_center"),
      labels: stringArray(scene.labels),
    })),
  };
}

function normalizeSceneDsl(plannerOutput) {
  const source = plannerOutput?.sceneDsl;
  assertObject(
    source,
    "PLANNER_RESPONSE_INVALID",
    "OpenAI planning did not include scene DSL.",
  );
  if (!Array.isArray(source.scenes) || source.scenes.length === 0) {
    throw new ApiError(502, "PLANNER_RESPONSE_INVALID", "OpenAI scene DSL has no scenes.");
  }

  return {
    canvas: {
      background: String(source.canvas?.background || "dark"),
      resolution: "1280x720",
      style: String(source.canvas?.style || "3Blue1Brown-like visual math"),
    },
    scenes: source.scenes.slice(0, 5).map((scene, sceneIndex) => ({
      scene_id: String(scene.scene_id || `s${sceneIndex + 1}`),
      objects: Array.isArray(scene.objects)
        ? scene.objects.slice(0, 10).map((object, objectIndex) => ({
            id: String(object.id || `object_${sceneIndex + 1}_${objectIndex + 1}`),
            type: String(object.type || "geometric_object"),
            params: object.params && typeof object.params === "object" ? object.params : {},
            style: object.style && typeof object.style === "object" ? object.style : {},
          }))
        : [],
      animations: Array.isArray(scene.animations) ? scene.animations : [],
      camera: Array.isArray(scene.camera) ? scene.camera : [],
    })),
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
      const requestContext = createRequestContext(config);
      job.title = requestContext.title;
      let plannerOutput;

      const conceptAnalysis = await runStage(job, "CONCEPT_ANALYSIS", 20, async () => {
        assertOpenAIPlanningAvailable(hasOpenAIKey, generateLesson);
        try {
          plannerOutput = await generateLesson({
            prompt: config.normalized_concept,
            language: config.language,
            requestContext,
            durationSeconds: config.duration_sec,
          });
        } catch (error) {
          throw new ApiError(
            502,
            "OPENAI_PLANNING_FAILED",
            `OpenAI planning failed: ${error.message}`,
          );
        }

        const value = normalizeConceptAnalysis(plannerOutput, requestContext, config);
        return {
          artifactType: "concept_analysis_json",
          fileName: "concept-analysis.json",
          content: value,
          value,
        };
      });

      const tutor = await runStage(job, "KNOWLEDGE_PLAN", 30, async () => {
        const value = normalizeLesson(plannerOutput);
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

      const visualPlan = await runStage(job, "VISUAL_PLAN", 40, async () => {
        const value = normalizeVisualPlan(plannerOutput, conceptAnalysis);
        return {
          artifactType: "visual_plan_json",
          fileName: "visual-plan.json",
          content: value,
          value,
        };
      });

      const storyboard = await runStage(job, "STORYBOARD", 52, async () => {
        const value = normalizeStoryboard(plannerOutput, config);
        job.storyboard = value;
        return {
          artifactType: "storyboard_json",
          fileName: "storyboard.json",
          content: value,
          value,
        };
      });

      const sceneDsl = await runStage(job, "SCENE_DSL", 64, async () => {
        const value = normalizeSceneDsl(plannerOutput, storyboard, visualPlan);
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
          requestContext,
          tutor,
          storyboard,
          visualPlan,
          sceneDsl,
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
            scene_name: visualPlan.selected_pattern_id,
            command: "scene-dsl-ffmpeg-render",
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
        renderer: job.video?.renderer,
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
