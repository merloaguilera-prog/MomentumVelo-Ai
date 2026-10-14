# MomentumVelo para Android

Proyecto Android real generado con Bubblewrap Core 1.27.0. Identificador previsto: `app.momentumvelo`; versión 1.0.0; mínimo Android 7 (API 24); objetivo Android 16 (API 36). Abre `https://momentumvelo.app/mercados?source=android` mediante Trusted Web Activity y conserva el navegador seguro para la web y sus datos locales.

## Compilación

Requiere JDK 17, Android SDK 36 y Build Tools 35.0.0 (seleccionado por Android Gradle Plugin 8.9.1). Configurar la ruta local del SDK en `local.properties`, que no se incorpora al repositorio.

```bash
./gradlew --no-daemon assembleDebug bundleRelease
```

`app/build/outputs/apk/debug/app-debug.apk` es una APK de pruebas. `app/build/outputs/bundle/release/app-release.aab` es un AAB de preparación sin firma de publicación. No usar la clave de depuración como clave de producción.

El proyecto no incluye claves privadas, contraseñas ni credenciales de Google Play. La clave de subida definitiva debe conservarse de forma privada y el AAB debe firmarse antes de cargarlo en Play Console. Con Play App Signing, usar la huella SHA-256 del **certificado de firma de la app** que Google indica para `.well-known/assetlinks.json`, además de cualquier certificado autorizado de pruebas. No confundirla con el certificado de subida.

Hasta publicar los Digital Asset Links correctos, la app puede abrirse con la barra segura de Custom Tabs. No se anuncia verificación de pantalla completa, ejecución en un móvil real ni publicación en Google Play.

## Bloqueos antes del envío público

- Acceso seguro definitivo en momentumvelo.app y registro real: incidencia de Clerk pendiente. No se reconecta ni se recrea la instancia durante la preparación Android.
- Firmar el AAB, configurar Play App Signing y verificar Digital Asset Links en un dispositivo real.
- Revisar Premium para Google Play: el Checkout web de Stripe no acredita Google Play Billing ni la inscripción en un programa alternativo. Las ventas actuales siguen desactivadas; no habilitarlas en una app de Play sin completar esa integración o separar una versión de consumo sin compras ni enlaces prohibidos.
- Completar y revisar la privacidad, el responsable, el canal de contacto real, la eliminación de cuentas y las declaraciones de seguridad de datos y funciones financieras. El texto legal actual sigue siendo provisional.
- Verificar el estado de la cuenta personal de Play Console, realizar la prueba cerrada de 12 personas durante 14 días y solicitar acceso a producción.

Los gráficos no ejecutan operaciones ni garantizan movimientos futuros. El radar de criptomonedas funciona con la app abierta y conexión; los históricos importados se analizan localmente. El paquete no añade avisos en segundo plano ni sincronización por cuenta.

## Fuentes oficiales consultadas el 14/10/2026

- https://developer.chrome.com/docs/android/trusted-web-activity/quick-start
- https://support.google.com/googleplay/android-developer/answer/11926878
- https://support.google.com/googleplay/android-developer/answer/14151465
- https://support.google.com/googleplay/android-developer/answer/9858738
- https://support.google.com/googleplay/android-developer/answer/10281818
