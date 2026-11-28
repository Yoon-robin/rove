// Ads and trackers, stopped before they load (robin 2026-11-24 "Rove 다음
// 버전"). The engine is Ghostery's (@ghostery/adblocker, MPL-2.0); the lists
// come made (lists.bin, tools/lists.cjs, fresh with every release), so Rove
// asks nothing of the web for them. Only requests are matched: no script or
// style goes into a page (pages keep getting nothing of ours).
const { existsSync, readFileSync } = require("node:fs");
const { dirname, join } = require("node:path");

// a release has the engine as one file (scripts/release-rove.mjs); the repo, as the package
function lib() {
  const one = join(__dirname, "adblock.cjs");
  return existsSync(one) ? require(one) : require("@ghostery/adblocker");
}

// Electron's resource types in the engine's words
const TYPES = { mainFrame: "main_frame", subFrame: "sub_frame", stylesheet: "stylesheet", script: "script", image: "image", font: "font",
  object: "object", xhr: "xmlhttprequest", ping: "ping", cspReport: "csp_report", media: "media", webSocket: "websocket", other: "other" };

// What an ad or a mail adds to a link to follow the click (Brave's and
// Firefox's lists). A page opened (or framed) with one comes without it.
const CLICK_IDS = new Set(["fbclid", "gclid", "gclsrc", "dclid", "gbraid", "wbraid", "msclkid", "mc_eid", "yclid", "twclid", "ttclid", "igshid", "igsh",
  "li_fat_id", "_hsenc", "_hsmi", "__hssc", "__hstc", "__hsfp", "hsctatracking", "mkt_tok", "oly_anon_id", "oly_enc_id", "rb_clickid", "s_cid",
  "vero_conv", "vero_id", "wickedid", "_openstat", "ml_subscriber", "ml_subscriber_hash", "srsltid", "epik", "ss_email_id", "bsft_clkid", "bsft_uid"]);
function clean(url) {
  const q = url.indexOf("?");
  const hash = url.indexOf("#");
  if (q < 0 || (hash >= 0 && hash < q)) return url;
  const h = url.indexOf("#", q);
  const search = url.slice(q + 1, h < 0 ? undefined : h);
  const key = (part) => { try { return decodeURIComponent(part.split("=")[0].replace(/\+/g, " ")).toLowerCase(); } catch { return ""; } };
  const parts = search.split("&");
  const kept = parts.filter((p) => !CLICK_IDS.has(key(p)));
  if (kept.length === parts.length) return url;
  // the rest stays as it was written
  return url.slice(0, q) + (kept.length ? "?" + kept.join("&") : "") + (h < 0 ? "" : url.slice(h));
}

