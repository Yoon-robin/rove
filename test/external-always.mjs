// node test/drive.mjs test/external-always.mjs: a link to another program (zoommtg:) can be kept
// per site and scheme, as Chrome's "always allow" — 늘 열기 in the ask bar, shown only for an https
// site (not a plain-http page). What is kept shows in the site popup and the sites drawer and can be changed there; a
// kept 차단 is answered without asking. Nothing opens a program: the ask's answer goes to a counter
// instead of Electron, and the kept answer tried for real is 차단. Uses the network (example.com).
// Each line prints ok or FAIL.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);
globalThis.GOT = [];
globalThis.LINK = async (href) => {
  const before = R.asks.length;
  await R.active.view.webContents.executeJavaScript("location.href = " + JSON.stringify(href) + "; 1").catch(() => {});
  await sleep(800);
  const ask = R.asks.slice(before).find((a) => a.what[0] === "external");
  if (ask) ask.done = [(v) => GOT.push(v)]; // not Electron's: no program opens
  return ask || null;
};
globalThis.BAR = () => R.win.webContents.executeJavaScript("(() => { const b = document.getElementById('askAlways'); return { bar: !document.getElementById('ask').hidden, always: !!b && !b.hidden, label: b?.textContent || '' }; })()");
globalThis.POP = (js) => R.overlay.webContents.executeJavaScript(js);
globalThis.ZOOM = "zoommtg://zoom.us/join?confno=1";`;
export default [
  { js: H + `globalThis.SRV = process.mainModule.require("http").createServer((q, res) => res.end("<title>x</title>x")); await new Promise((r) => SRV.listen(0, "127.0.0.1", r));
    R.go("http://127.0.0.1:" + SRV.address().port + "/"); await sleep(800); const a = await LINK(ZOOM); await sleep(300); const bar = await BAR(); if (a) R.answer(a.id, false, false);
    return CHECK("a page that is not https (http://127.0.0.1): asked, no 늘 열기", !!a && bar.bar && !bar.always, { asked: !!a, origin: a?.origin, bar });` },
  { js: `SRV.close(); GOT.length = 0; R.go("https://example.com/"); await sleep(3000); const a = await LINK(ZOOM); await sleep(300); const bar = await BAR();
    globalThis.FIRST = a;
    return CHECK("an https site: 늘 열기 beside 열기", !!a && bar.always && bar.label === "늘 열기", { asked: !!a, bar });` },
  { js: `await R.win.webContents.executeJavaScript("document.getElementById('askAlways').click(), 1"); await sleep(400);
    const kept = R.grants["https://example.com"];
    return CHECK("늘 열기: opened this once, kept for example.com and zoommtg only", GOT.join() === "true" && kept?.["external:zoommtg"] === true && !R.asks.includes(FIRST), { GOT, kept });` },
  { js: `R.showOverlay({ kind: "site", x: 200, y: 84 }); await sleep(700);
    const row = await POP("(() => { const s = [...document.querySelectorAll('select[data-k]')].find((x) => x.dataset.k === 'external:zoommtg'); return s && { label: s.closest('.perm')?.querySelector('span')?.textContent, value: s.value }; })()");
    R.hideOverlay(); await sleep(200); R.showOverlay({ kind: "drawer", panel: "sites" }); await sleep(700);
    const line = await POP("[...document.querySelectorAll('.drawer .item small')].map((s) => s.textContent).join(' | ')"); R.hideOverlay(); await sleep(200);
    return CHECK("kept: in the site popup (허용) and the sites drawer", row?.value === "allow" && /zoommtg: 링크 열기/.test(row.label) && /zoommtg: 링크 열기 허용/.test(line), { row, line });` },
  { js: `const ipc = process.mainModule.require("electron").ipcMain; ipc.emit("rove:site-set", { sender: R.win.webContents }, "https://example.com", "external:zoommtg", "block"); await sleep(200);
    const n = GOT.length, a = await LINK(ZOOM);
    return CHECK("kept 차단 (set in the popup): refused without asking", !a && GOT.length === n && R.grants["https://example.com"]?.["external:zoommtg"] === false, { asked: !!a, kept: R.grants["https://example.com"] });` },
  { js: `const a = await LINK("msteams://teams.microsoft.com/l/meetup-join/x"); const asked = !!a; if (a) R.answer(a.id, false, false);
    const ipc = process.mainModule.require("electron").ipcMain; ipc.emit("rove:site-set", { sender: R.win.webContents }, "https://example.com", "external:zoommtg", "ask"); await sleep(200);
    const b = await LINK(ZOOM); if (b) R.answer(b.id, false, false);
    return CHECK("another scheme still asked; 묻기 forgets the kept one", asked && !!b && !R.grants["https://example.com"], { asked, again: !!b, kept: R.grants["https://example.com"] || null });` },
];
