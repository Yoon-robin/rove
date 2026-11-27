// Chrome extensions (1.2, robin 2026-11-26 "chrome 확장기능 rove에서 쓸수있게해줘야지 왜안돼").
// electron-chrome-extensions gives extensions the chrome.* API (tabs, windows,
// the toolbar button and its popup, context menus) and electron-chrome-web-store
// lets chromewebstore.google.com install into Rove ("Chrome에 추가"), keeps the
// installed ones up to date and loads them at start.
//
// Only the normal session (persist:rove): Electron has no extensions in an
// in-memory one, so a private window has none (as Chrome's default).
// Pages of that session get the two libraries' preloads (the chrome.* API
// inside extension pages and content scripts, the web store's install API on
// chromewebstore.google.com only).
//
// Electron's own webRequest (our ad blocking, blocker.cjs) takes the place of
// an extension's chrome.webRequest, and declarativeNetRequest is not there:
// an ad blocking extension does nothing here, Rove's own blocking does that.
// So the ask before such an install says so (blocksRequests).
const { nativeImage, session, webContents } = require("electron");
const { existsSync } = require("node:fs");
const { join } = require("node:path");
const { ElectronChromeExtensions } = require("electron-chrome-extensions");
const webStore = require("electron-chrome-web-store");

const STORE = "https://chromewebstore.google.com/";
// The store (and Google's bar over it) asks to switch to Chrome: "Chrome으로
// 전환하여 확장 프로그램 및 테마 설치" over every item and a "Chrome으로
// 전환하시겠습니까?" bubble. Its server tells real Chrome apart by a header only
// Chrome can make, so the page can't be told Rove adds; those two are hidden
// on the store instead (the store's other notices stay). Rove에 추가 works the same.
const NO_SWITCH = [
  '[jscontroller="o2G9me"]:has([jslog^="276336"])', // the notice with "Chrome 설치하기"
  'div:has(> iframe[name="callout"])', // the bar's bubble
].join(",") + "{display:none!important}";
const onStore = (url) => { try { return new URL(url).origin === new URL(STORE).origin; } catch { return false; } };

// ses: the session the pages are in; dir: where installed extensions are kept;
// impl: Rove's tabs and windows for chrome.tabs / chrome.windows (see main.cjs);
// confirm({ name, id, allSites, wontBlock, wc }) → Promise<boolean>: asked before an install;
// actionsPreload: the file that gives our toolbar <browser-action-list>
function start({ ses, dir, impl, confirm, actionsPreload, log }) {
  const api = new ElectronChromeExtensions({ session: ses, ...impl });
  // the toolbar (our own screen, the default session) shows the icons through crx://
  ElectronChromeExtensions.handleCRXProtocol(session.defaultSession);
  session.defaultSession.registerPreloadScript({ id: "rove-actions", type: "frame", filePath: actionsPreload });
  api.on("browser-action-popup-created", (popup) => popup.browserWindow?.setMenu?.(null));

  const ready = webStore.installChromeWebStore({
    session: ses,
    extensionsPath: dir,
    autoUpdate: true,
    beforeInstall: async ({ id, localizedName, manifest, frame }) => {
      const yes = await confirm({ id, name: localizedName || manifest?.name || id, allSites: allSites(manifest), wontBlock: blocksRequests(manifest), wc: (frame && webContents.fromFrame(frame)) || null }).catch(() => false);
      log(`확장 프로그램 ${yes ? "추가" : "안 함"}: ${localizedName || id}`);
      return { action: yes ? "allow" : "deny" };
    },
  }).then(() => log(`확장 프로그램 ${(ses.extensions || ses).getAllExtensions().length}개`), (e) => log(`확장 프로그램을 못 불러옴: ${e.message}`));

  const exts = () => (ses.extensions || ses).getAllExtensions();
  const watched = new WeakSet();
  const noSwitch = (wc) => {
    if (watched.has(wc)) return;
    watched.add(wc);
    wc.on("dom-ready", () => { if (onStore(wc.getURL())) wc.insertCSS(NO_SWITCH).catch(() => {}); });
  };
  return {
    ready,
    // a page's view: told to the extensions as a tab of `bw` (a private one is not theirs)
    add(wc, bw) { if (wc.session === ses && !wc.isDestroyed()) { api.addTab(wc, bw); noSwitch(wc); } },
    select(wc) { if (wc.session === ses && !wc.isDestroyed()) api.selectTab(wc); },
    // moved to another window: chrome.tabs sees it go and come (impl.removeTab is told not to close it)
    moved(wc, bw) { if (wc.session !== ses || wc.isDestroyed()) return; api.removeTab(wc); api.addTab(wc, bw); },
    menu(wc, params) { return wc.session === ses ? api.getContextMenuItems(wc, params) : []; },
    list() {
      return exts().map((e) => ({ id: e.id, name: e.name, version: e.version, icon: icon(e), options: optionsOf(e) })).sort((a, b) => a.name.localeCompare(b.name, "ko"));
    },
    async remove(id) {
      if (!exts().some((e) => e.id === id)) return false;
      await webStore.uninstallExtension(id, { session: ses, extensionsPath: dir });
      log(`확장 프로그램 지움: ${id}`);
      return true;
    },
    options(id) { return optionsOf(exts().find((e) => e.id === id)); },
    // an extension's keyboard shortcut (its manifest commands' suggested_key, as Chrome and Brave
    // take them) for the page `wc`: { action: id } opens its toolbar button's popup, { run } tells
    // the extension (chrome.commands.onCommand with the tab, Chrome 86+). The library keeps the
    // commands but never listens for their keys, so Rove does; its router and tabs are not public.
    key(input, wc) {
      if (input.type !== "keyDown" || !wc || wc.isDestroyed() || wc.session !== ses) return null;
      for (const e of exts()) {
        for (const [name, c] of Object.entries(e.manifest.commands || {})) {
          if (!keyIs(c?.suggested_key, input)) continue;
          if (ACTION.has(name)) return { action: e.id };
          return { run: () => api.ctx.router.sendEvent(e.id, "commands.onCommand", name, api.api.tabs.getTabDetails(wc)) };
        }
      }
      return null;
    },
  };
}

