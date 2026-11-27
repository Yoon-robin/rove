// The spell checker's dictionaries (English, Korean), fetched ahead: left to
// itself Chromium fetches them from Google's servers (redirector.gvt1.com) the
// first time Rove starts, before anyone has typed a word — Brave sends that
// through its own server instead. Rove brings them in the release (dictionaries/),
// and main.cjs puts them where Chromium looks, so nothing is asked of Google.
// The names are Chromium's (spellcheck_common.cc) for Electron 45; if a new
// Electron wants others, test/spell-offline.mjs sees Chromium fetch again.
//   node tools/dictionaries.cjs [out folder]
const { mkdirSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");

const NAMES = ["en-US-10-2.bdic", "ko-3-0.bdic"];
(async () => {
  const out = process.argv[2] || join(__dirname, "..", "dictionaries");
  mkdirSync(out, { recursive: true });
  for (const name of NAMES) {
    const r = await fetch("https://redirector.gvt1.com/edgedl/chrome/dict/" + name.toLowerCase());
    if (!r.ok) throw new Error(`${name}: ${r.status}`);
    const b = Buffer.from(await r.arrayBuffer());
    if (b.subarray(0, 4).toString("latin1") !== "BDic") throw new Error(`${name}: 사전 파일이 아니에요`);
    writeFileSync(join(out, name), b);
    console.log(`${name} ${(b.length / 1e6).toFixed(1)} MB`);
  }
})().catch((e) => { console.error(e); process.exit(1); });
