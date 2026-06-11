const createdAt = "2026-06-10T00:00:00.000Z";

export const motionComponentRegistry = [
  component("HookTitle", ["math", "science", "general"], ["title"], ["subtitle"], ["remotion", "ffmpeg"], "native"),
  component("FormulaReveal", ["math", "science", "general"], ["formula"], ["caption", "reveal_style"], ["remotion", "ffmpeg"], "native"),
  component("SplitScreenComparison", ["math", "science", "general"], ["left", "right"], ["caption"], ["remotion", "ffmpeg"], "native"),
  component("VisualRecap", ["math", "science", "general"], ["message"], ["formula", "caption"], ["remotion", "ffmpeg"], "native"),
  component("MinimalCaption", ["math", "science", "general"], ["caption"], [], ["remotion", "ffmpeg"], "native"),
  component("CameraPullback", ["math", "science", "general"], ["focus"], ["caption"], ["motion_canvas", "ffmpeg"], "generic"),
  component("RightTriangleLabeling", ["math"], ["labels"], ["show_right_angle"], ["manim", "ffmpeg"], "native"),
  component("AreaRearrangementProof", ["math"], ["final_equation"], ["triangle_dimensions"], ["manim", "ffmpeg"], "native"),
  component("GraphPlot", ["math"], ["function"], ["caption", "show_axes"], ["manim", "ffmpeg"], "native"),
  component("GraphLocalZoom", ["math"], ["function", "x_focus"], ["caption", "zoom_levels"], ["manim", "ffmpeg"], "native"),
  component("TangentReveal", ["math"], ["function"], ["caption", "x_focus"], ["manim", "ffmpeg"], "native"),
  component("SlopeTriangle", ["math"], ["slope"], ["caption"], ["manim", "ffmpeg"], "native"),
  component("RiemannRectangles", ["math"], ["function"], ["caption", "rectangles"], ["manim", "ffmpeg"], "native"),
  component("VectorProjection", ["math"], ["vector_a", "vector_b"], ["caption"], ["manim", "ffmpeg"], "generic"),
  component("LinearTransformGrid", ["math"], ["transform"], ["caption"], ["manim", "ffmpeg"], "native"),
  component("ProbabilityTiles", ["math"], ["groups"], ["caption"], ["motion_canvas", "ffmpeg"], "generic"),
  component("UnitCircleProjection", ["math"], ["angle"], ["caption"], ["manim", "ffmpeg"], "generic"),
  component("RotatingVectorsWave", ["math"], ["frequencies"], ["caption"], ["manim", "ffmpeg"], "generic"),
  component("MovingPoint", ["math", "science"], ["path"], ["caption", "direction"], ["motion_canvas", "ffmpeg"], "native"),
  component("AtomShellDiagram", ["chemistry"], ["element"], ["caption"], ["motion_canvas", "ffmpeg"], "generic"),
  component("ElectronTransfer", ["chemistry"], ["from_atom", "to_atom"], ["caption"], ["motion_canvas", "ffmpeg"], "generic"),
  component("SharedElectronCloud", ["chemistry"], ["atoms"], ["caption"], ["motion_canvas", "ffmpeg"], "generic"),
  component("EnergyProfileDiagram", ["chemistry"], ["reaction"], ["caption"], ["motion_canvas", "ffmpeg"], "generic"),
  component("EquilibriumArrows", ["chemistry"], ["reaction"], ["caption"], ["motion_canvas", "ffmpeg"], "generic"),
  component("MoleculeAssembly2D", ["chemistry"], ["molecule"], ["caption"], ["motion_canvas", "ffmpeg"], "generic"),
  component("DNAUnzip", ["biology"], ["strand"], ["caption"], ["motion_canvas", "ffmpeg"], "generic"),
  component("NucleotidePairing", ["biology"], ["pairing_rules"], ["caption"], ["motion_canvas", "ffmpeg"], "generic"),
  component("MembraneTransport", ["biology"], ["transport_type"], ["caption"], ["motion_canvas", "ffmpeg"], "generic"),
  component("EnzymeLockAndKey", ["biology"], ["enzyme", "substrate"], ["caption"], ["motion_canvas", "ffmpeg"], "generic"),
  component("SignalPropagation", ["biology"], ["signal"], ["caption"], ["motion_canvas", "ffmpeg"], "generic"),
  component("CellDivisionSchematic", ["biology"], ["phase"], ["caption"], ["motion_canvas", "ffmpeg"], "generic"),
  component("GenericDiagram", ["math", "science", "general"], ["idea"], ["caption"], ["ffmpeg"], "fallback"),
];

