# MomentumVelo para Android

Proyecto Android real generado con Bubblewrap Core 1.27.0. Identificador previsto: `app.momentumvelo`; versión 1.0.0; mínimo Android 7 (API 24); objetivo Android 16 (API 36). Abre `https://momentumvelo.app/mercados?source=android` mediante Trusted Web Activity y conserva el navegador seguro para la web y sus datos locales.

## Compilación

Requiere JDK 17, Android SDK 36 y Build Tools 35.0.0 (seleccionado por Android Gradle Plugin 8.9.1). Configurar la ruta local del SDK en `local.properties`, que no se incorpora al repositorio.

```bash
./gradlew --no-daemon assembleDebug bundleRelease
```

`app/build/outputs/apk/debug/app-debug.apk` es una APK de pruebas. `app/build/outputs/bundle/release/app-release.aab` es el AAB sin firmar. El paso siguiente lo convierte en el AAB firmado que se sube a Play Console. No usar la clave de depuración como clave de producción.

## Firma de subida

Requiere un JDK completo con `keytool` y `jarsigner`, además de Python 3. La clave pertenece exclusivamente a `app.momentumvelo`: no reutilizar las claves de Dietear ni Yuma.

Para crearla **una sola vez**, desde la raíz del repositorio:

```bash
python3 android/create-upload-key.py --directory android/private
```

La herramienta genera una clave RSA de 3072 bits en un almacén PKCS12 cifrado y una contraseña aleatoria en un archivo separado, con permisos privados. Rechaza sobrescribir archivos existentes y no imprime la contraseña. Guardar una copia privada duradera del almacén y de la contraseña antes de usar la clave; mantenerlos separados y fuera de GitHub, las entregas públicas y las capturas.

```bash
python3 android/sign-release.py \
  --bundle android/app/build/outputs/bundle/release/app-release.aab \
  --keystore android/private/momentumvelo-upload.p12 \
  --password-file android/private/store-password.txt \
  --output android/release-output
```

Produce `MomentumVelo-1.0.0-play.aab`, el certificado **público** de subida y un informe con las huellas SHA-256. Comprueba la estructura e integridad del AAB, rechaza entradas ya firmadas y verifica la firma antes de generar la entrega. Un fallo no se presenta como una firma correcta.

El proyecto no incluye claves privadas, contraseñas ni credenciales de Google Play. Con Play App Signing, usar la huella SHA-256 del **certificado de firma de la app** que Google indica para `.well-known/assetlinks.json`, además de cualquier certificado autorizado de pruebas. No confundirla con el certificado de subida.

`.well-known/assetlinks.json` autoriza el certificado de subida/pruebas cuyo respaldo privado se conserva fuera del repositorio. Esto permite verificar las APK instaladas directamente con esa firma. Cuando Google genere el certificado de firma de la app, añadir también su huella SHA-256 a la lista, comprobar que la URL pública devuelve HTTP 200 con JSON y probar la versión descargada de Play. La firma de subida por sí sola no verifica la versión distribuida por Google.

Hasta completar esa asociación, la app de Play puede abrirse con la barra segura de Custom Tabs. No se anuncia verificación de pantalla completa, ejecución en un móvil real ni publicación en Google Play.

## Bloqueos antes del envío público

- Acceso seguro definitivo en momentumvelo.app y registro real: incidencia de dominio/proxy de Clerk pendiente; conservar la aplicación y sus usuarios al corregirla.
- Generar y verificar la entrega firmada, configurar Play App Signing y verificar Digital Asset Links con el certificado real de Google y en un dispositivo real.
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
