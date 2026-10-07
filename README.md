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

Stripe debe enviar los eventos `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded` e `invoice.payment_failed` a `/api/webhook`. También se admiten `invoice.paid` y `checkout.session.async_payment_failed` si se habilitan en el endpoint. El webhook vuelve a consultar la suscripción actual y solo concede Premium con el precio configurado de 49 EUR/mes, estado `active` y última factura `paid`. Una sesión `unpaid` no activa Premium; `past_due` y la cancelación retiran el acceso. Los fallos de escritura en Clerk producen HTTP 500 para permitir reintentos. El retorno exige la misma cuenta, cliente y suscripción, y muestra los pagos pendientes con un botón para volver a comprobar. El portal de cliente permite cancelar renovaciones y está protegido por la identidad de la cuenta.

Para Production, fijar `PUBLIC_SITE_URL=https://momentumvelo.app` y `PREMIUM_SALES_ENABLED=false`. Configurar el secreto del webhook live existente no abre las ventas. Validar la entrega firmada y la actualización real del plan en Clerk antes de habilitar la contratación. Los secretos de Production deben permanecer separados de los de Preview/sandbox; no copiar claves live a los tests.

El formulario de `/ayuda` usa Resend. Si el envío todavía no está configurado, ofrece de forma explícita abrir un correo dirigido a `hola@momentumvelo.ai`, sin perder el texto de la consulta.

Antes de abrir la contratación comercial, completar en `legal.html` la razón social o nombre del titular, NIF/CIF, domicilio y datos registrales, y revisar los textos con asesoría jurídica aplicable al país de operación.

## Validación en un entorno de pruebas

La [guía de pruebas de Premium](docs/premium-sandbox.md) separa la preparación, las comprobaciones locales y la evidencia exigida a Stripe/Clerk reales. `npm run billing:preflight` solo hace lecturas con claves test: no crea pagos ni acredita el webhook o el plan de la cuenta. Preview y Development rechazan claves live y combinaciones Stripe/Clerk de distinto modo. Los retornos de Preview permanecen en esa Preview. La contratación live continúa cerrada.

## Referencia visual definitiva

La referencia visual aprobada para MomentumVelo es el mockup neón generado el 19/09/2026 (gen_id: da53f8c5-29fa-4cd6-a361-eb90251f4e9c). Mantener esta dirección visual: fondo oscuro, cian/verde neón, CTA Premium destacado, panel Premium a 49 €/mes, portátil con gráficos y tarjetas limpias. No sustituir esta referencia por otro diseño sin aprobación explícita.
