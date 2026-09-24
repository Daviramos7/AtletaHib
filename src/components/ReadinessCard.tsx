import { useEffect, useMemo, useState } from 'react';
import { Activity, Dumbbell, Moon, Salad, Timer } from 'lucide-react';
import { getCheckin } from '../services/checkinService';
import { listCardioSessions } from '../services/cardioService';
import { listSleepSessions } from '../services/sleepService';
import { listStrengthSets, listWorkoutHistory } from '../services/workoutService';
import { todayKey } from '../services/dailyService';
import { buildDailyReadiness } from '../utils/readinessAdvisor';

export default function ReadinessCard(props: any) {
  const {
    userId,
    todayPlan,
    onError,
    onNavigate,
    compact = false,
    dailyTruth,
    dailyTruthLoading = false,
  } = props;

  const [checkin, setCheckin] = useState(null);
  const [sleepSessions, setSleepSessions] = useState([]);
  const [workoutHistory, setWorkoutHistory] = useState([]);
  const [cardioSessions, setCardioSessions] = useState([]);
  const [strengthSets, setStrengthSets] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadReadiness() {
      if (!userId) return;
      if (dailyTruthLoading) { setLoading(true); return; }
      if (dailyTruth) {
        setCheckin(dailyTruth.checkinMorning ?? dailyTruth.checkin);
        setSleepSessions(dailyTruth.sleep);
        setWorkoutHistory(dailyTruth.strengthApp);
        setCardioSessions(dailyTruth.cardio);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const [checkinData, sleepData, workoutData, cardioData] = await Promise.all([
          getCheckin(userId, todayKey()),
          listSleepSessions(userId, 7),
          listWorkoutHistory(userId, 5),
          listCardioSessions(userId, 10),
        ]);

        setCheckin(checkinData);
        setSleepSessions(sleepData);
        setWorkoutHistory(workoutData);
        setCardioSessions(cardioData);
      } catch (err) {
        onError?.(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadReadiness();
  }, [dailyTruth, dailyTruthLoading, onError, userId]);

  useEffect(() => {
    let alive = true;
    if (!userId) return undefined;
    listStrengthSets(userId, 180)
      .then((sets) => { if (alive) setStrengthSets(sets); })
      .catch((err) => onError?.(err.message));
    return () => { alive = false; };
  }, [onError, userId]);

  const readiness = useMemo(() => buildDailyReadiness({
    checkin,
    sleepSessions,
    workoutHistory,
    cardioSessions,
    todayPlan,
    completedSets: strengthSets,
    baseExercises: todayPlan?.strengthEntries ?? [],
  }), [checkin, sleepSessions, workoutHistory, cardioSessions, strengthSets, todayPlan]);

  return (
    <section className={`simple-panel readiness-card-v36 ${readiness.tone} ${compact ? 'compact' : ''}`}>
      <div className="readiness-main-v36">
        <div>
          <p className="eyebrow">Prontidão do dia</p>
          <h3>{loading ? 'Carregando…' : checkin ? readiness.label : 'Como você está?'}</h3>
          <span>{checkin ? readiness.headline : 'Faça o check-in da manhã para ajustar o treino.'}</span>
        </div>

        {checkin && <div className="readiness-ring-v36" aria-label={`Prontidão ${readiness.score} de 100`}>
          <strong>{loading ? '…' : readiness.score}</strong>
          <small>/100</small>
        </div>}
      </div>

      {checkin && !compact && <div className="readiness-flags-v36">
        {readiness.flags.map((flag) => <span key={flag}>{flag}</span>)}
      </div>}

      {checkin && !compact && <div className="readiness-actions-v36">
        <Advice icon={Dumbbell} label="Treino" text={readiness.trainingAdvice} />
        <Advice icon={Timer} label="Cardio" text={readiness.cardioAdvice} />
        {!compact && <Advice icon={Salad} label="Comida" text={readiness.foodAdvice} />}
      </div>}

      {checkin && readiness.reasons.length > 0 && (
        <details className="readiness-reasons-v36 gym-secondary-details"><summary>O que influenciou</summary>
          {readiness.reasons.map((reason) => <p key={reason}>{reason}</p>)}
        </details>
      )}

      {!checkin && (
        <button className="primary-btn readiness-checkin-v36" type="button" onClick={() => onNavigate?.('register', { registerTab: 'checkin' })}>
          <Activity size={16} /> Fazer check-in
        </button>
      )}

      {!compact && !readiness.sleep && (
        <button className="ghost-btn readiness-checkin-v36" type="button" onClick={() => onNavigate?.('register', { registerTab: 'json' })}>
          <Moon size={16} /> Importar sono
        </button>
      )}
    </section>
  );
}

function Advice({ icon: Icon, label, text }) {
  return (
    <div className="readiness-advice-v36">
      <Icon size={17} />
      <div>
        <span>{label}</span>
        <strong>{text}</strong>
      </div>
    </div>
  );
}
