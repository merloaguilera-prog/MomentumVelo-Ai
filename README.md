# MomentumVelo-AI

Landing de MomentumVelo-AI. Premium está en preparación, con un precio previsto de 49 €/mes; la contratación pública permanece desactivada.

## Variables de entorno en Vercel

- `STRIPE_SECRET_KEY`: clave secreta de Stripe.
- `STRIPE_PREMIUM_PRICE_ID`: identificador del precio recurrente mensual de 49 €.
- `STRIPE_WEBHOOK_SECRET`: firma del webhook de Stripe.
- `PUBLIC_SITE_URL`: URL pública sin barra final.
- `PREMIUM_SALES_ENABLED`: mantener en `false` hasta verificar funciones, identidad, precio, webhook y condiciones comerciales.
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`: clave pública del acceso gestionado con Clerk.
- `CLERK_SECRET_KEY`: clave privada de Clerk, solo en el servidor.
- `RESEND_API_KEY`: clave de Resend para enviar las consultas de soporte.
- `SUPPORT_EMAIL_TO`: buzón que recibe las consultas de ayuda y ventas.
- `SUPPORT_EMAIL_FROM`: remitente verificado en Resend.

La portada separa el registro gratuito, el inicio de sesión y Premium. La API rechaza el checkout mientras `PREMIUM_SALES_ENABLED` no sea `true`; incluso al habilitarlo exige Clerk, Stripe, el secreto del webhook y verifica que el precio configurado esté activo y sea de 49 € cada mes en EUR. No existe respaldo mediante Payment Link, porque ese enlace no garantiza la vinculación del pago a la cuenta.

Cuando Clerk está configurado, el registro, el inicio de sesión, las sesiones y la recuperación por correo son gestionados y multidispositivo. Sin esas variables, el acceso local es solo una demostración: la cuenta queda en el navegador donde fue creada y no tiene recuperación automática. No debe anunciarse como cuenta segura multidispositivo.

## Acceso seguro y dominio

El proxy se configura en el script de Clerk antes de crear su instancia, usando el origen actual y `/__clerk`. El registro local solo se permite si `/api/auth-config` confirma explícitamente que ambas claves están ausentes. Una configuración parcial, un fallo de red o un error del SDK muestran reintento y ayuda, sin leer ni crear identidades locales. Las dos páginas de acceso (`login.html` y `login/index.html`) mantienen los formularios ocultos hasta conocer la configuración.

La asociación de dominio y proxy de la instancia de producción está gestionada por Vercel Marketplace. El 7 de octubre de 2026, la integración rechazó cambiar a `momentumvelo.app` por una discrepancia entre `name` y `proxy_url`. Clerk confirmó la recepción de una incidencia para corregir ambos valores conservando la instancia. Cambiar una variable de entorno por sí sola no resuelve esa asociación.

Antes de considerar resuelto el acceso, verificar environment/client en el navegador, las claves de la misma instancia, el registro con verificación de correo, inicio, persistencia, cierre y recuperación. Un despliegue READY o pruebas locales correctas no acreditan estos pasos reales.

Pulse (`/premium`) es una simulación con activos y puntuaciones codificados en `premium.js`; no hay feed ni alertas de mercado en vivo. PayPal no está integrado y los métodos de pago futuros dependerán de la configuración efectiva de Stripe.

Stripe debe enviar los eventos `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded` e `invoice.payment_failed` a `/api/webhook`. El endpoint live también tiene habilitados `invoice.paid` y `checkout.session.async_payment_failed`; la lista compartida está en `api/_stripe-config.js`. El webhook vuelve a consultar la suscripción actual y solo concede Premium con el precio configurado de 49 EUR/mes, estado `active` y última factura `paid`. Una sesión `unpaid` no activa Premium; `past_due` y la cancelación retiran el acceso. Los fallos de escritura en Clerk producen HTTP 500 para permitir reintentos. El retorno exige la misma cuenta, cliente y suscripción, y muestra los pagos pendientes con un botón para volver a comprobar. El portal de cliente permite cancelar renovaciones y está protegido por la identidad de la cuenta.

Para Production, fijar `PUBLIC_SITE_URL=https://momentumvelo.app` y `PREMIUM_SALES_ENABLED=false`. Configurar el secreto del webhook live existente no abre las ventas. Validar la entrega firmada y la actualización real del plan en Clerk antes de habilitar la contratación. Los secretos de Production deben permanecer separados de los de Preview/sandbox; no copiar claves live a los tests.

