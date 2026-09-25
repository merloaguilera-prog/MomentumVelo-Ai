# MomentumVelo-AI

Landing de MomentumVelo-AI con suscripción Premium mensual de 49 € mediante Stripe Checkout.

## Variables de entorno en Vercel

- `STRIPE_SECRET_KEY`: clave secreta de Stripe.
- `STRIPE_PREMIUM_PRICE_ID`: identificador del precio recurrente mensual de 49 €.
- `STRIPE_WEBHOOK_SECRET`: firma del webhook de Stripe.
- `PUBLIC_SITE_URL`: URL pública sin barra final.
- `STRIPE_PAYMENT_LINK_URL` (alternativa): enlace `buy.stripe.com` ya creado.
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`: clave pública del acceso gestionado con Clerk.
- `CLERK_SECRET_KEY`: clave privada de Clerk, solo en el servidor.
- `RESEND_API_KEY`: clave de Resend para enviar las consultas de soporte.
- `SUPPORT_EMAIL_TO`: buzón que recibe las consultas de ayuda y ventas.
- `SUPPORT_EMAIL_FROM`: remitente verificado en Resend.

La portada separa claramente el registro gratuito, el inicio de sesión y Premium. Mientras Premium esté en preparación, la contratación permanece bloqueada mediante `PREMIUM_SALES_ENABLED`. Cuando se abra de forma deliberada y Stripe esté correctamente configurado, la API podrá crear una Checkout Session con retorno verificable; el Payment Link solo actúa como respaldo de configuración.

Cuando Clerk está configurado, el registro, el inicio de sesión, las sesiones y la recuperación por correo son gestionados y multidispositivo. Sin esas variables, se mantiene el acceso local de demostración como respaldo; ese modo solo reconoce la cuenta en el navegador donde fue creada.

Stripe debe enviar los eventos `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded` e `invoice.payment_failed` a `/api/webhook`. El webhook vincula el estado Premium con los metadatos de la cuenta Clerk y conserva un margen de acceso cuando el pago figura temporalmente como `past_due`. El portal de cliente permite cancelar renovaciones y está protegido por la identidad de la cuenta cuando Clerk está activo.

El formulario de `/ayuda` usa Resend. Si el envío todavía no está configurado, ofrece de forma explícita abrir un correo dirigido a `hola@momentumvelo.ai`, sin perder el texto de la consulta.

Antes de abrir la contratación comercial, completar en `legal.html` la razón social o nombre del titular, NIF/CIF, domicilio y datos registrales, y revisar los textos con asesoría jurídica aplicable al país de operación.

## Referencia visual definitiva

La referencia visual aprobada para MomentumVelo es el mockup neón generado el 19/09/2026 (gen_id: da53f8c5-29fa-4cd6-a361-eb90251f4e9c). Mantener esta dirección visual: fondo oscuro, cian/verde neón, CTA Premium destacado, panel Premium a 49 €/mes, portátil con gráficos y tarjetas limpias. No sustituir esta referencia por otro diseño sin aprobación explícita.
