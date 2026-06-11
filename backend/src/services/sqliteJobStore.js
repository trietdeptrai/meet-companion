import fs from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function json(data) {
  return JSON.stringify(data ?? null);
}

function parseJson(value, fallback = null) {
  if (value === null || value === undefined || value === "") return fallback;
  return JSON.parse(value);
}

async function writeArtifactFile(filePath, content) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const body = typeof content === "string" ? content : JSON.stringify(content, null, 2);
  await fs.writeFile(filePath, `${body}\n`);
}

export function createSqliteJobStore({ dataDirectory, databasePath }) {
  const artifactsDirectory = path.join(dataDirectory, "artifacts");
  let db;

  function getDb() {
    if (!db) {
      db = new DatabaseSync(databasePath);
      db.exec("PRAGMA journal_mode = WAL");
      db.exec("PRAGMA foreign_keys = ON");
    }
    return db;
  }

  function migrate() {
    getDb().exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        concept TEXT NOT NULL,
        normalized_concept TEXT,
        domain TEXT,
        level TEXT,
        language TEXT,
        status TEXT NOT NULL,
        latest_job_id TEXT,
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS video_jobs (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        status TEXT NOT NULL,
        current_stage TEXT,
        progress INTEGER DEFAULT 0,
        error_code TEXT,
        error_message TEXT,
        retry_count INTEGER DEFAULT 0,
        config_json TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        completed_at TEXT,
        FOREIGN KEY(project_id) REFERENCES projects(id)
      );

      CREATE TABLE IF NOT EXISTS artifacts (
        id TEXT PRIMARY KEY,
        project_id TEXT,
        job_id TEXT NOT NULL,
        artifact_type TEXT NOT NULL,
        storage_key TEXT NOT NULL,
        url TEXT,
        mime_type TEXT,
        size_bytes INTEGER,
        metadata_json TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY(job_id) REFERENCES video_jobs(id)
      );

      CREATE TABLE IF NOT EXISTS pipeline_steps (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL,
        stage TEXT NOT NULL,
        status TEXT NOT NULL,
        input_ref TEXT,
        output_ref TEXT,
        logs TEXT,
        started_at TEXT,
        ended_at TEXT,
        duration_ms INTEGER,
        FOREIGN KEY(job_id) REFERENCES video_jobs(id)
      );

      CREATE TABLE IF NOT EXISTS render_attempts (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL,
        attempt_no INTEGER NOT NULL,
        scene_name TEXT,
        command TEXT,
        status TEXT NOT NULL,
        stdout TEXT,
        stderr TEXT,
        output_ref TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY(job_id) REFERENCES video_jobs(id)
      );

      CREATE TABLE IF NOT EXISTS creative_treatments (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        job_id TEXT NOT NULL,
        treatment_id TEXT NOT NULL,
        title TEXT,
        visual_hook TEXT,
        score REAL,
        selected INTEGER DEFAULT 0,
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY(project_id) REFERENCES projects(id),
        FOREIGN KEY(job_id) REFERENCES video_jobs(id)
      );

      CREATE TABLE IF NOT EXISTS component_graphs (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        job_id TEXT NOT NULL,
        version INTEGER NOT NULL,
        status TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY(project_id) REFERENCES projects(id),
        FOREIGN KEY(job_id) REFERENCES video_jobs(id)
      );

      CREATE TABLE IF NOT EXISTS timelines (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        job_id TEXT NOT NULL,
        version INTEGER NOT NULL,
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY(project_id) REFERENCES projects(id),
        FOREIGN KEY(job_id) REFERENCES video_jobs(id)
      );

      CREATE TABLE IF NOT EXISTS qa_reports (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        job_id TEXT NOT NULL,
        render_attempt_id TEXT,
        qa_type TEXT NOT NULL,
        score REAL,
        passed INTEGER NOT NULL,
        issues_json TEXT,
        sampled_frames_json TEXT,
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY(project_id) REFERENCES projects(id),
        FOREIGN KEY(job_id) REFERENCES video_jobs(id)
      );

      CREATE TABLE IF NOT EXISTS render_passes (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        job_id TEXT NOT NULL,
        pass_type TEXT NOT NULL,
        renderer TEXT NOT NULL,
        status TEXT NOT NULL,
        input_ref TEXT,
        output_ref TEXT,
        logs_ref TEXT,
        duration_ms INTEGER,
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY(project_id) REFERENCES projects(id),
        FOREIGN KEY(job_id) REFERENCES video_jobs(id)
      );

      CREATE TABLE IF NOT EXISTS motion_components (
        id TEXT PRIMARY KEY,
        component_id TEXT NOT NULL,
        version TEXT NOT NULL,
        renderer TEXT NOT NULL,
        quality_tier TEXT NOT NULL,
        schema_json TEXT NOT NULL,
        defaults_json TEXT NOT NULL,
        examples_json TEXT,
        created_at TEXT NOT NULL,
        UNIQUE(component_id, version)
      );
    `);
  }

  function upsertPipelineSteps(job) {
    const statement = getDb().prepare(`
      INSERT OR REPLACE INTO pipeline_steps (
        id, job_id, stage, status, input_ref, output_ref, logs, started_at, ended_at, duration_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const step of job.pipeline_steps ?? []) {
      statement.run(
        step.id,
        job.job_id,
        step.stage,
        step.status,
        step.input_ref ?? null,
        step.output_ref ?? null,
        step.logs ?? null,
        step.started_at ?? null,
        step.ended_at ?? null,
        step.duration_ms ?? null,
      );
    }
  }

  function upsertArtifacts(job) {
    const statement = getDb().prepare(`
      INSERT OR REPLACE INTO artifacts (
        id, project_id, job_id, artifact_type, storage_key, url, mime_type, size_bytes, metadata_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const artifact of job.artifacts ?? []) {
      statement.run(
        artifact.artifact_id,
        job.project_id,
        job.job_id,
        artifact.artifact_type,
        artifact.storage_key,
        artifact.url ?? null,
        artifact.mime_type ?? null,
        artifact.size_bytes ?? null,
        json(artifact.metadata ?? {}),
        artifact.created_at,
      );
    }
  }

  return {
    dataDirectory,
    databasePath,

    async ensureReady() {
      await fs.mkdir(dataDirectory, { recursive: true });
      await fs.mkdir(artifactsDirectory, { recursive: true });
      migrate();
    },

    async isReady() {
      return pathExists(databasePath);
    },

    async saveJob(job) {
      await this.ensureReady();
      getDb()
        .prepare(`
          INSERT OR REPLACE INTO video_jobs (
            id, project_id, status, current_stage, progress, error_code, error_message,
            retry_count, config_json, payload_json, created_at, updated_at, completed_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          job.job_id,
          job.project_id,
          job.status,
          job.current_stage,
          job.progress,
          job.error_code ?? null,
          job.error_message ?? null,
          job.retry_count ?? 0,
          json(job.config),
          json(job),
          job.created_at,
          job.updated_at,
          job.completed_at ?? null,
        );

      upsertPipelineSteps(job);
      upsertArtifacts(job);
      return job;
    },

    async getJob(jobId) {
      await this.ensureReady();
      const row = getDb()
        .prepare("SELECT payload_json FROM video_jobs WHERE id = ?")
        .get(jobId);
      return row ? parseJson(row.payload_json) : null;
    },

    async saveProject(project) {
      await this.ensureReady();
      getDb()
        .prepare(`
          INSERT OR REPLACE INTO projects (
            id, title, concept, normalized_concept, domain, level, language, status,
            latest_job_id, payload_json, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          project.project_id,
          project.title,
          project.concept,
          project.normalized_concept ?? project.concept,
          project.domain ?? null,
          project.level ?? null,
          project.language ?? null,
          project.status,
          project.latest_job_id ?? null,
          json(project),
          project.created_at,
          project.updated_at,
        );
      return project;
    },

    async getProject(projectId) {
      await this.ensureReady();
      const row = getDb()
        .prepare("SELECT payload_json FROM projects WHERE id = ?")
        .get(projectId);
      return row ? parseJson(row.payload_json) : null;
    },

    async saveArtifact(jobId, artifactType, fileName, content, metadata = {}) {
      await this.ensureReady();
      const storageKey = path.join("artifacts", jobId, fileName);
      const absolutePath = path.join(dataDirectory, storageKey);
      await writeArtifactFile(absolutePath, content);
      const stat = await fs.stat(absolutePath);

      return {
        artifact_id: `${jobId}:${artifactType}`,
        artifact_type: artifactType,
        storage_key: storageKey,
        path: absolutePath,
        mime_type: "application/json",
        size_bytes: stat.size,
        metadata,
        created_at: new Date().toISOString(),
      };
    },

    async saveRenderAttempt(attempt) {
      await this.ensureReady();
      getDb()
        .prepare(`
          INSERT OR REPLACE INTO render_attempts (
            id, job_id, attempt_no, scene_name, command, status, stdout, stderr, output_ref, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          attempt.id,
          attempt.job_id,
          attempt.attempt_no,
          attempt.scene_name ?? null,
          attempt.command ?? null,
          attempt.status,
          attempt.stdout ?? null,
          attempt.stderr ?? null,
          attempt.output_ref ?? null,
          attempt.created_at,
        );
      return attempt;
    },

    async saveCreativeTreatment(treatment) {
      await this.ensureReady();
      getDb()
        .prepare(`
          INSERT OR REPLACE INTO creative_treatments (
            id, project_id, job_id, treatment_id, title, visual_hook, score, selected, payload_json, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          treatment.id,
          treatment.project_id,
          treatment.job_id,
          treatment.treatment_id,
          treatment.title ?? null,
          treatment.visual_hook ?? null,
          treatment.score ?? null,
          treatment.selected ? 1 : 0,
          json(treatment.payload ?? treatment),
          treatment.created_at,
        );
      return treatment;
    },

    async saveComponentGraph(graph) {
      await this.ensureReady();
      getDb()
        .prepare(`
          INSERT OR REPLACE INTO component_graphs (
            id, project_id, job_id, version, status, payload_json, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          graph.id,
          graph.project_id,
          graph.job_id,
          graph.version,
          graph.status,
          json(graph.payload),
          graph.created_at,
        );
      return graph;
    },

    async saveTimeline(timeline) {
      await this.ensureReady();
      getDb()
        .prepare(`
          INSERT OR REPLACE INTO timelines (
            id, project_id, job_id, version, payload_json, created_at
          ) VALUES (?, ?, ?, ?, ?, ?)
        `)
        .run(
          timeline.id,
          timeline.project_id,
          timeline.job_id,
          timeline.version,
          json(timeline.payload),
          timeline.created_at,
        );
      return timeline;
    },

    async saveQaReport(report) {
      await this.ensureReady();
      getDb()
        .prepare(`
          INSERT OR REPLACE INTO qa_reports (
            id, project_id, job_id, render_attempt_id, qa_type, score, passed,
            issues_json, sampled_frames_json, payload_json, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          report.id,
          report.project_id,
          report.job_id,
          report.render_attempt_id ?? null,
          report.qa_type,
          report.score ?? null,
          report.passed ? 1 : 0,
          json(report.issues ?? []),
          json(report.sampled_frames ?? []),
          json(report.payload ?? report),
          report.created_at,
        );
      return report;
    },

    async saveRenderPass(renderPass) {
      await this.ensureReady();
      getDb()
        .prepare(`
          INSERT OR REPLACE INTO render_passes (
            id, project_id, job_id, pass_type, renderer, status, input_ref, output_ref,
            logs_ref, duration_ms, payload_json, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          renderPass.id,
          renderPass.project_id,
          renderPass.job_id,
          renderPass.pass_type,
          renderPass.renderer,
          renderPass.status,
          renderPass.input_ref ?? null,
          renderPass.output_ref ?? null,
          renderPass.logs_ref ?? null,
          renderPass.duration_ms ?? null,
          json(renderPass.payload ?? renderPass),
          renderPass.created_at,
        );
      return renderPass;
    },

    async upsertMotionComponent(component) {
      await this.ensureReady();
      getDb()
        .prepare(`
          INSERT OR REPLACE INTO motion_components (
            id, component_id, version, renderer, quality_tier, schema_json,
            defaults_json, examples_json, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          `${component.component_id}:${component.version}`,
          component.component_id,
          component.version,
          Array.isArray(component.renderer) ? component.renderer.join(",") : component.renderer,
          component.quality_tier,
          json(component.schema ?? {}),
          json(component.defaults ?? {}),
          json(component.examples ?? []),
          component.created_at ?? new Date().toISOString(),
        );
      return component;
    },

    async getCounts() {
      await this.ensureReady();
      const tables = [
        "projects",
        "video_jobs",
        "artifacts",
        "pipeline_steps",
        "render_attempts",
        "creative_treatments",
        "component_graphs",
        "timelines",
        "qa_reports",
        "render_passes",
        "motion_components",
      ];
      return Object.fromEntries(
        tables.map((table) => [
          table,
          getDb().prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count,
        ]),
      );
    },
  };
}
