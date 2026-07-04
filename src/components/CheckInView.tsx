import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, CheckCircle2, Droplets, Dumbbell, Flame, Footprints, Moon, Salad, Save, ShieldAlert, Sparkles, Timer } from 'lucide-react';
import { calculateReadiness, getCheckin, upsertCheckin } from '../services/checkinService';
import { todayKey } from '../services/dailyService';
import { loadCheckinAutofill } from '../services/checkinAutofillService';

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
  const [autoData, setAutoData] = useState(null);
  const [loadingAuto, setLoadingAuto] = useState(false);

  const load = useCallback(async (date = form.log_date) => {
    try {
      setLoadingAuto(true);
      const [checkinData, automaticData] = await Promise.all([
        getCheckin(userId, date),
        loadCheckinAutofill(userId, date),
      ]);

      setAutoData(automaticData);

      if (checkinData) {
        setForm({
          log_date: checkinData.log_date,
          sleep_hours: valueAsInput(checkinData.sleep_hours ?? automaticData.sleep_hours),
          energy_score: checkinData.energy_score ?? 7,
          hunger_score: checkinData.hunger_score ?? 5,
          stress_score: checkinData.stress_score ?? 5,
          pain_level: checkinData.pain_level ?? 0,
          soreness_level: checkinData.soreness_level ?? 3,
          steps: valueAsInput(checkinData.steps ?? automaticData.steps),
          lactose_symptoms: Boolean(checkinData.lactose_symptoms),
          cravings_notes: checkinData.cravings_notes ?? '',
          notes: checkinData.notes ?? '',
        });
        setSaved(checkinData);
      } else {
        setForm({
          ...INITIAL,
          log_date: date,
          sleep_hours: valueAsInput(automaticData.sleep_hours),
          steps: valueAsInput(automaticData.steps),
        });
        setSaved(null);
      }
    } catch (err: any) {
      onError(err.message);
    } finally {
      setLoadingAuto(false);
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
    } catch (err: any) {
      onError(err.message);
    }
  }

  function update(key, value) {
    setForm((old) => ({ ...old, [key]: value }));
  }

  function applyAutomaticData() {
    if (!autoData) return;

    setForm((old) => ({
      ...old,
      sleep_hours: valueAsInput(autoData.sleep_hours) || old.sleep_hours,
      steps: valueAsInput(autoData.steps) || old.steps,
    }));

    onError('Dados automáticos aplicados no check-in.');
  }

  const hasAutoBasics = Boolean(autoData?.sleep_hours || autoData?.steps);

  return (
    <div>
      <div className="page-title">
        <div>
          <p className="eyebrow">Check-in</p>
          <h2>Prontidão do dia</h2>
          <p className="muted-text">O app puxa o que já sabe. Você só responde sensação, dor, fome e estresse.</p>
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

      <section className="panel smart-checkin-panel-v372">
        <div className="section-title-row">
          <div>
            <p className="eyebrow">Dados puxados automaticamente</p>
            <h3>{loadingAuto ? 'Carregando...' : autoData?.has_data ? 'Base do dia encontrada' : 'Poucos dados automáticos'}</h3>
            <p className="muted-text">Esses dados vêm dos registros do próprio app, JSONs importados e Health Connect quando disponível.</p>
          </div>
          <button className="ghost-btn" type="button" onClick={applyAutomaticData} disabled={!hasAutoBasics}>
            <Sparkles size={16} /> Aplicar sono/passos
          </button>
        </div>

        <div className="smart-checkin-grid-v372">
          <AutoMetric icon={Moon} label="Sono" value={autoData?.sleep_hours ? `${autoData.sleep_hours}h` : '--'} sub={autoData?.sleep_source ?? 'sem dado'} ok={Boolean(autoData?.sleep_hours)} />
          <AutoMetric icon={Footprints} label="Passos" value={autoData?.steps ? formatNumber(autoData.steps) : '--'} sub={autoData?.steps_source ?? 'sem dado'} ok={Boolean(autoData?.steps)} />
          <AutoMetric icon={Droplets} label="Água" value={autoData?.water_ml ? `${formatNumber(autoData.water_ml)} ml` : '--'} sub="registro do dia" ok={Boolean(autoData?.water_ml)} />
          <AutoMetric icon={Salad} label="Comida" value={autoData?.kcal ? `${formatNumber(autoData.kcal)} kcal` : '--'} sub={`${autoData?.meals_count ?? 0} item(ns)`} ok={Boolean(autoData?.meals_count)} />
          <AutoMetric icon={Dumbbell} label="Treino" value={autoData?.workout_count ? 'feito' : '--'} sub={`${autoData?.workout_count ?? 0} sessão(ões)`} ok={Boolean(autoData?.workout_count)} />
          <AutoMetric icon={Timer} label="Cardio" value={autoData?.cardio_count ? 'feito' : '--'} sub={`${autoData?.cardio_count ?? 0} sessão(ões)`} ok={Boolean(autoData?.cardio_count)} />
          <AutoMetric icon={Flame} label="Kcal ativas" value={autoData?.active_kcal ? `${formatNumber(autoData.active_kcal)} kcal` : '--'} sub={autoData?.wearable_source ?? 'sem dado'} ok={Boolean(autoData?.active_kcal)} />
          <AutoMetric icon={Activity} label="Macros" value={autoData?.meals_count ? `P ${autoData.protein_g}g` : '--'} sub={autoData?.meals_count ? `C ${autoData.carbs_g}g · G ${autoData.fat_g}g` : 'sem refeições'} ok={Boolean(autoData?.meals_count)} />
        </div>
      </section>

      <form className="panel form-grid smart-checkin-form-v372" onSubmit={handleSubmit}>
        <p className="eyebrow full">Campos do check-in</p>

        <div className="full checkin-autofill-note-v372">
          <CheckCircle2 size={16} />
          <span>Sono e passos podem ser puxados automaticamente. Os campos de sensação continuam manuais porque o app não tem como adivinhar.</span>
        </div>

        <label>Sono em horas
          <input type="number" min="0" max="14" step="0.25" value={form.sleep_hours} onChange={(e) => update('sleep_hours', e.target.value)} />
        </label>
        <label>Passos
          <input type="number" min="0" step="100" value={form.steps} onChange={(e) => update('steps', e.target.value)} />
        </label>

        <p className="eyebrow full">Você responde</p>

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

function AutoMetric({ icon: Icon, label, value, sub, ok }) {
  return (
    <div className={ok ? 'auto-metric-v372 ok' : 'auto-metric-v372'}>
      <span><Icon size={15} /> {label}</span>
      <strong>{value}</strong>
      <small>{sub}</small>
    </div>
  );
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString('pt-BR');
}

function valueAsInput(value) {
  if (value === null || value === undefined || value === '') return '';
  return String(value);
}
