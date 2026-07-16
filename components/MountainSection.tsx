import { stats } from '@/lib/schedule'

export function MountainSection() {
  return (
    <section id="montana" className="mountain-section">
      <div className="mountain-inner">
        <div className="mountain-photo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="https://picsum.photos/id/1036/900/1100?grayscale" alt="La Pedriza" loading="lazy" />
        </div>
        <div className="mountain-content">
          <p className="eyebrow">La Montaña</p>
          <h2>La montaña es el punto de encuentro</h2>
          <p className="mountain-lead">
            La Pedriza es nuestro patio: granito, senderos y vistas de la sierra a menos de una hora
            de Madrid. No importa tu nivel — importa que aparezcas.
          </p>
          <p className="mountain-body">
            Somos gente normal que prefiere pasar el finde arriba. Cada salida tiene su grupo, su
            ritmo y alguien que conoce el camino.
          </p>
          <div className="mountain-stats">
            {stats.map((stat) => (
              <div key={stat.label} className="stat">
                <p className="stat-value">{stat.value}</p>
                <p className="stat-label">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
