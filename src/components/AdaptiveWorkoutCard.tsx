import { Activity, AlertTriangle, CheckCircle2, ChevronDown, Clock3, Dumbbell, Gauge, Timer } from 'lucide-react';
import type { AdaptiveWorkoutRecommendation } from '../domain/adaptiveWorkout';

interface AdaptiveWorkoutCardProps {
  recommendation: AdaptiveWorkoutRecommendation;
  loading?: boolean;
  started?: boolean;
  activeVariant?: 'base' | 'adapted' | string;
  activeStartedAt?: string | null;
  activeSessionLocalDate?: string | null;
  selectedToday?: boolean;
  showDetails?: boolean;
  onToggleDetails: () => void;
  onStartRecommended: () => void;
  onUseBase: () => void;
  onCheckin: () => void;
}

export default function AdaptiveWorkoutCard(props: AdaptiveWorkoutCardProps) {
  const { recommendation, loading, started, selectedToday = true, showDetails = false } = props;

  if (started) {
    return (
      <section className="simple-panel adaptive-workout-card-v413 good">
        <div className="adaptive-workout-title-v413">
          <Gauge size={21} />
          <div>
            <p className="eyebrow">Sessão em andamento</p>
            <h3>{props.activeVariant === 'adapted' ? 'Treino adaptado' : 'Treino-base'}</h3>
          </div>
        </div>
        <p className="muted-text">
          Início preservado: {formatStartedAt(props.activeStartedAt)} · sessão local {formatLocalDate(props.activeSessionLocalDate)}.
          O check-in só será exigido para uma nova recomendação.
        </p>
      </section>
    );
  }

  if (!selectedToday) {
    return (
      <section className="simple-panel adaptive-workout-card-v413 neutral">
        <div className="adaptive-workout-title-v413">
          <Dumbbell size={21} />
          <div><p className="eyebrow">Consulta do plano</p><h3>Treino-base deste dia</h3></div>
        </div>
        <p className="muted-text">A recomendação adaptativa é calculada somente para a data local de hoje.</p>
      </section>
    );
  }

  if (loading) {
    return <section className="simple-panel adaptive-workout-card-v413 neutral"><p className="eyebrow">Treino de hoje</p><h3>Preparando recomendação…</h3></section>;
  }

  if (!recommendation.checkinValid) {
    return (
      <section className="simple-panel adaptive-workout-card-v413 awaiting">
        <div className="adaptive-workout-title-v413">
          <Activity size={22} />
          <div><p className="eyebrow">Treino de hoje</p><h3>Faça seu check-in da manhã</h3></div>
        </div>
        <p>Precisamos dos sinais de hoje para preparar o treino. O plano e o histórico continuam disponíveis.</p>
        <div className="adaptive-workout-actions-v413">
          <button className="primary-btn" type="button" onClick={props.onCheckin}><Activity size={16} /> Fazer check-in agora</button>
          <button className="ghost-btn" type="button" onClick={props.onUseBase}><Dumbbell size={16} /> Usar treino-base</button>
        </div>
      </section>
    );
  }

  const tone = ({ boa: 'good', moderada: 'warning', baixa: 'danger', recuperacao: 'danger' })[recommendation.readinessLevel] ?? 'neutral';
  const changedCount = recommendation.adaptedExercises.filter((item) => item.action !== 'keep').length;

  return (
    <section className={`simple-panel adaptive-workout-card-v413 ${tone}`}>
      <div className="adaptive-workout-score-v413">
        <div>
          <p className="eyebrow">Treino recomendado</p>
          <h3>Prontidão {formatLevel(recommendation.readinessLevel)}</h3>
          <span>{recommendation.workoutMode === 'retorno' ? 'Modo de retorno ativo' : `${changedCount} ajuste(s) no treino-base`}</span>
        </div>
        <strong>{recommendation.readinessScore}<small>/100</small></strong>
      </div>

      <div className="adaptive-workout-metrics-v413">
        <Metric icon={Clock3} label="Tempo" value={recommendation.estimatedMinutes.label} />
        <Metric icon={Dumbbell} label="Força" value={`~${recommendation.estimatedMinutes.strength} min`} />
        <Metric icon={Timer} label="Cardio" value={`${recommendation.cardioGuidance.minutes} min`} />
      </div>

      <div className="adaptive-workout-summary-v413">
        {recommendation.recommendations.slice(0, 3).map((item) => <p key={item}><CheckCircle2 size={15} /> {item}</p>)}
      </div>

      <div className="adaptive-workout-actions-v413">
        <button className="primary-btn" type="button" onClick={props.onStartRecommended}><Dumbbell size={16} /> Iniciar treino recomendado</button>
        <button className="ghost-btn" type="button" onClick={props.onUseBase}>Usar treino-base</button>
      </div>

      <button className="adaptive-details-toggle-v413" type="button" aria-expanded={showDetails} onClick={props.onToggleDetails}>
        Ver motivos e alterações <ChevronDown className={showDetails ? 'open' : ''} size={17} />
      </button>

      {showDetails && (
        <div className="adaptive-details-v413">
          <div><p className="eyebrow">Por quê</p>{recommendation.reasons.map((reason) => <p key={reason}>{reason}</p>)}</div>
          <div><p className="eyebrow">Intensidade</p><p>{recommendation.intensityGuidance}</p><p>{recommendation.cardioGuidance.text}</p></div>
          {recommendation.adaptedExercises.some((item) => item.action !== 'keep') && (
            <div><p className="eyebrow">Por exercício</p>{recommendation.adaptedExercises.filter((item) => item.action !== 'keep').map((item) => <p key={String(item.exercise.id ?? item.exercise.exercise_name)}><strong>{item.exercise.exercise_name}</strong>: {item.targetSets === 0 ? 'removido da sessão' : `${item.targetSets}/${item.baseSets} séries`} · {item.reason}</p>)}</div>
          )}
          {recommendation.warnings.map((warning) => <p className="adaptive-warning-v413" key={warning}><AlertTriangle size={15} /> {warning}</p>)}
        </div>
      )}
    </section>
  );
}

function Metric({ icon: Icon, label, value }) {
  return <div><Icon size={16} /><span>{label}</span><strong>{value}</strong></div>;
}

function formatLevel(level: AdaptiveWorkoutRecommendation['readinessLevel']) {
  if (level === 'recuperacao') return 'de recuperação';
  if (level === 'aguardando_checkin') return 'aguardando check-in';
  return level;
}

function formatStartedAt(value?: string | null) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '--';
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatLocalDate(value?: string | null) {
  const match = String(value ?? '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : '--';
}
