function createStageBucket() {
  return {
    count: 0,
    total: 0,
    min: null,
    max: null,
  };
}

export function createMetrics() {
  const counters = {
    video_jobs_created: 0,
    video_jobs_completed: 0,
    video_jobs_failed: 0,
  };
  const stageDurationsMs = {};

  return {
    increment(name, value = 1) {
      counters[name] = (counters[name] ?? 0) + value;
    },

    observeStage(stage, durationMs) {
      const bucket = stageDurationsMs[stage] ?? createStageBucket();
      bucket.count += 1;
      bucket.total += durationMs;
      bucket.min = bucket.min === null ? durationMs : Math.min(bucket.min, durationMs);
      bucket.max = bucket.max === null ? durationMs : Math.max(bucket.max, durationMs);
      bucket.avg = Math.round(bucket.total / bucket.count);
      stageDurationsMs[stage] = bucket;
    },

    snapshot() {
      return {
        counters: { ...counters },
        stageDurationsMs: structuredClone(stageDurationsMs),
      };
    },

    prometheus() {
      const lines = [];
      for (const [name, value] of Object.entries(counters)) {
        lines.push(`# TYPE ${name} counter`);
        lines.push(`${name} ${value}`);
      }
      for (const [stage, bucket] of Object.entries(stageDurationsMs)) {
        const label = `{stage="${stage}"}`;
        lines.push(`video_job_stage_duration_ms_count${label} ${bucket.count}`);
        lines.push(`video_job_stage_duration_ms_sum${label} ${bucket.total}`);
      }
      return `${lines.join("\n")}\n`;
    },
  };
}
