import { useMemo, useState } from 'react';
import { CheckCircle2, Dumbbell, UserRound } from 'lucide-react';
import { markOnboardingComplete } from '../services/bootstrapService';
import { saveWeightLog } from '../services/weightService';
import { todayKey } from '../services/dailyService';
import { DIET_STYLE_OPTIONS, GOAL_OPTIONS, HEALTH_PLATFORM_OPTIONS, LEVEL_OPTIONS, PROFILE_FORM_DEFAULTS, SYNC_MODE_OPTIONS, WEARABLE_OPTIONS } from '../data/defaultPlan';

export default function OnboardingView({ userId, profile, onReady, onError }) {
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    ...PROFILE_FORM_DEFAULTS,
    ...(profile ?? {}),
    name: profile?.name ?? '',
    height_cm: profile?.height_cm ?? '',
    starting_weight_kg: profile?.starting_weight_kg ?? profile?.current_weight_kg ?? '',
    current_weight_kg: profile?.current_weight_kg ?? '',
    target_weight_kg: profile?.target_weight_kg ?? '',
  });

  const preview = useMemo(() => {
    const goal = GOAL_OPTIONS[form.main_goal] ?? 'Saúde geral';
    const level = LEVEL_OPTIONS[form.training_level] ?? 'Iniciante';
    return `${goal}, ${level.toLowerCase()}, ${form.weekly_strength_days}x força e ${form.weekly_cardio_days}x cardio por semana.`;
  }, [form]);

  function update(key, value) {
    setForm((old) => ({ ...old, [key]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const currentWeight = Number(form.current_weight_kg || form.starting_weight_kg);
      const payload = {
        ...form,
        name: form.name.trim(),
        height_cm: Number(form.height_cm),
        starting_weight_kg: Number(form.starting_weight_kg || currentWeight),
        current_weight_kg: currentWeight,
        target_weight_kg: Number(form.target_weight_kg),
        kcal_goal: Number(form.kcal_goal),
        water_goal_ml: Number(form.water_goal_ml),
        weekly_strength_days: Number(form.weekly_strength_days),
        weekly_cardio_days: Number(form.weekly_cardio_days),
        plays_football: Boolean(form.plays_football),
        objective: buildObjective(form),
        routine_notes: buildRoutineNotes(form),
        onboarding_completed: true,
        preferred_sync_mode: form.preferred_sync_mode,
        health_platform: form.health_platform,
      };

      validate(payload);
      const boot = await markOnboardingComplete(userId, payload);
      await saveWeightLog(userId, {
        log_date: todayKey(),
        weight_kg: payload.current_weight_kg,
        notes: 'Peso inicial configurado no onboarding.',
      });
      onReady(boot);
    } catch (err) {
      onError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="onboarding-page">
      <section className="onboarding-hero">
        <p className="eyebrow">Primeira configuração</p>
        <h1>Monte seu próprio perfil antes de entrar no app.</h1>
        <p>Nenhum dado de outro usuário é copiado. O plano, as metas e a rotina são gerados a partir das respostas desta tela.</p>
        <div className="onboarding-steps">
          <span><UserRound size={16} /> Perfil</span>
          <span><Dumbbell size={16} /> Rotina</span>
          <span><CheckCircle2 size={16} /> Plano inicial</span>
        </div>
      </section>

      <form className="panel form-grid onboarding-card" onSubmit={handleSubmit}>
        <label>Nome
          <input value={form.name ?? ''} onChange={(e) => update('name', e.target.value)} placeholder="Seu nome" required />
        </label>
        <label>Altura cm
          <input type="number" min="120" max="230" step="0.1" value={form.height_cm ?? ''} onChange={(e) => update('height_cm', e.target.value)} required />
        </label>
        <label>Peso atual kg
          <input type="number" min="30" max="300" step="0.1" value={form.current_weight_kg ?? ''} onChange={(e) => update('current_weight_kg', e.target.value)} required />
        </label>
        <label>Meta de peso kg
          <input type="number" min="30" max="300" step="0.1" value={form.target_weight_kg ?? ''} onChange={(e) => update('target_weight_kg', e.target.value)} required />
        </label>
        <label>Objetivo principal
          <select value={form.main_goal} onChange={(e) => update('main_goal', e.target.value)}>
            {Object.entries(GOAL_OPTIONS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>Nível de treino
          <select value={form.training_level} onChange={(e) => update('training_level', e.target.value)}>
            {Object.entries(LEVEL_OPTIONS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>Musculação/semana
          <select value={form.weekly_strength_days} onChange={(e) => update('weekly_strength_days', Number(e.target.value))}>
            {[2, 3, 4, 5].map((value) => <option key={value} value={value}>{value}x</option>)}
          </select>
        </label>
        <label>Cardio/semana
          <select value={form.weekly_cardio_days} onChange={(e) => update('weekly_cardio_days', Number(e.target.value))}>
            {[1, 2, 3, 4].map((value) => <option key={value} value={value}>{value}x</option>)}
          </select>
        </label>
        <label>Meta kcal diária
          <input type="number" min="1200" max="6000" value={form.kcal_goal ?? ''} onChange={(e) => update('kcal_goal', e.target.value)} required />
        </label>
        <label>Meta água ml
          <input type="number" min="1000" max="7000" value={form.water_goal_ml ?? ''} onChange={(e) => update('water_goal_ml', e.target.value)} required />
        </label>
        <label>Horário do almoço
          <input type="time" value={String(form.lunch_time ?? '12:30').slice(0, 5)} onChange={(e) => update('lunch_time', e.target.value)} />
        </label>
        <label>Horário preferido de treino
          <input type="time" value={String(form.training_time ?? '18:00').slice(0, 5)} onChange={(e) => update('training_time', e.target.value)} />
        </label>
        <label>Estilo de dieta
          <select value={form.diet_style} onChange={(e) => update('diet_style', e.target.value)}>
            {Object.entries(DIET_STYLE_OPTIONS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>Relógio / fonte de saúde
          <select value={form.wearable_provider} onChange={(e) => update('wearable_provider', e.target.value)}>
            {Object.entries(WEARABLE_OPTIONS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>Modo de sincronização desejado
          <select value={form.preferred_sync_mode} onChange={(e) => update('preferred_sync_mode', e.target.value)}>
            {Object.entries(SYNC_MODE_OPTIONS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>Plataforma intermediária
          <select value={form.health_platform} onChange={(e) => update('health_platform', e.target.value)}>
            {Object.entries(HEALTH_PLATFORM_OPTIONS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="check-row full">
          <input type="checkbox" checked={Boolean(form.plays_football)} onChange={(e) => update('plays_football', e.target.checked)} /> joga futebol ou quer treino com foco em arrancada/agilidade
        </label>
        <label className="full">Restrições alimentares
          <textarea value={form.dietary_restriction ?? ''} onChange={(e) => update('dietary_restriction', e.target.value)} placeholder="Ex.: sem lactose, vegetariano, alergias, alimentos que evita..." />
        </label>
        <label className="full">Observações de rotina
          <textarea value={form.routine_notes ?? ''} onChange={(e) => update('routine_notes', e.target.value)} placeholder="Ex.: trabalho, faculdade, horários difíceis, dias em que não treina..." />
        </label>

        <section className="panel full onboarding-preview">
          <p className="eyebrow">Prévia do plano</p>
          <h3>{preview}</h3>
          <p>Depois você pode editar exercícios, refeições, metas e regenerar o plano no Criador.</p>
        </section>

        <button className="primary-btn full" disabled={busy}>{busy ? 'Criando perfil...' : 'Criar meu plano e entrar'}</button>
      </form>
    </div>
  );
}

function buildObjective(form) {
  const goal = GOAL_OPTIONS[form.main_goal] ?? 'Saúde geral';
  return `${goal} com rotina de ${form.weekly_strength_days} treinos de força e ${form.weekly_cardio_days} cardios por semana.`;
}

function buildRoutineNotes(form) {
  const base = form.routine_notes?.trim();
  const diet = DIET_STYLE_OPTIONS[form.diet_style] ?? 'Flexível';
  const football = form.plays_football ? 'Inclui futebol/agilidade quando possível.' : 'Sem futebol obrigatório.';
  return [
    base,
    `Almoço preferencial: ${String(form.lunch_time || '12:30').slice(0, 5)}. Treino preferencial: ${String(form.training_time || '18:00').slice(0, 5)}.`,
    `Dieta: ${diet}. ${football}`,
  ].filter(Boolean).join(' ');
}

function validate(payload) {
  if (!payload.name) throw new Error('Informe seu nome.');
  if (payload.height_cm <= 0) throw new Error('Informe uma altura válida.');
  if (payload.current_weight_kg <= 0) throw new Error('Informe um peso atual válido.');
  if (payload.target_weight_kg <= 0) throw new Error('Informe uma meta de peso válida.');
  if (payload.kcal_goal < 1200) throw new Error('Meta calórica muito baixa para este app. Ajuste para um valor mais seguro.');
  if (payload.water_goal_ml < 1000) throw new Error('Meta de água muito baixa.');
}
