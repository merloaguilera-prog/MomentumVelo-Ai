# MomentumVelo-AI

Landing de MomentumVelo-AI con suscripción Premium mensual de 49 € mediante Stripe Checkout.

## Variables de entorno en Vercel

- `STRIPE_SECRET_KEY`: clave del servidor de Stripe, idealmente restringida a las operaciones necesarias.
- `STRIPE_PREMIUM_PRICE_ID`: identificador del precio recurrente mensual de 49 €.
- `STRIPE_WEBHOOK_SECRET`: firma del webhook de Stripe.
- `PREMIUM_SALES_ENABLED`: mantener en `false` hasta verificar producto, cobros y textos legales; activar con `true` para abrir Checkout.
- `PUBLIC_SITE_URL`: URL pública sin barra final.
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`: clave pública del acceso gestionado con Clerk.
- `CLERK_SECRET_KEY`: clave privada de Clerk, solo en el servidor.
- `RESEND_API_KEY`: clave de Resend para enviar las consultas de soporte.
- `SUPPORT_EMAIL_TO`: buzón que recibe las consultas de ayuda y ventas.
- `SUPPORT_EMAIL_FROM`: remitente verificado en Resend.

La portada separa el registro gratuito, el inicio de sesión y Premium. Mientras Premium esté en preparación, la contratación permanece bloqueada mediante `PREMIUM_SALES_ENABLED`. Para abrirla se necesitan Clerk, Stripe, un precio activo de 49 €/mes y el webhook firmado. El botón Premium de la cuenta autenticada abre Checkout cuando la venta está habilitada. Sin alguna de estas piezas, la API rechaza el cobro; no existe un enlace de pago alternativo que pierda la vinculación con la cuenta.

Cuando Clerk está configurado, el registro, el inicio de sesión, las sesiones y la recuperación por correo son gestionados y multidispositivo. Sin esas variables, se mantiene el acceso local de demostración como respaldo; ese modo solo reconoce la cuenta en el navegador donde fue creada.

Stripe debe enviar `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid` e `invoice.payment_failed` a `/api/webhook`. El webhook verifica la firma y consulta el estado actual de la suscripción antes de actualizar Clerk. Un Checkout con pago pendiente o una suscripción `past_due` no activa Premium. El portal de cliente requiere siempre la identidad autenticada. Probar alta, pago asíncrono, renovación, impago, cancelación y gestión de métodos en el entorno de pruebas antes de habilitar ventas.

Checkout deja que Stripe muestre los métodos compatibles habilitados en la cuenta. SEPA puede servir para la domiciliación de suscripciones; PayPal recurrente requiere aprobación específica de Stripe. No anunciar ambos como disponibles hasta comprobarlos en la cuenta. Revisar además los registros fiscales y la configuración de impuestos antes de cobrar; activar Stripe Tax sin registros activos no recauda impuestos.

El formulario de `/ayuda` usa Resend. Si el envío todavía no está configurado, ofrece de forma explícita abrir un correo dirigido a `hola@momentumvelo.ai`, sin perder el texto de la consulta.

Antes de abrir la contratación comercial, completar en `legal.html` la razón social o nombre del titular, NIF/CIF, domicilio y datos registrales, y revisar los textos con asesoría jurídica aplicable al país de operación.

## Referencia visual definitiva

La referencia visual aprobada para MomentumVelo es el mockup neón generado el 19/09/2026 (gen_id: da53f8c5-29fa-4cd6-a361-eb90251f4e9c). Mantener esta dirección visual: fondo oscuro, cian/verde neón, CTA Premium destacado, panel Premium a 49 €/mes, portátil con gráficos y tarjetas limpias. No sustituir esta referencia por otro diseño sin aprobación explícita.
