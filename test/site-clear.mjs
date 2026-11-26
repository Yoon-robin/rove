// node test/drive.mjs test/site-clear.mjs: "사이트 데이터 지우기" clears the site in front only —
// its cookies, storage and cached files — and leaves the other sites' cache, as in Chrome (it used
// to empty the whole cache). Needs the network (example.com, example.org). Each line prints ok or FAIL.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.SES = () => R.session();
globalThis.HITS = [];
SES().webRequest.onCompleted({ urls: ["https://example.org/*", "https://example.com/*"] }, (d) => { if (d.resourceType === "mainFrame") HITS.push({ host: new URL(d.url).host, cache: d.fromCache }); });
globalThis.LOAD = async (url) => { HITS.length = 0; await R.active.view.webContents.loadURL(url).catch(() => {}); await sleep(600); return HITS.slice(-1)[0]; };
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);`;
export default [
  { js: H + `await LOAD("https://example.org/"); await LOAD("https://example.com/");
    const again = await LOAD("https://example.org/"); await LOAD("https://example.com/"); await R.active.view.webContents.executeJavaScript("localStorage.setItem('k', '1'), 1");
    return "cached first: " + JSON.stringify(again) + " size " + (await SES().getCacheSize());` },
  // the page loads again after the clear: that load is not from the cache; the other site still is
  { js: `HITS.length = 0; const said = await R.clearSite(); await sleep(1500); const mine = HITS.find((h) => h.host === "example.com");
    const kept = await R.active.view.webContents.executeJavaScript("localStorage.getItem('k')");
    return CHECK("the site's own cache and storage go", said?.ok && mine?.cache === false && kept === null, { said, mine, kept });` },
  { js: `const other = await LOAD("https://example.org/");
    return CHECK("another site's cache stays", other?.cache === true, { other });` },
];
