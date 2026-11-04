import type { Metadata } from 'next';
import { checkoutApoya, grupoApoya } from '@/lib/miembrosApoya';
import s from './apoya.module.css';

// Membresía mensual para apoyar los videos de noticias y opinión. Se cobra como suscripción
// en Hotmart (APOYA_HOTMART_CHECKOUT); Hotmart no acepta donaciones sin nada a cambio, por eso
// es una membresía con beneficios: el grupo privado de WhatsApp, la votación del próximo tema y las radionovelas
// completas (/radionovelas, que se abren con el correo del miembro).
// Al pagar, Hotmart devuelve a /apoya?compra=ok, donde aparece el enlace del grupo
// (APOYA_WHATSAPP_GRUPO). El grupo pide aprobación del administrador: el enlace solo no basta.
const URL = 'https://corridos.online/apoya';
// Tiene que coincidir con el precio del plan en Hotmart.
const PRECIO = 'US$ 2.99';
const TITULO = 'Apoya a Armando Roque Godoy';
// Para quien prefiere un aporte único fuera de Hotmart (remesa o depósito): la misma cuenta
// que RickyMath usaba antes de cobrar por Hotmart.
const CUENTA = { banco: 'Banco Atlántida', numero: '14720926485', titular: 'Armando Roque Godoy' };
const WHATSAPP = '50496895978';
const DESCRIPCION = `Hazte miembro por ${PRECIO} al mes y ayúdame a seguir haciendo videos de noticias y opinión.`;

export const metadata: Metadata = {
  title: TITULO,
  description: DESCRIPCION,
  openGraph: {
    title: TITULO,
    description: DESCRIPCION,
    images: [{ url: '/apoya/og.jpg?v=2', width: 1200, height: 630, type: 'image/jpeg' }],
    url: URL,
    siteName: 'Canciones',
    type: 'website',
  },
  twitter: { card: 'summary_large_image', title: TITULO, description: DESCRIPCION, images: ['/apoya/og.jpg?v=2'] },
};

const BENEFICIOS = [
  {
    icono: '💬',
    titulo: 'Grupo privado de WhatsApp',
    texto: 'Un espacio solo para miembros, donde comparto avances, conversamos las noticias y escucho tu opinión.',
  },
  {
    icono: '🗳️',
    titulo: 'Tú eliges el próximo tema',
    texto: 'Cada mes los miembros votan entre varias propuestas cuál será el tema de uno de mis videos.',
  },
  {
    icono: '🎙️',
    titulo: 'Radionovelas completas',
    texto: 'Escuchas todas las temporadas completas desde el primer día, sin esperar los cortes de TikTok.',
  },
];

