import { useEffect, useState } from 'react';
import { RotateCcw, Save } from 'lucide-react';
import { upsertProfile } from '../services/profileService';
import { resetPersonalizedTrainingPlan } from '../services/trainingService';
import { DIET_STYLE_OPTIONS, GOAL_OPTIONS, LEVEL_OPTIONS, PROFILE_FALLBACKS, WEARABLE_OPTIONS } from '../data/defaultPlan';

export default function PlanBuilderView({ userId, profile, refreshBoot, onError }) {
  const [form, setForm] = useState({ ...PROFILE_FALLBACKS, ...(profile ?? {}) });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setForm({ ...PROFILE_FALLBACKS, ...(profile ?? {}) });
  }, [profile]);

  function update(key, value) {
    setForm((old) => ({ ...old, [key]: value }));
  }

  async function saveProfileOnly(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await upsertProfile(userId, normalizedForm(form));
      await refreshBoot();
      onError('Preferências salvas.');
    } catch (err) {
      onError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function regeneratePlan() {
    if (!window.confirm('Gerar um novo plano personalizado? O plano ativo atual será arquivado, mas o histórico de treinos continua salvo.')) return;
    setBusy(true);
    try {
      const updatedProfile = await upsertProfile(userId, normalizedForm(form));
      await resetPersonalizedTrainingPlan(userId, updatedProfile);
      await refreshBoot();
      onError('Novo plano personalizado gerado.');
    } catch (err) {
      onError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="page-title">
        <div>
          <p className="eyebrow">Criador</p>
          <h2>Rotina, dieta e treino</h2>
        </div>
      </div>

      <section className="panel highlight-panel">
        <p className="eyebrow">Multiusuário real</p>
        <h3>Esta tela usa apenas as preferências do usuário logado.</h3>
        <p>Altere objetivos, restrições, horários e frequência de treino. O app gera uma rotina nova sem copiar perfil de ninguém.</p>
      </section>

      <form className="panel form-grid" onSubmit={saveProfileOnly}>
        <label>Objetivo principal
          <select value={form.main_goal ?? 'saude'} onChange={(e) => update('main_goal', e.target.value)}>
            {Object.entries(GOAL_OPTIONS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>Nível de treino
          <select value={form.training_level ?? 'iniciante'} onChange={(e) => update('training_level', e.target.value)}>
            {Object.entries(LEVEL_OPTIONS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>Musculação/semana
          <select value={form.weekly_strength_days ?? 3} onChange={(e) => update('weekly_strength_days', Number(e.target.value))}>
            {[2, 3, 4, 5].map((value) => <option key={value} value={value}>{value}x</option>)}
          </select>
        </label>
        <label>Cardio/semana
          <select value={form.weekly_cardio_days ?? 2} onChange={(e) => update('weekly_cardio_days', Number(e.target.value))}>
            {[1, 2, 3, 4].map((value) => <option key={value} value={value}>{value}x</option>)}
          </select>
        </label>
        <label>Meta kcal
          <input type="number" min="1200" max="6000" value={form.kcal_goal ?? ''} onChange={(e) => update('kcal_goal', e.target.value)} />
        </label>
        <label>Meta água ml
          <input type="number" min="1000" max="7000" value={form.water_goal_ml ?? ''} onChange={(e) => update('water_goal_ml', e.target.value)} />
        </label>
        <label>Almoço
          <input type="time" value={String(form.lunch_time ?? '12:30').slice(0, 5)} onChange={(e) => update('lunch_time', e.target.value)} />
        </label>
        <label>Treino
          <input type="time" value={String(form.training_time ?? '18:00').slice(0, 5)} onChange={(e) => update('training_time', e.target.value)} />
        </label>
        <label>Estilo de dieta
          <select value={form.diet_style ?? 'flexivel'} onChange={(e) => update('diet_style', e.target.value)}>
            {Object.entries(DIET_STYLE_OPTIONS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>Relógio / integração desejada
          <select value={form.wearable_provider ?? 'none'} onChange={(e) => update('wearable_provider', e.target.value)}>
            {Object.entries(WEARABLE_OPTIONS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="check-row full">
          <input type="checkbox" checked={Boolean(form.plays_football)} onChange={(e) => update('plays_football', e.target.checked)} /> incluir futebol/agilidade na rotina
        </label>
        <label className="full">Restrições alimentares
          <textarea value={form.dietary_restriction ?? ''} onChange={(e) => update('dietary_restriction', e.target.value)} />
        </label>
        <label className="full">Observações da rotina
          <textarea value={form.routine_notes ?? ''} onChange={(e) => update('routine_notes', e.target.value)} />
        </label>

        <div className="button-row full">
          <button className="ghost-btn" type="submit" disabled={busy}><Save size={16} /> Salvar preferências</button>
          <button className="primary-btn" type="button" disabled={busy} onClick={regeneratePlan}><RotateCcw size={16} /> Gerar novo plano</button>
        </div>
      </form>
    </div>
  );
}

function normalizedForm(form) {
  return {
    ...form,
    kcal_goal: Number(form.kcal_goal),
    water_goal_ml: Number(form.water_goal_ml),
    height_cm: Number(form.height_cm),
    starting_weight_kg: Number(form.starting_weight_kg || form.current_weight_kg),
    current_weight_kg: Number(form.current_weight_kg),
    target_weight_kg: Number(form.target_weight_kg),
    weekly_strength_days: Number(form.weekly_strength_days),
    weekly_cardio_days: Number(form.weekly_cardio_days),
    plays_football: Boolean(form.plays_football),
    onboarding_completed: true,
  };
}
