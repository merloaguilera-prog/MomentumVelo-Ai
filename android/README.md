# MomentumVelo para Android

Proyecto Android real generado con Bubblewrap Core 1.27.0. Identificador registrado en Play Console el 22/11/2026: `app.momentumvelo`; versión 1.0.0; mínimo Android 7 (API 24); objetivo Android 16 (API 36). Abre `https://momentumvelo.app/mercados?source=android` mediante Trusted Web Activity y conserva el navegador seguro para la web y sus datos locales.

## Icono elegido — 22/11/2026

El icono confirmado por la titular muestra la flecha ascendente, velas neón y el nombre MomentumVelo. `icons/icon-512.png` y `android/store_icon.png` conservan el PNG original de 512 × 512 sin redibujarlo. Su SHA-256 es `5c55697aaaabbebebb1e185d43bb5e1791ff210b225d1aa29f1aeb5721bb714b`.

Los recursos de lanzador, icono adaptativo y presentación inicial se han regenerado con Bubblewrap Core 1.27.0 desde ese original. La versión web de 192 px usa el recurso de lanzador de esa medida. El generador conserva la corrección revisada del lanzador. El icono también está guardado en el borrador español de Play Store; la creación de la ficha no implica aprobación ni publicación.

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

- La configuración directa de Clerk está activa en momentumvelo.app; aún hay que completar registro, entrada, recuperación y salida con una cuenta y comprobarlos desde Android.
- Generar y verificar la entrega firmada, configurar Play App Signing y verificar Digital Asset Links con el certificado real de Google y en un dispositivo real.
- Revisar Premium para Google Play: el Checkout web de Stripe no acredita Google Play Billing ni la inscripción en un programa alternativo. Las ventas actuales siguen desactivadas; no habilitarlas en una app de Play sin completar esa integración o separar una versión de consumo sin compras ni enlaces prohibidos.
- Completar y revisar la privacidad, el responsable, el canal de contacto real, la eliminación de cuentas y las declaraciones de seguridad de datos y funciones financieras. El texto legal actual sigue siendo provisional.
- Verificar el estado de la cuenta personal de Play Console, realizar la prueba cerrada de 12 personas durante 14 días y solicitar acceso a producción.

Los gráficos no ejecutan operaciones ni garantizan movimientos futuros. El radar de criptomonedas funciona con la app abierta y conexión; los históricos importados se analizan localmente. El paquete no añade avisos en segundo plano ni sincronización por cuenta.

## Revisión técnica de publicación — 22/11/2026

El lanzador de Android tolera únicamente la `IllegalArgumentException` originada en `ManageDataLauncherActivity.addSiteSettingsShortcut`, una operación opcional de Android Browser Helper 2.7.4 que ocurre después de abrir el navegador. Las demás excepciones de arranque se propagan. Esto reduce un riesgo conocido de cierre; no acredita que MomentumVelo haya fallado o se haya probado en un teléfono físico.

`python3 android/test-launcher.py` compila el lanzador real con un JDK y cuatro escenarios controlados: arranque normal, rechazo del acceso directo opcional, error de configuración ajeno y otra clase de excepción. Son fixtures de Java, no una emulación de Android. `generate.cjs` conserva el lanzador revisado al regenerar recursos.

El trabajo `android-checks` de GitHub compila APK de depuración y AAB sin firmar con SDK 36, ejecuta Android Lint y conserva los resultados durante siete días. Son artefactos de revisión: no subir la APK debug ni el AAB sin firmar como versión pública. La numeración y la firma se cerrarán después de comprobar la versión ya registrada en Play Console. No se han creado ni cambiado claves de firma.

Antes de distribuir, instalar el paquete firmado en un móvil, probar apertura repetida y navegación con y sin conexión, y comprobar el certificado de Play en Digital Asset Links. La compilación y los fixtures no sustituyen estos recorridos.

## Prueba automática de arranque nativo

El trabajo `android-launch` instala la APK de ese mismo flujo en un emulador desechable Android 16 (API 36, x86_64), abre el lanzador tres veces y comprueba que Android confirma el inicio, que Chrome recibe el control y que no se registra un cierre o ANR de MomentumVelo. Usa el intent `MAIN/LAUNCHER` con `NEW_TASK` y `RESET_TASK_IF_NEEDED`, como una pulsación en el icono; entre aperturas vuelve a Inicio y detiene únicamente MomentumVelo. Guarda un informe JSON, registros y capturas del emulador durante siete días. El script rechaza dispositivos físicos y requiere una única instancia de emulador.

Esta comprobación verifica el arranque nativo y el paso al navegador. No introduce cuentas, no pulsa acuerdos de Chrome ni inicia sesión. El informe distingue el asistente inicial del navegador; un traspaso correcto no acredita que se hayan cargado los gráficos, el acceso de Clerk o la firma de Google Play.

## Fuentes oficiales consultadas el 14/10/2026

- https://developer.chrome.com/docs/android/trusted-web-activity/quick-start
- https://support.google.com/googleplay/android-developer/answer/11926878
- https://support.google.com/googleplay/android-developer/answer/14151465
- https://support.google.com/googleplay/android-developer/answer/9858738
- https://support.google.com/googleplay/android-developer/answer/10281818
