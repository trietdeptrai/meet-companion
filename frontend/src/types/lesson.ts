export type Audience = "Beginner" | "High school" | "University" | "Professional";

export type VisualMode = "Symbols" | "Graph" | "Story";

export type LessonStatus = "queued" | "generating" | "ready" | "failed";

export type GenerateLessonRequest = {
  concept: string;
  audience: Audience;
  visualMode: VisualMode;
  durationSeconds: number;
  includeNarration: boolean;
};

export type StoryboardStep = {
  index: number;
  title: string;
  description: string;
};

export type LessonPreview = {
  id: string;
  title: string;
  status: LessonStatus;
  formula: string;
  symbols: string[];
  storyboard: StoryboardStep[];
  videoUrl?: string;
  intelligenceSource?: "openai" | "template-fallback";
};

export type ApiErrorResponse = {
  error?: {
    code?: string;
    message?: string;
  };
  message?: string;
  detail?: string;
};
