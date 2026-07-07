import { ShieldCheck, Timer, TrendingUp } from 'lucide-react';
import { getCardioProgression, getSelectedCardioOption } from '../utils/cardioProgression';

export default function CardioPlanCard(props: any) {
  const {
    cardioSessions = [],
    cardioOptions = [],
    selectedCardioChoice = '',
    onSelectCardioChoice,
    compact = false,
  } = props;

  const selectedOption = getSelectedCardioOption(cardioOptions, selectedCardioChoice);
  const progression = getCardioProgression(cardioSessions, selectedOption);

  return (
    <section className={`simple-panel cardio-progress-card ${compact ? 'compact' : ''}`}>
      <div className="cardio-progress-head">
        <div>
          <p className="eyebrow">Progresso do cardio</p>
          <h3>{progression.phaseLabel}</h3>
          <span>{progression.progressText} · {progression.completed} cardio(s) registrado(s)</span>
        </div>
        <TrendingUp size={24} />
      </div>

      <div className="cardio-prescription-card">
        <div>
          <p className="eyebrow">Faça hoje</p>
          <h4>{selectedOption?.label ?? progression.title}</h4>
          <strong>{progression.workout}</strong>
        </div>
        <Timer size={22} />
      </div>

      <p className="cardio-prescription-text">{progression.prescription}</p>

      <div className="cardio-cap-note-v402">
        <ShieldCheck size={16} />
        <span>Teto recomendado: {progression.maxMinutes ?? 20} min por sessão. Se fizer mais, registre o real, mas não use isso como meta.</span>
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
              onClick={() => onSelectCardioChoice?.(option.label)}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}

      <small className="cardio-help-text">
        Ao importar/registrar um cardio, o app avança automaticamente. A progressão aumenta qualidade e controle, não passa de 20 min.
      </small>
    </section>
  );
}
