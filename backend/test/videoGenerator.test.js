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
});
