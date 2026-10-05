# Buy an AIsa price with USDC on Arc

Use this when the user wants their Muse agent to repeat the AIsa x402 purchase.

The purchase is real. Default to a dry run. Spend only after the user says yes.

## Rules

- Arc mainnet only. Chain id `5042`, network `eip155:5042`.
- One call: `GET https://api.aisa.one/apis/v2/coingecko/simple/price?ids=bitcoin,ethereum&vs_currencies=usd`
- Cap $0.25. Refuse if the live 402 amount is higher.
- Never invent a mnemonic or private key.
- Never print the phrase or key back to the user.
- Never commit `.env`.
- Never transfer USDC to `0x77777777Dcc4d5A8B6E418Fd04D8997ef11000eE`. That loses the funds. Deposit by calling `deposit()`.
- An `AISA_API_KEY` is optional and is not the payment credential.

## Ask the user

Ask for one of these, from a dedicated demo wallet:

- `DEMO_MNEMONIC` — 12 or 24 words. This is what the Arc wallet app shows. A raw private key is not required.
- `PRIVATE_KEY` — only if they already have one.

If they only have an extra passphrase on top of a seed, stop and ask for the seed too. If the phrase recovers a smart account and the USDC is on that account rather than the derived address, stop. This repo can only sign for the derived address.

## Steps

1. Clone `https://github.com/opencolin/muse-aisa-x402` if it is not already local.
2. Write `.env` from `.env.example`. Do not commit it.
3. `npm install`
4. `npm run prepare` and show the address, Arc USDC, and Gateway available balance.
5. If Gateway available is under the 402 price, ask before depositing. Then `npm run prepare -- --deposit 2 --execute`.
6. `npm run buy` and show the Arc row. Sign nothing.
7. After an explicit yes, `npm run buy -- --execute`.
8. Show the receipt: HTTP status, prices, Gateway balance before and after, and whether `payment-response` was present. Say that Gateway batches settlement, so the balance drop can lag the 200.

## Done when

The paid call returned 200 with bitcoin and ethereum prices, and the receipt names the payer address. Do not claim the USDC has settled on-chain until the Gateway balance has dropped or a settlement transaction is visible.
