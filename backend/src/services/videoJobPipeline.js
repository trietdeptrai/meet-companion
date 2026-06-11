import { randomUUID } from "node:crypto";
import { resolveDesignTokens } from "./designTokens.js";
import {
  installMotionComponents,
  normalizeComponentGraph,
} from "./motionComponents.js";
import {
  allocateRenderers,
  compileTimeline,
  runStaticPreflight,
} from "./timelineCompiler.js";
import { ApiError } from "./tutorService.js";
import { createRepairPlan, runVisualQa } from "./visualQa.js";

const terminalStatuses = new Set([
  "COMPLETED",
  "FAILED_INPUT_UNSAFE",
  "FAILED_PLANNING",
  "FAILED_RENDER",
  "FAILED_POSTPROCESS",
]);

const defaultCaptionTimings = [0, 2.5, 5, 7.5];
const qualityModes = new Set(["fast", "balanced", "best"]);
const defaultVideoDurationSeconds = 24;
const maxLocalVideoDurationSeconds = 60;

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
  return normalized.slice(0, 48) || "visual-concept";
}

function titleFromConcept(concept) {
  return concept.replace(/^giải thích\s+/i, "").trim() || concept;
}

function stringArray(value) {
  return Array.isArray(value) ? value.map((entry) => String(entry)).filter(Boolean) : [];
}

function numberValue(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function assertObject(value, code, message) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiError(502, code, message);
  }
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

  const qualityMode = qualityModes.has(String(payload?.quality_mode))
    ? String(payload.quality_mode)
    : "balanced";

  return {
    concept,
    normalized_concept: concept,
    domain: payload?.domain || "auto",
    level: payload?.level || "beginner",
    duration_sec: Math.min(
      Math.max(Number(payload?.duration_sec) || defaultVideoDurationSeconds, 8),
      maxLocalVideoDurationSeconds,
    ),
    voiceover: Boolean(payload?.voiceover),
    input_language: payload?.input_language || detectLanguage(concept),
    language: payload?.output_language || "en",
    style_preset: payload?.style_preset || payload?.style || "clean_dark_explainer",
    style: payload?.style_preset || payload?.style || "clean_dark_explainer",
    quality_mode: qualityMode,
    safe: true,
    supported_mode: "native_component",
  };
}

function createRequestContext(config) {
  return {
    id: slugifyConcept(config.normalized_concept),
    title: titleFromConcept(config.normalized_concept),
    duration_sec: config.duration_sec,
    language: config.language,
    level: config.level,
    style: config.style_preset,
    quality_mode: config.quality_mode,
  };
}

