// Rove (robin 2026-11-24 "우리만의 브라우저", D-070 "Electron으로"): one
// window, our own top (tabs and the toolbar, ui/index.html) and each tab's
// page in a WebContentsView under it. Menus, the address suggestions and the
// drawers (history, bookmarks, downloads) are drawn by a see-through view
// laid over the window only while one is open (ui/overlay.html).
//
// Pages get nothing of ours: their own sandboxed renderer, the session
// "persist:rove" (where rove:// is only the new tab and what it uses, and no page
// can go to it, frame it or open it: wire()), no preload of ours (1.2: the
// extension libraries' two, see extensions.cjs). Only our two
// views have the preload, and every message is checked to come from one of
// them.
//   ROVE_HOME        settings, history, bookmarks (default %LOCALAPPDATA%\Rove)
//   ROVE_TEST        sound off, window not focused on start (tests)
//   ROVE_DEBUG_PORT  DevTools' port (tests; not in a packaged Rove)
//   ROVE_START       first address instead of the last tabs (tests)
//   ROVE_AS          the name Rove registers under as a browser (tests: their own)
//   ROVE_PASS_SERVER RobinPass's address (tests: a throwaway one on https://localhost)
//   ROVE_CLIP_MS     tests only: how soon a copied password leaves the clipboard (30 s otherwise)
//   ROVE_UPDATE_URL  where an installed Rove looks for latest.json (tests; still signed)
//
// 0.2 (robin 2026-11-24 "Rove 다음 버전"): a site asks before it gets the
// camera, the microphone, the location or notifications (the ask bar under
// the toolbar, the answer kept per site); a program or a script coming down
// waits there for a yes; ads and trackers are stopped (blocker.cjs); Rove can
// be the default browser (defaults.cjs).
//
// 0.4 (robin 2026-11-25 "rove 이어서작업해줘"): a site that asks to see the
// screen gets a picker (a screen, a window or one of our tabs) instead of a
// no; the lock in the address bar opens what this site has: its connection,
// its permissions (ask, allow, block), ads stopped there, and its data to clear.
//
// 0.6: Electron 45.5.0; a right click on a tab opens its own menu (tabItems);
// the server's update check (ops/robinmail/roundcube-update-check.py) tells
// robin when the Electron shipped here falls behind.
//
// 0.7 (robin 2026-11-25 "다른 브라우저들 다 조사해서 우리가 부족한부분 찾아"):
// tabs not looked at sleep, zoom is kept per site, the spell checker, picture
// in picture, tab search (Ctrl+Shift+A), bookmarks from other browsers, and
// click-tracking values taken off links (blocker.cjs).
//
// 0.8: pinned tabs (at the left, the icon only), two tabs side by side
// (split), and reading mode (reader.cjs).
//
// 0.9: vertical tabs (the strip at the left, the toolbar as the top row) and
// tab groups (a name and a colour, folded and unfolded).
//
// 1.0: more than one window (a tab dragged out of the strip makes one, or goes
// into another window's strip), and private windows (a session in memory: no
// history, no answers kept, no downloads listed, all gone with the last one).
//
// 1.2 (robin 2026-11-26 "chrome 확장기능 rove에서 쓸수있게해줘야지 왜안돼"): Chrome
// extensions (extensions.cjs) in the normal windows: added from the Chrome Web
// Store, their buttons in the toolbar, their items in the page menu.
const { getDomain, parse: parseHost } = require("tldts");
const { app, BrowserWindow, WebContentsView, Menu, clipboard, desktopCapturer, dialog, ipcMain, nativeTheme, net, powerMonitor, protocol, safeStorage, screen, session, shell, webContents } = require("electron");
const { appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, unlinkSync, writeFileSync } = require("node:fs");
const { stat } = require("node:fs/promises");
const { join, normalize, sep, parse, resolve, relative } = require("node:path");
const { pathToFileURL } = require("node:url");

const UI = join(__dirname, "ui");
const config = require("./config.cjs"); // the new tab's links, the first search engine, RobinPass, updates
// a new tab and the home button: Rove's own page (ui/newtab.html)
const HOME_PAGE = "rove://ui/newtab.html";
// what the address bar searches with (the words go at the end), chosen in ≡
const ENGINES = { google: ["Google", "https://www.google.com/search?q="], naver: ["Naver", "https://search.naver.com/search.naver?query="], bing: ["Bing", "https://www.bing.com/search?q="], duckduckgo: ["DuckDuckGo", "https://duckduckgo.com/?q="] };
const engine = () => ENGINES[settings.engine] || ENGINES[config.engine] || ENGINES.google;
const TOP = 84; // tab strip 40 + toolbar 44
const FIND = 44; // the find row under the toolbar, while open
const ASK = 44; // the ask bar under the toolbar, while something asks
const MARK = 2; // over two tabs side by side: which one is in front
const GAP = 4; // between them (it can be dragged)
const SIDE = "#0a0e11"; // --rk-side
const PAGE = "#0e1012"; // --rk-page
const BAR = 44; // vertical tabs: the toolbar is the top row
const SIDE_W = 240; // the tabs at the left
const SIDE_NARROW = 52; // ... folded to their icons
const TEST = !!process.env.ROVE_TEST;

