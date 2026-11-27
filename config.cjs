// What makes this Rove robin's. A Rove of your own changes these (and makes
// its own release key: the updates below are only taken when signed by one of its keys).
module.exports = {
  // the new tab's links, under its sites: [name, address, icon (icons.svg rk-i-…)]
  links: [
    ["Home", "https://home.yoonrobin.xyz/", "home"],
    ["Mail", "https://mail.yoonrobin.xyz/", "mail"],
    ["Cloud", "https://cloud.yoonrobin.xyz/", "cloud"],
    ["Pass", "https://pass.yoonrobin.xyz/", "lock"],
    ["AI", "https://ai.yoonrobin.xyz/", "spark"],
    ["Get", "https://get.yoonrobin.xyz/", "download"],
  ],
  // what the address bar searches with till one is chosen in ≡ (a key of ENGINES in main.cjs)
  engine: "google",
  // RobinPass, the key button in the address bar: a Vaultwarden (Bitwarden) server
  pass: "https://pass.yoonrobin.xyz",
  // where an installed Rove looks for a new version: latest.json and the zip it names
  updates: "https://github.com/Yoon-robin/rove/releases/latest/download/",
  // the release keys (Ed25519, SPKI DER in base64): latest.json is taken when one of them
  // signed it. One per PC that releases; the secret halves never leave their PC.
  updateKeys: [
    "MCowBQYDK2VwAyEAQC/zcgRWBb3Eo1m8Jy+Y1t8swG/TKV38JiO0B9h/o40=", // the first PC
    "MCowBQYDK2VwAyEAPWoXI6Fmg9BHeDcq7NvEwwbr2XlNV1vv2GJvtDBBmKU=", // a second PC, 2026-11-26
  ],
};
