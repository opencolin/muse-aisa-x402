#!/usr/bin/env node
/**
 * Show the Arc wallet that will pay, and optionally deposit USDC into Gateway.
 *
 *   node scripts/prepare-wallet.mjs
 *   node scripts/prepare-wallet.mjs --deposit 2 --execute
 *
 * Deposit is a real on-chain transaction. It requires --execute.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  parseAbi,
  parseUnits,
} from "viem";
import { mnemonicToAccount, privateKeyToAccount } from "viem/accounts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const USDC = "0x3600000000000000000000000000000000000000";
const GATEWAY = "0x77777777Dcc4d5A8B6E418Fd04D8997ef11000eE";
const ERC20_ABI = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
]);
const GATEWAY_ABI = parseAbi([
  "function availableBalance(address token, address depositor) view returns (uint256)",
  "function deposit(address token, uint256 value)",
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
const execute = args.includes("--execute");
const depositIdx = args.indexOf("--deposit");
const depositUsdc = depositIdx >= 0 ? args[depositIdx + 1] : null;

const account = loadAccount();
const publicClient = createPublicClient({ chain: arc, transport: http(arc.rpcUrls.default.http[0]) });
const walletClient = createWalletClient({ account, chain: arc, transport: http(arc.rpcUrls.default.http[0]) });

const [native, erc20, allowance, available] = await Promise.all([
  publicClient.getBalance({ address: account.address }),
  publicClient.readContract({ address: USDC, abi: ERC20_ABI, functionName: "balanceOf", args: [account.address] }),
  publicClient.readContract({ address: USDC, abi: ERC20_ABI, functionName: "allowance", args: [account.address, GATEWAY] }),
  publicClient.readContract({ address: GATEWAY, abi: GATEWAY_ABI, functionName: "availableBalance", args: [USDC, account.address] }),
]);

console.log(JSON.stringify({
  address: account.address,
  chain: "eip155:5042",
  native_usdc_18: format(native, 18),
  erc20_usdc: format(erc20, 6),
  gateway_allowance: format(allowance, 6),
  gateway_available: format(available, 6),
  ready_to_pay: available >= 100_000n,
  explorer: `https://explorer.arc.io/address/${account.address}`,
}, null, 2));

if (!depositUsdc) process.exit(0);
if (!execute) {
  console.error(`\nDeposit of ${depositUsdc} USDC not sent. Re-run with --execute to approve and deposit.`);
  process.exit(0);
}

const amount = parseUnits(depositUsdc, 6);
if (erc20 < amount) throw new Error(`ERC-20 USDC ${format(erc20, 6)} is below deposit ${depositUsdc}`);
if (allowance < amount) {
  const hash = await walletClient.writeContract({
    address: USDC,
    abi: ERC20_ABI,
    functionName: "approve",
    args: [GATEWAY, amount],
  });
  console.error(`approve tx ${hash}`);
  await publicClient.waitForTransactionReceipt({ hash });
}
const hash = await walletClient.writeContract({
  address: GATEWAY,
  abi: GATEWAY_ABI,
  functionName: "deposit",
  args: [USDC, amount],
});
console.error(`deposit tx ${hash}`);
await publicClient.waitForTransactionReceipt({ hash });
const after = await publicClient.readContract({
  address: GATEWAY,
  abi: GATEWAY_ABI,
  functionName: "availableBalance",
  args: [USDC, account.address],
});
console.log(JSON.stringify({ deposited: depositUsdc, gateway_available: format(after, 6), tx: hash }, null, 2));

function loadAccount() {
  const pk = process.env.PRIVATE_KEY;
  if (pk) return privateKeyToAccount(pk.startsWith("0x") ? pk : `0x${pk}`);
  const mnemonic = process.env.DEMO_MNEMONIC;
  if (mnemonic) return mnemonicToAccount(mnemonic.trim());
  throw new Error("Set PRIVATE_KEY or DEMO_MNEMONIC in .env");
}

function format(atomic, decimals) {
  const base = 10n ** BigInt(decimals);
  const whole = atomic / base;
  const frac = (atomic % base).toString().padStart(decimals, "0").replace(/0+$/, "") || "0";
  return `${whole}.${frac}`;
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
