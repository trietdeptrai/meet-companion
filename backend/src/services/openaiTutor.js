import OpenAI from "openai";

const lessonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "opening",
    "steps",
    "followUpQuestion",
    "conceptAnalysis",
    "visualPlan",
    "storyboard",
    "sceneDsl",
  ],
  properties: {
    opening: {
      type: "string",
      description: "A short friendly first explanation in the requested language.",
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
          atSeconds: {
            type: "number",
            description: "Approximate second in the generated video for this caption.",
          },
          text: {
            type: "string",
            description: "Caption text aligned to the current visual step.",
          },
        },
      },
    },
    followUpQuestion: {
      type: "string",
      description: "One simple question the learner can answer after the video.",
    },
    conceptAnalysis: {
      type: "object",
      additionalProperties: false,
      required: [
        "concept_id",
        "domain",
        "subdomain",
        "prerequisites",
        "key_claims",
        "common_misconceptions",
        "best_explanation_modes",
      ],
      properties: {
        concept_id: { type: "string" },
        domain: { type: "string" },
        subdomain: { type: "string" },
        prerequisites: { type: "array", items: { type: "string" } },
        key_claims: { type: "array", items: { type: "string" } },
        common_misconceptions: { type: "array", items: { type: "string" } },
        best_explanation_modes: { type: "array", items: { type: "string" } },
      },
    },
    visualPlan: {
      type: "object",
      additionalProperties: false,
      required: ["selected_pattern_id", "visual_core", "visual_rules", "color_logic"],
      properties: {
        selected_pattern_id: { type: "string" },
        visual_core: { type: "string" },
        visual_rules: { type: "array", items: { type: "string" } },
        color_logic: {
          type: "object",
          additionalProperties: false,
          required: ["primary", "secondary", "highlight"],
          properties: {
            primary: { type: "string" },
            secondary: { type: "string" },
            highlight: { type: "string" },
          },
        },
      },
    },
    storyboard: {
      type: "object",
      additionalProperties: false,
      required: ["total_duration_sec", "scenes"],
      properties: {
        total_duration_sec: { type: "number" },
        scenes: {
          type: "array",
          minItems: 3,
          maxItems: 5,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["scene_id", "duration_sec", "learning_goal", "visual_goal", "objects", "animations", "camera", "labels"],
            properties: {
              scene_id: { type: "string" },
              duration_sec: { type: "number" },
              learning_goal: { type: "string" },
              visual_goal: { type: "string" },
              objects: { type: "array", items: { type: "string" } },
              animations: { type: "array", items: { type: "string" } },
              camera: { type: "string" },
              labels: { type: "array", items: { type: "string" } },
            },
          },
        },
      },
    },
    sceneDsl: {
      type: "object",
      additionalProperties: false,
      required: ["canvas", "scenes"],
      properties: {
        canvas: {
          type: "object",
          additionalProperties: false,
          required: ["background", "resolution", "style"],
          properties: {
            background: { type: "string" },
            resolution: { type: "string" },
            style: { type: "string" },
          },
        },
        scenes: {
          type: "array",
          minItems: 3,
          maxItems: 5,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["scene_id", "objects", "animations", "camera"],
            properties: {
              scene_id: { type: "string" },
              objects: {
                type: "array",
                minItems: 3,
                maxItems: 10,
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["id", "type", "params", "style"],
                  properties: {
                    id: { type: "string" },
                    type: {
                      type: "string",
                      enum: ["axis", "curve", "rectangle", "region", "dot", "line", "arrow", "label", "formula", "geometric_object"],
                    },
                    params: {
                      type: "object",
                      additionalProperties: false,
                      required: [
                        "x",
                        "y",
                        "width",
                        "height",
                        "x1",
                        "y1",
                        "x2",
                        "y2",
                        "orientation",
                        "text",
                        "points",
                      ],
                      properties: {
                        x: { type: "number" },
                        y: { type: "number" },
                        width: { type: "number" },
                        height: { type: "number" },
                        x1: { type: "number" },
                        y1: { type: "number" },
                        x2: { type: "number" },
                        y2: { type: "number" },
                        orientation: { type: "string" },
                        text: { type: "string" },
                        points: {
                          type: "array",
                          items: {
                            type: "object",
                            additionalProperties: false,
                            required: ["x", "y"],
                            properties: {
                              x: { type: "number" },
                              y: { type: "number" },
                            },
                          },
                        },
                      },
                    },
                    style: {
                      type: "object",
                      additionalProperties: false,
                      required: ["stroke", "fill", "opacity"],
                      properties: {
                        stroke: { type: "string" },
                        fill: { type: "string" },
                        opacity: { type: "number" },
                      },
                    },
                  },
                },
              },
              animations: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["type", "target", "duration"],
                  properties: {
                    type: { type: "string" },
                    target: { type: "string" },
                    duration: { type: "number" },
                  },
                },
              },
              camera: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["type", "duration"],
                  properties: {
                    type: { type: "string" },
                    duration: { type: "number" },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};

function buildInstructions() {
  return [
  [
  "You are a warm, cinematic AI visual tutor for a screen-shared classroom demo.",
  "Create a math explanation that feels like an elegant animated visual story, inspired by high-quality geometric math videos.",
  "The video should have a clean 3Blue1Brown-like visual language: dark matte background, glowing geometric shapes, smooth camera movement, crisp labels, elegant formulas, and satisfying transformations.",
  "Use simple mathematical objects: triangles, squares, circles, arrows, braces, grids, number lines, and color-coded regions.",
  "Build the idea visually before introducing the formula.",
  "Animate one concept at a time. Avoid clutter. Every movement should reveal a mathematical insight.",
  "Use smooth morphing, fading, sliding, highlighting, and area transformations to make the concept feel intuitive.",
  "Use rich but restrained colors: deep blues, purples, cyan, orange, yellow, and white text on a dark background.",
  "Make formulas appear progressively, as if they are being discovered rather than dumped on screen.",
  "Narrate the animation with short teaching beats that match the visual timing.",
  "Use phrases like 'notice...', 'watch what happens...', 'the key idea is...', and 'that is why...'.",
  "Do not claim that a new video, animation, or scene is being rendered live unless the system actually renders it live.",
  "Use the learner's language when possible.",
  "Keep the explanation compact enough to fit beside the video: 3–5 concise teaching beats.",
  "End with a memorable one-sentence takeaway or a tiny check-for-understanding question."
]
  ].join(" ");
}

function buildInput({ prompt, language, requestContext, template }) {
  const context = requestContext ?? template ?? {};
  return [
    `Learner request: ${prompt}`,
    `Language: ${language}`,
    `Concept id: ${context.id ?? "visual-math-concept"}`,
    "Return a complete structured plan for a 10-second visual explanation.",
    "Do not choose visuals from keyword or concept templates. Analyze the concept and create sceneDsl objects that fit the concept's own structure.",
    "The local renderer can draw these generic object types: axis, curve, rectangle, region, dot, line, arrow, label, formula, geometric_object.",
    "Use normalized coordinates from 0 to 1 for params x, y, width, height, x1, y1, x2, y2, and curve points.",
    "Every object params must include x, y, width, height, x1, y1, x2, y2, orientation, text, and points. Put 0, an empty string, or an empty array for unused fields.",
    "Every object style must include stroke, fill, and opacity. Use simple color names: cyan, yellow, green, orange, white, muted, blue, red.",
    "For any concept, choose objects because they explain the concept itself. Examples: an accumulation concept may use axes, a curve, rectangles, or regions; a rate-of-change concept may use a curve plus a tangent/secant line; a probability concept may use regions or branching.",
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
    typeof parsed.followUpQuestion !== "string"
  ) {
    throw new Error("OpenAI response did not match the tutor lesson schema.");
  }

  return {
    opening: parsed.opening,
    steps: parsed.steps.map((step) => ({
      atSeconds: Number(step.atSeconds),
      text: String(step.text),
    })),
    followUpQuestion: parsed.followUpQuestion,
    conceptAnalysis: parsed.conceptAnalysis,
    visualPlan: parsed.visualPlan,
    storyboard: parsed.storyboard,
    sceneDsl: parsed.sceneDsl,
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
    async generateLesson({ prompt, language, template, requestContext }) {
      const response = await openai.responses.create({
        model,
        instructions: buildInstructions(),
        input: buildInput({ prompt, language, template, requestContext }),
        text: {
          format: {
            type: "json_schema",
            name: "visual_tutor_lesson",
            strict: true,
            schema: lessonSchema,
          },
        },
      });

      return parseLesson(response);
    },
  };
}
