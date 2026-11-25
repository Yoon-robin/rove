// RobinPass in Rove (robin 2026-11-25 "이어서해봐", after 0.2.0): Rove talks
// to RobinPass (Vaultwarden, the Bitwarden API) the way Bitwarden's own apps
// do and opens the vault itself. The master password never leaves this
// process: it makes the master key here (PBKDF2-SHA256 or Argon2id, as the
// account says), the server gets only its hash, and the vault comes down
// encrypted and is opened in memory. Locked again when Rove closes, the
// screen locks, or "잠그기".
//
// Kept on disk (pass.json): the address, the e-mail, the KDF, the account's
// key as the server gives it (encrypted with the master key) and, through
// Windows (safeStorage), the refresh token. Nothing open is ever written.
const crypto = require("node:crypto");
const { readFileSync, writeFileSync, renameSync } = require("node:fs");
const { getDomain, getHostname } = require("tldts");

// ---- crypto (Bitwarden's formats) --------------------------------------------------------
const hmac = (key, data) => crypto.createHmac("sha256", key).update(data).digest();
function hkdfExpand(prk, info, len = 32) {
  let t = Buffer.alloc(0);
  const out = [];
  for (let i = 1; out.reduce((n, b) => n + b.length, 0) < len; i++) {
    t = hmac(prk, Buffer.concat([t, Buffer.from(info), Buffer.from([i])]));
    out.push(t);
  }
  return Buffer.concat(out).subarray(0, len);
}
// The server says how the master key is made (prelogin). A server that lies could ask for a
// weak one and then try passwords against the hash it gets, so below Bitwarden's floor we stop.
function strongKdf(kdf) {
  const n = (v) => Number.isInteger(v) ? v : -1;
  if (!kdf?.type) return n(kdf?.iterations) >= 600000 && n(kdf.iterations) <= 2000000;
  return kdf.type === 1 && n(kdf.iterations) >= 2 && n(kdf.iterations) <= 10 && n(kdf.memory) >= 16 && n(kdf.memory) <= 1024 && n(kdf.parallelism) >= 1 && n(kdf.parallelism) <= 16;
}
async function masterKey(password, email, kdf) {
  if (!strongKdf(kdf)) throw new Error("kdf");
  const salt = email.trim().toLowerCase();
  if (!kdf.type) return crypto.pbkdf2Sync(Buffer.from(password, "utf8"), Buffer.from(salt, "utf8"), kdf.iterations, 32, "sha256");
  const { argon2id } = require("hash-wasm");
  return Buffer.from(await argon2id({ password, salt: crypto.createHash("sha256").update(salt).digest(), parallelism: kdf.parallelism,
    iterations: kdf.iterations, memorySize: kdf.memory * 1024, hashLength: 32, outputType: "binary" }));
}
const stretch = (mk) => ({ enc: hkdfExpand(mk, "enc"), mac: hkdfExpand(mk, "mac") });
const passwordHash = (mk, password) => crypto.pbkdf2Sync(mk, Buffer.from(password, "utf8"), 1, 32, "sha256").toString("base64");
const split = (b) => ({ enc: b.subarray(0, 32), mac: b.subarray(32, 64) });

