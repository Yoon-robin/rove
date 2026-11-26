// node test/drive.mjs test/save-page.mjs: Ctrl+S saves the page, as in Chrome — the whole page with its files
// (.html and a _files folder), one .mhtml file, or a PDF without the print window. A local server in Rove's
// main process — no network. The save dialog itself is not opened (savePageTo is what it calls). Each line prints ok or FAIL.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);
const fs = process.mainModule.require("node:fs"), path = process.mainModule.require("node:path"), os = process.mainModule.require("node:os");
globalThis.FS = fs; globalThis.DIR = fs.mkdtempSync(path.join(os.tmpdir(), "rove-save-"));
globalThis.SRV = process.mainModule.require("node:http").createServer((q, s) => {
  if (q.url === "/dot.css") { s.writeHead(200, { "content-type": "text/css" }); return s.end("b { color: red }"); }
  s.writeHead(200, { "content-type": "text/html; charset=utf-8" }); s.end('<title>저장할 쪽</title><link rel="stylesheet" href="/dot.css"><b>안녕</b>');
});
await new Promise((r) => SRV.listen(0, "127.0.0.1", r));`;
export default [
  { js: H + `R.newTab("http://127.0.0.1:" + SRV.address().port + "/"); await sleep(1200);
    const key = !!R.keyAction({ type: "keyDown", key: "s", control: true, shift: false, alt: false, meta: false });
    return CHECK("Ctrl+S is a shortcut", key, key);` },
  { js: `const f = DIR + "/a.html", ok = await R.savePageTo(R.active, f);
    const html = FS.existsSync(f) && FS.readFileSync(f, "utf8"), files = FS.existsSync(DIR + "/a_files") ? FS.readdirSync(DIR + "/a_files") : [];
    return CHECK("the whole page: .html and its files beside it", ok && /안녕/.test(html) && files.some((n) => /dot/.test(n)), { ok, files });` },
  { js: `const f = DIR + "/b.mhtml", ok = await R.savePageTo(R.active, f), s = FS.existsSync(f) ? FS.readFileSync(f, "utf8") : "";
    return CHECK("one file: .mhtml with the stylesheet inside", ok && /MIME-Version/i.test(s) && /color: red/.test(s), { ok, size: s.length });` },
  { js: `const f = DIR + "/c.pdf", ok = await R.savePageTo(R.active, f), head = FS.existsSync(f) ? FS.readFileSync(f).subarray(0, 5).toString() : "";
    return CHECK("a PDF straight away", ok && head === "%PDF-", { ok, head });` },
  { js: `const ok = await R.savePageTo(R.active, DIR + "/no/such/dir/d.pdf");
    SRV.closeAllConnections?.(); SRV.close(); FS.rmSync(DIR, { recursive: true, force: true });
    return CHECK("a place it cannot write: says it failed", ok === false, ok);` },
];
