import { useCallback, useEffect, useState } from 'react';
import { Droplets, Minus, Plus, RotateCcw } from 'lucide-react';
import { getOrCreateDailyLog, incrementWater, setWater, todayKey } from '../services/dailyService';

export default function WaterView(props: any) {
  const { userId, profile, onError } = props;
  const [date, setDate] = useState(todayKey());
  const [daily, setDaily] = useState(null);
  const [customMl, setCustomMl] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const waterGoal = Number(profile?.water_goal_ml ?? 3000);
  const water = Number(daily?.water_ml ?? 0);
  const percent = Math.min(Math.round((water / Math.max(waterGoal, 1)) * 100), 100);
  const remaining = Math.max(waterGoal - water, 0);

  const load = useCallback(async (targetDate = date) => {
    try {
      if (!userId) return;
      setLoading(true);
      setDaily(await getOrCreateDailyLog(userId, targetDate));
    } catch (err) {
      onError?.(err.message);
    } finally {
      setLoading(false);
    }
  }, [date, onError, userId]);

  useEffect(() => { load(date); }, [date, load]);

  async function updateWater(nextMl, message = 'Água atualizada.') {
    try {
      setBusy(true);
      const safeMl = Math.max(0, Math.round(Number(nextMl || 0)));
      const updated = await setWater(userId, date, safeMl);
      setDaily(updated);
      onError?.(message);
    } catch (err) {
      onError?.(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function add(amount) {
    if (busy || loading) return false;
    setBusy(true);
    try {
      const updated = await incrementWater(userId, date, amount);
      setDaily(updated);
      onError?.(`${amount > 0 ? '+' : ''}${amount} ml de água.`);
      return true;
    } catch (err) {
      onError?.(err.message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function saveCustom(event) {
    event.preventDefault();
    const amount = Number(customMl.replace(',', '.'));
    if (!Number.isFinite(amount) || amount <= 0) {
      onError?.('Informe uma quantidade válida de água.');
      return;
    }

    if (await add(amount)) setCustomMl('');
  }

  return (
    <div className="simple-page water-page-v361">
      <div className="page-title compact-title">
        <div>
          <h2>Água</h2>
        </div>
        <input aria-label="Data do registro de água" className="date-input" type="date" value={date} disabled={busy || loading} onChange={(event) => event.target.value && setDate(event.target.value)} />
      </div>

      <section className="simple-panel water-hero-v361">
        <div>
          <p className="eyebrow">{date === todayKey() ? 'Hoje' : 'Nesta data'}</p>
          <h3>{loading ? '—' : water.toLocaleString('pt-BR')} ml</h3>
          <span>{loading ? 'Carregando…' : remaining > 0 ? `${percent}% da meta · faltam ${remaining.toLocaleString('pt-BR')} ml` : 'Meta atingida'}</span>
        </div>
        <Droplets size={42} />
      </section>

      <div className="water-progress-track-v361" role="progressbar" aria-label="Meta de água" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
        <span style={{ width: `${percent}%` }} />
      </div>

      <section className="simple-panel water-actions-v361">
        <p className="eyebrow">Adicionar rápido</p>
        <div>
          <button type="button" disabled={busy || loading} onClick={() => add(200)}><Plus size={16} /> 200 ml</button>
          <button type="button" disabled={busy || loading} onClick={() => add(300)}><Plus size={16} /> 300 ml</button>
          <button type="button" disabled={busy || loading} onClick={() => add(500)}><Plus size={16} /> 500 ml</button>
          <button type="button" disabled={busy || loading} onClick={() => add(1000)}><Plus size={16} /> 1 L</button>
        </div>
      </section>

      <form className="simple-panel water-custom-v361" onSubmit={saveCustom}>
        <label htmlFor="water-custom-ml">Outra quantidade (ml)</label>
        <div>
          <input id="water-custom-ml" type="number" inputMode="numeric" min="1" step="1" value={customMl} onChange={(event) => setCustomMl(event.target.value)} placeholder="Ex.: 750" required />
          <button className="primary-btn" type="submit" disabled={busy || loading}><Plus size={16} /> Adicionar</button>
        </div>
      </form>

      <details className="simple-panel disclosure-panel">
        <summary>Corrigir quantidade</summary>
        <div className="form-actions">
          <button type="button" className="ghost-btn" disabled={busy || loading || !water} onClick={() => add(-500)}><Minus size={16} /> Remover 500 ml</button>
          <button type="button" className="ghost-btn danger" disabled={busy || loading || !water} onClick={() => window.confirm('Zerar a água registrada nesta data?') && updateWater(0, 'Água zerada.')}><RotateCcw size={16} /> Zerar registro</button>
        </div>
      </details>
    </div>
  );
}

export function WaterQuickCard(props: any) {
  const { userId, profile, onError, onNavigate } = props;
  const [daily, setDaily] = useState(null);
  const [busy, setBusy] = useState(false);
  const waterGoal = Number(profile?.water_goal_ml ?? 3000);
  const water = Number(daily?.water_ml ?? 0);
  const percent = Math.min(Math.round((water / Math.max(waterGoal, 1)) * 100), 100);

  const load = useCallback(async () => {
    try {
      if (!userId) return;
      setDaily(await getOrCreateDailyLog(userId, todayKey()));
    } catch (err) {
      onError?.(err.message);
    }
  }, [onError, userId]);

  useEffect(() => { load(); }, [load]);

  async function add(amount) {
    if (busy || !daily) return;
    setBusy(true);
    try {
      const updated = await incrementWater(userId, todayKey(), amount);
      setDaily(updated);
      onError?.(`+${amount} ml de água.`);
    } catch (err) {
      onError?.(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="simple-panel water-quick-card-v361">
      <div className="simple-section-head">
        <div>
          <p className="eyebrow">Água</p>
          <h3>{daily ? `${water} ml` : '--'}</h3>
          <span>{daily ? `${percent}% da meta de ${waterGoal} ml` : 'Carregando água…'}</span>
        </div>
        <button className="ghost-btn" type="button" onClick={() => onNavigate?.('register', { registerTab: 'water' })}>Abrir</button>
      </div>

      <div className="water-progress-track-v361" aria-label={`Água ${percent}%`}>
        <span style={{ width: `${percent}%` }} />
      </div>

      <div className="water-quick-actions-v361">
        <button type="button" disabled={busy || !daily} onClick={() => add(300)}>+300</button>
        <button type="button" disabled={busy || !daily} onClick={() => add(500)}>+500</button>
        <button type="button" disabled={busy || !daily} onClick={() => add(1000)}>+1L</button>
      </div>
    </section>
  );
}
