export const metadata = {
  title: "Privacidad — Blopy",
};

/**
 * Required by Google Play the moment an app carries ads: a privacy policy at
 * a public URL, listed in the store entry. Living inside the app itself means
 * it's public the moment the app is deployed — no separate site to host or
 * keep in sync.
 */
export default function PrivacyPage() {
  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-6 py-12 text-white">
      <h1 className="font-heading text-3xl font-black">Política de privacidad de Blopy</h1>
      <p className="mt-2 text-sm text-white/50">Última actualización: agosto de 2026</p>

      <div className="mt-8 flex flex-col gap-6 text-[15px] leading-relaxed text-white/85">
        <section>
          <h2 className="font-heading text-lg font-bold text-white">Resumen</h2>
          <p className="mt-2">
            Blopy no pide cuenta, no pide correo y no guarda ningún dato que identifique a quien
            juega. Los datos que existen son mínimos: un nombre de jugador puesto a mano, que se
            queda en el propio teléfono, y —solo si has aceptado ver anuncios— el identificador de
            publicidad que usa Google para elegir qué anuncio mostrar.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-lg font-bold text-white">Qué se guarda en tu dispositivo</h2>
          <p className="mt-2">
            El nombre y color que eliges para cada jugador, tus mejores puntuaciones y tus
            estrellas se guardan solo en el almacenamiento local del navegador o de la app, en tu
            propio teléfono. Nunca se envían a ningún servidor y desaparecen si borras los datos de
            la aplicación.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-lg font-bold text-white">Modo a dos jugadores</h2>
          <p className="mt-2">
            Cuando juegas en pantalla grande con un móvil de mando, se crea una sala temporal
            identificada por un código de cuatro letras, usando Firebase (Google) para que los
            dispositivos se hablen entre ellos. Esa sala contiene únicamente los movimientos de la
            partida —no un nombre real, ni una foto, ni ningún dato personal— y no se conserva
            pasado el rato de la partida.
          </p>
          <p className="mt-2">
            Para poder crear esa sala, la app inicia una sesión anónima automática con Firebase
            Authentication. Es invisible: no se te pide ningún dato, y esa sesión no está ligada a
            ti fuera de la propia partida.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-lg font-bold text-white">Anuncios</h2>
          <p className="mt-2">
            La versión de Blopy en Google Play puede mostrar anuncios servidos por Google AdMob.
            AdMob puede usar el identificador de publicidad de tu dispositivo para mostrar anuncios
            relevantes, salvo que hayas elegido lo contrario en el cuadro de consentimiento que se
            muestra la primera vez que abres la app si estás en la Unión Europea, el Reino Unido o
            Suiza. Puedes cambiar esa elección en cualquier momento desde los ajustes de anuncios de
            tu dispositivo o desde el propio cuadro de consentimiento.
          </p>
          <p className="mt-2">
            Google explica en su propia política qué recoge y cómo lo usa:{" "}
            <a
              href="https://policies.google.com/technologies/ads"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              policies.google.com/technologies/ads
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="font-heading text-lg font-bold text-white">Lo que no hace Blopy</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>No pide registro ni cuenta.</li>
            <li>No pide ni guarda correo, teléfono, ni ningún dato de contacto.</li>
            <li>No usa cámara, micrófono ni ubicación.</li>
            <li>No vende datos a nadie.</li>
            <li>No está dirigida específicamente a menores de edad.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-heading text-lg font-bold text-white">Contacto</h2>
          <p className="mt-2">
            Si tienes cualquier pregunta sobre esta política o quieres pedir que se borren los datos
            de alguna sala de partida, escribe a{" "}
            <a href="mailto:manzanosalejandro.dev@gmail.com" className="underline">
              manzanosalejandro.dev@gmail.com
            </a>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
