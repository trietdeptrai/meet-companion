import { generateLesson } from "./api/lessonApi";
import "./styles.css";
import type {
  Audience,
  GenerateLessonRequest,
  LessonPreview,
  StoryboardStep,
  VisualMode,
} from "./types/lesson";

type AppState = GenerateLessonRequest & {
  lesson: LessonPreview;
  isGenerating: boolean;
  errorMessage: string;
};

const initialLesson: LessonPreview = {
  id: "initial",
  title: "Pythagorean theorem",
  status: "ready",
  formula: "a² + b² = c²",
  symbols: ["a", "b", "c", "c²"],
  storyboard: [
    {
      index: 1,
      title: "Draw the triangle",
      description: "Start with a right triangle and name the two shorter sides a and b.",
    },
    {
      index: 2,
      title: "Mark the hypotenuse",
      description: "The longest side is c.",
    },
    {
      index: 3,
      title: "Compare areas",
      description: "The two smaller square areas add up to the large square area.",
    },
  ],
};

const state: AppState = {
  concept: "Giải thích định lý Pytagore bằng hình ảnh đơn giản",
  audience: "Beginner",
  visualMode: "Symbols",
  durationSeconds: 10,
  includeNarration: true,
  lesson: initialLesson,
  isGenerating: false,
  errorMessage: "",
};

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Missing #app root element");
}

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

const normalizeConcept = (value: string): string => value.trim() || "Untitled concept";

const statusLabel = (): string => {
  if (state.isGenerating) {
    return "Generating";
  }

  if (state.errorMessage) {
    return "Needs attention";
  }

  return state.lesson.status === "ready" ? "Storyboard ready" : state.lesson.status;
};

const renderTimeline = (storyboard: StoryboardStep[]): string =>
  storyboard
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

const render = (): void => {
  const [symbolA = "A", symbolB = "B", symbolC = "C", symbolD = "?"] = state.lesson.symbols;

  app.innerHTML = `
    <main class="app-shell">
      <header class="topbar" aria-label="Primary navigation">
        <a class="brand" href="#" aria-label="SymbolTutor home">
          <span class="brand-mark">S</span>
          <span>SymbolTutor</span>
        </a>

        <nav class="nav-pod" aria-label="Main menu">
          <a href="#">Explore</a>
          <a href="#">Library</a>
          <a href="#">Classroom</a>
        </nav>

        <div class="account-actions">
          <button class="icon-button" type="button" aria-label="Search">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m21 21-4.35-4.35m2.1-5.4a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z" />
            </svg>
          </button>
          <button class="ghost-button" type="button">Sign in</button>
          <button class="solid-button" type="button">Join beta</button>
        </div>
      </header>

      <section class="hero" aria-labelledby="hero-title">
        <div class="pattern-field" aria-hidden="true">
          <span></span>
          <span></span>
          <span></span>
          <span></span>
        </div>

        <div class="hero-copy">
          <p class="eyebrow">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6 5.6 18.4" />
            </svg>
            Symbol-first AI lessons
          </p>
          <h1 id="hero-title">Turn any concept into an animated tutor video.</h1>
          <p class="hero-subtitle">
            Type the topic, pick a learning style, and preview a visual explanation
            built from symbols, motion, narration beats, and checkpoints.
          </p>
        </div>

        <form class="concept-form" id="conceptForm">
          <label class="visually-hidden" for="conceptInput">Concept to learn</label>
          <input
            id="conceptInput"
            name="concept"
            type="text"
            value="${escapeHtml(state.concept)}"
            autocomplete="off"
            placeholder="What concept should the AI explain?"
          />
          <button class="generate-button" type="submit" aria-label="Generate lesson" ${state.isGenerating ? "disabled" : ""}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 12h14m-6-6 6 6-6 6" />
            </svg>
          </button>
        </form>

        <div class="quick-prompts" aria-label="Example concepts">
          <button type="button" data-prompt="Giải thích định lý Pytagore">Định lý Pytagore</button>
          <button type="button" data-prompt="Explain the Pythagorean theorem simply">Pythagorean theorem</button>
          <button type="button" data-prompt="Tam giác vuông và cạnh huyền">Tam giác vuông</button>
        </div>
      </section>

      <section class="workspace" aria-label="Lesson generator workspace">
        <aside class="control-panel">
          <div class="panel-heading">
            <p class="section-kicker">Lesson setup</p>
            <h2>Shape the explanation</h2>
          </div>

          <div class="field-group">
            <label for="audience">Audience</label>
            <select id="audience">
              ${["Beginner", "High school", "University", "Professional"]
                .map(
                  (audience) =>
                    `<option ${state.audience === audience ? "selected" : ""}>${audience}</option>`,
                )
                .join("")}
            </select>
          </div>

          <div class="field-group">
            <label>Visual mode</label>
            <div class="segmented" role="group" aria-label="Visual mode">
              ${["Symbols", "Graph", "Story"]
                .map(
                  (mode) =>
                    `<button class="${state.visualMode === mode ? "active" : ""}" type="button" data-mode="${mode}">${mode}</button>`,
                )
                .join("")}
            </div>
          </div>

          <div class="field-group">
            <label for="duration">Video length</label>
            <div class="range-row">
              <input id="duration" type="range" min="10" max="10" value="${state.durationSeconds}" />
              <output id="durationOutput" for="duration">${state.durationSeconds}s</output>
            </div>
          </div>

          <div class="toggle-row">
            <span>
              <strong>Narration</strong>
              <small>Generate voiceover script</small>
            </span>
            <label class="switch">
              <input id="narration" type="checkbox" ${state.includeNarration ? "checked" : ""} />
              <span></span>
            </label>
          </div>

          <button class="wide-action" type="button" id="regenerateButton" ${state.isGenerating ? "disabled" : ""}>
            ${state.isGenerating ? "Generating..." : "Generate storyboard"}
          </button>
        </aside>

        <section class="preview-stage" aria-labelledby="preview-title">
          <div class="stage-header">
            <div>
              <p class="section-kicker">Video preview</p>
              <h2 id="preview-title">${escapeHtml(state.lesson.title)}</h2>
            </div>
            <span class="status-pill ${state.errorMessage ? "is-error" : ""}" id="statusPill">${escapeHtml(statusLabel())}</span>
          </div>

          ${
            state.errorMessage
              ? `<p class="error-banner">${escapeHtml(state.errorMessage)}</p>`
              : ""
          }

          <div class="video-frame">
            ${
              state.lesson.videoUrl
                ? `<video class="template-video" src="${escapeHtml(state.lesson.videoUrl)}" controls autoplay muted playsinline loop></video>`
                : `<div class="orbital-lesson" aria-hidden="true">
                    <span class="symbol node-a">${escapeHtml(symbolA)}</span>
                    <span class="symbol node-b">${escapeHtml(symbolB)}</span>
                    <span class="symbol node-c">${escapeHtml(symbolC)}</span>
                    <span class="symbol node-d">${escapeHtml(symbolD)}</span>
                    <div class="orbit orbit-one"></div>
                    <div class="orbit orbit-two"></div>
                    <div class="formula-card">
                      <span>${state.visualMode}</span>
                      <strong>${escapeHtml(state.lesson.formula)}</strong>
                    </div>
                  </div>`
            }
          </div>

          ${
            state.lesson.intelligenceSource
              ? `<p class="source-note">Tutor script source: ${escapeHtml(state.lesson.intelligenceSource)}</p>`
              : ""
          }

          <div class="timeline" aria-label="Generated lesson timeline">
            ${renderTimeline(state.lesson.storyboard)}
          </div>
        </section>
      </section>
    </main>
  `;

  bindEvents();
};

