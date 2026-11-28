// node test/drive.mjs test/side-narrow-scroll.mjs: vertical tabs folded to icons with more tabs than fit —
// as Brave's collapsed list: no scroll bar eating the 52px column, so the icons stay in line with the
// + above and the fold button below; the cut ends fade instead, so more tabs are seen to be there.
// Unfolded, the list keeps its thin bar and no fade. Local server only. Each line prints ok or FAIL.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.SRV = process.mainModule.require("node:http").createServer((q, s) => { s.writeHead(200, { "content-type": "text/html" }); s.end("<title>page " + q.url.slice(1) + "</title>"); });
await new Promise((r) => SRV.listen(0, "127.0.0.1", r));
globalThis.U = (t) => "http://127.0.0.1:" + SRV.address().port + "/" + t;
globalThis.LIST = () => R.win.webContents.executeJavaScript("(() => { const l = document.getElementById('sidelist'); const mid = (el) => { const r = el.getBoundingClientRect(); return Math.round(r.left + r.width / 2); }; const tab = l.querySelector('.tab[aria-selected=true]') || l.querySelector('.tab'); return { bar: l.offsetWidth - l.clientWidth, plus: mid(document.querySelector('.sidenew')), tab: mid(tab), up: l.classList.contains('more-up'), down: l.classList.contains('more-down'), more: l.scrollHeight > l.clientHeight }; })()");
globalThis.SCROLL = (y) => R.win.webContents.executeJavaScript("(() => { const l = document.getElementById('sidelist'); l.scrollTop = " + y + "; return 1; })()");
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);`;
export default [
  { js: H + `R.win.setContentSize(1000, 600); R.active.view.webContents.loadURL(U("0")).catch(() => {});
    for (let i = 1; i <= 30; i++) R.newTab(U(i)); await sleep(2000); R.select(R.tabs[0]);
    R.setVertical(true); R.setNarrow(true); await sleep(800); const got = await LIST();
    return CHECK("folded, many tabs: no bar, the icons under the +, the bottom end faded", got.more && got.bar === 0 && got.tab === got.plus && !got.up && got.down, got);` },
  { js: `await SCROLL(99999); await sleep(300); const got = await LIST();
    return CHECK("scrolled to the end: the top end faded, the bottom not", got.up && !got.down, got);` },
  { js: `R.setNarrow(false); await sleep(400); R.select(R.tabs[15]); await sleep(400);
    await R.win.webContents.executeJavaScript("(() => { const l = document.getElementById('sidelist'), t = l.querySelector('.tab[aria-selected=true]'); l.scrollTop = t.offsetTop - l.offsetTop; return 1; })()");
    R.setNarrow(true); await sleep(800);
    const got = await R.win.webContents.executeJavaScript("(() => { const l = document.getElementById('sidelist').getBoundingClientRect(), t = document.querySelector('#sidelist .tab[aria-selected=true]').getBoundingClientRect(); return { top: Math.round(t.top - l.top), bottom: Math.round(l.bottom - t.bottom) }; })()");
    return CHECK("folded with the current tab at the top edge: it is brought out of the fade", got.top >= 32 && got.bottom >= 32, got);` },
  { js: `R.setNarrow(false); await sleep(600); const got = await LIST();
    R.setVertical(false); await sleep(300); SRV.close();
    return CHECK("unfolded: the thin bar back, no fade", got.bar > 0 && !got.up && !got.down, got);` },
];
