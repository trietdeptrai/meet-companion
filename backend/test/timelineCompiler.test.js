import { describe, expect, test } from "vitest";
import { normalizeComponentGraph } from "../src/services/motionComponents.js";
import { compileTimeline, runStaticPreflight } from "../src/services/timelineCompiler.js";
import { runVisualQa } from "../src/services/visualQa.js";

const designTokens = {
  theme_id: "clean_dark_explainer",
  motion: { default_ease: "easeInOutCubic" },
  layout: { max_objects_per_shot: 8, max_text_lines: 2 },
  canvas: { safe_margin_px: 96 },
};

function mathStoryboard({ includeFormula = true } = {}) {
  return {
    title: "Gradient descent",
    duration_sec: 24,
    shots: [
      {
        shot_id: "sh01",
        duration_sec: 6,
        visual_goal: "Introduce the loss valley.",
        main_component: "HookTitle",
        camera: "slow_push_in",
        text_policy: "title_only",
        narration: "Gradient descent walks downhill on loss.",
      },
      {
        shot_id: "sh02",
        duration_sec: 8,
        visual_goal: "Animate steps moving opposite the slope.",
        main_component: "MovingPoint",
        camera: "center_on_point",
        text_policy: "minimal_caption",
        narration: "Each small step moves opposite the gradient.",
      },
      {
        shot_id: "sh03",
        duration_sec: 10,
        visual_goal: "Reveal the update rule after the intuition.",
        main_component: "FormulaReveal",
        camera: "wide_summary",
        text_policy: "final_formula",
        narration: "Now write the repeated step as a formula.",
        ...(includeFormula ? { formula: "x_next = x - eta * grad f(x)" } : {}),
      },
    ],
  };
}

describe("timeline compiler and math quality gates", () => {
  test("preserves storyboard formula shots even when the planner omits the matching graph node", () => {
    const storyboard = mathStoryboard();
    const componentGraph = normalizeComponentGraph(
      {
        graph_id: "bad_graph",
        nodes: [
          {
            id: "n1",
            shot_id: "sh01",
            component: "HookTitle",
            props: { title: "Gradient descent" },
          },
          {
            id: "n2",
            shot_id: "sh02",
            component: "MovingPoint",
            props: { motion: "iterative downhill steps" },
          },
        ],
        edges: [],
      },
      storyboard,
      { id: "gradient-descent", title: "Gradient descent", style: "clean_dark_explainer" },
    );

    const formulaNode = componentGraph.nodes.find((node) => node.shot_id === "sh03");
    expect(formulaNode).toMatchObject({
      component: "FormulaReveal",
      props: { formula: "x_next = x - eta * grad f(x)" },
    });

    const timeline = compileTimeline({
      storyboard,
      componentGraph,
      durationSeconds: 24,
      designTokens,
    });
    const formulaShot = timeline.shots.find((shot) => shot.shot_id === "sh03");
    expect(formulaShot).toMatchObject({
      node_id: formulaNode.id,
      component: "FormulaReveal",
    });
    expect(runStaticPreflight({ componentGraph, timeline, designTokens }).pass).toBe(true);
  });

  test("fails math QA when the pipeline cannot find a real formula reveal", () => {
    const storyboard = mathStoryboard({ includeFormula: false });
    const componentGraph = normalizeComponentGraph(
      {
        graph_id: "missing_formula_graph",
        nodes: [
          {
            id: "n1",
            shot_id: "sh01",
            component: "HookTitle",
            props: { title: "Gradient descent" },
          },
          {
            id: "n2",
            shot_id: "sh02",
            component: "MovingPoint",
            props: { path: "downhill steps" },
          },
          {
            id: "n3",
            shot_id: "sh03",
            component: "FormulaReveal",
            props: { caption: "repeat the update" },
          },
        ],
        edges: [],
      },
      storyboard,
      { id: "gradient-descent", title: "Gradient descent", style: "clean_dark_explainer" },
    );
    const timeline = compileTimeline({
      storyboard,
      componentGraph,
      durationSeconds: 24,
      designTokens,
    });
    const preflight = runStaticPreflight({ componentGraph, timeline, designTokens });

    const qa = runVisualQa({
      video: { url: "/generated/preview.mp4", durationSeconds: 24 },
      timeline,
      componentGraph,
      preflight,
      conceptUnderstanding: { domain: "math" },
    });

    expect(qa.passed).toBe(false);
    expect(qa.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: "high",
          type: "missing_math_formula",
        }),
      ]),
    );
  });
});
