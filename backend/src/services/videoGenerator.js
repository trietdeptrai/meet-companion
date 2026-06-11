import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { compileSceneDslFromTimeline } from "./componentSceneCompiler.js";
import { renderSvgFrames } from "./svgComponentRenderer.js";

const execFileAsync = promisify(execFile);
const defaultDurationSeconds = 24;
const width = 1280;
const height = 720;
const safe = {
  left: 96,
  right: 1184,
  top: 78,
  bottom: 642,
};

const colorMap = {
  accent: "0x83f2ff",
  primary: "0x83f2ff",
  cyan: "0x83f2ff",
  secondary: "0xffd36b",
  yellow: "0xffd36b",
  highlight: "0xffb454",
  orange: "0xffb454",
  green: "0x7cffb2",
  neutral: "0xf8f6ee",
  white: "0xf8f6ee",
  muted: "0x94a3b8",
  blue: "0x60a5fa",
  red: "0xff7c9c",
};

function sanitizeFileName(value) {
  return value.replace(/[^a-zA-Z0-9-]/g, "-");
}

function clamp(value, min = 0, max = 1) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(Math.max(number, min), max);
}

function pxX(value) {
  return Math.round(safe.left + clamp(value) * (safe.right - safe.left));
}

function pxY(value) {
  return Math.round(safe.top + clamp(value) * (safe.bottom - safe.top));
}

function pxW(value) {
  return Math.max(4, Math.round(clamp(value, 0.01, 1) * (safe.right - safe.left)));
}

function pxH(value) {
  return Math.max(4, Math.round(clamp(value, 0.01, 1) * (safe.bottom - safe.top)));
}

function styleColor(style = {}, fallback = "accent") {
  const key = String(style.stroke || style.fill || fallback).toLowerCase();
  return colorMap[key] ?? colorMap[fallback] ?? colorMap.accent;
}

function fillColor(style = {}, fallback = "highlight") {
  const key = String(style.fill || style.stroke || fallback).toLowerCase();
  const alpha = clamp(style.opacity ?? 0.24, 0.08, 0.7);
  return `${colorMap[key] ?? colorMap[fallback] ?? colorMap.highlight}@${alpha}`;
}

function enableBetween(start, end) {
  return `enable='between(t,${start.toFixed(2)},${end.toFixed(2)})'`;
}

function sanitizeText(value) {
  return String(value || "")
    .replace(/\\/g, "")
    .replace(/:/g, "\\:")
    .replace(/'/g, "")
    .slice(0, 60);
}

function drawRect(object, enable) {
  const params = object.params ?? {};
  const x = pxX(params.x ?? 0.25);
  const y = pxY(params.y ?? 0.35);
  const w = pxW(params.width ?? 0.18);
  const h = pxH(params.height ?? 0.22);
  const stroke = styleColor(object.style, "cyan");
  const fill = fillColor(object.style, "highlight");
  return [
    `drawbox=x=${x}:y=${y}:w=${w}:h=${h}:color=${fill}:t=fill:${enable}`,
    `drawbox=x=${x}:y=${y}:w=${w}:h=${h}:color=${stroke}:t=4:${enable}`,
  ];
}

function drawAxis(object, enable) {
  const params = object.params ?? {};
  const orientation = String(params.orientation || "").toLowerCase();
  const stroke = styleColor(object.style, "muted");
  if (orientation === "vertical") {
    const x = pxX(params.x ?? 0.5);
    return [`drawbox=x=${x}:y=${safe.top}:w=3:h=${safe.bottom - safe.top}:color=${stroke}@0.75:t=fill:${enable}`];
  }
  const y = pxY(params.y ?? 0.72);
  return [`drawbox=x=${safe.left}:y=${y}:w=${safe.right - safe.left}:h=3:color=${stroke}@0.75:t=fill:${enable}`];
}

function drawDot(object, enable) {
  const params = object.params ?? {};
  const x = pxX(params.x ?? 0.5) - 8;
  const y = pxY(params.y ?? 0.5) - 8;
  const color = styleColor(object.style, "yellow");
  return [
    `drawbox=x=${x - 8}:y=${y - 8}:w=32:h=32:color=${color}@0.18:t=fill:${enable}`,
    `drawbox=x=${x}:y=${y}:w=16:h=16:color=${color}:t=fill:${enable}`,
  ];
}

function interpolatePoints(points, count = 14) {
  if (!Array.isArray(points) || points.length === 0) return [];
  if (points.length === 1) return points;

  const output = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    for (let step = 0; step < count; step += 1) {
      const t = step / count;
      output.push({
        x: Number(start.x) + (Number(end.x) - Number(start.x)) * t,
        y: Number(start.y) + (Number(end.y) - Number(start.y)) * t,
      });
    }
  }
  output.push(points[points.length - 1]);
  return output;
}

