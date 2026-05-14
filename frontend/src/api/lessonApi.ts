import { config } from "../config";
import type {
  ApiErrorResponse,
  GenerateLessonRequest,
  LessonPreview,
  StoryboardStep,
} from "../types/lesson";

type BackendTutorStep = {
  atSeconds: number;
  text: string;
};

type BackendTutorResponse = {
  requestId: string;
  status: "ready";
  prompt: string;
  language: string;
  concept: string;
  title: string;
  intelligenceSource: "openai" | "template-fallback";
  video: {
    url: string;
    durationSeconds: number;
    mimeType: string;
  };
  tutor: {
    opening: string;
    steps: BackendTutorStep[];
    followUpQuestion: string;
  };
};

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
    return (
      body.error?.message ??
      body.message ??
      body.detail ??
      `Backend request failed with ${response.status}`
    );
  } catch {
    return `Backend request failed with ${response.status}`;
  }
};

const absoluteAssetUrl = (url: string): string => {
  if (/^https?:\/\//.test(url)) {
    return url;
  }

  return `${config.apiBaseUrl}${url}`;
};

const mapTutorResponse = (response: BackendTutorResponse): LessonPreview => ({
  id: response.requestId,
  title: response.title,
  status: response.status,
  formula: response.concept === "pythagorean-theorem" ? "a² + b² = c²" : "idea -> video",
  symbols: response.concept === "pythagorean-theorem" ? ["a", "b", "c", "c²"] : ["A", "B", "C", "?"],
  storyboard: [
    {
      index: 1,
      title: "Tutor opening",
      description: response.tutor.opening,
    },
    ...response.tutor.steps.map((step, index) => ({
      index: index + 2,
      title: `${Math.round(step.atSeconds)}s visual beat`,
      description: step.text,
    })),
    {
      index: response.tutor.steps.length + 2,
      title: "Follow-up question",
      description: response.tutor.followUpQuestion,
    },
  ],
  videoUrl: absoluteAssetUrl(response.video.url),
  intelligenceSource: response.intelligenceSource,
});

export const generateLesson = async (
  payload: GenerateLessonRequest,
): Promise<LessonPreview> => {
  if (config.useMockApi) {
    return createMockLesson(payload);
  }

  const response = await fetch(`${config.apiBaseUrl}/api/tutor/explain`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: payload.concept,
    }),
  });

  if (!response.ok) {
    throw new LessonApiError(await parseError(response), response.status);
  }

  return mapTutorResponse((await response.json()) as BackendTutorResponse);
};
