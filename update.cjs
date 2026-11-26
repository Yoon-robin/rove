// Updates for an installed Rove (robin 2026-11-24 "설치 버전·자동 업데이트").
// A release is the whole app, Electron with it (a browser's engine fixes come
// with Electron). The release script puts Rove-<version>-win-x64.zip and
// latest.json in a GitHub release (config.cjs: updates). latest.json is signed
// with a release key (Ed25519, config.cjs: updateKeys) and names the zip's
// sha256: a new version is taken only when both hold.
//
// Installed layout (install.cmd makes it):
//   %LOCALAPPDATA%\Rove\app-<version>\Rove.exe   one folder per version
//   %LOCALAPPDATA%\Rove\current                  a junction to the one in use
//   shortcuts -> current\Rove.exe
// A new version is unpacked beside the running one and the junction is moved
// to it; the next start runs it. The running one is never touched.
const { execFile } = require("node:child_process");
const { createHash, createPublicKey, verify } = require("node:crypto");
const { createReadStream, createWriteStream, existsSync, mkdirSync, readdirSync, readFileSync, readlinkSync, realpathSync, renameSync, rmSync, statSync } = require("node:fs");
const { basename, dirname, join } = require("node:path");
const { Readable } = require("node:stream");
const { pipeline } = require("node:stream/promises");
const SYS = join(process.env.SystemRoot || "C:\\Windows", "System32");

const run = (cmd, args, timeout) => new Promise((done) => {
  execFile(cmd, args, { windowsHide: true, timeout, maxBuffer: 1e6 }, (err, out, errOut) => done({ ok: !err, out: String(out || ""), err: String(errOut || err?.message || "") }));
});
const sha256 = (file) => new Promise((done, fail) => {
  const h = createHash("sha256");
  createReadStream(file).on("data", (b) => h.update(b)).on("end", () => done(h.digest("hex"))).on("error", fail);
});
// a version or file name: no path in it
const safe = (v) => /^[0-9A-Za-z][\w.-]{0,79}$/.test(String(v || "")) && !String(v).includes("..");
// what the release key signs (scripts/release-rove.mjs makes the same lines)
const signed = (l) => ["rove-update", l.version, l.build, l.file, l.sha256, l.size].join("\n");
// keys: one release key or a list of them (config.cjs updateKeys) — any one that signed it will do
function trusted(latest, keys) {
  return [].concat(keys).some((key) => {
    try { return verify(null, Buffer.from(signed(latest)), createPublicKey({ key: Buffer.from(key, "base64"), format: "der", type: "spki" }), Buffer.from(String(latest.sig || ""), "base64")); } catch { return false; }
  });
}

// where the running copy lives, if it is an installed one:
// <home>\app-<version>\resources\app.asar  ->  { home, dir, version }
function installed(appDir) {
  // the shortcuts start current\Rove.exe: the junction is read through to app-<version>
  let exeDir = dirname(process.execPath);
  try { exeDir = realpathSync.native(exeDir); } catch { /* as it is */ }
  const m = /^app-(.+)$/.exec(basename(exeDir));
  if (!m) return null;
  let v = null;
  try { v = JSON.parse(readFileSync(join(appDir, "version.json"), "utf8")); } catch { return null; }
  if (v.version !== m[1]) return null;
  return { home: dirname(exeDir), dir: exeDir, version: v.version, build: Number(v.build) || 0 };
}

// the junction <home>\current -> to
async function point(home, to) {
  const link = join(home, "current");
  const next = join(home, "current.next");
  if (existsSync(next)) await run(join(SYS, "cmd.exe"), ["/d", "/c", "rmdir", next], 20000);
  const made = await run(join(SYS, "cmd.exe"), ["/d", "/c", "mklink", "/J", next, to], 20000);
  if (!made.ok) throw new Error(`연결을 만들지 못했어요: ${made.err.trim().slice(0, 120)}`);
  // a junction is removed as a folder without touching what it points at
  if (existsSync(link)) { const gone = await run(join(SYS, "cmd.exe"), ["/d", "/c", "rmdir", link], 20000); if (!gone.ok) throw new Error("옛 연결을 지우지 못했어요"); }
  renameSync(next, link);
}

function current(home) {
  try { return readlinkSync(join(home, "current")).replace(/[\\/]+$/, ""); } catch { return null; }
}

