import type { ScheduleSession } from '@/lib/schedule-sessions'

export function ScheduleSection({ sessions }: { sessions: ScheduleSession[] }) {
  return (
    <section id="horario" className="schedule-section">
      <div className="schedule-head">
        <p className="eyebrow">Cada semana</p>
        <h2>El ritmo de la semana</h2>
      </div>
      <div className="schedule-list">
        {sessions.map((row) => (
          <div key={row.id} className="schedule-row">
            <div className="schedule-when">
              <span className="schedule-day">{row.day}</span>
              <span className="schedule-time">{row.time}</span>
            </div>
            <span className="schedule-title">{row.title}</span>
            <span className="schedule-place">{row.place}</span>
          </div>
        ))}
      </div>
      <p className="schedule-note">
        Los planes se confirman cada semana en Instagram. Meteorología manda.
      </p>
    </section>
  )
}
