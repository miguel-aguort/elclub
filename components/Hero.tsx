import Image from 'next/image'

export function Hero() {
  return (
    <section id="hero" className="hero">
      <svg
        className="hero-backdrop"
        viewBox="0 0 1440 500"
        preserveAspectRatio="xMidYMax slice"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="hero-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0d0d0d" />
            <stop offset="55%" stopColor="#141210" />
            <stop offset="100%" stopColor="#1c1712" />
          </linearGradient>
          <radialGradient id="hero-glow" cx="50%" cy="55%" r="55%">
            <stop offset="0%" stopColor="#e0793f" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#e0793f" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="1440" height="500" fill="url(#hero-sky)" />
        <rect width="1440" height="500" fill="url(#hero-glow)" />
        <path
          d="M0,360 L120,300 L220,340 L340,240 L430,300 L560,180 L650,260 L760,150 L860,230 L980,170 L1100,260 L1220,210 L1320,280 L1440,240 L1440,500 L0,500 Z"
          fill="#211d18"
        />
        <path
          d="M0,410 L150,350 L280,400 L400,320 L520,380 L640,290 L760,360 L880,280 L1000,350 L1120,300 L1260,370 L1440,320 L1440,500 L0,500 Z"
          fill="#161310"
        />
        <path
          d="M0,460 L180,420 L320,460 L460,400 L600,450 L740,390 L880,440 L1020,400 L1160,450 L1300,410 L1440,440 L1440,500 L0,500 Z"
          fill="#0d0d0d"
        />
      </svg>
      <div className="hero-inner">
        <div className="hero-content">
          <p className="hero-eyebrow">La Pedriza · Manzanares El Real</p>
          <h1>El Club!</h1>
          <svg className="ridge-line" viewBox="0 0 400 60" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0,50 L55,40 L105,20 L145,6 L175,20 L200,10 L225,24 L260,40 L400,46" />
          </svg>
          <p className="hero-tagline">Trail running. Climbing. Biking. Join the community.</p>
          <p className="hero-coords">40.7344° N &nbsp;·&nbsp; 3.9926° W</p>
          <a href="#signup" className="cta-button">
            Join the community
          </a>
        </div>
        <Image
          src="/el-club-tee.jpg"
          alt="El Club! t-shirt with the mountain ridge logo — La Pedriza, Manzanares El Real"
          width={1024}
          height={1024}
          className="hero-image"
          priority
        />
      </div>
    </section>
  )
}
