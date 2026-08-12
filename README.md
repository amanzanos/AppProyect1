# Blopy

Ocho minijuegos para el móvil. Partidas de un minuto, un dedo, sin cuentas y
sin registro: se abre y se juega.

**Solo** — topos, Simón, el diferente y dardos. Se explican solos y el progreso
son tres estrellas por juego.

**En grupo, hasta 8** — tenis, dardos, bolos, quiz y karaoke, con la partida en
una pantalla grande (una tele, un portátil, un proyector) y un móvil de mando
por jugador. Un único QR para toda la sala: quien lo escanea coge el asiento
libre que quede.

Sale de la zona de juegos de una app privada de pareja, extraída y desacoplada
para poder publicarse por su cuenta.

---

## Cómo funciona

La pantalla crea una sala con un código de cuatro letras y enseña **un QR para
todos**. Cada móvil que lo escanea coge el asiento libre más bajo, en una
transacción, y se convierte en el mando de ese jugador.

Que sea una transacción no es paranoia: en una habitación con gente, dos
personas escaneando a la vez es lo normal, y un leer-y-escribir suelto les daría
el asiento 1 a las dos. Y el nombre lo pone cada uno en su móvil, porque con un
solo QR la pantalla no sabe quién va a entrar — y pasar un mando de tele entre
ocho personas para teclear no es una fiesta.

El canal es Firestore, con **un documento por jugador**. Esto no es un detalle:
Firestore aguanta más o menos una escritura por segundo y documento, y con
varios móviles escribiendo en el mismo, los movimientos llegaban a la pantalla
segundos tarde. Con un documento cada uno nadie bloquea a nadie — y es lo que
permite pasar de dos, porque el camino de escritura no se congestiona según
entra gente.

Los récords **no** están en Firestore, están en el dispositivo. La versión de la
que sale esto escribía todas las partidas a un documento por juego, lo cual es
correcto cuando los usuarios son dos personas y desastroso cuando son
desconocidos: todo el mundo sobrescribiría la misma fila. Los récords son de la
consola donde se juega, como una máquina recreativa. De paso, una partida cuesta
cero lecturas y cero escrituras.

Un récord es un número y un nombre, no una tabla por asiento: los asientos se
reparten por orden de escaneo, así que "el asiento 3" es una persona distinta
cada noche.

## Karaoke

El único juego que necesita el micrófono, y el reparto de trabajo es la parte
interesante: **todo lo de la voz pasa en el móvil del que canta y se queda
ahí** — micrófono, detección de tono y puntuación. A la pantalla solo va el
marcador, una vez por línea. No es un atajo: el tono hay que muestrearlo veinte
veces por segundo y Firestore admite una escritura por segundo, así que un
diseño donde puntuara la tele no podría existir.

La detección es por autocorrelación, no por FFT: una vocal cantada es un montón
de armónicos, y el pico más alto de su espectro es muchas veces un armónico y no
el fundamental — que es justo por qué los detectores ingenuos cantan una octava
de más precisamente con las voces que sirven para cantar.

Las canciones son **datos**, no grabaciones: una lista de notas que se sintetiza
al vuelo. Es una decisión legal antes que técnica — una pista de acompañamiento
o una letra moderna necesitarían licencias que esta app no va a tener nunca.
Todas son tradicionales o de dominio público.

La afinación se puntúa ignorando la octava: la misma melodía cantada por un bajo
y por un niño está a dos octavas de distancia y las dos están bien.

## Poner en marcha

```bash
npm install
cp .env.example .env.local   # y rellena con tu proyecto de Firebase
npm run dev
```

### Firebase

Solo hace falta para el modo a dos. Los juegos de un jugador no lo tocan, y la
app arranca perfectamente sin él (el lobby a 2 avisa de que no está disponible).

1. **console.firebase.google.com** → *Crear proyecto*. Puedes decir que no a
   Google Analytics, no se usa.
2. **Compilación → Firestore Database → Crear**. Modo producción, y como región
   `eur3 (europe-west)` si estás en España — es la más cercana y baja la latencia
   entre el móvil y la pantalla, que aquí se nota.
3. **Compilación → Authentication → Comenzar → Anónimo → Habilitar.** Sin esto
   las reglas de abajo rechazan todo. La app no pide cuenta a nadie: la sesión
   anónima es invisible y solo sirve para que las reglas puedan distinguir a un
   jugador de un desconocido llamando a la API.
4. **Firestore → Reglas**: pega el contenido de `firestore.rules` y publica.
5. **Configuración del proyecto (⚙) → Tus aplicaciones → Web (`</>`)**. Regístrala
   y copia los cinco valores de `firebaseConfig` a tu `.env.local`, y a las
   variables de entorno de Vercel.

El plan gratuito (Spark) sobra de largo: una partida son unas pocas decenas de
escrituras, y los récords ni siquiera pasan por aquí.

Las salas se quedan en la base de datos para siempre. No molestan —son diminutas—
pero si algún día se acumulan, en Firestore → TTL se pone una política sobre el
campo `createdAt` y se borran solas.

Para probar de verdad hace falta la pantalla en un sitio y los móviles en otro,
así que el móvil tiene que poder alcanzar tu servidor de desarrollo — un túnel
(`cloudflared tunnel --url http://localhost:3000`) es lo más rápido. El karaoke
además necesita HTTPS, porque el navegador no da el micrófono sin él; el túnel
ya lo resuelve.

## Anuncios

