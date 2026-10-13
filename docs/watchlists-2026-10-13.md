# Seguimiento personal — 13 de octubre de 2026

Se compararon funciones de listas de seguimiento de TradingView y Koyfin:

- https://www.tradingview.com/support/solutions/43000745825-mastering-the-tradingview-watchlists/
- https://www.tradingview.com/support/solutions/43000667897-how-to-check-all-text-notes/
- https://www.koyfin.com/help/mywatchlists/

Se adaptan los patrones de búsqueda, ordenación, identificación de notas e importación/exportación, con código propio y el diseño neón existente.

Mercados permite buscar favoritos por nombre o símbolo, ordenar por nombre o guardado, y mostrar solo favoritos que tienen notas. También reúne todas las notas guardadas, incluso las de activos no favoritos. Mi seguimiento tiene acceso directo y un recuadro destacado en neón. La copia JSON incluye favoritos y todas las notas del espacio Mercados, también las de activos no favoritos; no incluye la cartera de práctica ni reglas del detector. La revisión valida el formato y muestra cantidades antes de importar. La combinación no elimina datos ni sobrescribe notas existentes diferentes, incluso si cambia el almacenamiento entre revisión y aplicación. Una importación repetida no duplica favoritos.

Los archivos se procesan en el navegador y no se envían al servidor. Hasta 256 KB; solo activos de su selector actual y notas de hasta 2.000 caracteres. La copia puede contener información personal. No constituye sincronización automática ni una fuente de cotizaciones, y no activa alertas ni Premium.

Validación: pruebas de filtrado, formatos inválidos, Unicode, claves peligrosas, combinación sin pérdidas e idempotencia; 90 pruebas del proyecto superadas. La comprobación del flujo en la preview está pendiente: Vercel rechaza el despliegue con «Deployment rate limited — retry in 24 hours». El cambio está preparado en el PR #30 para integrarse en main por petición expresa; la publicación y la revisión visual permanecen pendientes. No se requiere comprar datos ni modificar Clerk para estas mejoras.
