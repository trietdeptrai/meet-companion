import { describe, expect, test, vi } from "vitest";
import { createOpenAITutor } from "../src/services/openaiTutor.js";

describe("OpenAI tutor adapter", () => {
  test("requests a structured Vietnamese tutor script with the Responses API", async () => {
    const responsesCreate = vi.fn(async () => ({
      output_text: JSON.stringify({
        opening: "Hay nhin vao tam giac vuong.",
        steps: [
          { atSeconds: 0, text: "Ve tam giac vuong." },
          { atSeconds: 5, text: "Dung cac hinh vuong tren moi canh." },
          { atSeconds: 11, text: "So sanh dien tich." },
        ],
        followUpQuestion: "Neu a = 3 va b = 4 thi c la bao nhieu?",
      }),
    }));
    const client = { responses: { create: responsesCreate } };
    const tutor = createOpenAITutor({ client, model: "gpt-test" });

    const lesson = await tutor.generateLesson({
      prompt: "Giải thích định lý Pytagore",
      language: "vi",
      template: {
        id: "pythagorean-theorem",
        title: "Dinh ly Pytagore",
        storyboard: [
          "Draw a right triangle",
          "Label sides a, b, c",
          "Show a^2 + b^2 = c^2",
        ],
      },
    });

    expect(responsesCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gpt-test",
        instructions: expect.stringContaining("visual tutor"),
        input: expect.stringContaining("Giải thích định lý Pytagore"),
      }),
    );
    expect(lesson.followUpQuestion).toContain("a = 3");
    expect(lesson.steps).toHaveLength(3);
  });
});
