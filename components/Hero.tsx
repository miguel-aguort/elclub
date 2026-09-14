'use client'

import Image from 'next/image'
import { useState } from 'react'

const MARQUEE = [
  'Carrera de Montaña',
  'Escalada',
  'Bici',
  'La Pedriza',
  'Comunidad',
  'Sierra de Guadarrama',
]

const TEES = [
  {
    src: '/el-club-tee-morada.jpg',
    alt: 'Camiseta de El Club! en morado con el logo de la cresta de montaña',
  },
  {
    src: '/el-club-tee-amarilla.jpg',
    alt: 'Camiseta de El Club! en amarillo con el logo de la cresta de montaña',
  },
  {
    src: '/el-club-tee-negra.jpg',
    alt: 'Camiseta de El Club! en negro con el logo de la cresta de montaña',
  },
]

export function Hero() {
  const [index, setIndex] = useState(0)
  const step = (delta: number) => setIndex((i) => (i + delta + TEES.length) % TEES.length)
  const tee = TEES[index]

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
            key={tee.src}
            src={tee.src}
            alt={tee.alt}
            width={1024}
            height={1024}
            className="hero-image"
            priority={index === 0}
          />
          <span className="hero-image-caption">Camiseta de socios — Vol. 01</span>

          <button
            type="button"
            onClick={() => step(-1)}
            aria-label="Camiseta anterior"
            className="hero-carousel-btn hero-carousel-btn--prev"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => step(1)}
            aria-label="Camiseta siguiente"
            className="hero-carousel-btn hero-carousel-btn--next"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>

          <div className="hero-dots">
            {TEES.map((t, i) => (
              <span
                key={t.src}
                className={i === index ? 'hero-dot hero-dot--active' : 'hero-dot'}
              />
            ))}
          </div>
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
