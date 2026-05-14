import { config } from "../config";
import type {
  ApiErrorResponse,
  GenerateLessonRequest,
  LessonPreview,
  StoryboardStep,
} from "../types/lesson";

const defaultStoryboard: StoryboardStep[] = [
  {
    index: 1,
    title: "Introduce symbols",
    description: "Define the core variables as visual tokens before any formula appears.",
  },
  {
    index: 2,
    title: "Animate relationship",
    description: "Move each token through the rule so the learner sees cause and effect.",
  },
  {
    index: 3,
    title: "Check understanding",
    description: "Pause on a small prediction task before the final summary.",
  },
];

export class LessonApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "LessonApiError";
  }
}

const createMockLesson = async (payload: GenerateLessonRequest): Promise<LessonPreview> => {
  await new Promise((resolve) => {
    window.setTimeout(resolve, 650);
  });

  return {
    id: `mock-${Date.now()}`,
    title: `${payload.concept} in motion`,
    status: "ready",
    formula: getFormula(payload.concept),
    symbols: getSymbols(payload.concept),
    storyboard: defaultStoryboard,
  };
};

const getFormula = (concept: string): string => {
  const lower = concept.toLowerCase();

  if (lower.includes("bayes")) {
    return "P(A|B) = P(B|A)P(A) / P(B)";
  }

  if (lower.includes("interest")) {
    return "A = P(1 + r/n)^(nt)";
  }

  if (lower.includes("neural")) {
    return "y = sigma(Wx + b)";
  }

  return "idea -> symbols -> motion -> insight";
};

const getSymbols = (concept: string): string[] => {
  const lower = concept.toLowerCase();

  if (lower.includes("bayes")) {
    return ["P(A)", "P(B)", "P(A|B)", "?"];
  }

  if (lower.includes("interest")) {
    return ["P", "r", "t", "A"];
  }

  if (lower.includes("neural")) {
    return ["x", "W", "b", "y"];
  }

  return ["A", "B", "C", "?"];
};

const parseError = async (response: Response): Promise<string> => {
  try {
    const body = (await response.json()) as ApiErrorResponse;
    return body.message ?? body.detail ?? `Backend request failed with ${response.status}`;
  } catch {
    return `Backend request failed with ${response.status}`;
  }
};

export const generateLesson = async (
  payload: GenerateLessonRequest,
): Promise<LessonPreview> => {
  if (config.useMockApi || !config.apiBaseUrl) {
    return createMockLesson(payload);
  }

  const response = await fetch(`${config.apiBaseUrl}/lessons`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new LessonApiError(await parseError(response), response.status);
  }

  return (await response.json()) as LessonPreview;
};
