// node test/drive.mjs <steps.mjs>: starts Rove hidden (ROVE_TEST) with its
// own profile, runs each step's JS in the main process (globalThis.__rove)
// and prints what it returns. Steps: [{ js, wait }] ; `js` may be async.
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, "..");
const steps = (await import(pathToFileURL(process.argv[2]).href)).default;
const home = mkdtempSync(join(tmpdir(), "rove-test-"));
const port = 9300 + Math.floor(Math.random() * 500);
// ROVE_EXE: the packaged Rove.exe instead of the repository's Electron
const exe = process.env.ROVE_EXE || join(APP, "node_modules", "electron", "dist", "electron.exe");
const child = spawn(exe, process.env.ROVE_EXE ? [`--inspect=${port}`] : [`--inspect=${port}`, APP], { env: { ...process.env, ROVE_TEST: "1", ROVE_HOME: home, ROVE_START: process.env.ROVE_START || "" }, stdio: ["ignore", "pipe", "pipe"] });
let log = "";
child.stdout.on("data", (b) => (log += b));
child.stderr.on("data", (b) => (log += b));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws = null;
for (let i = 0; i < 100 && !ws; i++) {
  await sleep(200);
  try { const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); if (list[0]) ws = new WebSocket(list[0].webSocketDebuggerUrl); } catch { /* not yet */ }
}
if (!ws) { console.log("no inspector\n" + log); child.kill(); process.exit(1); }
await new Promise((r) => (ws.onopen = r));
let id = 0;
const waiting = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); waiting.get(d.id)?.(d); };
const call = (method, params) => new Promise((r) => { const n = ++id; waiting.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
const run = async (js) => {
  const r = await call("Runtime.evaluate", { expression: `(async () => { const R = globalThis.__rove; ${js} })()`, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) return "ERR " + (r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text);
  return r.result?.result?.value;
};
for (let i = 0; i < 60; i++) { if (await run("return !!(R && R.win && R.active)") === true) break; await sleep(250); }
for (const s of steps) {
  if (s.wait) await sleep(s.wait);
  if (s.js) { const v = await run(s.js); if (v !== undefined) console.log(typeof v === "string" ? v : JSON.stringify(v)); }
}
await run("R.win.close()");
await sleep(800);
// the profile goes once Rove is gone: its helper processes hold files a moment after the kill
// (deleting at once left a %TEMP%\rove-test-* behind on every run)
const gone = child.exitCode !== null ? Promise.resolve() : new Promise((r) => child.once("exit", r));
child.kill();
await Promise.race([gone, sleep(5000)]);
if (process.env.ROVE_LOG) console.log(log);
try { rmSync(home, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 }); } catch { console.log(`프로필을 못 지웠어요: ${home}`); }
