// Builds out/RoveSetup.exe with the C# compiler of .NET Framework 4.x, which every
// Windows 10 and 11 has (C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe).
// Nothing to install. The window (setup.xaml) and its font (fonts/, from font.py) go
// inside the exe as resources.
//   node setup/build.cjs        -> out/RoveSetup.exe
"use strict";
const { execFileSync } = require("node:child_process");
const { mkdirSync, existsSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");

const here = __dirname;
const rove = join(here, "..");
const fw = join(process.env.SystemRoot || "C:\\Windows", "Microsoft.NET", "Framework64", "v4.0.30319");
const csc = join(fw, "csc.exe");
if (!existsSync(csc)) throw new Error(`no C# compiler at ${csc}`);
const out = join(rove, "out");
mkdirSync(out, { recursive: true });
const exe = join(out, "RoveSetup.exe");

const refs = [
  join(fw, "WPF", "PresentationFramework.dll"), join(fw, "WPF", "PresentationCore.dll"), join(fw, "WPF", "WindowsBase.dll"),
  "System.Xaml.dll", "System.Net.Http.dll", "System.IO.Compression.dll", "System.IO.Compression.FileSystem.dll",
  "System.Web.Extensions.dll", "Microsoft.CSharp.dll", "System.Core.dll", "System.Numerics.dll",
];
// the release keys the window trusts: the same list as the installed Rove's (config.cjs), kept in one place
const { updateKeys } = require(join(rove, "config.cjs"));
if (!Array.isArray(updateKeys) || !updateKeys.length || updateKeys.some((k) => !/^[A-Za-z0-9+/=]+$/.test(k))) throw new Error("config.cjs updateKeys");
const keys = join(out, "SetupKeys.cs");
writeFileSync(keys, `// made by setup/build.cjs from config.cjs updateKeys
static class ReleaseKeys { public static readonly string[] All = { ${updateKeys.map((k) => JSON.stringify(k)).join(", ")} }; }
`);
const res = ["setup.xaml", ...["450", "550", "650"].map((w) => `fonts/RoveSetup-${w}.ttf`)];
for (const r of res) if (!existsSync(join(here, r))) throw new Error(`missing ${r} (fonts: python setup/font.py)`);

execFileSync(csc, [
  "/nologo", "/target:winexe", "/optimize+", "/platform:anycpu", "/utf8output", "/codepage:65001",
  `/out:${exe}`, `/win32icon:${join(rove, "rove.ico")}`, `/win32manifest:${join(here, "setup.manifest")}`,
  ...refs.map((r) => `/reference:${r}`),
  ...res.map((r) => `/resource:${join(here, r)},${r.split("/").pop()}`),
  join(here, "Setup.cs"), join(here, "Ed25519.cs"), keys,
], { stdio: "inherit", cwd: fw });
console.log(exe);
