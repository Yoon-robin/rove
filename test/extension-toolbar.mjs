// node test/drive.mjs test/extension-toolbar.mjs: many extensions' buttons do not squeeze the address
// box away (Chrome keeps the omnibox and moves the rest to its extensions menu): past 40% of the
// toolbar they scroll sideways with the cut edge faded, a wheel over them scrolls them, the last
// one can still be reached; and the drawer shows a long extension name whole on hover (title).
// Fourteen small extensions with a button, put in this run's Extensions folder: no network.
// Each line prints ok or FAIL.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { session } = process.mainModule.require("electron");
const fs = process.mainModule.require("node:fs"), path = process.mainModule.require("node:path"), crypto = process.mainModule.require("node:crypto");
const X = process.mainModule.require("./extensions.cjs");
const SES = session.fromPartition("persist:rove");
const DIR = path.join(process.env.ROVE_HOME, "Extensions");
// a 1x1 png
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==", "base64");
globalThis.LONG = "Long name — 아주 긴 이름의 확장 프로그램이 서랍 줄에 다 들어가지 않을 때";
for (let i = 0; i < 14; i++) {
  const der = crypto.generateKeyPairSync("rsa", { modulusLength: 1024 }).publicKey.export({ type: "spki", format: "der" });
  const id = [...crypto.createHash("sha256").update(der).digest("hex").slice(0, 32)].map((c) => String.fromCharCode(97 + parseInt(c, 16))).join("");
  const v = path.join(DIR, id, "1.0_0");
  fs.mkdirSync(v, { recursive: true });
  fs.writeFileSync(path.join(v, "manifest.json"), JSON.stringify({ manifest_version: 3, name: i ? "Ext " + i : LONG, version: "1.0", key: der.toString("base64"), icons: { 16: "i.png" }, action: { default_icon: { 16: "i.png" } } }));
  fs.writeFileSync(path.join(v, "i.png"), PNG);
}
await X.loadInstalled(SES, DIR, {});
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);
globalThis.BAR = (js) => R.win.webContents.executeJavaScript(js);
globalThis.MEASURE = () => BAR("(() => { const a = document.getElementById('actions'), t = document.querySelector('.tools'), u = document.querySelector('.address'); return { address: Math.round(u.getBoundingClientRect().width), actions: Math.round(a.getBoundingClientRect().width), tools: Math.round(t.getBoundingClientRect().width), buttons: a.shadowRoot ? a.shadowRoot.querySelectorAll('.action').length : 0, scroll: a.scrollWidth > a.clientWidth, cls: a.className, toolsFit: t.scrollWidth <= t.clientWidth }; })()");
R.win.setSize(800, 600);
await sleep(1200);`;
export default [
  { js: H + `const got = await MEASURE();
    return CHECK("800 wide, 14 buttons: the address keeps room, the buttons take at most 40% and scroll, the right edge fades", got.buttons === 14 && got.address >= 240 && got.actions <= got.tools * 0.4 + 1 && got.scroll && / more-right/.test(" " + got.cls) && !/more-left/.test(got.cls) && got.toolsFit, got);` },
  { js: `await R.win.webContents.sendInputEvent({ type: "mouseWheel", x: 600, y: 22, deltaX: 0, deltaY: -2000, canScroll: true }); await sleep(400);
    const a = await BAR("(() => { const a = document.getElementById('actions'); const r = a.getBoundingClientRect(); return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }; })()");
    await R.win.webContents.sendInputEvent({ type: "mouseWheel", x: a.x, y: a.y, deltaX: 0, deltaY: -2000, canScroll: true }); await sleep(400);
    const got = await BAR("(() => { const a = document.getElementById('actions'), last = [...a.shadowRoot.querySelectorAll('.action')].pop(); return { left: a.scrollLeft, cls: a.className, lastIn: last.getBoundingClientRect().right <= a.getBoundingClientRect().right + 1 }; })()");
    return CHECK("a wheel over the buttons scrolls them to the end: the last one is in sight, the left edge fades now", got.left > 0 && got.lastIn && /more-left/.test(got.cls) && !/more-right/.test(got.cls), got);` },
  { js: `R.win.setSize(1600, 600); await sleep(800); const got = await MEASURE();
    return CHECK("1600 wide: all 14 in sight, no fade", got.buttons === 14 && !got.scroll && !/more-/.test(got.cls), got);` },
  { js: `R.win.setSize(480, 400); await sleep(800); const got = await MEASURE();
    return CHECK("the smallest window (480): the address keeps 160, the menu button is not pushed out", got.address >= 160 && got.toolsFit, got);` },
  { js: `R.win.setSize(1000, 700); await sleep(500); R.showOverlay({ kind: "drawer", panel: "extensions" }); await sleep(900);
    const got = await R.overlay.webContents.executeJavaScript("(() => { const b = [...document.querySelectorAll('.list .item b')].find((e) => e.textContent.startsWith('Long name')); return b ? { title: b.title, cut: b.scrollWidth > b.clientWidth } : null; })()");
    R.hideOverlay();
    return CHECK("the drawer: a long name cut with … has the whole name on hover", got && got.cut && got.title === LONG, got);` },
];
