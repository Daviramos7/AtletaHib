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
  morning_notes: '',
  evening_notes: '',
};

export default function CheckInView({ userId, onError }) {
  const [form, setForm] = useState(INITIAL);
  const [saved, setSaved] = useState(null);
  const [autoData, setAutoData] = useState(null);
  const [loadingAuto, setLoadingAuto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState('morning');

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
          morning_notes: checkinData.morning_notes ?? checkinData.notes ?? '',
          evening_notes: checkinData.evening_notes ?? '',
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
  const hasAutoBasics = Boolean(autoData?.sleep_hours || autoData?.steps);
  const isMorning = mode === 'morning';

  async function handleSubmit(event) {
    event?.preventDefault?.();

    if (!userId) {
      onError?.('Usuário não encontrado. Faça login novamente.');
      return;
    }

    try {
      setSaving(true);
      const data = await upsertCheckin(userId, { ...form, checkin_mode: mode });
      setSaved(data);
      setForm((old) => ({
        ...old,
        log_date: data?.log_date ?? old.log_date,
        sleep_hours: valueAsInput(data?.sleep_hours ?? old.sleep_hours),
        energy_score: data?.energy_score ?? old.energy_score,
        hunger_score: data?.hunger_score ?? old.hunger_score,
        stress_score: data?.stress_score ?? old.stress_score,
        pain_level: data?.pain_level ?? old.pain_level,
        soreness_level: data?.soreness_level ?? old.soreness_level,
        steps: valueAsInput(data?.steps ?? old.steps),
        lactose_symptoms: Boolean(data?.lactose_symptoms ?? old.lactose_symptoms),
        cravings_notes: data?.cravings_notes ?? old.cravings_notes,
        notes: data?.notes ?? old.notes,
        morning_notes: data?.morning_notes ?? old.morning_notes,
        evening_notes: data?.evening_notes ?? old.evening_notes,
      }));
      onError?.(isMorning ? 'Check-in da manhã salvo.' : 'Fechamento do dia salvo.');
    } catch (err: any) {
      onError?.(friendlyCheckinError(err));
    } finally {
      setSaving(false);
    }
  }

  function update(key, value) {
    setForm((old) => key === 'notes'
      ? { ...old, notes: value, [isMorning ? 'morning_notes' : 'evening_notes']: value }
      : { ...old, [key]: value });
  }

  function changeMode(nextMode) {
    setMode(nextMode);
    setForm((old) => ({ ...old, notes: nextMode === 'morning' ? old.morning_notes : old.evening_notes }));
  }

  function applyAutomaticData() {
    if (!autoData) return;

    setForm((old) => ({
      ...old,
      sleep_hours: valueAsInput(autoData.sleep_hours) || old.sleep_hours,
      steps: valueAsInput(autoData.steps) || old.steps,
    }));

    onError('Valores do relógio aplicados sem arredondar.');
  }

  return (
    <div>
      <div className="page-title">
        <div>
          <p className="eyebrow">Check-in</p>
          <h2>{isMorning ? 'Check-in da manhã' : 'Fechamento do dia'}</h2>
          <p className="muted-text">
            {isMorning
              ? 'Use pela manhã para decidir treino, cardio e recuperação.'
              : 'Use à noite para fechar passos, fome/compulsão e observações do dia.'}
          </p>
        </div>
        <input className="date-input" type="date" value={form.log_date} onChange={(e) => load(e.target.value)} />
      </div>

      <div className="checkin-mode-tabs-v406">
        <button type="button" className={isMorning ? 'active' : ''} onClick={() => changeMode('morning')}>
          Manhã
          <span>sono, energia, fome, dor</span>
        </button>
        <button type="button" className={!isMorning ? 'active' : ''} onClick={() => changeMode('evening')}>
          Fechamento
          <span>passos, compulsão, notas</span>
        </button>
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
            <p className="muted-text">Esses dados vêm dos registros do app, JSONs importados e Health Connect quando disponível.</p>
          </div>
          <button className="ghost-btn" type="button" onClick={applyAutomaticData} disabled={!hasAutoBasics}>
            <Sparkles size={16} /> Usar valores do relógio
          </button>
        </div>

        <div className="smart-checkin-grid-v372">
          <AutoMetric icon={Moon} label="Sono" value={autoData?.sleep_hours ? `${autoData.sleep_hours}h` : '--'} sub={autoData?.sleep_source ? `${autoData.sleep_source} · valor exato` : 'sem dado'} ok={Boolean(autoData?.sleep_hours)} />
          <AutoMetric icon={Footprints} label="Passos" value={autoData?.steps ? formatNumber(autoData.steps) : '--'} sub={autoData?.steps_source ? `${autoData.steps_source} · valor exato` : 'sem dado'} ok={Boolean(autoData?.steps)} />
          <AutoMetric icon={Droplets} label="Água" value={autoData?.water_ml ? `${formatNumber(autoData.water_ml)} ml` : '--'} sub="registro do dia" ok={Boolean(autoData?.water_ml)} />
          <AutoMetric icon={Salad} label="Comida" value={autoData?.kcal ? `${formatNumber(autoData.kcal)} kcal` : '--'} sub={`${autoData?.meals_count ?? 0} item(ns)`} ok={Boolean(autoData?.meals_count)} />
          <AutoMetric icon={Dumbbell} label="Treino" value={autoData?.workout_count ? 'feito' : '--'} sub={`${autoData?.workout_count ?? 0} sessão(ões)`} ok={Boolean(autoData?.workout_count)} />
          <AutoMetric icon={Timer} label="Cardio" value={autoData?.cardio_count ? 'feito' : '--'} sub={`${autoData?.cardio_count ?? 0} sessão(ões)`} ok={Boolean(autoData?.cardio_count)} />
          <AutoMetric icon={Flame} label="Kcal ativas" value={autoData?.active_kcal ? `${formatNumber(autoData.active_kcal)} kcal` : '--'} sub={autoData?.wearable_source ?? 'sem dado'} ok={Boolean(autoData?.active_kcal)} />
          <AutoMetric icon={Activity} label="Macros" value={autoData?.meals_count ? `P ${formatMacro(autoData.protein_g)}` : '--'} sub={autoData?.meals_count ? `C ${formatMacro(autoData.carbs_g)} · G ${formatMacro(autoData.fat_g)}${autoData.macros_complete ? '' : ' · parcial'}` : 'sem refeições'} ok={Boolean(autoData?.meals_count)} />
        </div>
      </section>

      <form className="panel form-grid smart-checkin-form-v372 split-checkin-v406" onSubmit={handleSubmit} noValidate>
        <p className="eyebrow full">{isMorning ? 'Campos da manhã' : 'Campos do fechamento'}</p>

        <div className="full checkin-autofill-note-v372">
          <CheckCircle2 size={16} />
          <span>
            {isMorning
              ? 'De manhã, passos ainda podem estar incompletos. Foque em sono, energia, fome, estresse e dor.'
              : 'No fechamento, passos e observações do dia fazem mais sentido. Não precisa mudar sono se ele já veio do relógio.'}
          </span>
        </div>

        {isMorning ? (
          <>
            <label>Sono em horas
              <input type="text" inputMode="decimal" value={form.sleep_hours} onChange={(e) => update('sleep_hours', e.target.value)} />
              <span className="field-hint-v401">Use o valor do relógio. Ex.: 7h23 = 7.38h.</span>
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
            <label className="check-row">
              <input type="checkbox" checked={form.lactose_symptoms} onChange={(e) => update('lactose_symptoms', e.target.checked)} /> sintomas alimentares hoje
            </label>
            <label className="full">Notas da manhã
              <textarea value={form.notes} onChange={(e) => update('notes', e.target.value)} placeholder="Sono ruim, dor, treino pesado ontem, recuperação..." />
            </label>
          </>
        ) : (
          <>
            <label>Passos
              <input type="text" inputMode="numeric" value={form.steps} onChange={(e) => update('steps', e.target.value)} />
              <span className="field-hint-v401">Não arredonde. Se o relógio marcou 8437, salve 8437.</span>
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
            <label className="full">Fome/compulsão à noite
              <textarea value={form.cravings_notes} onChange={(e) => update('cravings_notes', e.target.value)} placeholder="Ex.: vontade forte de doce, ataque à geladeira, fome depois do treino..." />
            </label>
            <label className="full">Fechamento do dia
              <textarea value={form.notes} onChange={(e) => update('notes', e.target.value)} placeholder="Como foi o dia? treino, comida, sono, dor, algo fora do normal..." />
            </label>
          </>
        )}

        <button className="primary-btn" type="submit" disabled={saving}><Save size={16} /> {saving ? 'Salvando...' : isMorning ? 'Salvar check-in da manhã' : 'Salvar fechamento do dia'}</button>
      </form>

      <section className="panel warning-panel">
        <p className="eyebrow">Regra de uso</p>
        <p>Manhã serve para decidir o dia. Fechamento serve para registrar o que realmente aconteceu. Passos só fazem sentido completos no fim do dia.</p>
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

function formatMacro(value) {
  return value === null || value === undefined ? '--' : `${value}g`;
}

function friendlyCheckinError(error) {
  const message = String(error?.message ?? error ?? 'Erro desconhecido ao salvar check-in.');

  if (message.includes('daily_checkins') && (message.includes('does not exist') || message.includes('schema cache'))) {
    return 'A tabela daily_checkins não está pronta no Supabase. Rode a migration v3.9.5 e tente novamente.';
  }

  if (message.includes('ON CONFLICT') || message.includes('unique') || message.includes('constraint')) {
    return 'O Supabase não encontrou a chave única do check-in. Rode a migration v3.9.5 e tente novamente.';
  }

  if (message.includes('row-level security') || message.includes('violates row-level security')) {
    return 'O Supabase bloqueou por RLS. Faça login novamente; se continuar, rode a migration v3.9.5.';
  }

  return message;
}

function valueAsInput(value) {
  if (value === null || value === undefined || value === '') return '';
  return String(value);
}
