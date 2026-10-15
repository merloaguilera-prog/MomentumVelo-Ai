# Canal de ayuda y privacidad — 15 de octubre de 2026

El proyecto no tenía RESEND_API_KEY, SUPPORT_EMAIL_TO ni SUPPORT_EMAIL_FROM configurados al consultar los metadatos, sin descifrar valores. La dirección provisional mostrada en Ayuda y Legal no estaba verificada.

## Cambio

- Retirada la dirección provisional de las pantallas públicas y de las respuestas de la API.
- GET /api/contact expone únicamente la disponibilidad por configuración, con no-store; no hace envíos ni revela el destinatario privado.
- La interfaz comprueba disponibilidad antes de habilitar el envío, mantiene el texto ante errores y permite guardar un borrador local sin enviarlo.
- Una respuesta HTTP correcta exige una referencia válida antes de confirmar aceptación. La referencia acredita aceptación por el proveedor, no entrega en bandeja de entrada ni respuesta humana.
- Peticiones desde otros orígenes, contenido distinto de JSON y consultas sin consentimiento o fuera de los límites se rechazan. Los señuelos de spam no devuelven una confirmación de recepción.
- Tiempo de espera acotado en servidor y navegador; los reintentos idénticos mantienen la clave de idempotencia.
- Se evita insertar errores como HTML y se conservan los cambios escritos durante una petición.
- Comprobaciones de sintaxis y pruebas automáticas de la web en GitHub, sin secretos ni despliegues desde el workflow. Acciones oficiales fijadas a commits de sus versiones publicadas.

## Activación pendiente

Configurar un remitente verificado en Resend y las tres variables anteriores. SUPPORT_EMAIL_TO es un destinatario privado: no se publica como correo de contacto ni se usa como alternativa mailto. Comprobar una entrega real autorizada antes de declarar el canal operativo. El precio Premium y su cierre de ventas no se modifican.

Completar también los datos definitivos del responsable y los plazos de conservación en la política. El soporte operativo, la reparación de Clerk y la verificación de Play Console siguen siendo requisitos pendientes de publicación.

## Fuentes

- https://resend.com/docs/api-reference/emails/send-email
- https://support.google.com/googleplay/android-developer/answer/10144311?hl=es
