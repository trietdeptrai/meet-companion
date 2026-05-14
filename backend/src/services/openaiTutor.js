import OpenAI from "openai";

const lessonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["opening", "steps", "followUpQuestion"],
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
            description: "Approximate second in the template video for this caption.",
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

function buildInput({ prompt, language, template }) {
  return [
    `Learner request: ${prompt}`,
    `Language: ${language}`,
    `Template: ${template.title} (${template.id})`,
    "Template storyboard:",
    ...template.storyboard.map((step, index) => `${index + 1}. ${step}`),
    "Return only the structured tutor script.",
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
    async generateLesson({ prompt, language, template }) {
      const response = await openai.responses.create({
        model,
        instructions: buildInstructions(),
        input: buildInput({ prompt, language, template }),
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
