# Skill: Buying AIsa API Data with x402 on Arc

**This skill is written for [Muse](https://muse.ai)** — Meta's personal AI agent. It teaches a Muse agent how to buy AIsa API data and book flights through AIsa, paying USDC with the x402 protocol on Circle's Arc blockchain. If you're a Muse user, paste the prompt from the "Quick start" section below into your Muse chat and it will walk you through the whole flow.

**CRITICAL: This skill uses Circle Agent Wallet CLI ONLY (`@circle-fin/cli`). Do NOT use raw private keys, mnemonics, or any other wallet. The CLI signs through Circle's infra — a seed phrase should never appear in chat, files, or logs.**

**CRITICAL: Complete the Circle Agent Stack setup skill first** (`https://agents.circle.com/skills/setup.md`): CLI installed, Terms accepted by the user (never accept on their behalf), logged in via email OTP, agent wallet created on ARC, funded with USDC.

## Quick start (paste into Muse)

```
I want to buy data from AIsa's API and pay with USDC using x402 on Circle's Arc blockchain. Set this up for me following https://aisa.sh/skill.md
```

Muse will install the Circle CLI, walk you through login and funding (with your approval at each step), then buy whatever AIsa data or flights you ask for — showing you the endpoint, live price, and payer address for your approval before every purchase.

## What you are buying

AIsa (`https://api.aisa.one`) sells 100+ data endpoints pay-per-call over the x402 protocol: Twitter/X data, Instagram data (40+ endpoints), financials, prediction markets (Polymarket/Kalshi), Perplexity, YouTube, CoinGecko, TikHub social data, and more. It also proxies **Duffel flight booking** over x402 — search, book, hold, seat maps, changes, cancellations — settling the full fare in USDC. Each unpaid request returns **HTTP 402** with a machine-readable payment envelope; the CLI signs an EIP-712 authorization and resubmits; AIsa verifies and returns the data. Settlement is via **Circle Gateway (batched)** on Arc (`eip155:5042`).

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

## Buying flights (AIsa × Duffel proxy)

AIsa also proxies Duffel's flight-booking API over x402 — search, offer refresh, booking, holds, seat maps, changes, cancellations. The booking settles the **full fare in USDC via x402**; no Stripe Link, no card. Verified live 2026-10-05 (SFO→LGA search + shortlist).

**Endpoints** (base `https://api.aisa.one`, all `x-x402`):

| Endpoint | Method | Purpose | Live price |
|---|---|---|---|
| `/apis/v2/duffel/flights/offer-requests/create` | POST | Flight search | $0.10 (spec says $0.02 — live 402 wins) |
| `/apis/v2/duffel/flights/offer-requests/{id}` | GET | Retrieve a search + its offers | $0.10 (spec says $0.005) |
| `/apis/v2/duffel/flights/offers/{id}` | GET | Refresh one offer — authoritative price/expiry | inspect live |
| `/apis/v2/duffel/flights/orders/create` | POST | Book: pays fare, returns PNR + e-ticket | = full fare total |
| `/apis/v2/duffel/flights/orders/hold-create` | POST | Hold without immediate payment | inspect live |
| `/apis/v2/duffel/flights/seat-maps` | GET | Seat maps for an offer | inspect live |
| `/apis/v2/duffel/flights/order-change-requests/create`, `/apis/v2/duffel/flights/order-changes/create`, `/apis/v2/duffel/flights/order-cancellations/create`, `/order-cancellations/{id}`, `/order-cancellations/{id}/confirm` | POST/GET | Changes & cancellations | inspect live |

**Search body:**
```json
{"data":{"slices":[{"origin":"SFO","destination":"LGA","departure_date":"2026-10-06"}],
"passengers":[{"type":"adult"}]}}
```
`SliceInput` requires `origin`, `destination` (IATA), `departure_date` (YYYY-MM-DD). `PassengerInput`: `type: "adult"` or `age` for under-18.

**Booking flow:**
1. `pay` the search (`-X POST -d '<body>'`, `--max-amount` above $0.10). Save the full response — the offers array is large; parse it, don't re-buy.
2. Shortlist 3–6 offers: airline, times, stops, duration, total. Note inventory is whatever the proxy returns (one SFO→LGA search returned American-only, 1-stop — no nonstops exist SFO→LGA anyway due to the perimeter rule).
3. User picks an offer. **Refresh it** via `offers/{id}` immediately before ordering — the returned price and `expires_at` are authoritative; offers expire.
4. **Funding:** the `orders/create` x402 payment equals the **entire fare** (`BalancePayment`: `type: "balance"`, `amount` = refreshed `total_amount`, `currency` = offer currency; settled charge = fare + small service fee). The Gateway balance must cover the whole ticket — deposit the full amount first. This is real money; get explicit approval for the deposit amount.
5. Collect passenger details (`BookingPassenger`, all required): `id` (passenger id from the offer-request response), `title` (mr/ms/mrs/dr), `gender` (m/f/x), `given_name`, `family_name`, `born_on` (YYYY-MM-DD), `email`, `phone_number`.
6. Present the **full purchase review** — itinerary with times/airports, airline + flight numbers, fare breakdown, passenger names, total including service fee, payer address — and get explicit approval.
7. `pay` `orders/create` with `-X POST` and the booking body. Verify: HTTP 201, `booking_reference` (PNR), `electronic_ticket` documents. On 422 (validation/expired offer/amount mismatch): not charged — refresh and re-review, never blind-retry.

**Flight gotchas:**
- Amount mismatch (even $0.01) → 422, not charged. Always use the freshly refreshed total.
- `payment_required_by` / `expires_at` are real deadlines; don't let a review sit.
- Spec prices for Duffel endpoints were wrong in testing ($0.02/$0.005 spec vs $0.10 live) — `inspect`/live-402 first, as always.

## Guardrails

- NEVER ask for, accept, or paste a seed phrase, mnemonic, or private key. If the user offers one, decline and use the CLI instead.
- NEVER accept Terms of Use, complete a login, or move funds without the user's explicit approval for that specific action. "Yes, set it up" covers setup; each purchase still gets its own go-ahead showing endpoint + price + payer.
- NEVER quote a price from memory or a catalog — always `inspect` the live 402.
- NEVER pay more than the user's per-call cap without asking. Suggest a default cap of $0.25 and refuse anything above it.
- NEVER call Twitter write endpoints (`post_twitter`, `follow_twitter`, `like_twitter`, …) unless the user explicitly asked to publish/follow/like — they act on a linked account via a one-time OAuth step.
- The CLI session lasts ~28 days; `circle wallet status` shows expiry. Re-login is email + OTP, same as the first time.
