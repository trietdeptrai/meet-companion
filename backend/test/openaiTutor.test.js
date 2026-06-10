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
        conceptAnalysis: {
          concept_id: "right_triangle_area",
          domain: "math",
          subdomain: "geometry",
          prerequisites: ["area"],
          key_claims: ["A visual proof can compare areas."],
          common_misconceptions: ["Confusing the hypotenuse with a leg."],
          best_explanation_modes: ["area_comparison"],
        },
        visualPlan: {
          selected_pattern_id: "generated_scene_dsl",
          visual_core: "Compare areas with simple geometric objects.",
          visual_rules: ["Show the objects before the formula."],
          color_logic: {
            primary: "cyan",
            secondary: "yellow",
            highlight: "green",
          },
        },
        storyboard: {
          total_duration_sec: 10,
          scenes: [
            {
              scene_id: "s1",
              duration_sec: 3,
              learning_goal: "Introduce the shape.",
              visual_goal: "Show the first object.",
              objects: ["axis", "shape", "label"],
              animations: ["fade_in"],
              camera: "static_center",
              labels: ["shape"],
            },
            {
              scene_id: "s2",
              duration_sec: 4,
              learning_goal: "Show the relation.",
              visual_goal: "Highlight the relation.",
              objects: ["shape", "area", "arrow"],
              animations: ["highlight"],
              camera: "static_center",
              labels: ["area"],
            },
            {
              scene_id: "s3",
              duration_sec: 3,
              learning_goal: "Summarize.",
              visual_goal: "Show the formula.",
              objects: ["formula", "label", "dot"],
              animations: ["write_label"],
              camera: "static_center",
              labels: ["formula"],
            },
          ],
        },
        sceneDsl: {
          canvas: {
            background: "dark",
            resolution: "1280x720",
            style: "generated geometric scene",
          },
          scenes: [
            {
              scene_id: "s1",
              objects: [
                { id: "x_axis", type: "axis", params: { orientation: "horizontal", y: 0.75 }, style: { stroke: "muted" } },
                { id: "shape", type: "rectangle", params: { x: 0.3, y: 0.35, width: 0.2, height: 0.2 }, style: { fill: "green", stroke: "green" } },
                { id: "label", type: "label", params: { x: 0.3, y: 0.2, text: "Area" }, style: { stroke: "white" } },
              ],
              animations: [{ type: "fade_in", target: "shape", duration: 1 }],
              camera: [{ type: "static_center", duration: 1 }],
            },
            {
              scene_id: "s2",
              objects: [
                { id: "x_axis", type: "axis", params: { orientation: "horizontal", y: 0.75 }, style: { stroke: "muted" } },
                { id: "area", type: "region", params: { x: 0.3, y: 0.35, width: 0.2, height: 0.2 }, style: { fill: "green", stroke: "green" } },
                { id: "arrow", type: "arrow", params: { x1: 0.2, y1: 0.4, x2: 0.5, y2: 0.4 }, style: { stroke: "yellow" } },
              ],
              animations: [{ type: "highlight", target: "area", duration: 1 }],
              camera: [{ type: "static_center", duration: 1 }],
            },
            {
              scene_id: "s3",
              objects: [
                { id: "formula", type: "formula", params: { x: 0.45, y: 0.22, text: "A" }, style: { stroke: "white" } },
                { id: "label", type: "label", params: { x: 0.3, y: 0.3, text: "sum" }, style: { stroke: "cyan" } },
                { id: "dot", type: "dot", params: { x: 0.5, y: 0.5 }, style: { fill: "yellow" } },
              ],
              animations: [{ type: "write_label", target: "formula", duration: 1 }],
              camera: [{ type: "static_center", duration: 1 }],
            },
          ],
        },
      }),
    }));
    const client = { responses: { create: responsesCreate } };
    const tutor = createOpenAITutor({ client, model: "gpt-test" });

    const lesson = await tutor.generateLesson({
      prompt: "Giải thích định lý Pytagore",
      language: "vi",
      requestContext: {
        id: "pythagorean-theorem",
        title: "Dinh ly Pytagore",
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
    expect(lesson.visualPlan.selected_pattern_id).toBe("generated_scene_dsl");
    expect(lesson.sceneDsl.scenes[0].objects).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "rectangle" })]),
    );
  });
});
