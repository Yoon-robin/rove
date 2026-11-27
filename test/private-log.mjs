// node test/drive.mjs test/private-log.mjs: rove.log is on disk, so a private window's sites go in it
// unnamed ("(비공개 창)"), as they go in no history; a normal window's still go in by name. Two of the
// lines it writes for a site: 사이트 데이터 지움 (clearSite) and rove:// 막음 (a page sent to rove://).
// A local server in Rove's main process: no network. Each line prints ok or FAIL.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fs = process.mainModule.require("node:fs"), path = process.mainModule.require("node:path");
globalThis.LOG = () => { try { return fs.readFileSync(path.join(process.env.ROVE_HOME, "rove.log"), "utf8"); } catch { return ""; } };
globalThis.SRV = process.mainModule.require("node:http").createServer((q, s) => { s.writeHead(200, { "content-type": "text/html" }); s.end("<title>p</title>ok"); });
await new Promise((r) => SRV.listen(0, "127.0.0.1", r));
globalThis.SITE = "http://127.0.0.1:" + SRV.address().port + "/";
globalThis.LINES = async () => { const from = LOG().length; await R.clearSite(); R.active.view.webContents.executeJavaScript("location.href = 'rove://ui/newtab.html'").catch(() => {}); await sleep(800);
  return LOG().slice(from).split("\\n").filter((l) => /사이트 데이터 지움|rove:\\/\\/ 막음/.test(l)); };
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);`;
export default [
  { js: H + `globalThis.NORMAL = R.cur; R.createWindow({ priv: true, urls: [SITE] }); await sleep(1500);
    const got = await LINES();
    return CHECK("a private window's site is not named in rove.log", got.length === 2 && got.every((l) => l.includes("(비공개 창)") && !l.includes("127.0.0.1")), got);` },
  { js: `R.use(NORMAL); R.go(SITE); await sleep(1200);
    const got = await LINES();
    return CHECK("a normal window's site still is", got.length === 2 && got.every((l) => l.includes("127.0.0.1")), got);` },
];
