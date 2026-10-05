#!/usr/bin/env node
/**
 * Confirm AISA_API_KEY can read the v1 API. Does not spend USDC.
 * The demo payment does not use this key.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
loadEnv(path.join(ROOT, ".env"));

const key = process.env.AISA_API_KEY;
if (!key) {
  console.error("Set AISA_API_KEY. The x402 buy does not need it.");
  process.exit(1);
}

const url = "https://api.aisa.one/apis/v1/coingecko/simple/price?ids=bitcoin,ethereum&vs_currencies=usd";
const res = await fetch(url, { headers: { Authorization: `Bearer ${key}` } });
const text = await res.text();
let body;
try { body = JSON.parse(text); } catch { body = text.slice(0, 400); }
console.log(JSON.stringify({
  status: res.status,
  key_accepted: res.status === 200,
  note: "v1 key check only. Demo payment is the x402 Arc call in buy-price.mjs.",
  body,
}, null, 2));
if (res.status !== 200) process.exit(1);

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#") || !line.includes("=")) continue;
    const idx = line.indexOf("=");
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}
