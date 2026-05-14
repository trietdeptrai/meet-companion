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
    "You are a warm visual tutor for a screen-shared classroom demo.",
    "Create a concise explanation that matches the provided pre-rendered visual template.",
    "Do not claim a new video is being rendered live.",
    "Use the learner's language when possible.",
    "Keep the response short enough to fit beside a video.",
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
