// For tests only: a throwaway account on a throwaway RobinPass (ops/robinpass/pass-test.sh,
// through an SSH tunnel on 8086), made the way the web vault makes one, and a few logins in it.
//   node test/pass-account.cjs <out.json> [pbkdf2|argon2] [2fa]
// Writes { server, email, password, kdf, items, secret } to out.json (the scratch folder, never the repository).
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; // the instance's own certificate, localhost only
const crypto = require("node:crypto");
const { writeFileSync } = require("node:fs");
const { masterKey, stretch, passwordHash, encrypt, lc, totp } = require("../vault.cjs");

const server = process.env.PASS_SERVER || "https://localhost:8086";
if (!/^https:\/\/localhost:/.test(server)) throw new Error("시험 인스턴스(localhost)에만 써요");
const [out, how = "pbkdf2", second] = process.argv.slice(2);
const kdf = how === "argon2" ? { type: 1, iterations: 3, memory: 64, parallelism: 4 } : { type: 0, iterations: 600000, memory: 0, parallelism: 0 };

(async () => {
  const email = `rove-${Date.now()}@example.test`;
  const password = crypto.randomBytes(12).toString("base64url") + "Aa1!";
  const mk = await masterKey(password, email, kdf);
  const userKey = crypto.randomBytes(64);
  const key = { enc: userKey.subarray(0, 32), mac: userKey.subarray(32) };
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
  const body = { email, name: "Rove 시험", masterPasswordHash: passwordHash(mk, password), masterPasswordHint: null, key: encrypt(userKey, stretch(mk)),
    kdf: kdf.type, kdfIterations: kdf.iterations, kdfMemory: kdf.memory || null, kdfParallelism: kdf.parallelism || null,
    keys: { publicKey: publicKey.export({ type: "spki", format: "der" }).toString("base64"), encryptedPrivateKey: encrypt(privateKey.export({ type: "pkcs8", format: "der" }), key) } };
  // Vaultwarden 1.37: a sign-up token first (handed back at once without mail checks), then the account
  const post = (path, b) => fetch(server + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) });
  const v = await post("/identity/accounts/register/send-verification-email", { email, name: body.name, receiveMarketingEmails: false });
  if (!v.ok) throw new Error(`verify ${v.status} ${await v.text()}`);
  const r = await post("/identity/accounts/register/finish", { ...body, emailVerificationToken: (await v.text()).trim() });
  if (!r.ok) throw new Error(`register ${r.status} ${await r.text()}`);
  const t = lc(await (await fetch(server + "/identity/connect/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "password", username: email, password: body.masterPasswordHash, scope: "api offline_access", client_id: "web",
      deviceType: "9", deviceIdentifier: crypto.randomUUID(), deviceName: "test" }) })).json());
  if (!t.access_token) throw new Error("token " + JSON.stringify(t));
  const me = JSON.parse(Buffer.from(t.access_token.split(".")[1], "base64url")).sub; // the cipher says whose key it is under
  const s = (v) => (v == null ? null : encrypt(Buffer.from(v, "utf8"), key));
  const items = [
    { name: "시험 사이트", uri: "http://127.0.0.1/", username: "robin-test", password: "pw-" + crypto.randomBytes(6).toString("hex"), totp: "JBSWY3DPEHPK3PXP" },
    { name: "다른 곳", uri: "https://example.org/login", username: "someone", password: "x", totp: null },
  ];
  for (const it of items) {
    const c = await fetch(server + "/api/ciphers", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${t.access_token}` },
      body: JSON.stringify({ type: 1, encryptedFor: me, name: s(it.name), notes: null, favorite: false, reprompt: 0, organizationId: null, folderId: null,
        login: { username: s(it.username), password: s(it.password), totp: s(it.totp), uris: [{ uri: s(it.uri), match: null }] } }) });
    if (!c.ok) throw new Error(`cipher ${c.status} ${(await c.text()).slice(0, 80)}`);
  }
  // a second step (an authenticator app) when asked
  let secret = null;
  if (second === "2fa") {
    const auth = { "Content-Type": "application/json", Authorization: `Bearer ${t.access_token}` };
    const g = lc(await (await fetch(server + "/api/two-factor/get-authenticator", { method: "POST", headers: auth, body: JSON.stringify({ masterPasswordHash: body.masterPasswordHash }) })).json());
    secret = g.authenticator?.key; // Vaultwarden 1.37: { authenticator: { key }, userVerificationToken }
    if (!secret) throw new Error("get-authenticator " + JSON.stringify(Object.keys(g)));
    const on = await fetch(server + "/api/two-factor/authenticator", { method: "POST", headers: auth, body: JSON.stringify({ key: secret, token: totp(secret).code, masterPasswordHash: body.masterPasswordHash, userVerificationToken: g.userVerificationToken }) });
    if (!on.ok) throw new Error(`2fa ${on.status} ${(await on.text()).slice(0, 120)}`);
  }
  writeFileSync(out, JSON.stringify({ server, email, password, kdf: how, items, secret }, null, 1));
  console.log(`계정 ${email} (${how}${secret ? ", 2단계" : ""}), 항목 ${items.length}개`);
})().catch((e) => { console.error(e.message); process.exit(1); });