function component(
  componentId,
  supportedDomains,
  requiredProps,
  optionalProps,
  renderer,
  qualityTier,
) {
  return {
    component_id: componentId,
    version: "1.0.0",
    supported_domains: supportedDomains,
    required_props: requiredProps,
    optional_props: optionalProps,
    renderer,
    quality_tier: qualityTier,
    estimated_render_cost: "low",
    failure_modes: ["label_overlap", "crowded_shot", "unsupported_prop"],
    schema: {
      required_props: requiredProps,
      optional_props: optionalProps,
    },
    defaults: {
      theme: "clean_dark_explainer",
      max_text_lines: 2,
      safe_bounds: true,
      easing: "easeInOutCubic",
    },
    examples: [],
    created_at: createdAt,
  };
}

const registryById = new Map(
  motionComponentRegistry.map((entry) => [entry.component_id, entry]),
);

export function getMotionComponent(componentId) {
  return registryById.get(componentId) ?? registryById.get("GenericDiagram");
}

export function listMotionComponents() {
  return motionComponentRegistry;
}

export async function installMotionComponents(store) {
  if (!store?.upsertMotionComponent) return;
  for (const entry of motionComponentRegistry) {
    await store.upsertMotionComponent(entry);
  }
}

function propsToObject(props) {
  if (!props) return {};
  if (!Array.isArray(props) && typeof props === "object") return { ...props };
  if (!Array.isArray(props)) return {};

  return Object.fromEntries(
    props
      .map((entry) => [String(entry?.key ?? "").trim(), String(entry?.value ?? "").trim()])
      .filter(([key]) => key),
  );
}

function firstText(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
  }
  return "";
}

function setDefaultProp(props, key, value) {
  if (firstText(props[key])) return;
  const normalized = firstText(value);
  if (normalized) props[key] = normalized;
}

