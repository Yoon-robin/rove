// node test/drive.mjs test/drawer-download-kinds.mjs: a downloads-drawer row is marked by what the file is
// (picture, video, sound, document, program; anything else the download arrow), as Chrome shows the file's kind.
// A local server in Rove's main process sends the files — no network. Each line prints ok or FAIL.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.SRV = process.mainModule.require("node:http").createServer((q, s) => {
  const n = new URL(q.url, "http://x").searchParams.get("n") || "x";
  if (n === "page") { s.writeHead(200, { "content-type": "text/html; charset=utf-8" }); return s.end("<title>p</title>"); }
  s.writeHead(200, { "content-type": "application/octet-stream", "content-disposition": "attachment; filename=" + n }); s.end("hello");
});
await new Promise((r) => SRV.listen(0, "127.0.0.1", r));
globalThis.BASE = "http://127.0.0.1:" + SRV.address().port;
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);`;
const want = { "a.JPG": "image", "b.webm": "film", "c.flac": "music", "d.pdf": "read", "e.hwp": "read", "f.msi": "window", "g.zip": "download" };
export default [
  { js: H + `await R.active.view.webContents.loadURL(BASE + "/?n=page").catch(() => {});
    for (const n of ${JSON.stringify(Object.keys(want))}) { R.active.view.webContents.downloadURL(BASE + "/f?n=" + n); await sleep(500); }
    await sleep(1000); for (const a of R.asks.filter((a) => a.kind === "download")) R.answer(a.id, true); await sleep(1000);
    R.showOverlay({ kind: "drawer", panel: "downloads" }); await sleep(700);
    const got = await R.overlay.webContents.executeJavaScript("Object.fromEntries([...document.querySelectorAll('.drawer .item[data-dl]')].map((e) => [e.querySelector('b').textContent, e.querySelector(':scope > svg use')?.getAttribute('href').replace('icons.svg#rk-i-', '')]))");
    return CHECK("each file's mark by its kind", ${JSON.stringify(Object.entries(want))}.every(([n, k]) => got[n] === k), got);` },
  { js: `SRV.closeAllConnections?.(); SRV.close(); return 1;` },
];
