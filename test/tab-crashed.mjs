// node test/drive.mjs test/tab-crashed.mjs: a tab whose page stopped (its renderer gone) shows it on the strip
// (the alarm mark, "멈춤" in its title), so it is seen before it is chosen; chosen, the stopped page's words start
// at the same left edge as the page Rove could not open; brought back, the tab's own mark returns.
// A local server in Rove's main process gives the pages — no network. Each line prints ok or FAIL.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);
globalThis.SRV = process.mainModule.require("node:http").createServer((q, s) => { s.writeHead(200, { "content-type": "text/html; charset=utf-8" }); s.end("<title>쪽 " + q.url.slice(1) + "</title>"); });
await new Promise((r) => SRV.listen(0, "127.0.0.1", r));
globalThis.TAB = (i) => R.win.webContents.executeJavaScript("(() => { const t = document.querySelectorAll('#tabs .tab')[" + i + "]; return { crashed: t.classList.contains('crashed'), mark: t.querySelector('.ic').dataset.k, tip: t.title }; })()");`;
export default [
  { js: H + `R.win.setContentSize(1280, 800); const port = SRV.address().port;
    await R.active.view.webContents.loadURL("http://127.0.0.1:" + port + "/a").catch(() => {}); await sleep(600);
    globalThis.A = R.active; R.newTab("http://127.0.0.1:" + port + "/b"); await sleep(1200);
    A.view.webContents.forcefullyCrashRenderer(); await sleep(1500); const got = await TAB(0);
    return CHECK("stopped tab behind: the alarm mark and 멈춤 on its strip", got.crashed && got.mark === "alarm" && /멈춤/.test(got.tip), got);` },
  { js: `R.select(A); await sleep(700); const got = await R.win.webContents.executeJavaScript("(() => { const g = document.getElementById('gone'); const b = g.querySelector('b'); return { shown: !g.hidden, x: Math.round(b.getBoundingClientRect().x), size: getComputedStyle(b).fontSize, btnX: Math.round(g.querySelector('button').getBoundingClientRect().x) }; })()");
    return CHECK("chosen: the stopped page's words from one left edge (420 at 1280, as the error page), 18px", got.shown && got.x === 420 && got.btnX === 420 && got.size === "18px", got);` },
  { js: `R.win.webContents.executeJavaScript("document.getElementById('revive').click()"); await sleep(1500); const got = await TAB(0);
    return CHECK("brought back: its own mark again", !got.crashed && got.mark !== "alarm" && !/멈춤/.test(got.tip), got);` },
  { js: `SRV.closeAllConnections?.(); SRV.close(); return 1;` },
];