function completeComponentProps(componentId, props, shot, requestContext) {
  const completed = { ...props };
  const shotFormula = firstText(shot?.formula);
  const shotCaption = firstText(shot?.narration, shot?.visual_goal);

  switch (componentId) {
    case "HookTitle":
      setDefaultProp(completed, "title", firstText(requestContext.title, shot?.visual_goal, "Visual explanation"));
      setDefaultProp(completed, "subtitle", shotCaption);
      break;
    case "FormulaReveal":
      setDefaultProp(completed, "formula", firstText(completed.formula, completed.final_equation, shotFormula));
      setDefaultProp(completed, "caption", shotCaption);
      break;
    case "VisualRecap":
      setDefaultProp(completed, "message", firstText(completed.message, shotCaption, "Key takeaway"));
      setDefaultProp(completed, "formula", firstText(completed.formula, completed.final_equation, shotFormula));
      break;
    case "GraphPlot":
      setDefaultProp(completed, "function", firstText(completed.function, completed.shape, completed.curve, shot?.visual_goal, "conceptual curve"));
      setDefaultProp(completed, "caption", shotCaption);
      break;
    case "GraphLocalZoom":
      setDefaultProp(completed, "function", firstText(completed.function, completed.shape, completed.curve, shot?.visual_goal, "local curve"));
      setDefaultProp(completed, "x_focus", firstText(completed.x_focus, completed.zoom_target, completed.focus, "current point"));
      setDefaultProp(completed, "caption", shotCaption);
      break;
    case "TangentReveal":
      setDefaultProp(completed, "function", firstText(completed.function, completed.shape, completed.curve, shot?.visual_goal, "local curve"));
      setDefaultProp(completed, "caption", shotCaption);
      setDefaultProp(completed, "x_focus", firstText(completed.x_focus, completed.focus, "current point"));
      break;
    case "SlopeTriangle":
      setDefaultProp(completed, "slope", firstText(completed.slope, completed.label, "local slope"));
      setDefaultProp(completed, "caption", shotCaption);
      break;
    case "MovingPoint":
      setDefaultProp(completed, "path", firstText(completed.path, completed.motion, shot?.visual_goal, "motion path"));
      setDefaultProp(completed, "caption", shotCaption);
      break;
    case "RiemannRectangles":
      setDefaultProp(completed, "function", firstText(completed.function, completed.curve, shot?.visual_goal, "area curve"));
      setDefaultProp(completed, "caption", shotCaption);
      break;
    case "LinearTransformGrid":
      setDefaultProp(completed, "transform", firstText(completed.transform, completed.annotation, shot?.visual_goal, "shear and stretch"));
      setDefaultProp(completed, "caption", shotCaption);
      break;
    case "SplitScreenComparison":
      setDefaultProp(completed, "left", firstText(completed.left, "before"));
      setDefaultProp(completed, "right", firstText(completed.right, "after"));
      setDefaultProp(completed, "caption", shotCaption);
      break;
    case "VectorProjection":
      setDefaultProp(completed, "vector_a", firstText(completed.vector_a, "vector a"));
      setDefaultProp(completed, "vector_b", firstText(completed.vector_b, "vector b"));
      setDefaultProp(completed, "caption", shotCaption);
      break;
    case "ProbabilityTiles":
      setDefaultProp(completed, "groups", firstText(completed.groups, completed.caption, shot?.visual_goal, "group A, group B"));
      setDefaultProp(completed, "caption", shotCaption);
      break;
    case "UnitCircleProjection":
      setDefaultProp(completed, "angle", firstText(completed.angle, "theta"));
      setDefaultProp(completed, "caption", shotCaption);
      break;
    case "RotatingVectorsWave":
      setDefaultProp(completed, "frequencies", firstText(completed.frequencies, "1, 2, 3"));
      setDefaultProp(completed, "caption", shotCaption);
      break;
    case "RightTriangleLabeling":
      setDefaultProp(completed, "labels", firstText(completed.labels, "a, b, c"));
      break;
    case "AreaRearrangementProof":
      setDefaultProp(completed, "final_equation", firstText(completed.final_equation, completed.formula, shotFormula));
      break;
    case "GenericDiagram":
      setDefaultProp(completed, "idea", firstText(completed.idea, shot?.visual_goal, "Explain one visual idea."));
      setDefaultProp(completed, "caption", shotCaption);
      break;
    default:
      break;
  }

  return completed;
}

function stringArray(value) {
  return Array.isArray(value) ? value.map((entry) => String(entry)).filter(Boolean) : [];
}

