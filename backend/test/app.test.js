import request from "supertest";
import { describe, expect, test, vi } from "vitest";
import { createApp } from "../src/app.js";

describe("Visual Tutor backend", () => {
  test("GET /health exposes service status and configured templates", async () => {
    const app = createApp({ hasOpenAIKey: () => false });

    const response = await request(app).get("/health").expect(200);

    expect(response.body).toMatchObject({
      status: "ok",
      openaiConfigured: false,
    });
    expect(response.body.templates).toContain("pythagorean-theorem");
  });

  test("POST /api/tutor/explain rejects an empty prompt", async () => {
    const app = createApp({ hasOpenAIKey: () => false });

    const response = await request(app)
      .post("/api/tutor/explain")
      .send({ prompt: "   " })
      .expect(400);

    expect(response.body.error.code).toBe("PROMPT_REQUIRED");
  });

  test("POST /api/tutor/explain returns an instant Pythagorean template video and tutor script", async () => {
    const generateLesson = vi.fn(async () => ({
      opening:
        "Ta nhin mot tam giac vuong: hai canh ngan tao nen dien tich bang canh dai.",
      steps: [
        { atSeconds: 0, text: "Ve tam giac vuong va dat ten cac canh a, b, c." },
        { atSeconds: 5, text: "Dung mot hinh vuong tren moi canh." },
        { atSeconds: 11, text: "Dien tich hai hinh vuong nho ghep thanh hinh vuong lon." },
      ],
      followUpQuestion: "Neu a = 3 va b = 4 thi c bang bao nhieu?",
    }));
    const app = createApp({
      generateLesson,
      hasOpenAIKey: () => true,
    });

    const response = await request(app)
      .post("/api/tutor/explain")
      .send({ prompt: "Giải thích định lý Pytagore" })
      .expect(200);

    expect(generateLesson).toHaveBeenCalledOnce();
    expect(response.body).toMatchObject({
      concept: "pythagorean-theorem",
      status: "ready",
      intelligenceSource: "openai",
      video: {
        templateId: "pythagorean-theorem",
        mimeType: "video/mp4",
      },
      tutor: {
        followUpQuestion: "Neu a = 3 va b = 4 thi c bang bao nhieu?",
      },
    });
    expect(response.body.video.url).toBe("/videos/pythagorean-theorem.mp4");
    expect(response.body.tutor.steps).toHaveLength(3);
  });

  test("GET template video URL serves the pre-rendered video asset", async () => {
    const app = createApp({ hasOpenAIKey: () => false });

    const response = await request(app)
      .get("/videos/pythagorean-theorem.mp4")
      .expect(200);

    expect(response.headers["content-type"]).toContain("video/mp4");
  });
});