// the commands that press the extension's toolbar button (MV3, MV2 and page action)
const ACTION = new Set(["_execute_action", "_execute_browser_action", "_execute_page_action"]);
// suggested_key: "Ctrl+Shift+Y" or { windows, default }; Chrome takes Ctrl or Alt with a letter, a
// digit or one of these keys (and Shift but not alone), matched by where the key is (input.code)
const NAMED = { Comma: "Comma", Period: "Period", Home: "Home", End: "End", PageUp: "PageUp", PageDown: "PageDown", Space: "Space", Insert: "Insert", Delete: "Delete", Up: "ArrowUp", Down: "ArrowDown", Left: "ArrowLeft", Right: "ArrowRight" };
function keyIs(suggested, input) {
  const s = typeof suggested === "string" ? suggested : suggested?.windows || suggested?.default;
  if (typeof s !== "string") return false;
  const parts = s.split("+").map((p) => p.trim());
  const k = parts.pop();
  const mods = new Set(parts);
  if (![...mods].every((m) => m === "Ctrl" || m === "Alt" || m === "Shift") || !(mods.has("Ctrl") || mods.has("Alt"))) return false;
  const code = /^[A-Z]$/.test(k) ? `Key${k}` : /^[0-9]$/.test(k) ? `Digit${k}` : NAMED[k];
  return !!code && input.code === code && !!input.control === mods.has("Ctrl") && !!input.alt === mods.has("Alt") && !!input.shift === mods.has("Shift") && !input.meta;
}

// content scripts or host permissions on every site: what the ask bar says
function allSites(m = {}) {
  const any = (list) => (list || []).some((p) => p === "<all_urls>" || /^(\*|https?):\/\/\*\//.test(p));
  return any(m.host_permissions) || any(m.permissions) || (m.content_scripts || []).some((c) => any(c.matches));
}
// an extension that blocks or changes requests (uBlock Origin Lite, AdGuard, ...): it would do nothing here
function blocksRequests(m = {}) {
  const all = [...(m.permissions || []), ...(m.optional_permissions || [])];
  return all.some((p) => typeof p === "string" && (p.startsWith("declarativeNetRequest") || p === "webRequestBlocking"));
}
function optionsOf(e) {
  if (!e) return null;
  const page = e.manifest.options_ui?.page || e.manifest.options_page;
  return page ? `chrome-extension://${e.id}/${page.replace(/^\//, "")}` : null;
}
// the manifest's biggest icon up to 128, as a data: address (the drawer is our screen, not the extension's)
function icon(e) {
  const sizes = Object.keys(e.manifest.icons || {}).map(Number).filter((n) => n <= 128).sort((a, b) => b - a);
  for (const n of sizes) {
    const f = join(e.path, e.manifest.icons[n]);
    if (!existsSync(f)) continue;
    const img = nativeImage.createFromPath(f);
    if (!img.isEmpty()) return img.resize({ width: 32, height: 32, quality: "best" }).toDataURL();
  }
  return null;
}

module.exports = { start, STORE, blocksRequests, keyIs };