export function normalizeComponentGraph(rawGraph, storyboard, requestContext) {
  const shots = Array.isArray(storyboard?.shots) ? storyboard.shots : [];
  const sourceNodes = Array.isArray(rawGraph?.nodes) ? rawGraph.nodes : [];
  const usedSourceIndexes = new Set();
  const usedNodeIds = new Set();

  function uniqueNodeId(candidate) {
    const base = firstText(candidate, `n${usedNodeIds.size + 1}`).replace(/\s+/g, "_");
    let next = base;
    let suffix = 2;
    while (usedNodeIds.has(next)) {
      next = `${base}_${suffix}`;
      suffix += 1;
    }
    usedNodeIds.add(next);
    return next;
  }

  function chooseComponent(node, shot) {
    const requestedComponent = String(node?.component || shot?.main_component || "GenericDiagram");
    const storyboardComponent = String(shot?.main_component || "");
    const shouldHonorStoryboard =
      storyboardComponent &&
      storyboardComponent !== "GenericDiagram" &&
      registryById.has(storyboardComponent);
    const selectedComponent = shouldHonorStoryboard ? storyboardComponent : requestedComponent;
    const knownComponent = registryById.has(selectedComponent);
    return {
      requestedComponent,
      componentId: knownComponent ? selectedComponent : "GenericDiagram",
      fallbackUsed: !knownComponent,
    };
  }

  function normalizeNode(node, index, shot, generatedId) {
    const { requestedComponent, componentId, fallbackUsed } = chooseComponent(node, shot);
    const spec = getMotionComponent(componentId);

    return {
      id: uniqueNodeId(node?.id || generatedId || `n${index + 1}`),
      shot_id: String(node?.shot_id || shot?.shot_id || `sh${index + 1}`),
      component: componentId,
      requested_component: requestedComponent,
      component_overridden: requestedComponent !== componentId,
      fallback_used: fallbackUsed,
      quality_tier: spec.quality_tier,
      renderer_candidates: spec.renderer,
      props: completeComponentProps(componentId, propsToObject(node?.props), shot, requestContext),
      style: {
        theme: String(node?.style?.theme || requestContext.style || "clean_dark_explainer"),
        highlight_color_token: String(node?.style?.highlight_color_token || "primary"),
      },
      narration: String(node?.narration || shot?.narration || ""),
    };
  }

  const primaryNodes = shots.map((shot, index) => {
    const exactIndex = sourceNodes.findIndex((node, sourceIndex) => (
      !usedSourceIndexes.has(sourceIndex) &&
      node?.shot_id === shot.shot_id &&
      node?.component === shot.main_component
    ));
    const sameShotIndex = exactIndex >= 0 ? exactIndex : sourceNodes.findIndex((node, sourceIndex) => (
      !usedSourceIndexes.has(sourceIndex) &&
      node?.shot_id === shot.shot_id
    ));
    const indexFallback = sameShotIndex >= 0 ? sameShotIndex : sourceNodes.findIndex((node, sourceIndex) => (
      !usedSourceIndexes.has(sourceIndex) &&
      !node?.shot_id &&
      sourceIndex === index
    ));
    const sourceIndex = indexFallback;
    const sourceNode = sourceIndex >= 0 ? sourceNodes[sourceIndex] : {
      id: `${shot.shot_id}_primary`,
      shot_id: shot.shot_id,
      component: shot.main_component || "GenericDiagram",
      props: {},
    };

    if (sourceIndex >= 0) usedSourceIndexes.add(sourceIndex);
    return normalizeNode(sourceNode, index, shot, `${shot.shot_id}_primary`);
  });

  const extraNodes = sourceNodes
    .map((node, sourceIndex) => ({ node, sourceIndex }))
    .filter(({ sourceIndex }) => !usedSourceIndexes.has(sourceIndex))
    .map(({ node }, index) => {
      const shot = shots.find((entry) => entry.shot_id === node?.shot_id) ?? shots[index];
      return normalizeNode(node, primaryNodes.length + index, shot);
    });

  const nodes = shots.length > 0
    ? [...primaryNodes, ...extraNodes]
    : sourceNodes.map((node, index) => normalizeNode(node, index, undefined));

  return {
    graph_id: String(rawGraph?.graph_id || `${requestContext.id}_component_graph`),
    version: 1,
    status: "validated",
    nodes,
    edges: Array.isArray(rawGraph?.edges)
      ? rawGraph.edges.map((edge) => ({
          from: String(edge?.from || ""),
          to: String(edge?.to || ""),
          relation: String(edge?.relation || "sequence"),
        })).filter((edge) => edge.from && edge.to)
      : [],
    component_registry_version: "local-1.0.0",
    fallback_nodes: nodes.filter((node) => node.fallback_used).map((node) => node.id),
  };
}

export function componentsFromTreatments(treatments) {
  const componentIds = new Set();
  for (const treatment of treatments?.treatments ?? []) {
    for (const componentId of stringArray(treatment.components)) {
      componentIds.add(registryById.has(componentId) ? componentId : "GenericDiagram");
    }
  }
  return [...componentIds];
}
