// node test/drive.mjs test/restore-history.mjs: a tab brought back keeps its back and forward list,
// as in Chrome — a closed tab (Ctrl+Shift+T), a closed window, and the tabs of the last run
// (tabs.json keeps each tab's list, addresses and titles only: a page's pageState holds what was
// typed in it). Needs the network (example.com). Each line prints ok or FAIL.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.u = (t) => "https://example.com/?" + t;
globalThis.KEY = () => R.keys({ type: "keyDown", key: "T", control: true, shift: true });
globalThis.NH = (t) => t.view.webContents.navigationHistory;
globalThis.WALK = async (t, list) => { for (const x of list) { await t.view.webContents.loadURL(u(x)); await sleep(300); } };
globalThis.LIST = (t) => NH(t).getAllEntries().map((e) => e.url.split("?")[1]);
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);`;
export default [
  { js: H + `R.newTab(u("a")); await sleep(800); await WALK(R.active, ["b", "c"]); return JSON.stringify(LIST(R.active));` },
  { js: `R.closeTab(R.active); await sleep(300); KEY(); await sleep(1500);
    const t = R.active, got = { list: LIST(t), at: NH(t).getActiveIndex(), back: NH(t).canGoBack() };
    return CHECK("Ctrl+Shift+T: the closed tab with its back list", JSON.stringify(got.list) === JSON.stringify(["a", "b", "c"]) && got.at === 2 && got.back, got);` },
  { js: `const t = R.active; NH(t).goBack(); await sleep(800);
    return CHECK("back goes to the page before", t.view.webContents.getURL() === u("b") && NH(t).canGoForward(), t.view.webContents.getURL());` },
  // a closed window: its tabs come back with their lists too
  { js: `R.createWindow({ urls: [u("w1")] }); await sleep(1200); const w = R.windows[1]; await WALK(w.tabs[0], ["w2"]);
    w.win.close(); await sleep(800); R.select(R.windows[0].tabs[0]); await sleep(200); KEY(); await sleep(1500);
    const t = R.windows[1]?.tabs[0]; const got = t && { list: LIST(t), url: t.view.webContents.getURL() };
    return CHECK("a closed window's tab with its back list", !!t && JSON.stringify(got.list) === JSON.stringify(["w1", "w2"]) && got.url === u("w2"), got);` },
  // tabs.json: each tab's list, without pageState; a sleeping tab's list is kept as it sleeps
  { js: `R.windows[1].win.close(); await sleep(800);
    const fs = process.mainModule.require("fs"), path = process.mainModule.require("path");
    await sleep(1500); const saved = JSON.parse(fs.readFileSync(path.join(process.env.ROVE_HOME, "tabs.json"), "utf8"));
    const w = saved.windows[0], i = w.urls.indexOf(u("b")) >= 0 ? w.urls.indexOf(u("b")) : w.urls.indexOf(u("c"));
    const h = w.nav?.[i];
    const got = h && { list: h.entries.map((e) => e.url.split("?")[1]), index: h.index, keys: [...new Set(h.entries.flatMap(Object.keys))] };
    return CHECK("tabs.json keeps the list, addresses and titles only", !!h && got.list.join() === "a,b,c" && got.index === 1 && got.keys.every((k) => k === "url" || k === "title"), got);` },
  // the last run's tabs: a window made from tabs.json, its tab in front and a sleeping one
  { js: `R.createWindow({ restore: { urls: [u("r2"), u("s2")], titles: ["", ""], active: 0,
      nav: [{ entries: [{ url: u("r1"), title: "" }, { url: u("r2"), title: "" }], index: 1 }, { entries: [{ url: u("s1"), title: "" }, { url: u("s2"), title: "" }, { url: "rove://nope", title: "" }], index: 1 }] } });
    await sleep(2000); const w = R.windows[R.windows.length - 1];
    const front = { list: LIST(w.tabs[0]), url: w.tabs[0].view.webContents.getURL() };
    R.select(w.tabs[1]); await sleep(1500); const other = { list: LIST(w.tabs[1]), url: w.tabs[1].view.webContents.getURL() };
    return CHECK("last run's tabs: the list back (front and sleeping; Rove's own pages left out)", front.list.join() === "r1,r2" && front.url === u("r2") && other.list.join() === "s1,s2" && other.url === u("s2"), { front, other });` },
  { js: `const w = R.windows[R.windows.length - 1]; R.createWindow({ restore: { urls: [u("bad")], active: 0, nav: [{ entries: [{ url: "file:///c:/x", title: "" }], index: 0 }] } });
    await sleep(1500); const n = R.windows[R.windows.length - 1]; const got = { list: LIST(n.tabs[0]), url: n.tabs[0].view.webContents.getURL() };
    w.win.close(); n.win.close(); await sleep(500);
    return CHECK("a list without the shown page: just the address", got.url === u("bad") && got.list.join() === "bad", got);` },
];
