# MomentumVelo-AI

Landing de MomentumVelo-AI con suscripción Premium mensual de 49 € mediante Stripe Checkout.

## Variables de entorno en Vercel

- `STRIPE_SECRET_KEY`: clave secreta de Stripe.
- `STRIPE_PREMIUM_PRICE_ID`: identificador del precio recurrente mensual de 49 €.
- `STRIPE_WEBHOOK_SECRET`: firma del webhook de Stripe.
- `PUBLIC_SITE_URL`: URL pública sin barra final.
- `TELEGRAM_PREMIUM_INVITE_URL`: enlace privado de invitación al canal Premium.
- `STRIPE_PAYMENT_LINK_URL` (alternativa): enlace `buy.stripe.com` ya creado.

La portada separa claramente el registro gratuito, el inicio de sesión y Premium. El pago se abre solo después de crear o recuperar la cuenta. Si Stripe y el precio están configurados, la API crea una Checkout Session con retorno verificable; el Payment Link queda como respaldo para que el botón no se rompa si falta una variable.

La cuenta de esta primera versión se guarda únicamente en el navegador del usuario. Antes de ofrecer acceso multidispositivo o recuperación real por correo/móvil hay que conectar un proveedor de identidad y almacenamiento de cuentas.

## Referencia visual definitiva

La referencia visual aprobada para MomentumVelo es el mockup neón generado el 19/09/2026 (gen_id: da53f8c5-29fa-4cd6-a361-eb90251f4e9c). Mantener esta dirección visual: fondo oscuro, cian/verde neón, CTA Premium destacado, panel Premium a 49 €/mes, portátil con gráficos y tarjetas limpias. No sustituir esta referencia por otro diseño sin aprobación explícita.
