import { getMotionComponent } from "./motionComponents.js";

function clampDuration(durationSeconds) {
  return Math.min(Math.max(Number(durationSeconds) || 24, 8), 60);
}

function shotDurationScale(shots, durationSeconds) {
  const total = shots.reduce((sum, shot) => sum + Math.max(Number(shot.duration_sec) || 1, 1), 0);
  return total > 0 ? durationSeconds / total : durationSeconds / Math.max(shots.length, 1);
}

function rendererForComponent(componentId) {
  const spec = getMotionComponent(componentId);
  if (spec.renderer.includes("ffmpeg")) return "ffmpeg_component_adapter";
  if (spec.renderer.includes("manim")) return "manim";
  if (spec.renderer.includes("motion_canvas")) return "motion_canvas";
  return spec.renderer[0] || "ffmpeg_component_adapter";
}

function hasProp(props, key) {
  const value = props?.[key];
  return value !== undefined && value !== null && String(value).trim().length > 0;
}

export function compileTimeline({ storyboard, componentGraph, durationSeconds, designTokens }) {
  const shots = Array.isArray(storyboard?.shots) && storyboard.shots.length > 0
    ? storyboard.shots
    : componentGraph.nodes.map((node, index) => ({
        shot_id: node.shot_id || `sh${index + 1}`,
        duration_sec: 2,
        visual_goal: node.props.caption || node.props.idea || "Explain one visual idea.",
        main_component: node.component,
        camera: "static_center",
        text_policy: "minimal_label",
        narration: node.narration || "",
      }));
  const cappedDuration = clampDuration(durationSeconds);
  const scale = shotDurationScale(shots, cappedDuration);
  let cursor = 0;

  const timelineShots = shots.map((shot, index) => {
    const isLast = index === shots.length - 1;
    const rawDuration = Math.max(Number(shot.duration_sec) || 1, 1) * scale;
    const end = isLast ? cappedDuration : Math.min(cappedDuration, cursor + rawDuration);
    const node = componentGraph.nodes.find((entry) => entry.shot_id === shot.shot_id)
      ?? componentGraph.nodes[index]
      ?? componentGraph.nodes[0];
    const compiled = {
      shot_id: String(shot.shot_id || `sh${index + 1}`),
      node_id: node?.id,
      start_sec: Number(cursor.toFixed(2)),
      end_sec: Number(end.toFixed(2)),
      duration_sec: Number(Math.max(end - cursor, 0.5).toFixed(2)),
      layer: "main",
      component: shot.main_component || node?.component || "GenericDiagram",
      transition_in: index === 0 ? "fade_up" : "soft_cut",
      transition_out: isLast ? "hold" : "soft_cut",
      camera: {
        type: String(shot.camera || "static_center"),
        ease: designTokens.motion.default_ease,
      },
      text_policy: String(shot.text_policy || "minimal_label"),
      visual_goal: String(shot.visual_goal || "Explain one visual idea."),
      narration: String(shot.narration || node?.narration || ""),
    };
    cursor = end;
    return compiled;
  });

  return {
    version: 1,
    duration_sec: cappedDuration,
    fps: 30,
    resolution: "1280x720",
    theme_id: designTokens.theme_id,
    constraints: {
      max_objects_per_shot: designTokens.layout.max_objects_per_shot,
      max_text_lines: designTokens.layout.max_text_lines,
      safe_margin_px: designTokens.canvas.safe_margin_px,
    },
    shots: timelineShots,
  };
}

export function allocateRenderers({ timeline, componentGraph }) {
  const nodesById = new Map(componentGraph.nodes.map((node) => [node.id, node]));
  const allocations = timeline.shots.map((shot) => {
    const node = nodesById.get(shot.node_id);
    const component = node?.component || shot.component || "GenericDiagram";
    const spec = getMotionComponent(component);

    return {
      shot_id: shot.shot_id,
      node_id: shot.node_id,
      component,
      renderer: rendererForComponent(component),
      target_renderer: spec.renderer[0],
      quality_tier: spec.quality_tier,
      reason: "Local MVP renders component contracts through the FFmpeg component adapter.",
    };
  });

  return {
    final_composition: "ffmpeg",
    allocations,
  };
}

export function runStaticPreflight({ componentGraph, timeline, designTokens }) {
  const issues = [];
  const knownNodeIds = new Set(componentGraph.nodes.map((node) => node.id));

  for (const shot of timeline.shots) {
    if (!knownNodeIds.has(shot.node_id)) {
      issues.push({
        severity: "high",
        shot_id: shot.shot_id,
        type: "missing_component_node",
        description: "Timeline shot does not point to a valid component node.",
      });
    }
    if (shot.duration_sec < 0.5) {
      issues.push({
        severity: "medium",
        shot_id: shot.shot_id,
        type: "shot_too_short",
        description: "Shot duration is too short for a clear visual reveal.",
      });
    }
  }

  for (const node of componentGraph.nodes) {
    if (node.fallback_used) {
      issues.push({
        severity: "low",
        shot_id: node.shot_id,
        type: "component_fallback",
        description: `${node.requested_component} is not in the local component registry, so GenericDiagram will render it.`,
      });
    }

    const spec = getMotionComponent(node.component);
    for (const requiredProp of spec.schema.required_props) {
      if (!hasProp(node.props, requiredProp)) {
        issues.push({
          severity: "high",
          shot_id: node.shot_id,
          type: "missing_required_component_prop",
          description: `${node.component} is missing required prop "${requiredProp}".`,
          suggested_fix: `Regenerate or repair the component graph so ${node.component}.${requiredProp} is explicit.`,
        });
      }
    }
  }

  if (timeline.shots.length > 8) {
    issues.push({
      severity: "medium",
      type: "too_many_shots",
      description: "Local explainer mode should keep the storyboard to eight shots or fewer.",
    });
  }

  return {
    pass: !issues.some((issue) => issue.severity === "high"),
    issues,
    checks: [
      "component_nodes_resolve",
      "component_required_props_present",
      "timeline_duration_within_local_bounds",
      "shot_count_local_mvp",
      "safe_margin_policy_present",
    ],
    constraints: {
      duration_sec: timeline.duration_sec,
      max_objects_per_shot: designTokens.layout.max_objects_per_shot,
    },
  };
}
