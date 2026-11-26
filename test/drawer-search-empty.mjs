// node test/drive.mjs test/drawer-search-empty.mjs: in the history and bookmarks drawer, a search that finds
// nothing says so with the search mark ("찾은 기록이 없어요"), as tab find and RobinPass do — not "기록이 없어요",
// which reads as if there were none at all; with nothing typed and nothing kept, the drawer's own empty line.
// Each line prints ok or FAIL.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);
globalThis.EMPTY = async (panel, typed) => { R.showOverlay({ kind: "drawer", panel }); await sleep(700);
  if (typed) await R.overlay.webContents.executeJavaScript("(() => { const q = document.querySelector('#q'); q.value = " + JSON.stringify(typed) + "; q.dispatchEvent(new Event('input')); })()");
  await sleep(300);
  const got = await R.overlay.webContents.executeJavaScript("(() => { const e = document.querySelector('.drawer .rk-empty'); return e ? { say: e.textContent, mark: e.querySelector('use')?.getAttribute('href') || '' } : null; })()");
  R.hideOverlay(); await sleep(300); return got; };`;
export default [
  { js: H + `R.history.push({ url: "https://example.com/a", title: "예시 쪽", at: Date.now() });
    const got = await EMPTY("history", "zzqx 없는 말");
    return CHECK("history, nothing found: 찾은 기록이 없어요 with the search mark", got && got.say === "찾은 기록이 없어요" && /search/.test(got.mark), got);` },
  { js: `R.bookmarks.push({ url: "https://example.com/b", title: "예시 별", at: Date.now() });
    const got = await EMPTY("bookmarks", "zzqx 없는 말");
    return CHECK("bookmarks, nothing found: 찾은 즐겨찾기가 없어요 with the search mark", got && got.say === "찾은 즐겨찾기가 없어요" && /search/.test(got.mark), got);` },
  { js: `R.history.length = 0; const got = await EMPTY("history", "");
    return CHECK("history, nothing kept and nothing typed: 기록이 없어요 with the clock", got && got.say === "기록이 없어요" && /clock/.test(got.mark), got);` },
];
