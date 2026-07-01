import { useCallback, useEffect, useState } from 'react';
import { BarChart3, Droplets, Dumbbell, Flame, Footprints, NotebookTabs, Scale } from 'lucide-react';
import { loadWeeklyReview } from '../services/analyticsService';

export default function WeeklyReviewView({ userId, profile, onError }) {
  const [review, setReview] = useState(null);
  const [days, setDays] = useState(7);

  const load = useCallback(async (selectedDays = days) => {
    try {
      setReview(await loadWeeklyReview(userId, profile, selectedDays));
    } catch (err) {
      onError(err.message);
    }
  }, [days, onError, profile, userId]);

  useEffect(() => { load(days); }, [days, load]);

  if (!review) return <p>Carregando revisão...</p>;

  return (
    <div>
      <div className="page-title">
        <div>
          <p className="eyebrow">Semana</p>
          <h2>Revisão executiva</h2>
        </div>
        <select className="date-input" value={days} onChange={(e) => setDays(Number(e.target.value))}>
          <option value={7}>Últimos 7 dias</option>
          <option value={14}>Últimos 14 dias</option>
          <option value={30}>Últimos 30 dias</option>
        </select>
      </div>

      <div className="metric-grid four">
        <Metric icon={Flame} label="Média kcal" value={review.avgKcal ? review.avgKcal.toFixed(0) : '--'} sub={`${review.mealLoggedDays}/${review.days} dias registrados`} />
        <Metric icon={Droplets} label="Água" value={`${review.waterHitDays}/${review.days}`} sub="dias batendo meta" />
        <Metric icon={Dumbbell} label="Musculação" value={review.workouts} sub={`${review.strengthSets ?? 0} séries · ${(review.strengthVolume ?? 0).toFixed(0)} kg`} />
        <Metric icon={Footprints} label="Corrida" value={`${review.totalKm.toFixed(2)} km`} sub={`${review.runs} registros`} />
      </div>

      <section className="panel highlight-panel">
        <div className="review-decision">
          <BarChart3 size={34} />
          <div>
            <p className="eyebrow">Próxima decisão</p>
            <h3>{review.decision.title}</h3>
            <p>{review.decision.body}</p>
          </div>
        </div>
      </section>

      <section className="panel">
        <p className="eyebrow">Aderência diária</p>
        <div className="adherence-grid">
          {review.daysData.map((day) => (
            <div className="adherence-day" key={day.date}>
              <strong>{formatDate(day.date)}</strong>
              <span className={day.kcalHit ? 'ok' : ''}>Kcal {day.kcal ? day.kcal : '--'}</span>
              <span className={day.waterHit ? 'ok' : ''}>Água {day.water ? `${day.water}ml` : '--'}</span>
              <span className={day.readiness.score >= 70 ? 'ok' : day.readiness.score < 55 ? 'bad' : ''}>Prontidão {day.hasCheckin ? day.readiness.score : '--'}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <p className="eyebrow">Leitura rápida</p>
        <div className="clean-list two-cols">
          <Insight icon={NotebookTabs} title="Check-ins" text={`${review.checkinDays}/${review.days} dias. Sem isso, você decide treino no achismo.`} />
          <Insight icon={Scale} title="Peso" text={review.latestWeight ? `${Number(review.latestWeight.weight_kg).toFixed(1)} kg no último registro${review.weightChange !== null ? ` · ${review.weightChange >= 0 ? '-' : '+'}${Math.abs(review.weightChange).toFixed(1)} kg na janela` : ''}.` : 'Registre o peso para calcular tendência.'} />
        </div>
      </section>
    </div>
  );
}

function Metric({ icon: Icon, label, value, sub }) {
  return <div className="small-metric"><span><Icon size={15} /> {label}</span><strong>{value}</strong><p>{sub}</p></div>;
}

function Insight({ icon: Icon, title, text }) {
  return <div className="insight-card"><Icon size={18} /><div><strong>{title}</strong><p>{text}</p></div></div>;
}

function formatDate(value) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' });
}
