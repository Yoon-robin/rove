// node test/setup-sig.mjs: the setup window's Ed25519 check (setup/Ed25519.cs, built with the
// same .NET Framework csc as RoveSetup.exe) against Node's own Ed25519 — a good signature,
// a changed line, the wrong key, a list of keys, a stretched signature (S + L), broken base64,
// and the real latest.json of the newest release with config.cjs's keys (needs the network).
// install.cmd carries the same C# and keys (checked here), and its own check lines are run in
// PowerShell against the same latest.json. Each line prints ok or FAIL.
import { execFileSync, spawnSync } from "node:child_process";
import { generateKeyPairSync, sign } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
let latest = null;
try {
  const r = await fetch("https://github.com/Yoon-robin/rove/releases/latest/download/latest.json", { signal: AbortSignal.timeout(20000) });
  latest = await r.json();
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
  // install.cmd: the C# after #CSSTART is Ed25519.cs, its keys are config.cjs's, and its own lines decide
  const say = (name, ok, got) => { if (!ok) bad++; console.log((ok ? "ok   " : "FAIL ") + name + (ok ? "" : ": " + got)); };
  const lf = (t) => t.replace(/\r\n/g, "\n");
  const installCmd = join(rove, "install.cmd");
  const cmd = lf(readFileSync(installCmd, "utf8"));
  const cs = cmd.slice(cmd.indexOf("\n", cmd.indexOf("#CSSTART")) + 1);
  say("install.cmd: the same C# as Ed25519.cs", cs === lf(readFileSync(join(rove, "setup", "Ed25519.cs"), "utf8")), cs.length);
  const lines = cmd.split("\n");
  const from = lines.findIndex((l) => l.startsWith("$keys = @(")), to = lines.findIndex((l) => l.startsWith("if (-not [Ed25519]"));
  const theirs = [...(lines[from] || "").matchAll(/'([A-Za-z0-9+/=]+)'/g)].map((m) => m[1]);
  say("install.cmd: the keys of config.cjs", JSON.stringify(theirs) === JSON.stringify(updateKeys), JSON.stringify(theirs));
  const run = (name, json, want) => {
    const file = join(dir, "latest.json");
    writeFileSync(file, JSON.stringify(json));
    const ps = ["$ErrorActionPreference = 'Stop'", `$t = [IO.File]::ReadAllText('${installCmd}', [Text.Encoding]::UTF8)`, `$latest = Get-Content -Raw -Encoding UTF8 '${file}' | ConvertFrom-Json`,
      ...lines.slice(from, to + 1), "Write-Host signed"];
    writeFileSync(join(dir, "check.ps1"), "﻿" + ps.join("\r\n"));
    const out = spawnSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", join(dir, "check.ps1")], { encoding: "utf8" });
    const got = out.status === 0 && /signed/.test(out.stdout) ? "signed" : "refused";
    say("install.cmd: " + name + " " + got, got === want, (out.stdout + out.stderr).trim().slice(0, 300));
  };
  if (latest && from >= 0 && to > from) {
    run("the newest release", latest, "signed");
    run("its size changed", { ...latest, size: latest.size + 1 }, "refused");
    run("no signature", { ...latest, sig: undefined }, "refused");
  } else say("install.cmd: its check lines", from >= 0 && to > from, `${from}..${to}`);
  process.exitCode = bad ? 1 : 0;
} finally { rmSync(dir, { recursive: true, force: true }); }
