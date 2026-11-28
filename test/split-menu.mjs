// node test/drive.mjs test/split-menu.mjs: side by side from a tab's menu, as in Brave — the tab in
// front starts it with a new tab on its right; a paired tab's menu swaps the two sides (the gap stays)
// and ends it. Local server only. Each line prints ok or FAIL.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.SRV = process.mainModule.require("node:http").createServer((q, s) => { s.writeHead(200, { "content-type": "text/html" }); s.end("<title>page " + q.url.slice(1) + "</title>"); });
await new Promise((r) => SRV.listen(0, "127.0.0.1", r));
globalThis.U = (t) => "http://127.0.0.1:" + SRV.address().port + "/" + t;
globalThis.ITEM = (tab, label) => R.tabItems(tab).find((m) => m.label === label);
globalThis.X = (tab) => tab.view.getBounds().x;
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);`;
export default [
  { js: H + `R.active.view.webContents.loadURL(U("one")).catch(() => {}); R.newTab(U("two")); await sleep(1200);
    const one = R.tabs[0]; R.select(one); await sleep(200);
    const item = ITEM(one, "새 탭과 나란히 보기"); if (item?.enabled !== false) item?.click(); await sleep(800);
    const s = R.split, got = { item: !!item && item.enabled !== false, count: R.tabs.length, left: s && s.a === one, rightNext: s && R.tabs.indexOf(s.b) === 1, front: s && R.active === s.b, shown: s && [s.a.view.getVisible(), s.b.view.getVisible()] };
    return CHECK("the tab in front: a new tab on its right, the two side by side, the new one in front", got.item && got.count === 3 && got.left && got.rightNext && got.front && got.shown.every(Boolean), got);` },
  { js: `const { a, b } = R.split; R.splitRatio(0.3); await sleep(300); const gap = X(b);
    ITEM(a, "왼쪽·오른쪽 바꾸기")?.click(); await sleep(400);
    const got = { swapped: R.split?.a === b && R.split?.b === a, leftNow: X(b) < X(a), gapKept: X(a) === gap, strip: R.tabs.indexOf(a) < R.tabs.indexOf(b) };
    return CHECK("swap: the two change sides, the gap where it was, the tab strip as it was", got.swapped && got.leftNow && got.gapKept && got.strip, got);` },
  { js: `const t = R.split.a; ITEM(t, "나란히 보기 끝내기")?.click(); await sleep(300);
    const other = R.tabs.find((x) => x !== R.active); const item = ITEM(other, "지금 탭과 나란히 보기");
    SRV.close();
    return CHECK("ended; another tab's menu still pairs it with the tab in front", R.split === null && !!item && item.enabled !== false, { split: R.split, item: !!item });` },
];
