// What makes this Rove robin's. A Rove of your own changes these (and makes
// its own release key: the updates below are only taken when signed by it).
module.exports = {
  // a new tab, the home button
  home: "https://home.yoonrobin.xyz/",
  // what the address bar searches with (the words go at the end)
  search: "https://www.google.com/search?q=",
  // RobinPass, the key button in the address bar: a Vaultwarden (Bitwarden) server
  pass: "https://pass.yoonrobin.xyz",
  // where an installed Rove looks for a new version: latest.json and the zip it names
  updates: "https://github.com/Yoon-robin/rove/releases/latest/download/",
  // the release key (Ed25519, SPKI DER in base64) latest.json is signed with
  updateKey: "MCowBQYDK2VwAyEAQC/zcgRWBb3Eo1m8Jy+Y1t8swG/TKV38JiO0B9h/o40=",
};
