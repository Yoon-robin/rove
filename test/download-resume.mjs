// node test/drive.mjs test/download-resume.mjs: a download the network keeps breaking stops (멈춤) once
// Chromium's own few tries are used up; as Chrome's and Brave's 재개, the downloads drawer then offers
// 이어 받기 with how much came down, and it goes on from there (a Range request), not from the start.
// A local server in Rove's main process sends the file (Range + ETag) — no network. Each line prints ok or FAIL.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.FS = process.mainModule.require("node:fs");
globalThis.REQS = [];
globalThis.BREAK = true;
globalThis.BODY = Buffer.from(Array.from({ length: 400000 }, (_, i) => i % 251));
globalThis.SRV = process.mainModule.require("node:http").createServer((q, s) => {
  const u = new URL(q.url, "http://x");
  if (u.pathname === "/") { s.writeHead(200, { "content-type": "text/html" }); return s.end("<title>p</title>"); }
  if (u.pathname !== "/f") { s.writeHead(404); return s.end(); }
  REQS.push(q.headers.range || "all");
  const h = { "content-type": "application/octet-stream", "content-disposition": "attachment; filename=resume.bin", "accept-ranges": "bytes", etag: '"v1"' };
  const m = /bytes=(\\d+)-/.exec(q.headers.range || ""), a = m ? +m[1] : 0;
  if (m) s.writeHead(206, { ...h, "content-range": "bytes " + a + "-" + (BODY.length - 1) + "/" + BODY.length, "content-length": BODY.length - a });
  else s.writeHead(200, { ...h, "content-length": BODY.length });
  if (!BREAK) return s.end(BODY.subarray(a));
  s.write(BODY.subarray(a, a + 20000)); setTimeout(() => s.socket.destroy(), 300); // the line goes
});
await new Promise((r) => SRV.listen(0, "127.0.0.1", r));
globalThis.BASE = "http://127.0.0.1:" + SRV.address().port;
{ const wc = R.active.view.webContents; if (wc.isLoading()) await new Promise((r) => wc.once("did-stop-loading", r)); await wc.loadURL(BASE + "/").catch(() => {}); }
globalThis.ALL = () => R.downloads.filter((d) => d.name.startsWith("resume"));
globalThis.ROW = () => R.overlay.webContents.executeJavaScript("(() => { const r = document.querySelector('.drawer .item[data-dl]'); return r ? { line: r.querySelector('small')?.textContent, buttons: [...r.querySelectorAll('button')].map((b) => b.getAttribute('aria-label')) } : null; })()");
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);`;
export default [
  { js: H + `R.active.view.webContents.downloadURL(BASE + "/f");
    for (let i = 0; i < 60 && ALL()[0]?.state !== "interrupted"; i++) await sleep(250);
    const d = ALL()[0];
    R.showOverlay({ kind: "drawer", panel: "downloads" }); await sleep(600); const row = await ROW();
    return CHECK("the line keeps going: 멈춤 with what came down, 이어 받기", d?.state === "interrupted" && /^멈춤 · .+ \\/ 391 KB$/.test(row?.line || "") && JSON.stringify(row?.buttons) === '["이어 받기"]', { state: d?.state, row });` },
  { js: `BREAK = false; const n = REQS.length;
    await R.overlay.webContents.executeJavaScript("document.querySelector('[data-retry]').click(), 1");
    for (let i = 0; i < 40 && ALL()[0]?.state !== "completed"; i++) await sleep(250);
    const rows = ALL(), d = rows[0], file = d && FS.existsSync(d.path) ? FS.readFileSync(d.path) : null;
    const got = { asked: REQS.slice(n), rows: rows.map((x) => x.state), size: file?.length, same: !!file && file.equals(BODY) };
    return CHECK("이어 받기: on from where it stopped (Range), the whole file, one row", got.asked.length === 1 && /^bytes=[1-9]\\d*-$/.test(got.asked[0]) && JSON.stringify(got.rows) === '["completed"]' && got.same, got);` },
  { js: `SRV.closeAllConnections?.(); SRV.close(); return 1;` },
];
