// node test/drive.mjs test/split-label.mjs: two tabs side by side show each one's site in a row over
// it, as Brave shows the other's (the address bar shows only the one in front, two dark pages read
// alike); the row doesn't cover the pages, and pressing the other's row brings it to the front.
// Local servers only (two hosts: 127.0.0.1 and localhost). Each line prints ok or FAIL.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.SRV = process.mainModule.require("node:http").createServer((q, s) => { s.writeHead(200, { "content-type": "text/html" }); s.end("<title>page " + q.url.slice(1) + "</title>"); });
await new Promise((r) => SRV.listen(0, "127.0.0.1", r));
globalThis.P = SRV.address().port;
globalThis.ROWS = () => R.win.webContents.executeJavaScript("[...document.querySelectorAll('#split i')].map((i) => { const b = i.getBoundingClientRect(); return { text: i.textContent, x: b.left + b.width / 2, y: b.top + b.height / 2, top: b.top, bottom: b.bottom, color: getComputedStyle(i).color }; })");
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);`;
export default [
  { js: H + `R.win.setContentSize(1200, 800); R.active.view.webContents.loadURL("http://127.0.0.1:" + P + "/one").catch(() => {}); R.newTab("http://localhost:" + P + "/two"); await sleep(1500);
    R.splitWith(R.tabs[1], R.tabs[0]); R.select(R.tabs[0]); await sleep(600);
    const rows = await ROWS(), va = R.tabs[0].view.getBounds();
    const got = { rows: rows.map((r) => r.text), top: rows[0]?.top, bottom: rows[0]?.bottom, pageY: va.y, front: rows[0]?.color !== rows[1]?.color };
    return CHECK("each side shows its site over it, above the page, the one in front apart", got.rows[0] === "127.0.0.1:" + P && got.rows[1] === "localhost:" + P && got.bottom <= got.pageY && got.pageY - got.top === 24 && got.front, got);` },
  { js: `const rows = await ROWS(), r = rows[1], wc = R.win.webContents;
    for (const type of ["mouseDown", "mouseUp"]) wc.sendInputEvent({ type, x: Math.round(r.x), y: Math.round(r.y), button: "left", clickCount: 1 });
    await sleep(500);
    return CHECK("pressing the other side's row brings it to the front", R.active === R.split?.b, { active: R.active?.id, b: R.split?.b?.id });` },
  { js: `R.unsplit(); await sleep(400); const shown = await R.win.webContents.executeJavaScript("!document.getElementById('split').hidden"); const y = R.active.view.getBounds().y;
    SRV.close();
    return CHECK("ended: no row, the page back up", !shown && y === 84, { shown, y });` },
];
