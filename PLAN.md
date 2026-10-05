# Muse × AIsa: buy with USDC on Arc via x402

Muse pays an AIsa API with USDC. Circle Agent Stack is the wallet. x402 is the handshake. Circle Gateway settles on Arc.

Researched 2026-10-04. Live unpaid calls to AIsa on that date already listed Arc mainnet in the payment challenge.

## What gets wired

Muse is the agent with a computer. Circle's bootstrap prompt is:

```text
Connect to Circle Agent Stack using https://agents.circle.com/skills/setup.md
```

That skill installs the Circle CLI, gates on Terms plus an email OTP, and creates an agent wallet on Arc.

| Piece | Value |
|---|---|
| Arc mainnet chain id | `5042` (`eip155:5042`) |
| Arc testnet chain id | `5042002` — do not use against AIsa |
| Arc USDC | `0x3600000000000000000000000000000000000000` (also the gas token) |
| AIsa x402 base | `https://api.aisa.one/apis/v2/` |
| Gateway wallet (do not transfer here) | `0x77777777Dcc4d5A8B6E418Fd04D8997ef11000eE` |
| AIsa payTo (live 2026-10-04) | `0xBd7b9f3e0CD3E1f6e698D0eeBb99F96E093BdeE3` |
| Scheme | `exact`, extra name `GatewayWalletBatched` |

AIsa is already in Circle's Agent Marketplace. CoinGecko prices there are listed as provided by AIsa.

## Live 402 (probed 2026-10-04)

Unpaid calls returned HTTP 402, `x402Version: 2`, and a `payment-required` header. Arc mainnet was in `accepts[]` alongside Ethereum, Base, Avalanche, Arbitrum, OP, Polygon, Unichain, Sonic, World Chain, Sei, and HyperEVM.

| Call | Live Arc price |
|---|---|
| `GET /apis/v2/twitter/user/info?userName=jack` | $0.10 USDC |
| `GET /apis/v2/coingecko/simple/price?ids=bitcoin,ethereum&vs_currencies=usd` | $0.10 USDC |

Circle's older discovery example priced the bare CoinGecko route at $0.008. The parameterized URL probed here was $0.10. Read the 402. Do not hardcode the catalog price.

AIsa's open skill at `AIsa-team/nanopayment-x402` is stale on Arc. Its 2026-04-30 changelog says Arc testnet support ended 2026-04-26 and Arc is no longer accepted. The live header disagrees: Arc mainnet is accepted. Arc testnet is not.

## Payment path

```text
Muse
  └─ Circle skill (setup.md) → agent wallet on Arc
       └─ fund USDC on Arc
            └─ circle gateway deposit --chain ARC --method direct
                 └─ GET AIsa /apis/v2/...          → 402
                      └─ sign GatewayWalletBatched EIP-712
                           └─ retry with PAYMENT-SIGNATURE
                                └─ JSON back, settlement batched on Arc
```

Gateway is the rail AIsa is offering. A direct USDC transfer to `0x7777…` is lost. The deposit has to be a `deposit()` call. On Arc that deposit is ready in about half a second, and there is no second gas token.

## Build sequence

1. Paste the setup prompt into Muse.
2. Install the CLI if needed: `npm install -g @circle-fin/cli`. Install skills with `circle skill install` or `npx skills add circlefin/skills -g`.
3. Show live Terms URLs from `circle terms show --init`. Wait for an explicit yes before `circle terms accept`.
4. Log in with email plus OTP. Muse cannot invent the email or the code.
5. `circle wallet list --chain ARC --type agent`, then `circle wallet create` if empty. One create covers the EVM chains, including Arc.
6. Fund Arc mainnet, not testnet:

```bash
circle wallet fund --address <addr> --chain ARC --amount 5 --token usdc --method crypto --open
```

If the first pay says the wallet is not deployed, deploy the smart account with a zero-value self-transfer:

```bash
circle wallet transfer --amount 0 --address <addr> --chain ARC --token 0x3600000000000000000000000000000000000000
```

7. Deposit into Gateway, then check the balance:

```bash
circle gateway deposit --amount 2 --address <addr> --chain ARC --method direct
circle gateway balance --address <addr> --chain ARC
```

8. Before paying, fetch `https://agents.circle.com/skills/wallet-pay.md` and follow it. The chain must be one the seller accepts.

Buy, marketplace path:

```text
Search the Circle marketplace for a Bitcoin and Ethereum price, pay AIsa with the Arc wallet over x402, and show the JSON plus what USDC was spent.
```

Under the hood that is `circle services search "bitcoin ethereum price"` and `circle services pay` with `--chain ARC`.

Buy, direct path, if search misses the route:

```text
Call https://api.aisa.one/apis/v2/coingecko/simple/price?ids=bitcoin,ethereum&vs_currencies=usd with no API key. It will 402. Pay the Arc Gateway option from the agent wallet and return the prices.
```

A second beat is Jack Dorsey's profile at `/apis/v2/twitter/user/info?userName=jack`, same $0.10 Arc challenge. Confirm anything at or above $0.036 before signing.

## Failure rules

- Do not demo Arc testnet against this API.
- Do not show a private key or the OTP.
- If `circle services pay` throws a chain mismatch or a BigInt error, stop and follow `wallet-pay.md` instead of retrying blind.
- Do not transfer USDC directly to the Gateway address.

## Sources

- https://agents.circle.com/skills/setup.md
- https://agents.circle.com/skills/wallet-pay.md
- https://agents.circle.com/skills/wallet-fund.md
- https://www.circle.com/agent-stack
- https://developers.circle.com/x402-facilitators/x402
- https://aisa.one/blog/aisa-data-layer-agentic-economy-arc
- https://github.com/AIsa-team/nanopayment-x402
- Circle discovery example listing AIsa CoinGecko: https://www.circle.com/blog/discover-the-whole-agent-marketplace-in-one-call
