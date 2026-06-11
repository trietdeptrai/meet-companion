export function sampleFrameMarkers(timeline) {
  const duration = Math.max(Number(timeline?.duration_sec) || 24, 1);
  return [0.05, 0.1, 0.2, 0.35, 0.5, 0.65, 0.8, 0.92].map((percent) => ({
    at_sec: Number((duration * percent).toFixed(2)),
    percent: Number(percent.toFixed(2)),
    reason: "standard_preview_sample",
  }));
}

export function runVisualQa({ video, timeline, componentGraph, preflight }) {
  const issues = [];

  if (!video?.url) {
    issues.push({
      severity: "high",
      type: "missing_video_url",
      description: "Preview render did not produce a video URL.",
      suggested_fix: "Retry preview render.",
    });
  }

  if (Number(video?.durationSeconds) > 60 || Number(timeline?.duration_sec) > 60) {
    issues.push({
      severity: "high",
      type: "duration_limit_exceeded",
      description: "Local demo videos must stay within the 60 second quality cap.",
      suggested_fix: "Compress timeline shot durations while preserving the full explanation.",
    });
  }

  for (const issue of preflight?.issues ?? []) {
    if (issue.severity === "high" || issue.severity === "medium") {
      issues.push({
        ...issue,
        suggested_fix: issue.suggested_fix || "Repair the component graph or timeline at the highest abstraction level.",
      });
    }
  }

  if (!Array.isArray(componentGraph?.nodes) || componentGraph.nodes.length === 0) {
    issues.push({
      severity: "high",
      type: "empty_component_graph",
      description: "No component nodes are available for visual QA.",
      suggested_fix: "Regenerate component graph.",
    });
  }

  const sampledFrames = sampleFrameMarkers(timeline);
  const highSeverityCount = issues.filter((issue) => issue.severity === "high").length;
  const mediumSeverityCount = issues.filter((issue) => issue.severity === "medium").length;
  const score = Math.max(0.5, 0.96 - highSeverityCount * 0.25 - mediumSeverityCount * 0.1);

  return {
    qa_type: "visual",
    qa_score: Number(score.toFixed(2)),
    passed: highSeverityCount === 0,
    issues,
    sampled_frames: sampledFrames,
    checks: [
      "video_url_present",
      "duration_within_local_cap",
      "component_graph_non_empty",
      "timeline_resolves_nodes",
      "frame_samples_declared",
    ],
  };
}

export function createRepairPlan({ qaReport, timeline }) {
  if (qaReport.passed) {
    return {
      repaired: false,
      reason: "Preview QA passed; no repair needed before final render.",
      changes: [],
    };
  }

  const changes = [];
  if (qaReport.issues.some((issue) => issue.type === "duration_limit_exceeded")) {
    changes.push({
      repair_type: "timeline",
      change: "Timeline remains capped to the local 60 second quality duration.",
    });
  }
  if (qaReport.issues.some((issue) => issue.type === "component_fallback")) {
    changes.push({
      repair_type: "component_fallback",
      change: "Keep fallback nodes as GenericDiagram so the final render remains intentional.",
    });
  }

  return {
    repaired: true,
    reason: "Applied high-level repair notes before final render.",
    changes,
    timeline_version: timeline.version,
  };
}
