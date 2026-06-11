function textObject(id, text, x, y, stroke = "white") {
  return {
    id,
    type: "label",
    params: { x, y, text },
    style: { stroke, fill: stroke, opacity: 0.92 },
  };
}

function formulaObject(id, text, x, y) {
  return {
    id,
    type: "formula",
    params: { x, y, text },
    style: { stroke: "white", fill: "white", opacity: 0.92 },
  };
}

function axisObjects(prefix = "axis") {
  return [
    {
      id: `${prefix}_x`,
      type: "axis",
      params: { orientation: "horizontal", y: 0.76 },
      style: { stroke: "muted", fill: "muted", opacity: 0.8 },
    },
    {
      id: `${prefix}_y`,
      type: "axis",
      params: { orientation: "vertical", x: 0.18 },
      style: { stroke: "muted", fill: "muted", opacity: 0.8 },
    },
  ];
}

function curveObject(id, variant = "valley") {
  const valleyPoints = [
    { x: 0.12, y: 0.24 },
    { x: 0.28, y: 0.48 },
    { x: 0.48, y: 0.68 },
    { x: 0.68, y: 0.45 },
    { x: 0.84, y: 0.22 },
  ];
  const risingPoints = [
    { x: 0.12, y: 0.68 },
    { x: 0.28, y: 0.57 },
    { x: 0.48, y: 0.42 },
    { x: 0.68, y: 0.28 },
    { x: 0.84, y: 0.22 },
  ];

  return {
    id,
    type: "curve",
    params: { points: variant === "rising" ? risingPoints : valleyPoints },
    style: { stroke: "cyan", fill: "cyan", opacity: 0.92 },
  };
}

function lineObject(id, x1, y1, x2, y2, stroke = "yellow") {
  return {
    id,
    type: "line",
    params: { x1, y1, x2, y2 },
    style: { stroke, fill: stroke, opacity: 0.95 },
  };
}

function dotObject(id, x, y, fill = "yellow") {
  return {
    id,
    type: "dot",
    params: { x, y },
    style: { stroke: fill, fill, opacity: 0.95 },
  };
}

function rectObject(id, x, y, width, height, fill = "green", opacity = 0.28) {
  return {
    id,
    type: "rectangle",
    params: { x, y, width, height },
    style: { stroke: fill, fill, opacity },
  };
}

function prop(node, key, fallback = "") {
  return String(node?.props?.[key] ?? fallback);
}

