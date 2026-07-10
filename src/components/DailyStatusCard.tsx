import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ClipboardCheck, Droplets, Dumbbell, Moon, Salad, Timer, XCircle } from 'lucide-react';
import { getCheckin } from '../services/checkinService';
import { getOrCreateDailyLog, todayKey } from '../services/dailyService';
import { listCardioSessions } from '../services/cardioService';
import { listMeals } from '../services/mealService';
import { listSleepSessions } from '../services/sleepService';
import { listWorkoutHistory } from '../services/workoutService';

export default function DailyStatusCard(props: any) {
  const {
    userId,
    profile,
    todayPlan,
    onError,
    onNavigate,
    dailyTruth,
    dailyTruthLoading = false,
  } = props;

  const [daily, setDaily] = useState(null);
  const [meals, setMeals] = useState([]);
  const [checkin, setCheckin] = useState(null);
  const [sleepSessions, setSleepSessions] = useState([]);
  const [workouts, setWorkouts] = useState([]);
  const [cardios, setCardios] = useState([]);
  const [loading, setLoading] = useState(false);
  const date = todayKey();

  useEffect(() => {
    async function load() {
      if (!userId) return;
      if (dailyTruthLoading) { setLoading(true); return; }

      if (dailyTruth) {
        setDaily(dailyTruth.daily);
        setMeals(dailyTruth.meals);
        setCheckin(dailyTruth.checkin);
        setSleepSessions(dailyTruth.sleep);
        setWorkouts(dailyTruth.strengthApp);
        setCardios(dailyTruth.cardio);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const [dailyData, mealData, checkinData, sleepData, workoutData, cardioData] = await Promise.all([
          getOrCreateDailyLog(userId, date),
          listMeals(userId, date),
          getCheckin(userId, date),
          listSleepSessions(userId, 7),
          listWorkoutHistory(userId, 10),
          listCardioSessions(userId, 12),
        ]);

        setDaily(dailyData);
        setMeals(mealData);
        setCheckin(checkinData);
        setSleepSessions(sleepData);
        setWorkouts(workoutData);
        setCardios(cardioData);
      } catch (err: any) {
        onError?.(err.message);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [dailyTruth, dailyTruthLoading, date, onError, userId]);

  const summary = useMemo(() => {
    const kcal = meals.reduce((sum, item: any) => sum + Number(item.kcal || 0), 0);
    const kcalGoal = Number(profile?.kcal_goal ?? 2300);
    const water = Number((daily as any)?.water_ml ?? 0);
    const waterGoal = Number(profile?.water_goal_ml ?? 3000);
    const sleepToday = (sleepSessions as any[]).find((item) => item.sleep_date === date) ?? null;
    const workoutToday = (workouts as any[]).find((item) => localDateKey(item.performed_at) === date) ?? null;
    const cardioToday = (cardios as any[]).find((item) => localDateKey(item.performed_at) === date) ?? null;

    const items = [
      {
        id: 'water',
        label: 'Água',
        ok: water > 0,
        done: water >= waterGoal,
        text: water > 0 ? `${water} / ${waterGoal} ml` : 'sem água registrada',
        action: 'Registrar água',
        target: 'register',
        icon: Droplets,
      },
      {
        id: 'food',
        label: 'Comida',
        ok: meals.length > 0,
        done: kcal >= kcalGoal * 0.65,
        text: meals.length > 0 ? `${Math.round(kcal)} kcal registradas` : 'sem comida registrada',
        action: 'Registrar comida',
        target: 'register',
        icon: Salad,
      },
      {
        id: 'checkin',
        label: 'Check-in',
        ok: Boolean(checkin),
        done: Boolean(checkin),
        text: checkin ? 'prontidão calculada' : 'faltando check-in',
        action: 'Fazer check-in',
        target: 'register',
        icon: ClipboardCheck,
      },
      {
        id: 'sleep',
        label: 'Sono',
        ok: Boolean(sleepToday),
        done: Boolean(sleepToday),
        text: sleepToday ? `${Math.round(Number(sleepToday.duration_minutes || 0) / 60 * 10) / 10}h importadas` : 'sem sono importado hoje',
        action: 'Abrir sono',
        target: 'progressHub',
        icon: Moon,
      },
    ];

    if (todayPlan?.strength) {
      items.push({
        id: 'strength',
        label: 'Treino',
        ok: Boolean(workoutToday),
        done: Boolean(workoutToday),
        text: workoutToday ? 'treino salvo hoje' : 'treino planejado',
        action: 'Abrir academia',
        target: 'gym',
        icon: Dumbbell,
      });
    }

    if (todayPlan?.cardio) {
      items.push({
        id: 'cardio',
        label: 'Cardio',
        ok: Boolean(cardioToday),
        done: Boolean(cardioToday),
        text: cardioToday ? 'cardio registrado hoje' : 'cardio planejado',
        action: 'Abrir cardio',
        target: 'gym',
        icon: Timer,
      });
    }

    const doneCount = items.filter((item) => item.done).length;
    const okCount = items.filter((item) => item.ok).length;
    const score = Math.round((okCount / Math.max(items.length, 1)) * 100);

    return {
      kcal,
      water,
      items,
      doneCount,
      okCount,
      score,
      headline: buildHeadline(score, items),
    };
  }, [cardios, checkin, daily, date, meals, profile, sleepSessions, todayPlan, workouts]);

  const next = summary.items.find((item) => !item.ok) ?? summary.items.find((item) => !item.done) ?? null;

  return (
    <section className="simple-panel daily-status-card-v363">
      <div className="simple-section-head">
        <div>
          <p className="eyebrow">Resumo do dia</p>
          <h3>{loading ? 'Carregando...' : summary.headline}</h3>
          <span>{summary.okCount}/{summary.items.length} áreas com dado registrado{dailyTruth ? ` · confiança ${dailyTruth.confidence}` : ''}</span>
        </div>

        <div className="daily-status-score-v363">
          <strong>{summary.score}</strong>
          <small>%</small>
        </div>
      </div>

      <div className="daily-status-grid-v363">
        {summary.items.map((item) => {
          const Icon = item.icon;
          const StateIcon = item.ok ? CheckCircle2 : XCircle;

          return (
            <button
              key={item.id}
              type="button"
              className={item.ok ? 'ok' : 'missing'}
              onClick={() => onNavigate?.(item.target)}
            >
              <Icon size={18} />
              <div>
                <strong>{item.label}</strong>
                <span>{item.text}</span>
              </div>
              <StateIcon size={17} />
            </button>
          );
        })}
      </div>

      {next && (
        <div className="daily-next-step-v363">
          <span>Próximo melhor passo</span>
          <button type="button" onClick={() => onNavigate?.(next.target)}>
            {next.action}
          </button>
        </div>
      )}
    </section>
  );
}

function buildHeadline(score, items) {
  const missing = items.filter((item) => !item.ok);

  if (score >= 90) return 'Dia bem registrado';
  if (score >= 65) return 'Falta pouco';
  if (missing.length) return `Falta ${missing[0].label.toLowerCase()}`;
  return 'Dados básicos ok';
}

function localDateKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
