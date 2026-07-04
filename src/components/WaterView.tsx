import { useCallback, useEffect, useState } from 'react';
import { Droplets, Minus, Plus, RotateCcw, Save } from 'lucide-react';
import { getOrCreateDailyLog, setWater, todayKey } from '../services/dailyService';

export default function WaterView(props: any) {
  const { userId, profile, onError } = props;
  const [date, setDate] = useState(todayKey());
  const [daily, setDaily] = useState(null);
  const [customMl, setCustomMl] = useState('');

  const waterGoal = Number(profile?.water_goal_ml ?? 3000);
  const water = Number(daily?.water_ml ?? 0);
  const percent = Math.min(Math.round((water / Math.max(waterGoal, 1)) * 100), 100);
  const remaining = Math.max(waterGoal - water, 0);

  const load = useCallback(async (targetDate = date) => {
    try {
      if (!userId) return;
      setDaily(await getOrCreateDailyLog(userId, targetDate));
    } catch (err) {
      onError?.(err.message);
    }
  }, [date, onError, userId]);

  useEffect(() => { load(date); }, [date, load]);

  async function updateWater(nextMl, message = 'Água atualizada.') {
    try {
      const safeMl = Math.max(0, Math.round(Number(nextMl || 0)));
      const updated = await setWater(userId, date, safeMl);
      setDaily(updated);
      onError?.(message);
    } catch (err) {
      onError?.(err.message);
    }
  }

  function add(amount) {
    updateWater(water + amount, amount > 0 ? `+${amount} ml de água.` : `${amount} ml de água.`);
  }

  function saveCustom() {
    const amount = Number(customMl);
    if (!Number.isFinite(amount) || amount <= 0) {
      onError?.('Informe uma quantidade válida de água.');
      return;
    }

    add(amount);
    setCustomMl('');
  }

  return (
    <div className="simple-page water-page-v361">
      <div className="page-title compact-title">
        <div>
          <p className="eyebrow">Água</p>
          <h2>Registro de hidratação</h2>
        </div>
        <input className="date-input" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
      </div>

      <section className="simple-panel water-hero-v361">
        <div>
          <p className="eyebrow">Hoje</p>
          <h3>{water} ml</h3>
          <span>{percent}% da meta · faltam {remaining} ml</span>
        </div>
        <Droplets size={42} />
      </section>

      <div className="water-progress-track-v361" aria-label={`Água ${percent}%`}>
        <span style={{ width: `${percent}%` }} />
      </div>

      <section className="simple-panel water-actions-v361">
        <p className="eyebrow">Adicionar rápido</p>
        <div>
          <button type="button" onClick={() => add(200)}><Plus size={16} /> 200 ml</button>
          <button type="button" onClick={() => add(300)}><Plus size={16} /> 300 ml</button>
          <button type="button" onClick={() => add(500)}><Plus size={16} /> 500 ml</button>
          <button type="button" onClick={() => add(1000)}><Plus size={16} /> 1 L</button>
          <button type="button" className="danger" onClick={() => add(-500)}><Minus size={16} /> 500 ml</button>
          <button type="button" className="danger" onClick={() => window.confirm('Zerar água de hoje?') && updateWater(0, 'Água zerada.')}><RotateCcw size={16} /> Zerar</button>
        </div>
      </section>

      <section className="simple-panel water-custom-v361">
        <p className="eyebrow">Quantidade manual</p>
        <div>
          <input type="number" min="1" step="50" value={customMl} onChange={(event) => setCustomMl(event.target.value)} placeholder="Ex.: 750" />
          <button className="primary-btn" type="button" onClick={saveCustom}><Save size={16} /> Salvar</button>
        </div>
      </section>

      <section className="simple-panel water-note-v361">
        <p className="eyebrow">Regra simples</p>
        <p>Bata a meta ao longo do dia. Não precisa virar 1 litro de uma vez só. O ideal é ir somando aos poucos.</p>
      </section>
    </div>
  );
}

export function WaterQuickCard(props: any) {
  const { userId, profile, onError, onNavigate } = props;
  const [daily, setDaily] = useState(null);
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
    try {
      const updated = await setWater(userId, todayKey(), Math.max(0, water + amount));
      setDaily(updated);
      onError?.(`+${amount} ml de água.`);
    } catch (err) {
      onError?.(err.message);
    }
  }

  return (
    <section className="simple-panel water-quick-card-v361">
      <div className="simple-section-head">
        <div>
          <p className="eyebrow">Água</p>
          <h3>{water} ml</h3>
          <span>{percent}% da meta de {waterGoal} ml</span>
        </div>
        <button className="ghost-btn" type="button" onClick={() => onNavigate?.('register')}>Abrir</button>
      </div>

      <div className="water-progress-track-v361" aria-label={`Água ${percent}%`}>
        <span style={{ width: `${percent}%` }} />
      </div>

      <div className="water-quick-actions-v361">
        <button type="button" onClick={() => add(300)}>+300</button>
        <button type="button" onClick={() => add(500)}>+500</button>
        <button type="button" onClick={() => add(1000)}>+1L</button>
      </div>
    </section>
  );
}
