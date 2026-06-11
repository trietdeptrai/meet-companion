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

      if (url.endsWith("/api/v2/video-jobs")) {
        return jsonResponse(
          {
            job_id: "job-123",
            project_id: "project-123",
            status: "PENDING",
          },
          202,
        );
      }

      if (url.endsWith("/api/v2/video-jobs/job-123")) {
        return jsonResponse({
          job_id: "job-123",
          project_id: "project-123",
          title: "Tích phân",
          status: "COMPLETED",
          current_stage: "COMPLETED",
          progress: 100,
          config: {
            normalized_concept: "Giải thích tích phân là diện tích dưới đường cong",
          },
          intelligenceSource: "openai",
          video: {
            url: "/generated/job-123.mp4",
            durationSeconds: 10,
            mimeType: "video/mp4",
          },
          tutor: {
            opening: "Tích phân cộng rất nhiều mảnh diện tích nhỏ dưới một đường cong.",
            steps: [
              { atSeconds: 0, text: "Vẽ trục và một đường cong." },
              { atSeconds: 3, text: "Chia vùng dưới đường cong thành hình chữ nhật." },
              { atSeconds: 6, text: "Cộng các diện tích nhỏ để xấp xỉ tích phân." },
            ],
            followUpQuestion: "Nếu hình chữ nhật mỏng hơn thì xấp xỉ thay đổi ra sao?",
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
        concept: "Giải thích tích phân là diện tích dưới đường cong",
        durationSeconds: 10,
      },
      { pollIntervalMs: 0 },
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("/api/v2/video-jobs");
    expect(String(fetchMock.mock.calls[1]?.[0])).toBe("/api/v2/video-jobs/job-123");
    expect(lesson).toMatchObject({
      id: "job-123",
      status: "ready",
      title: "Tích phân",
      videoUrl: "/generated/job-123.mp4",
      intelligenceSource: "openai",
      progress: 100,
    });
    expect(lesson.storyboard).toHaveLength(5);
  });
});
