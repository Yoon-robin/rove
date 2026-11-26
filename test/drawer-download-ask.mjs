// node test/drive.mjs test/drawer-download-ask.mjs: a file that waits for a yes (a program) can be
// answered from the downloads drawer too — the drawer covers the ask bar's own 버리기·받기.
// A local server in Rove's main process sends the files — no network. Each line prints ok or FAIL.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.SRV = process.mainModule.require("node:http").createServer((q, s) => {
  const n = new URL(q.url, "http://x").searchParams.get("n") || "x";
  if (n === "page") { s.writeHead(200, { "content-type": "text/html" }); return s.end("<title>p</title>"); }
  s.writeHead(200, { "content-type": "application/octet-stream", "content-disposition": "attachment; filename=" + n }); s.end("MZ hello");
});
await new Promise((r) => SRV.listen(0, "127.0.0.1", r));
globalThis.BASE = "http://127.0.0.1:" + SRV.address().port;
globalThis.D = (n) => R.downloads.find((d) => d.name === n || (d.held && d.held.endsWith("-" + n)));
globalThis.ROW = (n) => R.overlay.webContents.executeJavaScript("(() => { const r = [...document.querySelectorAll('.drawer .item[data-dl]')].find((e) => e.querySelector('b')?.textContent === " + JSON.stringify(n) + "); return r ? [...r.querySelectorAll('[data-keep]')].map((b) => b.textContent + ':' + b.dataset.yes) : null; })()");
globalThis.PRESS = (n, yes) => R.overlay.webContents.executeJavaScript("(() => { const r = [...document.querySelectorAll('.drawer .item[data-dl]')].find((e) => e.querySelector('b')?.textContent === " + JSON.stringify(n) + "); r.querySelector('[data-keep][data-yes=\\"" + (yes ? 1 : 0) + "\\"]').click(); return 1; })()");
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);`;
export default [
  { js: H + `await R.active.view.webContents.loadURL(BASE + "/?n=page").catch(() => {});
    R.active.view.webContents.downloadURL(BASE + "/f?n=keep.exe"); await sleep(1200); R.active.view.webContents.downloadURL(BASE + "/f?n=drop.exe"); await sleep(1200);
    R.showOverlay({ kind: "drawer", panel: "downloads" }); await sleep(700);
    const a = await ROW("keep.exe"), b = await ROW("drop.exe");
    return CHECK("waiting rows: 버리기·받기 in the drawer", JSON.stringify(a) === '["버리기:0","받기:1"]' && JSON.stringify(b) === '["버리기:0","받기:1"]', { a, b });` },
  { js: `await PRESS("keep.exe", true); await sleep(1200); const d = D("keep.exe");
    return CHECK("받기 from the drawer: kept, the other still waits", d?.state === "completed" && !d.asking && !!D("drop.exe")?.asking, { keep: d && { state: d.state, asking: d.asking }, drop: D("drop.exe")?.asking });` },
  { js: `R.showOverlay({ kind: "drawer", panel: "downloads" }); await sleep(500); await PRESS("drop.exe", false); await sleep(1000); const d = D("drop.exe");
    return CHECK("버리기 from the drawer: not kept, no ask left", (!d || d.state === "cancelled") && !R.asks.some((a) => a.kind === "download"), { state: d?.state, asks: R.asks.length });` },
  { js: `SRV.closeAllConnections?.(); SRV.close(); return 1;` },
];