export default async function ApoyaPage({ searchParams }: { searchParams: Promise<{ compra?: string }> }) {
  const checkout = checkoutApoya();
  const grupo = grupoApoya();
  const recienPago = (await searchParams).compra === 'ok';

  return (
    <main className={s.pagina}>
      <div className={s.contenido}>
        <p className={s.etiqueta}>
          <span className={s.punto} />
          NOTICIAS Y OPINIÓN · HONDURAS Y EL MUNDO
        </p>

        {recienPago ? (
          <section className={s.gracias}>
            <p className={s.graciasIcono}>🙌</p>
            <h1 className={s.graciasTitulo}>¡Gracias por apoyarme!</h1>
            <p className={s.texto}>Ya eres miembro. Tu apoyo me permite seguir investigando y haciendo videos.</p>
            {grupo ? (
              <>
                <a href={grupo} className={s.botonGrupo}>
                  💬 Entrar al grupo de miembros
                </a>
                <p className={s.nota}>
                  Pide entrar con el mismo número que pusiste al pagar; yo apruebo tu entrada en cuanto lo vea.
                </p>
              </>
            ) : (
              <p className={s.texto}>En unas horas te escribo por WhatsApp para agregarte al grupo de miembros.</p>
            )}
            <a href="/radionovelas" className={s.botonRadio}>
              🎙️ Escuchar las radionovelas completas
            </a>
            <p className={s.nota}>
              La primera vez te va a pedir un correo: escribe el mismo con el que pagaste en Hotmart. Con eso se abren todas, las de ahora y
              las que vengan.
            </p>
          </section>
        ) : null}

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/apoya/armando.jpg" alt="Armando Roque Godoy" width={160} height={160} className={s.foto} />

        <h1 className={s.titulo}>
          Si te gustan mis videos, <span className={s.resaltado}>ayúdame a seguir</span>
        </h1>
        <p className={s.texto}>
          Soy Armando Roque Godoy. Hago videos de noticias y opinión sobre lo que pasa en Honduras y el
          mundo.
        </p>

        <section className={s.tarjeta}>
          <p className={s.tarjetaEtiqueta}>MEMBRESÍA</p>
          <p className={s.precio}>
            <span className={s.monto}>{PRECIO}</span>
            <span className={s.periodo}> / mes</span>
          </p>
          <ul className={s.beneficios}>
            {BENEFICIOS.map((b) => (
              <li key={b.titulo} className={s.beneficio}>
                <span className={s.icono}>{b.icono}</span>
                <div>
                  <p className={s.beneficioTitulo}>{b.titulo}</p>
                  <p className={s.beneficioTexto}>{b.texto}</p>
                </div>
              </li>
            ))}
          </ul>
          {checkout ? (
            <a href={checkout} className={s.boton}>
              Hacerme miembro
            </a>
          ) : (
            <p className={s.pronto}>Muy pronto</p>
          )}
          <p className={s.nota}>Pago seguro con Hotmart. Cancelas cuando quieras, sin compromiso.</p>
        </section>

        {/* Va después de la tarjeta: en el celular, el precio tiene que verse sin bajar. */}
        <p className={s.texto}>
          Cada video lleva horas de investigación, guion, voz y edición. Con tu membresía puedo dedicarle más tiempo y
          hacer más.
        </p>

        {/* La radionovela va primero: es lo que incluye la membresía y a lo que llegan desde TikTok. */}
        <a href="/radionovelas" className={`${s.libros} ${s.radio}`}>
          <div className={s.radioPortada}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/radionovelas/el-camino-que-dejamos-atras/og.jpg" alt="El camino que dejamos atrás, radionovela" />
            <span className={`${s.librosSello} ${s.radioSello}`}>⭐ Incluida en la membresía</span>
          </div>
          <p className={`${s.librosEtiqueta} ${s.radioEtiqueta}`}>NUEVA · RADIONOVELA</p>
          <p className={s.librosTitulo}>
            El camino que <span className={s.radioResaltado}>dejamos atrás</span>
          </p>
          <p className={s.librosTexto}>
            8 capítulos sobre los que se van y los que se quedan. El primero es gratis; con la membresía la escuchas completa.
          </p>
          <span className={`${s.librosBoton} ${s.radioBoton}`}>Escuchar la radionovela →</span>
        </a>

        {/* Invitación a los audiolibros: las portadas son las mismas imágenes que se comparten. */}
        <a href="/historias" className={s.libros}>
          <div className={s.librosPortadas}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/morazan/portada-venta.jpg" alt="Morazán: entre la unión y la derrota" className={s.librosAtras} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/historias/san-pedro-sula/portada.jpg" alt="San Pedro Sula: el valle que se hizo ciudad" className={s.librosAdelante} />
            <span className={s.librosSello}>🎧 Primer capítulo gratis</span>
          </div>
          <p className={s.librosEtiqueta}>TAMBIÉN ESCRIBO</p>
          <p className={s.librosTitulo}>
            Historias de Honduras <span className={s.librosResaltado}>en audiolibro</span>
          </p>
          <p className={s.librosTexto}>
            San Pedro Sula, Morazán y más: con mi voz, fotos, sonidos y el texto que avanza mientras escuchas.
          </p>
          <span className={s.librosBoton}>Escuchar mis audiolibros →</span>
        </a>

        <section className={s.preguntas}>
          <h2 className={s.preguntasTitulo}>Preguntas frecuentes</h2>
          <div>
            <p className={s.pregunta}>¿Cómo cancelo?</p>
            <p>
              Cuando quieras, desde tu cuenta de Hotmart (con el mismo correo con que pagaste). Sigues en el grupo hasta
              que termine el mes que ya pagaste.
            </p>
          </div>
          <div>
            <p className={s.pregunta}>¿Mi número queda visible para otros?</p>
            <p>En el grupo, como en cualquier grupo de WhatsApp, los demás miembros pueden ver tu número.</p>
          </div>
          <div>
            <p className={s.pregunta}>¿Puedo apoyar sin hacerme miembro?</p>
            <p>
              ¡Claro! Puedes enviarme una remesa o hacer un depósito del monto que quieras a mi cuenta bancaria:
            </p>
            <div className={s.cuenta}>
              <p>
                <strong>{CUENTA.banco}</strong>
              </p>
              <p>
                Cuenta: <strong className={s.numeroCuenta}>{CUENTA.numero}</strong>
              </p>
              <p>A nombre de: {CUENTA.titular}</p>
            </div>
            <p>
              Si lo haces,{' '}
              <a
                className={s.enlace}
                href={`https://wa.me/${WHATSAPP}?text=${encodeURIComponent('Hola Armando, te envié un aporte para tus videos 🙌')}`}
              >
                avísame por WhatsApp
              </a>{' '}
              para agradecerte. Y comentar y compartir mis videos también me ayuda muchísimo.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
