// node test/drive.mjs test/private-engine.mjs: ≡ 검색엔진 › 비공개 창 picks the search engine of the
// private windows on its own, as Brave's settings › search (일반 창 / 비공개 윈도우). At first it is
// 일반 창과 같이: a private window searches with the normal one. Chosen, the private windows' address
// bar, new tab field and 찾아보기 use it, the normal windows keep theirs — also when a private tab is
// sent a search while a normal window is in front. No network (the search is stopped as it starts).
// Each line prints ok or FAIL.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);
globalThis.MENU = async () => { await R.win.webContents.executeJavaScript("rove.send('rove:engine-menu'), 1"); await sleep(300); return R.lastMenu || []; };
globalThis.SUB = (m) => m.find((i) => i.label === "비공개 창")?.submenu || [];
globalThis.CHECKED = (list) => list.filter((i) => i.type === "radio" && i.checked).map((i) => i.label);
globalThis.FIELD = () => R.active.view.webContents.executeJavaScript("document.getElementById('q').placeholder");`;
export default [
  { js: H + `globalThis.NORMAL = R.cur; globalThis.P = R.createWindow({ priv: true }); R.use(P); await sleep(1500);
    const m = await MENU(), u = R.toUrl("rove 브라우저");
    return CHECK("at first: 비공개 창 is 일반 창과 같이, a private window searches with Google", CHECKED(m).join() === "Google" && CHECKED(SUB(m)).join() === "일반 창과 같이" && u.startsWith("https://www.google.com/search?q="), { top: CHECKED(m), sub: CHECKED(SUB(m)), u });` },
  { js: `SUB(await MENU()).find((i) => i.label === "DuckDuckGo").click(); await sleep(1200); R.use(P); // the reloaded new tabs put their windows in use
    const u = R.toUrl("rove 브라우저"), field = await FIELD(), m = await MENU(), name = R.snapshot().engine;
    return CHECK("DuckDuckGo for private: its bar, its new tab field and ≡ say so; the normal choice still Google", u.startsWith("https://duckduckgo.com/?q=") && field === "DuckDuckGo 검색 또는 주소" && name === "DuckDuckGo" && CHECKED(m).join() === "Google" && CHECKED(SUB(m)).join() === "DuckDuckGo" && R.settings.privateEngine === "duckduckgo", { u, field, name, top: CHECKED(m), sub: CHECKED(SUB(m)) });` },
  { js: `const pt = P.active; R.use(NORMAL); const u = R.toUrl("rove 브라우저"), name = R.snapshot().engine;
    R.go("?zebra private", pt); const sent = pt.url; pt.view.webContents.loadURL("about:blank").catch(() => {});
    return CHECK("a normal window keeps Google; a private tab sent a search from it uses DuckDuckGo", u.startsWith("https://www.google.com/search?q=") && name === "Google" && sent.startsWith("https://duckduckgo.com/?q=zebra"), { u, name, sent });` },
  { js: `(await MENU()).find((i) => i.label === "Naver").click(); await sleep(300); R.use(P); const priv = R.toUrl("x y"); R.use(NORMAL); const norm = R.toUrl("x y");
    return CHECK("the normal engine changed: private stays DuckDuckGo", priv.startsWith("https://duckduckgo.com/") && norm.startsWith("https://search.naver.com/"), { priv, norm });` },
  { js: `R.use(P); SUB(await MENU()).find((i) => i.label === "일반 창과 같이").click(); await sleep(1200); const u = R.toUrl("x y"), field = await FIELD();
    return CHECK("일반 창과 같이 again: private follows the normal one (Naver), nothing kept for it", u.startsWith("https://search.naver.com/") && field === "Naver 검색 또는 주소" && !("privateEngine" in R.settings), { u, field, settings: R.settings.privateEngine });` },
];
