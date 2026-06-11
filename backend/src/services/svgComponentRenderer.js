import fs from "node:fs/promises";
import path from "node:path";
import { Resvg } from "@resvg/resvg-js";

const width = 1280;
const height = 720;
const safe = {
  left: 116,
  right: 1164,
  top: 78,
  bottom: 642,
};

const palette = {
  background: "#070B16",
  panel: "#0E1628",
  panel2: "#111C32",
  grid: "#23314D",
  muted: "#718096",
  text: "#F8FAFC",
  subdued: "#CBD5E1",
  cyan: "#7DD3FC",
  cyanSoft: "#38BDF8",
  yellow: "#FACC15",
  orange: "#FB923C",
  green: "#86EFAC",
  violet: "#C084FC",
  red: "#FB7185",
};

function clamp(value, min = 0, max = 1) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(Math.max(number, min), max);
}

function easeInOutCubic(t) {
  const x = clamp(t);
  return x < 0.5 ? 4 * x * x * x : 1 - ((-2 * x + 2) ** 3) / 2;
}

function easeOutCubic(t) {
  return 1 - (1 - clamp(t)) ** 3;
}

function pxX(value) {
  return safe.left + clamp(value) * (safe.right - safe.left);
}

function pxY(value) {
  return safe.top + clamp(value) * (safe.bottom - safe.top);
}

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function prop(node, key, fallback = "") {
  return String(node?.props?.[key] ?? fallback ?? "");
}

function colorForToken(token = "primary") {
  switch (String(token).toLowerCase()) {
    case "secondary":
    case "yellow":
      return palette.yellow;
    case "orange":
    case "tertiary":
      return palette.orange;
    case "green":
    case "success":
      return palette.green;
    case "violet":
    case "purple":
      return palette.violet;
    case "red":
    case "danger":
      return palette.red;
    default:
      return palette.cyan;
  }
}

function pathFromPoints(points) {
  if (!points.length) return "";
  const [first, ...rest] = points;
  return [
    `M ${first.x.toFixed(2)} ${first.y.toFixed(2)}`,
    ...rest.map((point) => `L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`),
  ].join(" ");
}

function valleyPoints() {
  return [
    { x: pxX(0.08), y: pxY(0.24) },
    { x: pxX(0.16), y: pxY(0.34) },
    { x: pxX(0.27), y: pxY(0.52) },
    { x: pxX(0.42), y: pxY(0.67) },
    { x: pxX(0.54), y: pxY(0.63) },
    { x: pxX(0.67), y: pxY(0.44) },
    { x: pxX(0.82), y: pxY(0.2) },
  ];
}

function risingCurvePoints() {
  return [
    { x: pxX(0.08), y: pxY(0.72) },
    { x: pxX(0.18), y: pxY(0.62) },
    { x: pxX(0.32), y: pxY(0.48) },
    { x: pxX(0.5), y: pxY(0.34) },
    { x: pxX(0.68), y: pxY(0.24) },
    { x: pxX(0.86), y: pxY(0.2) },
  ];
}

function pointOnPolyline(points, progress) {
  if (points.length === 0) return { x: pxX(0.5), y: pxY(0.5) };
  if (points.length === 1) return points[0];
  const scaled = clamp(progress) * (points.length - 1);
  const index = Math.min(Math.floor(scaled), points.length - 2);
  const local = scaled - index;
  const start = points[index];
  const end = points[index + 1];
  return {
    x: start.x + (end.x - start.x) * local,
    y: start.y + (end.y - start.y) * local,
  };
}

