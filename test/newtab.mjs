// node test/drive.mjs test/newtab.mjs: a new tab is Rove's own page (rove://ui/newtab.html): the
// address bar stays empty, the field says the search engine, the sites gone to most come as tiles
// (none in a private window, which says instead what it keeps and what it does not, as Brave's), config.cjs's links under them, and what is typed goes as the address
// bar would. A web page cannot read newtab.json, get our other files or use go?q= to reach file:.
// The engine chosen in ≡ is what the address bar searches with. Needs the network (example.com).
// Each line prints ok or FAIL.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.PAGE = (js) => R.active.view.webContents.executeJavaScript(js);
globalThis.NT = () => PAGE("({ q: document.getElementById('q').placeholder, sites: [...document.querySelectorAll('#sites a')].map((a) => a.textContent), links: [...document.querySelectorAll('#links a')].map((a) => a.textContent), sitesShown: !document.getElementById('sites').hidden, priv: !document.getElementById('private').hidden, privText: document.getElementById('private').textContent })");
globalThis.ADDR = () => R.win.webContents.executeJavaScript("document.getElementById('url').value");
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);`;
export default [
  { js: H + `for (const [u, n] of [["https://a.example/", 5], ["https://b.example/x", 3], ["https://c.example/", 1]]) for (let i = 0; i < n; i++) R.history.push({ url: u, title: u, at: Date.now() - i * 3600e3 });
    R.newTab(); await sleep(1500); const d = await NT(), url = R.active.view.webContents.getURL(), addr = await ADDR();
    return CHECK("new tab: our page, empty address, Google field, tiles by visits, six links", url === "rove://ui/newtab.html" && addr === "" && R.active.title === "새 탭" && d.q === "Google 검색 또는 주소" && d.sites.join() === "a.example,b.example,c.example" && d.links.join() === "Home,Mail,Cloud,Pass,AI,Get" && !d.priv, { url, addr, title: R.active.title, d });` },
  { js: `await PAGE("document.getElementById('q').value = 'example.com', document.getElementById('find').requestSubmit(), 1"); await sleep(2500);
    const url = R.active.view.webContents.getURL(); return CHECK("typed and Enter: as the address bar (an address goes there)", url === "https://example.com/", url);` },
  { js: `const got = await PAGE("fetch('rove://ui/newtab.json').then((r) => r.text()).then((t) => 'read ' + t.length, (e) => 'refused')");
    return CHECK("a web page cannot read newtab.json", got === "refused", got);` },
  { js: `const before = R.active.view.webContents.getURL(); await PAGE("location.href = 'rove://ui/go?q=' + encodeURIComponent('file:///C:/Windows/win.ini'), 1"); await sleep(1500);
    const url = R.active.view.webContents.getURL(); return CHECK("go?q= from a web page: not file:", !url.startsWith("file:"), url);` },
  { js: `R.go("about:blank"); await sleep(300); R.active.view.webContents.loadURL("rove://ui/index.html").catch(() => {}); await sleep(1200);
    const t = await PAGE("document.getElementById('url') ? 'served' : 'not'"); return CHECK("our other files: not served to a tab", t === "not", t);` },
  { js: `R.settings.engine = "naver"; R.newTab(); await sleep(1500); const d = await NT(), u = R.toUrl("rove 브라우저");
    return CHECK("engine naver: the field and the address bar's search", d.q === "Naver 검색 또는 주소" && u.startsWith("https://search.naver.com/search.naver?query="), { q: d.q, u });` },
  { js: `R.createWindow({ priv: true }); await sleep(1500); const p = R.windows.find((w) => w.private); R.select(p.tabs[0]); await sleep(800);
    const d = await NT(); return CHECK("private window: no tiles, what it keeps and does not, the links still", !d.sitesShown && d.sites.length === 0 && d.links.length === 6 && d.priv && /방문 기록에 남지 않아요/.test(d.privText) && /내려받은 파일과 즐겨찾기는 남아요/.test(d.privText), d);` },
];
