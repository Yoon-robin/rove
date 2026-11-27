// node test/drive.mjs test/suggest-off.mjs: ≡ 검색엔진 also turns the address bar's suggestions from
// 방문 기록, 즐겨찾기 and 열린 탭 off one by one, as Brave's settings › search (all on at first). Off,
// that kind is neither a row under the bar nor the part filled in as one types; it stays off after
// the menu is opened again. History and bookmarks are put in directly, the tab is a local page:
// no network. Each line prints ok or FAIL.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);
globalThis.UI = (js) => R.win.webContents.executeJavaScript(js);
globalThis.MENU = async () => { await UI("rove.send('rove:engine-menu'), 1"); await sleep(300); return R.lastMenu || []; };
globalThis.ITEM = (m, label) => m.find((i) => i.type === "checkbox" && i.label === label);
globalThis.ROWS = async (text) => { await UI("url.focus(), url.value = " + JSON.stringify(text) + ", fill = true, suggest(), 1"); await sleep(500);
  return UI("({ kinds: items.map((i) => i.kind), value: url.value })"); };
globalThis.SRV = process.mainModule.require("node:http").createServer((q, s) => { s.writeHead(200, { "content-type": "text/html" }); s.end("<title>zebra tab</title>z"); });
await new Promise((r) => SRV.listen(0, "127.0.0.1", r));
const now = Date.now();
R.history.splice(0, R.history.length, { url: "https://zebra-history.test/", title: "zebra 기록", at: now - 1000 });
R.bookmarks.splice(0, R.bookmarks.length, { url: "https://zebra-mark.test/", title: "zebra 즐겨찾기" });`;
export default [
  { js: H + `R.newTab("http://127.0.0.1:" + SRV.address().port + "/zebra-tab"); await sleep(800); R.newTab("about:blank"); await sleep(600);
    const m = await MENU(); const got = ["방문 기록", "즐겨찾기", "열린 탭"].map((l) => ITEM(m, l)?.checked);
    const rows = await ROWS("zebra");
    return CHECK("at first: the three are in the menu, on, and all three kinds come up", got.every((c) => c === true) && ["tab", "bookmark", "history"].every((k) => rows.kinds.includes(k)), { got, rows });` },
  { js: `ITEM(await MENU(), "방문 기록").click(); await sleep(200); const rows = await ROWS("zebra");
    const fill = await ROWS("zebra-h");
    return CHECK("방문 기록 off: no history row, not filled in from history", !rows.kinds.includes("history") && rows.kinds.includes("bookmark") && fill.value === "zebra-h", { rows, fill });` },
  { js: `ITEM(await MENU(), "즐겨찾기").click(); ITEM(await MENU(), "열린 탭").click(); await sleep(200); const rows = await ROWS("zebra");
    const m = await MENU();
    return CHECK("all off: only the search row, and the menu shows them off", rows.kinds.join() === "search" && ["방문 기록", "즐겨찾기", "열린 탭"].every((l) => ITEM(m, l).checked === false), { rows });` },
  { js: `ITEM(await MENU(), "방문 기록").click(); await sleep(200); const rows = await ROWS("zebra");
    return CHECK("방문 기록 back on: it comes up again, kept in settings", rows.kinds.includes("history") && !rows.kinds.includes("bookmark") && R.settings.suggestOff.join() === "bookmark,tab", { rows, off: R.settings.suggestOff });` },
];