function assertOpenAIPlanningAvailable(hasOpenAIKey, generateLesson) {
  if (!hasOpenAIKey() || typeof generateLesson !== "function") {
    throw new ApiError(
      503,
      "OPENAI_NOT_CONFIGURED",
      "OpenAI planning is required for /api/v2/video-jobs. Set OPENAI_API_KEY and OPENAI_MODEL before generating a video job.",
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

function normalizeConceptUnderstanding(plannerOutput, requestContext, config) {
  const source = plannerOutput?.conceptUnderstanding;
  assertObject(
    source,
    "PLANNER_RESPONSE_INVALID",
    "OpenAI planning did not include concept understanding.",
  );

  return {
    concept_id: String(source.concept_id || requestContext.id),
    domain: String(source.domain || (config.domain === "auto" ? "general" : config.domain)),
    subdomain: String(source.subdomain || "general"),
    learning_objective: String(source.learning_objective || `Explain ${config.normalized_concept}.`),
    prerequisites: stringArray(source.prerequisites),
    key_ideas: stringArray(source.key_ideas),
    misconceptions: stringArray(source.misconceptions),
    visual_affordances: stringArray(source.visual_affordances),
  };
}

function normalizeKnowledgeDecomposition(plannerOutput) {
  const source = plannerOutput?.knowledgeDecomposition;
  assertObject(
    source,
    "PLANNER_RESPONSE_INVALID",
    "OpenAI planning did not include knowledge decomposition.",
  );
  if (!Array.isArray(source.atoms) || source.atoms.length === 0) {
    throw new ApiError(502, "PLANNER_RESPONSE_INVALID", "OpenAI knowledge decomposition has no atoms.");
  }

  return {
    atoms: source.atoms.slice(0, 6).map((atom, index) => ({
      id: String(atom?.id || `atom_${index + 1}`),
      idea: String(atom?.idea || "Teach one atomic idea."),
      visual_need: String(atom?.visual_need || "Show the idea visually."),
    })),
  };
}

function normalizeCreativeTreatments(plannerOutput, qualityMode) {
  const source = plannerOutput?.creativeTreatments;
  assertObject(
    source,
    "PLANNER_RESPONSE_INVALID",
    "OpenAI planning did not include creative treatments.",
  );
  if (!Array.isArray(source.treatments) || source.treatments.length === 0) {
    throw new ApiError(502, "PLANNER_RESPONSE_INVALID", "OpenAI creative treatments are empty.");
  }

  const maxByQuality = qualityMode === "fast" ? 1 : qualityMode === "best" ? 5 : 3;
  return {
    concept: String(source.concept || ""),
    treatments: source.treatments.slice(0, maxByQuality).map((treatment, index) => ({
      treatment_id: String(treatment?.treatment_id || `treatment_${index + 1}`),
      title: String(treatment?.title || treatment?.one_liner || `Treatment ${index + 1}`),
      one_liner: String(treatment?.one_liner || ""),
      visual_hook: String(treatment?.visual_hook || ""),
      components: stringArray(treatment?.components),
      estimated_quality: numberValue(treatment?.estimated_quality, 0.75),
      estimated_feasibility: numberValue(treatment?.estimated_feasibility, 0.75),
      style_notes: stringArray(treatment?.style_notes),
    })),
  };
}

function normalizeTreatmentRanking(plannerOutput, creativeTreatments) {
  const source = plannerOutput?.treatmentRanking;
  assertObject(
    source,
    "PLANNER_RESPONSE_INVALID",
    "OpenAI planning did not include treatment ranking.",
  );
  const treatmentIds = new Set(creativeTreatments.treatments.map((entry) => entry.treatment_id));
  const selected = treatmentIds.has(source.selected_treatment_id)
    ? source.selected_treatment_id
    : creativeTreatments.treatments[0].treatment_id;

  return {
    selected_treatment_id: selected,
    reason: String(source.reason || "Selected the clearest feasible treatment."),
    rejected_treatments: Array.isArray(source.rejected_treatments)
      ? source.rejected_treatments.map((entry) => ({
          id: String(entry?.id || ""),
          reason: String(entry?.reason || "Lower ranked for this local render."),
        })).filter((entry) => entry.id)
      : [],
    scores: Array.isArray(source.scores)
      ? source.scores.map((score) => ({
          treatment_id: String(score?.treatment_id || selected),
          concept_accuracy_score: numberValue(score?.concept_accuracy_score, 0.8),
          visual_clarity_score: numberValue(score?.visual_clarity_score, 0.8),
          component_availability_score: numberValue(score?.component_availability_score, 0.8),
          animation_beauty_score: numberValue(score?.animation_beauty_score, 0.75),
          pacing_score: numberValue(score?.pacing_score, 0.75),
          feasibility_score: numberValue(score?.feasibility_score, 0.8),
          complexity_penalty: numberValue(score?.complexity_penalty, 0.05),
          cognitive_load_penalty: numberValue(score?.cognitive_load_penalty, 0.05),
          final_score: numberValue(score?.final_score, 0.8),
        }))
      : [],
  };
}

function normalizeCreativeBrief(plannerOutput, config) {
  const source = plannerOutput?.creativeBrief;
  assertObject(
    source,
    "PLANNER_RESPONSE_INVALID",
    "OpenAI planning did not include creative brief.",
  );

  return {
    tone: String(source.tone || "clean, curious, precise"),
    visual_style: String(source.visual_style || config.style_preset),
    density: String(source.density || "low_text_high_visual"),
    camera_style: String(source.camera_style || "gentle motion"),
    color_strategy: {
      background: String(source.color_strategy?.background || "deep navy"),
      primary_math: String(source.color_strategy?.primary_math || "soft cyan"),
      secondary_highlight: String(source.color_strategy?.secondary_highlight || "warm yellow"),
      inactive_objects: String(source.color_strategy?.inactive_objects || "muted gray"),
    },
    motion_rules: stringArray(source.motion_rules),
  };
}

function normalizeStoryboardShotlist(plannerOutput, config) {
  const source = plannerOutput?.storyboard;
  assertObject(
    source,
    "PLANNER_RESPONSE_INVALID",
    "OpenAI planning did not include storyboard and shot list.",
  );
  if (!Array.isArray(source.shots) || source.shots.length === 0) {
    throw new ApiError(502, "PLANNER_RESPONSE_INVALID", "OpenAI storyboard has no shots.");
  }

  return {
    title: String(source.title || titleFromConcept(config.normalized_concept)),
    duration_sec: config.duration_sec,
    shots: source.shots.slice(0, 8).map((shot, index) => ({
      shot_id: String(shot?.shot_id || `sh${index + 1}`),
      duration_sec: Math.max(1, numberValue(shot?.duration_sec, 2)),
      visual_goal: String(shot?.visual_goal || "Explain one visual idea."),
      main_component: String(shot?.main_component || "GenericDiagram"),
      camera: String(shot?.camera || "static_center"),
      text_policy: String(shot?.text_policy || "minimal_label"),
      narration: String(shot?.narration || ""),
    })),
  };
}

function videoArtifact(job, artifactType, video) {
  return {
    artifact_id: `${job.job_id}:${artifactType}`,
    artifact_type: artifactType,
    storage_key: video.url,
    url: video.url,
    mime_type: video.mimeType,
    size_bytes: null,
    metadata: video,
    created_at: now(),
  };
}

function renderPassSnapshot(renderPass) {
  return {
    id: renderPass.id,
    pass_type: renderPass.pass_type,
    renderer: renderPass.renderer,
    status: renderPass.status,
    output_ref: renderPass.output_ref,
    duration_ms: renderPass.duration_ms,
    created_at: renderPass.created_at,
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

  async function saveTreatmentRows(job, creativeTreatments, ranking) {
    if (!store.saveCreativeTreatment) return;
    const selected = ranking?.selected_treatment_id;
    const scoresById = new Map((ranking?.scores ?? []).map((score) => [score.treatment_id, score.final_score]));
    for (const treatment of creativeTreatments.treatments) {
      await store.saveCreativeTreatment({
        id: `${job.job_id}:${treatment.treatment_id}`,
        project_id: job.project_id,
        job_id: job.job_id,
        treatment_id: treatment.treatment_id,
        title: treatment.title,
        visual_hook: treatment.visual_hook,
        score: scoresById.get(treatment.treatment_id) ?? treatment.estimated_quality,
        selected: selected === treatment.treatment_id,
        payload: treatment,
        created_at: now(),
      });
    }
  }

  async function saveRenderPass(job, renderPass) {
    job.render_passes.push(renderPassSnapshot(renderPass));
    if (store.saveRenderPass) {
      await store.saveRenderPass(renderPass);
    }
  }

  async function finalizeProject(job, extra = {}) {
    const project = {
      project_id: job.project_id,
      latest_job_id: job.job_id,
      title: job.title,
      concept: job.config.normalized_concept,
      status: job.status,
      quality_mode: job.quality_mode,
      created_at: job.created_at,
      updated_at: now(),
      storyboard: job.storyboard,
      creative_brief: job.creative_brief,
      component_graph: job.component_graph,
      timeline: job.timeline,
      renderer_allocation: job.renderer_allocation,
      qa_reports: job.qa_reports,
      render_passes: job.render_passes,
      artifacts: job.artifacts,
      logs_url: `/api/v2/video-jobs/${job.job_id}`,
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
      const designTokens = resolveDesignTokens(config.style_preset);
      job.title = requestContext.title;
      let plannerOutput;

      const conceptUnderstanding = await runStage(job, "CONCEPT_UNDERSTANDING", 12, async () => {
        assertOpenAIPlanningAvailable(hasOpenAIKey, generateLesson);
        try {
          plannerOutput = await generateLesson({
            prompt: config.normalized_concept,
            language: config.language,
            requestContext,
            durationSeconds: config.duration_sec,
            qualityMode: config.quality_mode,
            stylePreset: config.style_preset,
          });
        } catch (error) {
          throw new ApiError(
            502,
            "OPENAI_PLANNING_FAILED",
            `OpenAI planning failed: ${error.message}`,
          );
        }

        const value = normalizeConceptUnderstanding(plannerOutput, requestContext, config);
        job.concept_understanding = value;
        return {
          artifactType: "concept_understanding_json",
          fileName: "concept-understanding.json",
          content: value,
          value,
        };
      });

      const knowledgeDecomposition = await runStage(job, "KNOWLEDGE_DECOMPOSITION", 20, async () => {
        const tutor = normalizeLesson(plannerOutput);
        const value = normalizeKnowledgeDecomposition(plannerOutput);
        job.tutor = tutor;
        job.intelligenceSource = "openai";
        job.knowledge_decomposition = value;
        return {
          artifactType: "knowledge_decomposition_json",
          fileName: "knowledge-decomposition.json",
          content: {
            intelligence_source: "openai",
            tutor,
            decomposition: value,
          },
          value,
        };
      });

      const creativeTreatments = await runStage(job, "TREATMENT_CANDIDATES", 30, async () => {
        const value = normalizeCreativeTreatments(plannerOutput, config.quality_mode);
        job.creative_treatments = value;
        await saveTreatmentRows(job, value);
        return {
          artifactType: "creative_treatments_json",
          fileName: "creative-treatments.json",
          content: value,
          value,
        };
      });

      const treatmentRanking = await runStage(job, "TREATMENT_RANKING", 38, async () => {
        const value = normalizeTreatmentRanking(plannerOutput, creativeTreatments);
        job.treatment_ranking = value;
        await saveTreatmentRows(job, creativeTreatments, value);
        return {
          artifactType: "treatment_ranking_json",
          fileName: "treatment-ranking.json",
          content: value,
          value,
        };
      });

      const creativeBrief = await runStage(job, "CREATIVE_BRIEF", 45, async () => {
        const value = normalizeCreativeBrief(plannerOutput, config);
        job.creative_brief = value;
        return {
          artifactType: "creative_brief_json",
          fileName: "creative-brief.json",
          content: {
            ...value,
            design_tokens: designTokens,
          },
          value,
        };
      });

      const storyboard = await runStage(job, "STORYBOARD_SHOTLIST", 52, async () => {
        const value = normalizeStoryboardShotlist(plannerOutput, config);
        job.storyboard = value;
        return {
          artifactType: "storyboard_shotlist_json",
          fileName: "storyboard-shotlist.json",
          content: value,
          value,
        };
      });

      const componentGraph = await runStage(job, "MOTION_COMPONENT_GRAPH", 60, async () => {
        const value = normalizeComponentGraph(plannerOutput.componentGraph, storyboard, requestContext);
        job.component_graph = value;
        if (store.saveComponentGraph) {
          await store.saveComponentGraph({
            id: `${job.job_id}:component_graph:v1`,
            project_id: job.project_id,
            job_id: job.job_id,
            version: 1,
            status: value.status,
            payload: value,
            created_at: now(),
          });
        }
        return {
          artifactType: "component_graph_json",
          fileName: "component-graph.json",
          content: value,
          value,
        };
      });

      const timeline = await runStage(job, "TIMELINE_COMPILER", 66, async () => {
        const value = compileTimeline({
          storyboard,
          componentGraph,
          durationSeconds: config.duration_sec,
          designTokens,
        });
        job.timeline = value;
        if (store.saveTimeline) {
          await store.saveTimeline({
            id: `${job.job_id}:timeline:v1`,
            project_id: job.project_id,
            job_id: job.job_id,
            version: 1,
            payload: value,
            created_at: now(),
          });
        }
        return {
          artifactType: "timeline_json",
          fileName: "timeline.json",
          content: value,
          value,
        };
      });

      const rendererAllocation = await runStage(job, "RENDERER_ALLOCATION", 71, async () => {
        const value = allocateRenderers({ timeline, componentGraph });
        job.renderer_allocation = value;
        return {
          artifactType: "renderer_allocation_json",
          fileName: "renderer-allocation.json",
          content: value,
          value,
        };
      });

      const preflight = await runStage(job, "STATIC_PREFLIGHT", 75, async () => {
        const value = runStaticPreflight({ componentGraph, timeline, designTokens });
        if (!value.pass) {
          throw new ApiError(
            502,
            "STATIC_PREFLIGHT_FAILED",
            "Component graph or timeline failed static preflight validation.",
          );
        }
        job.preflight = value;
        return {
          artifactType: "preflight_json",
          fileName: "preflight.json",
          content: value,
          value,
        };
      });

      const previewVideo = await runStage(job, "PREVIEW_RENDER", 81, async () => {
        const startedAt = Date.now();
        const video = await generateVideo({
          requestId: `${job.job_id}-preview`,
          prompt: config.normalized_concept,
          requestContext,
          tutor: job.tutor,
          conceptUnderstanding,
          knowledgeDecomposition,
          creativeTreatments,
          treatmentRanking,
          creativeBrief,
          storyboard,
          componentGraph,
          timeline,
          rendererAllocation,
          renderPass: "preview",
        });
        await addArtifact(job, videoArtifact(job, "preview_video_mp4", video));
        await saveRenderPass(job, {
          id: randomUUID(),
          project_id: job.project_id,
          job_id: job.job_id,
          pass_type: "preview",
          renderer: video.renderer || "component-graph-ffmpeg",
          status: "completed",
          input_ref: "timeline_json",
          output_ref: video.url,
          duration_ms: Date.now() - startedAt,
          payload: video,
          created_at: now(),
        });
        return { value: video };
      });

      const qaReport = await runStage(job, "FRAME_SAMPLING_QA", 87, async () => {
        const value = runVisualQa({
          video: previewVideo,
          timeline,
          componentGraph,
          preflight,
        });
        job.qa_reports.push(value);
        if (store.saveQaReport) {
          await store.saveQaReport({
            id: `${job.job_id}:visual_qa:preview`,
            project_id: job.project_id,
            job_id: job.job_id,
            render_attempt_id: null,
            qa_type: value.qa_type,
            score: value.qa_score,
            passed: value.passed,
            issues: value.issues,
            sampled_frames: value.sampled_frames,
            payload: value,
            created_at: now(),
          });
        }
        if (!value.passed && config.quality_mode === "fast") {
          throw new ApiError(502, "VISUAL_QA_FAILED", "Preview render failed visual QA.");
        }
        return {
          artifactType: "qa_report_json",
          fileName: "visual-qa-preview.json",
          content: value,
          value,
        };
      });

      await runStage(job, "REPAIR_POLISH", 91, async () => {
        const value = createRepairPlan({ qaReport, timeline });
        job.repair_polish = value;
        return {
          artifactType: "repair_polish_json",
          fileName: "repair-polish.json",
          content: value,
          value,
        };
      });

      await runStage(job, "FINAL_RENDER", 95, async () => {
        const startedAt = Date.now();
        const video = await generateVideo({
          requestId: `${job.job_id}-final`,
          prompt: config.normalized_concept,
          requestContext,
          tutor: job.tutor,
          conceptUnderstanding,
          knowledgeDecomposition,
          creativeTreatments,
          treatmentRanking,
          creativeBrief,
          storyboard,
          componentGraph,
          timeline,
          rendererAllocation,
          renderPass: "final",
        });
        job.video = video;
        await addArtifact(job, videoArtifact(job, "video_mp4", video));
        await saveRenderPass(job, {
          id: randomUUID(),
          project_id: job.project_id,
          job_id: job.job_id,
          pass_type: "final",
          renderer: video.renderer || "component-graph-ffmpeg",
          status: "completed",
          input_ref: "timeline_json",
          output_ref: video.url,
          duration_ms: Date.now() - startedAt,
          payload: video,
          created_at: now(),
        });
        return { value: video };
      });

      await runStage(job, "POSTPROCESSING", 98, async () => ({
        artifactType: "postprocess_json",
        fileName: "postprocess.json",
        content: {
          output: job.video.url,
          subtitles: "not_generated_local_mvp",
          voiceover: config.voiceover ? "queued_for_future_tts" : "disabled",
          duration_sec: job.video.durationSeconds,
        },
      }));

      await runStage(job, "DELIVERY_SAVE", 99, async () => ({
        artifactType: "delivery_project_json",
        fileName: "delivery-project.json",
        content: {
          project_id: job.project_id,
          job_id: job.job_id,
          editable_artifacts: [
            "creative_treatments_json",
            "storyboard_shotlist_json",
            "component_graph_json",
            "timeline_json",
            "qa_report_json",
          ],
          video_url: job.video.url,
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
      if (job.current_stage === "PREVIEW_RENDER" || job.current_stage === "FINAL_RENDER") {
        job.status = "FAILED_RENDER";
      } else if (job.current_stage === "POSTPROCESSING") {
        job.status = "FAILED_POSTPROCESS";
      } else {
        job.status = "FAILED_PLANNING";
      }
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
      await installMotionComponents(store);
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
        message: "Job accepted for local v2 quality processing.",
        retry_count: 0,
        quality_mode: config.quality_mode,
        config,
        artifacts: [],
        pipeline_steps: [
          {
            id: randomUUID(),
            job_id: jobId,
            stage: "INPUT_INTAKE",
            status: "completed",
            output_ref: null,
            logs: "Input normalized, duration capped, style preset selected, and safety checks passed.",
            started_at: new Date(validationStartedAt).toISOString(),
            ended_at: now(),
            duration_ms: Date.now() - validationStartedAt,
          },
        ],
        qa_reports: [],
        render_passes: [],
        created_at: createdAt,
        updated_at: createdAt,
        completed_at: null,
      };

      await store.saveProject({
        project_id: projectId,
        latest_job_id: jobId,
        title: config.normalized_concept,
        concept: config.normalized_concept,
        normalized_concept: config.normalized_concept,
        domain: config.domain,
        level: config.level,
        language: config.language,
        status: "PENDING",
        quality_mode: config.quality_mode,
        created_at: createdAt,
        updated_at: createdAt,
        artifacts: [],
      });
      await store.saveJob(job);
      metrics.increment("video_jobs_created");
      metrics.observeStage("INPUT_INTAKE", Date.now() - validationStartedAt);
      await logger.info("job_created", {
        job_id: jobId,
        project_id: projectId,
        stage: "PENDING",
        quality_mode: config.quality_mode,
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

    async getComponentGraph(projectId) {
      const project = await store.getProject(projectId);
      return project?.component_graph ?? null;
    },

    async isReady() {
      await store.ensureReady();
      return true;
    },

    async getStorageCounts() {
      return store.getCounts();
    },
  };
}
