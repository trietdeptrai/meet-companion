import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { renderTimelineFrameSvg } from "../src/services/svgComponentRenderer.js";
import { createVideoGenerator } from "../src/services/videoGenerator.js";

function sampleTimeline() {
  return {
    duration_sec: 1,
    fps: 30,
    resolution: "1280x720",
    theme_id: "clean_dark_explainer",
    constraints: {
      max_objects_per_shot: 8,
      max_text_lines: 2,
      safe_margin_px: 96,
    },
    shots: [
      {
        shot_id: "sh01",
        node_id: "n1",
        start_sec: 0,
        end_sec: 0.3,
        duration_sec: 0.3,
        component: "HookTitle",
        visual_goal: "Introduce gradient descent.",
        camera: { type: "slow_push_in" },
        text_policy: "title_only",
        narration: "Gradient descent is a walk downhill.",
      },
      {
        shot_id: "sh02",
        node_id: "n2",
        start_sec: 0.3,
        end_sec: 0.7,
        duration_sec: 0.4,
        component: "MovingPoint",
        visual_goal: "Show the point walking downhill.",
        camera: { type: "center_on_point" },
        text_policy: "no_text",
        narration: "Each step moves opposite the gradient.",
      },
      {
        shot_id: "sh03",
        node_id: "n3",
        start_sec: 0.7,
        end_sec: 1,
        duration_sec: 0.3,
        component: "FormulaReveal",
        visual_goal: "Reveal the update rule.",
        camera: { type: "wide_summary" },
        text_policy: "final_formula",
        narration: "The update rule repeats that idea.",
      },
    ],
  };
}

function sampleComponentGraph() {
  return {
    nodes: [
      {
        id: "n1",
        shot_id: "sh01",
        component: "HookTitle",
        props: {
          title: "Gradient descent",
          subtitle: "walk downhill on loss",
        },
        style: { theme: "clean_dark_explainer", highlight_color_token: "primary" },
        narration: "Gradient descent is a walk downhill.",
      },
      {
        id: "n2",
        shot_id: "sh02",
        component: "MovingPoint",
        props: {
          path: "downhill steps",
          caption: "step against the slope",
        },
        style: { theme: "clean_dark_explainer", highlight_color_token: "secondary" },
        narration: "Each step moves opposite the gradient.",
      },
      {
        id: "n3",
        shot_id: "sh03",
        component: "FormulaReveal",
        props: {
          formula: "x_{t+1} = x_t - \\eta \\nabla f(x_t)",
          caption: "repeat small downhill steps",
        },
        style: { theme: "clean_dark_explainer", highlight_color_token: "primary" },
        narration: "The update rule repeats that idea.",
      },
    ],
  };
}

