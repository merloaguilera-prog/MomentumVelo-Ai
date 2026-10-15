# Eliminación de cuenta y datos — 15 de octubre de 2026

## Flujo implementado

`Mi cuenta` o `Ayuda` → `/eliminar-cuenta` → acceso con Clerk → confirmación de correo, texto ELIMINAR y consecuencias → `POST /api/delete-account` → verificación de sesión y facturación → baja del cliente Stripe vinculado, si existe → eliminación de usuario Clerk → limpieza local y cierre de sesión.

La página pública explica el alcance sin instalar la app ni iniciar sesión. El borrado de los datos del navegador se puede utilizar por separado, aunque Clerk no conecte. No se aceptan peticiones de eliminación mediante una visita GET, un enlace con parámetros o el formulario de soporte general.

## Controles

- Identidad obtenida del token verificado por el SDK de Clerk; los identificadores enviados por el cliente no seleccionan la cuenta.
- Sesión existente y activa del mismo usuario; se rechazan sesiones de suplantación. Credenciales verificadas hace menos de 10 minutos según `fva`, incluido segundo factor si está habilitado. La emisión reciente de un token no sustituye esa comprobación.
- Confirmación explícita del correo principal y de la baja definitiva. Petición JSON, origen permitido y respuesta `no-store`.
- Una preview con credenciales Clerk live se rechaza antes de contactar con los proveedores. Para cuentas con cliente Stripe se comprueba la correspondencia de entornos y la asociación privada usuario/cliente, además de toda la paginación de suscripciones y compras abiertas.
- Se bloquean nuevas contrataciones para una cuenta cuya eliminación ya empezó. Se cierran sus enlaces de Checkout abiertos, se elimina exclusivamente el cliente vinculado de la app y solo después se elimina el acceso en Clerk. Stripe documenta que eliminar un cliente cancela sus suscripciones y elimina los datos de tarjeta; conserva su historial para trazabilidad.
- Ante un fallo parcial, la API no devuelve `deleted:true`, la interfaz conserva los datos locales y permite reintentar. Si Stripe ya completó su parte, el reintento termina Clerk sin repetir la baja de facturación. Un reintento con el mismo token aún válido sobre un usuario ya ausente no vuelve a borrar recursos.
- Los eventos de Stripe retrasados no reactivan cuentas marcadas para eliminación o ya ausentes; los fallos transitorios de Clerk siguen siendo reintentables.
- Se limpian únicamente claves `momentumvelo.*` del almacenamiento local y de la pestaña actual. Se informa de su alcance en navegadores compartidos y de que otros dispositivos requieren su propio borrado.

## Validación

- Pruebas automatizadas de identidad, sesión revocada, segundo factor, confirmación, origen, aislamiento de entornos, referencias ajenas, paginación, fallos parciales, reintentos, eventos retrasados y estados de la interfaz.
- Comprobación de sintaxis y revisión de espacios del diff.
- No se crean, eliminan ni cobran cuentas reales para estas pruebas: los SDK están sustituidos por datos de prueba en memoria.

## Sigue pendiente

- Probar el circuito real con una cuenta desechable y autorizada una vez resuelto Clerk, y con un cliente del sandbox para verificar la baja de suscripción. El dominio definitivo mantiene el bloqueo conocido de la integración; el acuse de recibo de soporte no acredita su corrección.
- Completar responsable, canal de contacto operativo, plazos de conservación y gestión de mensajes previos de soporte y obligaciones legales en la política de privacidad. El nuevo flujo no acredita por sí solo el cumplimiento completo ni aprobación de Google.
- Cargar la URL pública de eliminación en Seguridad de los datos de Play Console cuando la cuenta permita crear la app. Las verificaciones personales, la ficha y la prueba de distribución siguen pendientes.
- Premium continúa cerrado al público. Este cambio no habilita ventas ni incorpora Play Billing.

## Fuentes oficiales

- https://support.google.com/googleplay/android-developer/answer/13327111?hl=es
- https://clerk.com/docs/guides/sessions/session-tokens
- https://clerk.com/docs/reference/backend/user/delete-user
- https://docs.stripe.com/api/customers/delete
- https://docs.stripe.com/api/checkout/sessions/expire
