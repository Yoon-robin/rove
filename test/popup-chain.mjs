// node test/drive.mjs test/popup-chain.mjs: what a popup's own page opens is taken as a tab's is (Brave,
// Chrome): a window it opens with no click is held and asked on the tab that opened it all, a link to a new
// tab opens as a tab in that window (not another bare window), a sized window.open after a click is a popup
// at that size, and Ctrl+Esc closes a popup's popup too. MIKAEL 11-27. Local server only, no network.
// Each line prints ok or FAIL.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { BrowserWindow } = process.mainModule.require("electron");
const http = process.mainModule.require("node:http");
globalThis.SRV = http.createServer((q, s) => { s.writeHead(200, { "content-type": "text/html" }); s.end("<p>here</p>"); });
await new Promise((r) => SRV.listen(0, "127.0.0.1", r));
globalThis.BASE = "http://127.0.0.1:" + SRV.address().port;
globalThis.PAGE = (js) => R.active.view.webContents.executeJavaScript(js);
globalThis.CLICK = async (wc) => { wc.sendInputEvent({ type: "mouseDown", x: 10, y: 10, button: "left", clickCount: 1 }); wc.sendInputEvent({ type: "mouseUp", x: 10, y: 10, button: "left", clickCount: 1 }); await sleep(100); };
globalThis.POPS = () => BrowserWindow.getAllWindows().filter((w) => !w.isDestroyed() && !R.windows.some((x) => x.win === w) && w !== R.overlay?.getParentWindow?.());
globalThis.HELD = () => R.asks.filter((a) => a.what?.[0] === "popups");
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);`;
export default [
  { js: H + `R.go(BASE + "/"); await sleep(1200); await CLICK(R.active.view.webContents);
    await PAGE("window.open(location.origin + '/p', 'p', 'width=500,height=400'), 1"); await sleep(1500);
    globalThis.P = POPS().find((w) => w.webContents.getURL().endsWith("/p")); if (!P) return "FAIL no popup";
    globalThis.OPENER = R.active;
    const n = POPS().length, held = HELD().length;
    await P.webContents.executeJavaScript("window.open(location.origin + '/q', 'q', 'width=300,height=300'), 1"); await sleep(1200);
    return CHECK("a window the popup opens with no click: held, asked on the tab", POPS().length === n && HELD().length === held + 1 && HELD().some((a) => a.tab === OPENER), { pops: POPS().length, n, held: HELD().map((a) => a.count) });` },
  { js: `const n = POPS().length, t = R.tabs.length; await CLICK(P.webContents);
    await P.webContents.executeJavaScript("window.open(location.origin + '/tab', '_blank'), 1"); await sleep(1500);
    const urls = R.tabs.map((x) => x.view.webContents.getURL());
    return CHECK("a link to a new tab from the popup: a tab in the window, no new bare window", POPS().length === n && R.tabs.length === t + 1 && urls.some((u) => u.endsWith("/tab")), { pops: POPS().length, n, tabs: urls });` },
  { js: `await CLICK(P.webContents);
    await P.webContents.executeJavaScript("window.open(location.origin + '/pop', 'r', 'width=320,height=240'), 1"); await sleep(1500);
    const q = POPS().find((w) => w.webContents.getURL().endsWith("/pop"));
    if (!q) return CHECK("a sized window.open after a click in the popup: a popup", false, POPS().map((w) => w.webContents.getURL()));
    const [cw, ch] = q.getContentSize();
    q.webContents.sendInputEvent({ type: "keyDown", keyCode: "Escape", modifiers: ["control"] }); await sleep(800);
    const closed = q.isDestroyed();
    return CHECK("a popup's popup: at the size it asked, Ctrl+Esc closes it", cw === 320 && ch === 240 && closed, { cw, ch, closed });` },
  { js: `for (const a of HELD()) R.answer(a.id, false, false);
    for (const t of R.tabs.filter((x) => x.view.webContents.getURL().endsWith("/tab"))) R.closeTab(t);
    POPS().forEach((w) => w.close()); SRV.close(); await sleep(300);
    return CHECK("cleaned up", !POPS().length, POPS().length);` },
];
