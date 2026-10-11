# Referencias para mejorar MomentumVelo

Revisión: 11 de octubre de 2026. Fuentes públicas oficiales. Las funciones descritas por los proveedores no se han probado con una suscripción. Esta revisión compara funciones; no evalúa la rentabilidad de sus señales ni establece equivalencia con MomentumVelo.

| Referencia | Función documentada | Situación en MomentumVelo | Prioridad |
| --- | --- | --- | --- |
| TradingView | Listas de seguimiento, filtros técnicos/fundamentales y alertas por lista | Gráficos reales mediante widget; filtros y señales del panel todavía son demostrativos | Favoritos en mercados reales primero; filtros reales tras conectar API |
| Koyfin | Listas personalizadas, notas y paneles organizados | La lista existente pertenece al panel demo; falta seguimiento personal junto a las cotizaciones | Añadir favoritos y notas por activo al apartado real |
| TrendSpider | Alertas con varios criterios y marcos temporales; pruebas de estrategias sobre históricos | Sin histórico propio ni proceso que evalúe reglas de alerta | API autorizada, reglas reproducibles, registro de entregas y evaluación histórica |
| Trade Ideas | Señales de Holly, histórico y simulador de operaciones | Señales ilustrativas; no hay registro de operaciones ni resultados verificables | Diario/simulador antes de prometer resultados de una IA |

## Primer cambio

`/mercados` incorpora guardar/quitar favoritos, abrir su gráfico y escribir una nota independiente por activo. Se conserva tras recarga en el mismo navegador y se distingue del panel demo. Eliminar un favorito no elimina su nota. Las notas no se transmiten a TradingView ni a un modelo de IA. Se informa del fallo del almacenamiento y del límite de conservación durante la visita.

La implementación adapta un patrón funcional habitual con código y estilo propios. No reproduce activos gráficos, código privado ni señales de otros servicios.

## Siguientes mejoras, por dependencia

1. **Con una API autorizada de mercado:** filtros de variación/volumen, reglas de alertas, comparación porcentual por periodo y registro de fuente, fecha y retraso de cada observación. El widget actual no proporciona esos datos al motor propio.
2. **Con persistencia y entregas verificadas:** avisos cuando la app está cerrada, historial de alertas y seguimiento entre dispositivos. Guardar una preferencia no equivale a una alerta activa.
3. **Con histórico suficiente:** probar reglas con costes, pérdidas máximas y periodos separados de evaluación. Un buen resultado retrospectivo no acredita resultados futuros.
4. **Con esas evidencias:** explicaciones de IA basadas en observaciones y factores contrarios, sin fabricar certeza ni puntuaciones de confianza.

No se modifica el bloqueo de ventas Premium. La validación del acceso en Clerk y del ciclo real de Stripe sigue siendo una dependencia separada.

## Segunda mejora: subidas, caídas y reglas explicadas

Comparación ampliada el 11 de octubre con documentación oficial de TradingView, Finviz y TrendSpider. No se han probado sus planes de pago ni se reutiliza código privado, señales o datos extraídos.

| Patrón observado | Aplicación propia | Alcance |
| --- | --- | --- |
| TradingView y Finviz: mayores ganadores, perdedores y actividad | Hotlists oficiales incrustadas con atribución y enlace a la fuente | Consulta real del proveedor, bolsa estadounidense, con retraso; no alimenta el motor propio |
| TradingView: mapa por sector y cambio porcentual | Mapa oficial S&P 500, cargado al abrir el apartado | Vista de mercado, sin procesamiento de los datos del panel |
| TradingView: umbrales de movimiento y TrendSpider: confirmación y condiciones combinadas | Reglas configurables de variación, ventana de máximos, 1–3 cambios consecutivos y filtro opcional de volumen | Análisis de cierres diarios importados por el usuario; no seguimiento automático |
| Finviz: porcentaje entre cierres, medias simples y distancia desde máximos | Variación entre cierres, SMA20/cruce y pérdida desde el mayor cierre de una ventana completa | Fórmulas documentadas en código, con fecha, moneda y fuente declarada |

La media de volumen propia usa **20 cierres anteriores**, excluye el actual y **no** replica la media trimestral ni el ajuste intradía de Finviz. Las reglas de precio y volumen se calculan sobre el archivo seleccionado, nunca sobre cifras de demostración. La historia muestra los últimos 30 cambios individuales que superan el umbral, no alertas entregadas ni operaciones realizadas.

Sigue faltando una API con acceso y derechos adecuados para analizar acciones automáticamente, almacenamiento de reglas por cuenta, ejecución periódica y notificaciones verificadas. Las APIs gratuitas personales no se consideran autorización para redistribuir datos en una app comercial. No se contratan servicios ni se cambia el bloqueo de Premium.

Fuentes adicionales:
- TradingView, hotlists: https://www.tradingview.com/widget-docs/widgets/watchlists/stock-market/demos/no-chart/
- TradingView, mapa: https://www.tradingview.com/widget-docs/widgets/heatmaps/stock-heatmap/
- TradingView, operadores: https://www.tradingview.com/support/solutions/43000763312-learn-how-to-configure-alerts/
- Finviz, definiciones de filtros: https://finviz.com/help/screener
- TrendSpider, confirmación: https://trendspider.reamaze.com/kb/alerts/create-new-dynamic-price-alert
- TrendSpider, varias condiciones: https://help.trendspider.com/kb/alerts/multi-factor-alerts-overview
- Finnhub, licencia comercial: https://api.finnhub.io/pricing-startups-and-enterprise
- Twelve Data, acceso empresarial: https://twelvedata.com/pricing-business

## Fuentes

- TradingView, screener: https://www.tradingview.com/support/solutions/43000718866-tradingview-stock-screener-trade-smarter-not-harder/
- TradingView, alertas por lista: https://www.tradingview.com/support/solutions/43000739708-watchlist-alerts-your-trading-edge/
- Koyfin, listas y notas: https://www.koyfin.com/features/watchlists/
- Koyfin, paneles: https://www.koyfin.com/features/custom-dashboards/
- TrendSpider, alertas: https://trendspider.com/product/trade-timing-and-execution-tools/
- TrendSpider, pruebas de estrategias: https://help.trendspider.com/kb/strategy-tester/what-is-the-strategy-tester
- Trade Ideas, Holly y simulador: https://www.trade-ideas.com/ti-ai-virtual-trade-assistant/
- Trade Ideas, histórico: https://www.trade-ideas.com/hollyguide/Holly_Performance_History.html
- TradingView, límites del widget: https://www.tradingview.com/widget-docs/faq/data/
