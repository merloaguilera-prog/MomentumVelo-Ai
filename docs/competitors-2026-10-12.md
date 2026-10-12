# Comparación de aplicaciones y segunda mejora de cartera

Consulta: 12 de octubre de 2026. Son fichas del desarrollador en Apple App Store y documentación oficial; no hemos probado sus operaciones de corretaje. Las valoraciones redondeadas corresponden a la región indicada y pueden cambiar. No sumamos países ni equiparamos valoraciones con usuarios activos, seguidores o garantías de seguridad.

| Referencia | Valoración y volumen publicados | Función relevante | Adaptación en esta entrega |
| --- | --- | --- | --- |
| TradingView, App Store España | 4,8/5; aproximadamente 21.000 valoraciones. La ficha declara más de 100 millones de personas en su comunidad. | Revisión visual de datos y herramientas de seguimiento de cartera. | Recorrido de la cartera de práctica con consulta de cada registro, tabla y tramos. |
| Yahoo Finanzas, App Store España | 4,7/5; aproximadamente 8.700 valoraciones. La ficha de Estados Unidos muestra 4,8/5 y aproximadamente 627.000. | Seguimiento del desempeño y gráficos interactivos. | Selector entre saldo disponible y total al coste, con explicación del dato y contexto de cada operación. |
| Delta by eToro, App Store Estados Unidos | 4,7/5; aproximadamente 11.000 valoraciones. En España, 4,6/5 y 903. | Análisis de ganancias/pérdidas, distribución, gráficos e informes de operaciones. | Resumen de ventas positivas, negativas y sin resultado; sumas de ganancias y pérdidas e informe CSV. |

Las reseñas individuales son ejemplos, no una muestra representativa de satisfacción. Una reseña de Yahoo solicita distinguir los valores individuales del saldo total cuando se ocultan datos; ello refuerza la conveniencia de nombrar cada medida con claridad. No se implementa en esta entrega un modo de ocultación ni sincronización.

## Alcance exacto

El gráfico utiliza únicamente el diario validado del navegador. Cada paso horizontal es una operación, aunque varias compartan fecha. Incluye el capital inicial y permite recorrer todo el diario o las últimas 30/90 operaciones con el saldo anterior como referencia. No pretende mostrar una serie diaria ni un precio de mercado.

El total al coste es saldo disponible más coste pendiente de posiciones. Las compras no crean ganancias; las ventas reconocen resultados después de comisiones y coste proporcional. Las cifras de ventas cuentan también salidas parciales y no miden el éxito de estrategias completas. No calculamos rentabilidad anualizada, TWR, comparación con índices, impuestos, noticias, alertas automáticas ni movimientos futuros.

CSV completo: capital inicial y todas las operaciones, incluidas notas y saldos después de cada registro. Se exporta con BOM UTF-8, delimitador punto y coma y coma decimal. Las notas que podrían ejecutarse como fórmulas llevan un apóstrofo inicial en el informe; el diario y el JSON mantienen la nota original. El CSV no se usa para restaurar; para ello se conserva la copia JSON existente.

Se recrean patrones funcionales con código propio. La identidad y las ilustraciones neón originales se conservan.

## Fuentes

- TradingView España: https://apps.apple.com/es/app/tradingview-gr%C3%A1ficos-de-bolsa/id1205990992
- Portfolios de TradingView: https://www.tradingview.com/support/solutions/43000760937-tradingview-portfolios-track-your-assets-know-your-trades/
- Yahoo Finanzas España: https://apps.apple.com/es/app/yahoo-finanzas/id328412701
- Yahoo Finance Estados Unidos: https://apps.apple.com/us/app/yahoo-finance-stocks-markets/id328412701?platform=watch
- Delta España: https://apps.apple.com/es/app/delta-by-etoro/id1288676542
- Delta Estados Unidos: https://apps.apple.com/us/app/delta-by-etoro/id1288676542?platform=iphone&see-all=reviews
