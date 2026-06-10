import { generateLesson, LessonApiError } from "./api/lessonApi";
import "./styles.css";
import type { GenerateLessonRequest, LessonPreview, StoryboardStep, VideoJobSnapshot } from "./types/lesson";

type AppState = {
  concept: string;
  isGenerating: boolean;
  errorCode: string;
  errorMessage: string;
  job?: VideoJobSnapshot;
  lesson?: LessonPreview;
};

const state: AppState = {
  concept: "Giải thích hệ tọa độ Decartes",
  isGenerating: false,
  errorCode: "",
  errorMessage: "",
};

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Missing #app root element");
}

const pipelineStages = [
  { id: "VALIDATING_INPUT", label: "Validate" },
  { id: "CONCEPT_ANALYSIS", label: "Analyze" },
  { id: "KNOWLEDGE_PLAN", label: "Plan" },
  { id: "VISUAL_PLAN", label: "Visuals" },
  { id: "STORYBOARD", label: "Storyboard" },
  { id: "SCENE_DSL", label: "Scene DSL" },
  { id: "RENDERING", label: "Render" },
  { id: "RENDER_QA", label: "QA" },
  { id: "POSTPROCESSING", label: "Package" },
  { id: "COMPLETED", label: "Done" },
];

const quickPrompts = [
  "Giải thích định lý Pytagore",
  "Giải thích hệ tọa độ Decartes",
  "Explain derivatives as slope",
];

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };

    return entities[character];
  });

const normalizeConcept = (value: string): string => value.trim() || "Giải thích định lý Pytagore";

