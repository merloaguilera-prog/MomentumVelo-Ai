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

El acceso local solo se habilita cuando `/api/auth-config` confirma que no están configuradas **ninguna** de las dos claves de Clerk. Una configuración parcial, un error de red o un fallo del SDK bloquea el registro local y muestra opciones de reintento y ayuda. Las cuentas locales antiguas tampoco cambian el encabezado de una instalación con Clerk.

## Conexión de Clerk a momentumvelo.app

Los bundles de Clerk y sus llamadas de sesión pasan por `/__clerk`. El script del SDK recibe `data-clerk-proxy-url="https://momentumvelo.app/__clerk"` **antes** de crear su instancia; `Clerk.load()` recibe las opciones de interfaz.

En una instancia de producción, el proxy también debe estar habilitado en el dominio de esa misma instancia en Clerk, con `proxy_url` igual a `https://momentumvelo.app/__clerk`. Configurar solo `NEXT_PUBLIC_CLERK_PROXY_URL` en Vercel no habilita ese ajuste en Clerk. Verificar que las claves pública y secreta pertenecen a la misma instancia. Ver la [guía oficial del proxy](https://clerk.com/docs/guides/dashboard/dns-domains/proxy-fapi) y la [inicialización JavaScript](https://clerk.com/docs/js-frontend/getting-started/quickstart).

Los bundles con HTTP 200 no prueban que las sesiones estén conectadas. Antes de aprobar el acceso, comprobar las llamadas `/__clerk/v1/environment` y `/__clerk/v1/client` del navegador, registro con verificación, inicio y cierre de sesión y recuperación por correo. `400 host_invalid` sigue siendo un bloqueo de la conexión; no debe marcarse como resuelto ni sustituirse por una cuenta local.

Pulse (`/premium`) es una simulación con activos y puntuaciones codificados en `premium.js`; no hay feed ni alertas de mercado en vivo. PayPal no está integrado y los métodos de pago futuros dependerán de la configuración efectiva de Stripe.

Stripe debe enviar los eventos `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded` e `invoice.payment_failed` a `/api/webhook`. El webhook vincula el estado Premium con los metadatos de la cuenta Clerk y conserva un margen de acceso cuando el pago figura temporalmente como `past_due`. El portal de cliente permite cancelar renovaciones y está protegido por la identidad de la cuenta cuando Clerk está activo.

El formulario de `/ayuda` usa Resend. Si el envío todavía no está configurado, ofrece de forma explícita abrir un correo dirigido a `hola@momentumvelo.ai`, sin perder el texto de la consulta.

Antes de abrir la contratación comercial, completar en `legal.html` la razón social o nombre del titular, NIF/CIF, domicilio y datos registrales, y revisar los textos con asesoría jurídica aplicable al país de operación.

## Referencia visual definitiva

La referencia visual aprobada para MomentumVelo es el mockup neón generado el 19/09/2026 (gen_id: da53f8c5-29fa-4cd6-a361-eb90251f4e9c). Mantener esta dirección visual: fondo oscuro, cian/verde neón, CTA Premium destacado, panel Premium a 49 €/mes, portátil con gráficos y tarjetas limpias. No sustituir esta referencia por otro diseño sin aprobación explícita.