El formulario de `/ayuda` usa Resend. Si el envío todavía no está configurado, ofrece de forma explícita abrir un correo dirigido a `hola@momentumvelo.ai`, sin perder el texto de la consulta.

Antes de abrir la contratación comercial, completar en `legal.html` la razón social o nombre del titular, NIF/CIF, domicilio y datos registrales, y revisar los textos con asesoría jurídica aplicable al país de operación.

## Validación en un entorno de pruebas

La [guía de pruebas de Premium](docs/premium-sandbox.md) separa la preparación, las comprobaciones locales y la evidencia exigida a Stripe/Clerk reales. `npm run billing:preflight` solo hace lecturas con claves test: exige `STRIPE_WEBHOOK_ENDPOINT_ID` y verifica el registro, modo, URL, versión y ocho eventos del endpoint; no crea pagos ni acredita una entrega firmada o el plan de la cuenta. Preview y Development rechazan claves live y combinaciones Stripe/Clerk de distinto modo. Los retornos de Preview permanecen en esa Preview. La contratación live continúa cerrada.

## Referencia visual definitiva

La referencia visual aprobada para MomentumVelo es el mockup neón generado el 19/09/2026 (gen_id: da53f8c5-29fa-4cd6-a361-eb90251f4e9c). Mantener esta dirección visual: fondo oscuro, cian/verde neón, CTA Premium destacado, panel Premium a 49 €/mes, portátil con gráficos y tarjetas limpias. No sustituir esta referencia por otro diseño sin aprobación explícita.

### Gestión de facturación tras un impago

La cuenta conserva el portal cuando el estado guardado de la suscripción indica facturación previa, aunque el plan sea `free`. Para `past_due`, `unpaid` o `incomplete` muestra el pago pendiente y permite revisarlo sin ofrecer una nueva contratación ni afirmar acceso Premium. El botón puede reintentarse después de un error de sesión o de Stripe. `/api/portal` sigue exigiendo la identidad autenticada y el cliente Stripe en metadatos privados. Estas pantallas se han probado localmente; el circuito con usuarios y servicios reales continúa pendiente de Clerk y del sandbox.

## Contratación desde la cuenta y prevención de duplicados

`/api/auth-config` publica únicamente un indicador booleano `premiumSalesEnabled`, además de la configuración pública de acceso. El indicador requiere la apertura explícita de ventas y la configuración mínima coherente de Clerk, Stripe, webhook y retornos; no acredita que el proveedor esté funcionando. Con las ventas cerradas, el botón de la cuenta muestra «Premium · en preparación». Al habilitarlas, obtiene un token vigente de la sesión, llama a `/api/checkout` y solo navega a una URL HTTPS de `checkout.stripe.com`. Los errores permiten reintentar y el botón evita solicitudes por doble clic.

El servidor guarda primero el cliente Stripe en metadatos privados de Clerk, consulta todas sus suscripciones y sesiones abiertas, y reutiliza la contratación pendiente de la misma cuenta, precio y origen. Una suscripción activa o pendiente bloquea otra contratación y ofrece su gestión. Las claves de idempotencia de Stripe se derivan de la cuenta y del intento anterior: dos peticiones simultáneas desde procesos distintos comparten el intento; después de expirar o terminar una contratación sin suscripción vigente se permite otro. Si no se puede guardar o comprobar la asociación, no se crea Checkout. No se acepta un correo enviado por el navegador como identidad de facturación.

Las pruebas locales cubren concurrencia, reintentos, expiración, historial paginado, discrepancias de propietario/precio/origen y fallos al guardar en Clerk. Utilizan servicios simulados: sigue pendiente acreditar estas protecciones con Stripe sandbox y Clerk development, junto con el circuito de pago, retorno, renovación, impago y cancelación. Production conserva `PREMIUM_SALES_ENABLED=false`.

## Cotizaciones de mercado disponibles