// mine: installed(); url: where latest.json is (a folder, ending in /); key: the
// release keys (config.cjs updateKeys); fetch: Electron's net.fetch; tell(state) for the window; log(text).
// Returns { check, state }.
function updater({ mine, tell, log, url, key, fetch }) {
  let state = { version: mine.version, ready: null, checking: false, downloading: null, checkedAt: 0, error: null };
  const set = (change) => { state = { ...state, ...change }; tell(state); };
  let busy = false;

  async function check() {
    if (busy) return state;
    busy = true;
    set({ checking: true, error: null });
    try {
      let latest;
      try {
        const r = await fetch(url + "latest.json", { cache: "no-store", signal: AbortSignal.timeout(30000) });
        if (!r.ok) throw new Error(String(r.status));
        latest = await r.json();
      } catch (e) { throw new Error(`업데이트 주소에 닿지 않아요(${String(e.message).slice(0, 60)})`); }
      if (!safe(latest.version) || !safe(latest.file) || !/^[0-9a-f]{64}$/.test(latest.sha256 || "") || !(Number(latest.size) > 0)) throw new Error("latest.json이 이상해요");
      if (!trusted(latest, key)) throw new Error("latest.json의 서명이 맞지 않아요");
      if (!(Number(latest.build) > mine.build)) { set({ checking: false, checkedAt: Date.now() }); return state; }
      const to = join(mine.home, `app-${latest.version}`);
      if (!existsSync(join(to, "Rove.exe")) || !existsSync(join(to, "resources", "app.asar"))) {
        set({ downloading: latest.version });
        const zip = join(mine.home, `${latest.version}.zip.part`);
        const tmp = join(mine.home, `app-${latest.version}.tmp`);
        rmSync(tmp, { recursive: true, force: true });
        log(`새 버전 ${latest.version}을 받는 중이에요.`);
        try {
          const r = await fetch(url + latest.file, { cache: "no-store", signal: AbortSignal.timeout(20 * 60000) });
          if (!r.ok || !r.body) throw new Error(String(r.status));
          await pipeline(Readable.fromWeb(r.body), createWriteStream(zip));
        } catch (e) { rmSync(zip, { force: true }); throw new Error(`새 버전을 받지 못했어요: ${String(e.message).slice(0, 160)}`); }
        if ((await sha256(zip)) !== latest.sha256) { rmSync(zip, { force: true }); throw new Error("받은 파일이 깨졌어요(sha256이 달라요)"); }
        mkdirSync(tmp, { recursive: true });
        const x = await run(join(SYS, "tar.exe"), ["-xf", zip, "-C", tmp], 10 * 60000);
        rmSync(zip, { force: true });
        if (!x.ok || !existsSync(join(tmp, "Rove.exe"))) {
          rmSync(tmp, { recursive: true, force: true });
          throw new Error(`새 버전을 풀지 못했어요: ${x.err.trim().slice(0, 160)}`);
        }
        rmSync(to, { recursive: true, force: true });
        renameSync(tmp, to);
      }
      await point(mine.home, to);
      log(`새 버전 ${latest.version}으로 바꿔 뒀어요. 다시 켜면 그 버전이에요.`);
      set({ checking: false, downloading: null, checkedAt: Date.now(), ready: latest.version });
    } catch (e) {
      log(`새 버전 확인: ${e.message}`);
      set({ checking: false, downloading: null, checkedAt: Date.now(), error: e.message });
    } finally {
      busy = false;
    }
    return state;
  }

  return { check, state: () => state, exe: () => join(mine.home, "current", "Rove.exe") };
}

// at start: versions other than the running one and the one current points at go
// (each is ~360 MB unpacked); one still open in another Rove fails to go and stays
function tidy(mine) {
  const keep = new Set([mine.dir.toLowerCase(), (current(mine.home) || "").toLowerCase()]);
  try {
    for (const name of readdirSync(mine.home)) {
      const p = join(mine.home, name);
      if (/^app-.+\.tmp$|\.zip\.part$/.test(name)) { rmSync(p, { recursive: true, force: true }); continue; }
      if (!/^app-/.test(name) || keep.has(p.toLowerCase())) continue;
      try { rmSync(p, { recursive: true, force: true }); } catch { /* in use */ }
    }
  } catch { /* nothing to tidy */ }
}

// Rove in Windows' installed apps (Settings > Apps, under the current user, no
// administrator): its remove button runs current\RoveSetup.exe --uninstall
// (rove/setup, in every release beside Rove.exe). Written at every start, so the
// version and size there follow updates. RoveSetup.exe writes the same at install.
const UNINSTALL = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Rove";
function size(dir) {
  let n = 0;
  try { for (const e of readdirSync(dir, { withFileTypes: true })) { const p = join(dir, e.name); n += e.isDirectory() ? size(p) : statSync(p).size; } } catch { /* what could be read */ }
  return n;
}
async function listed(mine, version) {
  const cur = join(mine.home, "current");
  const setup = join(cur, "RoveSetup.exe");
  if (!existsSync(join(mine.dir, "RoveSetup.exe"))) return false; // a release from before it: nothing to remove with
  const values = [
    ["DisplayName", "REG_SZ", "Rove"],
    ["DisplayVersion", "REG_SZ", version],
    ["Publisher", "REG_SZ", "yoonrobin.xyz"],
    ["DisplayIcon", "REG_SZ", `${join(cur, "Rove.exe")},0`],
    ["InstallLocation", "REG_SZ", mine.home],
    ["UninstallString", "REG_SZ", `"${setup}" --uninstall`],
    ["URLInfoAbout", "REG_SZ", "https://rove.yoonrobin.xyz/"],
    ["NoModify", "REG_DWORD", "1"],
    ["NoRepair", "REG_DWORD", "1"],
    ["EstimatedSize", "REG_DWORD", String(Math.round(size(mine.dir) / 1024))],
  ];
  for (const [name, type, data] of values) {
    const r = await run(join(SYS, "reg.exe"), ["add", UNINSTALL, "/v", name, "/t", type, "/d", data, "/f"], 15000);
    if (!r.ok) return false;
  }
  return true;
}

module.exports = { installed, updater, tidy, listed, signed, trusted };
