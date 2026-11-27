// node test/drive.mjs test/shift-click.mjs: a link Shift+clicked opens in a new Rove window
// (tabs, address bar), as in Chrome — not in a bare popup. A page's window.open with a size
// (a sign-in window that talks back to its opener) still gets the popup, and a plain
// window.open, a middle click and Ctrl+Shift+click still open tabs. From a private window the
// new window is private too. Needs the network (example.com, example.org). Each line prints ok or FAIL.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.BrowserWindow = process.mainModule.require("electron").BrowserWindow;
globalThis.pg = (t) => "data:text/html,<title>" + t + "</title><body style=margin:0><a id=l href='https://example.com/' style='display:block;width:300px;height:100px'>next</a>";
globalThis.COUNT = () => ({ rove: R.windows.length, popups: BrowserWindow.getAllWindows().filter((w) => !R.windows.some((x) => x.win === w || x.overlay?.webContents === w.webContents)).length, tabs: R.tabs.length });
globalThis.CLICK = async (modifiers, button = "left") => {
  const wc = R.active.view.webContents;
  wc.sendInputEvent({ type: "mouseDown", x: 50, y: 40, button, clickCount: 1, modifiers });
  wc.sendInputEvent({ type: "mouseUp", x: 50, y: 40, button, clickCount: 1, modifiers });
  await sleep(1200);
};
globalThis.PRESS = async () => { const wc = R.active.view.webContents; wc.sendInputEvent({ type: "mouseDown", x: 10, y: 600, button: "left", clickCount: 1 }); wc.sendInputEvent({ type: "mouseUp", x: 10, y: 600, button: "left", clickCount: 1 }); await sleep(100); };
// a new window's tab may still be reading its new tab page: going elsewhere then aborts one of the two loads (-3)
globalThis.OPEN = async (url) => { const wc = R.active.view.webContents; if (wc.isLoading()) await new Promise((r) => wc.once("did-stop-loading", r)); await wc.loadURL(url); };
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);`;
export default [
  { js: H + `await OPEN(pg("start")); await sleep(500); return "start " + JSON.stringify(COUNT());` },
  { js: `const a = COUNT(); await CLICK(["shift"]); const b = COUNT();
    const w = R.windows[R.windows.length - 1];
    const ok = b.rove === a.rove + 1 && b.popups === a.popups && w.tabs.length === 1 && /example.com/.test(w.tabs[0].view.webContents.getURL());
    return CHECK("Shift+click: a new Rove window with the link", ok, { a, b, url: w.tabs[0]?.view.webContents.getURL().slice(0, 40) });` },
  { js: `const w = R.windows[R.windows.length - 1]; w.win.close(); await sleep(600); R.select(R.windows[0].tabs[0]); await sleep(300);
    const a = COUNT(); await CLICK(["control", "shift"]); const b = COUNT();
    return CHECK("Ctrl+Shift+click: a tab in this window", b.rove === a.rove && b.tabs === a.tabs + 1, { a, b });` },
  { js: `R.select(R.windows[0].tabs[0]); await sleep(300); const a = COUNT(); await CLICK([], "middle"); const b = COUNT();
    return CHECK("middle click: a tab in this window", b.rove === a.rove && b.tabs === a.tabs + 1, { a, b });` },
  { js: `R.select(R.windows[0].tabs[0]); await sleep(300); const a = COUNT(); await PRESS();
    await R.active.view.webContents.executeJavaScript("window.open('https://example.org/', 'login', 'width=400,height=500'), 1", true); await sleep(1200);
    const b = COUNT(); const pop = BrowserWindow.getAllWindows().find((w) => !R.windows.some((x) => x.win === w)); pop?.close(); await sleep(300);
    return CHECK("window.open with a size: still a popup", b.popups === a.popups + 1 && b.rove === a.rove, { a, b });` },
  { js: `const a = COUNT(); await PRESS(); await R.active.view.webContents.executeJavaScript("window.open('https://example.org/'), 1", true); await sleep(1200);
    const b = COUNT(); return CHECK("window.open plain: a tab", b.tabs === a.tabs + 1 && b.rove === a.rove && b.popups === a.popups, { a, b });` },
  { js: `R.createWindow({ priv: true }); await sleep(1000);
    const p = R.windows.find((w) => w.private); if (!p) return "FAIL no private window";
    R.select(p.tabs[0]); await OPEN(pg("private")); await sleep(500); const a = COUNT(); await CLICK(["shift"]); const b = COUNT();
    const n = R.windows[R.windows.length - 1];
    return CHECK("Shift+click in a private window: a private window, the same session", n !== p && n.private && n.ses === p.ses && b.rove === a.rove + 1, { a, b, priv: n.private });` },
];
