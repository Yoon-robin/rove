// node test/drive.mjs test/tabs-more.mjs: what docs/rove.md says is done, as a user meets it —
// 탭 찾기 (Ctrl+Shift+A: type, Enter goes to the tab; closed tabs found too, a private window's
// not in a normal one); pinned tabs (first, out of any group, a new tab after them); groups (kept
// together, folding the one in front brings the nearest other tab, closing a group closes its tabs);
// bookmarks from another browser (Chrome's profiles and Firefox's places.sqlite, made up in %TEMP%:
// web addresses only — no javascript: bookmarklet, no file: — and nothing twice).
// A local server in Rove's main process — no network. Each line prints ok or FAIL.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.FS = process.mainModule.require("node:fs");
globalThis.PATH = process.mainModule.require("node:path");
globalThis.SRV = process.mainModule.require("node:http").createServer((q, s) => { s.writeHead(200, { "content-type": "text/html" }); s.end("<title>" + decodeURIComponent(q.url.slice(1)) + "</title>"); });
await new Promise((r) => SRV.listen(0, "127.0.0.1", r));
globalThis.U = (t) => "http://127.0.0.1:" + SRV.address().port + "/" + t;
globalThis.OV = (js) => R.overlay.webContents.executeJavaScript(js);
globalThis.ROWS = () => OV("[...document.querySelectorAll('#tl .item b')].map((b) => b.textContent)");
globalThis.TYPE = async (q) => { await OV("(() => { const i = document.getElementById('tq'); i.value = " + JSON.stringify(q) + "; i.dispatchEvent(new Event('input')); })()"); await sleep(400); };
globalThis.KEY = (k) => OV("document.getElementById('tq').dispatchEvent(new KeyboardEvent('keydown', { key: " + JSON.stringify(k) + ", bubbles: true }))");
globalThis.NAMES = () => R.tabs.map((t) => t.title);
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);`;
export default [
  // 탭 찾기
  { js: H + `R.active.view.webContents.loadURL(U("alpha")).catch(() => {}); for (const n of ["beta", "gamma", "delta"]) R.newTab(U(n)); await sleep(1500);
    R.select(R.tabs[0]); R.showOverlay({ kind: "tabs", keyed: true }); await sleep(600);
    const all = await ROWS(); await TYPE("gam"); const found = await ROWS(); await KEY("Enter"); await sleep(500);
    return CHECK("탭 찾기: typed, Enter goes to that tab", all.length === 4 && JSON.stringify(found) === '["gamma"]' && R.active.title === "gamma" && !R.overlayOn, { all, found, front: R.active.title, open: !!R.overlayOn });` },
  { js: `R.closeTab(R.tabs.find((t) => t.title === "delta")); await sleep(300);
    R.showOverlay({ kind: "tabs", keyed: true }); await sleep(600); await TYPE("delta"); const found = await OV("[...document.querySelectorAll('#tl .item small')].map((s) => s.textContent)");
    await KEY("Escape"); R.hideOverlay(); await sleep(200);
    return CHECK("a closed tab is found too", found.length === 1 && found[0] === U("delta"), found);` },
  { js: `R.createWindow({ priv: true }); await sleep(1500); const p = R.windows.find((w) => w.private);
    p.tabs[0].view.webContents.loadURL(U("secret")).catch(() => {}); await sleep(800); R.use(p); R.newTab(U("other")); await sleep(600); R.closeTab(p.tabs.find((t) => t.url === U("secret"))); await sleep(300);
    R.use(R.windows[0]); R.showOverlay({ kind: "tabs", keyed: true }); await sleep(600); await TYPE("secret"); const found = await ROWS(); R.hideOverlay(); p.win.close(); await sleep(800);
    return CHECK("a private window's closed tab is not found from a normal window", found.length === 0, found);` },
  // pinned tabs
  { js: `R.use(R.windows[0]); const g = R.tabs.find((t) => t.title === "gamma"); R.pin(g); await sleep(200); const after = R.newTab(U("epsilon")); await sleep(500);
    const got = { order: NAMES(), first: R.tabs[0].pinned, newAt: R.tabs.indexOf(after) };
    R.pin(g); await sleep(200); got.unpinned = !g.pinned;
    return CHECK("a pinned tab goes first; a new tab after it; unpinned again", got.order[0] === "gamma" && got.first && got.newAt === R.tabs.length - 1 && got.unpinned, got);` },
  // groups
  { js: `const [a, b, c] = ["alpha", "beta", "epsilon"].map((n) => R.tabs.find((t) => t.title === n));
    const g = R.groupNew(a); R.groupAdd(c, g.id); await sleep(200);
    const ids = R.tabs.map((t) => t.group || 0); const members = R.tabs.filter((t) => t.group === g.id).map((t) => t.title);
    const together = ids.lastIndexOf(g.id) - ids.indexOf(g.id) === members.length - 1;
    R.pin(a); await sleep(200); const pinOut = a.group === null; R.pin(a); R.groupAdd(a, g.id); await sleep(200);
    return CHECK("a group's tabs stay together; pinning takes a tab out of it", together && members.length === 2 && pinOut, { order: NAMES(), members, pinOut });` },
  { js: `const g = R.groups[0]; const inside = R.tabs.find((t) => t.group === g.id); R.select(inside); await sleep(200);
    R.groupFold(g.id, true); await sleep(300); const front = R.active;
    const got = { folded: g.collapsed, frontOutside: front.group !== g.id, front: front.title };
    R.groupFold(g.id, false); R.groupClose(g.id); await sleep(500);
    got.left = NAMES(); got.groups = R.groups.length;
    return CHECK("folding the group in front brings another tab; closing it closes its tabs", got.folded && got.frontOutside && !got.left.includes("alpha") && !got.left.includes("epsilon") && got.groups === 0, got);` },
  // bookmarks from another browser
  { js: `const root = FS.mkdtempSync(PATH.join(process.env.TEMP || process.env.TMP, "rove-import-"));
    const ch = PATH.join(root, "Google", "Chrome", "User Data"); FS.mkdirSync(PATH.join(ch, "Default"), { recursive: true }); FS.mkdirSync(PATH.join(ch, "Profile 1"), { recursive: true });
    FS.writeFileSync(PATH.join(ch, "Local State"), JSON.stringify({ profile: { info_cache: { Default: { name: "Me" }, "Profile 1": { name: "Work" } } } }));
    const node = (name, url) => ({ type: "url", name, url });
    FS.writeFileSync(PATH.join(ch, "Default", "Bookmarks"), JSON.stringify({ roots: { bookmark_bar: { type: "folder", children: [node("Site A", "https://a.example/"), node("bookmarklet", "javascript:alert(document.cookie)"),
      { type: "folder", name: "deep", children: [node("Site B", "https://b.example/x?y=1"), node("a file", "file:///C:/Windows/win.ini"), node("Site A again", "https://a.example/")] }] }, other: { type: "folder", children: [] } }, version: 1 }));
    FS.writeFileSync(PATH.join(ch, "Profile 1", "Bookmarks"), JSON.stringify({ roots: { bookmark_bar: { type: "folder", children: [node("Work site", "https://w.example/")] } } }));
    const ff = PATH.join(root, "Mozilla", "Firefox"); const fp = PATH.join(ff, "Profiles", "x.default"); FS.mkdirSync(fp, { recursive: true });
    FS.writeFileSync(PATH.join(ff, "profiles.ini"), "[General]\\nStartWithLastProfile=1\\n\\n[Profile0]\\nName=default\\nIsRelative=1\\nPath=Profiles/x.default\\n");
    const { DatabaseSync } = process.mainModule.require("node:sqlite"); const db = new DatabaseSync(PATH.join(fp, "places.sqlite"));
    db.exec("CREATE TABLE moz_places (id INTEGER PRIMARY KEY, url TEXT); CREATE TABLE moz_bookmarks (id INTEGER PRIMARY KEY, type INTEGER, fk INTEGER, title TEXT, dateAdded INTEGER);" +
      "INSERT INTO moz_places VALUES (1, 'https://f.example/'), (2, 'javascript:void(0)'), (3, 'https://b.example/x?y=1');" +
      "INSERT INTO moz_bookmarks VALUES (1, 1, 1, 'Fox site', 3), (2, 1, 2, 'js', 2), (3, 1, 3, 'B in Firefox', 1), (4, 1, 1, NULL, 4);"); db.close();
    process.env.ROVE_IMPORT_ROOT = root; globalThis.IMPORT_ROOT = root;
    const src = R.importSources().map((s) => ({ id: s.id.replace(root, "~"), name: s.name, count: s.count }));
    const me = R.importSources().find((s) => s.name === "Chrome · Me"), fox = R.importSources().find((s) => s.name === "Firefox");
    const before = R.bookmarks.length; const r1 = R.importFrom(me?.id); const r2 = R.importFrom(me?.id); const r3 = R.importFrom(fox?.id);
    const urls = R.bookmarks.map((b) => b.url);
    delete process.env.ROVE_IMPORT_ROOT; FS.rmSync(root, { recursive: true, force: true });
    return CHECK("bookmarks from Chrome's profiles and Firefox: web addresses only, nothing twice", src.length === 3 && me?.count === 2 && fox?.count === 2 && r1.added === 2 && r2.added === 0 && r3.added === 1 &&
      R.bookmarks.length - before === 3 && !urls.some((u) => /^(javascript|file):/.test(u)) && urls.filter((u) => u === "https://b.example/x?y=1").length === 1, { src, r1, r2, r3, urls });` },
  { js: `SRV.close(); return undefined;` },
];
