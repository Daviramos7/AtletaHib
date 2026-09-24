import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, Droplets, Dumbbell, Flame, Footprints, Moon, Salad, Save, ShieldAlert, RefreshCw, Timer } from 'lucide-react';
import { getCheckin, upsertCheckin } from '../services/checkinService';
import { todayKey } from '../services/dailyService';
import { loadCheckinAutofill } from '../services/checkinAutofillService';
import { calculateReadiness } from '../domain/readiness';
import { PageHeader } from './ui';

const INITIAL = {
  log_date: todayKey(),
  sleep_hours: '',
  energy_score: '',
  hunger_score: '',
  stress_score: '',
  recovery_score: '',
  pain_level: '',
  soreness_level: '',
  available_minutes: '',
  joint_pain_locations: [],
  muscle_soreness_locations: [],
  steps: '',
  lactose_symptoms: false,
  cravings_notes: '',
  notes: '',
  morning_notes: '',
  evening_notes: '',
};

const JOINT_LOCATIONS = [
  ['ombro', 'Ombro'], ['cotovelo', 'Cotovelo'], ['punho', 'Punho'], ['lombar', 'Lombar'],
  ['quadril', 'Quadril'], ['joelho', 'Joelho'], ['tornozelo', 'Tornozelo'], ['outro', 'Outro'],
];

const MUSCLE_LOCATIONS = [
  ['quadriceps', 'Quadríceps'], ['posterior_de_coxa', 'Posterior'], ['gluteos', 'Glúteos'], ['peito', 'Peito'],
  ['costas', 'Costas'], ['ombros', 'Ombros'], ['biceps', 'Bíceps'], ['triceps', 'Tríceps'],
  ['panturrilhas', 'Panturrilhas'], ['core', 'Core'], ['outro', 'Outro'],
];

