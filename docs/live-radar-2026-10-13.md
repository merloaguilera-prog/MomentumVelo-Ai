# First live crypto movement radar

Adds /radar, opt-in public Coinbase Exchange ticker monitoring for BTC-USD, ETH-USD and SOL-USD. No credentials, order endpoints or paid services. This is observed movement detection, not prediction.

A bounded one-second observation series compares incoming trade price with an observation approximately 60–62 seconds earlier. Defaults to a 0.5% threshold, configurable 0.1–10%. Signals occur on entering either threshold, limited to one per product per minute; the visible history is capped at 20. Source timestamps and baseline time are displayed. Per-product state is isolated. Stale (>15 s), future (>5 s) and out-of-order messages are rejected. A >15 s trade gap resets the window. Watchdog stops after 20 s without a valid ticker. Hidden/pagehide/manual stop/error/disconnection terminate the socket and baseline; restart is explicit. No closed-app alerts, background guarantees or real-money execution.

CSP adds only wss://ws-feed.exchange.coinbase.com to connect-src. Market entry remains clear about limited crypto scope and historical analysis for other instruments. Charts use existing catalog deep links.

Official protocol references:
- https://docs.cdp.coinbase.com/exchange/websocket-feed/overview
- https://docs.cdp.coinbase.com/exchange/websocket-feed/channels

Validation: npm run check and 98 tests pass, including warm-up, alerts, cooldown, separate assets, gaps, reset, stale/future/invalid/out-of-order inputs. A real WebSocket smoke check received a valid BTC-USD ticker at 2026-10-13T16:10:41.426456Z. This confirms feed reception from the execution environment, not the deployed browser flow or availability of all three products. Deployment/browser/mobile checks remain pending due to Vercel deployment quota. Business redistribution rights and production performance require review before including this feed in a paid offering. Do not claim universal equities coverage, guaranteed low latency or complete trade delivery.
