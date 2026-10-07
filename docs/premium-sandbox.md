# Pruebas reales de Premium sin abrir ventas live

Producción mantiene `PREMIUM_SALES_ENABLED=false`. Las pruebas locales y un despliegue READY no acreditan el circuito con Stripe y Clerk reales.

## Estado verificado el 8 de octubre de 2026

- El conector de Stripe solo permite la cuenta live de MomentumVelo Ai. Falta autorizar su entorno de pruebas antes de crear recursos de prueba mediante el conector.
- Preview ya tiene variables para las claves de Stripe y Clerk, pero no tiene `STRIPE_PREMIUM_PRICE_ID` ni `STRIPE_WEBHOOK_SECRET`. La presencia de una variable no acredita el modo o la pertenencia de su valor.
- La entrega firmada de prueba y la escritura del plan en Clerk development no se han ejecutado.
- El precio live y su IVA no se modifican como parte de estas pruebas.

## Preparación

1. Autorizar el sandbox de MomentumVelo en la conexión de Stripe. Confirmar `livemode=false` y su identificador antes de cualquier creación. Usar el sandbox que corresponde a las claves de Preview; si se crea uno nuevo, utilizar sus propias claves de pruebas.
2. Usar una rama de pruebas y fijar las variables solamente para esa rama Preview: claves test de Stripe y Clerk development, precio activo de 4900 EUR cada mes y secreto del endpoint de pruebas. Preferir una clave Stripe restringida con los permisos necesarios. Los secretos se guardan en Vercel, sin incluirlos en Git, logs ni documentos.
3. Registrar el webhook de pruebas en la URL de Preview de esa rama para los ocho eventos de `api/_stripe-config.js`, con la versión `2026-07-29.dahlia`. Guardar su ID no secreto en `STRIPE_WEBHOOK_ENDPOINT_ID` solamente para esa rama Preview. Mantener la protección del despliegue y usar el mecanismo de acceso admitido por Vercel para la entrega de Stripe; no desactivar la protección para hacer pasar una prueba.
4. Ejecutar `npm run billing:preflight` en un entorno autorizado con sus variables de pruebas. También se puede ejecutar `node --env-file=.env.test.local scripts/stripe-sandbox-preflight.js` con un archivo local ignorado por Git. La clave restringida necesita permisos de lectura para balance, precios y endpoints de webhook. Solo hace lecturas: confirma `livemode=false`, valida el precio, la URL de retorno y el registro del endpoint (modo test, habilitado, URL, versión y ocho eventos). No comprueba que el secreto corresponda al endpoint, no prueba la firma ni escribe en Clerk. La URL completa del webhook puede contener el acceso de Vercel; esa consulta no se incluye en el informe.
5. Verificar que el usuario de prueba pertenece a Clerk development. Habilitar `PREMIUM_SALES_ENABLED=true` únicamente en esa rama Preview una vez validado el entorno; Production y las demás previews conservan `false`.

## Evidencia requerida

| Caso | Resultado esperado | Evidencia real |
| --- | --- | --- |
| Pago inicial de prueba | Sesión pagada, suscripción activa y factura pagada; plan Premium en el usuario development | Referencias de sesión, factura y suscripción; entrega firmada 200; lectura posterior de metadatos |
| Pago asíncrono | Sin Premium mientras el pago esté pendiente; activación tras `checkout.session.async_payment_succeeded` | Ambos estados de Checkout y plan, sin usar pagos live |
| Renovación | Mantener Premium cuando la nueva factura esté pagada | Simulación de tiempo de Stripe, factura y actualización posterior |
| Impago | Suscripción `past_due`; plan free | Factura fallida, entrega y lectura de Clerk |
| Recuperación | Nueva factura pagada y suscripción activa; Premium restaurado | Eventos y lectura de Clerk |
| Cancelación | Retirar Premium cuando finalice la suscripción; cancelación al fin de periodo conserva acceso hasta ese fin si la factura sigue pagada | Portal de prueba, estado actual de Stripe y lectura de Clerk |
| Duplicado o evento retrasado | No sustituir el estado actual por una instantánea antigua | Reenvío del evento y lectura posterior del plan |
| Error de escritura en Clerk | Respuesta 500 y reintento posterior que termina en 200 | Historial de entrega de Stripe y metadatos finales |

Los test clocks permiten avanzar renovaciones sin esperar meses. No introducir excepciones de identidad o firma para simular estos resultados. Una prueba de Billing creada directamente por API no acredita por sí sola el formulario de Checkout o el retorno en el navegador.

## Protecciones de código

- Checkout, portal, retorno y webhook rechazan claves mezcladas entre test/live; Preview y Development rechazan claves live.
- Las URLs de retorno de Preview usan `VERCEL_URL`, aunque exista una variable que apunta a producción.
- El webhook comprueba la firma y que el evento corresponde al modo de la clave; el retorno rechaza sesiones del modo contrario.
- Checkout comprueba que el precio pertenece al modo correcto antes de crear una sesión.

Antes de abrir ventas reales, validar por separado el precio final y el IVA aplicable. No habilitar Stripe Tax sin una inscripción fiscal válida; los resultados del sandbox no acreditan la configuración fiscal live.

## Configuración live contrastada el 8 de octubre de 2026

El endpoint `we_1UNdJGCclSZlOL5qrSi8gEcn` está habilitado en `https://momentumvelo.app/api/webhook`, versión `2026-07-29.dahlia`. Una lectura posterior al cambio confirma los ocho eventos del handler, incluidos `invoice.paid` y `checkout.session.async_payment_failed`. Esto acredita el registro, no una entrega firmada correcta ni el plan guardado en Clerk. Las ventas permanecen cerradas y no se creó ningún pago como parte del cambio.
