import { ShieldCheck, Timer, TrendingUp } from 'lucide-react';
import { getCardioProgression, getSelectedCardioOption } from '../utils/cardioProgression';

export default function CardioPlanCard(props: any) {
  const {
    cardioSessions = [],
    cardioOptions = [],
    selectedCardioChoice = '',
    onSelectCardioChoice,
    compact = false,
    recommendation = null,
    workoutSessions = [],
  } = props;

  const selectedOption = getSelectedCardioOption(cardioOptions, selectedCardioChoice);
  const progression = getCardioProgression(cardioSessions, selectedOption, { recommendation, workoutSessions });

  return (
    <section className={`simple-panel cardio-progress-card ${compact ? 'compact' : ''}`}>
      <div className="cardio-progress-head">
        <div>
          <p className="eyebrow">Progresso do cardio</p>
          <h3>{progression.phaseLabel}</h3>
          {progression.statusLabel && <span>{progression.statusLabel}</span>}
          <span>{progression.progressText} · {progression.completed} {progression.completed === 1 ? 'sessão registrada' : 'sessões registradas'}</span>
        </div>
        <TrendingUp size={24} />
      </div>

      <div className="cardio-prescription-card">
        <div>
          <p className="eyebrow">Cardio planejado</p>
          <h4>{selectedOption?.label ?? progression.title}</h4>
          <strong>{progression.workout}</strong>
        </div>
        <Timer size={22} />
      </div>

      <p className="cardio-prescription-text">{progression.prescription}</p>

      <div className="cardio-cap-note-v402">
        <ShieldCheck size={16} />
        <span>Até {progression.maxMinutes ?? 20} min recomendados. Registre a duração real, mesmo se passar.</span>
      </div>

      <div className="cardio-progress-meta">
        <span>{progression.intensity}</span>
        <span>{progression.goal}</span>
      </div>

      {cardioOptions.length > 1 && (
        <div className="cardio-options-mini">
          {cardioOptions.map((option) => (
            <button
              key={option.label}
              type="button"
              className={(selectedOption?.label ?? '') === option.label ? 'active' : ''}
              aria-pressed={(selectedOption?.label ?? '') === option.label}
              onClick={() => onSelectCardioChoice?.(option.label)}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}

      <small className="cardio-help-text">
        Avanço depende de execução vinculada, recência e prontidão. O histórico avulso continua preservado.
      </small>
    </section>
  );
}
