# Build the demo example carefully

Goal: one recorded example where Muse buys a CoinGecko price from AIsa with USDC on Arc. The example must be repeatable, capped, and able to finish on camera if Muse login stalls.

Do not treat `AIsa-team/nanopayment-x402` as current on Arc. Its April 30 changelog says Arc is no longer accepted. A live 402 on 2026-10-04 included `eip155:5042`.

## Safety contract

- Arc mainnet only (`eip155:5042`). Never ARC-TESTNET against AIsa.
- One happy-path purchase: `GET /apis/v2/coingecko/simple/price?ids=bitcoin,ethereum&vs_currencies=usd`.
- Hard cap $0.25 USDC per run. Refuse if the 402 amount is above the cap.
- Default is dry-run. Payment happens only with an explicit `--execute` after a human yes.
- No mnemonic, OTP, or private key in the repo, the terminal scrollback you record, or the commit.
- Deposit into Gateway with `deposit()`. Never transfer USDC to `0x77777777Dcc4d5A8B6E418Fd04D8997ef11000eE`.
- Confirm on camera before any call priced at or above $0.036.

## Two lanes, one story

Lane A is the demo. Lane B is the net under it.

| Lane | Who pays | When to use it |
|---|---|---|
| A. Muse + Circle Agent Stack | Muse, via `circle services pay --chain ARC` | The recording. This is the product story. |
| B. Local buyer | A dedicated demo key, same 402 and same Arc Gateway scheme | Rehearsal, and the recording fallback if OTP or CLI triage fails. |

Both lanes must show the same four frames: unpaid 402, Arc row selected, signed retry, price JSON plus USDC spent.

## Phase 0 — freeze the target

Probe once and save the decoded challenge as `fixtures/coingecko-402.json`. Do not commit secrets. Commit the decoded `accepts[]` only.

```bash
curl -sD - -o /dev/null \
  "https://api.aisa.one/apis/v2/coingecko/simple/price?ids=bitcoin,ethereum&vs_currencies=usd"
```

Accept the run only if the Arc row is all of:

- `network`: `eip155:5042`
- `asset`: `0x3600000000000000000000000000000000000000`
- `scheme`: `exact`
- `extra.name`: `GatewayWalletBatched`
- `extra.verifyingContract`: `0x77777777Dcc4d5A8B6E418Fd04D8997ef11000eE`
- `payTo`: `0xBd7b9f3e0CD3E1f6e698D0eeBb99F96E093BdeE3`
- amount `<= 250000` (6 decimals, $0.25)

The 2026-10-04 probe was `100000` ($0.10). If a later probe disagrees, update the fixture and the spoken price. Do not hardcode $0.10 in the payer.

## Phase 1 — Muse lane

Paste into Muse:

```text
Connect to Circle Agent Stack using https://agents.circle.com/skills/setup.md
```

Muse follows the skill. Human steps, in order, off the hot path of the edit:

1. Explicit yes on the live Terms URLs from `circle terms show --init`.
2. Email OTP. Cut this from the recording.
3. Fund the Arc agent wallet. `circle wallet fund --address <addr> --chain ARC --amount 5 --token usdc --method crypto --open`.
4. If pay says the wallet is not deployed, one zero self-transfer, then stop and retry pay once:

```bash
circle wallet transfer --amount 0 --address <addr> --chain ARC \
  --token 0x3600000000000000000000000000000000000000
```

5. Gateway deposit, then balance. Ready in about half a second on Arc:

```bash
circle gateway deposit --amount 2 --address <addr> --chain ARC --method direct
circle gateway balance --address <addr> --chain ARC
```

6. Fetch `https://agents.circle.com/skills/wallet-pay.md` before the first pay. Do not improvise if the CLI returns a chain mismatch or a BigInt error.

Spoken buy prompt, after the deposit is on screen:

```text
Call https://api.aisa.one/apis/v2/coingecko/simple/price?ids=bitcoin,ethereum&vs_currencies=usd
with no API key. Pay only the Arc Gateway option from my agent wallet.
Stop if the price is over $0.25. Show the 402, the prices, and the USDC spent.
```

Pre-record check: run that prompt once off camera. Save the redacted transcript as `fixtures/muse-rehearsal.md`. The recording uses the same prompt unchanged.

## Phase 2 — local buyer, the fallback example

Small Node script, `scripts/buy-price.mjs`. No framework.

Behavior:

1. `GET` the CoinGecko URL with no `Authorization` header.
2. Require HTTP 402. Decode `payment-required`. Select the `eip155:5042` Gateway row. Exit 2 if that row is missing or over the cap.
3. Print the selected row. This is the dry-run, and the default.
4. `--execute` signs a GatewayWalletBatched EIP-712 authorization for that exact amount and retries with `PAYMENT-SIGNATURE`.
5. Print the price JSON, the payment response header, and `spent_usdc`.

The standard `@x402/evm` exact scheme signs against the USDC contract. AIsa's extra name is `GatewayWalletBatched` and `verifyingContract` is the Gateway wallet. Use a Gateway scheme (Circle's x402 batching client, or the `GatewayEvmScheme` in AIsa's `x402_client.mjs`). Do not ship a hand-rolled signature if the SDK already covers this domain.

Wallet: `DEMO_MNEMONIC` from the environment, never from a committed `.env`. Fund that address on Arc, then `deposit()` into Gateway. The Muse agent wallet and the demo key stay separate so a rehearsal cannot drain the wallet on camera.

Commands the recording can fall back to:

```bash
npm run probe          # 402 only, writes fixtures/coingecko-402.json
npm run buy            # dry-run, prints the Arc row, signs nothing
npm run buy -- --execute   # one capped purchase
```

## Phase 3 — receipt both lanes print

Same shape, so the cut can swap lanes without a different ending.

```json
{
  "resource": "https://api.aisa.one/apis/v2/coingecko/simple/price?ids=bitcoin,ethereum&vs_currencies=usd",
  "network": "eip155:5042",
  "scheme": "GatewayWalletBatched",
  "amount_usdc": "0.10",
  "pay_to": "0xBd7b9f3e0CD3E1f6e698D0eeBb99F96E093BdeE3",
  "prices": { "bitcoin": { "usd": 0 }, "ethereum": { "usd": 0 } },
  "gateway_balance_after": "1.90"
}
```

`prices` come from the paid response. Do not paste sample prices into the recording.

## Phase 4 — record only after this checklist

- [ ] Probe fixture shows Arc `eip155:5042` and amount `<= $0.25`.
- [ ] Agent wallet funded on Arc mainnet. Gateway balance covers one call plus a retry.
- [ ] Dry-run prints the Arc row and does not sign.
- [ ] One off-camera `--execute` returned bitcoin and ethereum USD prices.
- [ ] OTP and seed phrase are not in the scrollback you will capture.
- [ ] Fallback command is pasted in a note beside the camera, unused unless Muse stalls.

Optional second beat, only after the price buy is on tape: `GET /apis/v2/twitter/user/info?userName=jack`. Same cap, same confirm. Cut it if the first buy already landed.

## Out of scope for the example

- A second chain. Arc is the only pay network in this demo.
- Seller-side AIsa changes. AIsa already returns the 402.
- Batching many calls. One purchase is the example.
- CCTP withdrawal. Not needed to show the buy.