function componentObjects(node, shot, index) {
  const prefix = `${shot.shot_id}_${node.id}`;
  const caption = prop(node, "caption", shot.visual_goal || node.narration || node.component);

  switch (node.component) {
    case "HookTitle":
      return [
        rectObject(`${prefix}_glow`, 0.12, 0.2, 0.74, 0.42, "blue", 0.12),
        textObject(`${prefix}_title`, prop(node, "title", caption), 0.18, 0.28, "cyan"),
        textObject(`${prefix}_subtitle`, prop(node, "subtitle", node.narration), 0.24, 0.48, "yellow"),
      ];
    case "GraphPlot":
      return [
        ...axisObjects(prefix),
        curveObject(`${prefix}_curve`),
        dotObject(`${prefix}_start`, 0.24, 0.42, "yellow"),
        textObject(`${prefix}_caption`, caption, 0.58, 0.14, "white"),
      ];
    case "GraphLocalZoom":
      return [
        ...axisObjects(prefix),
        curveObject(`${prefix}_curve`, "rising"),
        dotObject(`${prefix}_focus`, 0.52, 0.38, "yellow"),
        rectObject(`${prefix}_zoom_window`, 0.42, 0.28, 0.24, 0.22, "cyan", 0.12),
        lineObject(`${prefix}_local_line`, 0.38, 0.48, 0.68, 0.27, "yellow"),
      ];
    case "TangentReveal":
      return [
        ...axisObjects(prefix),
        curveObject(`${prefix}_curve`, "rising"),
        lineObject(`${prefix}_tangent`, 0.32, 0.56, 0.76, 0.22, "yellow"),
        dotObject(`${prefix}_point`, 0.54, 0.39, "orange"),
        textObject(`${prefix}_caption`, caption, 0.62, 0.17, "white"),
      ];
    case "SlopeTriangle":
      return [
        ...axisObjects(prefix),
        lineObject(`${prefix}_slope`, 0.28, 0.62, 0.72, 0.3, "yellow"),
        lineObject(`${prefix}_run`, 0.36, 0.58, 0.68, 0.58, "cyan"),
        lineObject(`${prefix}_rise`, 0.68, 0.58, 0.68, 0.36, "orange"),
        textObject(`${prefix}_caption`, caption, 0.58, 0.18, "white"),
      ];
    case "RiemannRectangles":
      return [
        ...axisObjects(prefix),
        curveObject(`${prefix}_curve`, "rising"),
        rectObject(`${prefix}_r1`, 0.24, 0.62, 0.08, 0.14),
        rectObject(`${prefix}_r2`, 0.34, 0.54, 0.08, 0.22),
        rectObject(`${prefix}_r3`, 0.44, 0.46, 0.08, 0.3),
        rectObject(`${prefix}_r4`, 0.54, 0.38, 0.08, 0.38),
        textObject(`${prefix}_caption`, caption, 0.62, 0.16, "white"),
      ];
    case "LinearTransformGrid":
      return [
        lineObject(`${prefix}_g1`, 0.18, 0.2, 0.72, 0.2, "muted"),
        lineObject(`${prefix}_g2`, 0.18, 0.35, 0.76, 0.28, "muted"),
        lineObject(`${prefix}_g3`, 0.18, 0.5, 0.8, 0.36, "muted"),
        lineObject(`${prefix}_v1`, 0.24, 0.18, 0.32, 0.62, "cyan"),
        lineObject(`${prefix}_v2`, 0.44, 0.18, 0.54, 0.62, "cyan"),
        lineObject(`${prefix}_v3`, 0.64, 0.18, 0.78, 0.62, "cyan"),
        textObject(`${prefix}_caption`, caption, 0.62, 0.14, "white"),
      ];
    case "MovingPoint":
      return [
        ...axisObjects(prefix),
        curveObject(`${prefix}_curve`),
        dotObject(`${prefix}_p1`, 0.24, 0.42, "yellow"),
        dotObject(`${prefix}_p2`, 0.34, 0.55, "yellow"),
        dotObject(`${prefix}_p3`, 0.46, 0.66, "yellow"),
        dotObject(`${prefix}_p4`, 0.58, 0.6, "yellow"),
        lineObject(`${prefix}_step1`, 0.24, 0.42, 0.34, 0.55, "orange"),
        lineObject(`${prefix}_step2`, 0.34, 0.55, 0.46, 0.66, "orange"),
        lineObject(`${prefix}_step3`, 0.46, 0.66, 0.58, 0.6, "orange"),
      ];
    case "FormulaReveal":
      return [
        rectObject(`${prefix}_panel`, 0.22, 0.2, 0.58, 0.32, "blue", 0.18),
        formulaObject(`${prefix}_formula`, prop(node, "formula", caption || "idea"), 0.28, 0.31),
        textObject(`${prefix}_caption`, prop(node, "caption", node.narration), 0.32, 0.5, "cyan"),
      ];
    case "RightTriangleLabeling":
      return [
        lineObject(`${prefix}_a`, 0.28, 0.68, 0.28, 0.28, "cyan"),
        lineObject(`${prefix}_b`, 0.28, 0.68, 0.72, 0.68, "yellow"),
        lineObject(`${prefix}_c`, 0.28, 0.28, 0.72, 0.68, "orange"),
        textObject(`${prefix}_la`, "a", 0.22, 0.46, "cyan"),
        textObject(`${prefix}_lb`, "b", 0.48, 0.7, "yellow"),
        textObject(`${prefix}_lc`, "c", 0.54, 0.42, "orange"),
      ];
    case "AreaRearrangementProof":
      return [
        rectObject(`${prefix}_left`, 0.2, 0.3, 0.22, 0.22, "cyan", 0.26),
        rectObject(`${prefix}_right`, 0.48, 0.22, 0.32, 0.32, "orange", 0.22),
        lineObject(`${prefix}_bridge`, 0.42, 0.42, 0.5, 0.38, "yellow"),
        formulaObject(`${prefix}_formula`, prop(node, "final_equation", "a^2 + b^2 = c^2"), 0.32, 0.62),
      ];
    case "ProbabilityTiles":
      return [
        rectObject(`${prefix}_a`, 0.22, 0.28, 0.2, 0.18, "cyan", 0.32),
        rectObject(`${prefix}_b`, 0.45, 0.28, 0.2, 0.18, "yellow", 0.32),
        rectObject(`${prefix}_c`, 0.22, 0.5, 0.43, 0.16, "orange", 0.2),
        textObject(`${prefix}_caption`, caption, 0.68, 0.3, "white"),
      ];
    case "VisualRecap":
      return [
        rectObject(`${prefix}_recap`, 0.18, 0.22, 0.64, 0.36, "cyan", 0.14),
        textObject(`${prefix}_message`, prop(node, "message", caption), 0.24, 0.32, "white"),
        formulaObject(`${prefix}_formula`, prop(node, "formula", ""), 0.32, 0.5),
      ];
    default:
      return [
        rectObject(`${prefix}_idea`, 0.24, 0.26 + (index % 2) * 0.08, 0.5, 0.28, "cyan", 0.16),
        dotObject(`${prefix}_dot`, 0.36, 0.4, "yellow"),
        lineObject(`${prefix}_arrow`, 0.42, 0.4, 0.62, 0.4, "orange"),
        textObject(`${prefix}_caption`, caption, 0.3, 0.52, "white"),
      ];
  }
}

export function compileSceneDslFromTimeline({ timeline, componentGraph, creativeBrief }) {
  const nodes = componentGraph?.nodes ?? [];
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const scenes = (timeline?.shots ?? []).map((shot, index) => {
    const node = nodesById.get(shot.node_id) ?? nodes[index] ?? {
      id: `fallback_${index + 1}`,
      component: "GenericDiagram",
      props: { idea: shot.visual_goal },
    };

    return {
      scene_id: shot.shot_id,
      objects: componentObjects(node, shot, index).slice(0, timeline.constraints?.max_objects_per_shot ?? 8),
      animations: [
        { type: shot.transition_in || "fade_up", target: node.id, duration: 0.6 },
      ],
      camera: [
        { type: shot.camera?.type || "static_center", duration: Math.max(shot.duration_sec, 0.5) },
      ],
    };
  });

  return {
    canvas: {
      background: "dark",
      resolution: timeline?.resolution || "1280x720",
      style: creativeBrief?.visual_style || "clean_dark_explainer component video",
    },
    scenes,
  };
}
