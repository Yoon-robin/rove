// node test/drive.mjs test/downloads.mjs: a file comes down into Downloads with Windows' mark from
// the internet (Zone.Identifier: ZoneId=3, the page and the file's address); two of the same name
// at once get "name (1)"; a file that runs when opened (a program, a script, one of the shell's own
// — .settingcontent-ms, .search-ms… — or a disk image) waits in Rove's folder until the ask bar's
// yes, and a no leaves nothing; a private window's download is not kept in downloads.json.
// A local server in Rove's main process sends the files — no network. Each line prints ok or FAIL.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.FS = process.mainModule.require("node:fs");
globalThis.PATH = process.mainModule.require("node:path");
globalThis.SRV = process.mainModule.require("node:http").createServer((q, s) => {
  const u = new URL(q.url, "http://x"), n = u.searchParams.get("n") || "x", slow = u.searchParams.has("slow");
  if (u.pathname === "/page") { s.writeHead(200, { "content-type": "text/html" }); return s.end("<title>p</title>"); }
  s.writeHead(200, { "content-type": "application/octet-stream", "content-disposition": "attachment; filename*=UTF-8''" + encodeURIComponent(n) });
  if (!slow) return s.end("hello " + n);
  s.write("first half "); setTimeout(() => s.end("second half"), 1500);
});
await new Promise((r) => SRV.listen(0, "127.0.0.1", r));
globalThis.BASE = "http://127.0.0.1:" + SRV.address().port;
await R.active.view.webContents.loadURL(BASE + "/page").catch(() => {});
globalThis.GET = (n, more = "", tab = R.active) => tab.view.webContents.downloadURL(BASE + "/f?n=" + encodeURIComponent(n) + more);
globalThis.D = (n) => R.downloads.find((d) => d.name === n || (d.held && d.held.endsWith("-" + n)));
globalThis.ASK = (d) => R.asks.find((a) => a.kind === "download" && a.d === d);
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);`;
export default [
  { js: H + `GET("plain.txt"); await sleep(1200); const d = D("plain.txt");
    let mark = ""; try { mark = FS.readFileSync(d.path + ":Zone.Identifier", "utf8"); } catch {}
    const got = { state: d?.state, dir: PATH.basename(PATH.dirname(d?.path || "")), body: d && FS.existsSync(d.path) ? FS.readFileSync(d.path, "utf8") : null, mark };
    return CHECK("a file: in Downloads, marked from the internet", got.state === "completed" && got.dir === "downloads" && got.body === "hello plain.txt" &&
      /ZoneId=3/.test(mark) && mark.includes("HostUrl=" + BASE + "/f?n=plain.txt") && mark.includes("ReferrerUrl=" + BASE + "/page"), got);` },
  { js: `GET("same.bin", "&slow"); await sleep(300); GET("same.bin", "&slow"); await sleep(2800);
    const two = R.downloads.filter((d) => /^same( \\(1\\))?\\.bin$/.test(d.name)).map((d) => ({ name: d.name, state: d.state }));
    const files = FS.readdirSync(PATH.dirname(D("same.bin").path)).filter((f) => f.startsWith("same"));
    return CHECK("two of one name at once: name and name (1)", two.length === 2 && two.every((x) => x.state === "completed") && files.sort().join() === "same (1).bin,same.bin", { two, files });` },
  { js: `GET("tool.exe"); await sleep(1200); const d = D("tool.exe"), a = ASK(d);
    const waiting = { asked: !!a, held: !!d?.held && FS.existsSync(d.held), inDownloads: FS.existsSync(PATH.join(PATH.dirname(D("plain.txt").path), "tool.exe")) };
    R.answer(a?.id, true); await sleep(500);
    let mark = ""; try { mark = FS.readFileSync(d.path + ":Zone.Identifier", "utf8"); } catch {}
    const after = { state: d.state, name: d.name, there: FS.existsSync(d.path), mark: /ZoneId=3/.test(mark) };
    return CHECK("a program waits for yes, then comes to Downloads marked", waiting.asked && waiting.held && !waiting.inDownloads && after.state === "completed" && after.there && after.mark, { waiting, after });` },
  { js: `GET("tool2.exe", "&slow"); await sleep(400); const d = D("tool2.exe"), held = d?.held; R.answer(ASK(d)?.id, false); await sleep(2500);
    const got = { state: d?.state, held: held ? FS.existsSync(held) : "none", inDownloads: FS.existsSync(PATH.join(PATH.dirname(D("plain.txt").path), "tool2.exe")), heldDir: FS.readdirSync(PATH.dirname(held || ".")).filter((f) => f.includes("tool2")) };
    return CHECK("no while it comes in: nothing left anywhere", got.state === "cancelled" && got.held === false && !got.inDownloads && got.heldDir.length === 0, got);` },
  // files of the shell's own that run code when opened, as Chrome warns of them; Chromium already
  // turns a trailing dot or space ("x.exe.") and a .lnk into names that do not run
  { js: `const names = ["a.settingcontent-ms", "b.search-ms", "c.library-ms", "d.searchconnector-ms", "e.appinstaller", "f.xll", "g.diagcab", "h.wsc", "i.sct", "j.ws", "k.ps1xml", "l.msh", "m.jnlp", "n.ISO", "o.Cmd"];
    for (const n of names) GET(n); await sleep(2000);
    const loose = names.filter((n) => !ASK(D(n)));
    const tricks = ["p.exe.", "q.exe ", "r.lnk"]; for (const n of tricks) GET(n); await sleep(1500);
    const tricked = R.downloads.slice(-3).filter((d) => !d.runs && /\\.(exe|lnk)$/i.test(d.name)).map((d) => d.name);
    for (const a of R.asks.filter((x) => x.kind === "download")) R.answer(a.id, false); await sleep(500);
    return CHECK("files that run when opened are asked about", loose.length === 0 && tricked.length === 0, { loose, tricked, names: R.downloads.slice(-3).map((d) => d.name) });` },
  { js: `R.createWindow({ priv: true }); await sleep(1500); const p = R.windows.find((w) => w.private);
    await p.tabs[0].view.webContents.loadURL(BASE + "/page").catch(() => {}); GET("secret.txt", "", p.tabs[0]); await sleep(1500);
    const d = D("secret.txt");
    const kept = JSON.parse(FS.readFileSync(PATH.join(process.env.ROVE_HOME, "downloads.json"), "utf8"));
    p.win.close(); await sleep(500);
    return CHECK("a private window's download: done, not kept in downloads.json", d?.state === "completed" && d.private === true && !kept.some((x) => x.name === "secret.txt") && kept.some((x) => x.name === "plain.txt"), { state: d?.state, kept: kept.map((x) => x.name) });` },
  { js: `SRV.close(); return undefined;` },
];
