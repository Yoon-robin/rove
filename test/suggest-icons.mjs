// node test/drive.mjs test/suggest-icons.mjs: in the address bar's suggestions a history row shows the site's
// kept icon and a 탭으로 전환 row the tab's own (as Chrome's), a bookmark row keeps its star. Uses the network
// (Wikipedia). Each line prints ok or FAIL.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);
globalThis.TYPE = async (q) => { await R.win.webContents.executeJavaScript("(() => { const u = document.getElementById('url'); u.dispatchEvent(new FocusEvent('focus')); u.value = " + JSON.stringify(q) + "; u.dispatchEvent(new Event('input')); return 1; })()"); await sleep(1200);
  return R.overlay.webContents.executeJavaScript("[...document.querySelectorAll('.suggest a')].map((a) => ({ text: a.querySelector('b').textContent, img: a.querySelector(':scope > img.fav')?.src.slice(0, 11) || '', mark: a.querySelector(':scope > svg use')?.getAttribute('href').replace('icons.svg#rk-i-', '') || '' }))"); };`;
export default [
  { js: H + `R.win.setContentSize(1100, 700); R.go("https://en.wikipedia.org/wiki/Seoul"); await sleep(5000);
    R.go("https://www.wikipedia.org/"); await sleep(4000); R.star(); await sleep(300);
    R.newTab("https://en.wikipedia.org/wiki/Busan"); await sleep(5000); R.select(R.tabs[0]); await sleep(500);
    R.go("about:blank"); await sleep(800); return R.tabs.map((t) => t.url);` },
  { js: `const rows = await TYPE("wiki"), seoul = rows.find((r) => r.text.startsWith("Seoul")), busan = rows.find((r) => r.text.startsWith("Busan")), star = rows.find((r) => r.text === "Wikipedia");
    return CHECK("history and tab rows: the site's icon; bookmark: its star", seoul?.img === "data:image/" && busan?.img === "data:image/" && star?.mark === "star", rows);` },
];
