#!/usr/bin/env node
/**
 * Buy one AIsa CoinGecko price with USDC on Arc, over x402.
 *
 * Default signs nothing. --execute performs one real Gateway payment.
 * --probe only decodes the 402 and writes fixtures/coingecko-402.json.
 *
 * Wallet: PRIVATE_KEY or DEMO_MNEMONIC in the environment or .env.
 * AISA_API_KEY is not used here. x402 is the credential.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  getAddress,
  http,
  parseAbi,
} from "viem";
import { mnemonicToAccount, privateKeyToAccount } from "viem/accounts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PRICE_URL =
  "https://api.aisa.one/apis/v2/coingecko/simple/price?ids=bitcoin,ethereum&vs_currencies=usd";
const ARC_NETWORK = "eip155:5042";
const USDC = "0x3600000000000000000000000000000000000000";
const GATEWAY = "0x77777777Dcc4d5A8B6E418Fd04D8997ef11000eE";
const CAP_ATOMIC = 250_000n; // $0.25, 6 decimals
const GATEWAY_ABI = parseAbi([
  "function availableBalance(address token, address depositor) view returns (uint256)",
]);

loadEnv(path.join(ROOT, ".env"));

const arc = defineChain({
  id: 5042,
  name: "Arc",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: [process.env.ARC_RPC || "https://rpc.mainnet.arc.io"] } },
  blockExplorers: { default: { name: "Arc Explorer", url: "https://explorer.arc.io" } },
});

const args = process.argv.slice(2);
const probeOnly = args.includes("--probe");
const execute = args.includes("--execute");

const challenge = await fetchChallenge(PRICE_URL);
const arcRow = selectArc(challenge);
const amount = BigInt(arcRow.amount);
if (amount > CAP_ATOMIC) {
  throw new Error(`402 amount ${formatUsdc(amount)} exceeds the $0.25 cap. Refusing.`);
}

const fixture = {
  probed_at: new Date().toISOString(),
  url: PRICE_URL,
  x402Version: challenge.x402Version,
  resource: challenge.resource,
  arc: arcRow,
};
fs.mkdirSync(path.join(ROOT, "fixtures"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "fixtures", "coingecko-402.json"), JSON.stringify(fixture, null, 2) + "\n");

console.log(JSON.stringify({
  mode: probeOnly ? "probe" : execute ? "execute" : "dry-run",
  network: arcRow.network,
  scheme: arcRow.extra?.name,
  amount_usdc: formatUsdc(amount),
  pay_to: arcRow.payTo,
  asset: arcRow.asset,
  verifying_contract: arcRow.extra?.verifyingContract,
}, null, 2));

if (probeOnly || !execute) {
  if (!execute) console.error("\nDry-run. Nothing signed. Re-run with --execute to spend USDC.");
  process.exit(0);
}

const account = loadAccount();
const publicClient = createPublicClient({ chain: arc, transport: http(arc.rpcUrls.default.http[0]) });
const walletClient = createWalletClient({ account, chain: arc, transport: http(arc.rpcUrls.default.http[0]) });
const before = await gatewayBalance(publicClient, account.address);

const payload = await signPayment(walletClient, account.address, challenge, arcRow);
const paid = await fetch(PRICE_URL, {
  headers: {
    "PAYMENT-SIGNATURE": Buffer.from(JSON.stringify(payload)).toString("base64"),
    "Payment-Signature": Buffer.from(JSON.stringify(payload)).toString("base64"),
  },
});
const bodyText = await paid.text();
let body;
try { body = JSON.parse(bodyText); } catch { body = bodyText; }
const after = await gatewayBalance(publicClient, account.address);
const paymentResponse = paid.headers.get("payment-response") || paid.headers.get("PAYMENT-RESPONSE");

const receipt = {
  resource: PRICE_URL,
  network: ARC_NETWORK,
  scheme: arcRow.extra?.name,
  amount_usdc: formatUsdc(amount),
  pay_to: arcRow.payTo,
  payer: account.address,
  http_status: paid.status,
  prices: body,
  gateway_balance_before: formatUsdc(before),
  gateway_balance_after: formatUsdc(after),
  payment_response: paymentResponse ? decodeHeader(paymentResponse) : null,
};
fs.writeFileSync(path.join(ROOT, "fixtures", "last-receipt.json"), JSON.stringify(receipt, null, 2) + "\n");
console.log(JSON.stringify(receipt, null, 2));

if (paid.status !== 200) {
  console.error("Paid call did not return 200. No demo receipt.");
  process.exit(1);
}
if (after + amount > before && before > 0n) {
  console.error("Gateway available balance did not drop by the 402 amount. Check settlement lag, then the receipt.");
}

function selectArc(challenge) {
  const row = (challenge.accepts || []).find((a) => a.network === ARC_NETWORK);
  if (!row) throw new Error("AIsa 402 did not include Arc mainnet eip155:5042.");
  if (row.scheme !== "exact") throw new Error(`Unexpected scheme ${row.scheme}`);
  if (row.extra?.name !== "GatewayWalletBatched") throw new Error(`Unexpected extra.name ${row.extra?.name}`);
  if (getAddress(row.asset) !== getAddress(USDC)) throw new Error(`Unexpected Arc USDC ${row.asset}`);
  if (getAddress(row.extra.verifyingContract) !== getAddress(GATEWAY)) {
    throw new Error(`Unexpected Gateway contract ${row.extra.verifyingContract}`);
  }
  return row;
}

async function fetchChallenge(url) {
  const res = await fetch(url);
  if (res.status !== 402) throw new Error(`Expected 402, got ${res.status}`);
  const header = res.headers.get("payment-required") || res.headers.get("PAYMENT-REQUIRED");
  if (!header) throw new Error("402 had no payment-required header");
  return JSON.parse(Buffer.from(header, "base64").toString("utf8"));
}

async function signPayment(walletClient, from, challenge, row) {
  const nonce = `0x${Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("hex")}`;
  const now = Math.floor(Date.now() / 1000);
  const authorization = {
    from: getAddress(from),
    to: getAddress(row.payTo),
    value: row.amount,
    validAfter: String(now - 600),
    validBefore: String(now + Number(row.maxTimeoutSeconds || 3600)),
    nonce,
  };
  const signature = await walletClient.signTypedData({
    account: walletClient.account,
    domain: {
      name: row.extra.name,
      version: row.extra.version || "1",
      chainId: 5042,
      verifyingContract: getAddress(row.extra.verifyingContract),
    },
    types: {
      TransferWithAuthorization: [
        { name: "from", type: "address" },
        { name: "to", type: "address" },
        { name: "value", type: "uint256" },
        { name: "validAfter", type: "uint256" },
        { name: "validBefore", type: "uint256" },
        { name: "nonce", type: "bytes32" },
      ],
    },
    primaryType: "TransferWithAuthorization",
    message: {
      from: getAddress(authorization.from),
      to: getAddress(authorization.to),
      value: BigInt(authorization.value),
      validAfter: BigInt(authorization.validAfter),
      validBefore: BigInt(authorization.validBefore),
      nonce: authorization.nonce,
    },
  });
  return {
    x402Version: challenge.x402Version || 2,
    resource: challenge.resource,
    accepted: row,
    payload: { authorization, signature },
  };
}

async function gatewayBalance(publicClient, address) {
  return publicClient.readContract({
    address: GATEWAY,
    abi: GATEWAY_ABI,
    functionName: "availableBalance",
    args: [USDC, address],
  });
}

function loadAccount() {
  const pk = process.env.PRIVATE_KEY;
  if (pk) return privateKeyToAccount(pk.startsWith("0x") ? pk : `0x${pk}`);
  const mnemonic = process.env.DEMO_MNEMONIC;
  if (mnemonic) return mnemonicToAccount(mnemonic.trim());
  throw new Error("Set PRIVATE_KEY or DEMO_MNEMONIC. Refusing to generate a wallet.");
}

function formatUsdc(atomic) {
  const neg = atomic < 0n;
  const v = neg ? -atomic : atomic;
  const whole = v / 1_000_000n;
  const frac = (v % 1_000_000n).toString().padStart(6, "0").replace(/0+$/, "") || "0";
  return `${neg ? "-" : ""}${whole}.${frac}`;
}

function decodeHeader(value) {
  try { return JSON.parse(Buffer.from(value, "base64").toString("utf8")); }
  catch { return value; }
}

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
