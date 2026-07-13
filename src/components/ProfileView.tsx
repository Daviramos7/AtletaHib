import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { upsertProfile } from '../services/profileService';
import { DIET_STYLE_OPTIONS, GOAL_OPTIONS, HEALTH_PLATFORM_OPTIONS, LEVEL_OPTIONS, PROFILE_FALLBACKS, SYNC_MODE_OPTIONS, WEARABLE_OPTIONS } from '../data/defaultPlan';
import { PageHeader } from './ui';

export default function ProfileView({ userId, profile, refreshBoot, onError }) {
  const [form, setForm] = useState({ ...PROFILE_FALLBACKS, ...(profile ?? {}) });

  useEffect(() => {
    setForm({ ...PROFILE_FALLBACKS, ...(profile ?? {}) });
  }, [profile]);

  async function handleSave(event) {
    event.preventDefault();
    try {
      await upsertProfile(userId, {
        name: form.name,
        height_cm: Number(form.height_cm),
        starting_weight_kg: Number(form.starting_weight_kg || form.current_weight_kg),
        current_weight_kg: Number(form.current_weight_kg),
        target_weight_kg: Number(form.target_weight_kg),
        kcal_goal: Number(form.kcal_goal),
        water_goal_ml: Number(form.water_goal_ml),
        dietary_restriction: form.dietary_restriction,
        lunch_time: form.lunch_time,
        training_time: form.training_time,
        routine_notes: form.routine_notes,
        objective: form.objective,
        onboarding_completed: true,
        training_level: form.training_level,
        main_goal: form.main_goal,
        weekly_strength_days: Number(form.weekly_strength_days),
        weekly_cardio_days: Number(form.weekly_cardio_days),
        plays_football: Boolean(form.plays_football),
        diet_style: form.diet_style,
        wearable_provider: form.wearable_provider,
        preferred_sync_mode: form.preferred_sync_mode,
        health_platform: form.health_platform,
      });
      await refreshBoot();
      onError('Perfil atualizado.');
    } catch (err) {
      onError(err.message);
    }
  }

  return (
    <div>
      <PageHeader eyebrow="Perfil" title="Metas e personalização" description="Preferências individuais usadas pelo plano, pelos limites e pelas análises do Atleta Hib." />

      <section className="panel highlight-panel">
        <p className="eyebrow">Perfil individual</p>
        <h3>Esses dados pertencem apenas ao usuário logado.</h3>
        <p>Outras contas passam pelo onboarding e criam seus próprios dados, metas, rotina e plano.</p>
      </section>

      <form className="panel form-grid" onSubmit={handleSave}>
        <label>Nome
          <input value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </label>
        <label>Altura cm
          <input type="number" step="0.1" value={form.height_cm ?? ''} onChange={(e) => setForm({ ...form, height_cm: e.target.value })} />
        </label>
        <label>Peso inicial kg
          <input type="number" step="0.1" value={form.starting_weight_kg ?? ''} onChange={(e) => setForm({ ...form, starting_weight_kg: e.target.value })} />
        </label>
        <label>Peso atual kg
          <input type="number" step="0.1" value={form.current_weight_kg ?? ''} onChange={(e) => setForm({ ...form, current_weight_kg: e.target.value })} />
        </label>
        <label>Meta de peso kg
          <input type="number" step="0.1" value={form.target_weight_kg ?? ''} onChange={(e) => setForm({ ...form, target_weight_kg: e.target.value })} />
        </label>
        <label>Meta kcal
          <input type="number" value={form.kcal_goal ?? ''} onChange={(e) => setForm({ ...form, kcal_goal: e.target.value })} />
        </label>
        <label>Meta água ml
          <input type="number" value={form.water_goal_ml ?? ''} onChange={(e) => setForm({ ...form, water_goal_ml: e.target.value })} />
        </label>
        <label>Objetivo principal
          <select value={form.main_goal ?? 'saude'} onChange={(e) => setForm({ ...form, main_goal: e.target.value })}>
            {Object.entries(GOAL_OPTIONS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>Nível
          <select value={form.training_level ?? 'iniciante'} onChange={(e) => setForm({ ...form, training_level: e.target.value })}>
            {Object.entries(LEVEL_OPTIONS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>Almoço
          <input type="time" value={toTimeValue(form.lunch_time) ?? '12:30'} onChange={(e) => setForm({ ...form, lunch_time: e.target.value })} />
        </label>
        <label>Treino
          <input type="time" value={toTimeValue(form.training_time) ?? '18:00'} onChange={(e) => setForm({ ...form, training_time: e.target.value })} />
        </label>
        <label>Estilo de dieta
          <select value={form.diet_style ?? 'flexivel'} onChange={(e) => setForm({ ...form, diet_style: e.target.value })}>
            {Object.entries(DIET_STYLE_OPTIONS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>Relógio / integração
          <select value={form.wearable_provider ?? 'none'} onChange={(e) => setForm({ ...form, wearable_provider: e.target.value })}>
            {Object.entries(WEARABLE_OPTIONS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>Modo de sincronização
          <select value={form.preferred_sync_mode ?? 'manual'} onChange={(e) => setForm({ ...form, preferred_sync_mode: e.target.value })}>
            {Object.entries(SYNC_MODE_OPTIONS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>Plataforma de saúde
          <select value={form.health_platform ?? 'none'} onChange={(e) => setForm({ ...form, health_platform: e.target.value })}>
            {Object.entries(HEALTH_PLATFORM_OPTIONS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>Musculação/semana
          <select value={form.weekly_strength_days ?? 3} onChange={(e) => setForm({ ...form, weekly_strength_days: Number(e.target.value) })}>
            {[2, 3, 4, 5].map((value) => <option key={value} value={value}>{value}x</option>)}
          </select>
        </label>
        <label>Cardio/semana
          <select value={form.weekly_cardio_days ?? 2} onChange={(e) => setForm({ ...form, weekly_cardio_days: Number(e.target.value) })}>
            {[1, 2, 3, 4].map((value) => <option key={value} value={value}>{value}x</option>)}
          </select>
        </label>
        <label className="check-row full">
          <input type="checkbox" checked={Boolean(form.plays_football)} onChange={(e) => setForm({ ...form, plays_football: e.target.checked })} /> incluir futebol/agilidade na rotina
        </label>
        <label className="full">Objetivo escrito
          <textarea value={form.objective ?? ''} onChange={(e) => setForm({ ...form, objective: e.target.value })} />
        </label>
        <label className="full">Restrição alimentar
          <textarea value={form.dietary_restriction ?? ''} onChange={(e) => setForm({ ...form, dietary_restriction: e.target.value })} />
        </label>
        <label className="full">Notas de rotina
          <textarea value={form.routine_notes ?? ''} onChange={(e) => setForm({ ...form, routine_notes: e.target.value })} />
        </label>
        <button className="primary-btn"><Save size={16} /> Salvar perfil</button>
      </form>
    </div>
  );
}

function toTimeValue(value) {
  if (!value) return '';
  return String(value).slice(0, 5);
}
