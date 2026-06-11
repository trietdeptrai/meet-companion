import OpenAI from "openai";
import { listMotionComponents } from "./motionComponents.js";

const componentIds = listMotionComponents().map((entry) => entry.component_id);

const scoreSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "treatment_id",
    "concept_accuracy_score",
    "visual_clarity_score",
    "component_availability_score",
    "animation_beauty_score",
    "pacing_score",
    "feasibility_score",
    "complexity_penalty",
    "cognitive_load_penalty",
    "final_score",
  ],
  properties: {
    treatment_id: { type: "string" },
    concept_accuracy_score: { type: "number" },
    visual_clarity_score: { type: "number" },
    component_availability_score: { type: "number" },
    animation_beauty_score: { type: "number" },
    pacing_score: { type: "number" },
    feasibility_score: { type: "number" },
    complexity_penalty: { type: "number" },
    cognitive_load_penalty: { type: "number" },
    final_score: { type: "number" },
  },
};

const lessonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "opening",
    "steps",
    "followUpQuestion",
    "conceptUnderstanding",
    "knowledgeDecomposition",
    "creativeTreatments",
    "treatmentRanking",
    "creativeBrief",
    "storyboard",
    "componentGraph",
  ],
  properties: {
    opening: {
      type: "string",
      description: "A short warm first explanation in the requested language.",
    },
    steps: {
      type: "array",
      minItems: 3,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["atSeconds", "text"],
        properties: {
          atSeconds: { type: "number" },
          text: { type: "string" },
        },
      },
    },
    followUpQuestion: {
      type: "string",
      description: "One simple check-for-understanding question.",
    },
    conceptUnderstanding: {
      type: "object",
      additionalProperties: false,
      required: [
        "concept_id",
        "domain",
        "subdomain",
        "learning_objective",
        "prerequisites",
        "key_ideas",
        "misconceptions",
        "visual_affordances",
      ],
      properties: {
        concept_id: { type: "string" },
        domain: { type: "string" },
        subdomain: { type: "string" },
        learning_objective: { type: "string" },
        prerequisites: { type: "array", items: { type: "string" } },
        key_ideas: { type: "array", items: { type: "string" } },
        misconceptions: { type: "array", items: { type: "string" } },
        visual_affordances: { type: "array", items: { type: "string" } },
      },
    },
    knowledgeDecomposition: {
      type: "object",
      additionalProperties: false,
      required: ["atoms"],
      properties: {
        atoms: {
          type: "array",
          minItems: 3,
          maxItems: 6,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["id", "idea", "visual_need"],
            properties: {
              id: { type: "string" },
              idea: { type: "string" },
              visual_need: { type: "string" },
            },
          },
        },
      },
    },
    creativeTreatments: {
      type: "object",
      additionalProperties: false,
      required: ["concept", "treatments"],
      properties: {
        concept: { type: "string" },
        treatments: {
          type: "array",
          minItems: 2,
          maxItems: 5,
          items: {
            type: "object",
            additionalProperties: false,
            required: [
              "treatment_id",
              "title",
              "one_liner",
              "visual_hook",
              "components",
              "estimated_quality",
              "estimated_feasibility",
              "style_notes",
            ],
            properties: {
              treatment_id: { type: "string" },
              title: { type: "string" },
              one_liner: { type: "string" },
              visual_hook: { type: "string" },
              components: { type: "array", items: { type: "string", enum: componentIds } },
              estimated_quality: { type: "number" },
              estimated_feasibility: { type: "number" },
              style_notes: { type: "array", items: { type: "string" } },
            },
          },
        },
      },
    },
    treatmentRanking: {
      type: "object",
      additionalProperties: false,
      required: ["selected_treatment_id", "reason", "rejected_treatments", "scores"],
      properties: {
        selected_treatment_id: { type: "string" },
        reason: { type: "string" },
        rejected_treatments: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["id", "reason"],
            properties: {
              id: { type: "string" },
              reason: { type: "string" },
            },
          },
        },
        scores: {
          type: "array",
          minItems: 1,
          maxItems: 5,
          items: scoreSchema,
        },
      },
    },
    creativeBrief: {
      type: "object",
      additionalProperties: false,
      required: [
        "tone",
        "visual_style",
        "density",
        "camera_style",
        "color_strategy",
        "motion_rules",
      ],
      properties: {
        tone: { type: "string" },
        visual_style: { type: "string" },
        density: { type: "string" },
        camera_style: { type: "string" },
        color_strategy: {
          type: "object",
          additionalProperties: false,
          required: ["background", "primary_math", "secondary_highlight", "inactive_objects"],
          properties: {
            background: { type: "string" },
            primary_math: { type: "string" },
            secondary_highlight: { type: "string" },
            inactive_objects: { type: "string" },
          },
        },
        motion_rules: { type: "array", items: { type: "string" } },
      },
    },
    storyboard: {
      type: "object",
      additionalProperties: false,
      required: ["title", "duration_sec", "shots"],
      properties: {
        title: { type: "string" },
        duration_sec: { type: "number" },
        shots: {
          type: "array",
          minItems: 3,
          maxItems: 6,
          items: {
            type: "object",
            additionalProperties: false,
            required: [
              "shot_id",
              "duration_sec",
              "visual_goal",
              "main_component",
              "camera",
              "text_policy",
              "narration",
            ],
            properties: {
              shot_id: { type: "string" },
              duration_sec: { type: "number" },
              visual_goal: { type: "string" },
              main_component: { type: "string", enum: componentIds },
              camera: { type: "string" },
              text_policy: { type: "string" },
              narration: { type: "string" },
            },
          },
        },
      },
    },
    componentGraph: {
      type: "object",
      additionalProperties: false,
      required: ["graph_id", "nodes", "edges"],
      properties: {
        graph_id: { type: "string" },
        nodes: {
          type: "array",
          minItems: 3,
          maxItems: 6,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["id", "shot_id", "component", "props", "style", "narration"],
            properties: {
              id: { type: "string" },
              shot_id: { type: "string" },
              component: { type: "string", enum: componentIds },
              props: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["key", "value"],
                  properties: {
                    key: { type: "string" },
                    value: { type: "string" },
                  },
                },
              },
              style: {
                type: "object",
                additionalProperties: false,
                required: ["theme", "highlight_color_token"],
                properties: {
                  theme: { type: "string" },
                  highlight_color_token: { type: "string" },
                },
              },
              narration: { type: "string" },
            },
          },
        },
        edges: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["from", "to", "relation"],
            properties: {
              from: { type: "string" },
              to: { type: "string" },
              relation: { type: "string" },
            },
          },
        },
      },
    },
  },
};