function drawPointSeries(points, color, enable, size = 7) {
  return interpolatePoints(points)
    .slice(0, 90)
    .map((point) => {
      const x = pxX(point.x) - Math.floor(size / 2);
      const y = pxY(point.y) - Math.floor(size / 2);
      return `drawbox=x=${x}:y=${y}:w=${size}:h=${size}:color=${color}:t=fill:${enable}`;
    });
}

function drawCurve(object, enable) {
  const params = object.params ?? {};
  const color = styleColor(object.style, "cyan");
  const points = Array.isArray(params.points) && params.points.length > 1
    ? params.points
    : [
        { x: 0.12, y: 0.68 },
        { x: 0.32, y: 0.52 },
        { x: 0.52, y: 0.32 },
        { x: 0.76, y: 0.24 },
      ];
  return drawPointSeries(points, color, enable, 8);
}

function drawLine(object, enable) {
  const params = object.params ?? {};
  const color = styleColor(object.style, "yellow");
  return drawPointSeries(
    [
      { x: params.x1 ?? 0.25, y: params.y1 ?? 0.7 },
      { x: params.x2 ?? 0.75, y: params.y2 ?? 0.3 },
    ],
    color,
    enable,
    7,
  );
}

function drawText(object, enable) {
  const params = object.params ?? {};
  const text = sanitizeText(params.text || object.id);
  if (!text) return [];
  const x = pxX(params.x ?? 0.08);
  const y = pxY(params.y ?? 0.08);
  const color = styleColor(object.style, "white");
  const barCount = Math.min(Math.max(Math.ceil(text.length / 8), 2), 7);
  const filters = [
    `drawbox=x=${x}:y=${y}:w=${Math.min(340, 54 * barCount)}:h=54:color=0x080c18@0.68:t=fill:${enable}`,
    `drawbox=x=${x}:y=${y}:w=${Math.min(340, 54 * barCount)}:h=54:color=${color}:t=3:${enable}`,
  ];

  for (let index = 0; index < barCount; index += 1) {
    filters.push(
      `drawbox=x=${x + 18 + index * 42}:y=${y + 22}:w=28:h=8:color=${color}:t=fill:${enable}`,
    );
  }

  return filters;
}

function drawObject(object, enable) {
  switch (object.type) {
    case "axis":
      return drawAxis(object, enable);
    case "curve":
      return drawCurve(object, enable);
    case "rectangle":
    case "region":
      return drawRect(object, enable);
    case "dot":
      return drawDot(object, enable);
    case "line":
    case "arrow":
      return drawLine(object, enable);
    case "label":
    case "formula":
      return drawText(object, enable);
    default:
      return drawRect(object, enable);
  }
}

function sceneTimings(sceneDsl, durationSeconds) {
  const scenes = Array.isArray(sceneDsl?.scenes) && sceneDsl.scenes.length > 0
    ? sceneDsl.scenes
    : [{ scene_id: "fallback", objects: [] }];
  const sceneDuration = durationSeconds / scenes.length;
  return scenes.map((scene, index) => ({
    scene,
    start: index * sceneDuration,
    end: (index + 1) * sceneDuration,
  }));
}

function buildSceneDslFilter(sceneDsl, durationSeconds) {
  const filters = [
    "drawbox=x=64:y=40:w=1152:h=640:color=0x172033:t=3",
  ];

  for (const { scene, start, end } of sceneTimings(sceneDsl, durationSeconds)) {
    const enable = enableBetween(start, end);
    for (const object of scene.objects ?? []) {
      filters.push(...drawObject(object, enable));
    }
  }

  return filters.join(",");
}

