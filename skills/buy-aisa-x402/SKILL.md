# Skill: Buying AIsa API Data with x402 on Arc

**CRITICAL: This skill uses Circle Agent Wallet CLI ONLY (`@circle-fin/cli`). Do NOT use raw private keys, mnemonics, or any other wallet. The CLI signs through Circle's infra — a seed phrase should never appear in chat, files, or logs.**

**CRITICAL: Complete the Circle Agent Stack setup skill first** (`https://agents.circle.com/skills/setup.md`): CLI installed, Terms accepted by the user (never accept on their behalf), logged in via email OTP, agent wallet created on ARC, funded with USDC.

## What you are buying

AIsa (`https://api.aisa.one`) sells 100+ data endpoints pay-per-call over the x402 protocol: Twitter/X data, Instagram data (40+ endpoints), financials, prediction markets (Polymarket/Kalshi), Perplexity, YouTube, CoinGecko, TikHub social data, and more. Each unpaid request returns **HTTP 402** with a machine-readable payment envelope; the CLI signs an EIP-712 authorization and resubmits; AIsa verifies and returns the data. Settlement is via **Circle Gateway (batched)** on Arc (`eip155:5042`).

## Step 1: Discover what to buy

**For every new purchase, search first.** Never reuse an endpoint from memory.

```bash
circle services search "<keyword>" --output json
```

Or query the discovery API directly:

```bash
curl -s --compressed "https://api.circle.com/v2/x402/discovery/resources?query=<keyword>&network=eip155:5042&siwx=false"
```

Published catalogs (including AIsa's own repo catalog) go stale — **the live 402 is the source of truth for what exists and what it costs.**

## Step 2: Inspect before paying

**ALWAYS inspect the raw endpoint before paying.** The summary hides required parameters.

```bash
circle services inspect "<full-url-with-query-params>" --output json
```

Confirm from the output: `status` is `payable`, the `method` (usually `GET`), and `price.formatted`. Then check the endpoint's required query parameters against AIsa's OpenAPI spec (`https://aisa.one/openapi.yaml`) — the 402 will NOT tell you the param names, and a wrong one returns HTTP 400 ("request does not match the endpoint contract"), not 402.

**Verified parameter gotchas (re-verify against openapi.yaml if unsure):**
- Twitter user endpoints: `userName` (e.g. `/apis/v2/twitter/user/info?userName=opencolin`)
- Instagram profile: `handle` — NOT `username` (e.g. `/apis/v2/instagram/profile?handle=colinpollen`)

**Verified live prices (always re-confirm via inspect — catalogs lie):**
- Instagram profile: $0.10 USDC
- Twitter user info: $0.10 USDC
- CoinGecko simple price: $0.10 USDC

## Step 3: Check both balance pools

```bash
circle wallet balance --address <addr> --chain ARC --output json      # vanilla
circle gateway balance --address <addr> --chain ARC --output json     # Gateway
```

AIsa endpoints accept **GatewayWalletBatched only** — the spending balance must sit in Gateway, not vanilla. If Gateway is short, deposit (minimum sensible: enough for the purchase plus a small buffer):

```bash
circle gateway deposit --amount <usdc> --address <addr> --chain ARC --method direct
```

**CRITICAL:** On ARC the deposit method is `direct` (on-chain; USDC is Arc's gas token so no second token is needed). Never transfer USDC directly to the Gateway contract address — always use `deposit()` / the CLI command. Deposits are withdrawable via `circle gateway withdraw`.

## Step 4: Pay

Show the user before executing: the exact endpoint, the live price, the payer address. Get an explicit go-ahead for the purchase.

```bash
circle services pay "<full-url-with-query-params>" -X <METHOD> --address <addr> --chain ARC --output json
```

**ALWAYS pass `-X` explicitly.** Omitting it on a GET-only seller settles payment on-chain and returns 405 — funds burned, zero data.

Then verify all three:
1. The response body contains the requested data (HTTP 200 / `"success": true`), not an error object.
2. `circle gateway balance` dropped by exactly the price.
3. No duplicate payment was submitted (see Step 5).

## Step 5: If the paid request fails after authorization

The CLI may report `Payment submitted but paid request failed` with `PAYMENT MAY HAVE BEEN SUBMITTED`. **Do NOT retry blindly — a retry is a second $0.10 payment with a fresh nonce.**

1. Read the saved record: `~/.circle-cli/payments/payment-<timestamp>.json` (amount, nonce, seller).
2. Poll `circle gateway balance` for several minutes. Gateway settlement is batched and can lag the response.
3. Balance dropped by the price → the payment landed; the data was paid for but the response was lost. Do not re-buy.
4. Balance unchanged after ~10 minutes → the payment never went through; one retry is safe.

## Guardrails

- NEVER ask for, accept, or paste a seed phrase, mnemonic, or private key. If the user offers one, decline and use the CLI instead.
- NEVER accept Terms of Use, complete a login, or move funds without the user's explicit approval for that specific action. "Yes, set it up" covers setup; each purchase still gets its own go-ahead showing endpoint + price + payer.
- NEVER quote a price from memory or a catalog — always `inspect` the live 402.
- NEVER pay more than the user's per-call cap without asking. Suggest a default cap of $0.25 and refuse anything above it.
- NEVER call Twitter write endpoints (`post_twitter`, `follow_twitter`, `like_twitter`, …) unless the user explicitly asked to publish/follow/like — they act on a linked account via a one-time OAuth step.
- The CLI session lasts ~28 days; `circle wallet status` shows expiry. Re-login is email + OTP, same as the first time.