const home = process.env.ROVE_HOME || join(process.env.LOCALAPPDATA || app.getPath("appData"), "Rove");
mkdirSync(home, { recursive: true });
app.setPath("userData", join(home, "profile"));
app.setName("Rove");
app.setAppUserModelId("xyz.yoonrobin.rove");
// ROVE_TEST_SOUND: no global mute (to see a tab's sound mark; such a test mutes its tab first)
if (TEST) { if (!process.env.ROVE_TEST_SOUND) app.commandLine.appendSwitch("mute-audio"); app.commandLine.appendSwitch("disable-features", "CalculateNativeWinOcclusion"); }
if (process.env.ROVE_DEBUG_PORT && !app.isPackaged) app.commandLine.appendSwitch("remote-debugging-port", process.env.ROVE_DEBUG_PORT);
protocol.registerSchemesAsPrivileged([{ scheme: "rove", privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
if (!app.requestSingleInstanceLock()) { app.quit(); return; }
// an installed copy (app-<version> beside current): it updates itself (update.cjs)
const { installed, updater, tidy, listed } = require("./update.cjs");
const mine = installed(__dirname);
const logFile = join(home, "rove.log");
const log = (text) => {
  try {
    if (statSync(logFile, { throwIfNoEntry: false })?.size > 1e6) writeFileSync(logFile, "");
    appendFileSync(logFile, `${new Date().toISOString()} ${text}
`);
  } catch { /* no log, no matter */ }
};
log(`켜짐: ${mine ? `설치 버전 ${mine.version}` : `설치 버전 아님 ${app.getVersion()}`}${TEST ? " (시험)" : ""}`);
let updates = mine && !TEST ? updater({ mine, log, url: process.env.ROVE_UPDATE_URL || config.updates, key: config.updateKeys, fetch: (u, o) => net.fetch(u, o), tell: () => tell() }) : null;
Menu.setApplicationMenu(null);
nativeTheme.themeSource = "dark";

// ---- small files ---------------------------------------------------------------
const file = (name) => join(home, name);
function load(name, fallback) {
  try { return JSON.parse(readFileSync(file(name), "utf8")); } catch { return fallback; }
}
// a write waits 0.8 s so a burst of changes is one write; what still waits is written when Rove ends
// (flushSaves in keepAll) — the timer never fires once the app has quit
const unsaved = new Map(); // name → { timer, write }
function save(name, value, now) {
  clearTimeout(unsaved.get(name)?.timer);
  unsaved.delete(name);
  const write = () => { unsaved.delete(name); try { writeFileSync(file(name) + ".tmp", JSON.stringify(value)); renameSync(file(name) + ".tmp", file(name)); } catch { /* next time */ } };
  if (now) write(); else unsaved.set(name, { timer: setTimeout(write, 800), write });
}
function flushSaves() { for (const { timer, write } of [...unsaved.values()]) { clearTimeout(timer); write(); } }
let history = load("history.json", []); // [{ url, title, at }], newest last
let bookmarks = load("bookmarks.json", []); // [{ url, title, at }]
// host → its page icon (data:, normal windows only) for the history and bookmark lists; a host in neither goes
let siteIcons = load("icons.json", {});
function keepIcons(now) { const kept = new Set([...history, ...bookmarks].map((x) => hostOf(x.url))); for (const h of Object.keys(siteIcons)) if (!kept.has(h)) delete siteIcons[h]; save("icons.json", siteIcons, now); }
const withIcon = (x) => ({ ...x, icon: siteIcons[hostOf(x.url)] || null });
const HISTORY_MAX = 5000;
let grants = load("permissions.json", {}); // { origin: { camera: true, location: false, ... } }
// allow: hosts ads are not stopped on; sleep: tabs not looked at for SLEEP_AFTER
// are put to sleep; zoom: { host: factor } (not 1); awake: sites (edup.co.kr)
// whose pages keep going with the window down (keepGoing, below)
// start: "last" (the last run's tabs) or "home" (one home tab)
let settings = { block: true, allow: [], sleep: true, zoom: {}, vertical: false, narrow: false, awake: [], start: "last", suggestOff: [], ...load("settings.json", {}) };
const SLEEP_AFTER = Number(process.env.ROVE_SLEEP_MS) || 30 * 60e3;

// ---- what the address bar means ------------------------------------------------
function toUrl(text) {
  let t = text.trim();
  if (!t) return null;
  // a leading ? means "search for this" (Chrome, Brave)
  if (t.startsWith("?")) return (t = t.slice(1).trim()) ? engine()[1] + encodeURIComponent(t) : null;
  if (/^(https?|file):\/\//i.test(t)) return t;
  if (/^(about:blank|view-source:)/i.test(t) || t === HOME_PAGE) return t;
  // as Brave reads it: the site part has no space, the path after it may (example.com/a b goes there, %20)
  const host = t.split(/[/?#]/)[0], rest = t.slice(host.length).replace(/\s/g, "%20");
  if (/\s/.test(host)) return engine()[1] + encodeURIComponent(t);
  // this PC, an IP, a one-word name with a port or a closing / (intranet/, foo:8080)
  if (/^(localhost|\d{1,3}(\.\d{1,3}){3}|\[[0-9a-f:.]+\])(:\d+)?$/i.test(host) || /^[a-z0-9-]+:\d+$/i.test(host) || (/^[a-z0-9-]+$/i.test(host) && rest === "/")) return "http://" + host + rest;
  // a real ending, in any script (네이버.한국)
  if (/^[^/]+\.\p{L}[\p{L}\p{N}-]+(:\d+)?$/u.test(host) && realEnding(host)) return "https://" + host + rest;
  return engine()[1] + encodeURIComponent(t);
}
// a site's ending as Chrome knows it: node.js, index.html are file names, not sites (*.localhost is this PC)
function realEnding(t) { const h = t.split(/[/?#]/)[0].replace(/:\d+$/, "").replace(/^.*@/, ""); return parseHost(h).isIcann || /\.localhost$/i.test(h); }
const webby = (url) => /^https?:/i.test(url || "");
const hostOf = (url) => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; } };
const originOf = (url) => { try { const o = new URL(url).origin; return o === "null" ? "" : o; } catch { return ""; } };
// the site a host is part of (www.edup.co.kr, contentsm.edup.co.kr: edup.co.kr)
const siteOf = (url) => { const h = webby(url) ? hostOf(url) : ""; return h ? getDomain(h) || h : ""; };
// a private window's 막기 끔 and 창을 내려도 계속 sites: in memory, gone with the last one (Chrome, Brave);
// it takes the normal windows' too (priv: asked for a private window's page)
let privSites = { allow: [], awake: [] };
const allowedFor = (host, priv) => settings.allow.includes(host) || (!!priv && privSites.allow.includes(host));
const awakeFor = (url, priv) => { const s = siteOf(url); return !!s && (settings.awake.includes(s) || (!!priv && privSites.awake.includes(s))); };
// what Windows hands us: addresses, and pages saved as files
function opened(argv) {
  const out = [];
  for (const a of argv) {
    if (webby(a)) out.push(a);
    else if (/^file:\/\//i.test(a)) out.push(a);
    else if (!a.startsWith("-") && /\.(html?|xhtml|svg|pdf)$/i.test(a) && existsSync(a)) out.push(pathToFileURL(resolve(a)).toString());
  }
  return out;
}

// ---- the window -------------------------------------------------------------------
// Each window has its own tabs, overlay and state. The functions below work on
// the window in use: its fields are in these variables while it is (use(w)
// puts them there). Everything that comes in (a message from a window's
// screens, a page's event, a timer, a menu's click) first puts its window in use.
let win = null;
let overlay = null;
let overlayOn = null; // what the overlay shows: { kind, ... }
let tabs = []; // { id, w, view, title, url, favicon, loading, failed, crashed }
let active = null;
let nextId = 1;
let closed = []; // closed tabs ({ url, nav }) and closed windows ({ urls, ... } as in tabs.json), newest last
let findOpen = false;
let downloads = []; // { id, name, path, url, received, total, state, at, private }
const windows = []; // { id, win, overlay, tabs, closed, private, ses, gone } + the fields above while not in use
let cur = null;
let lastNormal = null; // the normal window last in front (where an address from Windows goes)
let quitting = false;
const closedTabs = []; // the normal windows' closed tabs (a private window keeps its own)
function store() { if (cur) Object.assign(cur, { overlayOn, active, findOpen, split, fullTab, groups }); }
function use(w) {
  if (!w || w === cur || w.gone) return;
  store();
  cur = w;
  ({ win, overlay, overlayOn, tabs, active, findOpen, split, fullTab, groups, closed } = w);
}
// f with w in use, then the one before back
function within(w, f) {
  const was = cur;
  use(w);
  try { return f(); } finally { if (was && !was.gone) use(was); }
}
function everywhere(f) { for (const w of windows.slice()) if (!w.gone) within(w, f); }
function tabOf(wc) {
  if (!wc) return null;
  store();
  for (const w of windows) { const t = w.tabs.find((x) => x.view.webContents === wc); if (t) return t; }
  return null;
}

function bounds() {
  const [w, h] = win.getContentSize();
  return { w, h };
}
// where the pages go: under the toolbar (and the ask and find rows), right of
// the tabs when they are at the left
function frame() {
  if (win?.isFullScreen() && fullTab) return { top: 0, left: 0, full: true };
  const v = !!settings.vertical;
  return { top: (v ? BAR : TOP) + (asking() ? ASK : 0) + (findOpen ? FIND : 0), left: v ? (settings.narrow ? SIDE_NARROW : SIDE_W) : 0 };
}
function layout() {
  if (!win) return;
  const { w: all, h } = bounds();
  const f = frame();
  const two = !f.full && splitShown();
  const top = f.top + (two ? MARK : 0);
  const x = f.left;
  const w = Math.max(0, all - x);
  const left = two ? Math.round((w - GAP) * split.ratio) : w;
  for (const t of tabs) {
    const shown = t === active || (two && (t === split.a || t === split.b));
    t.view.setVisible(shown && !t.crashed);
    if (!shown) continue;
    const r = !two ? { x, width: w } : t === split.a ? { x, width: left } : { x: x + left + GAP, width: w - left - GAP };
    t.view.setBounds({ ...r, y: top, height: Math.max(0, h - top) });
  }
  if (overlay && overlayOn) {
    const r = overlayOn.kind === "suggest" || overlayOn.kind === "peek" ? overlayOn.rect : { x: 0, y: 0, width: w, height: h };
    overlay.setBounds({ x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) });
  }
}

function snapshot() {
  return {
    tabs: tabs.map((t) => ({ id: t.id, title: t.title, url: t.failed || t.url, favicon: t.favicon, loading: t.loading, crashed: !!t.crashed, asleep: !!t.asleep, pinned: !!t.pinned,
      readable: !!t.readable, reader: !!t.reader, group: t.group || null,
      sound: t.audible || t.view.webContents.isAudioMuted() ? (t.view.webContents.isAudioMuted() ? "muted" : "on") : null, shown: t.shownTo || null })),
    active: active?.id ?? null,
    canBack: !!active?.view.webContents.navigationHistory.canGoBack(),
    canForward: !!active?.view.webContents.navigationHistory.canGoForward(),
    starred: !!active && bookmarks.some((b) => b.url === (active.failed || active.url)),
    zoom: active ? Math.round(active.view.webContents.getZoomFactor() * 100) : 100,
    findOpen,
    // gone: finished, then deleted or moved away outside Rove (Chrome's "삭제됨")
    // what checkFiles last found: no disk here, as a gone network folder blocks a look for 20 s
    downloadDir: settings.downloadDir && dirOk ? settings.downloadDir : defaultDownloadDir(),
    downloads: downloads.filter(mineKind).slice(-30).map((d) => (d.state === "completed" && filesGone.has(d.id) ? { ...plain(d), gone: true } : plain(d))),
    full: !!(win?.isFullScreen() && fullTab),
    version: mine?.version || app.getVersion(),
    update: updates ? (({ ready, downloading, checking, checkedAt, error }) => ({ ready, downloading, checking, checked: !!checkedAt, error }))(updates.state()) : null,
    ask: asking() ? plainAsk(asking()) : null,
    block: { ready: !!blocker, on: !!settings.block, site: active && webby(active.url) ? hostOf(active.url) : "", siteOn: !!active && !allowedFor(hostOf(active.url), cur?.private), count: active ? blocked.get(active.view.webContents.id) || 0 : 0 },
    isDefault,
    pass: passState(),
    sleep: !!settings.sleep,
    startLast: settings.start !== "home",
    engine: engine()[0],
    split: splitShown() ? { a: split.a.id, b: split.b.id, ratio: split.ratio } : null,
    paired: split ? [split.a.id, split.b.id] : [],
    groups: groups.map((g) => ({ ...g })),
    vertical: !!settings.vertical,
    narrow: !!settings.narrow,
    frame: frame(),
    private: !!cur?.private,
    page: active && !cur?.private ? active.view.webContents.id : null, // the extension buttons' tab
  };
}
let pending = null;
function tell() {
  if (pending) return;
  pending = setImmediate(() => {
    pending = null;
    const was = cur;
    for (const w of windows.slice()) {
      if (w.gone) continue;
      use(w);
      const s = snapshot();
      win.webContents.send("rove:state", s);
      overlay.webContents.send("rove:state", s);
      // the taskbar's name: the tab in front
      const title = `${active?.title || "Rove"}${cur.private ? " · 비공개" : ""} - Rove`;
      if (win.getTitle() !== title) win.setTitle(title);
    }
    if (was && !was.gone) use(was);
    saveTabs();
  });
}
// the normal windows' tabs (a private window's are never kept); with none open, what was kept stays
function saveTabs(now) {
  if (quitting && !now) return;
  store();
  const normal = windows.filter((w) => !w.private && !w.gone);
  if (!normal.length) return;
  const list = normal.map(windowKept).filter((x) => x.urls.length);
  save("tabs.json", { windows: list }, now);
}
// a window as tabs.json keeps it (and as Ctrl+Shift+T brings a closed one back)
function windowKept(w) {
  const kept = w.tabs.filter((t) => webby(t.failed || t.url));
  let bounds = null;
  try { bounds = { ...w.win.getNormalBounds(), max: w.win.isMaximized() }; } catch { bounds = w.closedAt || null; }
  // each tab's back and forward list, addresses and titles only (a page's pageState holds what was typed in it)
  const nav = kept.map((t) => { const h = navOf(t); return h && { entries: h.entries.map((e) => ({ url: e.url, title: e.title })), index: h.index }; });
  return { urls: kept.map((t) => t.failed || t.url), titles: kept.map((t) => t.title), pinned: kept.map((t) => !!t.pinned), group: kept.map((t) => t.group || null), groups: w.groups, active: kept.indexOf(w.active), bounds, nav };
}
// a tab's back and forward list (a sleeping tab holds its own); a failed page's is not kept
function navOf(tab) {
  if (tab.failed) return null;
  if (tab.asleep) return { entries: tab.asleep.entries, index: tab.asleep.index };
  const h = tab.view.webContents.navigationHistory;
  return { entries: h.getAllEntries(), index: h.getActiveIndex() };
}
// a list from tabs.json or the closed list, as navigationHistory.restore takes it: web addresses only
// (a page of Rove's own is left out) and the shown one among them, or none
function navOk(h) {
  if (!Array.isArray(h?.entries) || h.entries.length > 50 || !Number.isInteger(h.index)) return null;
  const shown = h.entries[h.index];
  const entries = h.entries.filter((e) => typeof e?.url === "string" && webby(e.url));
  const index = entries.indexOf(shown);
  if (index < 0) return null;
  return { entries: entries.map((e) => ({ url: e.url, title: typeof e.title === "string" ? e.title : "", ...(typeof e.pageState === "string" ? { pageState: e.pageState } : {}) })), index };
}
// how Rove starts (≡ 지난 탭으로 시작, as Chrome's 시작 시): the last run's windows, or one home tab —
// then the last run's windows are the newest closed things, and Ctrl+Shift+T brings them back.
// again: started by "다시 켜서 새 버전으로" — the tabs come back whatever the setting, as Chrome's and
// Brave's relaunch for an update restores the session
const AGAIN = "--rove-relaunched";
function startWindows(list, again = false) {
  if (list.length && (again || settings.start !== "home")) for (const r of list) createWindow({ restore: r });
  else { createWindow({}); closedTabs.push(...list.slice(-25)); }
}
// Ctrl+Shift+T and the tab menu: the newest closed thing — a tab, or a whole window
function reopenClosed() {
  const u = closed.pop();
  if (u?.urls) createWindow({ restore: u });
  else if (u) newTab(u.url, { nav: u.nav });
}

// ---- tabs -------------------------------------------------------------------------
const rove = () => session.fromPartition("persist:rove");
// a site as rove.log names it: rove.log is on disk, so a private window's sites go in unnamed, as in no history
const siteInLog = (priv, url) => (priv ? "(비공개 창)" : hostOf(url));
let exts = null; // Chrome extensions (extensions.cjs), set at start
let movingWc = null; // a page going to another window: not closed by chrome.tabs' removeTab

// asleep: a tab that comes in sleeping (the tabs of the last run but the one in
// front) loads nothing until it is looked at
function pageView(ses = cur?.ses || rove()) {
  const view = new WebContentsView({
    webPreferences: { session: ses, sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true, spellcheck: true, backgroundThrottling: true },
  });
  view.setBackgroundColor("#ffffff");
  return view;
}
// nav: a back and forward list to bring back (navOk); the tab then comes in asleep and loads it when looked at
function newTab(url, { background = false, after = null, from = null, asleep = false, title = "", pinned = false, group, nav = null } = {}) {
  // a link a page opens (from: that tab) goes after the ones it opened before, in order; one gone
  // to at once forgets the others' (Chromium's tab strip: a run of openers at a time)
  if (from) {
    if (!background) for (const t of tabs) t.opener = null;
    let j = tabs.indexOf(from);
    while (tabs[j + 1]?.opener === from) j++;
    after = tabs[j] || from;
  }
  const view = pageView();
  const back = navOk(nav);
  if (back) asleep = true;
  const tab = { id: nextId++, w: cur, view, title: title || "새 탭", url: url || HOME_PAGE, favicon: null, loading: !asleep, failed: null, crashed: false, seen: Date.now() };
  if (asleep) { tab.asleep = back || { entries: [{ url: tab.url, title: tab.title }], index: 0 }; if (!title) tab.title = back?.entries[back.index].title || hostOf(tab.url) || tab.url; }
  tab.pinned = !!pinned;
  tab.opener = from;
  // the pinned ones stay first: a new tab goes after them
  const pins = tabs.filter((t) => t.pinned).length;
  let at = after ? tabs.indexOf(after) + 1 : tabs.length;
  at = tab.pinned ? Math.min(at, pins) : Math.max(at, pins);
  // opened from a tab in a group: it goes in the group too (as in Chrome)
  tab.group = tab.pinned ? null : group !== undefined ? group : after && !after.pinned ? after.group || null : null;
  tabs.splice(at, 0, tab);
  cluster(false);
  win.contentView.addChildView(view);
  overlayOnTop();
  wire(tab);
  if (!asleep) view.webContents.loadURL(tab.url).catch(() => {});
  if (!background || (!active && !asleep)) select(tab); else { layout(); tell(); }
  return tab;
}

function select(tab) {
  if (!tab) return;
  if (share && share.tab.w === cur && share.tab !== tab) dropShare();
  if (active && active !== tab) active.seen = Date.now();
  const g = groupOf(tab.group);
  if (g?.collapsed) g.collapsed = false;
  active = tab;
  wake(tab);
  exts?.select(tab.view.webContents);
  layout();
  tell();
}

// ---- sleeping tabs (Edge's, Chrome's memory saver) ------------------------------------
// A tab not looked at for SLEEP_AFTER gives its page up: its history is kept
// (navigationHistory), its page is closed (its renderer goes) and a new view
// that has loaded nothing takes its place. Looked at again, the history comes
// back into that view and the page loads. A tab
// that plays sound, is shown to a site, asks something, is loading or failed
// stays awake, and so does a page that asks to be left (beforeunload: what
// was typed there would go).
function canSleep(tab) {
  return tab !== active && !tab.asleep && !tab.awake && !tab.audible && !awakeFor(tab.url, tab.w?.private) && !tab.shownTo && !tab.loading && !tab.failed && !tab.crashed
    && webby(tab.url) && share?.tab !== tab && fullTab !== tab && !asks.some((a) => a.tab === tab) && split?.a !== tab && split?.b !== tab;
}
function sleepTab(tab) {
  if (!canSleep(tab)) return false;
  const old = tab.view.webContents;
  const h = old.navigationHistory;
  const entries = h.getAllEntries();
  if (!entries.length) return false;
  tab.asleep = { entries, index: h.getActiveIndex(), muted: old.isAudioMuted() };
  tab.closing = old;
  const id = old.id;
  const view = tab.view;
  // a page that asks to be left stops this (will-prevent-unload, in wire())
  old.once("destroyed", () => { blocked.delete(id); if (!tab.w.gone) within(tab.w, () => swapView(tab, view)); });
  old.close({ waitForBeforeUnload: true });
  // a page that does not answer: it stays as it is, awake
  setTimeout(() => { if (tab.closing === old && !old.isDestroyed()) { tab.closing = null; tab.asleep = null; tab.wakeAfter = false; tab.awake = true; tell(); } }, 5000).unref?.(); // tell() is every window's
  tell();
  return true;
}
function swapView(tab, was) {
  tab.closing = null;
  if (!tabs.includes(tab) || tab.view !== was) return; // closed meanwhile
  if (!tab.asleep) { // given up on (the 5 s timer): its page is gone anyway, so load it again
    tab.view = pageView(); win.contentView.removeChildView(was); win.contentView.addChildView(tab.view); overlayOnTop(); wire(tab);
    tab.view.webContents.loadURL(tab.url).catch(() => {}); layout(); tell(); return;
  }
  tab.view = pageView();
  win.contentView.removeChildView(was);
  win.contentView.addChildView(tab.view);
  overlayOnTop();
  wire(tab);
  if (tab.asleep?.muted) tab.view.webContents.setAudioMuted(true);
  if (tab.wakeAfter) { tab.wakeAfter = false; wake(tab); }
  layout();
  tell();
}
function wake(tab) {
  const s = tab?.asleep;
  if (!s) return;
  if (tab.closing) { tab.wakeAfter = true; return; } // the old page is still going
  tab.asleep = null;
  tab.seen = Date.now();
  const wc = tab.view.webContents;
  const url = s.entries[s.index]?.url || tab.url;
  if (s.entries.length === 1 && !s.entries[0].pageState) wc.loadURL(url).catch(() => {});
  else wc.navigationHistory.restore({ entries: s.entries, index: s.index }).catch((e) => { log(`탭 기록 못 돌림: ${e.message}`); wc.loadURL(url).catch(() => {}); });
}
function sleepIdle() {
  if (!settings.sleep) return;
  const now = Date.now();
  everywhere(() => { for (const t of tabs.slice()) if (now - t.seen > SLEEP_AFTER) sleepTab(t); });
}

function closeTab(tab) {
  const i = tabs.indexOf(tab);
  if (i < 0) return;
  if (webby(tab.failed || tab.url)) closed.push({ url: tab.failed || tab.url, nav: navOf(tab) });
  if (closed.length > 25) closed.shift();
  tabs.splice(i, 1);
  if (split?.a === tab || split?.b === tab) split = null;
  if (tab.group) groups = groups.filter((g) => tabs.some((t) => t.group === g.id));
  dropAsks(tab);
  forgetTyped(tab);
  blocked.delete(tab.view.webContents.id);
  win.contentView.removeChildView(tab.view);
  tab.view.webContents.close();
  if (!tabs.length) {
    if (cur.private || windows.some((w) => w !== cur && !w.private && !w.gone)) { active = null; win.close(); return; }
    newTab(HOME_PAGE);
    return;
  }
  // the one in front closed: another its opener opened (right, then left), then the opener (Chromium's),
  // else its neighbour
  const kin = (t) => t.opener && t.opener === tab.opener;
  const next = tab.opener && tabs.includes(tab.opener) ? tabs.slice(i).find(kin) || tabs.slice(0, i).reverse().find(kin) || tab.opener : null;
  if (active === tab) select(next || tabs[Math.min(i, tabs.length - 1)]); else { layout(); tell(); } // the other of two side by side takes the page again
}

function record(url, title) {
  if (!webby(url) || cur?.private) return;
  const last = history[history.length - 1];
  if (last && last.url === url && Date.now() - last.at < 30 * 60e3) { last.title = title || last.title; last.at = Date.now(); } else history.push({ url, title: title || url, at: Date.now() });
  if (history.length > HISTORY_MAX) { history = history.slice(-HISTORY_MAX); keepIcons(); }
  save("history.json", history);
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
function errorPage(url, code, what) {
  let host = url;
  try { host = new URL(url).host || url; } catch { /* as it is */ }
  const offline = [-106, -105, -102, -21, -109, -118, -130, -137].includes(code);
  const head = offline ? "연결할 수 없어요" : "이 페이지를 열지 못했어요";
  // what went wrong, said as it is: "no answer" only when there was none (a refusal, a blocked port, a bad certificate are not that)
  const why = { [-105]: `${host} 주소를 찾지 못했어요.`, [-106]: "인터넷 연결이 끊겼어요.", [-102]: `${host}에서 연결을 거부했어요.`, [-101]: `${host} 연결이 도중에 끊겼어요.`, [-312]: "브라우저가 막아 두는 포트라 열지 않았어요.", [-6]: "파일을 찾지 못했어요." };
  const body = why[code] || (code <= -200 && code > -300 ? `${host}의 인증서를 믿을 수 없어 열지 않았어요.` : `${host}에서 답이 없어요.`);
  return `<!doctype html><meta charset="utf-8"><title>${esc(host)}</title><meta name="color-scheme" content="dark">
<style>html,body{margin:0;height:100%;background:#0e1012;color:#e6e7e9;font:450 14px/1.6 "Pretendard Variable",Pretendard,"Segoe UI","Malgun Gothic",sans-serif;word-break:keep-all;overflow-wrap:break-word}
body{display:grid;place-items:center}.b{width:min(440px,100%);box-sizing:border-box;padding:24px;margin-bottom:12vh}h1{margin:0 0 6px;font-size:18px;font-weight:650;color:#f0f0f0}
p{margin:0;color:#8a8e94}code{display:block;margin:14px 0 18px;font:12px Consolas,monospace;color:#7d8187;word-break:break-all}
a{display:inline-flex;align-items:center;height:32px;padding:0 14px;border-radius:7px;background:#3d6af0;color:#fff;text-decoration:none;font-weight:550}
a:hover{background:#4b7dfe}</style><div class="b"><h1>${head}</h1><p>${esc(body)}</p><code>${esc(what)} (${code})</code><a href="${esc(url)}">다시 시도</a></div>`;
}

// the extensions take every tab they are given as the chosen one and ask Rove to choose it (a tab
// opened behind, a tab put to sleep came to the front): while Rove gives one, its own choice stays
let addingTab = false;
function wire(tab) {
  const wc = tab.view.webContents;
  addingTab = true;
  try { exts?.add(wc, tab.w.win); if (active && active !== tab && active.w === tab.w) exts?.select(active.view.webContents); } finally { addingTab = false; }
  const mine = () => tabs.includes(tab);
  // every event: the tab's window in use first (the tab may have moved to another)
  const here = () => { if (tab.w && !tab.w.gone) use(tab.w); };
  const on = (ev, f) => wc.on(ev, (...a) => { here(); return f(...a); });
  wc.setWindowOpenHandler(({ url, disposition, features }) => {
    here();
    // no click or key in the page just before: a popup, held (Chrome's popup blocker)
    const clicked = Date.now() - (tab.input || 0) < ACTIVATION_MS;
    tab.input = 0; // used up by this one, as Chromium's transient activation
    if (!clicked && !popupsOk(tab)) { holdPopup(tab, url); return { action: "deny" }; }
    // a link Shift+clicked ("new-window" with no features): a new Rove window with it, as in
    // Chrome — private from a private window, in the same private session
    if (disposition === "new-window" && !features) {
      if (webby(url)) createWindow({ priv: !!tab.w?.private, urls: [url] });
      return { action: "deny" };
    }
    // a sign-in window (window.open with a size) stays a real popup: its page
    // talks back to the opener. Not to our pages (rove://)
    if (disposition === "new-window") {
      if (!webby(url) && !/^about:blank/.test(url)) return { action: "deny" };
      return { action: "allow", overrideBrowserWindowOptions: { ...popupSize(features, tab.w?.win), useContentSize: true, autoHideMenuBar: true, backgroundColor: "#ffffff",
        webPreferences: { session: tab.w?.ses || rove(), sandbox: true, contextIsolation: true, nodeIntegration: false } } };
    }
    if (webby(url) || /^about:blank/.test(url)) newTab(url, { background: disposition === "background-tab", from: tab });
    return { action: "deny" };
  });
  on("did-create-window", (child, d) => {
    child.setMenu(null);
    popupGoing(child, d.url, tab);
  });
  // asleep: what about:blank does is not the tab's
  const own = () => mine() && !tab.asleep && tab.view.webContents === wc;
  on("did-start-loading", () => { if (!own()) return; tab.loading = true; tell(); });
  on("did-stop-loading", () => { if (!own()) return; tab.loading = false; tell(); if (!tab.reader) lookReadable(tab); });
  // a click into the other of two side by side puts it in front
  const front = () => { if (own() && tab !== active && splitShown() && (split.a === tab || split.b === tab)) { active = tab; layout(); tell(); } };
  on("focus", front);
  on("input-event", (_e, i) => {
    if (i.type === "mouseDown") front();
    if (activates(i)) tab.input = Date.now(); // what lets the page open a window
  });
  // the page asks to be left (something typed there would go): it stays awake
  on("will-prevent-unload", () => {
    if (tab.closing !== wc) return;
    tab.closing = null;
    tab.asleep = null;
    tab.wakeAfter = false;
    tab.awake = true;
    log(`탭 재우지 않음: ${siteInLog(tab.w?.private, tab.url)}`);
    tell();
  });
  // our pages are Rove's to open (loadURL), not a page's: a web page, or a popup moving its opener,
  // cannot take a tab there. The new tab's field (go?q=) is taken from that page's own frame only, and
  // only to http(s) or a search (no file: and the like from it). MIKAEL n366
  on("will-navigate", (e) => {
    if (!/^rove:/i.test(e.url)) return;
    e.preventDefault();
    const m = /^rove:\/\/ui\/go\?q=(.*)$/.exec(e.url);
    const own = wc.getURL() === HOME_PAGE && e.initiator && e.initiator.processId === wc.mainFrame.processId && e.initiator.routingId === wc.mainFrame.routingId;
    if (!m || !own) return log(`rove:// 막음: ${siteInLog(wc.session !== rove(), wc.getURL()) || wc.getURL().slice(0, 40)}`);
    let to = null;
    try { to = toUrl(decodeURIComponent(m[1])); } catch { /* a broken % */ }
    if (webby(to)) go(to, tab);
  });
  guardOurPages(wc);
  on("did-start-navigation", (d) => {
    if (!d.isMainFrame || d.isSameDocument) return;
    keepGoing(wc, awakeFor(d.url, tab.w?.private));
    // the page itself went on (a form sent): a password typed there may be offered to RobinPass
    tab.landed = false;
    if (d.initiator) passSent(tab);
    else forgetTyped(tab);
    // a new page: the old one's questions and count go with it
    if (originOf(d.url) !== originOf(tab.url)) { dropAsks(tab); tab.once = null; }
    blocked.delete(wc.id);
    // the reading page is ours (a data: address); anything else ends it
    tab.reader = !!tab.readerUrl && d.url === tab.readerUrl;
    if (!tab.reader) tab.readable = false;
    if (!d.url.startsWith("data:")) { tab.failed = null; tab.crashed = false; }
  });
  on("did-navigate", (e, url) => {
    if (!own() || url.startsWith("data:")) return;
    const moved = hostOf(url) !== hostOf(tab.url);
    tab.url = url;
    tab.favicon = null;
    tab.awake = false;
    tab.title = wc.getTitle(); // a page with no title of its own: its address, not the page before's
    record(url, wc.getTitle());
    if (moved || settings.zoom[hostOf(url)]) keepZoom(tab);
    tab.landed = true;
    passOffer(tab);
    tell();
  });
  on("did-navigate-in-page", (e, url, isMainFrame) => { if (!own() || !isMainFrame) return; tab.url = url; record(url, wc.getTitle()); tell(); });
  on("page-title-updated", (e, title) => {
    if (!own()) return;
    tab.title = title || tab.title;
    const last = history[history.length - 1];
    if (last && last.url === tab.url && !tab.w?.private) { last.title = title; save("history.json", history); }
    tell();
  });
  on("page-favicon-updated", (e, icons) => { if (!own()) return; const at = hostOf(tab.url); iconOf(wc.session, icons.find((u) => /^https?:|^data:image\//.test(u)) || null).then((d) => { if (own() && hostOf(tab.url) === at) { tab.favicon = d; tell(); if (d && !tab.w.private && d.length < 20000 && siteIcons[at] !== d) { siteIcons[at] = d; keepIcons(); } } }); });
  on("did-fail-load", (e, code, what, url, isMainFrame) => {
    if (!own() || !isMainFrame || code === -3 || url.startsWith("data:")) return;
    tab.failed = url;
    tab.favicon = null;
    try { tab.title = new URL(url).host || url; } catch { tab.title = url; }
    wc.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(errorPage(url, code, what))).catch(() => {});
    tell();
  });
  on("render-process-gone", (e, d) => {
    if (!own() || d.reason === "clean-exit") return;
    tab.crashed = true;
    tab.loading = false;
    layout();
    tell();
  });
  on("enter-html-full-screen", () => { fullTab = tab; win.setFullScreen(true); layout(); tell(); });
  on("leave-html-full-screen", () => { fullTab = null; win.setFullScreen(false); layout(); tell(); });
  on("found-in-page", (e, r) => { if (tab === active) win.webContents.send("rove:found", { at: r.activeMatchOrdinal, of: r.matches }); });
  on("before-input-event", (e, input) => { if (input.type === "keyDown" && input.key === "Enter") passTyped(tab); pageKey(tab, e, input); });
  on("before-mouse-event", (e, m) => { if (m.type === "mouseDown") passTyped(tab); });
  on("dom-ready", () => wc.executeJavaScriptInIsolatedWorld(KEY_WORLD, [{ code: KEY_LISTENER }]).catch(() => {}));
  on("dom-ready", () => { if (own()) unAmp(tab, wc); });
  on("dom-ready", () => { if (!tab.w.private && pass?.status().state === "open") wc.executeJavaScriptInIsolatedWorld(1001, [{ code: SNAP }]).catch(() => {}); });
  on("console-message", (e) => keyWord(tab, String(e.message || "")));
  on("context-menu", (e, p) => pageMenu(tab, p));
  on("zoom-changed", (e, dir) => zoom(dir === "in" ? 1 : -1));
  on("audio-state-changed", (e) => { if (!mine()) return; tab.audible = !!e.audible; tell(); });
}
// a tab's sound on and off (the speaker on the tab)
function mute(tab) {
  if (!tab) return;
  const wc = tab.view.webContents;
  wc.setAudioMuted(!wc.isAudioMuted());
  tell();
}
// a tab dragged in the strip: `to` is its place among the others (0 first)
function moveTab(tab, to) {
  const from = tabs.indexOf(tab);
  if (from < 0 || from === to) return;
  tabs.splice(from, 1);
  const pins = tabs.filter((t) => t.pinned).length;
  const lo = tab.pinned ? 0 : pins;
  const hi = tab.pinned ? pins : tabs.length;
  const at = Math.max(lo, Math.min(hi, to));
  tabs.splice(at, 0, tab);
  // put down between two of a group: it is in that group; away from its own: it is out
  if (!tab.pinned) {
    const l = tabs[at - 1];
    const r = tabs[at + 1];
    if (l?.group && l.group === r?.group) tab.group = groupOf(l.group)?.collapsed ? null : l.group;
    else if (tab.group && l?.group !== tab.group && r?.group !== tab.group) tab.group = null;
  }
  cluster();
  tell();
}
let fullTab = null;

// ---- pinned tabs: first in the strip, the icon only -------------------------------------
function pin(tab) {
  if (!tab) return;
  tab.pinned = !tab.pinned;
  if (tab.pinned) tab.group = null;
  const pins = tabs.filter((t) => t.pinned && t !== tab).length;
  tabs.splice(tabs.indexOf(tab), 1);
  tabs.splice(pins, 0, tab); // the last pinned, or the first not
  cluster();
  tell();
}

// ---- tab groups: a name and a colour over tabs next to each other ----------------------
// A group's tabs are always together (cluster()); a group with no tabs goes.
// Folded, its tabs are not shown in the strip (the one in front is never in a
// folded group: folding moves to another tab, selecting one unfolds it).
const COLORS = ["grey", "blue", "apricot", "white"];
const COLOR_NAMES = { grey: "회색", blue: "파랑", apricot: "살구", white: "흰색" };
let groups = []; // { id, name, color, collapsed }
let nextGroup = 1;
const groupOf = (id) => (id ? groups.find((g) => g.id === id) || null : null);
const members = (id) => tabs.filter((t) => t.group === id);
const groupName = (g) => g.name || COLOR_NAMES[g.color] || "묶음";
// prune: a group left with no tabs goes (not while the last run's tabs come back)
function cluster(prune = true) {
  const out = [];
  const done = new Set();
  for (const t of tabs) {
    if (!t.group) { out.push(t); continue; }
    if (done.has(t.group)) continue;
    done.add(t.group);
    out.push(...tabs.filter((x) => x.group === t.group));
  }
  tabs.splice(0, tabs.length, ...out);
  if (prune) groups = groups.filter((g) => tabs.some((t) => t.group === g.id));
}
function groupNew(tab) {
  if (!tab || tab.pinned) return null;
  const used = new Set(groups.map((g) => g.color));
  const g = { id: nextGroup++, name: "", color: COLORS.find((c) => !used.has(c)) || COLORS[groups.length % COLORS.length], collapsed: false };
  groups.push(g);
  groupOut(tab, true);
  tab.group = g.id;
  cluster();
  tell();
  return g;
}
function groupAdd(tab, id) {
  const g = groupOf(id);
  if (!tab || !g || tab.pinned || tab.group === id) return;
  const last = members(id).pop();
  tab.group = id;
  tabs.splice(tabs.indexOf(tab), 1);
  tabs.splice(tabs.indexOf(last) + 1, 0, tab);
  cluster();
  if (g.collapsed && tab === active) g.collapsed = false;
  tell();
}
// out of its group, put down right after it (quiet: no tell, for groupNew)
function groupOut(tab, quiet) {
  if (!tab?.group) return;
  const last = members(tab.group).pop();
  tab.group = null;
  if (last !== tab) { tabs.splice(tabs.indexOf(tab), 1); tabs.splice(tabs.indexOf(last) + 1, 0, tab); }
  cluster();
  if (!quiet) tell();
}
function groupSet(id, { name, color } = {}) {
  const g = groupOf(id);
  if (!g) return;
  if (typeof name === "string") g.name = name.trim().slice(0, 40);
  if (COLORS.includes(color)) g.color = color;
  tell();
}
function groupFold(id, fold) {
  const g = groupOf(id);
  if (!g) return;
  const to = fold === undefined ? !g.collapsed : !!fold;
  if (to && active?.group === id) {
    // the tab in front goes out of sight: the nearest tab outside it comes to the front
    const i = tabs.indexOf(active);
    const next = [...tabs.slice(i + 1), ...tabs.slice(0, i).reverse()].find((t) => t.group !== id && !groupOf(t.group)?.collapsed);
    if (!next) return;
    g.collapsed = true;
    select(next);
    return;
  }
  g.collapsed = to;
  tell();
}
function ungroup(id) {
  for (const t of tabs) if (t.group === id) t.group = null;
  cluster();
  tell();
}
function groupClose(id) {
  for (const t of members(id)) closeTab(t);
}
// a new group's name is asked for at once (the strip finds the group's label)
function editGroup(id) {
  win?.webContents.send("rove:edit-group", id);
}

// ---- vertical tabs ---------------------------------------------------------------------
// The window's own buttons sit over the top row: the strip's (40, on the side
// face), or the toolbar's when the tabs are at the left (44, on the page face).
function titleBar() {
  if (!win) return;
  try { win.setTitleBarOverlay({ color: settings.vertical ? PAGE : SIDE, symbolColor: "#8a8e94", height: settings.vertical ? BAR : 40 }); } catch { /* not on this system */ }
}
function setVertical(on) {
  settings.vertical = !!on;
  save("settings.json", settings);
  everywhere(() => { hideOverlay(); titleBar(); layout(); });
  tell();
}
function setNarrow(on) {
  settings.narrow = !!on;
  everywhere(() => { if (overlayOn?.kind === "peek") hideOverlay(); });
  save("settings.json", settings);
  everywhere(layout);
  tell();
}

// ---- two tabs side by side ----------------------------------------------------------
// split: { a (left), b (right), ratio }. It is shown while either is in front;
// another tab in front is shown alone (the two stay paired). Clicking into one
// puts it in front.
let split = null;
const splitShown = () => !!split && (active === split.a || active === split.b) && !(win?.isFullScreen() && fullTab);
function splitWith(tab, other = active) {
  if (!tab || !other || tab === other || !tabs.includes(tab) || !tabs.includes(other)) return;
  const [a, b] = tabs.indexOf(other) < tabs.indexOf(tab) ? [other, tab] : [tab, other];
  split = { a, b, ratio: 0.5 };
  wake(tab);
  layout();
  tell();
}
function unsplit() {
  if (!split) return;
  split = null;
  layout();
  tell();
}
function splitRatio(r) {
  if (!split || !Number.isFinite(r)) return;
  const w = bounds().w - frame().left;
  const min = Math.min(0.45, 320 / Math.max(1, w)); // each at least 320px, as far as the window lets
  split.ratio = Math.max(min, Math.min(1 - min, r));
  layout();
  tell();
}

// ---- reading mode (reader.cjs) -------------------------------------------------------
const reader = require("./reader.cjs");
async function lookReadable(tab) {
  const wc = tab.view.webContents;
  const url = wc.getURL();
  const can = webby(url) && !tab.failed ? await reader.readable(wc) : false;
  if (tab.w.gone) return;
  use(tab.w);
  if (!tabs.includes(tab) || wc !== tab.view.webContents || wc.getURL() !== url) return;
  if (can !== !!tab.readable) { tab.readable = can; tell(); }
}
async function read(tab = active) {
  if (!tab) return;
  const wc = tab.view.webContents;
  if (tab.reader) { if (wc.navigationHistory.canGoBack()) wc.navigationHistory.goBack(); return; }
  const url = wc.getURL();
  if (!webby(url)) return;
  const a = await reader.article(wc);
  if (tab.w.gone) return;
  use(tab.w);
  if (!a || !tabs.includes(tab) || wc.getURL() !== url) { if (!a) log(`읽기 모드 못 함: ${siteInLog(tab.w.private, url)}`); return; }
  const to = reader.dataUrl(reader.page(a, url));
  if (!to) { log(`읽기 모드: 글이 너무 김 (${siteInLog(tab.w.private, url)})`); return; }
  tab.readerUrl = to;
  wc.loadURL(to).catch(() => {});
}

let lastMenu = null; // tests: what the last menu had
function popup(items) {
  const w = cur;
  const wrap = (list) => list.map((it) => ({ ...it, ...(it.click ? { click: (...a) => { use(w); it.click(...a); } } : {}), ...(it.submenu ? { submenu: wrap(it.submenu) } : {}) }));
  const all = wrap(items);
  if (TEST) { lastMenu = all; return; }
  Menu.buildFromTemplate(all).popup({ window: win });
}
// the address bar and the find box, right-clicked: the editing menu, and for the address bar
// 붙여넣고 이동 (Edge's paste and go; its Ctrl+Shift+L is RobinPass's here, so the menu only)
async function barMenu(p) {
  const w = cur;
  const id = await w.win.webContents.executeJavaScript("document.activeElement?.id || ''").catch(() => "");
  if (w.gone) return;
  use(w);
  const f = p.editFlags || {};
  const items = [{ label: "실행 취소", role: "undo", enabled: !!f.canUndo }, { type: "separator" },
    { label: "잘라내기", role: "cut", enabled: !!f.canCut }, { label: "복사", role: "copy", enabled: !!f.canCopy },
    { label: "붙여넣기", role: "paste", enabled: !!f.canPaste }];
  if (id === "url") {
    const text = String((await clipboard.readText()) || "").trim(); // a promise in Electron 45
    items.push({ label: "붙여넣고 이동", enabled: !!text, click: () => { hideOverlay(); go(text); } });
  }
  items.push({ type: "separator" }, { label: "모두 선택", role: "selectAll" });
  popup(items);
}
// a video: picture in picture. The video under the pointer (the top page),
// else the one playing that source, else the biggest one in that frame.
const PIP = (x, y, src) => `(() => {
  const vs = [...document.querySelectorAll("video")];
  const v = document.elementsFromPoint(${x}, ${y}).find((e) => e.tagName === "VIDEO")
    || vs.find((e) => e.currentSrc && e.currentSrc === ${JSON.stringify(src || "")})
    || vs.sort((a, b) => b.clientWidth * b.clientHeight - a.clientWidth * a.clientHeight)[0];
  if (!v) return "none";
  if (document.pictureInPictureElement === v) return document.exitPictureInPicture().then(() => "out");
  v.disablePictureInPicture = false;
  return v.requestPictureInPicture().then(() => "in", (e) => "error: " + e.name);
})()`;
function pip(tab, p) {
  const wc = tab.view.webContents;
  const z = wc.getZoomFactor() || 1;
  const top = !p.frame || p.frame === wc.mainFrame;
  const code = PIP(top ? Math.round(p.x / z) : -1, top ? Math.round(p.y / z) : -1, p.srcURL);
  const run = top ? wc.executeJavaScriptInIsolatedWorld(1002, [{ code }], true) : p.frame.executeJavaScript(code, true);
  return Promise.resolve(run).then((r) => { if (String(r).startsWith("error")) log(`화면 속 화면 못 함: ${r}`); return r; }, (e) => { log(`화면 속 화면 못 함: ${e.message}`); return "error"; });
}

function pageMenu(tab, p) {
  const wc = tab.view.webContents;
  const items = [];
  if (p.linkURL && webby(p.linkURL)) {
    // a new window as Shift+click makes it: private from a private window (so no "private" item there)
    const priv = !!tab.w?.private;
    const words = (p.linkText || "").trim();
    const clean = require("./blocker.cjs").clean(p.linkURL);
    items.push({ label: "새 탭에서 링크 열기", click: () => newTab(p.linkURL, { background: true, from: tab }) },
      { label: "옆에 열기", click: () => { const t = newTab(p.linkURL, { background: true, after: tab }); splitWith(t, tab); } },
      { label: "새 창에서 링크 열기", click: () => createWindow({ priv, urls: [p.linkURL] }) },
      ...(priv ? [] : [{ label: "비공개 창에서 링크 열기", click: () => createWindow({ priv: true, urls: [p.linkURL] }) }]),
      { type: "separator" },
      { label: "링크 주소 복사", click: () => clipboard.writeText(p.linkURL) },
      // Brave's 깨끗한 링크 복사: the click ids (fbclid, gclid ...) taken off, shown only when the link has one
      ...(clean !== p.linkURL ? [{ label: "깨끗한 링크 복사", click: () => clipboard.writeText(clean) }] : []),
      ...(words ? [{ label: "링크 글자 복사", click: () => clipboard.writeText(words) }] : []), { type: "separator" });
  }
  if (p.mediaType === "image" && p.srcURL) {
    items.push({ label: "새 탭에서 그림 열기", click: () => newTab(p.srcURL, { background: true, after: tab }) },
      { label: "그림 저장", click: () => wc.downloadURL(p.srcURL) },
      { label: "그림 복사", click: () => wc.copyImageAt(p.x, p.y) },
      { label: "그림 주소 복사", click: () => clipboard.writeText(p.srcURL) }, { type: "separator" });
  }
  if (p.mediaType === "video") {
    items.push({ label: "화면 속 화면", click: () => pip(tab, p) });
    if (webby(p.srcURL)) items.push({ label: "동영상 주소 복사", click: () => clipboard.writeText(p.srcURL) });
    items.push({ type: "separator" });
  }
  // a word the spell checker does not know: what it could be, and "it is a word".
  // (Windows' spell checker, English and Korean; through Electron it gives no
  // suggestions today, Chromium's own one needs 11 MB for Korean and gave none either)
  if (p.isEditable && p.misspelledWord) {
    for (const w of p.dictionarySuggestions.slice(0, 5)) items.push({ label: w, click: () => wc.replaceMisspelling(w) });
    items.push({ label: "사전에 추가", click: () => wc.session.addWordToSpellCheckerDictionary(p.misspelledWord) }, { type: "separator" });
  }
  if (p.isEditable) {
    items.push({ label: "실행 취소", role: "undo", enabled: p.editFlags.canUndo }, { label: "다시 실행", role: "redo", enabled: p.editFlags.canRedo }, { type: "separator" },
      { label: "잘라내기", role: "cut", enabled: p.editFlags.canCut }, { label: "복사", role: "copy", enabled: p.editFlags.canCopy },
      { label: "붙여넣기", role: "paste", enabled: p.editFlags.canPaste }, { label: "모두 선택", role: "selectAll" }, { type: "separator" });
  } else if (p.selectionText) {
    const text = p.selectionText.trim();
    items.push({ label: "복사", role: "copy" },
      { label: `"${text.length > 24 ? text.slice(0, 24) + "…" : text}" 찾아보기`, click: () => newTab(engine()[1] + encodeURIComponent(text), { after: tab }) }, { type: "separator" });
  }
  if (!p.linkURL && !p.isEditable && !p.selectionText && p.mediaType !== "image" && p.mediaType !== "video") {
    items.push({ label: "뒤로", enabled: wc.navigationHistory.canGoBack(), click: () => wc.navigationHistory.goBack() },
      { label: "앞으로", enabled: wc.navigationHistory.canGoForward(), click: () => wc.navigationHistory.goForward() },
      { label: "새로 고침", click: () => wc.reload() }, { label: "인쇄…", click: () => wc.print() });
    if (tab.readable || tab.reader) items.push({ label: tab.reader ? "읽기 모드 끝내기" : "읽기 모드", click: () => read(tab) });
    items.push({ type: "separator" });
  }
  const theirs = exts?.menu(wc, p) || [];
  if (theirs.length) items.push(...theirs, { type: "separator" });
  items.push({ label: "검사", click: () => wc.inspectElement(p.x, p.y) });
  popup(items);
}

// a tab's own menu (right click on it in the strip)
function tabItems(tab) {
  const i = tabs.indexOf(tab);
  const url = tab.failed || tab.url;
  const muted = tab.view.webContents.isAudioMuted();
  const shut = (list) => { for (const t of list) closeTab(t); };
  const paired = split?.a === tab || split?.b === tab;
  store();
  const others = windows.filter((w) => w !== cur && !w.gone && w.private === cur.private);
  return [
    { label: "오른쪽에 새 탭", click: () => newTab(HOME_PAGE, { after: tab }) },
    { type: "separator" },
    { label: "새로 고침", click: () => { select(tab); reload(false); } },
    { label: "복제", enabled: webby(url), click: () => newTab(url, { after: tab }) },
    { label: muted ? "탭 소리 켜기" : "탭 소리 끄기", click: () => mute(tab) },
    { label: tab.pinned ? "고정 풀기" : "고정", click: () => pin(tab) },
    ...(tab.pinned ? [] : [
      tab.group ? { label: "묶음에서 빼기", click: () => groupOut(tab) } : { label: "새 묶음에 넣기", click: () => { const g = groupNew(tab); if (g) editGroup(g.id); } },
      ...(groups.some((g) => g.id !== tab.group) ? [{ label: "묶음에 넣기", submenu: groups.filter((g) => g.id !== tab.group).map((g) => ({ label: groupName(g), click: () => groupAdd(tab, g.id) })) }] : []),
    ]),
    paired ? { label: "나란히 보기 끝내기", click: unsplit } : { label: "지금 탭과 나란히 보기", enabled: tab !== active, click: () => { splitWith(tab); select(tab); } },
    { type: "separator" },
    { label: "새 창으로 옮기기", enabled: tabs.length > 1, click: () => { const priv = cur.private; if (takeTab(tab)) createWindow({ priv, tab }); } },
    ...(others.length ? [{ label: "다른 창으로 옮기기", submenu: others.map((w) => ({ label: windowName(w), click: () => moveToWindow(tab, w) })) }] : []),
    { type: "separator" },
    { label: "닫기", click: () => closeTab(tab) },
    { label: "다른 탭 닫기", enabled: tabs.some((t) => t !== tab && !t.pinned), click: () => shut(tabs.filter((t) => t !== tab && !t.pinned)) },
    { label: "오른쪽 탭 닫기", enabled: tabs.slice(i + 1).some((t) => !t.pinned), click: () => shut(tabs.slice(i + 1).filter((t) => !t.pinned)) },
    { type: "separator" },
    { label: closed.at(-1)?.urls ? "닫은 창 다시 열기" : "닫은 탭 다시 열기", enabled: closed.length > 0, click: reopenClosed },
  ];
}
function tabMenu(tab) {
  if (tab) popup(tabItems(tab));
}

// ---- what the toolbar asks for -----------------------------------------------------
// the address bar's Enter: here, or with Alt a new tab (in front), with Shift a new window (as Chrome, Brave)
function goIn(text, how) {
  if (how !== "tab" && how !== "window") return go(text);
  const url = toUrl(text);
  if (!url) return;
  if (how === "window") createWindow({ priv: !!cur?.private, urls: [url] });
  else newTab(url);
}
function go(text, tab = active) {
  const url = toUrl(text);
  if (!url || !tab) return;
  tab.failed = null;
  tab.url = url;
  tab.crashed = false;
  if (url !== HOME_PAGE) tab.title = url.replace(/^https?:\/\//, ""); // till the page gives its own, the address asked for (as Chrome), not the last title
  tab.view.webContents.loadURL(url).catch(() => {});
  tab.view.webContents.focus();
  layout();
  tell();
}
function reload(hard) {
  if (!active) return;
  if (active.failed || active.crashed) { const u = active.failed || active.url; active.crashed = false; go(u); return; }
  if (hard) active.view.webContents.reloadIgnoringCache(); else active.view.webContents.reload();
}
function zoom(step) {
  if (!active) return;
  const wc = active.view.webContents;
  const levels = [0.25, 0.33, 0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4, 5];
  const now = wc.getZoomFactor();
  let i = levels.findIndex((l) => l >= now - 0.001);
  if (i < 0) i = levels.length - 1;
  const to = step === 0 ? 1 : levels[Math.max(0, Math.min(levels.length - 1, i + step))];
  wc.setZoomFactor(to);
  // kept for the site (Chromium shares it between a site's tabs, but forgets it on quitting)
  const h = hostOf(active.url);
  if (h && webby(active.url) && !cur.private) {
    if (Math.abs(to - 1) < 0.001) delete settings.zoom[h]; else settings.zoom[h] = to;
    save("settings.json", settings);
  }
  tell();
}
function keepZoom(tab) {
  const z = settings.zoom[hostOf(tab.url)];
  const wc = tab.view.webContents;
  if (z && Math.abs(wc.getZoomFactor() - z) > 0.001) wc.setZoomFactor(z);
}

// ---- save the page (Ctrl+S): as in Chrome, the whole page with its files, or one .mhtml file;
// and a PDF straight away, without the print window's PDF printer
const SAVE_KINDS = [{ name: "웹 페이지, 전체", extensions: ["html", "htm"] }, { name: "웹 페이지, 단일 파일", extensions: ["mhtml"] }, { name: "PDF", extensions: ["pdf"] }];
async function savePageAs(tab = active) {
  if (!tab || !/^(https?|file):/i.test(tab.url || "")) return;
  const name = (tab.title || hostOf(tab.url) || "page").replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ").trim().slice(0, 120) || "page";
  const r = await dialog.showSaveDialog(win, { defaultPath: join(downloadDir(), name + ".html"), filters: SAVE_KINDS });
  if (!r.canceled && r.filePath) await savePageTo(tab, r.filePath);
}
// the file's ending picks the kind (the dialog puts the chosen kind's ending on the name)
async function savePageTo(tab, file) {
  const wc = tab.view.webContents, ext = parse(file).ext.toLowerCase();
  try {
    if (ext === ".pdf") writeFileSync(file, await wc.printToPDF({}));
    else await wc.savePage(file, ext === ".mhtml" ? "MHTML" : "HTMLComplete");
    return true;
  } catch (e) {
    log("페이지 저장 실패: " + e.message);
    if (!TEST) dialog.showMessageBox(win, { type: "warning", message: "페이지를 저장하지 못했어요", detail: e.message });
    return false;
  }
}
// ---- open a file (Ctrl+O): one in this tab, more each in a new tab after it, as in Chrome
async function openFiles() {
  const r = await dialog.showOpenDialog(win, { properties: ["openFile", "multiSelections"], filters: [
    { name: "웹 페이지·PDF·그림", extensions: ["html", "htm", "mhtml", "xhtml", "pdf", "svg", "png", "jpg", "jpeg", "gif", "webp", "txt"] }, { name: "모든 파일", extensions: ["*"] }] });
  if (!r.canceled) openPaths(r.filePaths);
}
function openPaths(paths, tab = active) {
  const urls = paths.map((p) => pathToFileURL(p).toString());
  if (!urls.length) return;
  if (tab) go(urls.shift(), tab);
  let after = tab;
  for (const u of urls) after = newTab(u, { after });
}
function star() {
  if (!active) return;
  const url = active.failed || active.url;
  if (!webby(url)) return;
  const i = bookmarks.findIndex((b) => b.url === url);
  if (i >= 0) { bookmarks.splice(i, 1); keepIcons(); } else bookmarks.push({ url, title: active.title || url, at: Date.now() });
  save("bookmarks.json", bookmarks);
  tell();
}
// Ctrl+Shift+D: every tab of the window kept (Chrome puts them in a folder; there are no folders here),
// none taken off
function starAll() {
  const at = Date.now();
  for (const t of tabs) {
    const url = t.failed || t.url;
    if (webby(url) && !bookmarks.some((b) => b.url === url)) bookmarks.push({ url, title: t.title || url, at });
  }
  save("bookmarks.json", bookmarks);
  tell();
}
// F3 and Ctrl+G, as in Chrome: the next (or last) match of the find box, opened if it was not
function findAgain(forward) {
  if (!findOpen || !cur?.findWords) return setFind(true);
  active?.view.webContents.findInPage(cur.findWords, { forward, findNext: true });
}
function setFind(open) {
  findOpen = open;
  if (!open) for (const t of tabs) t.view.webContents.stopFindInPage("clearSelection");
  layout();
  tell();
  if (open) { win.webContents.focus(); win.webContents.send("rove:focus-find"); }
}

// ---- the overlay ---------------------------------------------------------------------
function overlayOnTop() {
  if (overlay) { win.contentView.removeChildView(overlay); win.contentView.addChildView(overlay); }
}
// RobinPass opened a while after the vault was last fetched: fetched again first, as the
// Bitwarden extension does (a login put in on the phone is there without locking)
const PASS_FRESH = 5 * 60e3;
function freshPass() {
  if (pass?.status().state !== "open" || Date.now() - pass.syncedAt() < PASS_FRESH) return;
  pass.sync().then(() => everywhere(tell), (e) => log(`RobinPass: 다시 받기 못 함: ${e.message}`));
}
function showOverlay(what) {
  if (what.kind === "pass") freshPass();
  if (what.kind === "drawer" && what.panel === "downloads") checkFiles(); // a file deleted since shows as such
  overlayOn = what;
  overlay.setVisible(true);
  layout();
  // a key pressed the moment a window opens: its pop-over page is still loading and would miss it
  const wc = overlay.webContents, show = () => { wc.send("rove:overlay", what); if (what.kind !== "suggest" && what.kind !== "peek") wc.focus(); };
  if (wc.isLoading()) wc.once("did-finish-load", () => { if (overlayOn === what) show(); });
  else show();
}
function hideOverlay() {
  if (!overlayOn) return;
  const was = overlayOn.kind;
  overlayOn = null;
  if (was === "share") dropShare();
  overlay.setVisible(false);
  overlay.webContents.send("rove:overlay", null);
  win?.webContents.send("rove:overlay-closed", was);
}

// the start of a site already visited or kept, typed: the rest of its name (newest first), filled
// in the address bar as Chrome does ("git" -> "github.com"; www. left off unless typed)
function completion(text) {
  const q = text.toLowerCase();
  if (!q || /[\s/:]/.test(q)) return "";
  const off = settings.suggestOff; // ≡ 검색엔진's 주소창 추천
  for (const list of [off.includes("history") ? [] : history, off.includes("bookmark") ? [] : bookmarks]) for (let i = list.length - 1; i >= 0; i--) {
    if (!webby(list[i].url)) continue;
    const h = q.startsWith("www.") ? new URL(list[i].url).hostname : hostOf(list[i].url);
    if (h.startsWith(q) && h !== q) return h;
  }
  return "";
}
function suggestions(text, inline = "") {
  const q = text.trim().toLowerCase();
  if (!q) return [];
  const seen = new Set();
  const out = [];
  const take = (list, kind) => {
    if (settings.suggestOff.includes(kind)) return;
    for (let i = list.length - 1; i >= 0 && out.length < 7; i--) {
      const it = list[i];
      if (seen.has(it.url)) continue;
      const hay = (it.url + " " + (it.title || "")).toLowerCase();
      if (!hay.includes(q)) continue;
      seen.add(it.url);
      // icon: an open tab's own, else the site's kept one (icons.json), shown on history and tab rows
      out.push({ kind, url: it.url, title: it.title || it.url, icon: "icon" in it ? it.icon : siteIcons[hostOf(it.url)] || null, ...(it.tab ? { tab: it.tab } : {}) });
    }
  };
  // open tabs first, as Chrome's 탭으로 전환 (the page is there already): every window of the
  // same kind (a private window sees only private ones), not the tab in front of this one
  for (const w of windows) {
    if (w.gone || !!w.private !== !!cur?.private) continue;
    const front = w === cur ? active : null;
    take(w.tabs.filter((t) => t !== front && webby(t.url)).reverse().map((t) => ({ url: t.url, title: t.title, tab: t.id, icon: t.favicon || null })), "tab");
  }
  take(bookmarks, "bookmark");
  take(history, "history");
  const direct = toUrl(inline || text);
  const first = direct && !direct.startsWith(engine()[1]) ? { kind: "go", url: direct, title: direct } : { kind: "search", url: toUrl(text) || engine()[1] + encodeURIComponent(text.trim()), title: text.trim().replace(/^\?\s*/, "") };
  return [first, ...out.filter((o) => o.kind === "tab" || o.url !== first.url)].slice(0, 8);
}

// 탭으로 전환: that tab in front, in its own window (false: it is gone)
function toTab(id) {
  const w = windows.find((x) => !x.gone && x.tabs.some((t) => t.id === id));
  const t = w?.tabs.find((x) => x.id === id);
  if (!t) return false;
  if (w === cur) select(t);
  else { within(w, () => select(t)); if (w.win.isMinimized()) w.win.restore(); w.win.focus(); tell(); }
  return true;
}

function historyDays(q) {
  const s = (q || "").trim().toLowerCase();
  const list = [];
  for (let i = history.length - 1; i >= 0 && list.length < 400; i--) {
    const h = history[i];
    if (s && !(h.url + " " + h.title).toLowerCase().includes(s)) continue;
    list.push(h);
  }
  return list;
}

// ---- keys (from the top, the overlay and every page) --------------------------------
// fromBar: the key came from our own bar (the address bar, the tabs), not a page or the overlay
function keys(input, fromBar = false) {
  const f = keyAction(input, fromBar);
  if (f) f();
  return !!f;
}
// the shortcut a key is (a function to run), or null
function keyAction(input, fromBar = false) {
  if (input.type !== "keyDown") return null;
  const c = input.control || input.meta;
  const k = input.key.length === 1 ? input.key.toLowerCase() : input.key;
  const run = (f) => f;
  if (c && !input.shift && k === "t") return run(() => { newTab(HOME_PAGE); focusAddress(); });
  if (c && input.shift && k === "t") return run(reopenClosed);
  if (c && !input.shift && k === "n") return run(() => createWindow({}));
  if (c && input.shift && k === "n") return run(() => createWindow({ priv: true }));
  // Ctrl+Shift+W: the whole window, as in Chrome (Ctrl+Shift+T brings it back while another stays)
  if (c && input.shift && k === "w") return run(() => win.close());
  if (c && k === "w") return run(() => active && closeTab(active));
  const step = (d) => () => { const i = tabs.indexOf(active); select(tabs[(i + d + tabs.length) % tabs.length]); };
  if (c && k === "Tab") return run(step(input.shift ? -1 : 1));
  if (c && !input.shift && (k === "PageDown" || k === "PageUp")) return run(step(k === "PageDown" ? 1 : -1));
  if (c && input.shift && (k === "PageDown" || k === "PageUp")) return run(() => active && moveTab(active, tabs.indexOf(active) + (k === "PageDown" ? 1 : -1)));
  if (c && k === "F4") return run(() => active && closeTab(active));
  if (c && /^[1-9]$/.test(k)) return run(() => select(k === "9" ? tabs[tabs.length - 1] : tabs[Number(k) - 1]));
  if (c && input.shift && k === "l") return run(passQuick);
  // F6 goes back and forth between the address bar and the page, as in Chrome
  if (k === "F6" && !c && !input.alt && fromBar && active) return run(() => active.view.webContents.focus());
  if ((c && k === "l") || (input.alt && k === "d") || k === "F6") return run(focusAddress);
  // Ctrl+K, Ctrl+E: the address bar ready for a search (a leading ? there is one), as in Chrome, Brave
  if (c && !input.shift && (k === "k" || k === "e")) return run(() => focusAddress("?"));
  if ((c && k === "r") || k === "F5") return run(() => reload(input.shift || (c && k === "F5")));
  if (input.alt && k === "ArrowLeft") return run(() => active?.view.webContents.navigationHistory.goBack());
  if (input.alt && k === "ArrowRight") return run(() => active?.view.webContents.navigationHistory.goForward());
  if (c && input.shift && k === "d") return run(starAll);
  if (c && k === "d") return run(star);
  // keyed: opened from the keyboard, it is there at once (docs/brand.md V5.1)
  if (c && k === "h") return run(() => showOverlay({ kind: "drawer", panel: "history", keyed: true }));
  if (c && k === "j") return run(() => showOverlay({ kind: "drawer", panel: "downloads", keyed: true }));
  if (c && input.shift && k === "o") return run(() => showOverlay({ kind: "drawer", panel: "bookmarks", keyed: true }));
  if (c && input.shift && k === "a") return run(() => showOverlay({ kind: "tabs", keyed: true }));
  if (k === "F9") return run(() => read());
  if (c && k === "f") return run(() => setFind(true));
  if (k === "F3" || (c && k === "g")) return run(() => findAgain(!input.shift));
  if (c && !input.shift && k === "u") return run(() => webby(active?.url) && newTab("view-source:" + active.url, { after: active }));
  if (input.alt && k === "Home") return run(() => go(HOME_PAGE));
  if (input.alt && !c && (k === "f" || k === "e")) return run(() => showOverlay({ kind: "menu", keyed: true }));
  if (c && k === "p") return run(() => active?.view.webContents.print());
  if (c && !input.shift && k === "s") return run(() => savePageAs());
  if (c && !input.shift && k === "o") return run(openFiles);
  if (c && (k === "=" || k === "+")) return run(() => zoom(1));
  if (c && k === "-") return run(() => zoom(-1));
  if (c && k === "0") return run(() => zoom(0));
  if (k === "F11") return run(() => { fullTab = null; win.setFullScreen(!win.isFullScreen()); });
  if (k === "F12" || (c && input.shift && k === "i")) return run(() => active?.view.webContents.toggleDevTools());
  // an extension's shortcut (Rove's own above stay Rove's): before the page, as Chrome's are.
  // Its popup comes from its toolbar button, so it sits under the button as when clicked.
  const ext = active && exts?.key(input, active.view.webContents);
  if (ext) return Object.assign(ext.run || (() => win.webContents.executeJavaScript(`document.getElementById("actions").shadowRoot?.getElementById(${JSON.stringify(ext.action)})?.click()`).catch(() => {})), { now: true });
  // the suggestions under the address bar: its own Esc closes them (and takes back what it filled in)
  if (k === "Escape" && overlayOn && !(fromBar && overlayOn.kind === "suggest")) return run(hideOverlay);
  if (k === "Escape" && findOpen) return run(() => setFind(false));
  if (k === "Escape" && !fromBar && active?.view.webContents.isLoading()) return run(() => active.view.webContents.stop());
  return null;
}

// ---- keys a page has first (as in Chrome) ------------------------------------------------
// Chrome gives a page its keys before its own shortcuts but for a few it keeps (new tab or
// window, close, reopen, switch tabs; RobinPass's fill is an extension's key there, before the
// page too), so a web app's Ctrl+F or Ctrl+H (Google Docs' find, replace) is the app's. A listener
// in an isolated world, in the page and its same-site frames, says after each such key whether
// the page took it (defaultPrevented), and Rove runs its shortcut when not. No word in KEY_WAIT ms
// (a frame of another site, a PDF, a page not ready yet): Rove runs it, as before. The word
// carries a secret the page cannot see and says only taken or not: the key is the one Rove got.
// De-AMP (Brave, on by default): a page made in AMP (<html amp> or <html ⚡>) goes to the page it is
// a copy of, its rel=canonical — the publisher's own, not one Google's AMP scripts show. Brave looks
// while the page loads; here when it is read (dom-ready), in its place (replace: Back does not land
// on it again). AMP cache addresses (google.com/amp/s/…) are bounce.json's, before the page. Only to
// http(s), only with blocking on for the site, at most once in AMP_GAP ms in a tab (no A→B→A loop).
const AMP_WORLD = 1005;
const AMP_GAP = 5000;
const AMP_READ = `(() => { const h = document.documentElement;
  if (!h || !(h.hasAttribute("amp") || h.hasAttribute("\\u26a1"))) return null;
  const l = document.querySelector('link[rel~="canonical"][href]'); return l ? l.href : null; })()`;
async function unAmp(tab, wc) {
  const at = wc.getURL();
  if (!settings.block || !webby(at) || allowedFor(hostOf(at), tab.w?.private) || Date.now() - (tab.unAmpedAt || 0) < AMP_GAP) return;
  let to;
  try { to = await wc.executeJavaScriptInIsolatedWorld(AMP_WORLD, [{ code: AMP_READ }]); } catch { return; }
  if (!to || wc.isDestroyed() || wc.getURL() !== at) return;
  let u;
  try { u = new URL(to); } catch { return; }
  if (!/^https?:$/.test(u.protocol) || u.href.split("#")[0] === at.split("#")[0]) return;
  tab.unAmpedAt = Date.now();
  log(`AMP 대신 원래 쪽: ${siteInLog(tab.w?.private, at)}`);
  wc.executeJavaScriptInIsolatedWorld(AMP_WORLD, [{ code: `location.replace(${JSON.stringify(u.href)})` }]).catch(() => {});
}
const KEY_WORLD = 1004;
const KEY_WAIT = 400;
const KEY_WORD = `rove-key:${crypto.randomUUID()}:`;
// each frame element is watched once: the observer runs on every change of a page that keeps
// changing (mail, chat), and a load listener added each time piled up without end
const KEY_LISTENER = `(() => {
  const seen = new WeakSet();
  const hook = (w) => {
    if (!w || w.__roveKeys) return;
    w.__roveKeys = true;
    w.addEventListener("keydown", (e) => {
      if (!(e.ctrlKey || e.metaKey || e.altKey || /^(F\\d+|Escape)$/.test(e.key))) return;
      setTimeout(() => console.debug(${JSON.stringify(KEY_WORD)} + (e.defaultPrevented ? "1" : "0") + e.key), 0);
    }, true);
    const frames = () => { for (const f of w.document.querySelectorAll("iframe")) { if (seen.has(f)) continue; seen.add(f); f.addEventListener("load", () => { try { hook(f.contentWindow); } catch {} }); try { hook(f.contentWindow); } catch {} } };
    new w.MutationObserver(frames).observe(w.document, { subtree: true, childList: true });
    frames();
  };
  hook(window);
})()`;
function reserved(input) {
  const c = input.control || input.meta;
  const k = input.key.length === 1 ? input.key.toLowerCase() : input.key;
  // and the ways out a page must not stop: full screen (F11) and the developer tools
  return (c && (k === "t" || k === "n" || k === "w" || k === "Tab" || k === "F4" || (!input.shift && (k === "PageUp" || k === "PageDown")) || (input.shift && (k === "l" || k === "i")))) || k === "F11" || k === "F12";
}
function pageKey(tab, e, input) {
  const f = keyAction(input);
  if (!f) return;
  if (f.now || reserved(input)) { e.preventDefault(); f(); return; }
  const wait = { key: input.key, f };
  tab.keysWaiting = [...(tab.keysWaiting || []), wait];
  wait.timer = setTimeout(() => { tab.keysWaiting = tab.keysWaiting.filter((x) => x !== wait); runKey(tab, f); }, KEY_WAIT);
}
function keyWord(tab, message) {
  if (!message.startsWith(KEY_WORD)) return;
  const taken = message[KEY_WORD.length] === "1";
  const key = message.slice(KEY_WORD.length + 1);
  const wait = (tab.keysWaiting || []).find((x) => x.key === key);
  if (!wait) return;
  tab.keysWaiting = tab.keysWaiting.filter((x) => x !== wait);
  clearTimeout(wait.timer);
  if (!taken) runKey(tab, wait.f);
}
// a shortcut run later: in the tab's window (others may be in use by then), not after it is gone
function runKey(tab, f) {
  if (!tab.w || tab.w.gone || !tab.w.tabs.includes(tab)) return;
  use(tab.w);
  f();
}
// text: put in it with the caret after (Ctrl+K's "?"), instead of the address selected
function focusAddress(text) {
  hideOverlay();
  win.webContents.focus();
  win.webContents.send("rove:focus-address", typeof text === "string" ? text : null);
}

// ---- messages from our two views ---------------------------------------------------
function whose(e) {
  return windows.find((w) => !w.gone && (e.sender === w.win.webContents || e.sender === w.overlay?.webContents)) || null;
}
const on = (name, f) => ipcMain.on(name, (e, ...a) => { const w = whose(e); if (w) { use(w); f(...a); } });
const handle = (name, f) => ipcMain.handle(name, (e, ...a) => { const w = whose(e); if (!w) return null; use(w); return f(...a); });
function messages() {
  handle("rove:state", () => snapshot());
  on("rove:go", (text, how) => { hideOverlay(); goIn(String(text), how); });
  on("rove:new-tab", (url) => { hideOverlay(); newTab(url ? toUrl(String(url)) : HOME_PAGE); if (!url) focusAddress(); });
  on("rove:select", (id) => select(tabs.find((t) => t.id === id)));
  on("rove:close", (id) => { const t = tabs.find((x) => x.id === id); if (t) closeTab(t); });
  on("rove:back", () => active?.view.webContents.navigationHistory.goBack());
  on("rove:forward", () => active?.view.webContents.navigationHistory.goForward());
  on("rove:reload", (hard) => reload(!!hard));
  on("rove:stop", () => active?.view.webContents.stop());
  on("rove:home", () => go(HOME_PAGE));
  on("rove:star", star);
  on("rove:zoom", (step) => zoom(Number(step) || 0));
  on("rove:find", (text, forward, next) => {
    if (!active) return;
    cur.findWords = String(text || "");
    if (!text) { active.view.webContents.stopFindInPage("clearSelection"); win.webContents.send("rove:found", { at: 0, of: 0 }); return; }
    active.view.webContents.findInPage(String(text), { forward: forward !== false, findNext: !!next });
  });
  on("rove:find-open", (open) => setFind(!!open));
  on("rove:mute", (id) => mute(tabs.find((t) => t.id === id)));
  on("rove:tab-menu", (id) => tabMenu(tabs.find((t) => t.id === id)));
  on("rove:move", (id, to) => { const t = tabs.find((x) => x.id === id); if (t && Number.isInteger(to)) moveTab(t, to); });
  on("rove:print", () => { hideOverlay(); active?.view.webContents.print(); });
  on("rove:save-page", () => { hideOverlay(); savePageAs(); });
  on("rove:focus-page", () => active?.view.webContents.focus());
  on("rove:suggest", (text, rect, fill) => {
    const typed = String(text || ""), inline = fill ? completion(typed) : "";
    const items = suggestions(typed, inline);
    win.webContents.send("rove:suggested", items, typed, inline);
    if (!items.length) { if (overlayOn?.kind === "suggest") hideOverlay(); return; }
    const height = 8 + items.length * 36;
    showOverlay({ kind: "suggest", items, sel: 0, rect: { x: rect.x, y: rect.y, width: rect.width, height } });
  });
  // the tabs folded to icons, the pointer resting on them: the list as wide as unfolded, laid over
  // the page (which does not move), as Brave's expand on hover; gone once the pointer is off it
  on("rove:peek", (rect, scroll) => {
    if (!settings.vertical || !settings.narrow || overlayOn || fullTab) return;
    const what = { kind: "peek", scroll: Number(scroll) || 0, rect: { x: 0, y: Math.round(Number(rect?.y) || 0), width: SIDE_W, height: Math.round(Number(rect?.height) || 0) } };
    showOverlay(what);
    const w = cur, t = setInterval(() => {
      if (w.gone) return clearInterval(t);
      within(w, () => {
        if (overlayOn !== what) return clearInterval(t);
        const p = screen.getCursorScreenPoint(), b = win.getContentBounds(), r = what.rect, x = p.x - b.x, y = p.y - b.y;
        if (x < r.x || x >= r.x + r.width || y < r.y || y >= r.y + r.height) { clearInterval(t); hideOverlay(); }
      });
    }, 150);
  });
  on("rove:suggest-sel", (sel) => { if (overlayOn?.kind === "suggest") { overlayOn.sel = sel; overlay.webContents.send("rove:overlay", overlayOn); } });
  on("rove:overlay", (what) => { if (what) showOverlay(what); else hideOverlay(); });
  on("rove:open", (url, inNew, tabId) => { hideOverlay(); if (!inNew && tabId && toTab(tabId)) return; if (inNew === "window") createWindow({ priv: !!cur?.private, urls: [String(url)] }); else if (inNew) newTab(String(url)); else go(String(url)); });
  on("rove:devtools", () => active?.view.webContents.toggleDevTools());
  on("rove:full", () => { fullTab = null; win.setFullScreen(!win.isFullScreen()); });
  handle("rove:history", (q) => historyDays(q).map(withIcon));
  handle("rove:bookmarks", (q) => { const s = String(q || "").trim().toLowerCase(); return bookmarks.filter((b) => !s || (b.url + " " + b.title).toLowerCase().includes(s)).reverse().map(withIcon); });
  on("rove:bookmark-rename", (url, title) => { const b = bookmarks.find((x) => x.url === url); if (!b || typeof title !== "string") return; b.title = title.trim().slice(0, 300) || b.url; save("bookmarks.json", bookmarks); tell(); });
  handle("rove:closed", () => closed.filter((u) => !u.urls).slice(-10).reverse().map((u) => u.url));
  handle("rove:import-from", () => importSources().map(({ list, ...x }) => x));
  handle("rove:import", (id) => importFrom(String(id)));
  on("rove:read", () => read());
  on("rove:new-window", () => { hideOverlay(); createWindow({}); });
  on("rove:new-private", () => { hideOverlay(); createWindow({ priv: true }); });
  on("rove:tear", (id, x, y) => { const t = tabs.find((v) => v.id === id); if (t && Number.isFinite(x) && Number.isFinite(y)) tear(t, x, y); });
  on("rove:vertical", (yes) => setVertical(!!yes));
  on("rove:narrow", (yes) => setNarrow(!!yes));
  on("rove:group-fold", (id) => groupFold(Number(id)));
  on("rove:group-set", (id, what) => groupSet(Number(id), what && typeof what === "object" ? { name: typeof what.name === "string" ? what.name : undefined, color: String(what.color || "") } : {}));
  on("rove:group-ungroup", (id) => { hideOverlay(); ungroup(Number(id)); });
  on("rove:group-close", (id) => { hideOverlay(); groupClose(Number(id)); });
  on("rove:group-new-tab", (id) => { hideOverlay(); const m = members(Number(id)); if (m.length) newTab(HOME_PAGE, { after: m[m.length - 1] }); });
  on("rove:split-ratio", (r) => splitRatio(Number(r)));
  on("rove:unsplit", unsplit);
  on("rove:sleep", (yes) => { settings.sleep = !!yes; save("settings.json", settings); tell(); });
  // ≡ 검색엔진: a list to choose from, by the pointer, and under it what the address bar suggests
  // from, each turned off on its own as in Brave's settings › search (all on at first)
  on("rove:engine-menu", () => popup([...Object.entries(ENGINES).map(([k, [name]]) => ({ label: name, type: "radio", checked: engine() === ENGINES[k], click: () => {
    settings.engine = k;
    save("settings.json", settings);
    for (const t of tabs) if (t.view.webContents.getURL() === HOME_PAGE) t.view.webContents.reload(); // its field says the engine
    everywhere(tell);
  } })), { type: "separator" }, { label: "주소창 추천", enabled: false },
  ...[["history", "방문 기록"], ["bookmark", "즐겨찾기"], ["tab", "열린 탭"]].map(([kind, label]) => ({ label, type: "checkbox", checked: !settings.suggestOff.includes(kind), click: () => {
    const off = settings.suggestOff;
    settings.suggestOff = off.includes(kind) ? off.filter((x) => x !== kind) : [...off, kind];
    save("settings.json", settings);
  } }))]));
  on("rove:start", (last) => { settings.start = last ? "last" : "home"; save("settings.json", settings); tell(); });
  on("rove:forget", (url) => { history = history.filter((h) => h.url !== url); save("history.json", history); keepIcons(); });
  on("rove:forget-all", () => { history = []; save("history.json", history, true); keepIcons(true); });
  on("rove:unstar", (url) => { bookmarks = bookmarks.filter((b) => b.url !== url); save("bookmarks.json", bookmarks); keepIcons(); tell(); });
  // a file gone since: no open, the list shows it as deleted
  const withFile = (id, then) => { const d = downloads.find((x) => x.id === id); if (d?.state !== "completed") return;
    there(d.path).then((ok) => { if (ok) then(d.path); else { filesGone.add(d.id); tell(); } }); };
  on("rove:download-open", (id) => withFile(id, (p) => shell.openPath(p)));
  on("rove:download-show", (id) => withFile(id, (p) => shell.showItemInFolder(p)));
  // stopped, cancelled or deleted: the same address again from the start, as Chrome's 다시 시도 (its row
  // gives way to the new one); a private one only while its private session is still there
  on("rove:download-retry", (id) => {
    const d = downloads.find((x) => x.id === id);
    if (!d || d.state === "progressing" || d.asking || !webby(d.url) || (d.state === "completed" && !filesGone.has(d.id))) return;
    const ses = d.private ? privateSes : rove();
    if (!ses) return;
    d.item?.cancel(); // a stopped one Chromium still holds: let it go, not two of one file
    downloads = downloads.filter((x) => x !== d);
    saveDownloads();
    ses.downloadURL(d.url);
    tell();
  });
  on("rove:download-cancel", (id) => { const d = downloads.find((x) => x.id === id); d?.item?.cancel(); });
  on("rove:download-dir", () => pickDownloadDir());
  on("rove:downloads-clear", () => { downloads = downloads.filter((d) => d.state === "progressing" || !mineKind(d)); saveDownloads(); tell(); });
  on("rove:keys", (input) => keys(input || {}));
  on("rove:answer", (id, yes, keep) => answer(Number(id), !!yes, keep !== false));
  handle("rove:sites", () => Object.entries(gr()).map(([origin, g]) => ({ origin, host: hostOf(origin) || origin, ...g })).concat([...new Set([...settings.allow, ...(cur?.private ? privSites.allow : [])])].map((h) => ({ origin: "", host: h, ads: false }))));
  on("rove:forget-site", (origin, key) => forgetSite(String(origin), key ? String(key) : null));
  on("rove:unallow", (host) => {
    privSites.allow = privSites.allow.filter((h) => h !== String(host));
    if (settings.allow.includes(String(host))) { settings.allow = settings.allow.filter((h) => h !== String(host)); save("settings.json", settings); }
    tell();
  });
  on("rove:block", (on, site) => setBlock(!!on, site ? active?.url : null));
  on("rove:awake", (on) => setAwake(!!on));
  on("rove:share", (id, pick, audio) => shareAnswer(Number(id), pick && typeof pick === "object" ? { kind: String(pick.kind), id: pick.kind === "tab" ? Number(pick.id) : String(pick.id) } : null, !!audio));
  handle("rove:site", () => siteInfo());
  handle("rove:extensions", () => exts?.list() || []);
  handle("rove:extension-on", (id, yes) => exts?.setOn(String(id), !!yes).catch((e) => { log(`확장 프로그램을 못 켜고 끔: ${e.message}`); return false; }) ?? false);
  handle("rove:extension-remove", (id) => exts?.remove(String(id)).catch((e) => { log(`확장 프로그램을 못 지움: ${e.message}`); return false; }) ?? false);
  on("rove:extension-options", (id) => { const u = exts?.options(String(id)); if (u) { hideOverlay(); newTab(u); } });
  on("rove:site-set", (origin, key, value) => setSite(String(origin), String(key), String(value)));
  handle("rove:site-clear", () => clearSite());
  on("rove:default", () => { hideOverlay(); makeDefault().then(checkDefault); });
  handle("rove:pass-login", async (email, password, second) => { const r = await pass.login(String(email || ""), String(password || ""), second || null); tell(); return r; });
  handle("rove:pass-unlock", async (password) => { const r = await pass.unlock(String(password || "")); tell(); return r; });
  handle("rove:pass-items", (q) => passItems(q));
  handle("rove:pass-fill", (id, master) => passFill(String(id), active, master));
  handle("rove:pass-copy", (id, what, master) => passCopy(String(id), String(what), master));
  handle("rove:pass-codes", (q) => passCodes(String(q || "")));
  handle("rove:pass-peek", () => passPeek());
  handle("rove:pass-save", (name) => passSave(String(name || "")));
  handle("rove:pass-sync", async () => { let count; try { count = await pass.sync(); } catch (e) { return { error: e.message }; } tell(); return { ok: true, count }; });
  on("rove:pass-lock", () => { pass.lock(); peeked = null; tell(); });
  on("rove:pass-logout", () => { pass.logout(); peeked = null; tell(); });
  on("rove:relaunch", () => {
    if (!updates?.state().ready) return;
    app.relaunch({ execPath: updates.exe(), args: [AGAIN] });
    app.quit();
  });
  // ≡ "업데이트 확인": now, as Brave and Chrome check when their About page opens (not only every 6 h)
  on("rove:update-check", () => { updates?.check(); });
  on("rove:win", (what) => { if (what === "min") win.minimize(); else if (what === "max") (win.isMaximized() ? win.unmaximize() : win.maximize()); else if (what === "close") win.close(); });
}
const plain = (d) => ({ id: d.id, name: d.name, path: d.path, url: d.url, received: d.received, total: d.total, state: d.state, at: d.at, ...(d.asking ? { asking: asks.find((a) => a.d === d)?.id || true } : {}) }); // asking: its ask's id, answered from the downloads list too

// ---- bookmarks from another browser --------------------------------------------------
// The Chromium ones keep theirs in <User Data>/<profile>/Bookmarks (JSON); a
// profile's name is in <User Data>/Local State. Firefox and its kin keep theirs in
// <profile>/places.sqlite, read from a copy (Firefox holds the file while it runs).
// Folders are not kept (ours is one list).
function importSources() {
  const local = process.env.ROVE_IMPORT_ROOT || process.env.LOCALAPPDATA || "";
  const roaming = process.env.ROVE_IMPORT_ROOT || process.env.APPDATA || "";
  if (!local) return [];
  const browsers = [["chrome", "Chrome", join(local, "Google", "Chrome", "User Data")], ["edge", "Edge", join(local, "Microsoft", "Edge", "User Data")],
    ["brave", "Brave", join(local, "BraveSoftware", "Brave-Browser", "User Data")], ["vivaldi", "Vivaldi", join(local, "Vivaldi", "User Data")],
    ["opera", "Opera", join(roaming, "Opera Software", "Opera Stable")]];
  const out = [];
  for (const [key, name, dir] of browsers) {
    if (!existsSync(dir)) continue;
    let names = {};
    try { names = JSON.parse(readFileSync(join(dir, "Local State"), "utf8")).profile?.info_cache || {}; } catch { /* none */ }
    const profiles = key === "opera" ? [""] : ["Default", ...Object.keys(names).filter((p) => p !== "Default")];
    for (const p of profiles) {
      const list = marks(join(dir, p, "Bookmarks"));
      if (!list) continue;
      const shown = profiles.length > 1 && names[p]?.name ? `${name} · ${names[p].name}` : name;
      out.push({ id: `${key}:${p}`, name: shown, count: list.length, fresh: list.filter((b) => !bookmarks.some((x) => x.url === b.url)).length, list });
    }
  }
  const geckos = [["firefox", "Firefox", join(roaming, "Mozilla", "Firefox")], ["zen", "Zen", join(roaming, "zen")], ["librewolf", "LibreWolf", join(roaming, "librewolf")]];
  for (const [key, name, dir] of geckos) {
    let ini = "";
    try { ini = readFileSync(join(dir, "profiles.ini"), "utf8"); } catch { continue; }
    const profiles = ini.split(/\r?\n(?=\[)/).filter((b) => /^\[Profile/.test(b)).map((b) => {
      const v = (k) => b.match(new RegExp(`^${k}=(.*)$`, "m"))?.[1]?.trim();
      return { name: v("Name") || "", path: v("IsRelative") === "0" ? v("Path") : join(dir, v("Path") || "") };
    }).filter((x) => x.path);
    const found = profiles.map((p) => ({ ...p, list: places(join(p.path, "places.sqlite")) })).filter((p) => p.list?.length);
    for (const p of found) {
      const shown = found.length > 1 && p.name ? `${name} · ${p.name}` : name;
      out.push({ id: `${key}:${p.path}`, name: shown, count: p.list.length, fresh: p.list.filter((b) => !bookmarks.some((x) => x.url === b.url)).length, list: p.list });
    }
  }
  return out;
}
function places(f) {
  if (!existsSync(f)) return null;
  const tmp = join(app.getPath("temp"), `rove-places-${process.pid}-${Date.now()}`);
  try {
    mkdirSync(tmp, { recursive: true });
    copyFileSync(f, join(tmp, "places.sqlite"));
    if (existsSync(f + "-wal")) copyFileSync(f + "-wal", join(tmp, "places.sqlite-wal")); // what Firefox has not folded in yet
    const { DatabaseSync } = require("node:sqlite");
    const db = new DatabaseSync(join(tmp, "places.sqlite"));
    try {
      return db.prepare("SELECT p.url AS url, b.title AS title FROM moz_bookmarks b JOIN moz_places p ON p.id = b.fk WHERE b.type = 1 ORDER BY b.dateAdded DESC").all()
        .reduce((m, r) => { if (webby(r.url) && !m.get(r.url)?.title) m.set(r.url, r); return m; }, new Map()) // a tag is the same place once more, untitled
        .values().map((r) => ({ url: r.url, title: String(r.title || r.url) })).toArray();
    } finally { db.close(); }
  } catch { return null; } finally { rmSync(tmp, { recursive: true, force: true }); }
}
function marks(f) {
  let data;
  try { data = JSON.parse(readFileSync(f, "utf8")); } catch { return null; }
  const out = [];
  const walk = (n) => {
    if (!n || typeof n !== "object") return;
    // the same page in two folders is one bookmark here (the count shown is what comes in)
    if (n.type === "url" && webby(n.url) && !out.some((b) => b.url === n.url)) out.push({ url: n.url, title: String(n.name || n.url) });
    for (const c of n.children || []) walk(c);
  };
  for (const r of Object.values(data.roots || {})) walk(r);
  return out;
}
function importFrom(id) {
  const src = importSources().find((x) => x.id === id);
  if (!src) return { error: "찾지 못했어요" };
  const have = new Set(bookmarks.map((b) => b.url));
  let added = 0;
  const at = Date.now() - src.list.length;
  for (const b of src.list) if (!have.has(b.url)) { have.add(b.url); bookmarks.unshift({ ...b, at: at + added }); added++; }
  save("bookmarks.json", bookmarks);
  log(`즐겨찾기 가져옴: ${src.name} ${added}개`);
  tell();
  return { ok: true, added, name: src.name };
}

// ---- downloads ----------------------------------------------------------------------
// where they go: the folder picked in the downloads drawer (Chrome's and Brave's 위치 · 변경), else
// Windows' own Downloads; a picked one that is gone (a drive taken out) falls back, the pick kept
const defaultDownloadDir = () => (TEST ? join(home, "downloads") : app.getPath("downloads"));
// the sync look is only for a file coming down or a dialog opening (someone just asked for it)
const downloadDir = () => {
  try { dirOk = !!(settings.downloadDir && statSync(settings.downloadDir, { throwIfNoEntry: false })?.isDirectory()); }
  catch { dirOk = false; } // a share that is off: UNKNOWN, not "no entry"
  return dirOk ? settings.downloadDir : defaultDownloadDir();
};
// The state pushed on every change never looks at the disk itself: a file or picked folder on a network
// share that is off blocks a look for about 20 s (again every ~50 s), and that was the whole of Rove
// frozen. These are looked at off the main thread when the downloads drawer opens, and kept.
let dirOk = true; // the picked folder is there (until a look says not)
let filesGone = new Set(); // ids of finished downloads whose file was deleted or moved away
const there = (p, dir = false) => stat(p).then((s) => (dir ? s.isDirectory() : true), () => false);
let checking = null;
function checkFiles() {
  checking ??= (async () => {
    const done = downloads.filter((d) => d.state === "completed");
    const [ok, gone] = await Promise.all([settings.downloadDir ? there(settings.downloadDir, true) : true,
      Promise.all(done.map((d) => there(d.path))).then((r) => new Set(done.filter((_, i) => !r[i]).map((d) => d.id)))]);
    const changed = ok !== dirOk || gone.size !== filesGone.size || [...gone].some((id) => !filesGone.has(id));
    dirOk = ok;
    filesGone = gone;
    if (changed) tell();
  })().finally(() => { checking = null; });
  return checking;
}
async function pickDownloadDir() {
  const r = await dialog.showOpenDialog(win, { title: "받는 곳", defaultPath: downloadDir(), properties: ["openDirectory", "createDirectory"] });
  if (r.canceled || !r.filePaths?.[0]) return;
  settings.downloadDir = r.filePaths[0];
  dirOk = true;
  save("settings.json", settings);
  tell();
}
function freePath(dir, name) {
  const p = parse(name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_") || "download");
  let candidate = join(dir, p.base);
  // one still coming in has no file yet but has its name
  const taken = (f) => existsSync(f) || downloads.some((d) => d.state === "progressing" && d.path === f);
  for (let n = 1; taken(candidate); n++) candidate = join(dir, `${p.name} (${n})${p.ext}`);
  return candidate;
}
// files that run when opened: they come down into Rove's own folder and wait
// in the ask bar; only a yes puts them in Downloads
const RUNS = { program: /\.(exe|msi|msix|msixbundle|appx|appxbundle|appinstaller|com|scr|pif|cpl|dll|sys|xll|jar|jnlp|application|appref-ms|msp|msc|gadget|diagcab)$/i,
  // the shell's own files run too: a settings or search shortcut, a scriptlet, a PowerShell type file
  script: /\.(bat|cmd|ps1|psm1|psd1|ps1xml|ps2xml|psc1|psc2|msh|msh1|msh2|mshxml|msh1xml|msh2xml|vbs|vbe|js|jse|ws|wsf|wsh|wsc|sct|hta|reg|lnk|url|scf|inf|chm|settingcontent-ms|search-ms|searchconnector-ms|library-ms)$/i,
  disk: /\.(iso|img|vhd|vhdx)$/i };
const runs = (name) => Object.keys(RUNS).find((k) => RUNS[k].test(name)) || null;
function move(from, to) {
  try { renameSync(from, to); } catch { copyFileSync(from, to); unlinkSync(from); }
}
// Windows' mark on a file from the internet (what SmartScreen and Office look at)
function markWeb(path, url, referrer) {
  const web = (u) => (webby(u) ? u : "about:internet");
  try { writeFileSync(`${path}:Zone.Identifier`, `[ZoneTransfer]\r\nZoneId=3\r\nReferrerUrl=${web(referrer)}\r\nHostUrl=${web(url)}\r\n`); } catch { /* not NTFS */ }
}
function downloadsTo(ses, priv = false) {
  ses.on("will-download", (e, item, wc) => {
    const from = tabOf(wc);
    if (from) use(from.w);
    const to = downloadDir();
    mkdirSync(to, { recursive: true });
    const kind = runs(item.getFilename());
    const d = { id: nextId++, item, name: "", path: freePath(to, item.getFilename()), url: item.getURL(), received: 0, total: item.getTotalBytes(), state: "progressing", at: Date.now(), runs: kind, private: priv };
    d.name = parse(d.path).base;
    let referrer = "";
    try { referrer = wc?.getURL() || ""; } catch { /* gone */ }
    d.referrer = referrer;
    if (kind) {
      const held = join(home, "held");
      mkdirSync(held, { recursive: true });
      d.held = join(held, `${d.id}-${d.name}`);
      d.asking = true;
      item.setSavePath(d.held);
      asks.push({ id: nextId++, kind: "download", tab: null, host: hostOf(d.url), what: [kind], name: d.name, d });
    } else item.setSavePath(d.path);
    downloads.push(d);
    item.on("updated", (ev, state) => { d.received = item.getReceivedBytes(); d.total = item.getTotalBytes(); d.state = state === "interrupted" ? "interrupted" : "progressing"; tell(); });
    item.once("done", (ev, state) => {
      d.received = item.getReceivedBytes();
      delete d.item;
      d.done = state;
      if (!d.held) finish(d, state);
      else if (state !== "completed") { d.asking = false; asks = asks.filter((a) => a.d !== d); finish(d, state); everywhere(layout); }
      else if (d.keep !== undefined) settle(d);
      // else: it waits for the answer
      tell();
    });
    everywhere(layout); // a program waiting is asked about in every window
    tell();
  });
}
function finish(d, state) {
  d.state = state;
  if (state === "completed") markWeb(d.path, d.url, d.referrer);
  if (d.private && !privateSes) downloads = downloads.filter((x) => x !== d); // its private windows are all closed
  saveDownloads();
}
// a private window's downloads are listed in private windows only, a normal one's in normal ones (in Chrome
// and Brave each kind of window has its own list)
const mineKind = (d) => !!d.private === !!cur?.private;
const saveDownloads = (now) => save("downloads.json", downloads.filter((d) => !d.private).map(plain), now);
// the answer and the file are both there
function settle(d) {
  if (d.keep) {
    if (existsSync(d.path)) d.path = freePath(parse(d.path).dir, d.name); // taken while it waited
    d.name = parse(d.path).base;
    try { move(d.held, d.path); finish(d, "completed"); } catch { finish(d, "interrupted"); }
  } else {
    try { unlinkSync(d.held); } catch { /* gone */ }
    finish(d, "cancelled");
  }
  delete d.held;
}
function keepDownload(d, keep) {
  d.keep = keep;
  d.asking = false;
  if (!keep && d.item) d.item.cancel(); // its done comes with "cancelled"
  else if (d.done === "completed") settle(d);
}

// ---- start ---------------------------------------------------------------------------
// the pages' own sessions (tab: true) get the new tab and what it uses, nothing else of ours.
// newtab.json: no visits from a private window's (priv)
const FOR_TABS = /^\/(newtab\.(html|js|css)|robin-ui\.css|icons\.svg|fonts\/.+)$/;
function serveUi(p = protocol, { tab = false, priv = false } = {}) {
  p.handle("rove", (req) => {
    const u = new URL(req.url);
    if (u.host !== "ui") return new Response("", { status: 404 });
    if (tab && u.pathname === "/newtab.json") return Response.json({ engine: engine()[0], sites: priv ? [] : topSites(), links: config.links || [] });
    let path = "";
    try { path = normalize(join(UI, decodeURIComponent(u.pathname))); } catch { /* a broken % */ }
    if (!path.startsWith(UI + sep)) return new Response("", { status: 404 });
    // the pages' list is matched on the path as read: fonts/..%2fui.js is ui.js, not a font
    if (tab && !FOR_TABS.test("/" + relative(UI, path).split(sep).join("/"))) return new Response("", { status: 404 });
    return net.fetch(pathToFileURL(path).toString());
  });
}

// the new tab's tiles: the sites gone to most (by visits kept in history), eight
function topSites() {
  const n = {};
  for (const h of history) {
    const host = hostOf(h.url);
    if (!host || !webby(h.url)) continue;
    (n[host] ||= { url: new URL(h.url).origin + "/", host, count: 0 }).count++;
  }
  return Object.values(n).sort((a, b) => b.count - a.count).slice(0, 8).map(({ url, host }) => ({ url, host, icon: siteIcons[host] || null }));
}

// ---- RobinPass (vault.cjs) ----------------------------------------------------------------
// The vault is opened in this process only. Our screens get names and user
// names; a password goes from here into the page (an isolated world: the
// page's own scripts never see ours) or onto the clipboard, never to a screen.
const PASS = process.env.ROVE_PASS_SERVER || config.pass;
const { matches } = require("./vault.cjs");
let pass = null;
let peeked = null; // what the page had typed, kept here until saved: { url, username, password }
function passStart() {
  const ses = session.fromPartition("rove-pass"); // in memory, ours alone
  cleanAgent(ses);
  if (TEST && /^https:\/\/localhost:/.test(PASS)) ses.setCertificateVerifyProc((req, done) => done(req.hostname === "localhost" ? 0 : -3));
  const protect = {
    seal: (s) => (safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(s).toString("base64") : null),
    open: (s) => { try { return s ? safeStorage.decryptString(Buffer.from(s, "base64")) : null; } catch { return null; } },
  };
  pass = require("./vault.cjs").vault({ fetch: (u, o) => ses.fetch(u, o), file: file("pass.json"), protect, server: PASS, log });
  // locked with the screen
  for (const e of ["lock-screen", "suspend"]) powerMonitor.on(e, () => { pass.lock(); peeked = null; tell(); });
}
// and after the PC is left alone a while (Bitwarden's vault timeout): whoever sits down at it
// gets the master password asked, not the vault (the screen lock may be off, or a long way off)
const PASS_IDLE = 15 * 60; // seconds
function passIdle() {
  if (pass?.status().state !== "open" || powerMonitor.getSystemIdleTime() < PASS_IDLE) return false;
  pass.lock();
  peeked = null;
  everywhere(tell);
  log("RobinPass: 15분 자리 비움 — 잠금");
  return true;
}
function passState() {
  if (!pass) return null;
  const s = pass.status();
  const url = active?.view.webContents.getURL() || "";
  return { state: s.state, email: s.email, server: s.server.replace(/^https?:\/\//, ""), count: s.state === "open" && webby(url) ? pass.forPage(url).length : 0, synced: s.state === "open" ? pass.syncedAt() : 0 };
}
const plainItem = (i, url) => ({ id: i.id, name: i.name, username: i.username, here: !!url && i.uris.some((u) => matches(u.uri, u.match, url)), totp: !!i.totp, host: (() => { try { return new URL(/^[a-z]+:/i.test(i.uris[0]?.uri) ? i.uris[0].uri : "https://" + i.uris[0]?.uri).hostname; } catch { return ""; } })() });
function passItems(q) {
  const url = active?.view.webContents.getURL() || "";
  const here = webby(url) ? pass.forPage(url) : [];
  const more = q ? pass.search(q).filter((i) => !here.includes(i)) : [];
  return [...(q ? here.filter((i) => pass.search(q).includes(i)) : here), ...more].map((i) => plainItem(i, url));
}
// the 인증 코드 list: each login with a key, its code now and the seconds it has left. The
// codes reach the overlay (they last seconds, and are what that list is for); keys never do.
function passCodes(q) {
  if (!pass || pass.status().state !== "open") return null;
  return pass.withCodes(q)
    .sort((a, b) => a.name.localeCompare(b.name, "ko") || a.username.localeCompare(b.username, "ko"))
    .map((i) => { const c = pass.code(i.id); const p = plainItem(i, ""); return { id: p.id, name: p.name, username: p.username, host: p.host, code: i.reprompt ? "" : c?.code || "", left: c?.left || 0, period: c?.period || 30, bad: !c, ask: i.reprompt }; });
}
// a password or a code on the clipboard goes again after 30 seconds, or when Rove quits
// (if it is still there: something copied since is left alone)
let onClip = null;
async function clearSecret() {
  const v = onClip;
  onClip = null;
  // readText answers with a promise here (Electron 45), so wait for it before comparing
  if (v && (await clipboard.readText()) === v) clipboard.clear();
}
function copySecret(value) {
  clipboard.writeText(value);
  onClip = value;
  setTimeout(() => { if (onClip === value) clearSecret(); }, (TEST && Number(process.env.ROVE_CLIP_MS)) || 30e3).unref?.();
}
// a login marked "ask for the master password again" (Bitwarden's reprompt): its password and
// code are filled or copied only with the master password typed for that one go
async function askedAgain(i, master) {
  if (!i.reprompt || (await pass.verify(String(master || "")))) return null;
  return { reprompt: true, error: master ? "마스터 비밀번호가 맞지 않아요" : "" };
}
async function passCopy(id, what, master) {
  const i = pass.item(id);
  if (!i) return { error: "잠겨 있어요" };
  if (what === "username") { clipboard.writeText(i.username); return { ok: true }; }
  const no = await askedAgain(i, master);
  if (no) return no;
  if (what === "password") { copySecret(i.password); return { ok: true }; }
  if (what === "totp") { const c = pass.code(id); if (!c) return { error: "코드가 없어요" }; copySecret(c.code); return { ok: true, left: c.left }; }
  return { error: what };
}
// runs in the page's main frame, in a world of its own; does nothing on another origin
const FILL = `(origin, user, pass) => {
  if (location.origin !== origin) return { error: "origin" };
  const seen = (e) => { const r = e.getBoundingClientRect(); const c = getComputedStyle(e); return r.width > 0 && r.height > 0 && c.visibility !== "hidden" && c.display !== "none"; };
  const all = [...document.querySelectorAll("input")].filter((e) => !e.disabled && !e.readOnly && seen(e));
  const userish = (e) => ["text", "email", "tel", ""].includes(e.type) && !/search|captcha|otp|code/i.test(e.name + e.id + e.autocomplete);
  const pw = all.find((e) => e.type === "password");
  let un = null;
  if (pw) { const before = all.slice(0, all.indexOf(pw)).filter(userish); un = before.filter((e) => e.form === pw.form).pop() || before.pop() || null; }
  else un = all.find((e) => userish(e) && /user|mail|login|id|account|name/i.test(e.name + e.id + e.autocomplete + e.type)) || null;
  const set = (e, v) => {
    if (!e || !v) return false;
    e.focus();
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(e, v);
    for (const t of ["input", "change"]) e.dispatchEvent(new Event(t, { bubbles: true }));
    return true;
  };
  const a = set(un, user), b = set(pw, pass);
  if (pw && b) pw.focus();
  return { user: a, pass: b };
}`;
const PEEK = `(origin) => {
  if (location.origin !== origin) return null;
  const pw = [...document.querySelectorAll("input[type=password]")].find((e) => e.value);
  if (!pw) return null;
  const all = [...document.querySelectorAll("input")];
  const before = all.slice(0, all.indexOf(pw)).filter((e) => ["text", "email", "tel", ""].includes(e.type) && e.value);
  return { username: (before.filter((e) => e.form === pw.form).pop() || before.pop())?.value || "", password: pw.value };
}`;
// in each page loaded while the vault is open (not a private window's): the login as Enter or a press
// reaches it, taken before the page's own handlers (capture, on window) — a page may empty the box as
// it sends (MIKAEL n346). Kept 1.5 s in this world only; TYPED reads it when the box is empty by then.
// A page loaded while locked has none (MIKAEL n352): its boxes are read as they are.
const SNAP = `(() => {
  const take = (e) => {
    if (e.type === "keydown" && e.key !== "Enter") return;
    const r = (${PEEK})(location.origin);
    globalThis.__roveTyped = r;
    if (r) setTimeout(() => { if (globalThis.__roveTyped === r) globalThis.__roveTyped = null; }, 1500);
  };
  addEventListener("keydown", take, true);
  addEventListener("mousedown", take, true);
})()`;
const TYPED = `(origin) => {
  const kept = globalThis.__roveTyped;
  globalThis.__roveTyped = null;
  return (${PEEK})(origin) || (kept && location.origin === origin ? kept : null);
}`;
const pageOrigin = (url) => { try { const u = new URL(url); return /^https?:$/.test(u.protocol) ? u.origin : ""; } catch { return ""; } };
async function passFill(id, tab = active, master) {
  const i = pass.item(id);
  if (!i || !tab) return { error: "잠겨 있어요" };
  const no = await askedAgain(i, master);
  if (no) return no;
  const wc = tab.view.webContents;
  const url = wc.getURL();
  const origin = pageOrigin(url);
  const hit = i.uris.filter((u) => matches(u.uri, u.match, url));
  if (!origin || !hit.length) return { error: "이 사이트의 로그인이 아니에요" };
  // a page without TLS gets nothing a TLS site was saved with (judged by the addresses that matched)
  if (url.startsWith("http:") && !/^http:\/\/(localhost|127\.0\.0\.1)(:|\/)/.test(url) && !hit.some((u) => u.uri.startsWith("http:"))) return { error: "암호화되지 않은 페이지예요" };
  let r;
  try { r = await wc.executeJavaScriptInIsolatedWorld(1001, [{ code: `(${FILL})(${JSON.stringify(origin)}, ${JSON.stringify(i.username)}, ${JSON.stringify(i.password)})` }]); } catch (e) { return { error: e.message }; }
  if (!r || r.error || (!r.user && !r.pass)) return { error: "채울 칸을 찾지 못했어요" };
  if (!tab.w.gone) use(tab.w);
  hideOverlay();
  wc.focus();
  let code = null;
  if (i.totp) { const c = pass.code(i.id); if (c) { copySecret(c.code); code = true; } }
  log(`RobinPass: 채움 ${siteInLog(tab.w.private, url)}`);
  return { ok: true, ...r, code };
}
async function passPeek() {
  peeked = null;
  const wc = active?.view.webContents;
  const url = wc?.getURL() || "";
  const origin = pageOrigin(url);
  if (!origin || pass.status().state !== "open") return null;
  let r = null;
  try { r = await wc.executeJavaScriptInIsolatedWorld(1001, [{ code: `(${PEEK})(${JSON.stringify(origin)})` }]); } catch { return null; }
  if (!r?.password) return null;
  peeked = { url: origin + "/", username: r.username, password: r.password };
  const known = pass.forPage(url).some((i) => i.username === r.username && i.password === r.password);
  return { username: r.username, host: hostOf(url), known };
}
// a login or sign-up form sent with a password the vault does not have: offered in the ask bar
// once the next page is there (Chrome's 비밀번호 저장); not while locked. What was typed is read
// as Enter or a press goes to the page: by the time the page goes on, the next one has replaced it.
// A private window's logins are saved by hand (the key popup): nothing there is read or offered.
function passTyped(tab) {
  const wc = tab.view.webContents, url = wc.getURL(), origin = pageOrigin(url);
  if (!origin || tab.w.private || pass?.status().state !== "open") return;
  const n = (tab.typedN = (tab.typedN || 0) + 1);
  tab.typing = wc.executeJavaScriptInIsolatedWorld(1001, [{ code: `(${TYPED})(${JSON.stringify(origin)})` }])
    .then((r) => {
      if (tab.typedN !== n) return;
      clearTimeout(tab.typedTimer);
      tab.typed = r?.password ? { url: origin + "/", username: r.username, password: r.password, host: hostOf(url) } : null;
      if (tab.typed) tab.typedTimer = setTimeout(() => forgetTyped(tab), 15e3);
    }, () => {});
}
// what was read is let go 15 s on (unless offered by then), on an address-bar move and with the tab
function forgetTyped(tab) {
  clearTimeout(tab.typedTimer);
  tab.typedN = (tab.typedN || 0) + 1;
  tab.typed = tab.sent = null;
}
async function passSent(tab) {
  tab.sent = null;
  await tab.typing;
  const t = tab.typed;
  tab.typed = null;
  if (!t || pass?.status().state !== "open") return;
  if (pass.forPage(t.url).some((i) => i.username === t.username && i.password === t.password)) return;
  tab.sent = t;
  if (tab.landed) passOffer(tab);
}
function passOffer(tab) {
  const s = tab.sent;
  if (!s || !tab.landed) return;
  tab.sent = null;
  asks.push({ id: nextId++, kind: "pass", tab, host: s.host, what: ["save"], name: s.username, login: s, done: [] });
  if (!tab.w.gone) within(tab.w, () => { layout(); tell(); });
}
async function passKeep(a) {
  const r = await pass.add({ name: a.host, uri: a.login.url, username: a.login.username, password: a.login.password });
  if (r.ok) { log(`RobinPass: 저장 ${a.host}`); tell(); return; }
  asks.push({ ...a, id: nextId++, error: r.error || "저장하지 못했어요" });
  everywhere(layout); tell();
}
async function passSave(name) {
  if (!peeked) return { error: "저장할 것이 없어요" };
  const r = await pass.add({ name: name || hostOf(peeked.url), uri: peeked.url, username: peeked.username, password: peeked.password });
  if (r.ok) peeked = null;
  tell();
  return r;
}
function passQuick() {
  const url = active?.view.webContents.getURL() || "";
  const here = pass.status().state === "open" && webby(url) ? pass.forPage(url) : [];
  if (here.length === 1 && !here[0].reprompt) passFill(here[0].id);
  else win.webContents.send("rove:pass-open", true);
}

// a page's icon comes through the page's session (Sec-GPC, the blocker, Chrome's name; a private
// window's stays in memory) and reaches the bar as data: — an <img> there would ask through the
// bar's own session, kept on disk
async function iconOf(ses, url) {
  if (!url || url.startsWith("data:")) return url;
  try {
    const r = await ses.fetch(url), b = Buffer.from(await r.arrayBuffer()), h = b.subarray(0, 64).toString("latin1");
    const type = /^image\/[\w.+-]+/.exec(r.headers.get("content-type") || "")?.[0] || (h.startsWith("\0\0\x01\0") ? "image/x-icon" : h.startsWith("\x89PNG") ? "image/png" : /<svg/i.test(h) ? "image/svg+xml" : "");
    return r.ok && type && b.length <= 200000 ? `data:${type};base64,${b.toString("base64")}` : null;
  } catch { return null; }
}
function cleanAgent(ses) {
  // the plain Chrome name: some sites (Google's sign-in first) turn away a
  // name with "Electron" or an app in it
  ses.setUserAgent(ses.getUserAgent().replace(/\s(Electron|rove|Rove)\/\S+/g, ""));
}

// ---- what sites ask for ---------------------------------------------------------------
// asks: what waits in the ask bar, oldest first. A site's question belongs to
// its tab (shown while that tab is in front); a held download to none (shown
// over every tab).
let asks = []; // { id, kind: "site" | "download", tab, origin, host, what: [key], done: [callback], d }
let privGrants = {}; // a private window's answers, gone with it
const gr = () => (cur?.private ? privGrants : grants);
const keepGrants = () => { if (!cur?.private) save("permissions.json", grants); };
// a held download is asked about in the windows of its kind only (its name is a private window's)
const asking = () => asks.find((a) => (a.kind === "download" && mineKind(a.d)) || a.tab === active) || asks.find((a) => a.kind === "welcome") || null;
// another program's link: kept for an https site only, as Chrome; popups for a page with a site (not data:)
const keepable = (a) => a.what?.[0] === "popups" ? !!a.origin : a.what?.[0] !== "external" || /^https:\/\//.test(a.origin || "");
const plainAsk = (a) => ({ id: a.id, kind: a.kind, host: a.host, what: a.what, name: a.name || "", error: a.error || "", scheme: a.scheme || "", allSites: !!a.allSites, wontBlock: !!a.wontBlock, keepable: keepable(a), count: a.count || 0, from: a.from || "", madeDefault: !!a.madeDefault });
function dropAsks(tab) {
  if (share?.tab === tab) dropShare();
  const gone = asks.filter((a) => a.tab === tab);
  if (!gone.length) return;
  asks = asks.filter((a) => a.tab !== tab);
  for (const a of gone) for (const f of a.done) f(false);
  layout();
  tell();
}
function answer(id, yes, keep = true) {
  const a = asks.find((x) => x.id === id);
  if (!a) return;
  asks = asks.filter((x) => x !== a);
  if (a.kind === "download") keepDownload(a.d, !!yes);
  else if (a.kind === "extension") for (const f of a.done) f(!!yes);
  else if (a.kind === "pass") { if (yes) passKeep(a); }
  else if (a.kind === "welcome") {
    // 기본 브라우저로 / 가져오기 (the bookmarks drawer at the browsers list; the other button stays) / ×
    // either one leaves the other offered, as Brave's welcome goes on to its next step (Windows'
    // settings page decides the default later, so 기본 브라우저로 is not offered twice)
    if (yes) { makeDefault().then(checkDefault); if (a.from) asks.push({ ...a, madeDefault: true }); }
    else if (keep && a.from) { showOverlay({ kind: "drawer", panel: "bookmarks", importing: true }); if (!isDefault && !a.madeDefault) asks.push({ ...a, from: "" }); }
  } else {
    if (keep && keepable(a)) {
      const g = a.tab?.w?.private ? privGrants : grants;
      g[a.origin] = { ...g[a.origin] };
      for (const k of a.what) g[a.origin][k === "external" ? "external:" + a.scheme : k] = !!yes;
      if (g === grants) save("permissions.json", grants);
    } else if (yes && a.what[0] !== "external" && a.tab) {
      // 이번만 허용 (Chrome's): this tab, while it stays on that site; never kept, asked again after
      const had = a.tab.once?.origin === a.origin ? a.tab.once.keys : [];
      a.tab.once = { origin: a.origin, keys: [...new Set([...had, ...a.what])] };
    }
    for (const f of a.done) f(!!yes);
  }
  everywhere(layout);
  tell();
}
// Electron's names, in ours (what is kept and shown)
function keysFor(what, details) {
  if (what === "media") {
    const m = details.mediaTypes || [];
    return [...(m.includes("video") ? ["camera"] : []), ...(m.includes("audio") ? ["microphone"] : [])];
  }
  return { geolocation: ["location"], notifications: ["notifications"], "clipboard-read": ["clipboard"], midiSysex: ["midi"] }[what] || null;
}
function permissions(ses, priv = false) {
  const yes = new Set(["fullscreen", "clipboard-sanitized-write", "pointerLock", "window-management"]);
  // an extension's own pages (its background, its popup): what it was given when it was added
  const theirs = new Set(["notifications", "clipboard-read", "unlimitedStorage"]);
  const extension = (u) => /^chrome-extension:\/\//.test(u || "");
  // a private window takes the normal windows' no (as Chrome's incognito), never their yes
  const G = () => {
    if (!priv) return grants;
    const out = {};
    for (const [o, g] of Object.entries(grants)) out[o] = Object.fromEntries(Object.entries(g).filter(([, v]) => v === false));
    for (const [o, g] of Object.entries(privGrants)) out[o] = { ...out[o], ...g };
    return out;
  };
  ses.setPermissionRequestHandler((wc, what, done, details = {}) => {
    if (yes.has(what)) return done(true);
    if (theirs.has(what) && extension(details.requestingUrl || wc?.getURL())) return done(true);
    const tab = tabOf(wc);
    if (tab) use(tab.w);
    // the screen: the picker answers (shareAsked(), below)
    if (what === "display-capture") return shareAsked(tab, originOf(details.requestingUrl || wc?.getURL()), details.mediaTypes || [], done);
    const origin = originOf(details.requestingUrl || wc?.getURL());
    // another program for a link (zoommtg:, mailto: ...): asked for every time
    if (what === "openExternal") {
      const scheme = (() => { try { return new URL(details.externalURL).protocol.replace(":", ""); } catch { return ""; } })();
      // refused without asking: ones that run or reach files, and Windows ones used in attacks
      // (search-ms:/search: show a remote share as a local folder; hcp:, its:, mk: old help-file holes)
      if (!tab || !scheme || /^(javascript|file|data|blob|vbscript|ms-.*|search(-ms)?|shell|hcp|its|mk)$/i.test(scheme)) return done(false);
      // 늘 열기 (or 차단 in the site popup) for this site and scheme: answered without asking
      const kept = G()[origin]?.["external:" + scheme];
      if (typeof kept === "boolean") return done(kept);
      asks.push({ id: nextId++, kind: "site", tab, origin, host: hostOf(origin) || origin, what: ["external"], scheme, done: [done] });
      layout(); tell(); return;
    }
    const want = keysFor(what, details);
    if (!tab || !origin || !want?.length) return done(false);
    const had = G()[origin] || {};
    if (want.some((k) => had[k] === false)) return done(false);
    const once = tab.once?.origin === origin ? tab.once.keys : [];
    if (want.every((k) => had[k] === true || once.includes(k))) return done(true);
    const same = asks.find((a) => a.tab === tab && a.origin === origin && a.what.join() === want.join());
    if (same) { same.done.push(done); return; }
    asks.push({ id: nextId++, kind: "site", tab, origin, host: hostOf(origin) || origin, what: want, done: [done] });
    layout();
    tell();
  });
  ses.setPermissionCheckHandler((wc, what, origin, details = {}) => {
    if (yes.has(what)) return true;
    if (theirs.has(what) && extension(details.requestingUrl || origin)) return true;
    const key = what === "media" ? { video: "camera", audio: "microphone" }[details.mediaType] : keysFor(what, details)?.[0];
    if (!key) return false;
    const o = originOf(details.requestingUrl || origin), t = tabOf(wc);
    return G()[o]?.[key] === true || (t?.once?.origin === o && t.once.keys.includes(key));
  });
}
// a popup's size: what the page asked for (width/height are its own area, as Chrome), kept on the
// screen it opens on; 520×680 when it gave none. (A lecture player laid out for 1024×768 lost its
// controls in a 520×680 one.)
function popupSize(features, near) {
  const f = Object.fromEntries(String(features || "").split(",").map((p) => p.split("=").map((x) => x.trim().toLowerCase())));
  const area = screen.getDisplayMatching(near && !near.isDestroyed() ? near.getBounds() : { x: 0, y: 0, width: 1, height: 1 }).workAreaSize;
  const fit = (v, d, max) => { const n = parseInt(v, 10); return Math.min(Math.max(Number.isFinite(n) ? n : d, 100), max); };
  return { width: fit(f.width ?? f.innerwidth, 520, area.width), height: fit(f.height ?? f.innerheight, 680, area.height - 40) }; // 40: the title bar
}

// ---- popups a page opened by itself ----------------------------------------------------
const ACTIVATION_MS = 5000; // Chromium's transient activation
// what lets a page open a window (Chromium's activation: a press, not a move; not Esc or a lone modifier)
const activates = (i) => /^(mouseDown|mouseUp|keyDown|rawKeyDown|touchEnd)$/.test(i.type) && !/^(Escape|Shift|Control|Alt|Meta)$/.test(i.key || "");
const HELD_MAX = 20; // a page that opens popups in a loop: only so many are kept to open
const topOrigin = (tab) => originOf(tab.view.webContents.getURL() || tab.url);
// the site's answer (허용·차단, or 이번만 허용 in this tab): a private window keeps its own and takes the normal no
function popupsKept(tab) {
  const o = topOrigin(tab);
  if (tab.once?.origin === o && tab.once.keys.includes("popups")) return true;
  const mine = (tab.w?.private ? privGrants : grants)[o]?.popups;
  if (typeof mine === "boolean") return mine;
  if (grants[o]?.popups === false) return false;
  // 창을 내려도 계속 on: a lecture site that opens its player by itself (robin 11-27 "응, 허용해")
  return awakeFor(tab.view.webContents.getURL() || tab.url, tab.w?.private) ? true : undefined;
}
const popupsOk = (tab) => popupsKept(tab) === true;
function holdPopup(tab, url) {
  if (popupsKept(tab) === false) return log(`팝업 막음: ${siteInLog(tab.w?.private, tab.url)}`);
  const origin = topOrigin(tab);
  let a = asks.find((x) => x.tab === tab && x.what[0] === "popups");
  if (!a) {
    a = { id: nextId++, kind: "site", tab, origin, host: hostOf(origin) || origin, what: ["popups"], urls: [], count: 0, done: [] };
    // 허용 (always or this once): the held ones open now, behind, after this tab
    a.done.push((yes) => { if (yes) for (const u of a.urls) newTab(u, { background: true, after: tab }); });
    asks.push(a);
  }
  a.count++;
  if (webby(url) && a.urls.length < HELD_MAX) a.urls.push(url);
  layout();
  tell();
}

function forgetSite(origin, key) {
  const g = gr();
  if (!g[origin]) return;
  if (key) delete g[origin][key]; else delete g[origin];
  if (g[origin] && !Object.keys(g[origin]).length) delete g[origin];
  keepGrants();
  tell();
}

// ---- the screen: a site asks, the picker in the overlay answers ---------------------------
// One at a time, from the tab in front. A screen or a window comes from
// desktopCapturer (Rove's own window left out), a tab is handed over as its
// page; the sound goes with a screen (Windows' loopback) or a tab when the
// site asked for it and the box is ticked.
// 0.5: the picker answers the permission question ("display-capture"), which
// comes first: a no there reaches the page as NotAllowedError, as in Chrome (a
// no given to the display handler is only ever an AbortError). What was
// picked waits in `chosen` for the display handler, which comes right after.
let share = null; // the question open: { id, tab, origin, audio, answer(pick | null), sources: Map(id -> source) }
let chosen = null; // picked, the page's stream not made yet: { tab, kind, id, audio, src, at }
const safe = (f) => { try { f(); } catch { /* the frame is gone (the callback throws then) */ } };
function dropShare() {
  if (!share) return;
  const s = share;
  share = null;
  safe(() => s.answer(null));
  log(`화면 공유 안 함 ${siteInLog(s.w.private, s.origin)}`);
  if (s.w && !s.w.gone) within(s.w, () => { if (overlayOn?.kind === "share") hideOverlay(); });
}
async function askShare(tab, origin, audio, answer) {
  const ask = { id: nextId++, w: cur, tab, origin, audio, answer, sources: new Map() };
  share = ask;
  // names first (well under a second), the pictures after (a few seconds with many windows)
  const own = windows.map((w) => w.win.getMediaSourceId());
  const pic = (img) => (img && !img.isEmpty() ? "data:image/jpeg;base64," + img.resize({ width: 320 }).toJPEG(72).toString("base64") : "");
  const what = (found, here, loading) => {
    const screens = [];
    const windows = [];
    for (const src of found) {
      if (own.includes(src.id)) continue;
      ask.sources.set(src.id, src);
      if (src.id.startsWith("screen:")) screens.push({ id: src.id, name: `화면 ${screens.length + 1}`, pic: pic(src.thumbnail) });
      else if (src.name.trim()) windows.push({ id: src.id, name: src.name, pic: pic(src.thumbnail) });
    }
    const list = tabs.map((t) => ({ id: t.id, name: t.title || t.url, host: hostOf(t.url), favicon: t.favicon, self: t === tab, pic: t === tab ? pic(here) : "" }));
    return { kind: "share", id: ask.id, host: hostOf(origin) || origin, audio, screens, windows, tabs: list, loading };
  };
  const sources = (size) => desktopCapturer.getSources({ types: ["screen", "window"], thumbnailSize: size }).catch((err) => { log(`화면 목록 못 받음: ${err.message}`); return []; });
  const [names, here] = await Promise.all([sources({ width: 0, height: 0 }), tab.view.webContents.capturePage().catch(() => null)]);
  if (share !== ask) return; // answered or gone meanwhile
  if (ask.w.gone) { dropShare(); return; }
  use(ask.w);
  log(`화면 공유 물음 ${siteInLog(tab.w.private, origin)}`);
  showOverlay(what(names, here, true));
  const pics = await sources({ width: 320, height: 180 });
  if (ask.w.gone) return;
  use(ask.w);
  // no pictures (the second list failed): the names stay, without the wait
  if (share === ask && overlayOn?.kind === "share" && overlayOn.id === ask.id) showOverlay(what(pics.length ? pics : names, here, false));
}
// the permission question (permissions(), above)
function shareAsked(tab, origin, kinds, done) {
  if (!tab || tab !== active || share || !kinds.includes("video")) return done(false);
  chosen = null;
  askShare(tab, origin, kinds.includes("audio"), (pick) => {
    if (!pick) return safe(() => done(false));
    chosen = { tab, ...pick, at: Date.now() };
    safe(() => done(true));
  });
}
function sharing(ses) {
  ses.setDisplayMediaRequestHandler((req, done) => {
    let wc = null;
    try { wc = req.frame ? webContents.fromFrame(req.frame) : null; } catch { /* gone */ }
    const tab = tabOf(wc);
    if (tab) use(tab.w);
    const c = chosen;
    chosen = null;
    if (c && c.tab === tab && Date.now() - c.at < 15e3) return give(c, req, done);
    if (!tab || tab !== active || share || !req.videoRequested) return safe(() => done(null));
    // no permission question came first: the picker answers here
    askShare(tab, req.securityOrigin, !!req.audioRequested, (pick) => (pick ? give({ tab, ...pick }, req, done) : safe(() => done(null))));
  });
}
// the stream for what was picked: { tab (the asking one), kind, id, audio, src }
function give(c, req, done) {
  let streams = null;
  let shown = null;
  if (c.kind === "tab") {
    shown = tabs.find((x) => x.id === c.id) || null;
    const frame = shown && !shown.view.webContents.isDestroyed() ? shown.view.webContents.mainFrame : null;
    if (frame) streams = { video: frame, ...(c.audio && req.audioRequested ? { audio: frame, enableLocalEcho: true } : {}) };
  } else if (c.src) streams = { video: c.src, ...(c.audio && req.audioRequested && c.src.id.startsWith("screen:") ? { audio: "loopback" } : {}) };
  if (!streams) return safe(() => done(null));
  safe(() => done(streams));
  log(`화면 공유 ${siteInLog(c.tab.w?.private, req.securityOrigin)} → ${c.kind}${streams.audio ? " 소리 포함" : ""}`);
  if (shown) {
    // the tab shown to the site is marked while it is captured
    shown.shownTo = hostOf(req.securityOrigin) || req.securityOrigin;
    shown.shownAt = Date.now();
    watchShown();
    // a tab behind is not drawn, so nothing would come: it is brought to the front (as Chrome does)
    if (shown !== active) select(shown);
  }
  tell();
  (shown || c.tab).view.webContents.focus();
}
// the picker's answer (from the overlay)
function shareAnswer(id, pick, audio) {
  const s = share;
  if (!s || s.id !== id) return;
  if (!pick) { dropShare(); return; }
  const src = pick.kind === "tab" ? null : s.sources.get(pick.id);
  if (pick.kind === "tab" ? !tabs.some((x) => x.id === pick.id) : !src) return; // a pick that is not there: the picker stays
  share = null;
  hideOverlay();
  s.answer({ kind: pick.kind, id: pick.id, audio: !!audio && s.audio, src });
}
// a captured tab's mark goes when nothing captures it any more (checked every
// 1.5 s while one is marked; the first 3 s are the stream starting)
let shownTimer = null;
function watchShown() {
  if (shownTimer) return;
  shownTimer = setInterval(() => {
    let left = 0;
    store();
    for (const t of windows.flatMap((w) => w.tabs)) {
      if (!t.shownTo) continue;
      if (Date.now() - t.shownAt > 3e3 && !t.view.webContents.isBeingCaptured()) { log(`탭 공유 끝 ${t.w?.private ? siteInLog(true) : t.shownTo}`); t.shownTo = null; tell(); } else left++;
    }
    if (!left) { clearInterval(shownTimer); shownTimer = null; }
  }, 1500);
}

// ---- this site (the lock in the address bar) ------------------------------------------
const KINDS = ["camera", "microphone", "location", "notifications", "clipboard", "midi"];
function siteInfo() {
  if (!active) return null;
  const url = active.failed || active.url;
  const origin = originOf(url);
  let scheme = "";
  try { scheme = new URL(url).protocol; } catch { /* none */ }
  const local = /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(url);
  const conn = scheme === "https:" ? "secure" : scheme === "http:" ? (local ? "local" : "plain") : scheme === "file:" ? "file" : "other";
  const g = gr()[origin] || {};
  return {
    origin, host: hostOf(url) || url, conn,
    grants: [...KINDS, ...Object.keys(g).filter(linkKey)].filter((k) => typeof g[k] === "boolean").map((k) => ({ key: k, allow: g[k] })),
    block: snapshot().block,
    awake: siteOf(url) ? { site: siteOf(url), on: awakeFor(url, cur?.private) } : null,
  };
}
const linkKey = (k) => /^external:[a-z][a-z0-9+.-]*$/.test(k); // another program's link kept for a site (external:zoommtg)
function setSite(origin, key, value) {
  if (!origin || !(KINDS.includes(key) || linkKey(key))) return;
  if (value === "ask") { forgetSite(origin, key); return; }
  if (value !== "allow" && value !== "block") return;
  gr()[origin] = { ...gr()[origin], [key]: value === "allow" };
  keepGrants();
  tell();
}
// cookies (the site's own and a parent domain's sent to it), storage and the
// cache, for the site in front; then it loads again
async function clearSite() {
  const tab = active;
  const url = tab?.view.webContents.getURL() || "";
  const origin = originOf(url);
  if (!webby(url) || !origin) return { error: "지울 데이터가 없어요" };
  const ses = tab.w.ses || rove();
  let n = 0;
  try {
    for (const c of await ses.cookies.get({ url })) {
      await ses.cookies.remove(`http${c.secure ? "s" : ""}://${c.domain.replace(/^\./, "")}${c.path}`, c.name);
      n++;
    }
    await ses.clearStorageData({ origin });
    // its cached files only (clearCache() empties every site's, as Chrome does not)
    await ses.clearData({ dataTypes: ["cache"], origins: [origin] });
  } catch (err) { return { error: err.message }; }
  log(`사이트 데이터 지움 ${siteInLog(tab.w.private, url)} (쿠키 ${n})`);
  tab.view.webContents.reload();
  return { ok: true, cookies: n };
}

// ---- ads and trackers (blocker.cjs) ----------------------------------------------------
let blocker = null;
const blocked = new Map(); // webContents id: how many stopped on its page
function blocking(ses, priv = false) {
  try {
    const b = require("./blocker.cjs").start({
      ses, file: join(__dirname, "lists.bin"), log, site: (h) => getDomain(h),
      on: () => settings.block,
      skip: (url) => allowedFor(hostOf(url), priv),
      counted: (id) => { blocked.set(id, (blocked.get(id) || 0) + 1); store(); if (windows.some((w) => w.active?.view.webContents.id === id)) tell(); },
    });
    blocker ??= b;
  } catch (err) { log(`광고·추적 막기 못 켬: ${err.message}`); }
}
function setBlock(on, site) {
  if (site) {
    const h = hostOf(site);
    if (!h) return;
    const list = cur?.private ? privSites : settings;
    list.allow = list.allow.filter((x) => x !== h);
    if (!on) list.allow.push(h);
    // what was blocked comes only with a new load: the page that broke loads again, as Brave does
    // with its Shields switch (the switch for all sites loads nothing, as there)
    if (active && hostOf(active.url) === h) active.view.webContents.reload();
    if (list === privSites) return tell();
  } else settings.block = !!on;
  save("settings.json", settings);
  tell();
}

// ---- pages that keep going with the window down (settings.awake) ----------------------
// An online lecture counts its time only while its page is seen and has the
// focus. Minimized, Chromium tells a page it is hidden, takes its focus and
// slows its timers. On a site put here: timers at full speed (no background
// throttling, which also keeps it seen), the focus kept
// (Emulation.setFocusEmulationEnabled), and SEEN, run before the page's own
// scripts in every new document, for what is left (a tab not in front).
const SEEN = `(() => { const D = Document.prototype; const v = (x) => ({ get: () => x, configurable: true });
  for (const [k, x] of [["hidden", false], ["webkitHidden", false], ["visibilityState", "visible"], ["webkitVisibilityState", "visible"]]) { try { Object.defineProperty(D, k, v(x)); } catch {} }
  try { D.hasFocus = function hasFocus() { return true; }; } catch {}
  const stop = (e) => { if (e.type !== "blur" || e.target === window) e.stopImmediatePropagation(); };
  for (const t of ["visibilitychange", "webkitvisibilitychange", "blur"]) window.addEventListener(t, stop, true);
})();`;
function keepGoing(wc, on) {
  if (!wc || wc.isDestroyed() || !!wc.roveAwake === on) return;
  wc.roveAwake = on;
  wc.setBackgroundThrottling(!on);
  const d = wc.debugger;
  const send = (m, p) => d.sendCommand(m, p).catch((e) => { log(`창을 내려도 계속 ${m}: ${e.message}`); return null; });
  if (on) {
    try { if (!d.isAttached()) d.attach("1.3"); } catch (e) { log(`창을 내려도 계속: ${e.message}`); return; }
    send("Emulation.setFocusEmulationEnabled", { enabled: true });
    send("Page.addScriptToEvaluateOnNewDocument", { source: SEEN }).then((r) => {
      if (!r) return;
      if (wc.roveAwake) wc.roveSeen = r.identifier; else send("Page.removeScriptToEvaluateOnNewDocument", { identifier: r.identifier });
    });
    send("Runtime.evaluate", { expression: SEEN });
  } else if (d.isAttached()) {
    send("Emulation.setFocusEmulationEnabled", { enabled: false });
    if (wc.roveSeen) send("Page.removeScriptToEvaluateOnNewDocument", { identifier: wc.roveSeen });
    wc.roveSeen = null;
  }
}
// a web page's tab or popup shares the session that serves rove://, so neither its frames nor a web
// server (302 Location: rove://...) can take it there. MIKAEL n373
function guardOurPages(wc) {
  wc.on("will-frame-navigate", (e) => { if (!e.isMainFrame && /^rove:/i.test(e.url)) e.preventDefault(); });
  wc.on("will-redirect", (e) => {
    if (!/^rove:/i.test(e.url)) return;
    e.preventDefault();
    log(`rove:// 돌려보내기 막음: ${siteInLog(wc.session !== rove(), wc.getURL()) || "?"}`);
  });
}
// a window a page opened (a lecture's player): the same, and so on down. It has no new tab of its own,
// so our pages are closed to it entirely: by its page, its opener, or a window it opens. MIKAEL n376
// What its page opens is taken as a tab's is (Brave, Chrome; MIKAEL 11-27): a window it opens with no click
// or key just before is held on the tab that opened it all (unless that site's popups are allowed, or it is
// a 창을 내려도 계속 site, as there); a link to a new tab is a tab after that one in its window, not another
// bare window; a sized window.open stays a popup, at the size asked; Shift+click, a new Rove window.
function popupGoing(child, url, tab = null) {
  const wc = child.webContents;
  const priv = tab ? !!tab.w?.private : wc.session !== rove();
  guardOurPages(wc);
  wc.on("will-navigate", (e) => { if (/^rove:/i.test(e.url)) e.preventDefault(); });
  let input = 0;
  wc.on("input-event", (_e, i) => { if (activates(i)) input = Date.now(); });
  wc.on("before-input-event", (_e, i) => { if (i.type === "keyDown" && i.key === "Escape" && i.control) child.close(); });
  wc.setWindowOpenHandler(({ url: to, disposition, features }) => {
    if (!webby(to) && !/^about:blank/.test(to)) return { action: "deny" }; // rove:, file: and the like
    const live = !!tab?.w && !tab.w.gone && tab.w.tabs.includes(tab);
    const clicked = Date.now() - input < ACTIVATION_MS;
    input = 0;
    if (!clicked && !awakeFor(wc.getURL() || url, priv) && !(live && popupsOk(tab))) {
      if (live) within(tab.w, () => holdPopup(tab, to));
      else log(`팝업 막음: ${siteInLog(priv, wc.getURL())}`);
      return { action: "deny" };
    }
    if (disposition === "new-window" && features) {
      return { action: "allow", overrideBrowserWindowOptions: { ...popupSize(features, child), useContentSize: true, autoHideMenuBar: true, backgroundColor: "#ffffff",
        webPreferences: { session: wc.session, sandbox: true, contextIsolation: true, nodeIntegration: false } } };
    }
    if (disposition === "new-window" || !live) { if (webby(to)) createWindow({ priv, urls: [to] }); }
    else within(tab.w, () => {
      newTab(to, { background: disposition === "background-tab", from: tab });
      if (disposition !== "background-tab") tab.w.win?.focus();
    });
    return { action: "deny" };
  });
  keepGoing(wc, awakeFor(url, priv));
  wc.on("did-start-navigation", (d) => { if (d.isMainFrame && !d.isSameDocument) keepGoing(wc, awakeFor(d.url, priv)); });
  wc.on("did-create-window", (c, d) => { c.setMenu(null); popupGoing(c, d.url, tab); });
  // a popup has no address bar: its title says whose page it is, the host first and as
  // punycode (a look-alike name shows as xn--…), whatever the page calls itself
  const name = (title = wc.getTitle()) => {
    let host = "";
    try { const u = new URL(wc.getURL() || url); host = u.host || u.protocol; } catch { /* not yet */ }
    child.setTitle(host ? `${host} · ${title || ""}`.replace(/ · $/, "") : title);
  };
  child.on("page-title-updated", (e, title) => { e.preventDefault(); name(title); });
  wc.on("did-navigate", () => name());
  wc.on("did-navigate-in-page", () => name());
  name("");
}
function setAwake(on) {
  const site = active && siteOf(active.url);
  if (!site) return;
  const list = cur?.private ? privSites : settings;
  list.awake = list.awake.filter((x) => x !== site);
  if (on) list.awake.push(site);
  if (list === settings) save("settings.json", settings);
  for (const wc of webContents.getAllWebContents()) if (siteOf(wc.getURL()) === site) keepGoing(wc, awakeFor(wc.getURL(), !!privateSes && wc.session === privateSes));
  log(`창을 내려도 계속 ${on ? "켬" : "끔"}: ${list === settings ? site : "(비공개 창)"}`); // rove.log is on disk
  tell();
}

// the spell checker: English, and Korean where Chromium has it
function spelling(ses) {
  try {
    const have = ses.availableSpellCheckerLanguages || [];
    const want = ["en-US", "ko"].filter((l) => have.includes(l));
    if (want.length) ses.setSpellCheckerLanguages(want);
  } catch (e) { log(`맞춤법 검사 언어 못 정함: ${e.message}`); }
}

// ---- the default browser (defaults.cjs) -------------------------------------------------
const AS = process.env.ROVE_AS || "Rove";
const defaults = require("./defaults.cjs");
let isDefault = false;
async function checkDefault() {
  const now = await defaults.isDefault(AS);
  if (now !== isDefault) { isDefault = now; tell(); }
}
async function makeDefault() {
  // an installed Rove is started through current (it stays put across updates)
  const exe = mine ? join(mine.home, "current", "Rove.exe") : process.execPath;
  const command = mine || app.isPackaged ? `"${exe}"` : `"${exe}" "${app.getAppPath()}"`;
  const ok = await defaults.register({ name: AS, command, icon: `${exe},0` });
  log(`기본 브라우저 등록 ${ok ? "함" : "못 함"} (${AS})`);
  if (ok && !TEST) shell.openExternal(defaults.settingsPage(AS));
  return ok;
}
// the first run: what Brave's and Chrome's welcome offer, once and in the ask bar (≡ has both too) —
// be the default browser, bring bookmarks from the browser that has the most. Parity 39
async function welcome() {
  await checkDefault();
  const from = importSources().filter((s) => s.fresh).sort((x, y) => y.fresh - x.fresh)[0];
  if (isDefault && !from) return;
  asks.push({ id: nextId++, kind: "welcome", tab: null, host: "Rove", what: [], from: from ? `${from.name} ${from.fresh}개` : "", done: [] });
  everywhere(layout);
  tell();
}

let bootDone;
const booted = new Promise((r) => { bootDone = r; }); // the first windows are up
app.whenReady().then(async () => {
  serveUi();
  const ses = rove();
  serveUi(ses.protocol, { tab: true });
  cleanAgent(ses);
  permissions(ses);
  sharing(ses);
  blocking(ses);
  passStart();
  downloadsTo(ses);
  spelling(ses);
  // a broken extension part must not keep the windows from coming (Rove without extensions)
  try { exts = startExtensions(ses); } catch (e) { log(`확장 프로그램 못 켬: ${e.message}`); exts = null; }
  // the installed ones in before the first pages load, so their content scripts are in them (3 s at most)
  if (exts) await Promise.race([exts.ready, new Promise((r) => setTimeout(r, 3000))]);
  rmSync(join(home, "held"), { recursive: true, force: true }); // never answered: gone with the last run
  downloads = load("downloads.json", []).map(({ asking, ...d }) => (d.state === "progressing" ? { ...d, state: "interrupted" } : d));
  checkFiles();
  checkDefault();
  nextId = Math.max(nextId, ...downloads.map((d) => d.id + 1));

  messages();
  const start = process.env.ROVE_START;
  const last = load("tabs.json", null);
  const list = Array.isArray(last?.windows) ? last.windows.filter((x) => x?.urls?.length) : last?.urls?.length ? [last] : [];
  if (start) createWindow({ urls: [start] });
  else startWindows(list, process.argv.includes(AGAIN));
  use(windows[0]);
  for (const u of opened(process.argv.slice(1))) newTab(u);
  // asked once per Rove: on its first run only (no tabs kept yet), not after an update. Tests ask for it
  if (!settings.welcomed) {
    settings.welcomed = true;
    save("settings.json", settings);
    if (!last && (!TEST || process.env.ROVE_WELCOME)) welcome();
  }
  bootDone();

  setInterval(sleepIdle, Math.min(60e3, SLEEP_AFTER / 2)).unref?.();
  setInterval(passIdle, 60e3).unref?.();
  if (TEST) testHooks();
  if (updates) {
    // tidy first: it drops leftover *.zip.part, so never while a check downloads one
    setTimeout(() => { tidy(mine); updates.check(); }, 20e3);
    // the PC's own install only: a copy run elsewhere (tests) leaves Windows' list as it is
    if (mine.home.toLowerCase() === join(process.env.LOCALAPPDATA || "", "Rove").toLowerCase()) listed(mine, app.getVersion()).then((ok) => { if (!ok) log("설치된 앱 목록에 넣지 못했어요"); });
    setInterval(() => updates.check(), 6 * 3600e3).unref?.();
  }
});

// ---- Chrome extensions (extensions.cjs) -------------------------------------------------
// chrome.tabs and chrome.windows act on Rove's own tabs and windows (the normal ones)
function startExtensions(ses) {
  const actions = join(__dirname, "actions.preload.cjs");
  if (!app.isPackaged) require("./tools/actions-preload.cjs").build(actions); // a release has it built in
  const normal = (w) => w && !w.gone && !w.private;
  const windowFor = (id) => windows.find((w) => normal(w) && w.win.id === id) || (normal(lastNormal) ? lastNormal : windows.find(normal));
  return require("./extensions.cjs").start({
    ses, dir: join(home, "Extensions"), actionsPreload: actions, log, confirm: askExtension,
    off: { ...settings.extOff }, saveOff(off) { settings.extOff = { ...off }; save("settings.json", settings); },
    impl: {
      createTab(details) {
        const w = windowFor(details.windowId);
        if (!w) { const n = createWindow({ urls: [details.url || HOME_PAGE] }); return [n.tabs[0].view.webContents, n.win]; }
        const t = within(w, () => newTab(details.url || HOME_PAGE, { background: details.active === false }));
        return [t.view.webContents, w.win];
      },
      selectTab(wc) { const t = tabOf(wc); if (t && !t.w.gone && !addingTab) { use(t.w); select(t); } },
      // also told when a page's view goes (closed, asleep, its window shut): then nothing to do
      removeTab(wc) {
        const t = tabOf(wc);
        if (!t || t.w.gone || wc === movingWc || t.closing === wc || wc.isDestroyed()) return;
        within(t.w, () => closeTab(t));
      },
      createWindow(details) { return createWindow({ urls: [].concat(details.url || []).filter((u) => typeof u === "string") }).win; },
      // also told when a window has closed (then it is gone already)
      removeWindow(bw) { if (!bw.isDestroyed() && windows.some((w) => w.win === bw && !w.gone)) bw.close(); },
      assignTabDetails(details, wc) { const t = tabOf(wc); if (t) Object.assign(details, { pinned: !!t.pinned, discarded: !!t.asleep }); },
    },
  });
}
// the web store's "Chrome에 추가": asked in that tab's ask bar, every time
function askExtension({ name, allSites, wontBlock, wc }) {
  return new Promise((done) => {
    const tab = tabOf(wc);
    if (!tab || tab.w.gone) return done(false);
    use(tab.w);
    asks.push({ id: nextId++, kind: "extension", tab, origin: "", host: "chromewebstore.google.com", what: [], name, allSites, wontBlock, done: [done] });
    if (tab !== active) select(tab);
    layout();
    tell();
  });
}

// ---- windows ------------------------------------------------------------------------
// priv: a private window; restore: one of the last run's windows ({ urls, ..., bounds });
// urls: its first tabs; tab: a tab taken from another window; at: where the pointer let go of it
function createWindow({ priv = false, restore = null, urls = [], tab = null, at = null } = {}) {
  store();
  const from = cur && !cur.gone ? cur.win : null;
  const saved = restore?.bounds || (windows.length ? null : load("window.json", null));
  const area = screen.getPrimaryDisplay().workArea;
  const fits = saved && screen.getAllDisplays().some((d) => saved.x >= d.workArea.x - 50 && saved.y >= d.workArea.y - 50 && saved.x < d.workArea.x + d.workArea.width - 100 && saved.y < d.workArea.y + d.workArea.height - 100);
  const size = from ? from.getNormalBounds() : null;
  let place = {};
  if (fits) place = { x: saved.x, y: saved.y, width: saved.width, height: saved.height };
  else {
    place = { width: size?.width || Math.min(1400, area.width - 80), height: size?.height || Math.min(900, area.height - 60) };
    if (at) Object.assign(place, { x: Math.round(at.x - 120), y: Math.round(at.y - 18) });
    else if (size) Object.assign(place, { x: size.x + 28, y: size.y + 28 });
  }
  const bw = new BrowserWindow({
    ...place, minWidth: 480, minHeight: 320,
    show: false, backgroundColor: SIDE, title: priv ? "Rove · 비공개" : "Rove", icon: join(__dirname, "rove.ico"),
    titleBarStyle: "hidden", titleBarOverlay: { color: SIDE, symbolColor: "#8a8e94", height: 40 },
    webPreferences: { preload: join(__dirname, "preload.cjs"), sandbox: true, contextIsolation: true, nodeIntegration: false, spellcheck: false },
  });
  const w = { id: nextId++, win: bw, overlay: null, overlayOn: null, tabs: [], active: null, findOpen: false, split: null, fullTab: null, groups: [],
    closed: priv ? [] : closedTabs, private: priv, ses: priv ? privateSession() : rove(), gone: false };
  windows.push(w);
  use(w);
  if (fits && saved.max) win.maximize();
  titleBar();
  const here = (f) => (...a) => { if (!w.gone) { use(w); return f(...a); } };
  win.webContents.on("before-input-event", here((e, input) => { if (keys(input, true)) e.preventDefault(); }));
  win.webContents.on("context-menu", here((e, p) => { if (p.isEditable) barMenu(p); }));
  win.webContents.on("will-navigate", (e) => e.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  bw.on("page-title-updated", (e) => e.preventDefault()); // ours, not the screen's <title>
  win.loadURL("rove://ui/index.html");
  // a test window is drawn (a hidden one draws no pages) but cannot be seen,
  // clicked or found in the taskbar
  if (TEST) { win.setSkipTaskbar(true); win.setOpacity(0); win.setIgnoreMouseEvents(true); win.setFocusable(false); }
  bw.once("ready-to-show", () => { if (TEST) bw.showInactive(); else bw.show(); });

  overlay = w.overlay = new WebContentsView({ webPreferences: { preload: join(__dirname, "preload.cjs"), sandbox: true, contextIsolation: true, nodeIntegration: false, spellcheck: false } });
  overlay.setBackgroundColor("#00000000");
  overlay.setVisible(false);
  overlay.webContents.loadURL("rove://ui/overlay.html");
  // Escape is the overlay's own (it closes it, unless a field there takes it first: a bookmark being renamed)
  overlay.webContents.on("before-input-event", here((e, input) => { if (input.key !== "Escape" && keys(input)) e.preventDefault(); }));
  overlay.webContents.on("will-navigate", (e) => e.preventDefault());
  overlay.webContents.on("blur", here(() => { if (overlayOn && overlayOn.kind !== "suggest" && overlayOn.kind !== "peek") hideOverlay(); }));
  win.contentView.addChildView(overlay);

  if (tab) putTab(tab, w);
  else if (restore) {
    groups = (Array.isArray(restore.groups) ? restore.groups : []).filter((g) => Number.isInteger(g?.id)).map((g) => ({ id: g.id, name: String(g.name || ""), color: COLORS.includes(g.color) ? g.color : "grey", collapsed: !!g.collapsed }));
    nextGroup = Math.max(nextGroup, ...groups.map((g) => g.id + 1));
    // only the tab in front loads; the others sleep until looked at
    const front = Math.min(Math.max(0, restore.active), restore.urls.length - 1);
    restore.urls.forEach((u, i) => newTab(u, { background: true, asleep: i !== front, title: restore.titles?.[i] || "", pinned: !!restore.pinned?.[i], group: groupOf(restore.group?.[i])?.id || null, nav: restore.nav?.[i] }));
    select(tabs[front]);
  } else {
    const first = urls.length ? urls : [HOME_PAGE];
    first.forEach((u, i) => newTab(u, { background: i > 0 }));
  }
  if (!priv) lastNormal = w;

  bw.on("resize", here(() => { hideOverlay(); layout(); }));
  // the mouse's back and forward buttons (Windows' app commands), as Alt+Left and Alt+Right
  bw.on("app-command", here((e, cmd) => {
    const h = active?.view.webContents.navigationHistory;
    if (cmd === "browser-backward") h?.goBack();
    else if (cmd === "browser-forward") h?.goForward();
  }));
  bw.on("enter-full-screen", here(() => { layout(); tell(); }));
  bw.on("leave-full-screen", here(() => { fullTab = null; layout(); tell(); }));
  bw.on("blur", here(() => { if (overlayOn?.kind === "suggest") hideOverlay(); }));
  bw.on("focus", here(() => { if (!priv) lastNormal = w; checkDefault(); })); // back from Windows' settings
  bw.on("close", here(() => {
    if (quitting || priv) return;
    w.closedAt = { ...bw.getNormalBounds(), max: bw.isMaximized() }; // where Ctrl+Shift+T puts it back (gone by "closed")
    // the last normal window: what it has is kept for the next start
    if (!windows.some((x) => x !== w && !x.private && !x.gone)) keepAll();
  }));
  bw.on("closed", () => closedWindow(w));
  return w;
}
// what is kept when Rove ends
function keepAll() {
  store();
  const first = windows.find((x) => !x.private && !x.gone);
  if (first) { try { save("window.json", { ...first.win.getNormalBounds(), max: first.win.isMaximized() }, true); } catch { /* going */ } }
  saveTabs(true);
  save("history.json", history, true);
  save("bookmarks.json", bookmarks, true);
  keepIcons(true);
  // one still coming down was never written (only a finished one is): kept as it is, the next
  // start reads it as interrupted, to get again (Chrome keeps it the same way)
  saveDownloads(true);
  flushSaves(); // settings, permissions changed in the last 0.8 s
}
function closedWindow(w) {
  if (cur === w) store();
  // a normal window closed while another stays: Ctrl+Shift+T brings it back (as in Chrome); on quit,
  // tabs.json keeps it instead. A private window is never kept.
  const kept = !quitting && !w.private && windows.some((x) => x !== w && !x.private) ? windowKept(w) : null;
  if (kept?.urls.length) { closedTabs.push(kept); if (closedTabs.length > 25) closedTabs.shift(); }
  w.gone = true;
  windows.splice(windows.indexOf(w), 1);
  if (share?.tab?.w === w) { const s = share; share = null; safe(() => s.answer(null)); }
  const gone = asks.filter((a) => a.tab && w.tabs.includes(a.tab));
  asks = asks.filter((a) => !gone.includes(a));
  for (const a of gone) for (const f of a.done) safe(() => f(false));
  for (const t of w.tabs) { blocked.delete(t.view.webContents.id); try { t.view.webContents.close(); } catch { /* gone */ } }
  try { w.overlay.webContents.close(); } catch { /* gone */ }
  if (cur === w) { cur = null; if (windows.length) use(windows[windows.length - 1]); }
  if (lastNormal === w) lastNormal = windows.find((x) => !x.private) || null;
  if (w.private && !windows.some((x) => x.private)) endPrivate();
  // a window closed while others stay: tabs.json no longer has it (closedTabs does, above)
  if (!quitting && !w.private && windows.some((x) => !x.private)) saveTabs(true);
  if (!windows.length) app.quit();
  else tell();
}

// ---- tabs between windows -------------------------------------------------------------
// a tab taken out of its window, its page going on; its window keeps going (empty: the caller closes it)
function takeTab(tab) {
  const w = tab.w;
  if (!w || w.gone) return false;
  return within(w, () => {
    const i = tabs.indexOf(tab);
    if (i < 0) return false;
    if (share?.tab === tab) dropShare();
    tabs.splice(i, 1);
    if (split?.a === tab || split?.b === tab) split = null;
    if (fullTab === tab) fullTab = null;
    tab.group = null;
    tab.pinned = false;
    groups = groups.filter((g) => tabs.some((t) => t.group === g.id));
    win.contentView.removeChildView(tab.view);
    if (active === tab) { active = tabs.length ? tabs[Math.min(i, tabs.length - 1)] : null; if (active) wake(active); }
    layout();
    tell();
    return true;
  });
}
function putTab(tab, w, at = null) {
  within(w, () => {
    tab.w = w;
    const pins = tabs.filter((t) => t.pinned).length;
    tabs.splice(at === null ? tabs.length : Math.max(pins, Math.min(tabs.length, at)), 0, tab);
    win.contentView.addChildView(tab.view);
    overlayOnTop();
    select(tab);
  });
  movingWc = tab.view.webContents;
  try { exts?.moved(movingWc, w.win); } finally { movingWc = null; }
}
function moveToWindow(tab, w, at = null) {
  const from = tab.w;
  if (!w || w === from || w.gone || w.private !== from.private) return;
  if (!takeTab(tab)) return;
  putTab(tab, w, at);
  if (!from.tabs.length) from.win.close();
  w.win.focus();
}
// a tab dragged out of the strip and let go at (x, y) on the screen: into another
// window's tabs under it, else a new window there (a window's only tab moves the window)
function tear(tab, x, y) {
  const from = tab.w;
  const into = windows.find((w) => w !== from && !w.gone && w.private === from.private && inStrip(w, x, y));
  if (into) { moveToWindow(tab, into); return; }
  if (from.tabs.length === 1) { from.win.setPosition(Math.round(x - 120), Math.round(y - 18)); return; }
  if (takeTab(tab)) createWindow({ priv: from.private, tab, at: { x, y } });
}
function inStrip(w, x, y) {
  const b = w.win.getContentBounds();
  if (x < b.x || x >= b.x + b.width || y < b.y || y >= b.y + b.height) return false;
  return settings.vertical ? x < b.x + (settings.narrow ? SIDE_NARROW : SIDE_W) : y < b.y + 40;
}
const windowName = (w) => { const n = w.tabs.length; const t = w.active?.title || w.tabs[0]?.title || "창"; return n > 1 ? `${t} 외 ${n - 1}개` : t; };

// ---- private windows: one session in memory for all of them, thrown away with the last
let privateSes = null;
function privateSession() {
  if (privateSes) return privateSes;
  const ses = session.fromPartition(`rove-private-${Date.now()}`);
  serveUi(ses.protocol, { tab: true, priv: true });
  cleanAgent(ses);
  permissions(ses, true);
  sharing(ses);
  blocking(ses, true);
  downloadsTo(ses, true);
  spelling(ses);
  privateSes = ses;
  return ses;
}
function endPrivate() {
  const ses = privateSes;
  privateSes = null;
  privGrants = {};
  privSites = { allow: [], awake: [] };
  // a program still asked about has no window left to answer in: not kept (Chrome cancels a private
  // window's downloads with the last one)
  const unasked = asks.filter((a) => a.kind === "download" && a.d.private);
  asks = asks.filter((a) => !unasked.includes(a));
  for (const a of unasked) keepDownload(a.d, false);
  downloads = downloads.filter((d) => !d.private || d.state === "progressing");
  if (ses) { ses.clearStorageData().catch(() => {}); ses.clearCache().catch(() => {}); }
  log("비공개 창 끝: 데이터 지움");
  tell();
}

// ---- tests only (ROVE_TEST): reached from the main process's inspector -----------------
// shot(file): the window as it would look, put together from its views (each
// view is captured on its own; a hidden window has no picture of its own)
function testHooks() {
  const { BrowserWindow: W } = require("electron");
  async function shot(out) {
    const { w, h } = bounds();
    const parts = [{ img: await win.webContents.capturePage(), x: 0, y: 0 }];
    for (const t of tabs) {
      if (t.crashed || !t.view.getVisible()) continue;
      const b = t.view.getBounds();
      parts.push({ img: await t.view.webContents.capturePage(), x: b.x, y: b.y });
    }
    if (overlayOn) {
      const b = overlay.getBounds();
      parts.push({ img: await overlay.webContents.capturePage(), x: b.x, y: b.y });
    }
    const html = `<body style="margin:0;width:${w}px;height:${h}px;position:relative;overflow:hidden;background:#0a0e11">` +
      parts.map((p) => `<img style="position:absolute;left:${p.x}px;top:${p.y}px;width:${p.img.getSize().width}px" src="${p.img.toDataURL()}">`).join("") + "</body>";
    const c = new W({ show: false, width: w, height: h, useContentSize: true, webPreferences: { offscreen: false, sandbox: true } });
    await c.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
    await new Promise((r) => setTimeout(r, 150));
    const img = await c.webContents.capturePage();
    c.destroy();
    writeFileSync(out, img.toPNG());
    return { w, h, parts: parts.length };
  }
  globalThis.__rove = { get win() { return win; }, get overlay() { return overlay; }, get overlayOn() { return overlayOn; }, get tabs() { return tabs; }, get active() { return active; },
    windows, use, get cur() { return cur; }, createWindow, takeTab, putTab, moveToWindow, tear, inStrip, get privGrants() { return privGrants; }, get privateSes() { return privateSes; }, record,
    keys, keyAction, newTab, go, toUrl, select, closeTab, showOverlay, hideOverlay, snapshot, shot, star, setFind, get history() { return history; }, get bookmarks() { return bookmarks; }, get downloads() { return downloads; },
    get asks() { return asks; }, answer, askExtension, get grants() { return grants; }, get settings() { return settings; }, setBlock, get blocker() { return blocker; }, blocked,
    makeDefault, checkDefault, defaults, AS, opened, get pass() { return pass; }, clipboard, passFill, passPeek, passSave, passCopy, passItems, passCodes, passQuick, passIdle,
    get share() { return share; }, get chosen() { return chosen; }, shareAnswer, dropShare, mute, moveTab, tabItems, get closed() { return closed; }, siteInfo, setSite, clearSite, session: rove,
    setUpdater: (make) => { updates = make(() => tell()); tell(); }, // a fake update.cjs updater: no install, no network
    sleepTab, wake, sleepIdle, canSleep, get lastMenu() { return lastMenu; }, pip, importSources, importFrom, places, zoom,
    pin, splitWith, unsplit, splitRatio, get split() { return split; }, read, lookReadable, reader,
    setAwake, keepGoing, awakeFor, siteOf, savePageTo, openPaths, startWindows,
    get groups() { return groups; }, groupNew, groupAdd, groupOut, groupSet, groupFold, ungroup, groupClose, setVertical, setNarrow, frame,
    get exts() { return exts; } };
}

app.on("second-instance", (e, argv) => booted.then(() => {
  const w = lastNormal && !lastNormal.gone ? lastNormal : windows.find((x) => !x.private && !x.gone);
  if (!w) { createWindow({ urls: opened(argv.slice(1)) }); return; }
  use(w);
  if (win.isMinimized()) win.restore();
  win.focus();
  const urls = opened(argv.slice(1));
  if (urls.length) urls.forEach((u) => newTab(u)); else newTab(HOME_PAGE);
}));
app.on("web-contents-created", (e, wc) => {
  // nothing of ours opens a page, and no page gets a <webview>
  wc.on("will-attach-webview", (ev) => ev.preventDefault());
});
app.on("window-all-closed", () => app.quit());
app.on("before-quit", (e) => {
  if (!quitting) { keepAll(); quitting = true; } if (onClip) { e.preventDefault(); clearSecret().finally(() => app.quit()); } });
