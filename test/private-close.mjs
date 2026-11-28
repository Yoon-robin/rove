// node test/drive.mjs test/private-close.mjs: a private window with several tabs asks before it
// closes (nothing of it is kept, Ctrl+Shift+T cannot bring it back), as Brave's 설정 › 시스템 ›
// 탭 여러 개가 있는 창을 닫기 전에 경고 (on at first). 취소 keeps it as it was; 닫기 closes it.
// A private window with one tab, and a normal window with several (it comes back with
// Ctrl+Shift+T), close without asking. The question is a fake here (no native dialog in a test).
// Needs the network (example.com). Each line prints ok or FAIL.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.u = (t) => "https://example.com/?" + t;
globalThis.ASKED = [];
globalThis.ANSWER = false;
R.setAskClose((bw, n) => { ASKED.push(n); return new Promise((r) => setTimeout(() => r(ANSWER), 200)); });
globalThis.PRIV = async (n) => { R.createWindow({ priv: true }); await sleep(1000); const p = R.windows[R.windows.length - 1];
  R.use(p); for (let i = 1; i < n; i++) { R.newTab(u("p" + i)); await sleep(300); } return p; };
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);`;
export default [
  { js: H + `R.go(u("main")); await sleep(500); globalThis.P = await PRIV(3);
    P.win.close(); P.win.close(); await sleep(600); // twice: one question, not two
    const got = { asked: ASKED, open: !P.gone && !P.win.isDestroyed(), tabs: P.tabs.length };
    return CHECK("3 private tabs, 취소: asked once, the window stays with its tabs", JSON.stringify(got.asked) === "[3]" && got.open && got.tabs === 3, got);` },
  { js: `ASKED.length = 0; ANSWER = true; R.use(P); R.keys({ type: "keyDown", key: "W", control: true, shift: true }); await sleep(800);
    const got = { asked: ASKED, gone: P.gone, windows: R.windows.length };
    return CHECK("Ctrl+Shift+W, 닫기: asked, then closed", JSON.stringify(got.asked) === "[3]" && got.gone && got.windows === 1, got);` },
  { js: `ASKED.length = 0; const p = await PRIV(1); p.win.close(); await sleep(800);
    return CHECK("1 private tab: closes without asking", ASKED.length === 0 && p.gone, { asked: ASKED, gone: p.gone });` },
  { js: `ASKED.length = 0; R.createWindow({ urls: [u("a"), u("b"), u("c")] }); await sleep(1200); const w = R.windows[R.windows.length - 1];
    w.win.close(); await sleep(800);
    return CHECK("a normal window of 3 tabs: closes without asking (Ctrl+Shift+T has it)", ASKED.length === 0 && w.gone, { asked: ASKED, gone: w.gone });` },
];