`/mercados` integra el widget oficial Symbol Overview de TradingView, gratuito y con datos incluidos. Permite elegir acciones estadounidenses, Santander e Iberdrola en BME, EUR/USD y BTC/USD o ETH/USD de Coinbase, y cambiar el periodo del gráfico. Acciones con retraso: NASDAQ/NYSE se suministran mediante Cboe One; BME también se lista como delayed. El precio, moneda y estado del mercado se consultan en el widget. No se fabrican precios de respaldo ni se marca una descarga del script como prueba de cotización. Ante un error hay reintento y enlace al proveedor.

La CSP permite exclusivamente el directorio de scripts de embedding de `s3.tradingview.com` y los frames de `www.tradingview-widget.com`. No se usan claves nuevas ni se modifica Stripe/Clerk. El panel y Pulse conservan sus demos claramente identificadas. Los widgets no permiten extraer cotizaciones para un motor propio; señales, IA, historial y backtesting propios requieren una API y permisos independientes y continúan pendientes.

Mercados reales incluye favoritos y una nota independiente por activo (hasta 2.000 caracteres), guardados automáticamente en este navegador con una clave independiente de la lista demo. Las notas son texto del usuario: no se envían al proveedor ni se analizan con IA. No hay sincronización entre dispositivos ni alertas automáticas. Si el almacenamiento falla se informa que los cambios duran solo esta visita; eliminar un favorito conserva su nota. La comparación de funciones y prioridades está en [docs/competitors-2026-10-11.md](docs/competitors-2026-10-11.md).

