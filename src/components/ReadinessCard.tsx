import { useEffect, useMemo, useState } from 'react';
import { Activity, Dumbbell, Moon, Salad, Timer } from 'lucide-react';
import { getCheckin } from '../services/checkinService';
import { listCardioSessions } from '../services/cardioService';
import { listSleepSessions } from '../services/sleepService';
import { listWorkoutHistory } from '../services/workoutService';
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

  const readiness = useMemo(() => buildDailyReadiness({
    checkin,
    sleepSessions,
    workoutHistory,
    cardioSessions,
    todayPlan,
  }), [checkin, sleepSessions, workoutHistory, cardioSessions, todayPlan]);

  return (
    <section className={`simple-panel readiness-card-v36 ${readiness.tone} ${compact ? 'compact' : ''}`}>
      <div className="readiness-main-v36">
        <div>
          <p className="eyebrow">Prontidão do dia</p>
          <h3>{loading ? '...' : readiness.score}</h3>
          <span>{readiness.label} · {readiness.headline}</span>
        </div>

        <div className="readiness-ring-v36" aria-label={`Prontidão ${readiness.score} de 100`}>
          <strong>{readiness.score}</strong>
          <small>/100</small>
        </div>
      </div>

      <div className="readiness-flags-v36">
        {readiness.flags.map((flag) => <span key={flag}>{flag}</span>)}
      </div>

      <div className="readiness-actions-v36">
        <Advice icon={Dumbbell} label="Treino" text={readiness.trainingAdvice} />
        <Advice icon={Timer} label="Cardio" text={readiness.cardioAdvice} />
        {!compact && <Advice icon={Salad} label="Comida" text={readiness.foodAdvice} />}
      </div>

      {!compact && readiness.reasons.length > 0 && (
        <div className="readiness-reasons-v36">
          {readiness.reasons.map((reason) => <p key={reason}>{reason}</p>)}
        </div>
      )}

      {!checkin && (
        <button className="ghost-btn readiness-checkin-v36" type="button" onClick={() => onNavigate?.('register')}>
          <Activity size={16} /> Fazer check-in
        </button>
      )}

      {!readiness.sleep && (
        <button className="ghost-btn readiness-checkin-v36" type="button" onClick={() => onNavigate?.('progressHub')}>
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
