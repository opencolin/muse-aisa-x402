# Muse buys an AIsa price with USDC on Arc

One real purchase: a CoinGecko price from AIsa, paid in USDC on Arc mainnet over x402. No API key is required for the payment.

Give this to your Muse agent:

```text
Follow https://raw.githubusercontent.com/opencolin/muse-aisa-x402/main/skills/buy-aisa.md and buy the AIsa CoinGecko price with my Arc wallet.
```

## What you need

- A dedicated Arc wallet, not your main one. A 12-word recovery phrase is enough. The app does not have to show a raw private key.
- Arc USDC on that address. Gas on Arc is USDC too.
- An AIsa API key is optional. It checks the v1 account. The buy does not send it.

## What the agent must not do

- Invent a wallet.
- Commit `.env`, the phrase, or the key.
- Transfer USDC to the Gateway address. Deposit with `deposit()`.
- Pay on Arc testnet. AIsa accepts Arc mainnet, chain id `5042`.
- Spend more than $0.25 on the demo call.

## Human path

```bash
git clone https://github.com/opencolin/muse-aisa-x402
cd muse-aisa-x402
cp .env.example .env
npm install
npm run prepare
npm run prepare -- --deposit 2 --execute
npm run buy -- --execute
```

`npm run buy` signs nothing. The payment is `--execute`.

Proven once on 2026-10-04: a phrase-derived address deposited 2 USDC into Gateway, AIsa returned HTTP 200 for bitcoin and ethereum prices, and the response included `payment-response`. Gateway settlement can lag that response.