describe("video generator", () => {
  test("renders real SVG typography, glow, and vector paths for component frames", () => {
    const svg = renderTimelineFrameSvg({
      timeline: sampleTimeline(),
      componentGraph: sampleComponentGraph(),
      second: 0.1,
    });

    expect(svg).toContain("<text");
    expect(svg).toContain("softGlow");
    expect(svg).toContain("<path");
    expect(svg).toContain("Gradient descent");
    expect(svg).not.toContain("drawbox");
  });

  test("formats common LaTeX-style math tokens into renderer-safe formula text", () => {
    const svg = renderTimelineFrameSvg({
      timeline: sampleTimeline(),
      componentGraph: sampleComponentGraph(),
      second: 0.85,
    });

    expect(svg).toContain("eta * grad");
    expect(svg).toContain("x(t+1)");
    expect(svg).not.toContain("\\eta");
    expect(svg).not.toContain("ₜ");
    expect(svg).not.toContain("x_{t+1}");
  });

  test("formats integral limit notation without leaking raw LaTeX commands", () => {
    const timeline = {
      ...sampleTimeline(),
      shots: [
        {
          shot_id: "integral_formula",
          node_id: "integral_node",
          start_sec: 0,
          end_sec: 1,
          duration_sec: 1,
          component: "FormulaReveal",
          visual_goal: "Reveal the integral formula.",
          narration: "The limit of sums becomes the integral.",
        },
      ],
    };
    const componentGraph = {
      nodes: [
        {
          id: "integral_node",
          shot_id: "integral_formula",
          component: "FormulaReveal",
          props: {
            formula: "\\lim_{n\\to\\infty} \\sum_{i=1}^{n} f(x_i)\\,\\Delta x \\;=\\; \\int_a^b f(x)\\,dx",
            caption: "rectangles become exact area",
          },
        },
      ],
    };

    const svg = renderTimelineFrameSvg({ timeline, componentGraph, second: 0.5 });

    expect(svg).toContain("lim(n→∞)");
    expect(svg).toContain("Σ(i=1 to n)");
    expect(svg).toContain("f(x_i) Δ x");
    expect(svg).toContain("∫[a,b]");
    expect(svg).not.toContain("\\lim");
    expect(svg).not.toContain("\\to");
    expect(svg).not.toContain("\\;");
  });

  test("renders native linear transformation components instead of generic fallback diagrams", () => {
    const timeline = {
      duration_sec: 2,
      fps: 30,
      resolution: "1280x720",
      theme_id: "clean_dark_explainer",
      constraints: {
        max_objects_per_shot: 8,
        max_text_lines: 2,
        safe_margin_px: 96,
      },
      shots: [
        {
          shot_id: "linear_grid",
          node_id: "grid_node",
          start_sec: 0,
          end_sec: 1,
          duration_sec: 1,
          component: "LinearTransformGrid",
          visual_goal: "Show the grid deforming.",
          camera: { type: "static_center" },
          text_policy: "minimal_caption",
          narration: "The whole grid moves together.",
        },
        {
          shot_id: "compare",
          node_id: "compare_node",
          start_sec: 1,
          end_sec: 2,
          duration_sec: 1,
          component: "SplitScreenComparison",
          visual_goal: "Compare before and after.",
          camera: { type: "wide_compare" },
          text_policy: "short_labels",
          narration: "Lines stay straight.",
        },
      ],
    };
    const componentGraph = {
      nodes: [
        {
          id: "grid_node",
          shot_id: "linear_grid",
          component: "LinearTransformGrid",
          props: {
            transform: "shear and stretch",
            caption: "The whole grid moves together",
          },
          style: { theme: "clean_dark_explainer", highlight_color_token: "primary" },
        },
        {
          id: "compare_node",
          shot_id: "compare",
          component: "SplitScreenComparison",
          props: {
            left: "before",
            right: "after",
            caption: "Origin fixed. Lines stay straight.",
          },
          style: { theme: "clean_dark_explainer", highlight_color_token: "secondary" },
        },
      ],
    };

    const gridSvg = renderTimelineFrameSvg({ timeline, componentGraph, second: 0.5 });
    expect(gridSvg).toContain('data-component="LinearTransformGrid"');
    expect(gridSvg).toContain("shear and stretch");
    expect(gridSvg).not.toContain('data-component="GenericDiagram"');

    const compareSvg = renderTimelineFrameSvg({ timeline, componentGraph, second: 1.5 });
    expect(compareSvg).toContain('data-component="SplitScreenComparison"');
    expect(compareSvg).toContain("before");
    expect(compareSvg).toContain("after");
    expect(compareSvg).not.toContain('data-component="GenericDiagram"');
  });

  test("renders prepared concept grammar components with native SVG scenes", () => {
    const timeline = {
      duration_sec: 6,
      fps: 30,
      resolution: "1280x720",
      theme_id: "clean_dark_explainer",
      constraints: {
        max_objects_per_shot: 8,
        max_text_lines: 2,
        safe_margin_px: 96,
      },
      shots: [
        { shot_id: "area", node_id: "area_node", start_sec: 0, end_sec: 1, duration_sec: 1, component: "AreaFillReveal", visual_goal: "Fill area under the curve.", narration: "The area is the integral." },
        { shot_id: "basis", node_id: "basis_node", start_sec: 1, end_sec: 2, duration_sec: 1, component: "BasisVectorReveal", visual_goal: "Show basis vectors landing.", narration: "A matrix moves the basis." },
        { shot_id: "vector", node_id: "vector_node", start_sec: 2, end_sec: 3, duration_sec: 1, component: "VectorTransform", visual_goal: "Transform a vector.", narration: "The vector follows the same map." },
        { shot_id: "landscape", node_id: "landscape_node", start_sec: 3, end_sec: 4, duration_sec: 1, component: "LossLandscape2D", visual_goal: "Show a loss surface.", narration: "Loss is height." },
        { shot_id: "descent", node_id: "descent_node", start_sec: 4, end_sec: 5, duration_sec: 1, component: "PointDescent", visual_goal: "Step downhill.", narration: "Move against the gradient." },
        { shot_id: "steps", node_id: "steps_node", start_sec: 5, end_sec: 6, duration_sec: 1, component: "StepByStepOptimization", visual_goal: "Summarize optimization steps.", narration: "Repeat the update." },
      ],
    };
    const componentGraph = {
      nodes: [
        { id: "area_node", shot_id: "area", component: "AreaFillReveal", props: { function: "f(x)", bounds: "a to b", caption: "area accumulates under f(x)" } },
        { id: "basis_node", shot_id: "basis", component: "BasisVectorReveal", props: { matrix: "[[1,1],[0,1]]", caption: "watch i-hat and j-hat land" } },
        { id: "vector_node", shot_id: "vector", component: "VectorTransform", props: { vector: "(2,1)", result: "A x", caption: "the vector follows the basis" } },
        { id: "landscape_node", shot_id: "landscape", component: "LossLandscape2D", props: { loss: "L(theta)", caption: "height means error" } },
        { id: "descent_node", shot_id: "descent", component: "PointDescent", props: { path: "downhill", caption: "step opposite the gradient" } },
        { id: "steps_node", shot_id: "steps", component: "StepByStepOptimization", props: { update_rule: "\\theta_{t+1}=\\theta_t-\\eta\\nabla L(\\theta_t)", caption: "repeat small updates" } },
      ],
    };

    const checks = [
      [0.5, "AreaFillReveal"],
      [1.5, "BasisVectorReveal"],
      [2.5, "VectorTransform"],
      [3.5, "LossLandscape2D"],
      [4.5, "PointDescent"],
      [5.5, "StepByStepOptimization"],
    ];

    for (const [second, component] of checks) {
      const svg = renderTimelineFrameSvg({ timeline, componentGraph, second });
      expect(svg).toContain(`data-component="${component}"`);
      expect(svg).not.toContain('data-component="GenericDiagram"');
    }
  });

  test("renders component graph videos with the SVG craft renderer instead of FFmpeg drawbox primitives", async () => {
    const outputDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "visual-render-"));
    const generateVideo = createVideoGenerator({ outputDirectory, durationSeconds: 1 });
    const previousFrameFps = process.env.RENDER_FRAME_FPS;
    process.env.RENDER_FRAME_FPS = "6";
    let result;
    try {
      result = await generateVideo({
        requestId: "svg-render-test",
        requestContext: {
          id: "gradient-descent",
          title: "Gradient descent",
        },
        componentGraph: sampleComponentGraph(),
        timeline: sampleTimeline(),
        creativeBrief: {
          visual_style: "clean_dark_explainer",
        },
        renderPass: "final",
      });
    } finally {
      if (previousFrameFps === undefined) {
        delete process.env.RENDER_FRAME_FPS;
      } else {
        process.env.RENDER_FRAME_FPS = previousFrameFps;
      }
    }

    const absolutePath = path.join(outputDirectory, "svg-render-test.mp4");
    const stat = await fs.stat(absolutePath);

    expect(result).toMatchObject({
      renderer: "svg-component-ffmpeg",
      url: "/generated/svg-render-test.mp4",
      mimeType: "video/mp4",
      durationSeconds: 1,
      sceneCount: 3,
      componentCount: 3,
    });
    expect(result.frameRenderer).toBe("resvg-svg-components");
    expect(stat.size).toBeGreaterThan(4_000);
  }, 20_000);

  test("allows low source FPS for faster local smoke renders", async () => {
    const outputDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "visual-render-lowfps-"));
    const generateVideo = createVideoGenerator({ outputDirectory, durationSeconds: 1 });
    const previousFrameFps = process.env.RENDER_FRAME_FPS;
    process.env.RENDER_FRAME_FPS = "3";
    let result;
    try {
      result = await generateVideo({
        requestId: "svg-render-lowfps-test",
        requestContext: {
          id: "gradient-descent",
          title: "Gradient descent",
        },
        componentGraph: sampleComponentGraph(),
        timeline: sampleTimeline(),
        creativeBrief: {
          visual_style: "clean_dark_explainer",
        },
        renderPass: "preview",
      });
    } finally {
      if (previousFrameFps === undefined) {
        delete process.env.RENDER_FRAME_FPS;
      } else {
        process.env.RENDER_FRAME_FPS = previousFrameFps;
      }
    }

    expect(result.sourceFps).toBe(3);
    expect(result.frameCount).toBe(3);
  }, 20_000);
});
