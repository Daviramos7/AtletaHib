import { useMemo, useState } from 'react';
import { getReasonLabel, getReplacementReasons, getReplacementSummary, getSmartReplacements } from '../utils/exerciseSubstitutions';

export default function ExerciseReplacementPanel(props: any) {
  const {
    exerciseName,
    selectedReason,
    onReasonChange,
    onConfirm,
    onCancel,
  } = props;

  const [pending, setPending] = useState(null);
  const reasons = getReplacementReasons();
  const options = useMemo(() => getSmartReplacements(exerciseName, selectedReason), [exerciseName, selectedReason]);
  const focus = getReplacementSummary(exerciseName);

  function toggleReason(reasonId) {
    setPending(null);
    onReasonChange(selectedReason === reasonId ? '' : reasonId);
  }

  function togglePending(option) {
    const reasonLabel = selectedReason ? getReasonLabel(selectedReason) : 'Substituição manual';
    const meta = {
      reasonId: selectedReason || null,
      reasonLabel,
      focus: option.focus,
      tag: option.tag,
      detail: option.reason,
      safetyNote: option.safetyNote,
    };

    setPending((current) => current?.name === option.name ? null : { name: option.name, meta });
  }

  return (
    <div className="smart-replacement-panel-v33">
      <div className="smart-replacement-head-v33">
        <div>
          <p className="eyebrow">Substituir exercício</p>
          <h4>{exerciseName}</h4>
          <span>Foco: {focus}</span>
        </div>
        <button type="button" onClick={onCancel}>Fechar</button>
      </div>

      <div className="replacement-reason-tabs-v33">
        {reasons.map((reason) => (
          <button
            key={reason.id}
            type="button"
            className={selectedReason === reason.id ? 'active' : ''}
            onClick={() => toggleReason(reason.id)}
          >
            <strong>{reason.label}</strong>
            <span>{selectedReason === reason.id ? 'Selecionado · toque de novo para limpar' : reason.hint}</span>
          </button>
        ))}
      </div>

      <div className="smart-replacement-options-v33">
        {options.map((option) => (
          <button
            key={option.name}
            type="button"
            className={pending?.name === option.name ? 'selected' : ''}
            onClick={() => togglePending(option)}
          >
            <div>
              <strong>{option.name}</strong>
              <span>{option.reason}</span>
            </div>
            <small>{pending?.name === option.name ? 'Selecionado' : option.tag}</small>
          </button>
        ))}
      </div>

      {pending ? (
        <div className="replacement-confirm-v332">
          <div>
            <strong>Trocar para {pending.name}?</strong>
            <span>As séries, kg, reps e RPE já preenchidos serão mantidos.</span>
          </div>
          <div>
            <button type="button" className="ghost-btn" onClick={() => setPending(null)}>Desmarcar</button>
            <button type="button" className="primary-btn" onClick={() => onConfirm(pending.name, pending.meta)}>Confirmar troca</button>
          </div>
        </div>
      ) : (
        <p className="replacement-safety-v33">
          Escolha uma opção acima. Nada será alterado até você confirmar.
        </p>
      )}
    </div>
  );
}