const humanStage = (stage?: string): string => {
  if (!stage) return "Waiting";
  return stage
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const progressValue = (): number => {
  if (state.job?.progress !== undefined) return state.job.progress;
  if (state.lesson?.progress !== undefined) return state.lesson.progress;
  return state.isGenerating ? 4 : 0;
};

const statusText = (): string => {
  if (state.errorMessage) {
    return state.errorCode || "Failed";
  }

  if (state.isGenerating) {
    return `${humanStage(state.job?.current_stage)} ${progressValue()}%`;
  }

  if (state.lesson?.status === "ready") {
    return "Video ready";
  }

  return "Ready";
};

const currentStageIndex = (): number => {
  const current = state.errorMessage ? state.job?.current_stage : state.lesson?.currentStage ?? state.job?.current_stage;
  const index = pipelineStages.findIndex((stage) => stage.id === current);
  if (index >= 0) return index;
  return state.isGenerating ? 0 : -1;
};

const renderPipeline = (): string => {
  const activeIndex = currentStageIndex();
  const failed = Boolean(state.errorMessage);

  return pipelineStages
    .map((stage, index) => {
      const classNames = ["pipeline-step"];
      if (index < activeIndex || state.lesson?.status === "ready") classNames.push("is-complete");
      if (index === activeIndex && state.isGenerating) classNames.push("is-active");
      if (index === activeIndex && failed) classNames.push("is-failed");

      return `
        <li class="${classNames.join(" ")}">
          <span></span>
          <strong>${escapeHtml(stage.label)}</strong>
        </li>
      `;
    })
    .join("");
};

const renderTimeline = (storyboard: StoryboardStep[] = []): string => {
  if (storyboard.length === 0) {
    return `
      <article class="empty-timeline">
        <span>01</span>
        <strong>Waiting for a completed backend job</strong>
        <p>The tutor beats will appear here after OpenAI planning and video rendering finish.</p>
      </article>
    `;
  }

  return storyboard
    .map(
      (step) => `
        <article>
          <span>${String(step.index).padStart(2, "0")}</span>
          <strong>${escapeHtml(step.title)}</strong>
          <p>${escapeHtml(step.description)}</p>
        </article>
      `,
    )
    .join("");
};

const renderVideoFrame = (): string => {
  if (state.lesson?.videoUrl) {
    return `
      <video
        class="lesson-video"
        src="${escapeHtml(state.lesson.videoUrl)}"
        controls
        autoplay
        muted
        playsinline
      ></video>
    `;
  }

  if (state.errorMessage) {
    return `
      <div class="video-state is-error">
        <strong>${escapeHtml(state.errorCode || "Job failed")}</strong>
        <p>${escapeHtml(state.errorMessage)}</p>
      </div>
    `;
  }

  if (state.isGenerating) {
    return `
      <div class="video-state is-loading" aria-live="polite">
        <div class="loader-grid" aria-hidden="true">
          <span></span><span></span><span></span><span></span>
        </div>
        <strong>${escapeHtml(humanStage(state.job?.current_stage))}</strong>
        <p>Backend job ${escapeHtml(state.job?.job_id ?? "queued")} is running.</p>
      </div>
    `;
  }

  return `
    <div class="video-state">
      <div class="axis-preview" aria-hidden="true">
        <span class="axis x-axis"></span>
        <span class="axis y-axis"></span>
        <span class="point"></span>
      </div>
      <strong>Ask for a visual explanation</strong>
      <p>The generated 10-second MP4 will replace this preview.</p>
    </div>
  `;
};

const render = (): void => {
  app.innerHTML = `
    <main class="app-shell">
      <header class="topbar">
        <a class="brand" href="#" aria-label="Visual Tutor home">
          <span class="brand-mark">VT</span>
          <span>Visual Tutor</span>
        </a>
        <span class="runtime-pill">PRD job pipeline</span>
      </header>

      <section class="composer" aria-labelledby="composer-title">
        <div class="composer-copy">
          <p class="eyebrow">Screen-share ready tutor</p>
          <h1 id="composer-title">Prompt in. Video out.</h1>
          <p>
            The frontend now waits for the backend video job: OpenAI planning first,
            local render second, then a playable MP4.
          </p>
        </div>

        <form class="concept-form" id="conceptForm">
          <label class="visually-hidden" for="conceptInput">Concept to explain</label>
          <input
            id="conceptInput"
            name="concept"
            type="text"
            value="${escapeHtml(state.concept)}"
            autocomplete="off"
            placeholder="Giải thích một khái niệm toán học..."
            ${state.isGenerating ? "disabled" : ""}
          />
          <button class="generate-button" type="submit" ${state.isGenerating ? "disabled" : ""}>
            ${state.isGenerating ? "Generating" : "Generate video"}
          </button>
        </form>

        <div class="quick-prompts" aria-label="Example prompts">
          ${quickPrompts
            .map(
              (prompt) => `
                <button type="button" data-prompt="${escapeHtml(prompt)}" ${state.isGenerating ? "disabled" : ""}>
                  ${escapeHtml(prompt)}
                </button>
              `,
            )
            .join("")}
        </div>
      </section>

      <section class="workspace" aria-label="Backend video job">
        <section class="job-panel" aria-labelledby="job-title">
          <div class="panel-header">
            <div>
              <p class="section-kicker">Backend status</p>
              <h2 id="job-title">${escapeHtml(statusText())}</h2>
            </div>
            <span class="status-pill ${state.errorMessage ? "is-error" : state.isGenerating ? "is-active" : ""}">
              ${escapeHtml(state.job?.status ?? state.lesson?.status ?? "idle")}
            </span>
          </div>

          <div class="progress-track" aria-label="Job progress">
            <span style="width: ${progressValue()}%"></span>
          </div>

          <ol class="pipeline-list">
            ${renderPipeline()}
          </ol>

          ${
            state.job?.job_id
              ? `<p class="job-id">Job <code>${escapeHtml(state.job.job_id)}</code></p>`
              : ""
          }
        </section>

        <section class="preview-stage" aria-labelledby="preview-title">
          <div class="panel-header">
            <div>
              <p class="section-kicker">Video preview</p>
              <h2 id="preview-title">${escapeHtml(state.lesson?.title ?? state.concept)}</h2>
            </div>
            <span class="duration-pill">10s max</span>
          </div>

          <div class="video-frame">
            ${renderVideoFrame()}
          </div>
        </section>
      </section>

      <section class="timeline" aria-label="Tutor narration beats">
        ${renderTimeline(state.lesson?.storyboard)}
      </section>
    </main>
  `;

  bindEvents();
};

const readForm = (): GenerateLessonRequest => {
  const conceptInput = document.querySelector<HTMLInputElement>("#conceptInput");

  return {
    concept: normalizeConcept(conceptInput?.value ?? state.concept),
    durationSeconds: 10,
  };
};

const submitLesson = async (nextConcept?: string): Promise<void> => {
  if (state.isGenerating) return;

  const payload = readForm();
  if (nextConcept) payload.concept = nextConcept;

  state.concept = payload.concept;
  state.isGenerating = true;
  state.errorCode = "";
  state.errorMessage = "";
  state.job = undefined;
  state.lesson = undefined;
  render();

  try {
    const lesson = await generateLesson(payload, {
      onJobUpdate: (job) => {
        state.job = job;
        render();
      },
    });
    state.lesson = lesson;
  } catch (error) {
    if (error instanceof LessonApiError) {
      state.errorCode = error.code ?? "";
      state.errorMessage = error.message;
    } else {
      state.errorCode = "CLIENT_ERROR";
      state.errorMessage = error instanceof Error ? error.message : "Could not generate this video.";
    }
  } finally {
    state.isGenerating = false;
    render();
  }
};

const bindEvents = (): void => {
  document.querySelector<HTMLFormElement>("#conceptForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    void submitLesson();
  });

  document.querySelectorAll<HTMLButtonElement>("[data-prompt]").forEach((button) => {
    button.addEventListener("click", () => {
      const prompt = button.dataset.prompt ?? state.concept;
      state.concept = prompt;
      void submitLesson(prompt);
    });
  });
};

render();