Documentación primaria: [inicio](https://www.tradingview.com/widget-docs/getting-started/), [mercados](https://www.tradingview.com/widget-docs/markets/), [datos y límites](https://www.tradingview.com/widget-docs/faq/data/), [NASDAQ](https://www.tradingview.com/widget-docs/markets/north-america/), [BME](https://www.tradingview.com/widget-docs/markets/europe/) y [privacidad de los widgets](https://www.tradingview.com/widget-docs/faq/general/).

### Movimientos y detector histórico

`/mercados#movimientos` carga a petición las hotlists oficiales de TradingView (bolsa estadounidense: mayores subidas, caídas y actividad). `/mercados#mapa` carga el mapa del S&P 500, por sector y variación de sesión. Ambos mantienen atribución, retraso y enlaces de recuperación; no se extrae su contenido para cálculos propios. Se cargan solo al pulsar/abrir, sin añadir proveedores, claves ni permisos CSP.

`/mercados#mi-detector` permite importar hasta 1.000 cierres diarios de un único activo desde CSV/TSV (256 KB), o pegarlos. Se requieren fecha y cierre; volumen opcional. Ordena fechas, rechaza duplicados, fechas futuras o inválidas, precios no positivos, mezcla de símbolos y números inválidos. El usuario declara activo, fuente y moneda. No se verifica la procedencia ni se confunde el último cierre histórico con un precio actual.

El motor puro `detector-core.js` calcula variación entre los últimos cierres, caída desde el mayor cierre de la ventana completa elegida, SMA20 y cruce observado, y volumen respecto a los 20 cierres anteriores (sin incluir el actual). Umbrales inclusivos con tolerancia de redondeo; confirmación de 1–3 cambios consecutivos para subida/caída. El filtro opcional de volumen exige 1,5 veces la media previa; sin volúmenes suficientes no confirma reglas. La regla desde máximos usa el último cierre y no la confirmación consecutiva. El historial de hasta 30 cambios individuales está rotulado como tal, sin filtros de confirmación/volumen.

Las reglas del último análisis se guardan localmente. CSV, metadatos y resultados solo viven durante la visita; cambiar datos o metadatos invalida el resultado, cambiar reglas lo recalcula sobre el histórico ya cargado. No se suben archivos, envían mensajes ni activan trabajos en segundo plano. Alertas automáticas con precios del proveedor, sincronización, API autorizada y pruebas de estrategias siguen pendientes; Pulse continúa siendo demo. No cambia la autenticación ni la facturación.

### Gráfico del histórico importado

El resultado de Mi detector incluye un gráfico propio de cierres con todo el archivo o los últimos 30, 90 o 180 cierres. La separación horizontal respeta las fechas, incluidos huecos. La escala vertical se ajusta al mínimo y máximo del tramo; no representa movimientos intradía. La variación compara el primer y el último cierre visibles, y los extremos indican su fecha. El control deslizante y los botones anterior/siguiente consultan cada cierre y su volumen; una tabla ofrece los mismos datos. Cambiar el tramo no altera las reglas del detector, que usan el archivo completo.

La descarga CSV conserva **todos** los cierres validados, fechas y volúmenes sin redondear, aunque el gráfico muestre un tramo. Omite las etiquetas de activo/fuente y se puede volver a importar. No añade almacenamiento de históricos por cuenta ni lecturas de cotizaciones del widget; los datos siguen durando solo la visita.

## Cartera y diario de práctica

`/practica` permite preparar capital virtual en EUR o USD y registrar hasta 500 compras/ventas simuladas de los activos de esa moneda disponibles en Mercados. El usuario introduce precio, fecha, cantidad (hasta 6 decimales), comisión y nota. No se envían órdenes, se utilizan fondos reales ni se leen cotizaciones del widget. Se exige saldo suficiente, unidades disponibles para vender y fechas válidas en orden.

`practica-core.js` reproduce el diario con coste medio ponderado. La comisión de compra se incluye en el coste; las ventas parciales prorratean ese coste y descuentan la comisión de venta. Los importes se calculan con enteros y productos decimales exactos mediante BigInt y se redondean a céntimos, incluyendo los medios céntimos. Saldo + coste pendiente = capital inicial + resultado realizado. Los resúmenes y el anillo muestran importes al coste, nunca valor de mercado ni rentabilidad no realizada. No calcula impuestos, dividendos, splits, apalancamiento, ejecución intradía ni rendimiento TWR.

El registro actual y un estado anterior se conservan en una clave local independiente de favoritos/autenticación. Cada cambio permite volver al estado anterior y alternar con el estado que se acaba de dejar. La copia JSON se valida reproduciendo todas las operaciones antes de aplicarse; el archivo no se sube. Un registro que cambió en otra pestaña se recarga antes de aceptar nuevas escrituras; un estado corrupto no se sobrescribe automáticamente. Si falla localStorage, el estado permanece solo durante la visita y se avisa para descargarlo. No hay sincronización por cuenta.

La cartera y el diario utilizan dos ilustraciones originales generadas para MomentumVelo, optimizadas en WebP (cada una menor de 150 KB) y con carga diferida para el diario. Los accesos se incluyen en Mercados, panel, Pulse y portada. La referencia anterior de portada se conserva.
# Evolución de la cartera de práctica

`/practica#evolucion` permite revisar saldos y resultados por operación, con tramos de todo el diario o las últimas 30/90 operaciones. El punto anterior al tramo se conserva como referencia. La escala horizontal cuenta registros, no días; las posiciones siguen al coste y no se calculan ganancias de mercado sin realizar. El resumen separa ventas positivas, negativas y sin resultado, incluidas ventas parciales, con comisiones ya incorporadas al cálculo.

El gráfico SVG tiene alternativas por control de registro, botones y tabla. Puede alternar saldo disponible y total al coste. El informe CSV incluye siempre toda la cartera validada, capital inicial y notas, con BOM UTF-8, punto y coma y coma decimal. Las notas con prefijos de fórmula se protegen para hojas de cálculo; JSON sigue siendo el formato para restaurar. Los datos permanecen locales. La comparación y sus límites están en `docs/competitors-2026-10-12.md`.

# Comparador de históricos

`/comparar` compara dos CSV locales de hasta 1.000 cierres cada uno. Reutiliza el parser del detector y alinea únicamente fechas presentes en ambos archivos. Las curvas muestran variación desde la primera fecha del tramo común, con opciones de todas/30/90/180 fechas, navegación por fecha y tabla. Se informa de fechas excluidas, diferencia en puntos porcentuales y mayor caída desde un máximo entre las fechas comunes. Los tipos de cierre deben coincidir; el ajuste no declarado y la comparación de monedas distintas se explican expresamente. No se convierten divisas, se infieren huecos, ni se presentan rentabilidad total o predicciones.

El informe CSV exporta solo el tramo común visible y datos numéricos, sin etiquetas del usuario. Los archivos no se suben a un servidor ni se guardan al cerrar. El enlace del detector prepara A en `sessionStorage`; el comparador valida, consume el traslado y pide el segundo histórico. Sin traslado disponible permite cargar el archivo manualmente. Clerk y la configuración de cobros no cambian.
