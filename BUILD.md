# Build the demo example carefully

Goal: one recorded example where Muse buys a CoinGecko price from AIsa with a real USDC payment on Arc. The take is not done until value has moved.

Do not treat `AIsa-team/nanopayment-x402` as current on Arc. Its April 30 changelog says Arc is no longer accepted. A live 402 on 2026-10-04 included `eip155:5042`.

## The demo payment is real

Dry-run is rehearsal only. It never appears as the ending of the recording.

The recorded buy is one live call:

`GET https://api.aisa.one/apis/v2/coingecko/simple/price?ids=bitcoin,ethereum&vs_currencies=usd`

Muse pays the Arc Gateway row from the agent wallet. No API key. No mocked body. No fixture played back as if it were the purchase.

A payment counts only if all three are on screen in the same take:

1. HTTP 200 and a price JSON that was not in the repo before the call.
2. `PAYMENT-RESPONSE` (or the Circle CLI settlement receipt) for that same request.
3. Gateway USDC balance lower than the balance shown before the signature, by the 402 amount.

ArcScan is a bonus, not the proof. Gateway batches settlement, so the on-chain tx can lag the response. Say that on camera. Do not cut in an old transaction hash.

Spend cap stays $0.25. The 2026-10-04 probe was $0.10. Read the live 402 and refuse if it is above the cap. One retry is allowed if the first signed call fails before AIsa returns 200. A second success is a second real payment; do not fire it on camera.

## Safety contract

- Arc mainnet only (`eip155:5042`). Never ARC-TESTNET against AIsa.
- One on-camera purchase. The off-camera rehearsal payment is also real, and it is a different call.
- Hard cap $0.25 USDC per call. Refuse if the 402 amount is above the cap.
- No mnemonic, OTP, or private key in the repo, the terminal scrollback you record, or the commit.
- Deposit into Gateway with `deposit()`. Never transfer USDC to `0x77777777Dcc4d5A8B6E418Fd04D8997ef11000eE`.
- Fund Gateway with enough for the rehearsal payment, the on-camera payment, and one retry. $2 is enough.

## Two lanes, one real payment

Lane A is the demo. Lane B is the same real payment if Muse stalls after the wallet is funded. Lane B is not a simulation.

| Lane | Who pays | When to use it |
|---|---|---|
| A. Muse + Circle Agent Stack | Muse, via `circle services pay --chain ARC` | The recording. This is the product story. |
| B. Local buyer | A dedicated demo key, same 402 and same Arc Gateway scheme | Rehearsal, and the recording fallback if OTP or CLI triage fails. Still a real USDC debit. |

Both lanes show the same four frames: unpaid 402, Arc row selected, signed retry, price JSON plus USDC spent. The last frame is a live debit.

## Phase 0 — freeze the target

Probe once and save the decoded challenge as `fixtures/coingecko-402.json`. This fixture is the "before" frame only. Do not commit secrets. Commit the decoded `accepts[]` only.

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

If a later probe disagrees with $0.10, update the fixture and the spoken price. Do not hardcode $0.10 in the payer.

## Phase 1 — fund the wallet that will pay on camera

Paste into Muse:

```text
Connect to Circle Agent Stack using https://agents.circle.com/skills/setup.md
```

Human steps, in order:

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

## Phase 2 — one real rehearsal payment, off camera

Run the buy once before recording. This spends real USDC. That is the point: it proves the signature clears, and it leaves a known-good balance for the take.

```text
Call https://api.aisa.one/apis/v2/coingecko/simple/price?ids=bitcoin,ethereum&vs_currencies=usd
with no API key. Pay only the Arc Gateway option from my agent wallet.
Stop if the price is over $0.25. Show the 402, the prices, and the USDC spent.
```

Save the redacted transcript as `fixtures/muse-rehearsal.md`. Keep the before and after Gateway balances. Do not play this transcript back as the demo.

## Phase 3 — local buyer, only if Muse cannot sign

`scripts/buy-price.mjs`. No framework. Same real debit.

1. `GET` the CoinGecko URL with no `Authorization` header.
2. Require HTTP 402. Decode `payment-required`. Select the `eip155:5042` Gateway row. Exit 2 if that row is missing or over the cap.
3. Print the selected row. This mode signs nothing. Rehearsal of the setup, not the demo ending.
4. `--execute` signs a GatewayWalletBatched EIP-712 authorization for that exact amount and retries with `PAYMENT-SIGNATURE`.
5. Print the price JSON, the payment response header, and `spent_usdc`. Fail the command if the paid body is missing or the balance did not drop.

The standard `@x402/evm` exact scheme signs against the USDC contract. AIsa's extra name is `GatewayWalletBatched` and `verifyingContract` is the Gateway wallet. Use a Gateway scheme (Circle's x402 batching client, or the `GatewayEvmScheme` in AIsa's `x402_client.mjs`). Do not ship a hand-rolled signature if the SDK already covers this domain.

Wallet: `DEMO_MNEMONIC` from the environment, never from a committed `.env`. Fund that address on Arc, then `deposit()` into Gateway. The Muse agent wallet and the demo key stay separate.

```bash
npm run probe                 # 402 only, writes fixtures/coingecko-402.json
npm run buy                   # signs nothing
npm run buy -- --execute      # real capped purchase
```

## Phase 4 — receipt the camera has to see

Printed from the live response, not from this file.

```json
{
  "resource": "https://api.aisa.one/apis/v2/coingecko/simple/price?ids=bitcoin,ethereum&vs_currencies=usd",
  "network": "eip155:5042",
  "scheme": "GatewayWalletBatched",
  "amount_usdc": "0.10",
  "pay_to": "0xBd7b9f3e0CD3E1f6e698D0eeBb99F96E093BdeE3",
  "prices": { "bitcoin": { "usd": 0 }, "ethereum": { "usd": 0 } },
  "gateway_balance_before": "2.00",
  "gateway_balance_after": "1.90",
  "payment_response": "<from the live header>"
}
```

`prices` and both balances come from the paid call. A receipt with zeros is a failed take.

## Phase 5 — record only after a real payment has already cleared

- [ ] Probe shows Arc `eip155:5042` and amount `<= $0.25`.
- [ ] Agent wallet funded on Arc mainnet. Gateway balance covers the on-camera call plus one retry.
- [ ] One off-camera real payment returned bitcoin and ethereum USD prices and dropped the Gateway balance.
- [ ] On-camera sequence is: show balance, unpaid 402, sign, 200 prices, balance lower by the 402 amount.
- [ ] OTP and seed phrase are not in the scrollback you will capture.
- [ ] Fallback `--execute` is ready, unused unless Muse stalls. It must also be a real payment.

Optional second beat, only after the price buy is on tape: `GET /apis/v2/twitter/user/info?userName=jack`. That is a second real payment. Cut it if the first buy already landed.

## Out of scope

- A fake or replayed payment.
- A second chain. Arc is the only pay network in this demo.
- Seller-side AIsa changes. AIsa already returns the 402.
- CCTP withdrawal. Not needed to show the buy.
