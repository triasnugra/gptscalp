# MetaScalp

Rule-based crypto scalping analysis engine, designed as a separate short-timeframe system inspired by the architecture of TNV2 and the supplied CryptoEliz post collection.

## Strategy translation

- **Regime first:** 1H EMA20/EMA50 trend. Altcoin setups are blocked when BTC 1H regime is opposite or unclear.
- **Location matters:** 15m rolling range. No breakout chasing; setups need a sweep/reclaim at range boundaries or a closed 15m breakout/breakdown with 5m retest.
- **Trigger before entry:** 5m candle must be closed and show directional rejection/body confirmation.
- **No-man's-land:** mid-range breakout ideas are rejected. No trigger means `NO_TRADE`.
- **Risk discipline:** limit/retest entry, structural stop, maximum 0.80% stop distance, minimum 1.60R, target 2R, maximum five selected candidates per scan.
- **Liquidity is context, not a standalone signal:** this v1 uses price/volume and book spread proxies; it does not ingest a liquidation heatmap or order-book depth history.

## Timeframes

| Layer | Timeframe | Purpose |
|---|---|---|
| Regime | 1H | Trend and BTC market gate |
| Structure | 15m | Recent range high/low |
| Trigger | 5m | Sweep/reclaim or breakout retest confirmation |

Only closed candles are used. The scanner drops the currently forming candle returned by Binance.

## Run locally

Requires Node.js 20+.

```bash
npm test
npm run check
npm run scan
```

`npm run scan` calls public Binance Spot market-data endpoints and writes `data/latest.json`. Each new candidate is sealed in `data/journal.json` before its outcome is known. `npm run grade` grades expired candidates from 5m candles; `npm run verify` checks the SHA-256 chain. No API key is required.

## GitHub deployment

1. Create an empty public repository named `metascalp` under `triasnugra`.
2. Upload all files and folders from this project to the repository root (not the containing folder).
3. In **Settings → Pages**, set **Build and deployment → Source: GitHub Actions**.
4. In **Actions**, enable workflows. Run **MetaScalp Scan** once with `workflow_dispatch`.
5. Run **Deploy MetaScalp Pages**. The dashboard will be published at `https://triasnugra.github.io/metascalp/` after Pages is enabled.

The scheduled scan runs every five minutes on a best-effort basis. GitHub Actions schedules can be delayed and are not a low-latency market data service. The dashboard displays the latest committed scan; it does not promise a live scan every five minutes.

## Safety / limitations

- Analysis only. No private keys, exchange credentials, order placement, or automatic execution.
- The forward journal seals signal parameters with a SHA-256 chain; results are written later and are intentionally not sealed. Git history and Actions summaries are additional evidence, not cryptographic proof against a repository owner.
- Binance Spot USDT universe; not futures funding, open interest, liquidation maps, or true consolidated liquidity.
- Public API rate limits and GitHub scheduled-run delays may cause gaps.
- The numeric thresholds in `src/engine.mjs` are initial hypotheses, not proven profitable parameters.
- Estimated fees/slippage are illustrative. Configure them for your venue and tier.
- Do not infer profitability from a small sample. Build an immutable forward journal and a no-lookahead backtest before relying on live signals.
- This software is not financial advice. Scalping and leverage can cause rapid losses.

## Engine design

`src/engine.mjs` contains pure deterministic indicator and setup logic. `scripts/scan.mjs` is the Binance data adapter. The dashboard only renders `data/latest.json`. GitHub Actions handles grading, scan, journal verification, CI and Pages deployment. No model/API key is needed.