const readForm = (): GenerateLessonRequest => {
  const conceptInput = document.querySelector<HTMLInputElement>("#conceptInput");

  return {
    concept: normalizeConcept(conceptInput?.value ?? state.concept),
    audience: state.audience,
    visualMode: state.visualMode,
    durationSeconds: state.durationSeconds,
    includeNarration: state.includeNarration,
  };
};

const submitLesson = async (nextConcept?: string): Promise<void> => {
  const payload = readForm();

  if (nextConcept) {
    payload.concept = nextConcept;
  }

  state.concept = payload.concept;
  state.isGenerating = true;
  state.errorMessage = "";
  render();

  try {
    const lesson = await generateLesson(payload);
    state.lesson = lesson;
  } catch (error) {
    state.errorMessage = error instanceof Error ? error.message : "Could not generate this lesson.";
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

  document.querySelector<HTMLButtonElement>("#regenerateButton")?.addEventListener("click", () => {
    void submitLesson();
  });

  document.querySelector<HTMLSelectElement>("#audience")?.addEventListener("change", (event) => {
    state.audience = (event.currentTarget as HTMLSelectElement).value as Audience;
  });

  document.querySelector<HTMLInputElement>("#duration")?.addEventListener("input", (event) => {
    state.durationSeconds = Number((event.currentTarget as HTMLInputElement).value);
    const output = document.querySelector<HTMLOutputElement>("#durationOutput");

    if (output) {
      output.textContent = `${state.durationSeconds}s`;
    }
  });

  document.querySelector<HTMLInputElement>("#narration")?.addEventListener("change", (event) => {
    state.includeNarration = (event.currentTarget as HTMLInputElement).checked;
  });

  document.querySelectorAll<HTMLButtonElement>("[data-prompt]").forEach((button) => {
    button.addEventListener("click", () => {
      const prompt = button.dataset.prompt ?? state.concept;
      state.concept = prompt;
      void submitLesson(prompt);
    });
  });

  document.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      state.visualMode = button.dataset.mode as VisualMode;
      render();
    });
  });
};

render();
