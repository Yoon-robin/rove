// node test/setup-sig.mjs: the setup window's Ed25519 check (setup/Ed25519.cs, built with the
// same .NET Framework csc as RoveSetup.exe) against Node's own Ed25519 — a good signature,
// a changed line, the wrong key, a list of keys, a stretched signature (S + L), broken base64,
// and the real latest.json of the newest release with config.cjs's keys (needs the network).
// Each line prints ok or FAIL.
import { execFileSync } from "node:child_process";
import { generateKeyPairSync, sign } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rove = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { updateKeys } = require(join(rove, "config.cjs"));
const { signed } = require(join(rove, "update.cjs"));
const fw = join(process.env.SystemRoot || "C:\\Windows", "Microsoft.NET", "Framework64", "v4.0.30319");

const pair = () => { const { publicKey, privateKey } = generateKeyPairSync("ed25519"); return { pub: publicKey.export({ type: "spki", format: "der" }).toString("base64"), privateKey }; };
const one = pair(), other = pair();
const line = { version: "9.9.9-test", build: 1795687232, file: "Rove-9.9.9-test-win-x64.zip", sha256: "a".repeat(64), size: 164994006 };
const sig = sign(null, Buffer.from(signed(line)), one.privateKey);
const L = (1n << 252n) + 27742317777372353535851937790883648493n;
const stretched = Buffer.from(sig); // the same R with S + L: a different encoding that must not pass
{ let s = 0n; for (let i = 63; i >= 32; i--) s = (s << 8n) | BigInt(stretched[i]); s += L; for (let i = 32; i < 64; i++) { stretched[i] = Number(s & 255n); s >>= 8n; } }

const cases = [
  ["right key", [one.pub], signed(line), sig.toString("base64"), true],
  ["a changed sha256", [one.pub], signed({ ...line, sha256: "b".repeat(64) }), sig.toString("base64"), false],
  ["the wrong key", [other.pub], signed(line), sig.toString("base64"), false],
  ["a list, the right key second", [other.pub, one.pub], signed(line), sig.toString("base64"), true],
  ["S + L", [one.pub], signed(line), stretched.toString("base64"), false],
  ["broken base64", [one.pub], signed(line), "not base64!", false],
  ["no signature", [one.pub], signed(line), "", false],
];
try {
  const r = await fetch("https://github.com/Yoon-robin/rove/releases/latest/download/latest.json", { signal: AbortSignal.timeout(20000) });
  const latest = await r.json();
  cases.push(["the newest release, config.cjs keys", updateKeys, signed(latest), latest.sig, true]);
  cases.push(["the newest release, its size changed", updateKeys, signed({ ...latest, size: latest.size + 1 }), latest.sig, false]);
} catch (e) { console.log("skip the newest release: " + e.message); }

const dir = mkdtempSync(join(tmpdir(), "rove-setup-sig-"));
try {
  const b = (s) => Buffer.from(s, "utf8").toString("base64");
  writeFileSync(join(dir, "cases.txt"), cases.map(([, keys, text, s]) => [keys.join(","), b(text), s].join("\t")).join("\n"));
  writeFileSync(join(dir, "Check.cs"), `using System; using System.IO; using System.Text;
static class Check { static void Main(string[] a) { foreach (var l in File.ReadAllLines(a[0])) { var p = l.Split('\\t');
  Console.WriteLine(Ed25519.SignedByAny(p[0].Split(','), Encoding.UTF8.GetString(Convert.FromBase64String(p[1])), p[2]) ? "true" : "false"); } } }`);
  execFileSync(join(fw, "csc.exe"), ["/nologo", "/optimize+", `/out:${join(dir, "check.exe")}`, "/reference:System.Numerics.dll", join(rove, "setup", "Ed25519.cs"), join(dir, "Check.cs")], { stdio: "inherit" });
  const got = execFileSync(join(dir, "check.exe"), [join(dir, "cases.txt")], { encoding: "utf8" }).trim().split(/\r?\n/);
  let bad = 0;
  cases.forEach(([name, , , , want], i) => { const ok = got[i] === String(want); if (!ok) bad++; console.log((ok ? "ok   " : "FAIL ") + name + ": " + got[i] + (ok ? "" : ` (want ${want})`)); });
  process.exitCode = bad ? 1 : 0;
} finally { rmSync(dir, { recursive: true, force: true }); }
