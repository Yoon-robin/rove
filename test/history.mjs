// node test/drive.mjs test/history.mjs: 방문 기록, as a user meets it — a page is kept with its own
// title (a page with none: its address, never the page before's title); the same page again soon is
// one line; a move inside the page (#, pushState) is kept; a private window keeps nothing, not even
// a new title on the page last kept from a normal window; 기록에서 지우기 takes the line out.
// A local server in Rove's main process — no network. Each line prints ok or FAIL.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.FS = process.mainModule.require("node:fs"); globalThis.PATH = process.mainModule.require("node:path");
globalThis.HITS = {};
globalThis.SRV = process.mainModule.require("node:http").createServer((q, s) => {
  const n = (HITS[q.url] = (HITS[q.url] || 0) + 1); s.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  if (q.url === "/a") return s.end("<title>Page A</title>a");
  if (q.url === "/b") return s.end("<p>no title here</p>");
  if (q.url === "/mail") return s.end(n === 1 ? "<title>Mail</title>" : "<title>Inbox - secret@example.com</title>");
  if (q.url === "/spa") return s.end("<title>App</title><script>setTimeout(() => history.pushState({}, '', '/spa/next'), 300)</script>");
  s.end("<title>" + q.url + "</title>");
});
await new Promise((r) => SRV.listen(0, "127.0.0.1", r));
globalThis.U = (t) => "http://127.0.0.1:" + SRV.address().port + t;
globalThis.LOAD = async (tab, url, ms = 1000) => { tab.view.webContents.loadURL(url).catch(() => {}); await sleep(ms); };
globalThis.SAVED = () => { try { return JSON.parse(FS.readFileSync(PATH.join(process.env.ROVE_HOME, "history.json"), "utf8")); } catch { return []; } };
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);`;
export default [
  { js: H + `const t = R.active; await LOAD(t, U("/a")); await LOAD(t, U("/b"));
    const last = R.history[R.history.length - 1]; const got = { tab: t.title, kept: last && { url: last.url.replace(U(""), ""), title: last.title } };
    return CHECK("a page with no title: its address, never the page before's", got.tab !== "Page A" && got.kept?.url === "/b" && got.kept.title !== "Page A" && got.kept.title !== "", got);` },
  { js: `const t = R.active; const n = R.history.length; await LOAD(t, U("/b")); await LOAD(t, U("/spa"), 1500);
    const got = { added: R.history.length - n, tail: R.history.slice(-2).map((h) => h.url.replace(U(""), "")) };
    return CHECK("the same page again soon: one line; a move inside the page: kept", got.added === 2 && got.tail.join() === "/spa,/spa/next", got);` },
  { js: `const t = R.active; await LOAD(t, U("/mail"), 1200); const n = R.history.length;
    R.createWindow({ priv: true }); await sleep(1500); const p = R.windows.find((w) => w.private && !w.gone);
    await LOAD(p.tabs[0], U("/mail"), 1500); await LOAD(p.tabs[0], U("/private-only"), 1000); await sleep(1200);
    const mine = R.history.filter((h) => h.url === U("/mail")).map((h) => h.title), saved = SAVED();
    const got = { added: R.history.length - n, mailTitles: mine, onDisk: saved.filter((h) => /secret|private-only/.test(h.url + h.title)).length, hits: HITS["/mail"] };
    p.win.close(); await sleep(600); R.use(R.windows[0]);
    return CHECK("a private window keeps nothing, not even a new title on a page kept before", got.hits === 2 && got.added === 0 && got.mailTitles.every((x) => x === "Mail") && got.onDisk === 0, got);` },
  { js: `const url = U("/a"); const ipc = process.mainModule.require("electron").ipcMain;
    ipc.emit("rove:forget", { sender: R.win.webContents }, url); await sleep(1200);
    const got = { left: R.history.filter((h) => h.url === url).length, onDisk: SAVED().filter((h) => h.url === url).length };
    SRV.close();
    return CHECK("기록에서 지우기: the line goes, on disk too", got.left === 0 && got.onDisk === 0, got);` },
];
