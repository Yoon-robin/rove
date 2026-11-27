// node test/drive.mjs test/update-relaunch.mjs: ≡ "다시 켜서 새 버전으로" brings the open tabs back even when
// 지난 탭으로 시작 is off (start: "home"), as Chrome's and Brave's relaunch for an update restores the session.
// The relaunch row is pressed for real; app.relaunch and app.quit are caught (nothing restarts). The start it
// asks for is startWindows(last run, again) — what boot calls when the flag is in argv. A local server, no network.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);
globalThis.SRV = process.mainModule.require("node:http").createServer((q, s) => { s.writeHead(200, { "content-type": "text/html" }); s.end("<title>" + q.url.slice(1) + "</title>"); });
await new Promise((r) => SRV.listen(0, "127.0.0.1", r));
globalThis.A = "http://127.0.0.1:" + SRV.address().port;
globalThis.LAST = [{ urls: [A + "/one", A + "/two"], titles: ["one", "two"], active: 1 }];`;
export default [
  { js: H + `const app = process.mainModule.require("electron").app; globalThis.ASKED = [];
    app.relaunch = (o) => ASKED.push(["relaunch", o]); app.quit = () => ASKED.push(["quit"]);
    R.settings.start = "home";
    R.setUpdater((tell) => ({ state: () => ({ version: "1.0.0", ready: "9.9.9", checking: false, downloading: null, checkedAt: Date.now(), error: null }), exe: () => "C:\\\\Rove\\\\current\\\\Rove.exe", check: async () => {} }));
    R.showOverlay({ kind: "menu" }); await sleep(600);
    await R.overlay.webContents.executeJavaScript("document.querySelector('[data-do=relaunch]').click()"); await sleep(400);
    const r = ASKED.find((a) => a[0] === "relaunch")?.[1];
    globalThis.FLAG = r?.args?.[0];
    return CHECK("the relaunch asks the new version to bring the tabs back, then quits", r?.execPath.endsWith("Rove.exe") && r.args.length === 1 && /^--/.test(FLAG) && ASKED.some((a) => a[0] === "quit"), ASKED);` },
  { js: `const n = R.windows.length; R.startWindows(LAST, true); await sleep(1000); const w = R.windows[R.windows.length - 1];
    const got = { windows: R.windows.length - n, tabs: w.tabs.map((t) => t.url.replace(A, "")), start: R.settings.start };
    return CHECK("started again so: the last run's tabs though 지난 탭으로 시작 is off, the setting kept", got.windows === 1 && got.tabs.join() === "/one,/two" && got.start === "home", got);` },
  { js: `const n = R.windows.length; R.startWindows(LAST); await sleep(1000); const w = R.windows[R.windows.length - 1];
    const got = { windows: R.windows.length - n, tabs: w.tabs.length, first: w.tabs[0].url.startsWith(A) };
    SRV.closeAllConnections?.(); SRV.close();
    return CHECK("a plain start still opens one home tab", got.windows === 1 && got.tabs === 1 && !got.first, got);` },
];
