// node test/update.mjs: update.cjs's check() against a made-up install in %TEMP%
// and a local latest.json signed with a throwaway key (no network, no real install).
// 1) current already points at a newer version than latest.json (installed by hand,
//    or by a newer Rove) -> current stays; it used to be moved back to latest.json's
// 2) current is the running one, latest.json is newer -> current moves to it
import { createRequire } from "node:module";
import { generateKeyPairSync, sign } from "node:crypto";
import { createServer } from "node:http";
import { mkdirSync, mkdtempSync, readlinkSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const { updater, signed } = require("../update.cjs");
const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const key = publicKey.export({ format: "der", type: "spki" }).toString("base64");

let latest = null;
const server = createServer((req, res) => {
  if (req.url === "/latest.json") { res.setHeader("content-type", "application/json"); res.end(JSON.stringify(latest)); return; }
  res.statusCode = 404; res.end();
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const url = `http://127.0.0.1:${server.address().port}/`;

function app(home, version, build) {
  const dir = join(home, `app-${version}`);
  mkdirSync(join(dir, "resources", "app.asar"), { recursive: true });
  writeFileSync(join(dir, "Rove.exe"), "");
  writeFileSync(join(dir, "resources", "app.asar", "version.json"), JSON.stringify({ version, build }));
  return dir;
}
function release(version, build) {
  const l = { version, build, file: `Rove-${version}-win-x64.zip`, sha256: "0".repeat(64), size: 1 };
  l.sig = sign(null, Buffer.from(signed(l)), privateKey).toString("base64");
  return l;
}
const junction = (from, to) => execFileSync("cmd.exe", ["/d", "/c", "mklink", "/J", from, to], { windowsHide: true, stdio: "ignore" });
const unjunction = (p) => { try { execFileSync("cmd.exe", ["/d", "/c", "rmdir", p], { windowsHide: true, stdio: "ignore" }); } catch { /* not there */ } };
const at = (home) => readlinkSync(join(home, "current")).replace(/[\\/]+$/, "");

let failed = 0;
async function test(name, { cur, newest }, want) {
  const home = mkdtempSync(join(tmpdir(), "rove-update-"));
  try {
    const mine = { home, dir: app(home, "1.2.2", 10), version: "1.2.2", build: 10 };
    app(home, "1.2.3", 20);
    if (cur) app(home, cur[0], cur[1]);
    junction(join(home, "current"), join(home, `app-${cur ? cur[0] : "1.2.2"}`));
    latest = release(...newest);
    const u = updater({ mine, url, key, fetch, tell: () => {}, log: () => {} });
    const s = await u.check();
    const got = at(home);
    const ok = got === join(home, `app-${want}`) && !s.error;
    if (!ok) failed++;
    console.log(`${ok ? "ok  " : "FAIL"} ${name}: current -> ${got.slice(home.length + 1)}${s.error ? `, error ${s.error}` : ""} (want app-${want})`);
  } finally {
    unjunction(join(home, "current"));
    rmSync(home, { recursive: true, force: true });
  }
}

await test("newer version already current", { cur: ["1.2.4", 30], newest: ["1.2.3", 20] }, "1.2.4");
await test("latest.json newer than current", { cur: null, newest: ["1.2.3", 20] }, "1.2.3");
server.close();
process.exit(failed ? 1 : 0);
