# Preparación Android — 15 de octubre de 2026

## Completado

- AAB de `app.momentumvelo`, versión 1.0.0 (código 1), firmado con una clave de subida exclusiva de MomentumVelo. Entrada compilada del commit `a390e035e51c2d4d73e0edca1d7061d56d1b376c`; SHA-256 del AAB sin firmar: `96c8701659502721c7bd6fb137fa44ab585606626c52fd07367a5fd74e3a865d`.
- Clave RSA de 3072 bits y almacén PKCS12 cifrado respaldados de forma privada, con contraseña conservada en un archivo separado. Ningún secreto incorporado al repositorio o a la entrega para revisores.
- Firma del AAB comprobada con `jarsigner`; estructura validada con `bundletool` 1.18.3. APK universal de distribución generada desde ese AAB, sin certificado de depuración.
- Android mínimo API 24, objetivo API 36; `debuggable=false`. Sin bibliotecas nativas `.so` en el AAB.
- Firma reproducible mediante `android/sign-release.py`. Contraseña incorrecta no produce un AAB de entrega; una entrada ya firmada y la sobrescritura de la clave existente se rechazan.
- Digital Asset Links para la APK de pruebas firmada con el certificado de subida. Falta la huella de **Play App Signing** para verificar la versión distribuida por Google.
- 131 pruebas de la web y comprobación de sintaxis JavaScript correctas.

## Comprobaciones y bloqueos reales

- Vercel: producción `READY`; `momentumvelo.app` tiene DNS correcto (`misconfigured=false`, sin conflictos).
- Clerk: la aplicación existente sigue administrada por Vercel Marketplace. Un intento de cambiar Production domain a `momentumvelo.app`, con plan Hobby y sin complementos, devuelve `Configuration update failed. Name is invalid. should be the same domain as the proxy_url`. El dominio antiguo responde HTTP 200 en environment y el definitivo mantiene HTTP 400 `host_invalid`. El registro en el dominio definitivo sigue sin validar. La incidencia de soporte enviada el 13/10 continúa siendo la referencia; no se envió otra solicitud.
- La política de privacidad publicada sigue siendo provisional: faltan datos definitivos del responsable y un contacto operativo comprobado. El nuevo flujo de eliminación está implementado en `/eliminar-cuenta`, enlazado desde Mi cuenta y Ayuda, con confirmación de identidad, baja de facturación vinculada y borrado local independiente. Falta probar el circuito real con Clerk y un cliente de sandbox. El formulario de soporte general no sustituye esa prueba ni la gestión de los mensajes de soporte previos. Véase `android/account-deletion-readiness-2026-10-15.md`.
- No hay una prueba real de alta, verificación, acceso, persistencia y cierre de cuenta en `momentumvelo.app`; no se ha ejecutado una eliminación real.
- Premium conserva el precio previsto de 49 €/mes y las ventas desactivadas. No habilitar una compra digital por Stripe dentro de la app de Play sin integrar Play Billing o un programa alternativo autorizado.
- No se ha validado la entrega en un dispositivo físico ni generado capturas reales de la app para la ficha.
- Play Console: falta cargar el paquete, activar Play App Signing, obtener su certificado público, completar las declaraciones de datos y funciones financieras y verificar el estado de la cuenta. Para una cuenta personal nueva, realizar la prueba cerrada aplicable de 12 personas durante 14 días continuados y solicitar acceso a producción.

## Entrega

La entrega de pruebas firmada incluye el AAB, una APK instalable, el certificado **público** de subida, la ficha española y un informe de verificación. La clave privada y su contraseña están en respaldos separados y no deben adjuntarse a una revisión de Google Play.

El AAB firmado es un avance de preparación y pruebas. No acredita publicación, aprobación de Google ni que los bloqueos anteriores estén corregidos.

## Referencias oficiales

- https://developer.android.com/studio/publish/app-signing
- https://developer.android.com/tools/bundletool
- https://developer.chrome.com/docs/android/trusted-web-activity/quick-start
- https://support.google.com/googleplay/android-developer/answer/14151465?hl=es
- https://support.google.com/googleplay/android-developer/answer/13327111?hl=es
- https://support.google.com/googleplay/android-developer/answer/9858738?hl=es
- https://clerk.com/docs/guides/development/integrations/platforms/vercel-marketplace