export function createVideoGenerator({
  ffmpegPath = process.env.FFMPEG_PATH || "ffmpeg",
  outputDirectory,
  durationSeconds = defaultDurationSeconds,
} = {}) {
  if (!outputDirectory) {
    throw new Error("outputDirectory is required to generate videos.");
  }

  return async function generateVideo({
    requestId,
    template,
    requestContext,
    sceneDsl,
    visualPlan,
    componentGraph,
    timeline,
    creativeBrief,
    renderPass = "final",
  }) {
    const fileName = `${sanitizeFileName(requestId)}.mp4`;
    const outputPath = path.join(outputDirectory, fileName);
    const renderDuration = Math.min(
      Math.max(Number(timeline?.duration_sec) || durationSeconds, 1),
      60,
    );
    await fs.mkdir(outputDirectory, { recursive: true });

    if (componentGraph && timeline && !sceneDsl) {
      const outputFps = Math.min(Math.max(Number(timeline.fps) || 30, 24), 30);
      const defaultSourceFps = renderPass === "preview" ? 6 : renderDuration > 30 ? 8 : 12;
      const sourceFps = Math.min(
        Math.max(Number(process.env.RENDER_FRAME_FPS) || defaultSourceFps, 6),
        outputFps,
      );
      const frameDirectory = path.join(outputDirectory, ".frames", sanitizeFileName(requestId));
      const frameRender = await renderSvgFrames({
        frameDirectory,
        timeline,
        componentGraph,
        fps: sourceFps,
      });

      try {
        await execFileAsync(ffmpegPath, [
          "-hide_banner",
          "-loglevel",
          "error",
          "-y",
          "-framerate",
          String(frameRender.fps),
          "-i",
          path.join(frameDirectory, "frame-%04d.png"),
          "-t",
          String(renderDuration),
          "-r",
          String(outputFps),
          "-c:v",
          "libx264",
          "-pix_fmt",
          "yuv420p",
          "-movflags",
          "+faststart",
          outputPath,
        ]);
      } finally {
        await fs.rm(frameDirectory, { recursive: true, force: true });
      }

      return {
        conceptId: requestContext?.id ?? template?.id ?? requestId,
        renderer: "svg-component-ffmpeg",
        frameRenderer: "resvg-svg-components",
        renderPass,
        url: `/generated/${fileName}`,
        mimeType: "video/mp4",
        durationSeconds: renderDuration,
        generated: true,
        style: creativeBrief?.visual_style || "clean_dark_explainer svg component video",
        sceneCount: timeline?.shots?.length ?? 0,
        componentCount: componentGraph?.nodes?.length ?? 0,
        frameCount: frameRender.frameCount,
        sourceFps: frameRender.fps,
        fps: outputFps,
      };
    }

    const compiledSceneDsl = sceneDsl ?? compileSceneDslFromTimeline({
      timeline,
      componentGraph,
      creativeBrief,
    });
    const filter = buildSceneDslFilter(compiledSceneDsl, renderDuration);

    await execFileAsync(ffmpegPath, [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-f",
      "lavfi",
      "-i",
      `color=c=0x080c18:s=${width}x${height}:r=30:d=${renderDuration}`,
      "-vf",
      filter,
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      outputPath,
    ]);

    return {
      conceptId: requestContext?.id ?? template?.id ?? requestId,
      renderer: componentGraph ? "component-graph-ffmpeg" : "scene-dsl-ffmpeg",
      renderPass,
      patternId: visualPlan?.selected_pattern_id,
      url: `/generated/${fileName}`,
      mimeType: "video/mp4",
      durationSeconds: renderDuration,
      generated: true,
      style: compiledSceneDsl?.canvas?.style || "component graph visual explainer",
      sceneCount: compiledSceneDsl?.scenes?.length ?? 0,
      componentCount: componentGraph?.nodes?.length ?? 0,
    };
  };
}