function buildInstructions() {
  return [
    "You are the director and instructional designer for a cinematic AI visual tutor.",
    "Create a product-grade v2 director plan, not renderer code.",
    "The LLM chooses the explanation strategy, treatment, storyboard, and motion component graph.",
    "The backend renderer owns pixels, layout, object spacing, camera interpolation, and visual QA.",
    "Generate multiple creative treatments before choosing one.",
    "Use a clean 3Blue1Brown-like mathematical style when appropriate: dark background, soft cyan/yellow highlights, smooth reveals, and low text density.",
    "Build intuition first, then formula or abstraction.",
    "Use the learner's language for opening, captions, narration, and follow-up.",
    "Do not generate Manim code, FFmpeg filters, low-level coordinates, or sceneDsl.",
  ].join(" ");
}

function buildInput({ prompt, language, requestContext, qualityMode, stylePreset }) {
  const context = requestContext ?? {};
  const components = listMotionComponents()
    .map((entry) => `${entry.component_id}(${entry.supported_domains.join("/")})`)
    .join(", ");

  return [
    `Learner request: ${prompt}`,
    `Language: ${language}`,
    `Concept id: ${context.id ?? "visual-concept"}`,
    `Target duration seconds: ${context.duration_sec ?? 10}`,
    `Quality mode: ${qualityMode ?? context.quality_mode ?? "balanced"}`,
    `Style preset: ${stylePreset ?? context.style ?? "clean_dark_explainer"}`,
    "Return a complete PRD v2 director plan for a 10-second local explainer video.",
    "Do not generate low-level pixel motion, renderer code, Manim code, FFmpeg filters, or sceneDsl.",
    "Use componentGraph nodes that reference available motion component IDs.",
    "For math concepts, prefer precise native components such as GraphPlot, GraphLocalZoom, TangentReveal, SlopeTriangle, RiemannRectangles, MovingPoint, FormulaReveal, and VisualRecap.",
    "Do not choose GenericDiagram when a native math or science component can carry the shot. GenericDiagram is a last-resort fallback for unsupported visual structures.",
    "Component props must be key/value string pairs because the backend validates and compiles them.",
    "Available motion components:",
    components,
    "If a concept is new, pick the closest component vocabulary by visual affordance, then use GenericDiagram only as a dignified fallback.",
    "The explanation should feel visual and polished, not like a list of definitions.",
  ].join("\n");
}

function extractOutputText(response) {
  if (typeof response.output_text === "string") {
    return response.output_text;
  }

  for (const item of response.output ?? []) {
    if (item.type !== "message") continue;
    for (const content of item.content ?? []) {
      if (content.type === "output_text" && typeof content.text === "string") {
        return content.text;
      }
    }
  }

  throw new Error("OpenAI response did not include output text.");
}

function parseLesson(response) {
  const text = extractOutputText(response);
  const parsed = JSON.parse(text);

  if (
    typeof parsed.opening !== "string" ||
    !Array.isArray(parsed.steps) ||
    typeof parsed.followUpQuestion !== "string" ||
    !parsed.componentGraph
  ) {
    throw new Error("OpenAI response did not match the v2 director plan schema.");
  }

  return {
    opening: parsed.opening,
    steps: parsed.steps.map((step) => ({
      atSeconds: Number(step.atSeconds),
      text: String(step.text),
    })),
    followUpQuestion: parsed.followUpQuestion,
    conceptUnderstanding: parsed.conceptUnderstanding,
    knowledgeDecomposition: parsed.knowledgeDecomposition,
    creativeTreatments: parsed.creativeTreatments,
    treatmentRanking: parsed.treatmentRanking,
    creativeBrief: parsed.creativeBrief,
    storyboard: parsed.storyboard,
    componentGraph: parsed.componentGraph,
  };
}

export function createOpenAITutor({
  apiKey = process.env.OPENAI_API_KEY,
  client,
  model = process.env.OPENAI_MODEL || "gpt-5.4-mini",
} = {}) {
  if (!client && !apiKey) {
    throw new Error("OPENAI_API_KEY is required to create the OpenAI tutor.");
  }

  const openai = client ?? new OpenAI({ apiKey });

  return {
    async generateLesson({
      prompt,
      language,
      requestContext,
      qualityMode,
      stylePreset,
    }) {
      const response = await openai.responses.create({
        model,
        instructions: buildInstructions(),
        input: buildInput({ prompt, language, requestContext, qualityMode, stylePreset }),
        text: {
          format: {
            type: "json_schema",
            name: "visual_explain_v2_director_plan",
            strict: true,
            schema: lessonSchema,
          },
        },
      });

      return parseLesson(response);
    },
  };
}
