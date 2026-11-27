// node test/drive.mjs test/popup-block.mjs: a page that opens tabs or windows with no click or key
// in it just before is held, as Chrome's popup blocker: the ask bar says how many ("팝업 N개 막음"),
// 이번만 허용 opens the held ones and lets this tab open more, 차단 keeps the site quiet. One press
// lets one window through (the next open with no new press is held). Needs the network (example.com).
// Each line prints ok or FAIL.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { BrowserWindow } = process.mainModule.require("electron");
globalThis.POPS = () => BrowserWindow.getAllWindows().filter((w) => !R.windows.some((x) => x.win === w)).length;
globalThis.OPEN = (js) => R.active.view.webContents.executeJavaScript(js + "; 1");
globalThis.PRESS = async () => { const wc = R.active.view.webContents; wc.sendInputEvent({ type: "mouseDown", x: 10, y: 600, button: "left", clickCount: 1 }); wc.sendInputEvent({ type: "mouseUp", x: 10, y: 600, button: "left", clickCount: 1 }); await sleep(100); };
globalThis.HELD = () => R.asks.find((a) => a.what[0] === "popups");
globalThis.BAR = () => R.windows[0].win.webContents.executeJavaScript("[document.getElementById('ask').hidden, document.getElementById('askWho').textContent, document.getElementById('askWhat').textContent, document.getElementById('askOnce').hidden]");
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);`;
export default [
  { js: H + `R.go("https://example.com/"); await sleep(2500); globalThis.T0 = R.tabs.length; globalThis.P0 = POPS();
    await OPEN("window.open('https://example.org/'); window.open('https://example.net/')"); await sleep(800);
    const a = HELD(), bar = await BAR();
    return CHECK("two opens with no press: no tab, held, said in the ask bar", R.tabs.length === T0 && a?.count === 2 && bar[0] === false && bar[1] === "example.com" && bar[2] === "팝업 2개 막음" && bar[3] === false, { tabs: R.tabs.length - T0, count: a?.count, bar });` },
  { js: `await OPEN("window.open('https://example.org/', 'login', 'width=400,height=500')"); await sleep(800);
    return CHECK("a sized one with no press: no popup window, counted", POPS() === P0 && HELD()?.count === 3, { pops: POPS() - P0, count: HELD()?.count });` },
  { js: `await PRESS(); await OPEN("window.open('https://example.org/'); window.open('https://example.net/')"); await sleep(800);
    return CHECK("a press lets one through, the next open is held", R.tabs.length - T0 === 1 && HELD()?.count === 4, { after: R.tabs.length - T0, count: HELD()?.count });` },
  { js: `R.select(R.tabs.find((t) => /example\\.com/.test(t.url))); await sleep(300); const before = R.tabs.length;
    R.answer(HELD().id, true, false); await sleep(1500); const opened = R.tabs.length - before;
    await OPEN("window.open('https://example.org/')"); await sleep(800);
    return CHECK("이번만 허용: the held ones open (4, the sized one as a tab), this tab opens more, nothing kept", opened === 4 && R.tabs.length - before === 5 && !HELD() && !R.grants["https://example.com"], { opened, more: R.tabs.length - before - opened, kept: R.grants["https://example.com"] });` },
  { js: `R.go("https://example.org/"); await sleep(2500); R.go("https://example.com/"); await sleep(2500); const before = R.tabs.length;
    await OPEN("window.open('https://example.net/')"); await sleep(800); const asked = !!HELD();
    R.answer(HELD().id, false, true); await sleep(300);
    await OPEN("window.open('https://example.net/')"); await sleep(800);
    return CHECK("이번만 ends with the site; 차단 is kept and the site is held without asking", asked && R.grants["https://example.com"]?.popups === false && !HELD() && R.tabs.length === before, { asked, kept: R.grants["https://example.com"], ask: !!HELD(), tabs: R.tabs.length - before });` },
];
