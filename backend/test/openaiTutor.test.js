import { describe, expect, test, vi } from "vitest";
import { createOpenAITutor } from "../src/services/openaiTutor.js";

describe("OpenAI tutor adapter", () => {
  test("requests a structured v2 director plan without low-level scene DSL", async () => {
    const responsesCreate = vi.fn(async () => ({
      output_text: JSON.stringify({
        opening: "Gradient descent giống như đi xuống một thung lũng lỗi.",
        steps: [
          { atSeconds: 0, text: "Vẽ một đường cong lỗi dạng thung lũng." },
          { atSeconds: 2.5, text: "Chọn một điểm bắt đầu ở sườn dốc." },
          { atSeconds: 5, text: "Đi ngược hướng gradient để lỗi giảm xuống." },
          { atSeconds: 7.5, text: "Lặp lại cho tới khi gần đáy." },
        ],
        followUpQuestion: "Nếu learning rate quá lớn thì chuyện gì có thể xảy ra?",
        conceptUnderstanding: {
          concept_id: "gradient_descent_valley",
          domain: "math",
          subdomain: "optimization",
          learning_objective: "Understand gradient descent as repeated movement against slope.",
          prerequisites: ["slope", "function graph"],
          key_ideas: ["The gradient points uphill.", "Move opposite the gradient.", "Repeat until loss is low."],
          misconceptions: ["Gradient direction is the direction to move."],
          visual_affordances: ["loss curve", "moving point", "arrows"],
        },
        knowledgeDecomposition: {
          atoms: [
            { id: "loss", idea: "Loss is height.", visual_need: "Show a valley curve." },
            { id: "gradient", idea: "Gradient points uphill.", visual_need: "Show a local arrow." },
            { id: "step", idea: "Move opposite gradient.", visual_need: "Animate downhill steps." },
          ],
        },
        creativeTreatments: {
          concept: "gradient descent as valley descent",
          treatments: [
            {
              treatment_id: "valley_walk",
              title: "Valley Walk",
              one_liner: "A dot walks down a valley.",
              visual_hook: "Downhill steps reveal optimization.",
              components: ["HookTitle", "GraphPlot", "MovingPoint", "FormulaReveal"],
              estimated_quality: 0.93,
              estimated_feasibility: 0.91,
              style_notes: ["low text"],
            },
            {
              treatment_id: "slope_arrows",
              title: "Slope Arrows",
              one_liner: "Arrows flip from uphill to downhill.",
              visual_hook: "The direction reversal is the insight.",
              components: ["GraphPlot", "TangentReveal", "VisualRecap"],
              estimated_quality: 0.84,
              estimated_feasibility: 0.88,
              style_notes: ["arrow-driven"],
            },
          ],
        },
        treatmentRanking: {
          selected_treatment_id: "valley_walk",
          reason: "It is concrete and visually direct.",
          rejected_treatments: [{ id: "slope_arrows", reason: "Less memorable for beginners." }],
          scores: [
            {
              treatment_id: "valley_walk",
              concept_accuracy_score: 0.95,
              visual_clarity_score: 0.94,
              component_availability_score: 0.9,
              animation_beauty_score: 0.88,
              pacing_score: 0.86,
              feasibility_score: 0.91,
              complexity_penalty: 0.08,
              cognitive_load_penalty: 0.07,
              final_score: 0.91,
            },
          ],
        },
        creativeBrief: {
          tone: "clean, curious, precise",
          visual_style: "clean_dark_explainer",
          density: "low_text_high_visual",
          camera_style: "gentle push-in",
          color_strategy: {
            background: "deep navy",
            primary_math: "soft cyan",
            secondary_highlight: "warm yellow",
            inactive_objects: "muted gray",
          },
          motion_rules: ["One main motion per shot.", "Formula appears after visual intuition."],
        },
        storyboard: {
          title: "Gradient descent",
          duration_sec: 10,
          shots: [
            {
              shot_id: "sh01",
              duration_sec: 2,
              visual_goal: "Introduce loss valley.",
              main_component: "HookTitle",
              camera: "slow_push_in",
              text_policy: "title_only",
              narration: "Imagine error as a valley.",
              formula: "",
            },
            {
              shot_id: "sh02",
              duration_sec: 3,
              visual_goal: "Show curve and start point.",
              main_component: "GraphPlot",
              camera: "static_center",
              text_policy: "minimal_label",
              narration: "We start high on the curve.",
              formula: "",
            },
            {
              shot_id: "sh03",
              duration_sec: 3,
              visual_goal: "Animate downhill steps.",
              main_component: "MovingPoint",
              camera: "center_on_point",
              text_policy: "no_text",
              narration: "Move opposite the gradient.",
              formula: "",
            },
            {
              shot_id: "sh04",
              duration_sec: 2,
              visual_goal: "Reveal update rule.",
              main_component: "FormulaReveal",
              camera: "wide_summary",
              text_policy: "final_formula",
              narration: "That is the update rule.",
              formula: "x_next = x - eta * grad f(x)",
            },
          ],
        },
        componentGraph: {
          graph_id: "gradient_graph",
          nodes: [
            {
              id: "n1",
              shot_id: "sh01",
              component: "HookTitle",
              props: [{ key: "title", value: "Gradient descent" }],
              style: { theme: "clean_dark_explainer", highlight_color_token: "primary" },
              narration: "Imagine error as a valley.",
            },
            {
              id: "n2",
              shot_id: "sh02",
              component: "GraphPlot",
              props: [{ key: "function", value: "convex loss" }],
              style: { theme: "clean_dark_explainer", highlight_color_token: "primary" },
              narration: "We start high on the curve.",
            },
            {
              id: "n3",
              shot_id: "sh03",
              component: "MovingPoint",
              props: [{ key: "path", value: "downhill steps" }],
              style: { theme: "clean_dark_explainer", highlight_color_token: "secondary" },
              narration: "Move opposite the gradient.",
            },
          ],
          edges: [{ from: "n1", to: "n2", relation: "sequence" }],
        },
      }),
    }));
    const client = { responses: { create: responsesCreate } };
    const tutor = createOpenAITutor({ client, model: "gpt-test" });

    const lesson = await tutor.generateLesson({
      prompt: "Giải thích gradient descent như đi xuống thung lũng",
      language: "en",
      requestContext: {
        id: "gradient-descent-valley",
        title: "Gradient descent",
      },
      qualityMode: "best",
    });

    expect(responsesCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gpt-test",
        instructions: expect.stringContaining("director"),
        input: expect.stringContaining("Giải thích gradient descent"),
      }),
    );
    const request = responsesCreate.mock.calls[0][0];
    expect(request.text.format.schema.required).toContain("componentGraph");
    expect(request.text.format.schema.required).not.toContain("sceneDsl");
    expect(request.text.format.schema.properties.componentGraph.properties.nodes.items.properties.component.enum).toContain("GraphPlot");
    expect(request.text.format.schema.properties.storyboard.properties.shots.items.required).toContain("formula");
    expect(request.instructions).toContain("Every user-visible text field");
    expect(request.instructions).toContain("concrete symbolic formula");
    expect(request.input).toContain("Video language: en");
    expect(request.input).toContain("all visible tutor/video text must be English");
    expect(request.input).toContain("non-empty formula field");
    expect(request.input).toContain("Do not generate low-level pixel motion");
    expect(lesson.followUpQuestion).toContain("learning rate");
    expect(lesson.creativeTreatments.treatments).toHaveLength(2);
    expect(lesson.treatmentRanking.selected_treatment_id).toBe("valley_walk");
    expect(lesson.componentGraph.nodes).toEqual(
      expect.arrayContaining([expect.objectContaining({ component: "MovingPoint" })]),
    );
    expect(lesson).not.toHaveProperty("sceneDsl");
  });
});
