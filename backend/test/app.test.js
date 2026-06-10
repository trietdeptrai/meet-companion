import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
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
    expect(response.body.templates).toContain("dynamic-prompt-video");
  });

  test("POST /api/tutor/explain rejects an empty prompt", async () => {
    const app = createApp({ hasOpenAIKey: () => false });

    const response = await request(app)
      .post("/api/tutor/explain")
      .send({ prompt: "   " })
      .expect(400);

    expect(response.body.error.code).toBe("PROMPT_REQUIRED");
  });

  test("POST /api/tutor/explain generates a per-request Pythagorean video and tutor script", async () => {
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
    const generateVideo = vi.fn(async ({ requestId }) => ({
      templateId: "pythagorean-theorem",
      url: `/generated/${requestId}.mp4`,
      mimeType: "video/mp4",
      durationSeconds: 10,
      generated: true,
    }));
    const app = createApp({
      generateLesson,
      generateVideo,
      hasOpenAIKey: () => true,
    });

    const response = await request(app)
      .post("/api/tutor/explain")
      .send({ prompt: "Giải thích định lý Pytagore" })
      .expect(200);

    expect(generateLesson).toHaveBeenCalledOnce();
    expect(generateVideo).toHaveBeenCalledOnce();
    expect(response.body).toMatchObject({
      concept: "giai-thich-inh-ly-pytagore",
      status: "ready",
      intelligenceSource: "openai",
      video: {
        generated: true,
        mimeType: "video/mp4",
        durationSeconds: 10,
      },
      tutor: {
        followUpQuestion: "Neu a = 3 va b = 4 thi c bang bao nhieu?",
      },
    });
    expect(response.body.video.url).toMatch(/^\/generated\/.+\.mp4$/);
    expect(response.body.tutor.steps).toHaveLength(3);
  });

  test("POST /api/tutor/explain supports Cartesian coordinate prompts", async () => {
    const generateLesson = vi.fn(async () => ({
      opening: "He toa do Decartes dung hai truc vuong goc de xac dinh vi tri.",
      steps: [
        { atSeconds: 0, text: "Ve truc x nam ngang va truc y thang dung." },
        { atSeconds: 3, text: "Giao diem hai truc la goc toa do O." },
        { atSeconds: 6, text: "Mot diem duoc viet bang cap (x, y)." },
      ],
      followUpQuestion: "Diem (2, 3) nam ben phai hay ben trai truc y?",
    }));
    const generateVideo = vi.fn(async ({ requestId, template }) => ({
      templateId: template.id,
      url: `/generated/${requestId}.mp4`,
      mimeType: "video/mp4",
      durationSeconds: 10,
      generated: true,
    }));
    const app = createApp({
      generateLesson,
      generateVideo,
      hasOpenAIKey: () => true,
    });

    const response = await request(app)
      .post("/api/tutor/explain")
      .send({ prompt: "Giải thích hệ toạ độ Decartes" })
      .expect(200);

    expect(response.body).toMatchObject({
      concept: "giai-thich-he-toa-o-decartes",
      status: "ready",
      video: {
        templateId: "giai-thich-he-toa-o-decartes",
        durationSeconds: 10,
        generated: true,
      },
    });
    expect(response.body.video.url).toMatch(/^\/generated\/.+\.mp4$/);
    expect(response.body.tutor.followUpQuestion).toContain("(2, 3)");
  });

  test("GET generated video URL serves a generated video asset", async () => {
    const generatedDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "visual-tutor-"));
    await fs.writeFile(path.join(generatedDirectory, "lesson.mp4"), Buffer.from("fake mp4"));
    const app = createApp({
      generatedDirectory,
      hasOpenAIKey: () => false,
    });

    const response = await request(app)
      .get("/generated/lesson.mp4")
      .expect(200);

    expect(response.headers["content-type"]).toContain("video/mp4");
  });
});
