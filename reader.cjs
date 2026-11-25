// Reading mode (robin 2026-11-25 "rove 다음 버전"): Mozilla's Readability
// (Apache-2.0, node_modules/@mozilla/readability; a release has the two files
// in readability/) runs in an isolated world of the page (its scripts never
// see it) and gives the article back. The article is shown as a data: page
// that runs no script (its CSP) in the same tab: Back goes to the page.
const { existsSync, readFileSync } = require("node:fs");
const { join } = require("node:path");

const WORLD = 1003;
function source(name) {
  const one = join(__dirname, "readability", name);
  return readFileSync(existsSync(one) ? one : join(__dirname, "node_modules", "@mozilla", "readability", name), "utf8");
}
let srcRead = null;
let srcAble = null;

// is this page an article? (cheap: Readability's own quick look)
async function readable(wc) {
  srcAble ??= source("Readability-readerable.js");
  try {
    return !!(await wc.executeJavaScriptInIsolatedWorld(WORLD, [{ code: `${srcAble}\n;isProbablyReaderable(document)` }]));
  } catch { return false; }
}

async function article(wc) {
  srcRead ??= source("Readability.js");
  const code = `${srcRead}
;(() => {
  const a = new Readability(document.cloneNode(true), { charThreshold: 300 }).parse();
  return a && a.content ? { title: a.title || document.title, byline: a.byline || "", site: a.siteName || location.hostname, content: a.content,
    lang: document.documentElement.lang || "", dir: a.dir || "", length: a.length || 0 } : null;
})()`;
  try { return await wc.executeJavaScriptInIsolatedWorld(WORLD, [{ code }]); } catch { return null; }
}

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
// the page: V5's colours, a reading measure; nothing runs, nothing but pictures loads
function page(a, url) {
  const minutes = Math.max(1, Math.round((a.length || 0) / 600));
  return `<!doctype html><html lang="${esc(a.lang)}"${a.dir ? ` dir="${esc(a.dir)}"` : ""}><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: http: data:; media-src https: http:; style-src 'unsafe-inline'">
<meta name="referrer" content="no-referrer"><meta name="color-scheme" content="dark"><title>${esc(a.title)}</title>
<style>
:root{--page:#0e1012;--head:#f0f0f0;--text:#d9dbde;--soft:#8a8e94;--line:#22252a;--hover:#15181b;--accent:#7a9dff}
html{background:var(--page)}body{margin:0;color:var(--text);font:450 18px/1.8 "Pretendard Variable",Pretendard,"Malgun Gothic","Segoe UI",sans-serif;word-break:keep-all;overflow-wrap:break-word}
main{max-width:680px;margin:0 auto;padding:56px 24px 96px}
header{margin-bottom:40px;padding-bottom:28px;border-bottom:1px solid var(--line)}
.site{display:block;margin-bottom:14px;color:var(--soft);font-size:13px;font-weight:550;letter-spacing:.01em;text-decoration:none}
.site:hover{color:var(--head)}
h1.t{margin:0;color:var(--head);font-size:32px;line-height:1.3;font-weight:700;letter-spacing:-.01em}
.by{margin:14px 0 0;color:var(--soft);font-size:14px;line-height:1.6}
h1,h2,h3,h4{color:var(--head);line-height:1.35;font-weight:650}h2{font-size:24px;margin:2em 0 .6em}h3{font-size:20px;margin:1.8em 0 .5em}
p,ul,ol,figure,blockquote,pre,table{margin:0 0 1.2em}
a{color:var(--accent);text-decoration:underline;text-decoration-color:rgb(122 157 255 / 40%);text-underline-offset:3px}a:hover{text-decoration-color:currentColor}
img,video,svg{max-width:100%;height:auto;border-radius:7px}figure{margin:1.6em 0}figcaption{margin-top:8px;color:var(--soft);font-size:14px;line-height:1.6}
blockquote{margin-left:0;padding-left:18px;border-left:2px solid var(--line);color:var(--soft)}
pre,code{font:14px/1.6 Consolas,"D2Coding",monospace}pre{padding:14px 16px;border-radius:7px;background:var(--hover);overflow-x:auto}:not(pre)>code{padding:1px 5px;border-radius:5px;background:var(--hover)}
table{border-collapse:collapse;display:block;overflow-x:auto}td,th{padding:6px 10px;border:1px solid var(--line);text-align:left}
hr{border:0;border-top:1px solid var(--line);margin:2em 0}::selection{background:rgb(75 125 254 / 30%)}
</style></head><body><main><header><a class="site" href="${esc(url)}">${esc(a.site)} · ${minutes}분</a><h1 class="t">${esc(a.title)}</h1>${a.byline ? `<p class="by">${esc(a.byline)}</p>` : ""}</header>
<article>${clean(a.content)}</article></main></body></html>`;
}
// what a page could still do without script: go somewhere by itself, or post a form
const clean = (html) => String(html).replace(/<\/?(meta|base|link|form|iframe|frame|object|embed|script|noscript|style)\b[^>]*>/gi, "");

// Chromium takes an address of up to 2 MB
function dataUrl(html) {
  const u = "data:text/html;charset=utf-8;base64," + Buffer.from(html, "utf8").toString("base64");
  return u.length < 2 * 1024 * 1024 ? u : null;
}
const isReader = (url) => typeof url === "string" && url.startsWith("data:text/html;charset=utf-8;base64,");

module.exports = { readable, article, page, dataUrl, isReader };
