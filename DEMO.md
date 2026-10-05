# Demo recording

About 3 minutes. Muse chat on the left, a terminal or ArcScan on the right. Record the OTP off-camera or cut it.

Title card: "Muse buys a CoinGecko price from AIsa. USDC on Arc, paid over x402."

End card: `agents.circle.com/skills/setup.md` and `api.aisa.one/apis/v2/coingecko/simple/price`.

| Time | On screen | What you say |
|---|---|---|
| 0:00–0:15 | Empty Muse chat | "Muse has no AIsa key and no card. It is about to get a USDC wallet and buy a price." |
| 0:15–0:40 | Paste the setup.md prompt | "This is Circle's Agent Stack skill. It installs the CLI and opens an Arc wallet." |
| 0:40–1:10 | Terms links, then email OTP | Cut the code. "Wallet commands are blocked until Terms and login. That is the only human step." |
| 1:10–1:30 | `circle wallet list --chain ARC` and balance | "Chain 5042. USDC is the gas token. Address is the agent's, not mine." |
| 1:30–1:50 | Fund QR or an already-funded balance, then Gateway deposit | "Deposit into Gateway. A raw transfer to the Gateway address would be lost. On Arc this is ready in under a second." |
| 1:50–2:10 | Unpaid curl, 402 header decoded | "No key. AIsa answers 402. Arc is eip155:5042, $0.10, Gateway batched, payTo 0xBd7b…." |
| 2:10–2:35 | Muse pays and prints BTC and ETH prices | "Same request, now with a signed authorization. That JSON is the thing we bought." |
| 2:35–2:55 | Gateway balance dropped by $0.10, ArcScan if a settle tx exists | "$0.10 USDC left the agent. Settlement is batched, so the tx may lag the response." |
| 2:55–3:10 | Optional: Jack's Twitter user object | "Same wallet, second AIsa endpoint, still no API key." |

## Prompt to paste

```text
Connect to Circle Agent Stack using https://agents.circle.com/skills/setup.md
```

After the wallet is funded and deposited into Gateway:

```text
Search the Circle marketplace for a Bitcoin and Ethereum price, pay AIsa with the Arc wallet over x402, and show the JSON plus what USDC was spent.
```

## Do not show

- The email OTP
- Any private key or mnemonic
- An Arc testnet payment against AIsa
