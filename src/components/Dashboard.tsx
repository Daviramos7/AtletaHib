import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Droplets, Flame, Footprints, Goal } from 'lucide-react';
import { getOrCreateDailyLog, setWater, todayKey } from '../services/dailyService';
import { loadWeeklyReview } from '../services/analyticsService';
import { listMeals } from '../services/mealService';
import { listRuns } from '../services/runService';
import { RUN_PLAN } from '../data/defaultPlan';
import { getTodayWearableMetric } from '../services/wearableService';

export default function Dashboard({ userId, profile, trainingPlan, onError }) {
  const [daily, setDaily] = useState(null);
  const [meals, setMeals] = useState([]);
  const [runs, setRuns] = useState([]);
  const [review, setReview] = useState(null);
  const [wearableToday, setWearableToday] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const date = todayKey();
        const [dailyLog, mealsData, runData, reviewData, wearableData] = await Promise.all([
          getOrCreateDailyLog(userId, date),
          listMeals(userId, date),
          listRuns(userId),
          loadWeeklyReview(userId, profile, 7),
          getTodayWearableMetric(userId),
        ]);
        setDaily(dailyLog);
        setMeals(mealsData);
        setRuns(runData);
        setReview(reviewData);
        setWearableToday(wearableData);
      } catch (err) {
        onError(err.message);
      }
    }
    load();
  }, [userId, profile, onError]);

  const totalKcal = useMemo(() => meals.reduce((sum, item) => sum + Number(item.kcal), 0), [meals]);
  const kcalGoal = profile?.kcal_goal ?? 2300;
  const waterGoal = profile?.water_goal_ml ?? 3000;
  const water = daily?.water_ml ?? 0;
  const todayTraining = getTodayTraining(trainingPlan);
  const lastRun = runs[0];

  async function addWater(amount) {
    try {
      const date = todayKey();
      const current = daily?.water_ml ?? 0;
      const updated = await setWater(userId, date, Math.max(0, current + amount));
      setDaily(updated);
    } catch (err) {
      onError(err.message);
    }
  }

  return (
    <div>
      <div className="page-title">
        <div>
          <p className="eyebrow">Hoje</p>
          <h2>{profile?.name ? `Plano de ${profile.name}` : 'Plano personalizado'}</h2>
        </div>
        <span className="pill"><CalendarDays size={16} /> {new Date().toLocaleDateString('pt-BR')}</span>
      </div>

      <div className="metric-grid">
        <Metric icon={Flame} label="Calorias" value={`${totalKcal}`} sub={`de ${kcalGoal} kcal`} percent={(totalKcal / kcalGoal) * 100} />
        <Metric icon={Droplets} label="Água" value={`${water} ml`} sub={`de ${waterGoal} ml`} percent={(water / waterGoal) * 100} />
        <Metric icon={Footprints} label="Última corrida" value={lastRun ? `${Number(lastRun.distance_km).toFixed(2)} km` : '0 km'} sub={lastRun ? secondsToPace(lastRun.duration_seconds, lastRun.distance_km) : 'sem registro'} percent={lastRun ? Math.min((lastRun.distance_km / 1) * 100, 100) : 0} />
        <Metric icon={Goal} label="Peso" value={`${Number(profile?.current_weight_kg ?? 0).toFixed(1)} kg`} sub={`meta ${profile?.target_weight_kg ?? '--'} kg`} percent={weightProgress(profile)} />
      </div>


      {wearableToday && (
        <section className="panel">
          <div className="section-title-row">
            <div>
              <p className="eyebrow">Relógio / saúde hoje</p>
              <h3>Dados recebidos do wearable</h3>
            </div>
            <span className="pill">{formatWearableSource(wearableToday.source, wearableToday.provider)}</span>
          </div>
          <div className="dashboard-review-grid wearable-grid">
            <WearableCard value={wearableToday.steps} fallback="0" label="passos" />
            <WearableCard value={wearableToday.active_kcal} fallback="--" label="kcal ativas" />
            <WearableCard value={wearableToday.avg_heart_rate} fallback="--" suffix=" bpm" label="FC média" />
            <WearableCard value={wearableToday.resting_heart_rate} fallback="--" suffix=" bpm" label="FC repouso" />
            <WearableCard value={wearableToday.sleep_minutes ? (Number(wearableToday.sleep_minutes) / 60).toFixed(1) : null} fallback="--" suffix=" h" label="sono" />
            <WearableCard value={wearableToday.workout_minutes} fallback="0" suffix=" min" label="atividade" />
          </div>
          <div className="decision-strip"><strong>Leitura do relógio</strong><span>{wearableToday.readiness_hint ?? 'Use estes dados junto do check-in subjetivo.'}</span></div>
        </section>
      )}

      <section className="panel highlight-panel">
        <p className="eyebrow">Rotina atual</p>
        <h3>Almoço {formatTime(profile?.lunch_time) || '--:--'} · treino {formatTime(profile?.training_time) || '--:--'}</h3>
        <p>{profile?.dietary_restriction ?? 'Restrição alimentar não informada.'}</p>
        <p>{profile?.routine_notes ?? 'Rotina personalizada ainda sem observações.'}</p>
      </section>

      <section className="panel">
        <p className="eyebrow">Água rápida</p>
        <div className="water-actions">
          <button onClick={() => addWater(200)}>+200 ml</button>
          <button onClick={() => addWater(300)}>+300 ml</button>
          <button onClick={() => addWater(500)}>+500 ml</button>
          <button onClick={() => addWater(1000)}>+1 L</button>
          <button className="danger" onClick={() => addWater(-500)}>-500 ml</button>
        </div>
      </section>


      {review && (
        <section className="panel">
          <p className="eyebrow">Resumo dos últimos 7 dias</p>
          <div className="dashboard-review-grid">
            <div><strong>{review.mealLoggedDays}/7</strong><span>dias com dieta registrada</span></div>
            <div><strong>{review.workouts}</strong><span>treinos concluídos</span></div>
            <div><strong>{review.waterHitDays}/7</strong><span>dias batendo água</span></div>
            <div><strong>{review.avgReadiness ? review.avgReadiness.toFixed(0) : '--'}</strong><span>prontidão média</span></div>
          </div>
          <div className="decision-strip"><strong>{review.decision.title}</strong><span>{review.decision.body}</span></div>
        </section>
      )}

      <section className="panel highlight-panel">
        <p className="eyebrow">Treino de hoje</p>
        <h3>{todayTraining?.title ?? 'Descanso / caminhada leve'}</h3>
        <p>{todayTraining?.notes ?? 'Recuperação também faz parte do plano. Caminhada leve está liberada se estiver sem dor.'}</p>
        {todayTraining?.exercise_entries?.length > 0 && (
          <ul className="clean-list two-cols">
            {todayTraining.exercise_entries.slice(0, 5).map((ex) => (
              <li key={ex.id}><strong>{ex.exercise_name}</strong><span>{ex.sets}x {ex.reps}</span></li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel">
        <p className="eyebrow">Corrida 1 km</p>
        <h3>Progressão recomendada</h3>
        <div className="run-plan-mini">
          {RUN_PLAN.map((week) => <span key={week.week}>S{week.week}: {week.protocol}</span>)}
        </div>
      </section>
    </div>
  );
}


function WearableCard({ value, fallback, suffix = '', label }) {
  const hasValue = value !== null && value !== undefined && value !== '';
  return (
    <div>
      <strong>{hasValue ? `${value}${suffix}` : fallback}</strong>
      <span>{label}</span>
    </div>
  );
}

function formatWearableSource(source, provider) {
  const raw = String(source || provider || '').toLowerCase();
  if (raw.includes('health_connect') || raw.includes('bridge')) return 'Health Connect';
  if (raw.includes('mi_fitness') || raw.includes('redmi')) return 'Mi Fitness';
  if (raw.includes('manual')) return 'manual';
  return source || provider || 'wearable';
}

function Metric({ icon: Icon, label, value, sub, percent }) {
  const safePercent = Math.max(0, Math.min(percent || 0, 100));
  return (
    <div className="metric-card">
      <div className="metric-head"><Icon size={20} /><span>{label}</span></div>
      <strong>{value}</strong>
      <p>{sub}</p>
      <div className="bar"><div style={{ width: `${safePercent}%` }} /></div>
    </div>
  );
}

function getTodayTraining(plan) {
  if (!plan?.training_days) return null;
  const weekday = new Date().getDay();
  return plan.training_days.find((day) => day.weekday === weekday);
}

function secondsToPace(seconds, distanceKm) {
  if (!seconds || !distanceKm) return 'sem pace';
  const pace = seconds / Number(distanceKm);
  const min = Math.floor(pace / 60);
  const sec = String(Math.round(pace % 60)).padStart(2, '0');
  return `${min}:${sec}/km`;
}

function weightProgress(profile) {
  const start = Number(profile?.starting_weight_kg ?? profile?.current_weight_kg ?? 0);
  const current = Number(profile?.current_weight_kg ?? 0);
  const target = Number(profile?.target_weight_kg ?? current);
  if (!start || !current || start === target) return 0;
  const total = Math.abs(start - target);
  const done = Math.abs(start - current);
  return (done / Math.max(total, 1)) * 100;
}

function formatTime(value) {
  if (!value) return '';
  return String(value).slice(0, 5);
}
