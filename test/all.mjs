// node test/all.mjs [name ...] [--clipboard] [--offline]: every test in test/, one after another
// (each starts its own hidden Rove), then what failed. A test whose first line says
// "node test/drive.mjs" runs through the driver; the others (update, setup-sig) run on their own; *.steps.mjs are steps another test runs.
// Left out unless asked: tests that write the PC's own clipboard (--clipboard: only with nobody
// at the PC), and with --offline those whose first lines say they use the network.
// Not here: setup-*.ps1 (they install and remove Rove for real). Exit code 1 if anything failed.
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const named = args.filter((a) => !a.startsWith("--")).map((a) => a.replace(/\.mjs$/, ""));
const withClipboard = args.includes("--clipboard"), offline = args.includes("--offline");

// lists.bin is made, not kept in git: without it blocking, GPC and the tracking tails are all off
// and privacy.mjs and the like fail line after line for that one reason
if (!existsSync(join(here, "..", "lists.bin"))) console.log("주의: lists.bin이 없어요 — 먼저 node tools/lists.cjs (막기 목록을 받아 만들어요). 없으면 privacy 등이 줄줄이 넘어져요.\n");
const tests = readdirSync(here).filter((f) => f.endsWith(".mjs") && f !== "drive.mjs" && f !== "all.mjs" && !f.endsWith(".steps.mjs"))
  .filter((f) => !named.length || named.includes(f.replace(/\.mjs$/, "")));
const failed = [], skipped = [];
let oks = 0;
for (const f of tests) {
  const src = readFileSync(join(here, f), "utf8"), head = src.split("\n").filter((l) => l.startsWith("//")).slice(0, 10).join(" ");
  if (!withClipboard && /clipboard\.write|CLIP\.write|passCopy/.test(src)) { skipped.push(`${f} (클립보드)`); continue; }
  if (offline && /network|example\.com/i.test(head) && !/no network/i.test(head)) { skipped.push(`${f} (네트워크)`); continue; }
  const viaDriver = /^\/\/ node test\/drive\.mjs/.test(src);
  const t0 = Date.now();
  const r = spawnSync(process.execPath, viaDriver ? [join(here, "drive.mjs"), join(here, f)] : [join(here, f)], { encoding: "utf8", timeout: 300e3 });
  const out = (r.stdout || "") + (r.stderr || ""), lines = out.split(/\r?\n/);
  const ok = lines.filter((l) => l.startsWith("ok")).length, bad = lines.filter((l) => /^(FAIL|ERR)/.test(l));
  if (r.error || (!ok && !bad.length)) bad.push(`ERR 돌지 않음: ${r.error?.message || out.trim().split("\n").pop() || "출력 없음"}`);
  oks += ok;
  console.log(`${bad.length ? "FAIL" : "ok  "} ${f}: ${ok} ok${bad.length ? `, ${bad.length} 실패` : ""} (${Math.round((Date.now() - t0) / 1000)}초)`);
  for (const l of bad) console.log("     " + l.slice(0, 300));
  if (bad.length) failed.push(f);
}
console.log(`\n${tests.length - skipped.length}개 돌림, 확인 ${oks}개 ok, 실패 ${failed.length}개${failed.length ? ": " + failed.join(" ") : ""}`);
if (skipped.length) console.log(`뺀 것: ${skipped.join(", ")}`);
process.exitCode = failed.length ? 1 : 0;
