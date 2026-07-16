import Image from 'next/image'

const MARQUEE = [
  'Carrera de Montaña',
  'Escalada',
  'Bici',
  'La Pedriza',
  'Comunidad',
  'Sierra de Guadarrama',
]

export function Hero() {
  return (
    <section id="hero" className="hero">
      <svg
        className="hero-backdrop"
        viewBox="0 0 1440 620"
        preserveAspectRatio="xMidYMax slice"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="ec-glow" cx="50%" cy="42%" r="60%">
            <stop offset="0%" stopColor="#f5f5f2" stopOpacity="0.10" />
            <stop offset="100%" stopColor="#f5f5f2" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="1440" height="620" fill="url(#ec-glow)" />
        <path
          d="M0,430 L120,360 L220,400 L340,290 L430,350 L560,220 L650,300 L760,180 L860,270 L980,200 L1100,300 L1220,240 L1320,320 L1440,270 L1440,620 L0,620 Z"
          fill="#f5f5f2"
          opacity="0.06"
        />
        <path
          d="M0,490 L150,420 L280,470 L400,380 L520,440 L640,340 L760,420 L880,330 L1000,410 L1120,350 L1260,430 L1440,370 L1440,620 L0,620 Z"
          fill="#f5f5f2"
          opacity="0.045"
        />
        <path
          d="M0,550 L180,505 L320,545 L460,480 L600,535 L740,465 L880,525 L1020,478 L1160,535 L1300,488 L1440,525 L1440,620 L0,620 Z"
          fill="#f5f5f2"
          opacity="0.03"
        />
      </svg>

      <div className="hero-inner">
        <div className="hero-content">
          <p className="hero-eyebrow">
            <span className="rule" aria-hidden="true" />
            La Pedriza · Manzanares El Real
          </p>
          <div className="wordmark">
            <h1>El Club!</h1>
            <svg className="ridge-line" viewBox="0 0 400 60" preserveAspectRatio="none" aria-hidden="true">
              <path d="M0,50 L55,40 L105,20 L145,6 L175,20 L200,10 L225,24 L260,40 L400,46" />
            </svg>
          </div>
          <p className="hero-tagline">
            Una comunidad de montaña para correr por senderos, escalar y rodar. Ven, muévete con
            nosotros y vuelve a casa cansado.
          </p>
          <p className="hero-coords">
            <span className="rule" aria-hidden="true" />
            40.7344° N&nbsp;&nbsp;3.9926° O
            <span className="rule" aria-hidden="true" />
          </p>
          <div className="hero-actions">
            <a href="#unete" className="cta-button">
              Únete a la comunidad
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </a>
            <a href="#actividades" className="cta-ghost">
              Qué hacemos
            </a>
          </div>
        </div>

        <div className="hero-image-frame">
          <Image
            src="/el-club-tee.jpg"
            alt="Camiseta de El Club! con el logo de la cresta de montaña"
            width={1024}
            height={1024}
            className="hero-image"
            priority
          />
          <span className="hero-image-caption">Camiseta de socios — Vol. 01</span>
        </div>
      </div>

      <div className="marquee">
        <div className="marquee-track">
          {[...MARQUEE, ...MARQUEE].map((word, i) => (
            <span key={i} className="marquee-item">
              {word}
              <span className="marquee-dot" aria-hidden="true" />
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