// "2.iv|data|mac" (AES-256-CBC + HMAC-SHA256), "4.data" (RSA-OAEP SHA-1 with the account's private key)
function decrypt(s, key) {
  if (s == null || s === "") return null;
  const dot = s.indexOf(".");
  const type = Number(s.slice(0, dot));
  const parts = s.slice(dot + 1).split("|").map((p) => Buffer.from(p, "base64"));
  if (type === 2) {
    const [iv, data, mac] = parts;
    const want = hmac(key.mac, Buffer.concat([iv, data]));
    if (!mac || mac.length !== want.length || !crypto.timingSafeEqual(mac, want)) throw new Error("mac");
    const d = crypto.createDecipheriv("aes-256-cbc", key.enc, iv);
    return Buffer.concat([d.update(data), d.final()]);
  }
  if (type === 4 || type === 6) {
    if (!key.private) throw new Error("no private key");
    return crypto.privateDecrypt({ key: key.private, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha1" }, parts[0]);
  }
  throw new Error(`EncString ${type}`);
}
function encrypt(buf, key) {
  const iv = crypto.randomBytes(16);
  const c = crypto.createCipheriv("aes-256-cbc", key.enc, iv);
  const data = Buffer.concat([c.update(buf), c.final()]);
  return `2.${iv.toString("base64")}|${data.toString("base64")}|${hmac(key.mac, Buffer.concat([iv, data])).toString("base64")}`;
}
const text = (s, key) => { const b = decrypt(s, key); return b == null ? null : b.toString("utf8"); };
const seal = (s, key) => (s == null || s === "" ? null : encrypt(Buffer.from(String(s), "utf8"), key));

// the server answers in PascalCase or camelCase, depending on its age
function lc(v) {
  if (Array.isArray(v)) return v.map(lc);
  if (!v || typeof v !== "object") return v;
  const o = {};
  for (const [k, x] of Object.entries(v)) o[k.charAt(0).toLowerCase() + k.slice(1)] = lc(x);
  return o;
}

// ---- one-time codes (RFC 6238) --------------------------------------------------------------
function base32(s) {
  const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const c of s.toUpperCase().replace(/[\s=-]/g, "")) { const i = A.indexOf(c); if (i < 0) throw new Error("base32"); bits += i.toString(2).padStart(5, "0"); }
  const out = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(out);
}
// a plain base32 key, otpauth://totp/… (SHA-1/256/512, 4–10 digits, any period up to 5 minutes)
// or Steam's (steam://<key>, or otpauth with encoder=steam): five letters from its own alphabet.
// A key that is none of these throws; callers treat that as no code.
const STEAM = "23456789BCDFGHJKMNPQRTVWXY";
function totp(spec, now = Date.now()) {
  if (!spec) return null;
  let secret = spec.trim(), digits = 6, period = 30, algo = "sha1", steam = false;
  if (/^steam:\/\//i.test(secret)) { secret = secret.slice(8); steam = true; }
  else if (/^otpauth:/i.test(secret)) {
    const u = new URL(secret);
    if (u.hostname.toLowerCase() !== "totp") throw new Error("hotp");
    secret = u.searchParams.get("secret") || "";
    digits = Number(u.searchParams.get("digits")) || 6;
    period = Number(u.searchParams.get("period")) || 30;
    algo = (u.searchParams.get("algorithm") || "sha1").toLowerCase().replace("-", "");
    steam = (u.searchParams.get("encoder") || "").toLowerCase() === "steam";
  }
  if (!["sha1", "sha256", "sha512"].includes(algo) || digits < 4 || digits > 10 || !(period >= 1 && period <= 300)) throw new Error("totp");
  const key = base32(secret);
  if (!key.length) throw new Error("base32");
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(now / 1000 / period)));
  const h = crypto.createHmac(algo, key).update(counter).digest();
  const o = h[h.length - 1] & 15;
  let n = h.readUInt32BE(o) & 0x7fffffff;
  let code;
  if (steam) { code = ""; for (let i = 0; i < 5; i++) { code += STEAM[n % STEAM.length]; n = Math.floor(n / STEAM.length); } }
  else code = String(n % 10 ** digits).padStart(digits, "0");
  return { code, left: period - (Math.floor(now / 1000) % period), period };
}

// ---- which logins belong to a page ------------------------------------------------------------
// Bitwarden's matching: 0 base domain (the default), 1 host, 2 starts with, 3 exact, 4 regex, 5 never
function matches(uri, match, page) {
  if (!uri || !page) return false;
  const u = /^[a-z][a-z0-9+.-]*:/i.test(uri) ? uri : "https://" + uri;
  try {
    switch (match ?? 0) {
      case 1: { const a = new URL(u), b = new URL(page); return a.host === b.host; }
      case 2: return page.startsWith(u);
      case 3: return page === u;
      case 4: return new RegExp(uri, "i").test(page);
      case 5: return false;
      default: {
        // the private part of the suffix list too: a.github.io and b.github.io are two sites
        const d = (x) => getDomain(x, { allowPrivateDomains: true }) || getHostname(x);
        const a = d(u), b = d(page);
        return !!a && a === b;
      }
    }
  } catch { return false; }
}

