// node test/drive.mjs test/address-typed.mjs: what typing in the address bar means, as Chrome reads
// it — an address goes there (a site with a real ending, localhost, an IP, http/https/file), anything
// else is a search: words, a file name like node.js or index.html (.js, .html are no site endings),
// a javascript: line. Then Enter in a real tab goes there. A local server, no network.
// Each line prints ok or FAIL.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);
globalThis.SEARCH = R.toUrl("zzqq").replace("zzqq", "");`;
export default [
  { js: H + `const go = { "example.com": "https://example.com", "news.ycombinator.com/item?id=1": "https://news.ycombinator.com/item?id=1", "foo.co.uk": "https://foo.co.uk", "test.ai": "https://test.ai", "readme.md": "https://readme.md",
      "localhost:3000/x": "http://localhost:3000/x", "192.168.0.1": "http://192.168.0.1", "app.localhost:5173": "https://app.localhost:5173", "https://a.b/c": "https://a.b/c", "  example.com  ": "https://example.com" };
    const got = {}; for (const [t, want] of Object.entries(go)) { const u = R.toUrl(t); if (u !== want) got[t] = u; }
    return CHECK("addresses go there", !Object.keys(got).length, got);` },
  { js: `const search = ["what is rove", "node.js", "index.html", "file.txt", "main.cjs", "e.g.", "3.14", "javascript:alert(1)", "Mr.Smith", "rove"];
    const got = {}; for (const t of search) { const u = R.toUrl(t); if (!u?.startsWith(SEARCH)) got[t] = u; }
    return CHECK("anything else is a search (words, file names, javascript:)", !Object.keys(got).length && R.toUrl("   ") === null, got);` },
  { js: `const SRV = process.mainModule.require("node:http").createServer((q, s) => { s.writeHead(200, { "content-type": "text/html" }); s.end("<title>here</title>"); });
    await new Promise((r) => SRV.listen(0, "127.0.0.1", r)); const at = "127.0.0.1:" + SRV.address().port + "/typed"; const t = R.active; R.go(at); await sleep(1200);
    const got = { url: t.view.webContents.getURL(), title: t.title }; SRV.close();
    return CHECK("Enter in a tab: it goes there", got.url === "http://" + at && got.title === "here", got);` },
];
