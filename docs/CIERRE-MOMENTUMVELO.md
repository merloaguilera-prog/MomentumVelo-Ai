# Cierre por fases de MomentumVelo

Actualizado: 19 de noviembre de 2026. Rama de revisión; producción conserva su versión.

| Punto | Avance comprobado | Para darlo por terminado |
| --- | --- | --- |
| 1. Acceso | Configuración separada por entorno; límite conjunto de 20 s, errores por fase y herramientas públicas accesibles. El límite incluye la aparición de controles del formulario; una carga vacía ofrece reintento y cancela el montaje. Traducción española de Clerk cargada solo en las dos entradas de acceso. El 17/11 el dominio principal mostró el formulario gestionado de inicio, aún en inglés en producción. | Completar entrada y salida con una cuenta, correo de verificación, registro y recuperación de contraseña. La solicitud segura de identificación anterior se canceló y no acredita una sesión. No usar cuentas de prueba locales como sustituto. |
| 2. Rapidez | Inicio y Pulse aplazan gráficos que aún no se ven. Las acciones de periodo y reintento cargan directamente. El vídeo de presentación no descarga metadatos al abrir. Se conserva la navegación Atrás con caché. | Medir LCP, INP y estabilidad en móviles reales y redes lentas. Objetivos propuestos, aún sin acreditar: LCP ≤2,5 s e INP ≤200 ms en el percentil 75. |
| 3. Detección | Ventanas de 1, 5 y 15 min; confirmación opcional de 1 o 3 s; reglas y periodo visibles en cada aviso. Reintentos 2/4/8 s, máximo tres por activación. El latido comprueba conexión y no se presenta como un precio. Cada reconexión descarta la ventana anterior. Pausar u ocultar detiene la conexión y conserva el último precio identificado como anterior. | Evaluar falsas alarmas con históricos y datos observados. Incorporar volumen con una fuente que permita calcularlo correctamente; no deducir volumen de una captura del gráfico ni de una muestra incompleta. |
| 4. Más mercados | Catálogo compartido de acciones, índices, divisas, cripto y otros instrumentos; cada enlace abre su ficha. Los gráficos los suministra TradingView. | Integrar datos aptos para el motor de acciones e índices, con disponibilidad, permisos, latencia y coste conocidos. Los gráficos embebidos no son una API de precios del motor. |
| 5. Validación | Detector y comparador de CSV con reglas explícitas; pruebas de datos inválidos, orden y ventanas. | Evaluación histórica temporal con periodos separados de ajuste y evaluación, costes, falsos avisos, caídas y trazabilidad de cada versión de reglas. |
| 6. IA y avisos | Explicaciones deterministas de las reglas en los avisos. La IA y el índice global se identifican como pendientes. | Explicación con IA basada en evidencia calculada. Servicio de vigilancia independiente de la pestaña para avisos con la aplicación cerrada; persistencia y permisos de notificación. |
| 7. Publicación | Vista previa y controles automatizados. Ventas Premium cerradas. Diseños del toro en Inicio y mapa verde en Pulse conservados. | Revisar Android/Play con una compilación firmada; comprobar acceso completo y cobros de prueba, cancelación y restauración. Publicar una versión revisada únicamente cuando estos recorridos estén acreditados. |

## Límites de la verificación

Las pruebas automatizadas usan mensajes de mercado controlados; comprueban reglas y manejo de errores, no rentabilidad ni disponibilidad permanente de los proveedores. Una página que muestra un formulario no acredita una cuenta creada o autenticada. Los indicadores de carga diferida no equivalen a una medición de rendimiento de usuarios reales.

## Revisión de acceso del 17 de noviembre

Validación local: 210/210 pruebas superadas, `npm run check` y `git diff --check` correctos. Las cinco pruebas nuevas cubren traducción de los recorridos de acceso, carga de la traducción antes del proveedor, montaje diferido, montaje vacío que agota el presupuesto restante y error de montaje con limpieza. Los casos de error conservan el reintento y no crean una cuenta local.

La traducción incluida procede de `@clerk/localizations` 4.25.0, recurso `esES`, con su licencia MIT en `vendor/clerk-localizations-LICENSE.txt`. Se conservan las claves de plantilla del proveedor y se omiten sus traducciones indefinidas para mantener el comportamiento de reserva. Referencia de integración: https://clerk.com/docs/guides/customizing-clerk/localization.

Los errores de renderizado se comprueban con un proveedor controlado; no se atribuye un fallo reproducido de Clerk a la observación puntual de un formulario todavía vacío durante su carga normal. No se ha iniciado una sesión, creado una cuenta ni enviado un correo de recuperación en esta revisión.

## Presentación de herramientas — 19 de noviembre

Mercados, Radar, Cartera, Comparador y Academia incorporan ilustraciones distintas, con menos detalles y reflejos cian y violeta suaves. Se separan las imágenes del texto. La hoja `neon-tools.css` aplica bordes finos, fondos despejados y controles legibles a las herramientas; en Inicio solo cambia la ventana de Academia. Se conservan el toro, el icono y la navegación móvil de la revisión anterior.

Las ilustraciones se sirven en WebP de 1672 y 836 px. Cada versión móvil pesa entre 16 y 21 KB. La caché pública incorpora los nuevos recursos; no incluye respuestas de cuentas ni cotizaciones. El radar conserva sus identificadores, valores iniciales y reglas; la presentación separa su portada y los ajustes.

Validación: 210/210 pruebas, comprobación de sintaxis e identificadores y referencias locales. En navegador se revisaron las cuatro herramientas en contenedores de 320, 390 y 768 px, sin desbordamiento horizontal y con imágenes cargadas. Se abrió Academia desde el menú móvil y se comprobó su cabecera, imagen y tarjetas. Estos controles visuales no sustituyen las pruebas de Android físico ni las mediciones LCP/INP.