Todo pasa por `src/lib/ads.ts`. Nada se carga si `NEXT_PUBLIC_ADS_ENABLED` no
vale `1`, así que en desarrollo y en la web no hay anuncios ni política que
cumplir.

Dos huecos, y solo dos:

- **Banner**, abajo, **solo en el menú**. Nunca sobre un tablero.
- **Intersticial**, entre partidas, después de enseñar quién ha ganado. Uno de
  cada tres partidas y como mucho uno cada 90 segundos.

Esos límites están puestos a propósito. Las partidas duran uno o dos minutos: un
anuncio después de cada una, o encima del momento de ganar, es la forma más
rápida de que alguien desinstale un juego de fiesta.

Con `NEXT_PUBLIC_ADMOB_*` sin rellenar se usan las unidades de prueba de Google,
que siempre tienen relleno. Publicar con un ID real sin inventario se ve
exactamente igual que un fallo, así que el respaldo es el que siempre muestra
algo.

Antes de inicializar el SDK, `load()` pasa por el flujo de consentimiento de
Google (UMP): pregunta si hace falta pedirlo según dónde esté el dispositivo
—en España sí— y, si hace falta, muestra el formulario. Ningún anuncio se pide
hasta que eso se resuelve. No hay forma de probar esto de verdad sin un
dispositivo real fuera de este entorno.

## Publicar en Google Play

El .apk es una carcasa fina alrededor del sitio desplegado. Un export estático
permitiría jugar sin conexión, pero estos juegos necesitan Firestore para que la
pantalla y los móviles se hablen — sin red no funcionan de todos modos. Apuntar a
la URL en vivo compra lo que sí importa: corregir una respuesta del quiz o un
bug de física sale en un despliegue, no en una revisión de tienda de varios días.

```bash
npm run build                      # comprueba que la web está sana
npx cap add android                # solo la primera vez
BLOPY_URL=https://tu-dominio npm run android:sync
npm run android:open               # abre Android Studio para firmar y generar el .aab
```

Hace falta Android Studio en tu máquina — esto no se puede hacer desde aquí.

### Lo que ya está hecho

- [x] **Política de privacidad**, en `/privacidad` dentro de la propia app —
      pública en cuanto está desplegada, sin sitio aparte que mantener. La URL
      completa es `https://tu-dominio/privacidad`.
- [x] **Consentimiento GDPR/UMP**, en `src/lib/ads.ts` — se pide antes de
      inicializar el SDK de anuncios, no después.
- [x] **Gráficos de la ficha**: `store/icon-512.png` y
      `store/feature-graphic-1024x500.png`, con la mascota y la paleta de la
      propia app. Sirven para empezar; si quieres otro estilo, es fácil pedir
      una versión distinta.

### Lo que falta, y solo lo puedes hacer tú

- [ ] Cuenta de desarrollador de Google Play (25 $, pago único) — pide una
      tarjeta, no lo puedo hacer por ti.
- [ ] Los pasos de Android Studio de arriba (`cap add android`, firmar, generar
      el `.aab`).
- [ ] **Permiso de micrófono en el manifiesto**, que el karaoke necesita.
      En `android/app/src/main/AndroidManifest.xml`, dentro de `<manifest>`:
      `<uses-permission android:name="android.permission.RECORD_AUDIO"/>`.
      Sin esto el karaoke no puede pedir el micrófono dentro de la app (en el
      navegador sí funciona, que es lo que despista).
- [ ] **Formulario de seguridad de los datos**, en la propia consola de Play.
      Con lo que hay implementado, las respuestas correctas son: se recoge el
      *identificador de publicidad* (por AdMob), no se recoge ningún otro dato
      personal, los datos no se comparten con terceros más allá del propio
      AdMob, y no hay cifrado en tránsito que declarar porque no viaja ningún
      dato propio del usuario.
      **El micrófono del karaoke no se declara como dato recogido**: el audio
      se analiza en el dispositivo y nunca se graba, se guarda ni se envía a
      ningún sitio, y Play solo pregunta por lo que sale del teléfono. Si el
      cuestionario pregunta por *grabaciones de voz o sonido*, la respuesta es
      no. Que el permiso esté en el manifiesto y que se recoja un dato son dos
      preguntas distintas.
- [ ] **Clasificación por edades** — el cuestionario de la consola. Responde
      que no hay contenido violento, sexual, ni de apuestas; que hay anuncios;
      y que no se recoge ubicación ni datos de contacto.
- [ ] **Capturas de pantalla** — al menos 2, hasta 8, de un móvil real
      corriendo la app. Los gráficos de arriba ya cubren el icono y el
      encabezado.

## Estructura

```
src/app/games/            una carpeta por juego
  moles/ simon/ odd/      los de un jugador: una sola pantalla
  darts/solo/             dardos en un dedo
  darts/ tennis/ karaoke/ los de grupo: la pantalla, y /play que es el mando
src/components/games/     tablero, bolera, ruleta, lobby, mando, fin de partida
src/components/tennis/    pista, personaje, pantalla de carga
src/components/SoloOver   el final de una tirada: estrellas, récord, otra vez
src/lib/                  física y reglas, sin nada de React
src/lib/data/             salas de Firestore
src/lib/ads.ts            la única puerta a los anuncios
src/lib/juice.ts          sonido sintetizado, vibración y temblor de pantalla
src/lib/solo.ts           estrellas y récords de un jugador
src/lib/records.ts        récords del modo en grupo
src/lib/karaoke.ts        canciones (dominio público) y puntuación de afinación
src/lib/pitch.ts          detección de tono por autocorrelación
src/lib/players.ts        el aspecto de cada asiento
```
