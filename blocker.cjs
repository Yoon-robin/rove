// Ads and trackers, stopped before they load (robin 2026-11-24 "Rove 다음
// 버전"). The engine is Ghostery's (@ghostery/adblocker, MPL-2.0); the lists
// come made (lists.bin, tools/lists.cjs, fresh with every release), so Rove
// asks nothing of the web for them. Only requests are matched: no script or
// style goes into a page (pages keep getting nothing of ours).
const { existsSync, readFileSync } = require("node:fs");
const { join } = require("node:path");

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

// ses: the pages' session. on(): blocking is on. skip(pageUrl): the page's site is let be.
// counted(webContentsId): one more stopped there. Returns null without lists.bin.
function start({ ses, file, on, skip, counted, log }) {
  if (!existsSync(file)) { log("광고·추적 막기: lists.bin이 없어요"); return null; }
  const { FiltersEngine, Request } = lib();
  const t0 = Date.now();
  const engine = FiltersEngine.deserialize(readFileSync(file));
  log(`광고·추적 막기: 목록 읽음 (${Date.now() - t0}ms)`);
  const page = (d) => {
    try { return d.webContents?.getURL() || ""; } catch { return ""; }
  };
  const frame = (d) => {
    try { return d.frame?.url || ""; } catch { return ""; }
  };
  ses.webRequest.onBeforeRequest({ urls: ["http://*/*", "https://*/*", "ws://*/*", "wss://*/*"] }, (d, done) => {
    if (!on()) return done({});
    if (d.resourceType === "mainFrame" || d.resourceType === "subFrame") {
      const to = d.method === "GET" && !skip(d.url) ? clean(d.url) : d.url;
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
  // Global Privacy Control: "do not sell or share" (the law in some places honours it)
  ses.webRequest.onBeforeSendHeaders((d, done) => done(on() ? { requestHeaders: { ...d.requestHeaders, "Sec-GPC": "1" } } : {}));
  return engine;
}

module.exports = { start, clean };
