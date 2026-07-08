import { useEffect, useMemo, useState } from 'react';
import { Activity, CalendarDays, Droplets, Flame, Footprints, Goal, HeartPulse, Moon, ShieldCheck, Sparkles } from 'lucide-react';
import { getOrCreateDailyLog, setWater, todayKey } from '../services/dailyService';
import { loadWeeklyReview } from '../services/analyticsService';
import { listMeals } from '../services/mealService';
import { listRuns } from '../services/runService';
import { listCardioSessions } from '../services/cardioService';
import { RUN_PLAN } from '../data/defaultPlan';
import { getTodayWearableMetric } from '../services/wearableService';
import { listSleepSessions } from '../services/sleepService';

export default function Dashboard({ userId, profile, trainingPlan, onError }) {
  const [daily, setDaily] = useState(null);
  const [meals, setMeals] = useState([]);
  const [runs, setRuns] = useState([]);
  const [cardios, setCardios] = useState([]);
  const [review, setReview] = useState(null);
  const [wearableToday, setWearableToday] = useState(null);
  const [correctedSleepToday, setCorrectedSleepToday] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const date = todayKey();
        const [dailyLog, mealsData, runData, cardioData, reviewData, wearableData, sleepData] = await Promise.all([
          getOrCreateDailyLog(userId, date),
          listMeals(userId, date),
          listRuns(userId),
          listCardioSessions(userId, 10),
          loadWeeklyReview(userId, profile, 7),
          getTodayWearableMetric(userId),
          listSleepSessions(userId, 7),
        ]);
        setDaily(dailyLog);
        setMeals(mealsData);
        setRuns(runData);
        setCardios(cardioData);
        setReview(reviewData);
        setWearableToday(wearableData);
        setCorrectedSleepToday((sleepData ?? []).find((item) => item.sleep_date === date) ?? null);
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
  const lastCardio = cardios[0] ?? lastRun;
  const displaySleepMinutes = correctedSleepToday?.duration_minutes ?? wearableToday?.sleep_minutes ?? null;
  const coach = buildCoachInsight({ totalKcal, kcalGoal, water, waterGoal, wearableToday, displaySleepMinutes, review, todayTraining });
  const quality = buildDataQuality({ meals, daily, wearableToday, correctedSleepToday, review });

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
    <div className="dashboard-v2">
      <div className="page-title dashboard-hero-title">
        <div>
          <p className="eyebrow">Hoje</p>
          <h2>{profile?.name ? `Bora, ${firstName(profile.name)}` : 'Seu plano de hoje'}</h2>
          <p className="muted-text">Acompanhe o básico do dia: comida, água, treino, sono, cardio e progresso.</p>
        </div>
        <span className="pill"><CalendarDays size={16} /> {new Date().toLocaleDateString('pt-BR')}</span>
      </div>

      <section className={`panel coach-panel ${coach.tone}`}>
        <div className="coach-icon"><Sparkles size={22} /></div>
        <div>
          <p className="eyebrow">Resumo inteligente</p>
          <h3>{coach.title}</h3>
          <p>{coach.body}</p>
        </div>
      </section>

      <div className="today-focus-grid">
        <Metric icon={Flame} label="Calorias" value={`${totalKcal}`} sub={`de ${kcalGoal} kcal`} percent={(totalKcal / kcalGoal) * 100} />
        <Metric icon={Droplets} label="Água" value={`${water} ml`} sub={`de ${waterGoal} ml`} percent={(water / waterGoal) * 100} />
        <Metric icon={Footprints} label="Último cardio" value={lastCardio ? cardioDistanceLabel(lastCardio) : 'sem cardio'} sub={lastCardio ? `${cardioLabel(lastCardio)} · ${secondsToPace(lastCardio.duration_seconds, lastCardio.distance_km)}` : 'sem registro'} percent={lastCardio?.distance_km ? Math.min((Number(lastCardio.distance_km) / 1) * 100, 100) : 0} />
        <Metric icon={Goal} label="Peso" value={`${Number(profile?.current_weight_kg ?? 0).toFixed(1)} kg`} sub={`meta ${profile?.target_weight_kg ?? '--'} kg`} percent={weightProgress(profile)} />
      </div>

      <section className="panel data-quality-panel">
        <div className="section-title-row">
          <div>
            <p className="eyebrow">Confiabilidade dos dados</p>
            <h3>Dados disponíveis hoje</h3>
          </div>
          <span className={`pill quality-${quality.tone}`}><ShieldCheck size={16} /> {quality.label}</span>
        </div>
        <div className="quality-grid">
          {quality.items.map((item) => (
            <div key={item.label} className={item.ok ? 'ok' : 'missing'}>
              <strong>{item.label}</strong>
              <span>{item.text}</span>
            </div>
          ))}
        </div>
      </section>

      {wearableToday && (
        <section className="panel health-panel-v2">
          <div className="section-title-row">
            <div>
              <p className="eyebrow">Relógio / saúde hoje</p>
              <h3>Dados recebidos do wearable</h3>
            </div>
            <span className="pill">{formatWearableSource(wearableToday.source, wearableToday.provider)}</span>
          </div>
          <div className="dashboard-review-grid wearable-grid">
            <WearableCard icon={Footprints} value={wearableToday.steps} fallback="0" label="passos" />
            <WearableCard icon={Flame} value={wearableToday.active_kcal} fallback="--" label="kcal ativas" />
            <WearableCard icon={HeartPulse} value={wearableToday.avg_heart_rate} fallback="--" suffix=" bpm" label="FC média" />
            <WearableCard icon={HeartPulse} value={wearableToday.resting_heart_rate} fallback="--" suffix=" bpm" label="FC repouso" />
            <WearableCard icon={Moon} value={displaySleepMinutes ? (Number(displaySleepMinutes) / 60).toFixed(1) : null} fallback="--" suffix=" h" label={correctedSleepToday ? 'sono corrigido' : 'sono'} />
            <WearableCard icon={Activity} value={wearableToday.workout_minutes} fallback="0" suffix=" min" label="atividade" />
          </div>
          <div className="decision-strip"><strong>Leitura do relógio</strong><span>{wearableToday.readiness_hint ?? 'Use estes dados junto do check-in subjetivo.'}</span></div>
        </section>
      )}

      <section className="panel quick-actions-panel">
        <div>
          <p className="eyebrow">Ação rápida</p>
          <h3>Água</h3>
          <p>Registro simples para não perder o controle do básico.</p>
        </div>
        <div className="water-actions">
          <button type="button" onClick={() => addWater(200)}>+200 ml</button>
          <button type="button" onClick={() => addWater(300)}>+300 ml</button>
          <button type="button" onClick={() => addWater(500)}>+500 ml</button>
          <button type="button" onClick={() => addWater(1000)}>+1 L</button>
          <button type="button" className="danger" onClick={() => addWater(-500)}>-500 ml</button>
        </div>
      </section>

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

      <section className="panel">
        <p className="eyebrow">Cardio / corrida 1 km</p>
        <h3>Progressão recomendada</h3>
        <div className="run-plan-mini">
          {RUN_PLAN.map((week) => <span key={week.week}>S{week.week}: {week.protocol}</span>)}
        </div>
      </section>
    </div>
  );
}

