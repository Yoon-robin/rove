// node test/drive.mjs test/quit-ask-downloads.mjs: Rove ending while a file is still coming down asks
// first, as Chrome and Brave do ("다운로드가 진행 중입니다", Browser::OkToCloseWithInProgressDownloads).
// Rove ended at once — closing the last window or ≡ 다시 켜서 새 버전으로 — and the next start could only
// get the file again from the start. Here the question is a fake one (setAskQuit) that answers as told;
// app.relaunch and app.quit are caught (nothing ends). A slow local file, no network.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.SRV = process.mainModule.require("node:http").createServer((q, s) => {
  s.writeHead(200, { "content-type": "application/octet-stream", "content-disposition": "attachment; filename=slow.bin", "content-length": String(1 << 24) });
  const t = setInterval(() => s.write(Buffer.alloc(16384)), 50); s.on("close", () => clearInterval(t));
});
await new Promise((r) => SRV.listen(0, "127.0.0.1", r));
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);
const app = process.mainModule.require("electron").app; globalThis.DONE = [];
app.relaunch = () => DONE.push("relaunch"); app.quit = () => DONE.push("quit");
globalThis.ASKED = []; globalThis.ANSWER = false;
R.setAskQuit((bw, n, again) => { ASKED.push({ n, again }); return Promise.resolve(ANSWER); });
R.setUpdater(() => ({ state: () => ({ version: "1.0.0", ready: "9.9.9", checking: false, downloading: null, checkedAt: Date.now(), error: null }), exe: () => "C:\\\\Rove\\\\current\\\\Rove.exe", check: async () => {} }));
globalThis.RELAUNCH = async () => { R.showOverlay({ kind: "menu" }); await sleep(500); await R.overlay.webContents.executeJavaScript("document.querySelector('[data-do=relaunch]').click()"); await sleep(500); };`;
export default [
  { js: H + `{ const wc = R.active.view.webContents; if (wc.isLoading()) await new Promise((r) => wc.once("did-stop-loading", r)); }
    R.active.view.webContents.downloadURL("http://127.0.0.1:" + SRV.address().port + "/slow.bin"); await sleep(1200);
    const w = R.windows[0]; w.win.close(); await sleep(500);
    const got = { asked: ASKED, open: !w.gone, windows: R.windows.length, done: DONE, state: R.downloads.map((d) => d.state) };
    return CHECK("closing the last window with a file coming down asks; 계속 받기 keeps Rove and the download", ASKED.length === 1 && ASKED[0].n === 1 && !ASKED[0].again && got.open && !DONE.length && got.state[0] === "progressing", got);` },
  { js: `ASKED.length = 0; await RELAUNCH();
    const no = { asked: ASKED.slice(), done: DONE.slice() };
    ANSWER = true; ASKED.length = 0; await RELAUNCH();
    const yes = { asked: ASKED.slice(), done: DONE.slice() };
    return CHECK("다시 켜서 새 버전으로 asks too: 계속 받기 stays, 다시 켜기 relaunches", no.asked.length === 1 && no.asked[0].again && !no.done.length && yes.asked.length === 1 && yes.done.join() === "relaunch,quit", { no, yes });` },
  { js: `ASKED.length = 0; DONE.length = 0;
    R.downloads.find((d) => d.state === "progressing")?.item.cancel(); await sleep(500);
    await RELAUNCH();
    return CHECK("nothing coming down: not asked", !ASKED.length && DONE.join() === "relaunch,quit", { asked: ASKED, done: DONE, state: R.downloads.map((d) => d.state) });` },
  { js: `ASKED.length = 0; DONE.length = 0; ANSWER = true;
    R.active.view.webContents.downloadURL("http://127.0.0.1:" + SRV.address().port + "/slow.bin?2"); await sleep(1200);
    const w = R.windows[0]; w.win.close(); await sleep(800);
    SRV.closeAllConnections?.(); SRV.close();
    return CHECK("끄기 closes the last window and ends Rove", ASKED.length === 1 && w.gone && DONE.includes("quit"), { asked: ASKED, gone: w.gone, done: DONE });` },
];
