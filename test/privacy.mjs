// node test/drive.mjs test/privacy.mjs: what Rove does for privacy at the request (docs/rove.md,
// "링크의 추적 꼬리 떼기, GPC 신호"): a page or a frame opened with a click id (fbclid, gclid…)
// comes without it, the rest of the address as written; every request says Sec-GPC: 1; a site let
// be (막기 끔 for it) keeps its address; with blocking off, neither; a private window does the same.
// Needs lists.bin (node tools/lists.cjs): without it Rove starts no blocker at all. A local server
// in Rove's main process sees the requests — no network. Each line prints ok or FAIL.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.CLEAN = process.mainModule.require("./blocker.cjs").clean;
globalThis.SEEN = [];
globalThis.SRV = process.mainModule.require("node:http").createServer((q, s) => {
  SEEN.push({ url: q.url, gpc: q.headers["sec-gpc"] || null, method: q.method, ua: q.headers["user-agent"] || "" });
  if (q.url.startsWith("/page")) { s.writeHead(200, { "content-type": "text/html" });
    return s.end('<title>p</title><iframe src="/frame?x=2&gclid=g"></iframe><img src="/img?n=1">'); }
  // a page with an icon: /icon?<file> — the icon kept in the cache a long time
  if (q.url.startsWith("/icon?")) { s.writeHead(200, { "content-type": "text/html" }); return s.end('<title>i</title><link rel="icon" href="/' + q.url.slice(6) + '">'); }
  if (q.url.startsWith("/fav.png")) { s.writeHead(200, { "content-type": "image/png", "cache-control": "max-age=99999" });
    return s.end(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64")); }
  if (q.url.startsWith("/fav.ico")) { s.writeHead(200, { "content-type": "application/octet-stream" }); return s.end(Buffer.from([0, 0, 1, 0, 1, 0, 1, 1, 0, 0, 1, 0, 32, 0])); }
  s.writeHead(200, { "content-type": "text/html" }); s.end("ok");
});
await new Promise((r) => SRV.listen(0, "127.0.0.1", r));
globalThis.BASE = "http://127.0.0.1:" + SRV.address().port;
globalThis.VISIT = async (tab, path) => { SEEN.length = 0; tab.view.webContents.loadURL(BASE + path).catch(() => {}); await sleep(1200); return SEEN.slice(); };
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);`;
export default [
  { js: H + `return CHECK("lists.bin read (the blocker is on)", !!R.blocker && R.settings.block === true, { blocker: !!R.blocker, block: R.settings.block });` },
  { js: `const cases = [
      ["https://a.test/?a=1&fbclid=x&b=2#h", "https://a.test/?a=1&b=2#h"],
      ["https://a.test/?FBCLID=x", "https://a.test/"],
      ["https://a.test/?gclid=1&utm_source=n", "https://a.test/?utm_source=n"],
      ["https://a.test/#?fbclid=x", "https://a.test/#?fbclid=x"],
      ["https://a.test/?q=fbclid", "https://a.test/?q=fbclid"],
      ["https://a.test/?%66bclid=x&k", "https://a.test/?k"],
    ];
    const bad = cases.map(([i, o]) => [i, CLEAN(i), o]).filter(([, g, o]) => g !== o);
    return CHECK("clean(): click ids only, the rest as written", bad.length === 0, bad);` },
  { js: `const seen = await VISIT(R.active, "/page?a=1&fbclid=x&b=2#h");
    const page = seen.find((x) => x.url.startsWith("/page")), frame = seen.find((x) => x.url.startsWith("/frame")), img = seen.find((x) => x.url.startsWith("/img"));
    const at = R.active.view.webContents.getURL();
    return [
      CHECK("the page comes without fbclid", page?.url === "/page?a=1&b=2" && at === BASE + "/page?a=1&b=2#h", { asked: page?.url, at }),
      CHECK("its frame comes without gclid", frame?.url === "/frame?x=2", frame?.url),
      CHECK("Sec-GPC: 1 on the page, the frame and a picture", [page, frame, img].every((x) => x?.gpc === "1"), seen),
      CHECK("nothing asked with the click id", !seen.some((x) => /fbclid|gclid/.test(x.url)), seen.map((x) => x.url)),
    ].join("\\n");` },
  { js: `R.setBlock(false, BASE + "/"); const seen = await VISIT(R.active, "/page?fbclid=x");
    R.setBlock(true, BASE + "/");
    return CHECK("a site let be keeps its address", seen.some((x) => x.url === "/page?fbclid=x") && R.settings.allow.length === 0, seen.map((x) => x.url));` },
  { js: `R.setBlock(false); const seen = await VISIT(R.active, "/page?fbclid=x"); R.setBlock(true);
    return CHECK("blocking off: no cleaning, no Sec-GPC", seen.some((x) => x.url === "/page?fbclid=x") && seen.every((x) => x.gpc === null) && R.settings.block === true, seen);` },
  { js: `R.createWindow({ priv: true }); await sleep(1500); const p = R.windows.find((w) => w.private);
    const seen = p ? await VISIT(p.tabs[0], "/page?fbclid=x&k=1") : [];
    const page = seen.find((x) => x.url.startsWith("/page"));
    const got = { private: !!p, session: p ? p.tabs[0].view.webContents.session === R.privateSes : null, page };
    p?.win.close(); await sleep(500);
    return CHECK("a private window: the same", got.private && got.session && page?.url === "/page?k=1" && page?.gpc === "1", got);` },
  // the tab strip shows a page's icon: it used to be an <img> in the bar, asked through the bar's
  // session — on disk, with Electron in its name, no Sec-GPC, past the blocker — so a private
  // window's icons stayed in a cache that outlives it
  { js: `R.createWindow({ priv: true }); await sleep(1500); const p = R.windows.find((w) => w.private);
    const seen = await VISIT(p.tabs[0], "/icon?fav.png?secret"); await sleep(500);
    const fav = seen.filter((x) => x.url.startsWith("/fav.png")), icon = p.tabs[0].favicon;
    p.win.close(); await sleep(800);
    return CHECK("a private window's icon: through its own session, to the bar as data:", fav.length === 1 && fav[0].gpc === "1" && !/Electron/.test(fav[0].ua) && /^data:image\\/png;base64,/.test(icon || ""), { fav, icon: (icon || "").slice(0, 30) });` },
  { js: `const seen = await VISIT(R.active, "/icon?fav.png?secret"); await sleep(500);
    return CHECK("…and a normal window asks for it again (nothing of it was kept)", seen.some((x) => x.url === "/fav.png?secret"), seen.map((x) => x.url));` },
  { js: `await VISIT(R.active, "/icon?fav.ico"); await sleep(500); const ico = R.active.favicon;
    await VISIT(R.active, "/icon?frame"); await sleep(500); const notImage = R.active.favicon;
    return CHECK("an .ico sent as octet-stream still shows; a page that is no picture does not", /^data:image\\/x-icon;base64,/.test(ico || "") && notImage === null, { ico: (ico || "").slice(0, 30), notImage });` },
  { js: `SRV.close(); return undefined;` },
];
