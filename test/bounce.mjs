// node test/drive.mjs test/bounce.mjs: a link through a bounce tracker (Brave's debounce list,
// bounce.json) goes straight to where it was sent, as Brave does by default — the tracker's own
// address is never asked for. Not to the same site, not to anything but http(s), not where the
// address names another site than it parses to. (Off for the tracker's site is the same skip() line
// as click ids, not tried here: that would ask the real tracker.)
// Network: example.com (the tracker is never reached). Each line prints ok or FAIL.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);
globalThis.TRACK = "https://app.adjust.com/abc?redirect=" + encodeURIComponent("https://example.com/?from=rove");
globalThis.OPEN = async (url) => {
  const wc = R.active.view.webContents; const seen = [];
  const f = (e, u, inPlace, main) => { if (main) seen.push(u); };
  wc.on("did-redirect-navigation", f); wc.on("did-start-navigation", f);
  R.go(url); for (let i = 0; i < 60 && wc.getURL() !== "https://example.com/?from=rove"; i++) await sleep(250);
  await sleep(300); wc.off("did-redirect-navigation", f); wc.off("did-start-navigation", f); return seen;
};
const need = process.mainModule.require("node:module").createRequire(process.mainModule.require("electron").app.getAppPath() + "/main.cjs");
const { getDomain } = need("tldts");
globalThis.UB = need("./blocker.cjs").bouncer(need("./bounce.json"), (h) => getDomain(h));`;
export default [
  { js: H + `await sleep(800); const seen = await OPEN(TRACK);
    return CHECK("a tracker's link opens the page it was sent to", R.active.view.webContents.getURL() === "https://example.com/?from=rove" && seen.length === 2, { url: R.active.view.webContents.getURL(), seen });` },
  { js: `const at = (to) => UB("https://app.adjust.com/abc?redirect=" + encodeURIComponent(to));
    const got = { same: at("https://www.adjust.com/x"), js: at("javascript:alert(1)"), file: at("file:///C:/x"), trick: at("https://good.com\\\\@evil.com/"), ip: at("http://10.0.0.1/"), none: UB("https://app.adjust.com/abc"), other: UB("https://example.com/?redirect=https%3A%2F%2Fexample.org%2F") };
    return CHECK("not to the same site, not javascript:·file:·an IP, not a host written one way and parsed another, not off the list", Object.values(got).every((v) => v === null), got);` },
  { js: `const got = { b64: UB("https://x.lt.acemlna.com/Prod/link-tracker?redirectUrl=" + Buffer.from("https://example.org/p").toString("base64url")), path: UB("https://click.redditmail.com/CL0/" + encodeURIComponent("https://example.org/q?a=1") + "/1/x"), tmpl: UB("https://y2u.be/abc123") };
    return CHECK("base64, path and template rules", got.b64 === "https://example.org/p" && got.path === "https://example.org/q?a=1" && got.tmpl === "https://www.youtube.com/watch?v=abc123", got);` },
];
