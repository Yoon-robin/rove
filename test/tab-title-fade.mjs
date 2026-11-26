// node test/drive.mjs test/tab-title-fade.mjs: a tab title too long for its tab fades out at its end
// (as Chrome's do) instead of ending in "…"; a short one is untouched. A local server in Rove's main process gives the titles — no network. Each line prints ok or FAIL.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);
globalThis.TITLES = () => R.win.webContents.executeJavaScript("[...document.querySelectorAll('#tabs .tab .t')].map((t) => { const s = getComputedStyle(t), r = document.createRange(); r.selectNodeContents(t); return { text: t.textContent, overflow: s.textOverflow, mask: s.maskImage || s.webkitMaskImage, w: t.clientWidth, sw: t.scrollWidth, end: Math.round(r.getBoundingClientRect().right - t.getBoundingClientRect().right) }; })");
globalThis.SRV = process.mainModule.require("node:http").createServer((q, s) => { s.writeHead(200, { "content-type": "text/html" }); s.end("<title>" + decodeURIComponent(q.url.slice(1)) + "</title>"); });
await new Promise((r) => SRV.listen(0, "127.0.0.1", r)); globalThis.BASE = "http://127.0.0.1:" + SRV.address().port + "/";`;
export default [
  { js: H + `R.win.setContentSize(800, 600);
    await R.active.view.webContents.loadURL(BASE + encodeURIComponent("Long title ".repeat(12))).catch(() => {});
    R.newTab(BASE + "Hi"); await sleep(1200); return (await TITLES()).map((t) => t.text.slice(0, 12));` },
  { js: `const [long, short] = await TITLES();
    return CHECK("long title: clipped (no …) under a fade to transparent", long.sw > long.w && long.overflow === "clip" && /linear-gradient/.test(long.mask) && /transparent|rgba\\(0, 0, 0, 0\\)/.test(long.mask), long);` },
  { js: `const [, short] = await TITLES();
    return CHECK("short title: ends well before the 18px fade", short.sw <= short.w && short.end < -18, short);` },
  { js: `SRV.closeAllConnections?.(); SRV.close(); return 1;` },
];
