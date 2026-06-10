import fs from "node:fs/promises";
import path from "node:path";

export function createLogger({ logDirectory, consoleEnabled = false }) {
  const logFile = path.join(logDirectory, "app.jsonl");

  async function write(level, event, fields = {}) {
    await fs.mkdir(logDirectory, { recursive: true });
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      event,
      ...fields,
    };
    const line = `${JSON.stringify(entry)}\n`;
    await fs.appendFile(logFile, line);

    if (consoleEnabled) {
      console.log(line.trim());
    }
  }

  return {
    logFile,
    info: (event, fields) => write("info", event, fields),
    warn: (event, fields) => write("warn", event, fields),
    error: (event, fields) => write("error", event, fields),
  };
}
