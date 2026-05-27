/**
 * Generates background music using the Mubert API.
 * Run: npm run video:music
 * Requires MUBERT_API_KEY in video/.env.local
 *
 * Free tier: https://mubert.com/render/pricing
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

const API_KEY = process.env.MUBERT_API_KEY;
if (!API_KEY) {
  console.error("Missing MUBERT_API_KEY in video/.env.local");
  process.exit(1);
}

const OUT_PATH = path.join(__dirname, "../../../public/music.mp3");
// Video is ~53s — generate 60s so there's headroom
const DURATION = 60;
// Ambient, modern, tech-product feel
const TAGS = "ambient,tech,corporate,modern,uplifting,background";

function post(hostname: string, path: string, body: object): Promise<object> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request(
      { hostname, path, method: "POST", headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) } },
      (res) => {
        let raw = "";
        res.on("data", (c) => (raw += c));
        res.on("end", () => {
          try { resolve(JSON.parse(raw)); }
          catch { reject(new Error(`Bad JSON: ${raw}`)); }
        });
      }
    );
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

function download(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        file.close();
        download(res.headers.location!, dest).then(resolve).catch(reject);
        return;
      }
      res.pipe(file);
      file.on("finish", () => { file.close(); resolve(); });
    }).on("error", (e) => { fs.unlink(dest, () => {}); reject(e); });
  });
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

async function main() {
  console.log("Requesting track generation from Mubert...");

  // Step 1: get access token
  const authRes: any = await post("api-b2b.mubert.com", "/v2/GetServiceAccess", {
    method: "GetServiceAccess",
    params: { pat: API_KEY, email: "video@dailydose.bot" },
  });
  const token: string = authRes?.data?.pat;
  if (!token) { console.error("Auth failed:", JSON.stringify(authRes)); process.exit(1); }
  console.log("Authenticated.");

  // Step 2: request track
  const trackRes: any = await post("api-b2b.mubert.com", "/v2/RecordTrackTTM", {
    method: "RecordTrackTTM",
    params: { pat: token, tags: TAGS, duration: DURATION, format: "mp3", intensity: "medium" },
  });
  const taskId: string = trackRes?.data?.tasks?.[0]?.task_id;
  if (!taskId) { console.error("Track request failed:", JSON.stringify(trackRes)); process.exit(1); }
  console.log(`Task created: ${taskId}. Polling for completion...`);

  // Step 3: poll until done
  let downloadUrl = "";
  for (let i = 0; i < 30; i++) {
    await sleep(4000);
    const statusRes: any = await post("api-b2b.mubert.com", "/v2/GetTaskStatus", {
      method: "GetTaskStatus",
      params: { pat: token, task_id: taskId },
    });
    const task = statusRes?.data?.tasks?.[0];
    if (task?.task_status_code === 2) { downloadUrl = task.download_link; break; }
    if (task?.task_status_code === 3) { console.error("Task failed:", task); process.exit(1); }
    process.stdout.write(".");
  }
  if (!downloadUrl) { console.error("\nTimed out waiting for track."); process.exit(1); }

  // Step 4: download
  console.log(`\nDownloading from ${downloadUrl}`);
  await download(downloadUrl, OUT_PATH);
  console.log(`✓ Saved to ${OUT_PATH}`);
  console.log("Now uncomment the <Audio> line in MainVideo.tsx and re-render.");
}

main().catch((e) => { console.error(e); process.exit(1); });