function WearableCard({ icon: Icon, value, fallback, suffix = '', label }) {
  const hasValue = value !== null && value !== undefined && value !== '';
  return (
    <div>
      <span><Icon size={14} /> {label}</span>
      <strong>{hasValue ? `${value}${suffix}` : fallback}</strong>
    </div>
  );
}

function buildCoachInsight({ totalKcal, kcalGoal, water, waterGoal, wearableToday, displaySleepMinutes, review, todayTraining }) {
  const sleepHours = Number(displaySleepMinutes || 0) / 60;
  const restingHr = Number(wearableToday?.resting_heart_rate || 0);

  if (sleepHours && sleepHours < 5.5) {
    return {
      tone: 'warning',
      title: 'Sono baixo: hoje é dia de controlar intensidade',
      body: 'Mantenha a rotina, mas evite transformar treino em guerra. Priorize água, proteína e execução boa.',
    };
  }

  if (restingHr && restingHr >= 85) {
    return {
      tone: 'warning',
      title: 'FC de repouso alta',
      body: 'Aqueça com calma. Se o corpo estiver estranho, reduza carga/cardio e registre o check-in.',
    };
  }

  if (totalKcal > kcalGoal + 250) {
    return {
      tone: 'danger',
      title: 'Calorias acima da meta',
      body: 'Não compensa com loucura. Fecha o dia melhor, registra tudo e volta ao plano na próxima refeição.',
    };
  }

  if (water < waterGoal * 0.45) {
    return {
      tone: 'neutral',
      title: 'Prioridade simples: água',
      body: 'Antes de pensar em ajuste complexo, bate mais água hoje. Isso ajuda fome, treino e peso na balança.',
    };
  }

  if (review?.workouts >= 3 && review?.mealLoggedDays >= 5) {
    return {
      tone: 'good',
      title: 'Você está construindo consistência',
      body: 'Continua repetindo o básico. Evolução real vem de semana boa empilhada, não de dia perfeito isolado.',
    };
  }

  return {
    tone: 'neutral',
    title: todayTraining?.title ? 'Plano do dia definido' : 'Dia útil para manter o básico',
    body: todayTraining?.title
      ? `Hoje tem ${todayTraining.title}. Faça o necessário e registre depois.`
      : 'Registre comida, água e check-in. O app fica mais inteligente quando os dados aparecem.',
  };
}

