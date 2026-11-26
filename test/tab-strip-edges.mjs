// node test/drive.mjs test/tab-strip-edges.mjs: when the tab strip holds more tabs than it shows (it scrolls with
// no bar), the edge with tabs past it fades (more-left / more-right), so they are seen to be there; with a few
// tabs, or with the tabs at the side, neither. A local server in Rove's main process gives the pages — no network.
// Each line prints ok or FAIL.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);
globalThis.EDGES = () => R.win.webContents.executeJavaScript("(() => { const s = document.getElementById('tabs'); return { left: s.classList.contains('more-left'), right: s.classList.contains('more-right'), sl: Math.round(s.scrollLeft), mask: getComputedStyle(s).maskImage !== 'none' }; })()");
globalThis.SRV = process.mainModule.require("node:http").createServer((q, s) => { s.writeHead(200, { "content-type": "text/html; charset=utf-8" }); s.end("<title>쪽 " + q.url.slice(1) + "</title>"); });
await new Promise((r) => SRV.listen(0, "127.0.0.1", r));
globalThis.URL_OF = (i) => "http://127.0.0.1:" + SRV.address().port + "/" + i;`;
export default [
  { js: H + `R.win.setContentSize(1280, 800); await sleep(600); const got = await EDGES();
    return CHECK("a few tabs: no edge fades", !got.left && !got.right && !got.mask, got);` },
  { js: `for (let i = 1; i <= 30; i++) R.newTab(URL_OF(i)); await sleep(2500); R.select(R.tabs[0]); await sleep(600); const got = await EDGES();
    return CHECK("at the start: the right edge fades", !got.left && got.right && got.mask, got);` },
  { js: `await R.win.webContents.executeJavaScript("(() => { const s = document.getElementById('tabs'); s.scrollLeft = (s.scrollWidth - s.clientWidth) / 2; })()"); await sleep(400); const got = await EDGES();
    return CHECK("scrolled to the middle: both edges fade", got.left && got.right && got.sl > 0, got);` },
  { js: `R.select(R.tabs[R.tabs.length - 1]); await sleep(600); const got = await EDGES();
    return CHECK("at the end: the left edge fades", got.left && !got.right, got);` },
  { js: `R.setVertical(true); await sleep(700); const got = await EDGES(); R.setVertical(false); await sleep(400);
    return CHECK("tabs at the side: no edge fades", !got.left && !got.right && !got.mask, got);` },
  { js: `SRV.closeAllConnections?.(); SRV.close(); return 1;` },
];
