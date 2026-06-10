export type LessonStatus = "idle" | "queued" | "generating" | "ready" | "failed";

export type GenerateLessonRequest = {
  concept: string;
  durationSeconds?: number;
  language?: string;
};

export type StoryboardStep = {
  index: number;
  title: string;
  description: string;
};

export type LessonPreview = {
  id: string;
  projectId?: string;
  title: string;
  status: LessonStatus;
  progress: number;
  currentStage?: string;
  storyboard: StoryboardStep[];
  videoUrl?: string;
  intelligenceSource?: "openai";
  errorCode?: string;
  errorMessage?: string;
};

export type VideoJobSnapshot = {
  job_id: string;
  project_id: string;
  status: string;
  current_stage?: string;
  progress?: number;
  message?: string;
  title?: string;
  config?: {
    normalized_concept?: string;
  };
  intelligenceSource?: "openai";
  video?: {
    url?: string;
    durationSeconds?: number;
    mimeType?: string;
  };
  tutor?: {
    opening?: string;
    steps?: Array<{
      atSeconds: number;
      text: string;
    }>;
    followUpQuestion?: string;
  };
  artifacts?: Array<{
    artifact_type: string;
    url?: string;
    storage_key?: string;
    mime_type?: string;
  }>;
  error_code?: string;
  error_message?: string;
};

export type ApiErrorResponse = {
  error?: {
    code?: string;
    message?: string;
  };
  message?: string;
  detail?: string;
};
