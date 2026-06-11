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

  test("repairs linear transformation component props so static preflight can pass", () => {
    const storyboard = {
      title: "Linear transformations",
      duration_sec: 24,
      shots: [
        {
          shot_id: "shot_1",
          duration_sec: 5,
          visual_goal: "Introduce a rule that acts on every vector.",
          main_component: "HookTitle",
          camera: "static_center",
          text_policy: "title_only",
          narration: "A linear transformation moves every vector consistently.",
          formula: "",
        },
        {
          shot_id: "shot_2",
          duration_sec: 7,
          visual_goal: "Show the grid deforming as one coherent object.",
          main_component: "LinearTransformGrid",
          camera: "static_center",
          text_policy: "minimal_caption",
          narration: "The whole grid stretches, rotates, or shears together.",
          formula: "",
        },
        {
          shot_id: "shot_3",
          duration_sec: 5,
          visual_goal: "Compare before and after while keeping straight lines straight.",
          main_component: "SplitScreenComparison",
          camera: "wide_compare",
          text_policy: "short_labels",
          narration: "The origin stays fixed, and lines stay straight.",
          formula: "",
        },
        {
          shot_id: "shot_4",
          duration_sec: 7,
          visual_goal: "Reveal the matrix rule.",
          main_component: "FormulaReveal",
          camera: "wide_summary",
          text_policy: "final_formula",
          narration: "A matrix captures that rule.",
          formula: "T(\\mathbf{x}) = A\\mathbf{x}",
        },
      ],
    };
    const componentGraph = normalizeComponentGraph(
      {
        graph_id: "linear-transform",
        nodes: [
          { id: "node_1", shot_id: "shot_1", component: "HookTitle", props: { title: "Linear transformation" } },
          {
            id: "node_2",
            shot_id: "shot_2",
            component: "LinearTransformGrid",
            props: { caption: "The whole grid moves together", annotation: "stretch, rotate, shear" },
          },
          {
            id: "node_3",
            shot_id: "shot_3",
            component: "SplitScreenComparison",
            props: { caption: "Origin fixed. Lines stay straight.", annotation: "before and after" },
          },
          {
            id: "node_4",
            shot_id: "shot_4",
            component: "FormulaReveal",
            props: { formula: "T(\\mathbf{x}) = A\\mathbf{x}" },
          },
        ],
        edges: [],
      },
      storyboard,
      { id: "linear-transformation", title: "Linear transformation", style: "clean_dark_explainer" },
    );

    expect(componentGraph.nodes.find((node) => node.component === "LinearTransformGrid")?.props).toMatchObject({
      transform: "stretch, rotate, shear",
    });
    expect(componentGraph.nodes.find((node) => node.component === "SplitScreenComparison")?.props).toMatchObject({
      left: "before",
      right: "after",
    });

    const timeline = compileTimeline({
      storyboard,
      componentGraph,
      durationSeconds: 24,
      designTokens,
    });

    expect(runStaticPreflight({ componentGraph, timeline, designTokens }).pass).toBe(true);
  });

  test("repairs prepared visual grammar component props so static preflight can pass", () => {
    const storyboard = {
      title: "Five prepared visual components",
      duration_sec: 30,
      shots: [
        {
          shot_id: "area",
          duration_sec: 5,
          visual_goal: "Show smooth area under a curve after rectangles become fine.",
          main_component: "AreaFillReveal",
          camera: "static_center",
          text_policy: "minimal_caption",
          narration: "The accumulated area becomes the integral.",
          formula: "\\int_a^b f(x) dx",
        },
        {
          shot_id: "basis",
          duration_sec: 5,
          visual_goal: "Reveal transformed basis vectors.",
          main_component: "BasisVectorReveal",
          camera: "static_center",
          text_policy: "minimal_caption",
          narration: "A matrix tells us where the basis vectors land.",
          formula: "",
        },
        {
          shot_id: "vector",
          duration_sec: 5,
          visual_goal: "Move one vector through the same matrix rule.",
          main_component: "VectorTransform",
          camera: "static_center",
          text_policy: "minimal_caption",
          narration: "Every vector follows from the transformed basis.",
          formula: "A\\mathbf{x}",
        },
        {
          shot_id: "landscape",
          duration_sec: 5,
          visual_goal: "Show loss as a landscape.",
          main_component: "LossLandscape2D",
          camera: "wide",
          text_policy: "minimal_caption",
          narration: "Loss is height on a surface.",
          formula: "L(\\theta)",
        },
        {
          shot_id: "descent",
          duration_sec: 5,
          visual_goal: "Animate the point stepping downhill.",
          main_component: "PointDescent",
          camera: "follow_point",
          text_policy: "minimal_caption",
          narration: "Each update steps downhill.",
          formula: "",
        },
        {
          shot_id: "steps",
          duration_sec: 5,
          visual_goal: "Show the optimization rule as repeatable steps.",
          main_component: "StepByStepOptimization",
          camera: "wide_summary",
          text_policy: "formula",
          narration: "Repeat the update until loss is low.",
          formula: "\\theta_{t+1}=\\theta_t-\\eta\\nabla L(\\theta_t)",
        },
      ],
    };
    const componentGraph = normalizeComponentGraph(
      { graph_id: "prepared-components", nodes: [], edges: [] },
      storyboard,
      { id: "prepared-components", title: "Prepared components", style: "clean_dark_explainer" },
    );
    const timeline = compileTimeline({
      storyboard,
      componentGraph,
      durationSeconds: 30,
      designTokens,
    });

    expect(componentGraph.nodes.map((node) => node.component)).toEqual([
      "AreaFillReveal",
      "BasisVectorReveal",
      "VectorTransform",
      "LossLandscape2D",
      "PointDescent",
      "StepByStepOptimization",
    ]);
    expect(runStaticPreflight({ componentGraph, timeline, designTokens }).pass).toBe(true);
  });
});
