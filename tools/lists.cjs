// The ad and tracker lists Rove blocks with, made ahead (robin 2026-11-24
// "Rove 다음 버전"): Ghostery's prebuilt "ads and tracking" lists (EasyList,
// EasyPrivacy and theirs, through @ghostery/adblocker, MPL-2.0) turned into
// one engine and written out as rove/lists.bin. Rove reads that file and asks
// nothing of the web while it runs; scripts/release-rove.mjs makes it fresh
// for every release. Beside it, bounce.json: Brave's list of bounce trackers
// (brave/adblock-lists debounce.json, MPL-2.0), which blocker.cjs skips.
//   node tools/lists.cjs [out]
const { writeFileSync } = require("node:fs");
const { dirname, join } = require("node:path");
const { FiltersEngine } = require("@ghostery/adblocker");

(async () => {
  const out = process.argv[2] || join(__dirname, "..", "lists.bin");
  const engine = await FiltersEngine.fromPrebuiltAdsAndTracking(fetch);
  const bytes = engine.serialize();
  writeFileSync(out, bytes);
  console.log(`lists.bin ${(bytes.length / 1e6).toFixed(1)} MB`);
  const r = await fetch("https://raw.githubusercontent.com/brave/adblock-lists/master/brave-lists/debounce.json");
  if (!r.ok) throw new Error(`debounce.json: ${r.status}`);
  const rules = await r.json();
  if (!Array.isArray(rules) || !rules.length) throw new Error("debounce.json: 규칙이 없어요");
  writeFileSync(join(dirname(out), "bounce.json"), JSON.stringify(rules));
  console.log(`bounce.json ${rules.length}개`);
})().catch((e) => { console.error(e); process.exit(1); });
