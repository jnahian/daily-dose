/**
 * Generates VO audio files from script.ts using OpenAI TTS API.
 * Run: npm run video:vo
 * Requires OPENAI_API_KEY in video/.env.local
 */
import * as fs from "fs";
import * as path from "path";
import * as https from "https";

// Load .env.local
const envPath = path.join(__dirname, "../../.env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    process.env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
}

const API_KEY = process.env.OPENAI_API_KEY;
if (!API_KEY) {
  console.error("Missing OPENAI_API_KEY in video/.env.local");
  process.exit(1);
}

// tts-1-hd for higher quality; voice "nova" is clear and neutral
const MODEL = "tts-1-hd";
const VOICE = "nova";

const SCRIPT: Record<string, string> = {
  hook:     "Meet Daily Dose — standups without the meeting.",
  reminder: "Every morning, Daily Dose sends you a quick DM at standup time.",
  modal:    "One click opens your standup. Fill in three quick fields and you're done.",
  summary:  "Responses post automatically to your team channel — no meeting required.",
  cta:      "You're all set. Watch for your first reminder.",
  cmd_standup:          "Submit your standup manually at any time, from any channel.",
  cmd_standup_update:   "Edit today's or any past standup — pre-filled with your existing response.",
  cmd_standup_reminder: "Toggle your daily reminder or hide yourself from the not-responded list.",
  cmd_standup_history:  "Browse your submission history — one day, or a full date range.",
  cmd_leave_set:        "Mark yourself on leave and reminders are skipped automatically.",
  cmd_leave_list:       "See all your upcoming and past leave dates at a glance.",
};

// Write to the repo's public/vo/ so staticFile("vo/key.mp3") resolves in Remotion
const OUT_DIR = path.join(__dirname, "../../../public/vo");

async function generateClip(key: string, text: string): Promise<void> {
  const outPath = path.join(OUT_DIR, `${key}.mp3`);
  console.log(`Generating ${key}.mp3 ...`);

  const body = JSON.stringify({ model: MODEL, voice: VOICE, input: text });

  await new Promise<void>((resolve, reject) => {
    const req = https.request(
      {
        hostname: "api.openai.com",
        path: "/v1/audio/speech",
        method: "POST",
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        if (res.statusCode !== 200) {
          let err = "";
          res.on("data", (d) => (err += d));
          res.on("end", () => reject(new Error(`OpenAI TTS ${res.statusCode}: ${err}`)));
          return;
        }
        const out = fs.createWriteStream(outPath);
        res.pipe(out);
        out.on("finish", () => { console.log(`  ✓ ${outPath}`); resolve(); });
        out.on("error", reject);
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const [key, text] of Object.entries(SCRIPT)) {
    await generateClip(key, text);
  }
  console.log("\nAll clips generated. Run `npm run video:render` to rebuild the video.");
}

main().catch((e) => { console.error(e); process.exit(1); });
