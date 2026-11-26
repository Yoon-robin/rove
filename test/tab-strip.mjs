// node test/drive.mjs test/tab-strip.mjs: more tabs than the strip holds at their 44px
// least (a 480px window, 14 tabs). The current tab must be in view, and every tab must be
// reachable (the strip scrolls, also with a plain wheel). Each line prints ok or FAIL.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.pg = (t) => "data:text/html,<title>" + t + "</title><body>" + t;
globalThis.STRIP = () => R.win.webContents.executeJavaScript(\`(() => {
  const s = document.getElementById("tabs"), b = s.getBoundingClientRect(), on = s.querySelector('.tab[aria-selected="true"]').getBoundingClientRect();
  return { shown: on.left >= b.left - 0.5 && on.right <= b.right + 0.5, left: Math.round(s.scrollLeft), more: s.scrollWidth > s.clientWidth };
})()\`);
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);`;
export default [
  { js: H + `R.win.setContentSize(480, 320); await sleep(300); R.go(pg("tab 1")); await sleep(300);
    for (let i = 2; i <= 14; i++) { R.newTab(pg("tab " + i)); await sleep(120); } await sleep(500); return "tabs " + R.tabs.length;` },
  { js: `R.select(R.tabs[13]); await sleep(400); const s = await STRIP(); return CHECK("last tab chosen: in view", s.more && s.shown, s);` },
  { js: `R.select(R.tabs[0]); await sleep(400); const s = await STRIP(); return CHECK("first tab chosen: in view", s.shown && s.left === 0, s);` },
  { js: `R.win.webContents.sendInputEvent({ type: "mouseWheel", x: 200, y: 20, deltaX: 0, deltaY: -240, canScroll: true }); await sleep(400);
    const s = await STRIP(); return CHECK("wheel moves the strip", s.left > 0, s);` },
  // the window made narrower with the last tab chosen: it must stay in view
  { js: `R.win.setContentSize(1400, 320); await sleep(300); R.select(R.tabs[13]); await sleep(400); R.win.setContentSize(480, 320); await sleep(600);
    const s = await STRIP(); return CHECK("window narrowed: chosen tab in view", s.shown, s);` },
  { js: `R.select(R.tabs[0]); await sleep(400); R.win.webContents.sendInputEvent({ type: "mouseWheel", x: 200, y: 20, deltaX: 0, deltaY: -240, canScroll: true }); await sleep(400); return "scrolled " + (await STRIP()).left;` },
  // a redraw (a title changing) must not pull a hand-scrolled strip back
  { js: `const before = (await STRIP()).left; R.tabs[5].view.webContents.executeJavaScript("document.title = 'renamed'"); await sleep(500);
    const s = await STRIP(); return CHECK("redraw keeps the scroll", s.left === before, { before, ...s });` },
];