function defs() {
  return `
    <defs>
      <radialGradient id="bgGlow" cx="50%" cy="38%" r="65%">
        <stop offset="0%" stop-color="#12203A"/>
        <stop offset="52%" stop-color="#0A1020"/>
        <stop offset="100%" stop-color="#060914"/>
      </radialGradient>
      <linearGradient id="cyanStroke" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="${palette.cyan}"/>
        <stop offset="100%" stop-color="${palette.violet}"/>
      </linearGradient>
      <linearGradient id="warmStroke" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="${palette.yellow}"/>
        <stop offset="100%" stop-color="${palette.orange}"/>
      </linearGradient>
      <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="7" result="blur"/>
        <feMerge>
          <feMergeNode in="blur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
      <filter id="deepShadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="16" stdDeviation="20" flood-color="#000000" flood-opacity="0.35"/>
      </filter>
      <marker id="arrowHead" markerWidth="12" markerHeight="12" refX="9" refY="5" orient="auto">
        <path d="M 0 0 L 10 5 L 0 10 z" fill="${palette.orange}"/>
      </marker>
    </defs>
  `;
}

function background() {
  const grid = [];
  for (let x = safe.left; x <= safe.right; x += 72) {
    grid.push(`<line x1="${x}" y1="${safe.top}" x2="${x}" y2="${safe.bottom}" stroke="${palette.grid}" stroke-opacity="0.18" stroke-width="1"/>`);
  }
  for (let y = safe.top; y <= safe.bottom; y += 72) {
    grid.push(`<line x1="${safe.left}" y1="${y}" x2="${safe.right}" y2="${y}" stroke="${palette.grid}" stroke-opacity="0.14" stroke-width="1"/>`);
  }

  return `
    <rect width="${width}" height="${height}" fill="url(#bgGlow)"/>
    <circle cx="260" cy="152" r="210" fill="${palette.cyan}" opacity="0.045"/>
    <circle cx="1060" cy="520" r="260" fill="${palette.violet}" opacity="0.05"/>
    <g>${grid.join("")}</g>
    <rect x="64" y="42" width="1152" height="636" rx="28" fill="none" stroke="#1F2A44" stroke-width="1.5" opacity="0.78"/>
  `;
}

function text({
  x,
  y,
  value,
  size = 34,
  fill = palette.text,
  weight = 600,
  opacity = 1,
  anchor = "start",
  maxChars = 58,
}) {
  const lines = wrapText(value, maxChars).slice(0, 2);
  return `
    <text x="${x}" y="${y}" fill="${fill}" font-family="Manrope, Inter, Arial, sans-serif" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" opacity="${opacity}" letter-spacing="0">
      ${lines.map((line, index) => `<tspan x="${x}" dy="${index === 0 ? 0 : size * 1.2}">${escapeXml(line)}</tspan>`).join("")}
    </text>
  `;
}

