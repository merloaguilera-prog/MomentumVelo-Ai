# Global markets expansion

Adds a neon explorer ahead of US movers with America, Europe, Asia, Africa and Oceania selections, plus crypto, FX, index CFDs, ETFs, commodity CFDs and bond futures. The searchable catalog opens the existing detail chart and preserves all eleven original symbols for saved favorites/notes. Provider table links resolve through validated tvwidgetsymbol query values; unknown symbols are ignored.

Quotes are provider embeds, never invented prices. Selections are not global mover rankings. Stocks may be delayed/end-of-day, closed or unavailable. Continuous bond futures and CFDs are labeled as such. Widget transport does not prove individual quote availability. Retry and source links remain available.

References: TradingView official Market Overview widget configuration and regional coverage lists, https://www.tradingview.com/widget-docs/widgets/watchlists/market-overview and https://www.tradingview.com/widget-docs/markets/. Global category organization also informed by Investing.com mobile, https://www.investing.com/mobile/.

Validation: 94 existing tests pass; npm run check and node --check mercados-global.js pass. Browser validation of new embeds is pending publication: Vercel daily deployment quota currently blocks deployments. Exact requested 5-day/10-day/2-year detail ranges are not implemented or verified in this change. Clerk canonical-domain connectivity and Premium activation remain separate blockers; this change does not resolve them.
