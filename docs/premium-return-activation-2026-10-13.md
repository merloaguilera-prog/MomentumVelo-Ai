# Pago confirmado y acceso activado — 13/10/2026

## Fallo reproducible

El retorno `GET /api/subscription` respondía `active: true` al verificar el pago, precio y suscripción en Stripe, sin comprobar que el webhook hubiera guardado el plan Premium en Clerk. Una entrega retrasada o un fallo de escritura podía dejar la cuenta gratuita mientras la página de retorno indicaba una suscripción activa.

## Corrección

Después de validar propietario, modo test/live, sesión, cliente, precio mensual de 49 EUR, estado activo y factura pagada, el retorno lee el usuario en Clerk. Exige plan `premium`, estado `active` y los mismos identificadores privados de cliente y suscripción. No escribe metadatos ni sustituye el webhook.

Si el pago está confirmado pero el plan todavía no está guardado, devuelve HTTP 202 con `active: false`, `pending: true` y `paymentConfirmed: true`. La pantalla distingue activación pendiente de pago pendiente, permite reintentar y ofrece la gestión de la suscripción pagada. La respuesta pendiente no entrega enlaces de acceso Premium. Un error de lectura mantiene el acceso sin confirmar; una cuenta o suscripción diferente no sirve como activación.

## Verificación y límites

- 93 pruebas del proyecto superadas; 19 pruebas enfocadas del ciclo Premium superadas tras actualizar los casos de pantalla.
- Pruebas de pago confirmado sin activación, activación posterior, fallo de lectura, identidad distinta y coincidencia exacta de metadatos. El retorno no realiza escrituras.
- Comprobaciones de sintaxis y diferencias sin errores.
- Referencia oficial consultada mediante Stripe CLI 1.53.1: https://docs.stripe.com/billing/subscriptions/webhooks
- La conexión Stripe disponible sigue siendo exclusivamente live para MomentumVelo Ai. No se han creado pagos ni modificado ventas, claves, precio o webhook.
- La prueba completa con Stripe y Clerk de pruebas y la revisión desplegada siguen pendientes. Vercel mantiene el límite diario de despliegues; esta corrección de código no acredita publicación ni un pago real completado.