function buildDataQuality({ meals, daily, wearableToday, correctedSleepToday, review }) {
  const items = [
    {
      label: 'Dieta',
      ok: meals.length > 0,
      text: meals.length > 0 ? `${meals.length} refeição(ões) registrada(s)` : 'sem refeição registrada hoje',
    },
    {
      label: 'Água',
      ok: Number(daily?.water_ml || 0) > 0,
      text: Number(daily?.water_ml || 0) > 0 ? `${daily.water_ml} ml registrados` : 'sem água registrada hoje',
    },
    {
      label: 'Relógio',
      ok: Boolean(wearableToday),
      text: wearableToday ? `${formatWearableSource(wearableToday.source, wearableToday.provider)} sincronizado` : 'sem dado de wearable hoje',
    },
    {
      label: 'Sono',
      ok: Boolean(correctedSleepToday || wearableToday?.sleep_minutes),
      text: correctedSleepToday ? 'sono corrigido por print' : wearableToday?.sleep_minutes ? 'sono automático recebido' : 'sem sono hoje',
    },
    {
      label: 'Semana',
      ok: Boolean(review),
      text: review ? `${review.mealLoggedDays}/7 dias com dieta` : 'resumo semanal indisponível',
    },
  ];

  const score = items.filter((item) => item.ok).length;
  return {
    items,
    label: score >= 3 ? 'boa' : score >= 2 ? 'parcial' : 'baixa',
    tone: score >= 3 ? 'good' : score >= 2 ? 'warning' : 'danger',
  };
}

function cardioLabel(session) {
  if (!session) return 'Cardio';
  return session.activity_label || ({
    treadmill: 'Esteira',
    outdoor_run: 'Corrida',
    walk: 'Caminhada',
    stairs: 'Escada',
    bike: 'Bike',
    elliptical: 'Elíptico',
  })[session.activity_type] || 'Cardio';
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

function cardioDistanceLabel(cardio) {
  if (cardio?.distance_km === null || cardio?.distance_km === undefined) return 'sem distância';
  return `${Number(cardio.distance_km).toFixed(2)} km`;
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

function firstName(name) {
  return String(name || '').trim().split(/\s+/)[0] || 'Atleta';
}
