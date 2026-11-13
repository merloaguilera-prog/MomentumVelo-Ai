# Cierre por fases de MomentumVelo

Actualizado: 13 de noviembre de 2026. Rama de revisión; producción conserva su versión.

| Punto | Avance comprobado | Para darlo por terminado |
| --- | --- | --- |
| 1. Acceso | Configuración separada por entorno; límite conjunto de 20 s, errores por fase y herramientas públicas accesibles. En la comprobación del 10/11 el dominio principal cargó el formulario gestionado. Pruebas automatizadas de acceso y configuración superadas. | Completar entrada y salida con una cuenta, correo de verificación, registro y recuperación de contraseña. La solicitud segura de identificación se canceló y no acredita una sesión. No usar cuentas de prueba locales como sustituto. |
| 2. Rapidez | Inicio y Pulse aplazan gráficos que aún no se ven. Las acciones de periodo y reintento cargan directamente. El vídeo de presentación no descarga metadatos al abrir. Se conserva la navegación Atrás con caché. | Medir LCP, INP y estabilidad en móviles reales y redes lentas. Objetivos propuestos, aún sin acreditar: LCP ≤2,5 s e INP ≤200 ms en el percentil 75. |
| 3. Detección | Ventanas de 1, 5 y 15 min; confirmación opcional de 1 o 3 s; reglas y periodo visibles en cada aviso. Reintentos 2/4/8 s, máximo tres por activación. El latido comprueba conexión y no se presenta como un precio. Cada reconexión descarta la ventana anterior. Pausar u ocultar detiene la conexión y conserva el último precio identificado como anterior. | Evaluar falsas alarmas con históricos y datos observados. Incorporar volumen con una fuente que permita calcularlo correctamente; no deducir volumen de una captura del gráfico ni de una muestra incompleta. |
| 4. Más mercados | Catálogo compartido de acciones, índices, divisas, cripto y otros instrumentos; cada enlace abre su ficha. Los gráficos los suministra TradingView. | Integrar datos aptos para el motor de acciones e índices, con disponibilidad, permisos, latencia y coste conocidos. Los gráficos embebidos no son una API de precios del motor. |
| 5. Validación | Detector y comparador de CSV con reglas explícitas; pruebas de datos inválidos, orden y ventanas. | Evaluación histórica temporal con periodos separados de ajuste y evaluación, costes, falsos avisos, caídas y trazabilidad de cada versión de reglas. |
| 6. IA y avisos | Explicaciones deterministas de las reglas en los avisos. La IA y el índice global se identifican como pendientes. | Explicación con IA basada en evidencia calculada. Servicio de vigilancia independiente de la pestaña para avisos con la aplicación cerrada; persistencia y permisos de notificación. |
| 7. Publicación | Vista previa y controles automatizados. Ventas Premium cerradas. Diseños del toro en Inicio y mapa verde en Pulse conservados. | Revisar Android/Play con una compilación firmada; comprobar acceso completo y cobros de prueba, cancelación y restauración. Publicar una versión revisada únicamente cuando estos recorridos estén acreditados. |

## Límites de la verificación

Las pruebas automatizadas usan mensajes de mercado controlados; comprueban reglas y manejo de errores, no rentabilidad ni disponibilidad permanente de los proveedores. Una página que muestra un formulario no acredita una cuenta creada o autenticada. Los indicadores de carga diferida no equivalen a una medición de rendimiento de usuarios reales.
