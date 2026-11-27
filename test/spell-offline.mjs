// node test/spell-offline.mjs: a first run (new profile) that sits 15 s on the new tab asks
// nothing of Google for the spell checker — its dictionaries come with Rove (tools/dictionaries.cjs,
// run it once in a dev copy) and main.cjs puts them in the profile. Brave 158 sends no request to
// gvt1.com either. Reads Chromium's own net log of the run, so any request is seen, not only a page's.
import { existsSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
if (!existsSync(join(here, "..", "dictionaries", "ko-3-0.bdic"))) { console.log("FAIL 사전이 없어요: node tools/dictionaries.cjs 먼저"); process.exit(1); }
const dir = mkdtempSync(join(tmpdir(), "rove-spell-"));
const netLog = join(dir, "net.json"), steps = join(dir, "steps.mjs");
// the spell checker is on in the new tab's address field too; the check is at the end, after closing
writeFileSync(steps, `export default [{ wait: 15000, js: "const fs = process.mainModule.require('node:fs'), p = process.mainModule.require('node:path'); const d = p.join(process.mainModule.require('electron').app.getPath('userData'), 'Dictionaries'); return 'dict ' + (fs.existsSync(d) ? fs.readdirSync(d).sort().join(',') : '-')" }];`);
const run = spawnSync(process.execPath, [join(here, "drive.mjs"), steps], { encoding: "utf8", env: { ...process.env, ROVE_ARG: `--log-net-log=${netLog}` } });
const text = existsSync(netLog) ? readFileSync(netLog, "utf8") : "";
rmSync(dir, { recursive: true, force: true });
const out = run.stdout.trim();
let fail = 0;
const check = (ok, what) => { console.log(`${ok ? "ok" : "FAIL"} ${what}`); if (!ok) fail++; };
check(text.length > 1000, `net log 받음 (${text.length} 글자)`);
const google = [...new Set([...text.matchAll(/"url":"(https:\/\/[^"]*gvt1\.com[^"]*)"/g)].map((m) => m[1].split("?")[0]))];
check(google.length === 0, `Google 사전 서버로 간 요청 없음${google.length ? ": " + google.join(", ") : ""}`);
check(/dict en-US-10-2\.bdic,ko-3-0\.bdic/.test(out), `프로필에 사전 둘 (${out.split("\n").find((l) => l.startsWith("dict")) || out})`);
process.exit(fail ? 1 : 0);
