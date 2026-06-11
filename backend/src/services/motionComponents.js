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

function stringArray(value) {
  return Array.isArray(value) ? value.map((entry) => String(entry)).filter(Boolean) : [];
}

export function normalizeComponentGraph(rawGraph, storyboard, requestContext) {
  const shots = Array.isArray(storyboard?.shots) ? storyboard.shots : [];
  const sourceNodes = Array.isArray(rawGraph?.nodes) && rawGraph.nodes.length > 0
    ? rawGraph.nodes
    : shots.map((shot, index) => ({
        id: `n${index + 1}`,
        shot_id: shot.shot_id,
        component: shot.main_component || "GenericDiagram",
        props: {
          idea: shot.visual_goal,
          caption: shot.narration || shot.visual_goal,
        },
        style: {
          theme: requestContext.style,
          highlight_color_token: "primary",
        },
        narration: shot.narration || "",
      }));

  const nodes = sourceNodes.map((node, index) => {
    const requestedComponent = String(node?.component || "GenericDiagram");
    const knownComponent = registryById.has(requestedComponent);
    const componentId = knownComponent ? requestedComponent : "GenericDiagram";
    const spec = getMotionComponent(componentId);
    const shot = shots.find((entry) => entry.shot_id === node?.shot_id) ?? shots[index];

    return {
      id: String(node?.id || `n${index + 1}`),
      shot_id: String(node?.shot_id || shot?.shot_id || `sh${index + 1}`),
      component: componentId,
      requested_component: requestedComponent,
      fallback_used: !knownComponent,
      quality_tier: spec.quality_tier,
      renderer_candidates: spec.renderer,
      props: {
        ...propsToObject(node?.props),
      },
      style: {
        theme: String(node?.style?.theme || requestContext.style || "clean_dark_explainer"),
        highlight_color_token: String(node?.style?.highlight_color_token || "primary"),
      },
      narration: String(node?.narration || shot?.narration || ""),
    };
  });

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
