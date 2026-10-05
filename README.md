# Muse buys an AIsa price with USDC on Arc

Real x402 payment example. The recorded buy is a live debit, not a replay.

The wallet key and the AIsa key stay in `.env`. They are gitignored.

## Ready now

- `npm run probe` decodes the live 402 and refuses unless Arc mainnet (`eip155:5042`) is the Gateway row, under $0.25.
- `npm run buy` prints that row and signs nothing.
- `npm run buy -- --execute` signs a GatewayWalletBatched authorization and retries. One real payment.
- `npm run prepare` prints the address, Arc USDC, Gateway allowance, and Gateway available balance.
- `npm run prepare -- --deposit 2 --execute` approves and deposits. A transfer to the Gateway address is not a deposit.
- `npm run key-check` checks `AISA_API_KEY` against the v1 API. The demo payment does not use the key.

## When the wallet is available

```bash
cp .env.example .env
# set PRIVATE_KEY or DEMO_MNEMONIC, and optionally AISA_API_KEY
npm install
npm run prepare
npm run prepare -- --deposit 2 --execute
npm run buy -- --execute
```

`fixtures/last-receipt.json` is the demo receipt: prices, both Gateway balances, and the payment response. It is gitignored.

Arc USDC for the deposit is the ERC-20 at `0x3600000000000000000000000000000000000000`. Gas on Arc is the native balance of the same token. Fund both enough to deposit and to pay gas.

If the paying wallet is a Circle agent wallet with no exportable key, use the Muse prompt in DEMO.md. This script cannot sign for that wallet.
