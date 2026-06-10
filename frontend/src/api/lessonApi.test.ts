import { afterEach, describe, expect, test, vi } from "vitest";
import { generateLesson } from "./lessonApi";

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });

describe("generateLesson", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("creates and polls a backend video job instead of using the legacy sync endpoint", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith("/api/v1/video-jobs")) {
        return jsonResponse(
          {
            job_id: "job-123",
            project_id: "project-123",
            status: "PENDING",
          },
          202,
        );
      }

      if (url.endsWith("/api/v1/video-jobs/job-123")) {
        return jsonResponse({
          job_id: "job-123",
          project_id: "project-123",
          title: "Hệ tọa độ Decartes",
          status: "COMPLETED",
          current_stage: "COMPLETED",
          progress: 100,
          config: {
            normalized_concept: "Giải thích hệ tọa độ Decartes",
          },
          intelligenceSource: "openai",
          video: {
            url: "/generated/job-123.mp4",
            durationSeconds: 10,
            mimeType: "video/mp4",
          },
          tutor: {
            opening: "Hệ tọa độ là hai trục vuông góc dùng để định vị điểm.",
            steps: [
              { atSeconds: 0, text: "Vẽ trục ngang x." },
              { atSeconds: 3, text: "Vẽ trục dọc y." },
              { atSeconds: 6, text: "Đọc điểm bằng cặp số có thứ tự." },
            ],
            followUpQuestion: "Trong điểm (2, 3), số 2 cho biết điều gì?",
          },
          artifacts: [
            {
              artifact_type: "video_mp4",
              url: "/generated/job-123.mp4",
              mime_type: "video/mp4",
            },
          ],
        });
      }

      throw new Error(`Unexpected fetch URL: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    const lesson = await generateLesson(
      {
        concept: "Giải thích hệ tọa độ Decartes",
        durationSeconds: 10,
      },
      { pollIntervalMs: 0 },
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("/api/v1/video-jobs");
    expect(String(fetchMock.mock.calls[1]?.[0])).toBe("/api/v1/video-jobs/job-123");
    expect(lesson).toMatchObject({
      id: "job-123",
      status: "ready",
      title: "Hệ tọa độ Decartes",
      videoUrl: "/generated/job-123.mp4",
      intelligenceSource: "openai",
      progress: 100,
    });
    expect(lesson.storyboard).toHaveLength(5);
  });
});
