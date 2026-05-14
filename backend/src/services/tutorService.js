import { randomUUID } from "node:crypto";
import { findTemplateForPrompt } from "../templates.js";

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function detectLanguage(prompt) {
  const normalized = prompt.toLowerCase();
  if (
    /[ăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/i.test(
      normalized,
    ) ||
    normalized.includes("giai thich") ||
    normalized.includes("giải thích")
  ) {
    return "vi";
  }
  return "en";
}

function fallbackLesson(template, language) {
  return template.fallbackLessons[language] ?? template.fallbackLessons.en;
}

function normalizeLesson(lesson, template, language) {
  const fallback = fallbackLesson(template, language);

  return {
    opening: lesson?.opening || fallback.opening,
    steps:
      Array.isArray(lesson?.steps) && lesson.steps.length > 0
        ? lesson.steps.map((step, index) => ({
            atSeconds:
              Number.isFinite(Number(step.atSeconds))
                ? Number(step.atSeconds)
                : template.captionTimings[index] ?? 0,
            text: String(step.text || fallback.steps[index]?.text || ""),
          }))
        : fallback.steps,
    followUpQuestion: lesson?.followUpQuestion || fallback.followUpQuestion,
  };
}

export function createTutorService({ generateLesson, hasOpenAIKey }) {
  return {
    async explain({ prompt, language }) {
      if (typeof prompt !== "string" || prompt.trim().length === 0) {
        throw new ApiError(
          400,
          "PROMPT_REQUIRED",
          "Please provide a concept prompt to explain.",
        );
      }

      const cleanPrompt = prompt.trim();
      const template = findTemplateForPrompt(cleanPrompt);
      if (!template) {
        throw new ApiError(422, "UNSUPPORTED_CONCEPT", "No video template matches this prompt.", {
          supportedTemplates: ["pythagorean-theorem"],
        });
      }

      const resolvedLanguage = language || detectLanguage(cleanPrompt);
      let lesson;
      let intelligenceSource = "template-fallback";
      let warning;

      if (hasOpenAIKey() && generateLesson) {
        try {
          lesson = await generateLesson({
            prompt: cleanPrompt,
            language: resolvedLanguage,
            template,
          });
          intelligenceSource = "openai";
        } catch (error) {
          warning = "OpenAI tutor generation failed, so the backend used the local demo script.";
        }
      }

      const tutor = normalizeLesson(lesson, template, resolvedLanguage);

      return {
        requestId: randomUUID(),
        status: "ready",
        prompt: cleanPrompt,
        language: resolvedLanguage,
        concept: template.id,
        title: template.title,
        intelligenceSource,
        warning,
        video: template.video,
        tutor,
        storyboard: template.storyboard.map((text, index) => ({
          order: index + 1,
          atSeconds: template.captionTimings[index] ?? 0,
          text,
        })),
      };
    },
  };
}
