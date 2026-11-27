// node test/drive.mjs test/drawer-download-retry.mjs: in the downloads drawer, as in Brave and Chrome,
// a file deleted outside Rove since it came down shows 삭제됨 (no 폴더에서 보기, opening it does
// nothing) and a cancelled or deleted one has 다시 받기, which fetches the same address again as a
// new row in place of the old. A local server in Rove's main process sends the files — no network.
// Each line prints ok or FAIL.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.FS = process.mainModule.require("node:fs");
globalThis.SRV = process.mainModule.require("node:http").createServer((q, s) => {
  const u = new URL(q.url, "http://x"), n = u.searchParams.get("n") || "x";
  if (n === "page") { s.writeHead(200, { "content-type": "text/html" }); return s.end("<title>p</title>"); }
  s.writeHead(200, { "content-type": "application/octet-stream", "content-disposition": "attachment; filename=" + n });
  if (!u.searchParams.has("slow")) return s.end("hello " + n);
  s.write("first half "); setTimeout(() => s.end("second half"), 2500);
});
await new Promise((r) => SRV.listen(0, "127.0.0.1", r));
globalThis.BASE = "http://127.0.0.1:" + SRV.address().port;
{ const wc = R.active.view.webContents; if (wc.isLoading()) await new Promise((r) => wc.once("did-stop-loading", r)); await wc.loadURL(BASE + "/?n=page").catch(() => {}); }
globalThis.GET = (n, more = "") => R.active.view.webContents.downloadURL(BASE + "/f?n=" + n + more);
globalThis.ALL = (n) => R.downloads.filter((d) => d.name === n);
globalThis.DRAWER = async () => { R.showOverlay({ kind: "drawer", panel: "downloads" }); await sleep(600); };
globalThis.ROW = (n) => R.overlay.webContents.executeJavaScript("(() => { const r = [...document.querySelectorAll('.drawer .item[data-dl]')].find((e) => e.querySelector('b')?.textContent === " + JSON.stringify(n) + "); return r ? { line: r.querySelector('small')?.textContent, buttons: [...r.querySelectorAll('button')].map((b) => b.getAttribute('aria-label') || b.textContent) } : null; })()");
globalThis.PRESS = (n, sel) => R.overlay.webContents.executeJavaScript("(() => { const r = [...document.querySelectorAll('.drawer .item[data-dl]')].find((e) => e.querySelector('b')?.textContent === " + JSON.stringify(n) + "); (" + JSON.stringify(sel) + " ? r.querySelector(" + JSON.stringify(sel) + ") : r).click(); return 1; })()");
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);`;
export default [
  { js: H + `GET("gone.txt"); await sleep(1200); const d = ALL("gone.txt")[0]; FS.unlinkSync(d.path);
    await DRAWER(); const row = await ROW("gone.txt");
    return CHECK("deleted outside Rove: 삭제됨, no 폴더에서 보기, 다시 받기", row?.line === "삭제됨" && JSON.stringify(row.buttons) === '["다시 받기"]', row);` },
  { js: `await PRESS("gone.txt", null); await sleep(400); const still = ALL("gone.txt").length;
    await PRESS("gone.txt", "[data-retry]"); await sleep(1500); const rows = ALL("gone.txt"), d = rows[0];
    const got = { before: still, rows: rows.length, state: d?.state, body: d && FS.existsSync(d.path) ? FS.readFileSync(d.path, "utf8") : null };
    return CHECK("다시 받기: the same file again, one row", got.before === 1 && got.rows === 1 && got.state === "completed" && got.body === "hello gone.txt", got);` },
  { js: `GET("stop.bin", "&slow"); await sleep(500); ALL("stop.bin")[0].item.cancel(); await sleep(500);
    await DRAWER(); const row = await ROW("stop.bin");
    await PRESS("stop.bin", "[data-retry]"); await sleep(4000); const rows = ALL("stop.bin");
    const got = { row, rows: rows.map((d) => d.state), body: rows[0] && FS.existsSync(rows[0].path) ? FS.readFileSync(rows[0].path, "utf8") : null };
    return CHECK("cancelled: 취소함 with 다시 받기, then all of it", row?.line === "취소함" && JSON.stringify(row.buttons) === '["다시 받기"]' && JSON.stringify(got.rows) === '["completed"]' && got.body === "first half second half", got);` },
  { js: `await DRAWER(); const row = await ROW("stop.bin");
    return CHECK("a finished one still there: 폴더에서 보기, no 다시 받기", JSON.stringify(row?.buttons) === '["폴더에서 보기"]', row);` },
  { js: `SRV.closeAllConnections?.(); SRV.close(); return 1;` },
];