// Bounce trackers: a link that goes through a tracker's address only to be sent
// on (ad and shop links in mail and news) goes straight to where it was sent,
// as Brave's debouncer does by default. The rules are Brave's list
// (brave/adblock-lists debounce.json, MPL-2.0), fetched as bounce.json with
// lists.bin; what is done with them is ours. Safety as there: only to http(s),
// never to the same site, and the site the address names must be the one it
// parses to. site(host): the host's registrable domain (tldts' getDomain).
function glob(s) { return s.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*"); }
// a match pattern (scheme://host/path, the path with its query) as a regex
function pattern(p) {
  const m = /^(\*|https?):\/\/(\*|(?:\*\.)?[^/*]+)(\/.*)$/.exec(p);
  if (!m) return null;
  const scheme = m[1] === "*" ? "https?" : m[1];
  const host = m[2] === "*" ? "[^/]+" : m[2].startsWith("*.") ? "(?:[^/]+\\.)?" + glob(m[2].slice(2)) : glob(m[2]);
  return new RegExp(`^${scheme}://${host}(?::\\d+)?${glob(m[3])}$`, "i");
}
function bouncer(rules, site) {
  const ACTIONS = new Set(["redirect", "base64,redirect", "regex-path", "regex-path-template"]);
  const list = (Array.isArray(rules) ? rules : []).filter((r) => ACTIONS.has(r?.action) && typeof r.param === "string").map((r) => ({
    ...r, inc: (r.include || []).map(pattern).filter(Boolean), exc: (r.exclude || []).map(pattern).filter(Boolean),
  }));
  const target = (r, u) => {
    if (r.action === "redirect" || r.action === "base64,redirect") {
      const v = u.searchParams.get(r.param);
      if (!v) return null;
      if (r.action === "redirect") return v;
      try { return Buffer.from(v.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"); } catch { return null; }
    }
    let m;
    try { m = new RegExp(r.param).exec(u.pathname); } catch { return null; }
    if (!m || m.length < 2) return null;
    const groups = m.slice(1);
    const v = r.action === "regex-path" ? groups.join("") : (r.redirect_url_template || "").replace(/\$([1-9])/g, (_, i) => groups[i - 1] ?? "");
    try { return decodeURIComponent(v.replace(/\+/g, " ")); } catch { return null; }
  };
  return (url) => {
    let u;
    try { u = new URL(url); } catch { return null; }
    for (const r of list) {
      if (!r.inc.some((x) => x.test(url)) || r.exc.some((x) => x.test(url))) continue;
      let to = target(r, u);
      if (!to) continue;
      if (r.prepend_scheme && !/^https?:\/\//i.test(to)) to = `${r.prepend_scheme}://${to}`;
      let t;
      try { t = new URL(to); } catch { continue; }
      if (!/^https?:$/.test(t.protocol)) continue;
      // "https://good.example\@evil.example" and the like: the host written must be the host
      const named = /^https?:\/\/([^/?#:\\@]+)(?=[/?#:]|$)/i.exec(to)?.[1]?.toLowerCase();
      if (named !== t.hostname) continue;
      const d = site(t.hostname);
      if (!d || d === site(u.hostname)) continue;
      return t.href;
    }
    return null;
  };
}

// ses: the pages' session. on(): blocking is on. skip(pageUrl): the page's site is let be.
// counted(webContentsId): one more stopped there. site(host): registrable domain.
// upgrade(details): the https address for a page asked over http, or null (main.cjs httpsFirst).
// Returns null without lists.bin.
const engines = new Map(); // lists file: its engine (matching only reads it)
function start({ ses, file, on, skip, counted, log, site, upgrade = () => null }) {
  if (!existsSync(file)) { log("광고·추적 막기: lists.bin이 없어요"); return null; }
  const bounceFile = join(dirname(file), "bounce.json");
  let unbounce = () => null;
  try { unbounce = bouncer(JSON.parse(readFileSync(bounceFile, "utf8")), site); } catch (err) { log(`추적 주소 건너뛰기 못 켬: ${err.message}`); }
  const { FiltersEngine, Request } = lib();
  // one engine for every session: each private window's session is new and Electron never
  // frees a session, so an engine apiece kept another copy of the lists (7 MB) per window
  let engine = engines.get(file);
  if (!engine) {
    const t0 = Date.now();
    engine = FiltersEngine.deserialize(readFileSync(file));
    engines.set(file, engine);
    log(`광고·추적 막기: 목록 읽음 (${Date.now() - t0}ms)`);
  }
  const page = (d) => {
    try { return d.webContents?.getURL() || ""; } catch { return ""; }
  };
  const frame = (d) => {
    try { return d.frame?.url || ""; } catch { return ""; }
  };
  ses.webRequest.onBeforeRequest({ urls: ["http://*/*", "https://*/*", "ws://*/*", "wss://*/*"] }, (d, done) => {
    if (!on()) return done({});
    if (d.resourceType === "mainFrame" || d.resourceType === "subFrame") {
      if (d.method !== "GET" || skip(d.url)) return done({});
      // a tracker's own address only in the address bar's place (a frame keeps its page's links)
      const to = (d.resourceType === "mainFrame" && (unbounce(d.url) || upgrade(d))) || clean(d.url);
      return done(to !== d.url ? { redirectURL: to } : {});
    }
    const top = page(d);
    if (skip(top)) return done({});
    let r;
    try {
      r = engine.match(Request.fromRawDetails({ url: d.url, sourceUrl: frame(d) || top || d.referrer || "", type: TYPES[d.resourceType] || "other" }));
    } catch { return done({}); }
    if (r.redirect) { counted(d.webContentsId); return done({ redirectURL: r.redirect.dataUrl }); }
    if (r.match) { counted(d.webContentsId); return done({ cancel: true }); }
    done({});
  });
  // Global Privacy Control: "do not sell or share" (the law in some places honours it). And a
  // request to another site carries only the page's site, as Brave caps it: a page may ask for
  // its whole address to go along (referrer unsafe-url), search words and ids with it. A site let
  // be (막기 끔) keeps what it asks for, as with Shields down.
  const siteOfUrl = (u) => { try { const h = new URL(u).hostname; return site(h) || h; } catch { return ""; } };
  ses.webRequest.onBeforeSendHeaders((d, done) => {
    if (!on()) return done({});
    const headers = { ...d.requestHeaders, "Sec-GPC": "1" };
    const ref = headers.Referer;
    if (ref && !skip(page(d)) && siteOfUrl(ref) !== siteOfUrl(d.url)) {
      try { headers.Referer = new URL(ref).origin + "/"; } catch { delete headers.Referer; }
    }
    done({ requestHeaders: headers });
  });
  return engine;
}

module.exports = { start, clean, bouncer };
