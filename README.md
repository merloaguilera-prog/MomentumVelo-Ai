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

La portada separa el registro gratuito, el inicio de sesión y Premium. La API rechaza el checkout mientras `PREMIUM_SALES_ENABLED` no sea `true`; incluso al habilitarlo exige Clerk, Stripe, el secreto del webhook y verifica que el ID de precio configurado esté activo y sea de 49 € cada mes en EUR. El botón de la cuenta gestionada solo abre Checkout cuando la venta está habilitada. No existe respaldo mediante Payment Link, porque ese enlace no garantiza la vinculación del pago a la cuenta.

Cuando Clerk está configurado, el registro, el inicio de sesión, las sesiones y la recuperación por correo son gestionados y multidispositivo. Sin esas variables, el acceso local es solo una demostración: la cuenta queda en el navegador donde fue creada y no tiene recuperación automática. No debe anunciarse como cuenta segura multidispositivo.

Pulse (`/premium`) es una simulación con activos y puntuaciones codificados en `premium.js`; no hay feed ni alertas de mercado en vivo. PayPal no está integrado y los métodos de pago futuros dependerán de la configuración efectiva de Stripe.

Stripe debe enviar `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid` e `invoice.payment_failed` a `/api/webhook`. El webhook verifica la firma y consulta el estado actual de la suscripción, el ID del precio y la última factura antes de actualizar Clerk. Un pago pendiente o una suscripción `past_due` no activa Premium. El portal de cliente requiere la identidad autenticada. Hay que probar alta, pago asíncrono, renovación, impago, cancelación y portal con Stripe y Clerk reales antes de habilitar ventas.

Checkout deja que Stripe muestre los métodos compatibles habilitados en la cuenta. PayPal recurrente y SEPA siguen sin verificar en la cuenta real; no anunciarlos como disponibles. También quedan por verificar los registros fiscales y los impuestos antes de cobrar.

## Comprobación de despliegue antes de abrir Premium

1. En Vercel, confirmar que `momentum-velo.vercel.app` apunta al despliegue de producción de la revisión aprobada en `main`. Comparar el SHA del despliegue con el SHA de `main`; una vista previa `READY` no actualiza por sí sola ese dominio.
2. Abrir `https://momentum-velo.vercel.app/api/auth-config` y comprobar `enabled: true` y `premiumSalesEnabled: false` antes de las pruebas. Si falta `premiumSalesEnabled`, el dominio sigue sirviendo una versión anterior a esta protección. Comprobar en ese mismo dominio el registro y el inicio de sesión con Clerk; verificar allí las variables de producción sin publicar sus valores secretos.
3. En un entorno de prueba de Stripe y Clerk, verificar con una cuenta real del entorno: alta, pago confirmado, pago asíncrono pendiente y confirmado, renovación, impago, cancelación y apertura del portal. Revisar el webhook firmado y el plan en la cuenta Clerk después de cada evento. Confirmar que el precio es 49 EUR al mes y que Checkout vuelve al dominio correcto.
4. Comprobar en producción el titular legal, la fiscalidad, el precio y las condiciones que ve la persona antes del cobro. Mantener `PREMIUM_SALES_ENABLED=false` hasta completar estas comprobaciones y verificar las funciones Premium prometidas; PayPal no debe anunciarse como método disponible.

El formulario de `/ayuda` usa Resend. Si el envío todavía no está configurado, ofrece de forma explícita abrir un correo dirigido a `hola@momentumvelo.ai`, sin perder el texto de la consulta.

Antes de abrir la contratación comercial, completar en `legal.html` la razón social o nombre del titular, NIF/CIF, domicilio y datos registrales, y revisar los textos con asesoría jurídica aplicable al país de operación.

## Referencia visual definitiva

La referencia visual aprobada para MomentumVelo es el mockup neón generado el 19/09/2026 (gen_id: da53f8c5-29fa-4cd6-a361-eb90251f4e9c). Mantener esta dirección visual: fondo oscuro, cian/verde neón, CTA Premium destacado, panel Premium a 49 €/mes, portátil con gráficos y tarjetas limpias. No sustituir esta referencia por otro diseño sin aprobación explícita.
