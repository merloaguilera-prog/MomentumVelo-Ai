# MomentumVelo-AI

Landing de MomentumVelo-AI con suscripción Premium mensual de 49 € mediante Stripe Checkout.

## Variables de entorno en Vercel

- `STRIPE_SECRET_KEY`: clave secreta de Stripe.
- `STRIPE_PREMIUM_PRICE_ID`: identificador del precio recurrente mensual de 49 €.
- `STRIPE_WEBHOOK_SECRET`: firma del webhook de Stripe.
- `PUBLIC_SITE_URL`: URL pública sin barra final.
- `TELEGRAM_PREMIUM_INVITE_URL`: enlace privado de invitación al canal Premium.
- `STRIPE_PAYMENT_LINK_URL` (alternativa): enlace `buy.stripe.com` ya creado.

El botón superior lleva a la tarjeta Premium central; el botón de esa tarjeta abre Stripe, verifica el pago y permite gestionar o cancelar la suscripción.