export default function CheckInView({ userId, onError, onCheckinSaved }) {
  const [form, setForm] = useState(() => ({ ...INITIAL, log_date: todayKey() }));
  const [saved, setSaved] = useState(null);
  const [autoData, setAutoData] = useState(null);
  const [loadingAuto, setLoadingAuto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState('morning');

  const load = useCallback(async (date = todayKey()) => {
    if (!date) return;
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
          energy_score: checkinData.energy_score ?? '',
          hunger_score: checkinData.hunger_score ?? '',
          stress_score: checkinData.stress_score ?? '',
          recovery_score: checkinData.recovery_score ?? '',
          pain_level: checkinData.pain_level ?? '',
          soreness_level: checkinData.soreness_level ?? '',
          available_minutes: checkinData.available_minutes ?? '',
          joint_pain_locations: checkinData.joint_pain_locations ?? [],
          muscle_soreness_locations: checkinData.muscle_soreness_locations ?? [],
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
      console.error('Falha ao carregar check-in', err);
      onError('Não foi possível carregar o check-in. Tente abrir a data novamente.');
    } finally {
      setLoadingAuto(false);
    }
  }, [onError, userId]);

  useEffect(() => { load(); }, [load]);

  const readiness = useMemo(() => calculateReadiness({ checkin: form }), [form]);
  const hasAutoBasics = autoData?.sleep_hours != null || autoData?.steps != null;
  const hasReadinessSignals = [form.sleep_hours, form.energy_score, form.recovery_score, form.hunger_score, form.stress_score, form.pain_level, form.soreness_level].some((value) => value !== '' && value != null);
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
        recovery_score: data?.recovery_score ?? old.recovery_score,
        pain_level: data?.pain_level ?? old.pain_level,
        soreness_level: data?.soreness_level ?? old.soreness_level,
        available_minutes: data?.available_minutes ?? old.available_minutes,
        joint_pain_locations: data?.joint_pain_locations ?? old.joint_pain_locations,
        muscle_soreness_locations: data?.muscle_soreness_locations ?? old.muscle_soreness_locations,
        steps: valueAsInput(data?.steps ?? old.steps),
        lactose_symptoms: Boolean(data?.lactose_symptoms ?? old.lactose_symptoms),
        cravings_notes: data?.cravings_notes ?? old.cravings_notes,
        notes: data?.notes ?? old.notes,
        morning_notes: data?.morning_notes ?? old.morning_notes,
        evening_notes: data?.evening_notes ?? old.evening_notes,
      }));
      onError?.(isMorning ? 'Check-in da manhã salvo.' : 'Fechamento do dia salvo.');
      if (isMorning) onCheckinSaved?.(data, mode);
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

  function toggleLocation(key, location) {
    setForm((old) => {
      const current = Array.isArray(old[key]) ? old[key] : [];
      return { ...old, [key]: current.includes(location) ? current.filter((item) => item !== location) : [...current, location] };
    });
  }

  function applyAutomaticData() {
    if (!autoData) return;

    setForm((old) => ({
      ...old,
      sleep_hours: valueAsInput(autoData.sleep_hours) || old.sleep_hours,
      steps: valueAsInput(autoData.steps) || old.steps,
    }));

    onError('Sono e passos atualizados.');
  }

  return (
    <div>
      <PageHeader
        title={isMorning ? 'Check-in da manhã' : 'Fechamento do dia'}
        description={isMorning ? 'Como você acordou? Preencha o que souber.' : 'Complete os registros de hoje.'}
        action={<input aria-label="Data do check-in" className="date-input" type="date" value={form.log_date} disabled={loadingAuto || saving} onChange={(e) => load(e.target.value)} />}
      />

      <div className="checkin-mode-tabs-v406">
        <button type="button" aria-pressed={isMorning} className={isMorning ? 'active' : ''} onClick={() => changeMode('morning')}>
          Manhã
          <span>sono, energia, fome, dor</span>
        </button>
        <button type="button" aria-pressed={!isMorning} className={!isMorning ? 'active' : ''} onClick={() => changeMode('evening')}>
          Fechamento
          <span>passos, compulsão, notas</span>
        </button>
      </div>

      <form className="panel form-grid smart-checkin-form-v372 split-checkin-v406" onSubmit={handleSubmit} noValidate>
        <p className="muted-text full">Campos em branco ficam sem resposta. Nas escalas, 1 é baixo e 10 é alto; dor 0 significa sem dor.</p>

        {isMorning ? (
          <>
            <label>Sono em horas
              <input type="text" inputMode="decimal" value={form.sleep_hours} onChange={(e) => update('sleep_hours', e.target.value)} />
              <span className="field-hint-v401">Use o valor do relógio. Ex.: 7h23 = 7.38h.</span>
            </label>

            <label>Energia 1-10
              <input type="number" min="1" max="10" value={form.energy_score} onChange={(e) => update('energy_score', e.target.value)} />
            </label>
            <label>Recuperação 1-10
              <input type="number" min="1" max="10" value={form.recovery_score} onChange={(e) => update('recovery_score', e.target.value)} />
            </label>
            <label>Tempo disponível
              <select value={form.available_minutes} onChange={(e) => update('available_minutes', e.target.value)}>
                <option value="">Não informado · usar o plano</option>
                <option value="30">30 min</option>
                <option value="40">40 min</option>
                <option value="45">45 min</option>
                <option value="50">50 min</option>
              </select>
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
            {Number(form.pain_level) > 0 && <LocationPicker label="Onde há dor articular? (opcional)" options={JOINT_LOCATIONS} value={form.joint_pain_locations} onToggle={(location) => toggleLocation('joint_pain_locations', location)} />}
            {Number(form.soreness_level) >= 4 && <LocationPicker label="Onde há dor muscular? (opcional)" options={MUSCLE_LOCATIONS} value={form.muscle_soreness_locations} onToggle={(location) => toggleLocation('muscle_soreness_locations', location)} />}
            <details className="full disclosure-panel">
              <summary>Sintomas e notas (opcional)</summary>
            <label className="check-row">
              <input type="checkbox" checked={form.lactose_symptoms} onChange={(e) => update('lactose_symptoms', e.target.checked)} /> sintomas alimentares hoje
            </label>
            <label className="full">Notas da manhã
              <textarea value={form.notes} onChange={(e) => update('notes', e.target.value)} placeholder="Algo que afete seu treino hoje" rows={3} />
            </label>
            </details>
          </>
        ) : (
          <>
            <label>Passos
              <input type="text" inputMode="numeric" value={form.steps} onChange={(e) => update('steps', e.target.value)} />
              <span className="field-hint-v401">Total mostrado pelo relógio.</span>
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
              <textarea value={form.cravings_notes} onChange={(e) => update('cravings_notes', e.target.value)} placeholder="Fome após o treino, vontade de doce…" rows={3} />
            </label>
            <label className="full">Fechamento do dia
              <textarea value={form.notes} onChange={(e) => update('notes', e.target.value)} placeholder="Algo que queira registrar" rows={3} />
            </label>
          </>
        )}

        <button className="primary-btn" type="submit" disabled={saving || loadingAuto}><Save size={16} /> {saving ? 'Salvando...' : isMorning ? 'Salvar check-in' : 'Salvar fechamento'}</button>
      </form>

      {hasReadinessSignals && <details className={`panel disclosure-panel readiness-panel ${readiness.tone}`}>
        <summary>Prontidão prévia · {readiness.score}/100{readiness.confidence === 'low' ? ' · poucos dados' : ''}</summary>
        <div>
          <h3>{readiness.score}/100 · {readiness.label}</h3>
          <p>{readiness.advice}</p>
        </div>
        <ShieldAlert size={24} aria-hidden="true" />
      </details>}

      <details className="panel disclosure-panel smart-checkin-panel-v372">
        <summary>{loadingAuto ? 'Carregando registros…' : 'Dados já registrados'}</summary>
        <div className="section-title-row">
          <div>
            <p className="muted-text">Registros do app, JSON e Health Connect.</p>
          </div>
          <button className="ghost-btn" type="button" onClick={applyAutomaticData} disabled={!hasAutoBasics}>
            <RefreshCw size={16} /> Atualizar sono e passos
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
      </details>

      {saved && <p className="muted">{saved.updated_at || saved.created_at ? `Salvo em ${new Date(saved.updated_at ?? saved.created_at).toLocaleString('pt-BR')}` : 'Check-in salvo.'}</p>}
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

function LocationPicker({ label, options, value, onToggle }) {
  const selected = Array.isArray(value) ? value : [];
  return (
    <fieldset className="full checkin-location-picker-v413">
      <legend>{label}</legend>
      <div>
        {options.map(([id, text]) => (
          <button key={id} className={selected.includes(id) ? 'active' : ''} type="button" aria-pressed={selected.includes(id)} onClick={() => onToggle(id)}>{text}</button>
        ))}
      </div>
    </fieldset>
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

  if (message.includes('recovery_score') || message.includes('available_minutes') || message.includes('joint_pain_locations')) {
    return 'O treino adaptativo ainda não está pronto no Supabase. Rode a migration 2026_08_16_adaptive_workout.sql.';
  }

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
