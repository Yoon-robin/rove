// node test/drive.mjs test/drawer-keys.mjs: the drawer's rows open by keyboard as by mouse — Tab reaches a
// downloaded file, a history line and a bookmark, and Enter opens it (Brave's downloads and history are links).
// A local server in Rove's main process sends the pages and the file — no network. shell.openPath is swapped
// out, so no app opens. Keys go to the hidden window (sendInputEvent), never to the screen. Prints ok or FAIL.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.SRV = process.mainModule.require("node:http").createServer((q, s) => {
  const n = new URL(q.url, "http://x").searchParams.get("n") || "x";
  if (n.startsWith("page")) { s.writeHead(200, { "content-type": "text/html; charset=utf-8" }); return s.end("<title>" + n + "</title>"); }
  s.writeHead(200, { "content-type": "application/octet-stream", "content-disposition": "attachment; filename=" + n }); s.end("hello");
});
await new Promise((r) => SRV.listen(0, "127.0.0.1", r));
globalThis.BASE = "http://127.0.0.1:" + SRV.address().port;
globalThis.OPENED = [];
const { shell } = process.mainModule.require("electron");
shell.openPath = async (p) => { OPENED.push(p); return ""; };
globalThis.OV = (js) => R.overlay.webContents.executeJavaScript(js);
// focus the row as Tab would (only if it takes focus), then press a real Enter on it
globalThis.ENTER_ON = async (sel) => {
  const can = await OV("(() => { const el = document.querySelector(" + JSON.stringify(sel) + "); if (!el || el.tabIndex < 0) return false; el.focus(); return document.activeElement === el; })()");
  for (const type of ["keyDown", "char", "keyUp"]) R.overlay.webContents.sendInputEvent({ type, keyCode: "Enter" });
  await sleep(800);
  return can;
};
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);
`;
export default [
  { js: H + `const wc = R.active.view.webContents;
    await wc.loadURL(BASE + "/?n=page-one").catch(() => {}); await sleep(300);
    wc.downloadURL(BASE + "/f?n=keys.zip"); await sleep(1200);
    for (const a of R.asks.filter((a) => a.kind === "download")) R.answer(a.id, true); await sleep(800);
    R.showOverlay({ kind: "drawer", panel: "downloads" }); await sleep(700);
    const can = await ENTER_ON(".drawer .item[data-dl]");
    const shown = await OV("getComputedStyle(document.querySelector('.drawer .item[data-dl] [data-show]')).opacity");
    return [CHECK("Tab reaches a downloaded file", can === true, can), CHECK("Enter opens it", OPENED.length === 1 && /keys\\.zip$/.test(OPENED[0]), OPENED),
      CHECK("its 폴더에서 보기 shows while the row has focus", shown === "1", shown)].join("\\n");` },
  { js: `R.hideOverlay(); await R.active.view.webContents.loadURL(BASE + "/?n=page-two").catch(() => {}); await sleep(1200);
    R.showOverlay({ kind: "drawer", panel: "history" }); await sleep(900);
    const can = await ENTER_ON(".drawer .item[data-url*='page-one']");
    const at = R.active.view.webContents.getURL();
    return [CHECK("Tab reaches a history line", can === true, can), CHECK("Enter goes there", /page-one/.test(at), at)].join("\\n");` },
  { js: `R.hideOverlay(); R.bookmarks.splice(0, R.bookmarks.length, { url: BASE + "/?n=page-mark", title: "page-mark", at: Date.now() }); await sleep(200);
    R.showOverlay({ kind: "drawer", panel: "bookmarks" }); await sleep(900);
    const can = await ENTER_ON(".drawer .item[data-url*='page-mark']");
    const at = R.active.view.webContents.getURL();
    return [CHECK("Tab reaches a bookmark", can === true, can), CHECK("Enter goes there", /page-mark/.test(at), at)].join("\\n");` },
  { js: `SRV.closeAllConnections?.(); SRV.close(); return 1;` },
];
