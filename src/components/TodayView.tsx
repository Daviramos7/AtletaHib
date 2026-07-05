import { useEffect, useMemo, useState } from 'react';
import { Activity, Dumbbell, Moon, Salad, Timer, Watch } from 'lucide-react';
import { buildTodayPlan, getDayKindLabel, getWeekdayLabel } from '../utils/trainingPlanUtils';
import { listCardioSessions } from '../services/cardioService';
import CardioPlanCard from './CardioPlanCard';
import ReadinessCard from './ReadinessCard';
import { WaterQuickCard } from './WaterView';
import DailyStatusCard from './DailyStatusCard';
import DataQualityCard from './DataQualityCard';

export default function TodayView(props: any) {
  const { userId, trainingPlan, onNavigate, onError } = props;
  const [cardioSessions, setCardioSessions] = useState([]);
  const [selectedCardioChoice, setSelectedCardioChoice] = useState('');
  const todayPlan = useMemo(() => buildTodayPlan(trainingPlan), [trainingPlan]);
  const weekday = new Date().getDay();

  useEffect(() => {
    async function loadCardio() {
      if (!userId) return;

      try {
        setCardioSessions(await listCardioSessions(userId, 24));
      } catch (err) {
        onError?.(err.message);
      }
    }

    loadCardio();
  }, [onError, userId]);

  useEffect(() => {
    setSelectedCardioChoice(todayPlan.cardioOptions[0]?.label ?? '');
  }, [todayPlan.cardioOptions]);

  return (
    <div className="simple-page today-simple-page">
      <div className="simple-hero">
        <div>
          <p className="eyebrow">{getWeekdayLabel(weekday)} · Hoje</p>
          <h2>{todayPlan.title}</h2>
          <p>{todayPlan.description}</p>
        </div>
        <span className={`day-kind-badge ${todayPlan.dayKind}`}>{getDayKindLabel(todayPlan.dayKind)}</span>
      </div>

      <section className="simple-panel today-plan-card">
        <p className="eyebrow">Plano de hoje</p>
        <div className="today-binary-grid">
          <StatusTile icon={Dumbbell} label="Força" active={todayPlan.strength} />
          <StatusTile icon={Timer} label="Cardio" active={todayPlan.cardio} />
        </div>
        <button className="primary-btn big-action-btn" type="button" onClick={() => onNavigate('gym')}>
          {todayPlan.action}
        </button>
      </section>

      <ReadinessCard userId={userId} todayPlan={todayPlan} onError={onError} onNavigate={onNavigate} />

      <WaterQuickCard userId={userId} profile={props.profile} onError={onError} onNavigate={onNavigate} />

      <DailyStatusCard userId={userId} profile={props.profile} todayPlan={todayPlan} onError={onError} onNavigate={onNavigate} />

      <DataQualityCard userId={userId} todayPlan={todayPlan} onNavigate={onNavigate} />

      {todayPlan.strength && (
        <section className="simple-panel">
          <div className="simple-section-head">
            <div>
              <p className="eyebrow">Força</p>
              <h3>{todayPlan.strengthEntries.length} exercício(s)</h3>
            </div>
            <button className="ghost-btn" type="button" onClick={() => onNavigate('gym')}>Abrir</button>
          </div>

          <div className="compact-list">
            {todayPlan.strengthEntries.slice(0, 4).map((entry) => (
              <div className="compact-item" key={entry.id ?? entry.position}>
                <strong>{entry.exercise_name}</strong>
                <span>{entry.sets} · {entry.reps}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {todayPlan.cardio && (
        <CardioPlanCard
          cardioSessions={cardioSessions}
          cardioOptions={todayPlan.cardioOptions}
          selectedCardioChoice={selectedCardioChoice}
          onSelectCardioChoice={setSelectedCardioChoice}
        />
      )}

      <section className="simple-panel quick-tiles">
        <button type="button" onClick={() => onNavigate('register')}><Salad size={18} /> Registrar</button>
        <button type="button" onClick={() => onNavigate('progressHub')}><Moon size={18} /> Progresso</button>
        <button type="button" onClick={() => onNavigate('integrations')}><Watch size={18} /> Saúde</button>
        <button type="button" onClick={() => onNavigate('profile')}><Activity size={18} /> Perfil</button>
      </section>
    </div>
  );
}

function StatusTile({ icon: Icon, label, active }) {
  return (
    <div className={`status-tile ${active ? 'active' : ''}`}>
      <Icon size={20} />
      <span>{label}</span>
      <strong>{active ? 'Sim' : 'Não'}</strong>
    </div>
  );
}
