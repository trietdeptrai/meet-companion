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

function formatMathText(value) {
  return String(value ?? "")
    .replace(/\\mathbf\{([^{}]+)\}/g, "$1")
    .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, "$1 / $2")
    .replace(/\\lim_\{([^{}]+)\}/g, "lim($1)")
    .replace(/\\sum_\{([^{}]+)\}\^\{([^{}]+)\}/g, "Σ($1 to $2)")
    .replace(/\\sum_\{([^{}]+)\}\^([A-Za-z0-9]+)/g, "Σ($1 to $2)")
    .replace(/\\int_([A-Za-z0-9])\^([A-Za-z0-9])/g, "∫[$1,$2]")
    .replace(/\\to/g, "->")
    .replace(/\\infty/g, "∞")
    .replace(/\\,/g, "")
    .replace(/\\;/g, " ")
    .replace(/\\!/g, "")
    .replace(/\\left/g, "")
    .replace(/\\right/g, "")
    .replace(/\\cdot/g, "·")
    .replace(/\\times/g, "x")
    .replace(/\\eta/g, "eta")
    .replace(/\\theta/g, "theta")
    .replace(/\\alpha/g, "alpha")
    .replace(/\\beta/g, "beta")
    .replace(/\\gamma/g, "gamma")
    .replace(/\\lambda/g, "lambda")
    .replace(/\\Delta/g, "Δ")
    .replace(/\\nabla/g, "grad")
    .replace(/\\int/g, "∫")
    .replace(/\\sum/g, "Σ")
    .replace(/\\pi/g, "pi")
    .replace(/\\sqrt/g, "√")
    .replace(/<-/g, "←")
    .replace(/->/g, "→")
    .replace(/_\{([^{}]+)\}/g, "($1)")
    .replace(/\^\{([^{}]+)\}/g, "^$1")
    .replace(/_([A-Za-z0-9+\-=()])/g, "($1)")
    .replace(/\^([A-Za-z0-9+\-=()])/g, "^$1")
    .replace(/\b(eta|alpha|lambda)\s+grad\b/g, "$1 * grad")
    .replace(/x\(i\)/g, "x_i")
    .replace(/\)Δ/g, ") Δ")
    .replace(/\)dx/g, ") dx")
    .replace(/\\/g, "")
    .replace(/\s+/g, " ")
    .trim();
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
  maxLines = 2,
}) {
  const lines = wrapText(value, maxChars).slice(0, maxLines);
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
    <g data-component="GraphPlot">
      ${axes()}
      <path d="${path}" fill="none" stroke="#10203A" stroke-width="15" stroke-linecap="round" opacity="0.85"/>
      <path d="${path}" fill="none" stroke="url(#cyanStroke)" stroke-width="6" stroke-linecap="round" filter="url(#softGlow)" pathLength="1" stroke-dasharray="${draw} ${Math.max(0, 1 - draw)}"/>
      <circle cx="${pxX(0.34)}" cy="${pxY(0.47)}" r="${8 + 6 * draw}" fill="${palette.yellow}" opacity="${draw}" filter="url(#softGlow)"/>
      ${caption ? text({ x: 728, y: 156, value: caption, size: 30, fill: palette.subdued, weight: 600, opacity: Math.min(1, draw + 0.1), maxChars: 36 }) : ""}
    </g>
  `;
}

function graphLocalZoom(node, shot, progress) {
  const points = risingCurvePoints();
  const path = pathFromPoints(points);
  const reveal = easeInOutCubic(progress);
  const focus = pointOnPolyline(points, 0.44);
  const zoomScale = 1 + reveal * 1.4;
  const caption = prop(node, "caption", "zoom in until the curve looks straight");
  return `
    <g data-component="GraphLocalZoom">
      ${axes()}
      <path d="${path}" fill="none" stroke="url(#cyanStroke)" stroke-width="6" stroke-linecap="round" filter="url(#softGlow)" opacity="0.86"/>
      <rect x="${focus.x - 82 - reveal * 18}" y="${focus.y - 82 - reveal * 18}" width="${164 + reveal * 36}" height="${164 + reveal * 36}" rx="24" fill="${palette.panel}" stroke="${palette.yellow}" stroke-width="4" opacity="${0.26 + reveal * 0.26}"/>
      <circle cx="${focus.x}" cy="${focus.y}" r="12" fill="${palette.yellow}" filter="url(#softGlow)"/>
      <g transform="translate(758 206) scale(${zoomScale.toFixed(3)}) translate(-758 -206)" opacity="${0.2 + reveal * 0.8}">
        <rect x="668" y="126" width="282" height="212" rx="28" fill="${palette.panel2}" stroke="${palette.cyan}" stroke-opacity="0.34" filter="url(#deepShadow)"/>
        <path d="M 704 272 C 758 236 824 214 914 180" fill="none" stroke="url(#cyanStroke)" stroke-width="7" stroke-linecap="round" filter="url(#softGlow)"/>
        <line x1="708" y1="272" x2="920" y2="180" stroke="${palette.yellow}" stroke-width="4" stroke-linecap="round" opacity="${reveal}"/>
      </g>
      ${text({ x: 734, y: 414, value: caption, size: 27, fill: palette.text, weight: 650, opacity: 0.92, maxChars: 34 })}
      ${text({ x: 734, y: 464, value: "local view -> almost a line", size: 23, fill: palette.yellow, weight: 760, opacity: reveal, maxChars: 32 })}
    </g>
  `;
}

function tangentReveal(node, shot, progress) {
  const points = risingCurvePoints();
  const path = pathFromPoints(points);
  const reveal = easeInOutCubic(progress);
  const focus = pointOnPolyline(points, 0.44);
  const x1 = focus.x - 196;
  const y1 = focus.y + 96;
  const x2 = focus.x + 230;
  const y2 = focus.y - 114;
  return `
    <g data-component="TangentReveal">
      ${axes()}
      <path d="${path}" fill="none" stroke="#10203A" stroke-width="15" stroke-linecap="round" opacity="0.85"/>
      <path d="${path}" fill="none" stroke="url(#cyanStroke)" stroke-width="6" stroke-linecap="round" filter="url(#softGlow)" opacity="0.88"/>
      <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${palette.yellow}" stroke-width="7" stroke-linecap="round" filter="url(#softGlow)" opacity="${reveal}"/>
      <circle cx="${focus.x}" cy="${focus.y}" r="${12 + reveal * 8}" fill="${palette.yellow}" opacity="0.95" filter="url(#softGlow)"/>
      ${text({ x: 748, y: 166, value: prop(node, "caption", "the tangent is the local straight-line model"), size: 30, fill: palette.text, weight: 700, opacity: 0.95, maxChars: 35 })}
      ${text({ x: 748, y: 246, value: "slope here = derivative", size: 27, fill: palette.yellow, weight: 800, opacity: reveal, maxChars: 31 })}
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
  const formula = formatMathText(prop(node, "formula", prop(node, "final_equation", "idea")));
  const caption = prop(node, "caption", node.narration || shot.narration || "");
  const reveal = easeOutCubic(progress);
  const formulaSize = formula.length > 72 ? 34 : formula.length > 44 ? 41 : 50;
  const formulaMaxChars = formula.length > 72 ? 42 : formula.length > 44 ? 38 : 34;
  return `
    <g opacity="${reveal.toFixed(3)}" filter="url(#deepShadow)">
      <rect x="228" y="176" width="824" height="326" rx="30" fill="${palette.panel}" stroke="#2B3B61" stroke-width="1.5" opacity="0.9"/>
      <rect x="278" y="228" width="724" height="166" rx="22" fill="${palette.panel2}" stroke="${palette.cyan}" stroke-opacity="0.34"/>
      ${text({ x: 640, y: 300, value: formula, size: formulaSize, fill: palette.text, weight: 800, anchor: "middle", maxChars: formulaMaxChars, maxLines: 3 })}
      ${caption ? text({ x: 318, y: 438, value: caption, size: 30, fill: palette.cyan, weight: 650, maxChars: 48 }) : ""}
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
    <g data-component="RiemannRectangles">
      ${axes()}
      <path d="${pathFromPoints(risingCurvePoints())}" fill="none" stroke="url(#cyanStroke)" stroke-width="6" stroke-linecap="round" filter="url(#softGlow)"/>
      ${rects}
      ${text({ x: 738, y: 158, value: prop(node, "caption", shot.visual_goal), size: 30, fill: palette.text, weight: 650, maxChars: 36 })}
    </g>
  `;
}

function areaFillReveal(node, shot, progress) {
  const reveal = easeInOutCubic(progress);
  const points = risingCurvePoints();
  const baseline = pxY(0.76);
  const visibleCount = Math.max(2, Math.round(2 + (points.length - 2) * reveal));
  const visiblePoints = points.slice(0, visibleCount);
  const start = visiblePoints[0];
  const end = visiblePoints[visiblePoints.length - 1];
  const areaPath = [
    `M ${start.x.toFixed(2)} ${baseline.toFixed(2)}`,
    ...visiblePoints.map((point) => `L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`),
    `L ${end.x.toFixed(2)} ${baseline.toFixed(2)}`,
    "Z",
  ].join(" ");
  const rects = [0.2, 0.31, 0.42, 0.53, 0.64, 0.75].map((x, index) => {
    const top = [0.62, 0.55, 0.47, 0.39, 0.32, 0.27][index];
    const fade = clamp(1 - reveal * 1.25);
    return `<rect x="${pxX(x)}" y="${pxY(top)}" width="58" height="${baseline - pxY(top)}" fill="${palette.green}" opacity="${fade * 0.16}" stroke="${palette.green}" stroke-opacity="${fade * 0.38}" stroke-width="2"/>`;
  }).join("");
  const bounds = prop(node, "bounds", "a to b");
  return `
    <g data-component="AreaFillReveal">
      ${axes()}
      ${rects}
      <path d="${areaPath}" fill="${palette.green}" opacity="${(0.12 + reveal * 0.28).toFixed(3)}" stroke="${palette.green}" stroke-width="3" stroke-opacity="${reveal.toFixed(3)}" filter="url(#softGlow)"/>
      <path d="${pathFromPoints(points)}" fill="none" stroke="url(#cyanStroke)" stroke-width="6" stroke-linecap="round" filter="url(#softGlow)"/>
      <line x1="${pxX(0.18)}" y1="${baseline}" x2="${pxX(0.86)}" y2="${baseline}" stroke="${palette.muted}" stroke-width="2"/>
      <circle cx="${pxX(0.18)}" cy="${baseline}" r="6" fill="${palette.yellow}"/>
      <circle cx="${pxX(0.86)}" cy="${baseline}" r="6" fill="${palette.yellow}"/>
      ${text({ x: 726, y: 152, value: prop(node, "caption", shot.visual_goal), size: 30, fill: palette.text, weight: 700, maxChars: 36 })}
      ${text({ x: 726, y: 228, value: `bounds: ${bounds}`, size: 24, fill: palette.yellow, weight: 760, opacity: 0.85, maxChars: 32 })}
    </g>
  `;
}

function transformedPoint(x, y, progress) {
  const reveal = easeInOutCubic(progress);
  const shear = 0.22 * reveal;
  const stretchX = 1 + 0.12 * reveal;
  const stretchY = 1 - 0.08 * reveal;
  const centeredX = (x - 0.5) * stretchX;
  const centeredY = (y - 0.5) * stretchY;
  return {
    x: pxX(0.5 + centeredX + centeredY * shear),
    y: pxY(0.5 + centeredY),
  };
}

function linearTransformGrid(node, shot, progress) {
  const transform = prop(node, "transform", "shear and stretch");
  const caption = prop(node, "caption", shot.visual_goal);
  const compactTransform = transform.length > 34 ? "linear map" : transform;
  const compactCaption = caption.length > 56 ? "same rule for every point" : caption;
  const gridLines = [];
  for (let index = 0; index <= 6; index += 1) {
    const value = 0.18 + index * 0.105;
    const verticalStart = transformedPoint(value, 0.18, progress);
    const verticalEnd = transformedPoint(value, 0.82, progress);
    const horizontalStart = transformedPoint(0.18, value, progress);
    const horizontalEnd = transformedPoint(0.82, value, progress);
    gridLines.push(`<line x1="${verticalStart.x}" y1="${verticalStart.y}" x2="${verticalEnd.x}" y2="${verticalEnd.y}" stroke="${palette.cyan}" stroke-width="2" stroke-opacity="0.42"/>`);
    gridLines.push(`<line x1="${horizontalStart.x}" y1="${horizontalStart.y}" x2="${horizontalEnd.x}" y2="${horizontalEnd.y}" stroke="${palette.cyan}" stroke-width="2" stroke-opacity="0.26"/>`);
  }
  const origin = transformedPoint(0.5, 0.5, progress);
  const basisI = transformedPoint(0.68, 0.5, progress);
  const basisJ = transformedPoint(0.5, 0.32, progress);

  return `
    <g data-component="LinearTransformGrid">
      <rect x="182" y="104" width="710" height="492" rx="28" fill="${palette.panel}" stroke="#26385B" opacity="0.52"/>
      <g filter="url(#softGlow)">${gridLines.join("")}</g>
      <line x1="${origin.x}" y1="${origin.y}" x2="${basisI.x}" y2="${basisI.y}" stroke="${palette.yellow}" stroke-width="7" stroke-linecap="round" marker-end="url(#arrowHead)"/>
      <line x1="${origin.x}" y1="${origin.y}" x2="${basisJ.x}" y2="${basisJ.y}" stroke="${palette.orange}" stroke-width="7" stroke-linecap="round" marker-end="url(#arrowHead)"/>
      <circle cx="${origin.x}" cy="${origin.y}" r="9" fill="${palette.text}"/>
      ${text({ x: 856, y: 170, value: compactTransform, size: 32, fill: palette.text, weight: 800, maxChars: 18 })}
      ${text({ x: 856, y: 230, value: compactCaption, size: 25, fill: palette.cyan, weight: 650, maxChars: 24 })}
    </g>
  `;
}

function basisVectorReveal(node, shot, progress) {
  const reveal = easeInOutCubic(progress);
  const origin = transformedPoint(0.44, 0.58, 0);
  const originalI = transformedPoint(0.62, 0.58, 0);
  const originalJ = transformedPoint(0.44, 0.38, 0);
  const newI = transformedPoint(0.68, 0.58, reveal);
  const newJ = transformedPoint(0.44, 0.32, reveal);
  const matrix = formatMathText(prop(node, "matrix", "A"));
  return `
    <g data-component="BasisVectorReveal">
      <rect x="166" y="106" width="688" height="490" rx="28" fill="${palette.panel}" stroke="#26385B" opacity="0.54"/>
      <g filter="url(#softGlow)">
        ${miniGrid({ x: 214, y: 170, width: 500, height: 320, transformed: reveal > 0.45 })}
      </g>
      <line x1="${origin.x}" y1="${origin.y}" x2="${originalI.x}" y2="${originalI.y}" stroke="${palette.muted}" stroke-width="5" stroke-linecap="round" marker-end="url(#arrowHead)" opacity="${(1 - reveal * 0.65).toFixed(3)}"/>
      <line x1="${origin.x}" y1="${origin.y}" x2="${originalJ.x}" y2="${originalJ.y}" stroke="${palette.muted}" stroke-width="5" stroke-linecap="round" marker-end="url(#arrowHead)" opacity="${(1 - reveal * 0.65).toFixed(3)}"/>
      <line x1="${origin.x}" y1="${origin.y}" x2="${newI.x}" y2="${newI.y}" stroke="${palette.yellow}" stroke-width="8" stroke-linecap="round" marker-end="url(#arrowHead)" filter="url(#softGlow)"/>
      <line x1="${origin.x}" y1="${origin.y}" x2="${newJ.x}" y2="${newJ.y}" stroke="${palette.orange}" stroke-width="8" stroke-linecap="round" marker-end="url(#arrowHead)" filter="url(#softGlow)"/>
      <circle cx="${origin.x}" cy="${origin.y}" r="9" fill="${palette.text}"/>
      ${text({ x: 776, y: 168, value: matrix, size: 42, fill: palette.text, weight: 850, maxChars: 18 })}
      ${text({ x: 776, y: 240, value: prop(node, "caption", "basis vectors define the whole transformation"), size: 28, fill: palette.cyan, weight: 650, maxChars: 28 })}
      ${text({ x: newI.x + 14, y: newI.y - 10, value: "A e1", size: 22, fill: palette.yellow, weight: 800, maxChars: 8 })}
      ${text({ x: newJ.x + 14, y: newJ.y - 10, value: "A e2", size: 22, fill: palette.orange, weight: 800, maxChars: 8 })}
    </g>
  `;
}

function vectorTransform(node, shot, progress) {
  const reveal = easeInOutCubic(progress);
  const origin = { x: pxX(0.3), y: pxY(0.62) };
  const start = { x: pxX(0.47), y: pxY(0.44) };
  const end = {
    x: start.x + 128 * reveal,
    y: start.y - 72 * reveal,
  };
  return `
    <g data-component="VectorTransform">
      <rect x="168" y="112" width="944" height="472" rx="28" fill="${palette.panel}" stroke="#26385B" opacity="0.62"/>
      <g opacity="0.48" filter="url(#softGlow)">${miniGrid({ x: 222, y: 182, width: 440, height: 280, transformed: false })}</g>
      <g opacity="${(0.3 + reveal * 0.65).toFixed(3)}" filter="url(#softGlow)">${miniGrid({ x: 642, y: 158, width: 360, height: 280, transformed: true })}</g>
      <line x1="${origin.x}" y1="${origin.y}" x2="${start.x}" y2="${start.y}" stroke="${palette.cyan}" stroke-width="8" stroke-linecap="round" marker-end="url(#arrowHead)" filter="url(#softGlow)" opacity="${(1 - reveal * 0.35).toFixed(3)}"/>
      <line x1="${origin.x}" y1="${origin.y}" x2="${end.x}" y2="${end.y}" stroke="${palette.yellow}" stroke-width="8" stroke-linecap="round" marker-end="url(#arrowHead)" filter="url(#softGlow)"/>
      <path d="M ${start.x + 22} ${start.y - 18} C ${start.x + 112} ${start.y - 88}, ${end.x - 66} ${end.y - 84}, ${end.x - 8} ${end.y - 10}" fill="none" stroke="${palette.orange}" stroke-width="5" stroke-linecap="round" marker-end="url(#arrowHead)" opacity="${reveal.toFixed(3)}"/>
      ${text({ x: 782, y: 166, value: `${formatMathText(prop(node, "vector", "x"))} -> ${formatMathText(prop(node, "result", "A x"))}`, size: 38, fill: palette.text, weight: 850, maxChars: 22 })}
      ${text({ x: 782, y: 238, value: prop(node, "caption", shot.visual_goal), size: 27, fill: palette.cyan, weight: 650, maxChars: 28 })}
    </g>
  `;
}

function miniGrid({ x, y, width: boxWidth, height: boxHeight, transformed = false }) {
  const lines = [];
  for (let index = 0; index <= 5; index += 1) {
    const p = index / 5;
    const x1 = x + p * boxWidth;
    const y1 = y;
    const x2 = transformed ? x + p * boxWidth + 42 : x + p * boxWidth;
    const y2 = y + boxHeight;
    const hx1 = x;
    const hy1 = y + p * boxHeight;
    const hx2 = x + boxWidth;
    const hy2 = transformed ? y + p * boxHeight - 34 * (p - 0.5) : y + p * boxHeight;
    lines.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${palette.cyan}" stroke-opacity="0.34" stroke-width="2"/>`);
    lines.push(`<line x1="${hx1}" y1="${hy1}" x2="${hx2}" y2="${hy2}" stroke="${palette.cyan}" stroke-opacity="0.22" stroke-width="2"/>`);
  }
  return lines.join("");
}

function splitScreenComparison(node, shot, progress) {
  const reveal = easeOutCubic(progress);
  const left = prop(node, "left", "before");
  const right = prop(node, "right", "after");
  const caption = prop(node, "caption", shot.visual_goal);

  return `
    <g data-component="SplitScreenComparison" opacity="${reveal.toFixed(3)}">
      <rect x="158" y="126" width="430" height="360" rx="28" fill="${palette.panel}" stroke="#2B3B61" opacity="0.88"/>
      <rect x="692" y="126" width="430" height="360" rx="28" fill="${palette.panel}" stroke="#2B3B61" opacity="0.88"/>
      ${text({ x: 204, y: 190, value: left, size: 34, fill: palette.text, weight: 800, maxChars: 18 })}
      ${text({ x: 738, y: 190, value: right, size: 34, fill: palette.text, weight: 800, maxChars: 18 })}
      <g filter="url(#softGlow)">${miniGrid({ x: 214, y: 226, width: 300, height: 190 })}</g>
      <g filter="url(#softGlow)">${miniGrid({ x: 748, y: 226, width: 300, height: 190, transformed: true })}</g>
      <circle cx="364" cy="322" r="8" fill="${palette.yellow}"/>
      <circle cx="940" cy="322" r="8" fill="${palette.yellow}"/>
      <path d="M 602 306 C 628 288 656 288 682 306" fill="none" stroke="${palette.orange}" stroke-width="6" stroke-linecap="round" marker-end="url(#arrowHead)" filter="url(#softGlow)"/>
      ${text({ x: 300, y: 570, value: caption, size: 30, fill: palette.cyan, weight: 650, maxChars: 46 })}
    </g>
  `;
}

function contourEllipse(cx, cy, rx, ry, opacity) {
  return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="none" stroke="${palette.cyan}" stroke-width="2.4" stroke-opacity="${opacity}"/>`;
}

function lossLandscape2D(node, shot, progress) {
  const reveal = easeOutCubic(progress);
  const cx = pxX(0.43);
  const cy = pxY(0.55);
  const contours = [0, 1, 2, 3, 4].map((index) => contourEllipse(
    cx + index * 18,
    cy - index * 14,
    96 + index * 44,
    38 + index * 28,
    0.52 - index * 0.065,
  )).join("");
  const point = {
    x: pxX(0.34 + 0.18 * reveal),
    y: pxY(0.3 + 0.2 * reveal),
  };
  return `
    <g data-component="LossLandscape2D">
      <rect x="156" y="110" width="716" height="482" rx="30" fill="${palette.panel}" stroke="#26385B" opacity="0.58"/>
      <g transform="rotate(-16 ${cx} ${cy})" filter="url(#softGlow)">${contours}</g>
      <path d="M ${pxX(0.2)} ${pxY(0.25)} C ${pxX(0.34)} ${pxY(0.44)}, ${pxX(0.48)} ${pxY(0.56)}, ${pxX(0.64)} ${pxY(0.5)}" fill="none" stroke="url(#warmStroke)" stroke-width="5" stroke-linecap="round" opacity="0.72"/>
      <circle cx="${point.x}" cy="${point.y}" r="14" fill="${palette.yellow}" filter="url(#softGlow)"/>
      <line x1="${point.x - 80}" y1="${point.y - 52}" x2="${point.x - 24}" y2="${point.y - 14}" stroke="${palette.orange}" stroke-width="5" stroke-linecap="round" marker-end="url(#arrowHead)" opacity="${reveal.toFixed(3)}"/>
      ${text({ x: 802, y: 166, value: formatMathText(prop(node, "loss", "L(theta)")), size: 42, fill: palette.text, weight: 850, maxChars: 18 })}
      ${text({ x: 802, y: 238, value: prop(node, "caption", "loss is height; lower is better"), size: 28, fill: palette.cyan, weight: 650, maxChars: 28 })}
      ${text({ x: 802, y: 306, value: "contours show equal loss", size: 23, fill: palette.yellow, weight: 760, opacity: 0.86, maxChars: 30 })}
    </g>
  `;
}

function descentStepPoints(progress) {
  const all = [
    { x: pxX(0.22), y: pxY(0.25) },
    { x: pxX(0.32), y: pxY(0.39) },
    { x: pxX(0.43), y: pxY(0.52) },
    { x: pxX(0.54), y: pxY(0.59) },
    { x: pxX(0.64), y: pxY(0.58) },
  ];
  const count = Math.max(2, Math.round(2 + (all.length - 2) * easeInOutCubic(progress)));
  return all.slice(0, count);
}

function pointDescent(node, shot, progress) {
  const reveal = easeInOutCubic(progress);
  const points = descentStepPoints(progress);
  const active = points[points.length - 1];
  return `
    <g data-component="PointDescent">
      ${axes()}
      <path d="${pathFromPoints(valleyPoints())}" fill="none" stroke="#0F1E35" stroke-width="18" stroke-linecap="round" opacity="0.92"/>
      <path d="${pathFromPoints(valleyPoints())}" fill="none" stroke="url(#cyanStroke)" stroke-width="6" stroke-linecap="round" filter="url(#softGlow)" opacity="0.88"/>
      <path d="${pathFromPoints(points)}" fill="none" stroke="url(#warmStroke)" stroke-width="6" stroke-linecap="round" filter="url(#softGlow)" opacity="0.96"/>
      ${points.map((point, index) => `<circle cx="${point.x}" cy="${point.y}" r="${index === points.length - 1 ? 13 : 8}" fill="${index === points.length - 1 ? palette.yellow : palette.orange}" opacity="${0.75 + reveal * 0.25}" filter="url(#softGlow)"/>`).join("")}
      <line x1="${active.x - 78}" y1="${active.y - 44}" x2="${active.x - 24}" y2="${active.y - 12}" stroke="${palette.orange}" stroke-width="5" stroke-linecap="round" marker-end="url(#arrowHead)"/>
      ${text({ x: 724, y: 156, value: prop(node, "caption", "step opposite the gradient"), size: 30, fill: palette.text, weight: 700, maxChars: 35 })}
      ${text({ x: 724, y: 226, value: "gradient points uphill; update goes downhill", size: 23, fill: palette.yellow, weight: 760, maxChars: 38 })}
    </g>
  `;
}

function stepByStepOptimization(node, shot, progress) {
  const reveal = easeOutCubic(progress);
  const formula = formatMathText(prop(node, "update_rule", prop(node, "formula", "theta_next = theta - eta * grad L(theta)")));
  const labels = ["measure slope", "step downhill", "repeat"];
  const cards = labels.map((label, index) => {
    const x = 198 + index * 292;
    const opacity = clamp(reveal * 3 - index * 0.7);
    return `
      <g opacity="${opacity.toFixed(3)}">
        <rect x="${x}" y="168" width="232" height="168" rx="24" fill="${palette.panel}" stroke="${index === 1 ? palette.yellow : palette.cyan}" stroke-opacity="0.46" filter="url(#deepShadow)"/>
        <circle cx="${x + 44}" cy="222" r="20" fill="${index === 1 ? palette.yellow : palette.cyan}" opacity="0.24"/>
        ${text({ x: x + 44, y: 231, value: String(index + 1), size: 25, fill: index === 1 ? palette.yellow : palette.cyan, weight: 850, anchor: "middle", maxChars: 2 })}
        ${text({ x: x + 32, y: 286, value: label, size: 28, fill: palette.text, weight: 750, maxChars: 16 })}
      </g>
    `;
  }).join("");
  return `
    <g data-component="StepByStepOptimization">
      ${cards}
      <path d="M 440 250 C 478 226 522 226 560 250" fill="none" stroke="${palette.orange}" stroke-width="5" stroke-linecap="round" marker-end="url(#arrowHead)" opacity="${reveal.toFixed(3)}"/>
      <path d="M 730 250 C 768 226 812 226 850 250" fill="none" stroke="${palette.orange}" stroke-width="5" stroke-linecap="round" marker-end="url(#arrowHead)" opacity="${reveal.toFixed(3)}"/>
      <rect x="248" y="430" width="784" height="116" rx="26" fill="${palette.panel2}" stroke="${palette.cyan}" stroke-opacity="0.34"/>
      ${text({ x: 640, y: 504, value: formula, size: 38, fill: palette.yellow, weight: 850, anchor: "middle", maxChars: 44 })}
      ${text({ x: 310, y: 610, value: prop(node, "caption", shot.visual_goal), size: 26, fill: palette.cyan, weight: 650, maxChars: 48 })}
    </g>
  `;
}

function rightTriangleLabeling(node, shot, progress) {
  const reveal = easeOutCubic(progress);
  const a = { x: 332, y: 510 };
  const b = { x: 332, y: 230 };
  const c = { x: 760, y: 510 };
  return `
    <g data-component="RightTriangleLabeling">
      <rect x="190" y="112" width="896" height="500" rx="30" fill="${palette.panel}" stroke="#26385B" opacity="0.52"/>
      <polygon points="${a.x},${a.y} ${b.x},${b.y} ${c.x},${c.y}" fill="${palette.cyan}" opacity="0.1" stroke="${palette.cyan}" stroke-width="5" stroke-linejoin="round" filter="url(#softGlow)"/>
      <polyline points="${a.x},${a.y} ${a.x + 46},${a.y} ${a.x + 46},${a.y - 46}" fill="none" stroke="${palette.yellow}" stroke-width="4" opacity="${reveal.toFixed(3)}"/>
      ${text({ x: 292, y: 374, value: "a", size: 42, fill: palette.yellow, weight: 850, opacity: reveal, maxChars: 3 })}
      ${text({ x: 536, y: 552, value: "b", size: 42, fill: palette.yellow, weight: 850, opacity: reveal, maxChars: 3 })}
      ${text({ x: 566, y: 348, value: "c", size: 46, fill: palette.orange, weight: 900, opacity: reveal, maxChars: 3 })}
      ${text({ x: 790, y: 180, value: prop(node, "caption", "a right triangle has two legs and one hypotenuse"), size: 29, fill: palette.text, weight: 700, opacity: 0.95, maxChars: 30 })}
    </g>
  `;
}

function areaRearrangementProof(node, shot, progress) {
  const reveal = easeInOutCubic(progress);
  const smallShift = 96 * reveal;
  const formula = formatMathText(prop(node, "final_equation", prop(node, "formula", "a^2 + b^2 = c^2")));
  return `
    <g data-component="AreaRearrangementProof">
      <rect x="126" y="92" width="460" height="460" rx="30" fill="${palette.panel}" stroke="#26385B" opacity="0.68"/>
      <rect x="${194 - smallShift * 0.18}" y="166" width="128" height="128" fill="${palette.cyan}" opacity="0.28" stroke="${palette.cyan}" stroke-width="4"/>
      <rect x="${354 - smallShift * 0.08}" y="282" width="188" height="188" fill="${palette.yellow}" opacity="0.22" stroke="${palette.yellow}" stroke-width="4"/>
      ${text({ x: 226 - smallShift * 0.18, y: 240, value: "a^2", size: 31, fill: palette.cyan, weight: 850, maxChars: 6 })}
      ${text({ x: 414 - smallShift * 0.08, y: 386, value: "b^2", size: 31, fill: palette.yellow, weight: 850, maxChars: 6 })}
      <path d="M 604 320 C 652 278 690 278 736 320" fill="none" stroke="${palette.orange}" stroke-width="7" stroke-linecap="round" marker-end="url(#arrowHead)" opacity="${reveal.toFixed(3)}" filter="url(#softGlow)"/>
      <rect x="762" y="122" width="396" height="396" rx="30" fill="${palette.panel}" stroke="#26385B" opacity="0.68"/>
      <rect x="860" y="198" width="220" height="220" transform="rotate(14 970 308)" fill="${palette.orange}" opacity="${(0.14 + reveal * 0.16).toFixed(3)}" stroke="${palette.orange}" stroke-width="5" filter="url(#softGlow)"/>
      ${text({ x: 930, y: 326, value: "c^2", size: 44, fill: palette.orange, weight: 900, anchor: "middle", maxChars: 6 })}
      ${text({ x: 324, y: 620, value: formula, size: 42, fill: palette.text, weight: 900, maxChars: 24 })}
    </g>
  `;
}

function visualRecap(node, shot, progress) {
  const reveal = easeOutCubic(progress);
  const message = prop(node, "message", prop(node, "caption", shot.visual_goal || node.narration));
  const formula = formatMathText(prop(node, "formula", prop(node, "takeaway", "small stable steps")));
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
    <g data-component="GenericDiagram" opacity="${reveal}">
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
      return graphPlot(node, shot, progress);
    case "GraphLocalZoom":
      return graphLocalZoom(node, shot, progress);
    case "TangentReveal":
      return tangentReveal(node, shot, progress);
    case "MovingPoint":
      return movingPoint(node, shot, progress);
    case "FormulaReveal":
      return formulaReveal(node, shot, progress);
    case "SlopeTriangle":
      return slopeTriangle(node, shot, progress);
    case "RightTriangleLabeling":
      return rightTriangleLabeling(node, shot, progress);
    case "AreaRearrangementProof":
      return areaRearrangementProof(node, shot, progress);
    case "RiemannRectangles":
      return riemannRectangles(node, shot, progress);
    case "AreaFillReveal":
      return areaFillReveal(node, shot, progress);
    case "LinearTransformGrid":
      return linearTransformGrid(node, shot, progress);
    case "BasisVectorReveal":
      return basisVectorReveal(node, shot, progress);
    case "VectorTransform":
      return vectorTransform(node, shot, progress);
    case "SplitScreenComparison":
      return splitScreenComparison(node, shot, progress);
    case "LossLandscape2D":
      return lossLandscape2D(node, shot, progress);
    case "PointDescent":
      return pointDescent(node, shot, progress);
    case "StepByStepOptimization":
      return stepByStepOptimization(node, shot, progress);
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
