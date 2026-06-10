import { config } from "../config";
import type {
  ApiErrorResponse,
  GenerateLessonRequest,
  LessonPreview,
  StoryboardStep,
  VideoJobSnapshot,
} from "../types/lesson";

type CreateVideoJobResponse = {
  job_id: string;
  project_id: string;
  status: "PENDING";
};

type GenerateLessonOptions = {
  pollIntervalMs?: number;
  maxPolls?: number;
  onJobUpdate?: (job: VideoJobSnapshot) => void;
};

const terminalStatuses = new Set([
  "COMPLETED",
  "FAILED_INPUT_UNSAFE",
  "FAILED_PLANNING",
  "FAILED_RENDER",
  "FAILED_POSTPROCESS",
]);

export class LessonApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "LessonApiError";
  }
}

const parseError = async (response: Response): Promise<{ code?: string; message: string }> => {
  try {
    const body = (await response.json()) as ApiErrorResponse;
    return {
      code: body.error?.code,
      message:
        body.error?.message ??
        body.message ??
        body.detail ??
        `Backend request failed with ${response.status}`,
    };
  } catch {
    return {
      message: `Backend request failed with ${response.status}`,
    };
  }
};

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    globalThis.setTimeout(resolve, ms);
  });

const absoluteAssetUrl = (url: string): string => {
  if (/^https?:\/\//.test(url)) {
    return url;
  }

  return `${config.apiBaseUrl}${url}`;
};

const normalizeStageTitle = (stage?: string): string => {
  if (!stage) return "Backend job";
  return stage
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const videoUrlFromJob = (job: VideoJobSnapshot): string | undefined => {
  const directUrl = job.video?.url;
  if (directUrl) return absoluteAssetUrl(directUrl);

  const videoArtifact = job.artifacts?.find((artifact) => artifact.artifact_type === "video_mp4");
  if (videoArtifact?.url) return absoluteAssetUrl(videoArtifact.url);
  if (videoArtifact?.storage_key?.startsWith("/")) return absoluteAssetUrl(videoArtifact.storage_key);
  return undefined;
};

const storyboardFromJob = (job: VideoJobSnapshot): StoryboardStep[] => {
  const steps: StoryboardStep[] = [];

  if (job.tutor?.opening) {
    steps.push({
      index: steps.length + 1,
      title: "Tutor opening",
      description: job.tutor.opening,
    });
  }

  for (const step of job.tutor?.steps ?? []) {
    steps.push({
      index: steps.length + 1,
      title: `${Math.round(step.atSeconds)}s visual beat`,
      description: step.text,
    });
  }

  if (job.tutor?.followUpQuestion) {
    steps.push({
      index: steps.length + 1,
      title: "Follow-up question",
      description: job.tutor.followUpQuestion,
    });
  }

  return steps;
};

const lessonFromCompletedJob = (job: VideoJobSnapshot): LessonPreview => ({
  id: job.job_id,
  projectId: job.project_id,
  title: job.title ?? job.config?.normalized_concept ?? "Generated lesson",
  status: "ready",
  progress: job.progress ?? 100,
  currentStage: job.current_stage,
  storyboard: storyboardFromJob(job),
  videoUrl: videoUrlFromJob(job),
  intelligenceSource: job.intelligenceSource,
});

const assertCompletedJob = (job: VideoJobSnapshot): void => {
  if (job.status === "COMPLETED") return;

  if (job.status.startsWith("FAILED_")) {
    throw new LessonApiError(
      job.error_message ?? "Backend video job failed.",
      undefined,
      job.error_code ?? job.status,
    );
  }

  throw new LessonApiError("Backend video job did not complete before the polling timeout.");
};

const createVideoJob = async (payload: GenerateLessonRequest): Promise<CreateVideoJobResponse> => {
  const response = await fetch(`${config.apiBaseUrl}/api/v1/video-jobs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      concept: payload.concept,
      duration_sec: Math.min(Math.max(payload.durationSeconds ?? 10, 5), 10),
      language: payload.language,
      voiceover: false,
      style: "visual_proof",
      level: "beginner",
    }),
  });

  if (!response.ok) {
    const error = await parseError(response);
    throw new LessonApiError(error.message, response.status, error.code);
  }

  return (await response.json()) as CreateVideoJobResponse;
};

const fetchVideoJob = async (jobId: string): Promise<VideoJobSnapshot> => {
  const response = await fetch(`${config.apiBaseUrl}/api/v1/video-jobs/${jobId}`);

  if (!response.ok) {
    const error = await parseError(response);
    throw new LessonApiError(error.message, response.status, error.code);
  }

  return (await response.json()) as VideoJobSnapshot;
};

export const generateLesson = async (
  payload: GenerateLessonRequest,
  options: GenerateLessonOptions = {},
): Promise<LessonPreview> => {
  const created = await createVideoJob(payload);
  let latestJob: VideoJobSnapshot = {
    job_id: created.job_id,
    project_id: created.project_id,
    status: created.status,
    current_stage: "PENDING",
    progress: 0,
  };
  options.onJobUpdate?.(latestJob);

  const pollIntervalMs = options.pollIntervalMs ?? 800;
  const maxPolls = options.maxPolls ?? 120;

  for (let attempt = 0; attempt < maxPolls; attempt += 1) {
    if (pollIntervalMs > 0 || attempt > 0) {
      await delay(pollIntervalMs);
    }

    latestJob = await fetchVideoJob(created.job_id);
    options.onJobUpdate?.(latestJob);

    if (terminalStatuses.has(latestJob.status)) {
      assertCompletedJob(latestJob);
      return lessonFromCompletedJob(latestJob);
    }
  }

  throw new LessonApiError(
    `${normalizeStageTitle(latestJob.current_stage)} is still running. Try again in a moment.`,
    undefined,
    "JOB_POLL_TIMEOUT",
  );
};
