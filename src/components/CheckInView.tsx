import { useCallback, useEffect, useMemo, useState } from 'react';
import { Save, ShieldAlert } from 'lucide-react';
import { calculateReadiness, getCheckin, upsertCheckin } from '../services/checkinService';
import { todayKey } from '../services/dailyService';

const INITIAL = {
  log_date: todayKey(),
  sleep_hours: '',
  energy_score: 7,
  hunger_score: 5,
  stress_score: 5,
  pain_level: 0,
  soreness_level: 3,
  steps: '',
  lactose_symptoms: false,
  cravings_notes: '',
  notes: '',
};

export default function CheckInView({ userId, onError }) {
  const [form, setForm] = useState(INITIAL);
  const [saved, setSaved] = useState(null);

  const load = useCallback(async (date = form.log_date) => {
    try {
      const data = await getCheckin(userId, date);
      if (data) {
        setForm({
          log_date: data.log_date,
          sleep_hours: data.sleep_hours ?? '',
          energy_score: data.energy_score ?? 7,
          hunger_score: data.hunger_score ?? 5,
          stress_score: data.stress_score ?? 5,
          pain_level: data.pain_level ?? 0,
          soreness_level: data.soreness_level ?? 3,
          steps: data.steps ?? '',
          lactose_symptoms: Boolean(data.lactose_symptoms),
          cravings_notes: data.cravings_notes ?? '',
          notes: data.notes ?? '',
        });
        setSaved(data);
      } else {
        setForm((_old) => ({ ...INITIAL, log_date: date }));
        setSaved(null);
      }
    } catch (err) {
      onError(err.message);
    }
  }, [form.log_date, onError, userId]);

  useEffect(() => { load(INITIAL.log_date); }, [load]);

  const readiness = useMemo(() => calculateReadiness(form), [form]);

  async function handleSubmit(event) {
    event.preventDefault();
    try {
      const data = await upsertCheckin(userId, form);
      setSaved(data);
      onError('Check-in salvo. Agora o app consegue tomar decisões melhores.');
    } catch (err) {
      onError(err.message);
    }
  }

  function update(key, value) {
    setForm((old) => ({ ...old, [key]: value }));
  }

  return (
    <div>
      <div className="page-title">
        <div>
          <p className="eyebrow">Check-in</p>
          <h2>Prontidão do dia</h2>
        </div>
        <input className="date-input" type="date" value={form.log_date} onChange={(e) => load(e.target.value)} />
      </div>

      <section className={`panel readiness-panel ${readiness.tone}`}>
        <div>
          <p className="eyebrow">Score de prontidão</p>
          <h3>{readiness.score}/100 · {readiness.label}</h3>
          <p>{readiness.advice}</p>
        </div>
        <ShieldAlert size={38} />
      </section>

      <form className="panel form-grid" onSubmit={handleSubmit}>
        <p className="eyebrow full">Dados rápidos</p>
        <label>Sono em horas
          <input type="number" min="0" max="14" step="0.25" value={form.sleep_hours} onChange={(e) => update('sleep_hours', e.target.value)} />
        </label>
        <label>Energia 1-10
          <input type="number" min="1" max="10" value={form.energy_score} onChange={(e) => update('energy_score', e.target.value)} />
        </label>
        <label>Fome 1-10
          <input type="number" min="1" max="10" value={form.hunger_score} onChange={(e) => update('hunger_score', e.target.value)} />
        </label>
        <label>Estresse 1-10
          <input type="number" min="1" max="10" value={form.stress_score} onChange={(e) => update('stress_score', e.target.value)} />
        </label>
        <label>Dor articular 0-10
          <input type="number" min="0" max="10" value={form.pain_level} onChange={(e) => update('pain_level', e.target.value)} />
        </label>
        <label>Dor muscular 0-10
          <input type="number" min="0" max="10" value={form.soreness_level} onChange={(e) => update('soreness_level', e.target.value)} />
        </label>
        <label>Passos estimados
          <input type="number" min="0" step="100" value={form.steps} onChange={(e) => update('steps', e.target.value)} />
        </label>
        <label className="check-row">
          <input type="checkbox" checked={form.lactose_symptoms} onChange={(e) => update('lactose_symptoms', e.target.checked)} /> sintomas alimentares hoje
        </label>
        <label className="full">Fome/compulsão
          <textarea value={form.cravings_notes} onChange={(e) => update('cravings_notes', e.target.value)} placeholder="Ex.: vontade forte de doce à noite, fome depois do treino..." />
        </label>
        <label className="full">Notas
          <textarea value={form.notes} onChange={(e) => update('notes', e.target.value)} placeholder="Sono ruim, dor na canela, treino pesado, dia tranquilo..." />
        </label>
        <button className="primary-btn"><Save size={16} /> Salvar check-in</button>
      </form>

      <section className="panel warning-panel">
        <p className="eyebrow">Regra de decisão</p>
        <p>Se dor articular estiver alta, o app vai te empurrar para caminhada, bike ou treino controlado. Isso não é fraqueza; é evitar ficar parado por lesão.</p>
        {saved && <p className="muted">Último salvamento: {new Date(saved.updated_at ?? saved.created_at).toLocaleString('pt-BR')}</p>}
      </section>
    </div>
  );
}