function wrapText(value, maxChars) {
  const words = String(value || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";
  for (const word of words) {
    if (`${current} ${word}`.trim().length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = `${current} ${word}`.trim();
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function titleCard(node, shot, progress) {
  const title = prop(node, "title", shot.visual_goal || "Visual idea");
  const subtitle = prop(node, "subtitle", node.narration || shot.narration || "");
  const reveal = easeOutCubic(progress);
  const y = 252 - 18 * (1 - reveal);
  return `
    <g opacity="${reveal.toFixed(3)}" filter="url(#deepShadow)">
      <rect x="158" y="174" width="788" height="286" rx="26" fill="${palette.panel}" stroke="#273556" stroke-width="1.5" opacity="0.86"/>
      <path d="M 196 420 C 350 330 515 510 706 360 C 784 298 842 290 908 320" fill="none" stroke="url(#cyanStroke)" stroke-width="5" stroke-linecap="round" filter="url(#softGlow)" opacity="0.76"/>
      ${text({ x: 208, y, value: title, size: 70, fill: palette.text, weight: 800, maxChars: 28 })}
      ${subtitle ? text({ x: 214, y: y + 86, value: subtitle, size: 31, fill: palette.yellow, weight: 650, maxChars: 42 }) : ""}
    </g>
  `;
}

function axes() {
  return `
    <g opacity="0.72">
      <line x1="${pxX(0.08)}" y1="${pxY(0.76)}" x2="${pxX(0.9)}" y2="${pxY(0.76)}" stroke="${palette.muted}" stroke-width="2.4"/>
      <line x1="${pxX(0.16)}" y1="${pxY(0.82)}" x2="${pxX(0.16)}" y2="${pxY(0.12)}" stroke="${palette.muted}" stroke-width="2.4"/>
    </g>
  `;
}

function graphPlot(node, shot, progress) {
  const points = risingCurvePoints();
  const path = pathFromPoints(points);
  const draw = easeInOutCubic(progress);
  const caption = prop(node, "caption", shot.visual_goal || "");
  return `
    <g>
      ${axes()}
      <path d="${path}" fill="none" stroke="#10203A" stroke-width="15" stroke-linecap="round" opacity="0.85"/>
      <path d="${path}" fill="none" stroke="url(#cyanStroke)" stroke-width="6" stroke-linecap="round" filter="url(#softGlow)" pathLength="1" stroke-dasharray="${draw} ${Math.max(0, 1 - draw)}"/>
      <circle cx="${pxX(0.34)}" cy="${pxY(0.47)}" r="${8 + 6 * draw}" fill="${palette.yellow}" opacity="${draw}" filter="url(#softGlow)"/>
      ${caption ? text({ x: 728, y: 156, value: caption, size: 30, fill: palette.subdued, weight: 600, opacity: Math.min(1, draw + 0.1), maxChars: 36 }) : ""}
    </g>
  `;
}

function movingPoint(node, shot, progress) {
  const points = valleyPoints();
  const curve = pathFromPoints(points);
  const travel = easeInOutCubic(progress);
  const point = pointOnPolyline(points.slice(0, 6), travel);
  const caption = prop(node, "caption", shot.narration || node.narration || shot.visual_goal);
  const trailPoints = [];
  for (let step = 0; step <= 14; step += 1) {
    trailPoints.push(pointOnPolyline(points.slice(0, 6), travel * (step / 14)));
  }

  return `
    <g>
      ${axes()}
      <path d="${curve}" fill="none" stroke="#0F1E35" stroke-width="18" stroke-linecap="round" opacity="0.92"/>
      <path d="${curve}" fill="none" stroke="url(#cyanStroke)" stroke-width="6" stroke-linecap="round" filter="url(#softGlow)" opacity="0.88"/>
      <path d="${pathFromPoints(trailPoints)}" fill="none" stroke="url(#warmStroke)" stroke-width="5" stroke-linecap="round" opacity="0.92" filter="url(#softGlow)"/>
      <line x1="${point.x - 74}" y1="${point.y - 46}" x2="${point.x - 18}" y2="${point.y - 10}" stroke="${palette.orange}" stroke-width="5" stroke-linecap="round" marker-end="url(#arrowHead)" opacity="0.9"/>
      <circle cx="${point.x}" cy="${point.y}" r="24" fill="${palette.yellow}" opacity="0.14" filter="url(#softGlow)"/>
      <circle cx="${point.x}" cy="${point.y}" r="12" fill="${palette.yellow}" filter="url(#softGlow)"/>
      ${text({ x: 710, y: 154, value: caption, size: 30, fill: palette.text, weight: 650, opacity: 0.95, maxChars: 36 })}
      ${text({ x: 710, y: 224, value: "move opposite the uphill slope", size: 23, fill: palette.orange, weight: 700, opacity: 0.85, maxChars: 38 })}
    </g>
  `;
}

function formulaReveal(node, shot, progress) {
  const formula = prop(node, "formula", prop(node, "final_equation", "idea"));
  const caption = prop(node, "caption", node.narration || shot.narration || "");
  const reveal = easeOutCubic(progress);
  return `
    <g opacity="${reveal.toFixed(3)}" filter="url(#deepShadow)">
      <rect x="228" y="176" width="824" height="326" rx="30" fill="${palette.panel}" stroke="#2B3B61" stroke-width="1.5" opacity="0.9"/>
      <rect x="278" y="244" width="724" height="118" rx="22" fill="${palette.panel2}" stroke="${palette.cyan}" stroke-opacity="0.34"/>
      ${text({ x: 640, y: 321, value: formula, size: 50, fill: palette.text, weight: 800, anchor: "middle", maxChars: 34 })}
      ${caption ? text({ x: 318, y: 420, value: caption, size: 30, fill: palette.cyan, weight: 650, maxChars: 48 }) : ""}
    </g>
  `;
}

function slopeTriangle(node, shot, progress) {
  const reveal = easeInOutCubic(progress);
  const x1 = pxX(0.26);
  const y1 = pxY(0.62);
  const x2 = pxX(0.72);
  const y2 = pxY(0.28);
  return `
    <g>
      ${axes()}
      <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${palette.yellow}" stroke-width="6" stroke-linecap="round" filter="url(#softGlow)" opacity="${reveal}"/>
      <line x1="${x1 + 72}" y1="${y1 - 42}" x2="${x2 - 70}" y2="${y1 - 42}" stroke="${palette.cyan}" stroke-width="5" stroke-linecap="round" opacity="${reveal}"/>
      <line x1="${x2 - 70}" y1="${y1 - 42}" x2="${x2 - 70}" y2="${y2 + 44}" stroke="${palette.orange}" stroke-width="5" stroke-linecap="round" opacity="${reveal}"/>
      <circle cx="${x1}" cy="${y1}" r="11" fill="${palette.cyan}" filter="url(#softGlow)"/>
      <circle cx="${x2}" cy="${y2}" r="11" fill="${palette.yellow}" filter="url(#softGlow)"/>
      ${text({ x: 756, y: 170, value: prop(node, "caption", shot.visual_goal), size: 30, fill: palette.text, weight: 650, opacity: reveal, maxChars: 36 })}
    </g>
  `;
}

function riemannRectangles(node, shot, progress) {
  const reveal = easeInOutCubic(progress);
  const rects = [0.18, 0.29, 0.4, 0.51, 0.62].map((x, index) => {
    const top = [0.62, 0.54, 0.46, 0.38, 0.31][index];
    const opacity = Math.max(0, Math.min(1, reveal * 6 - index));
    return `<rect x="${pxX(x)}" y="${pxY(top)}" width="74" height="${pxY(0.76) - pxY(top)}" fill="${palette.green}" opacity="${0.12 + opacity * 0.18}" stroke="${palette.green}" stroke-width="2"/>`;
  }).join("");
  return `
    <g>
      ${axes()}
      <path d="${pathFromPoints(risingCurvePoints())}" fill="none" stroke="url(#cyanStroke)" stroke-width="6" stroke-linecap="round" filter="url(#softGlow)"/>
      ${rects}
      ${text({ x: 738, y: 158, value: prop(node, "caption", shot.visual_goal), size: 30, fill: palette.text, weight: 650, maxChars: 36 })}
    </g>
  `;
}

function visualRecap(node, shot, progress) {
  const reveal = easeOutCubic(progress);
  const message = prop(node, "message", prop(node, "caption", shot.visual_goal || node.narration));
  const formula = prop(node, "formula", prop(node, "takeaway", "small stable steps"));
  return `
    <g opacity="${reveal.toFixed(3)}">
      <rect x="196" y="156" width="888" height="390" rx="34" fill="${palette.panel}" stroke="#293A61" opacity="0.9" filter="url(#deepShadow)"/>
      <circle cx="278" cy="252" r="26" fill="${palette.cyan}" opacity="0.2" filter="url(#softGlow)"/>
      <circle cx="278" cy="252" r="10" fill="${palette.cyan}"/>
      ${text({ x: 334, y: 270, value: message, size: 44, fill: palette.text, weight: 800, maxChars: 42 })}
      <path d="M 334 400 C 450 360 560 438 684 384 C 764 350 832 360 930 426" fill="none" stroke="url(#cyanStroke)" stroke-width="5" stroke-linecap="round" opacity="0.65" filter="url(#softGlow)"/>
      ${text({ x: 334, y: 472, value: formula, size: 34, fill: palette.yellow, weight: 800, maxChars: 36 })}
    </g>
  `;
}

function genericDiagram(node, shot, progress) {
  const reveal = easeInOutCubic(progress);
  return `
    <g opacity="${reveal}">
      <rect x="246" y="198" width="300" height="210" rx="26" fill="${palette.panel}" stroke="${palette.cyan}" stroke-opacity="0.38"/>
      <rect x="736" y="234" width="260" height="172" rx="26" fill="${palette.panel2}" stroke="${palette.yellow}" stroke-opacity="0.45"/>
      <path d="M 552 304 C 624 260 664 372 730 316" fill="none" stroke="${palette.orange}" stroke-width="6" stroke-linecap="round" marker-end="url(#arrowHead)" filter="url(#softGlow)"/>
      ${text({ x: 306, y: 324, value: prop(node, "idea", shot.visual_goal), size: 30, fill: palette.text, weight: 650, maxChars: 24 })}
    </g>
  `;
}

function componentMarkup(node, shot, progress) {
  switch (node.component) {
    case "HookTitle":
      return titleCard(node, shot, progress);
    case "GraphPlot":
    case "GraphLocalZoom":
    case "TangentReveal":
      return graphPlot(node, shot, progress);
    case "MovingPoint":
      return movingPoint(node, shot, progress);
    case "FormulaReveal":
    case "AreaRearrangementProof":
      return formulaReveal(node, shot, progress);
    case "SlopeTriangle":
    case "RightTriangleLabeling":
      return slopeTriangle(node, shot, progress);
    case "RiemannRectangles":
      return riemannRectangles(node, shot, progress);
    case "VisualRecap":
      return visualRecap(node, shot, progress);
    default:
      return genericDiagram(node, shot, progress);
  }
}

function activeShot(timeline, second) {
  const shots = timeline?.shots ?? [];
  return shots.find((shot) => second >= shot.start_sec && second < shot.end_sec)
    ?? shots[shots.length - 1];
}

export function renderTimelineFrameSvg({ timeline, componentGraph, second }) {
  const shot = activeShot(timeline, second);
  const nodesById = new Map((componentGraph?.nodes ?? []).map((node) => [node.id, node]));
  const node = nodesById.get(shot?.node_id) ?? componentGraph?.nodes?.[0] ?? {
    id: "fallback",
    component: "GenericDiagram",
    props: { idea: "Visual explanation" },
  };
  const shotDuration = Math.max((shot?.end_sec ?? 1) - (shot?.start_sec ?? 0), 0.5);
  const progress = clamp((second - (shot?.start_sec ?? 0)) / shotDuration);

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      ${defs()}
      ${background()}
      ${componentMarkup(node, shot, progress)}
    </svg>
  `;
}

export async function renderSvgFrames({ frameDirectory, timeline, componentGraph, fps = 30 }) {
  await fs.rm(frameDirectory, { recursive: true, force: true });
  await fs.mkdir(frameDirectory, { recursive: true });
  const duration = Math.min(Math.max(Number(timeline?.duration_sec) || 24, 1), 60);
  const frameCount = Math.max(1, Math.round(duration * fps));

  for (let index = 0; index < frameCount; index += 1) {
    const second = index / fps;
    const svg = renderTimelineFrameSvg({ timeline, componentGraph, second });
    const png = new Resvg(svg, {
      fitTo: {
        mode: "width",
        value: width,
      },
    }).render().asPng();
    await fs.writeFile(path.join(frameDirectory, `frame-${String(index + 1).padStart(4, "0")}.png`), png);
  }

  return { frameCount, fps, durationSeconds: duration };
}
