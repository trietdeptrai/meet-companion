import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const defaultDurationSeconds = 10;

function sanitizeFileName(value) {
  return value.replace(/[^a-zA-Z0-9-]/g, "-");
}

function buildPythagoreanFilter() {
  return [
    "drawbox=x=64:y=40:w=1152:h=640:color=0x172033:t=3",
    "drawbox=x=245:y=495:w=360:h=6:color=0x38bdf8:t=fill",
    "drawbox=x=245:y=285:w=6:h=216:color=0x38bdf8:t=fill",
    "drawbox=x=760:y=175:w=265:h=265:color=0xfbbf24:t=5:enable='gte(t,2)'",
    "drawbox=x=210:y=178:w=160:h=160:color=0x22c55e:t=5:enable='gte(t,3.5)'",
    "drawbox=x=420:y=345:w=210:h=210:color=0x60a5fa:t=5:enable='gte(t,5)'",
    "drawbox=x=760:y=175:w=265:h=265:color=0xfbbf24@0.18:t=fill:enable='gte(t,7)'",
    "drawbox=x=210:y=178:w=160:h=160:color=0x22c55e@0.24:t=fill:enable='between(t,7,8.5)'",
    "drawbox=x=420:y=345:w=210:h=210:color=0x60a5fa@0.24:t=fill:enable='gte(t,8.5)'",
  ].join(",");
}

function buildCartesianFilter() {
  return [
    "drawbox=x=64:y=40:w=1152:h=640:color=0x172033:t=3",
    "drawbox=x=160:y=360:w=960:h=4:color=0x94a3b8@0.45:t=fill",
    "drawbox=x=640:y=100:w=4:h=520:color=0x94a3b8@0.45:t=fill",
    "drawbox=x=320:y=100:w=2:h=520:color=0x334155@0.65:t=fill",
    "drawbox=x=480:y=100:w=2:h=520:color=0x334155@0.65:t=fill",
    "drawbox=x=800:y=100:w=2:h=520:color=0x334155@0.65:t=fill",
    "drawbox=x=960:y=100:w=2:h=520:color=0x334155@0.65:t=fill",
    "drawbox=x=160:y=200:w=960:h=2:color=0x334155@0.65:t=fill",
    "drawbox=x=160:y=280:w=960:h=2:color=0x334155@0.65:t=fill",
    "drawbox=x=160:y=440:w=960:h=2:color=0x334155@0.65:t=fill",
    "drawbox=x=160:y=520:w=960:h=2:color=0x334155@0.65:t=fill",
    "drawbox=x=637:y=357:w=10:h=10:color=0xf8fafc:t=fill:enable='gte(t,2)'",
    "drawbox=x=640:y=360:w=240:h=5:color=0x38bdf8:t=fill:enable='gte(t,4)'",
    "drawbox=x=875:y=200:w=5:h=165:color=0x22c55e:t=fill:enable='gte(t,5.5)'",
    "drawbox=x=864:y=190:w=28:h=28:color=0xfbbf24:t=fill:enable='gte(t,7)'",
    "drawbox=x=858:y=184:w=40:h=40:color=0xfbbf24@0.22:t=fill:enable='gte(t,8)'",
  ].join(",");
}

function buildFilter(template) {
  if (template.visualKind === "coordinate-plane") {
    return buildCartesianFilter();
  }

  return buildPythagoreanFilter();
}

export function createVideoGenerator({
  ffmpegPath = process.env.FFMPEG_PATH || "ffmpeg",
  outputDirectory,
  durationSeconds = defaultDurationSeconds,
} = {}) {
  if (!outputDirectory) {
    throw new Error("outputDirectory is required to generate videos.");
  }

  return async function generateVideo({ requestId, template }) {
    await fs.mkdir(outputDirectory, { recursive: true });

    const fileName = `${sanitizeFileName(requestId)}.mp4`;
    const outputPath = path.join(outputDirectory, fileName);
    const filter = buildFilter(template);

    await execFileAsync(ffmpegPath, [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-f",
      "lavfi",
      "-i",
      `color=c=0x080c18:s=1280x720:r=30:d=${durationSeconds}`,
      "-vf",
      filter,
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      outputPath,
    ]);

    return {
      templateId: template.id,
      url: `/generated/${fileName}`,
      mimeType: "video/mp4",
      durationSeconds,
      generated: true,
      style: template.videoStyle,
    };
  };
}