// ---- the vault ------------------------------------------------------------------------------------
// fetch: the network (Electron's, for Rove); file: pass.json; protect: { seal(str) -> str, open(str) -> str } (Windows' safeStorage)
function vault({ fetch, file, protect, server: fixed, log = () => {} }) {
  let saved = (() => { try { return JSON.parse(readFileSync(file, "utf8")); } catch { return null; } })();
  let live = null; // { key, orgs: { id: key }, items: [...], access, accessUntil, syncedAt }
  const keep = () => {
    if (!saved) { try { writeFileSync(file + ".tmp", "null"); renameSync(file + ".tmp", file); } catch { /* next time */ } return; }
    try { writeFileSync(file + ".tmp", JSON.stringify(saved, null, 1)); renameSync(file + ".tmp", file); } catch { /* next time */ }
  };
  const base = () => (saved?.server || fixed).replace(/\/+$/, "");
  const device = () => {
    if (!saved.device) { saved.device = crypto.randomUUID(); keep(); }
    return saved.device;
  };

  async function call(path, { method = "GET", body, form, token } = {}) {
    const headers = { Accept: "application/json", "Bitwarden-Client-Name": "desktop", "Bitwarden-Client-Version": "2026.10.0", "Device-Type": "6" };
    if (token) headers.Authorization = `Bearer ${token}`;
    let payload;
    if (form) { headers["Content-Type"] = "application/x-www-form-urlencoded; charset=utf-8"; payload = new URLSearchParams(form).toString(); }
    else if (body !== undefined) { headers["Content-Type"] = "application/json"; payload = JSON.stringify(body); }
    const r = await fetch(base() + path, { method, headers, body: payload });
    const t = await r.text();
    let data = null;
    try { data = t ? lc(JSON.parse(t)) : null; } catch { data = { message: t.slice(0, 200) }; }
    return { ok: r.ok, status: r.status, data };
  }
  const why = (d) => d?.errorModel?.message || d?.message || d?.error_description || d?.error || "";

  async function prelogin(email) {
    const r = await call("/identity/accounts/prelogin", { method: "POST", body: { email } });
    if (!r.ok) throw new Error(why(r.data) || `prelogin ${r.status}`);
    return { type: r.data.kdf || 0, iterations: r.data.kdfIterations, memory: r.data.kdfMemory || 0, parallelism: r.data.kdfParallelism || 0 };
  }

  // the account's key and the organizations' keys, from what the server keeps for us
  function openKeys(protectedKey, stretched, privateKey, orgs) {
    const raw = decrypt(protectedKey, stretched);
    const key = raw.length === 64 ? split(raw) : { enc: raw.subarray(0, 32), mac: hkdfExpand(raw, "mac") };
    const out = { key, orgs: {} };
    if (privateKey) {
      key.private = crypto.createPrivateKey({ key: decrypt(privateKey, key), format: "der", type: "pkcs8" });
      for (const o of orgs || []) { try { out.orgs[o.id] = split(decrypt(o.key, key)); } catch (e) { log(`RobinPass: 조직 열쇠 못 엶 ${e.message}`); } }
    }
    return out;
  }

  function openItem(c) {
    if (c.type !== 1 || c.deletedDate) return null;
    let key = c.organizationId ? live.orgs[c.organizationId] : live.key;
    if (!key) return null;
    try {
      if (c.key) key = split(decrypt(c.key, key));
      const l = c.login || {};
      return { id: c.id, name: text(c.name, key) || "", username: text(l.username, key) || "", password: text(l.password, key) || "",
        totp: text(l.totp, key) || "", uris: (l.uris || []).map((u) => ({ uri: text(u.uri, key) || "", match: u.match })).filter((u) => u.uri),
        reprompt: !!c.reprompt, revised: c.revisionDate || "" };
    } catch (e) { log(`RobinPass: 항목 못 엶 ${c.id} ${e.message}`); return null; }
  }

  async function token() {
    if (live?.access && Date.now() < live.accessUntil - 60e3) return live.access;
    const refresh = saved?.refresh && protect.open(saved.refresh);
    if (!refresh) throw Object.assign(new Error("다시 로그인해야 해요"), { relogin: true });
    const r = await call("/identity/connect/token", { method: "POST", form: { grant_type: "refresh_token", client_id: "desktop", refresh_token: refresh } });
    if (!r.ok) throw Object.assign(new Error(why(r.data) || `token ${r.status}`), { relogin: r.status === 400 || r.status === 401 });
    took(r.data);
    return live.access;
  }
  function took(d) {
    live.access = d.access_token;
    live.accessUntil = Date.now() + (Number(d.expires_in) || 3600) * 1000;
    if (d.refresh_token) { saved.refresh = protect.seal(d.refresh_token); keep(); }
  }

  async function sync() {
    const r = await call("/api/sync?excludeDomains=true", { token: await token() });
    if (!r.ok) throw new Error(why(r.data) || `sync ${r.status}`);
    const p = r.data.profile || {};
    // the keys may have been changed elsewhere (a new master password): those come with the next unlock
    if (p.key && p.key !== saved.key) { saved.key = p.key; saved.privateKey = p.privateKey || saved.privateKey; keep(); }
    if (p.privateKey && live.key.private == null) live.key.private = crypto.createPrivateKey({ key: decrypt(p.privateKey, live.key), format: "der", type: "pkcs8" });
    for (const o of p.organizations || []) if (!live.orgs[o.id] && o.key) { try { live.orgs[o.id] = split(decrypt(o.key, live.key)); } catch { /* not ours to open */ } }
    live.me = p.id;
    live.items = (r.data.ciphers || []).map(openItem).filter(Boolean);
    live.syncedAt = Date.now();
    log(`RobinPass: 금고 ${live.items.length}개`);
    return live.items.length;
  }

  return {
    status: () => ({ state: live ? "open" : saved?.key ? "locked" : "none", email: saved?.email || "", server: base() }),

    // first time on this PC: e-mail and master password (and the second step when the account has one)
    async login(email, password, second = null) {
      email = String(email || "").trim().toLowerCase();
      if (!email || !password) return { error: "메일과 마스터 비밀번호를 넣어 주세요" };
      try {
        const kdf = second?.kdf || await prelogin(email);
        const mk = await masterKey(password, email, kdf);
        saved = { server: base(), email, kdf, device: saved?.email === email ? saved.device : crypto.randomUUID() };
        const form = { grant_type: "password", username: email, password: passwordHash(mk, password), scope: "api offline_access", client_id: "desktop",
          deviceType: "6", deviceIdentifier: saved.device, deviceName: "Rove" };
        if (second?.code) Object.assign(form, { twoFactorToken: String(second.code).replace(/\s/g, ""), twoFactorProvider: String(second.provider), twoFactorRemember: "1" });
        else if (saved.remember) Object.assign(form, { twoFactorToken: protect.open(saved.remember), twoFactorProvider: "5" });
        const r = await call("/identity/connect/token", { method: "POST", form });
        if (!r.ok) {
          const providers = r.data?.twoFactorProviders2 ? Object.keys(r.data.twoFactorProviders2).map(Number) : (r.data?.twoFactorProviders || []).map(Number);
          if (providers.length) {
            // the e-mail code is sent when asked for
            if (providers.includes(1) && !providers.includes(0)) await call("/api/two-factor/send-email-login", { method: "POST", body: { email, masterPasswordHash: form.password, deviceIdentifier: saved.device } });
            return { second: providers.filter((p) => p === 0 || p === 1), kdf };
          }
          saved = null; keep();
          if (r.status === 429) return { error: "로그인을 너무 자주 했어요. 1분쯤 뒤에 다시 해 주세요", ...(second?.code ? { second: [Number(second.provider)], kdf } : {}) };
          if (second?.code && r.status === 400) return { error: "인증 코드가 맞지 않아요", second: [Number(second.provider)], kdf };
          return { error: /username or password|invalid_grant/i.test(why(r.data)) ? "메일이나 마스터 비밀번호가 틀렸어요" : why(r.data) || `로그인 실패 (${r.status})` };
        }
        const d = r.data;
        saved.key = d.key;
        saved.privateKey = d.privateKey || null;
        if (d.twoFactorToken) saved.remember = protect.seal(d.twoFactorToken);
        live = { ...openKeys(d.key, stretch(mk), d.privateKey, []), items: [] };
        took(d);
        keep();
        await sync();
        return { ok: true };
      } catch (e) {
        log(`RobinPass 로그인: ${e.message}`);
        return { error: e.message === "mac" ? "마스터 비밀번호가 맞지 않아요" : e.message === "kdf" ? "RobinPass 서버가 보낸 암호화 설정이 너무 약해요" : `RobinPass에 닿지 못했어요 (${e.message})` };
      }
    },

    // later: the master password opens what is kept, then the vault comes down
    async unlock(password) {
      if (!saved?.key) return { error: "먼저 로그인해 주세요" };
      try {
        const mk = await masterKey(password, saved.email, saved.kdf);
        live = { ...openKeys(saved.key, stretch(mk), saved.privateKey, []), items: [] };
      } catch (e) { live = null; return { error: e.message === "kdf" ? "RobinPass 서버가 보낸 암호화 설정이 너무 약해요" : "마스터 비밀번호가 맞지 않아요" }; }
      try { await sync(); } catch (e) {
        if (e.relogin) { live = null; return { error: "다시 로그인해야 해요", relogin: true }; }
        return { ok: true, offline: e.message };
      }
      return { ok: true };
    },

    lock() { if (live) { live = null; log("RobinPass: 잠금"); } },
    logout() { live = null; saved = null; keep(); },
    sync: () => (live ? sync() : Promise.resolve(0)),
    syncedAt: () => live?.syncedAt || 0,

    // what a page may get filled with (names only for the screens)
    forPage(url) { return live ? live.items.filter((i) => i.uris.some((u) => matches(u.uri, u.match, url))) : []; },
    search(q) {
      if (!live) return [];
      const s = String(q || "").trim().toLowerCase();
      return live.items.filter((i) => !s || (i.name + " " + i.username + " " + i.uris.map((u) => u.uri).join(" ")).toLowerCase().includes(s)).slice(0, 200);
    },
    // the logins with an authenticator key, for the 인증 코드 list (names, not keys)
    withCodes(q) {
      if (!live) return [];
      const s = String(q || "").trim().toLowerCase();
      return live.items.filter((i) => i.totp && (!s || (i.name + " " + i.username + " " + i.uris.map((u) => u.uri).join(" ")).toLowerCase().includes(s)));
    },
    item: (id) => live?.items.find((i) => i.id === id) || null,
    code: (id) => { const i = live?.items.find((x) => x.id === id); try { return i?.totp ? totp(i.totp) : null; } catch { return null; } },

    // a new login, as the page has it
    async add({ name, uri, username, password }) {
      if (!live) return { error: "잠겨 있어요" };
      const k = live.key;
      const body = { type: 1, encryptedFor: live.me, name: seal(name || getHostname(uri) || uri, k), notes: null, favorite: false, reprompt: 0, organizationId: null, folderId: null,
        login: { username: seal(username, k), password: seal(password, k), totp: null, uris: [{ uri: seal(uri, k), match: null }] } };
      const r = await call("/api/ciphers", { method: "POST", body, token: await token() });
      if (!r.ok) return { error: why(r.data) || `저장 실패 (${r.status})` };
      const it = openItem(r.data);
      if (it) live.items.push(it);
      return { ok: true, id: it?.id };
    },
  };
}

module.exports = { vault, matches, totp, strongKdf, masterKey, stretch, passwordHash, encrypt, decrypt, split, hkdfExpand, lc };
