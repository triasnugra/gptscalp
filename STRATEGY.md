# MetaScalp strategy notes

This is a conservative, mechanical interpretation of the supplied CryptoEliz post collection, not a claim to reproduce a discretionary trader's exact decisions.

| Source idea | MetaScalp implementation |
|---|---|
| Wait for market direction; do not predict | 1H EMA20/EMA50 regime filter |
| BTC context gates altcoin opportunity | Altcoin signal blocked if BTC trend is opposite or neutral |
| Work range highs/lows; avoid the middle | 15m rolling 24-candle range; reject mid-range breakout candidates |
| Liquidity sweep followed by reclaim | Closed 5m wick through a 15m range edge and close back inside |
| Breakout only after confirmation and retest | Closed 15m close beyond range plus 5m retest/rejection |
| Precise entry; do not chase | Limit idea at the reclaimed/broken level; maximum 0.18% distance |
| Small scalps and low drawdown | Maximum 0.80% structural stop, target 2R, at most five signals |
| Volume/price context matters; heatmap is not a strategy alone | 5m volume expansion is a scoring confirmation, not an independent entry trigger |
| Wait when unclear | All failed gates produce explicit NO_TRADE reason codes |

## Explicitly not implemented in v1

The supplied posts refer to liquidation heatmaps/hotmaps, order-wall changes, absorption, funding/open interest and broader TOTAL/OTHERS context. MetaScalp v1 does not claim to observe those datasets. It uses Binance Spot OHLCV, 24h quote volume and top-of-book spread only. A heatmap provider or futures-data source would be required to add genuine liquidation clusters.

The source material describes discretionary context and examples, not a complete numeric scalping rulebook. Therefore every threshold in `src/engine.mjs` is a starting hypothesis that must be validated with historical and forward data. The thresholds are not endorsed or proven by the source posts.
