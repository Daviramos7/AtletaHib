import { useCallback, useEffect, useMemo, useState } from 'react';
import { Save, TrendingDown } from 'lucide-react';
import { todayKey } from '../services/dailyService';
import { listRuns } from '../services/runService';
import { listWeightLogs, saveWeightLog } from '../services/weightService';

export default function ProgressView({ userId, profile, refreshBoot, onError }) {
  const [weights, setWeights] = useState([]);
  const [runs, setRuns] = useState([]);
  const [form, setForm] = useState({ log_date: todayKey(), weight_kg: profile?.current_weight_kg ?? '', waist_cm: '', notes: '' });

  const load = useCallback(async () => {
    try {
      const [weightData, runData] = await Promise.all([listWeightLogs(userId), listRuns(userId)]);
      setWeights(weightData);
      setRuns(runData);
    } catch (err) {
      onError(err.message);
    }
  }, [onError, userId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    setForm((old) => ({ ...old, weight_kg: profile?.current_weight_kg ?? old.weight_kg ?? '' }));
  }, [profile?.current_weight_kg]);

  const weeklyWeights = useMemo(() => buildWeeklyWeights(weights), [weights]);

  const stats = useMemo(() => {
    const chronological = [...weights].sort((a, b) => a.log_date.localeCompare(b.log_date));
    const latest = chronological[chronological.length - 1];
    const oldest = chronological[0];
    const lost = latest && oldest ? Number(oldest.weight_kg) - Number(latest.weight_kg) : 0;
    const targetLeft = latest ? Number(latest.weight_kg) - Number(profile?.target_weight_kg ?? 0) : null;
    const totalKm = runs.reduce((sum, run) => sum + Number(run.distance_km || 0), 0);
    const lastWeek = weeklyWeights[weeklyWeights.length - 1];
    const previousWeek = weeklyWeights[weeklyWeights.length - 2];
    const weeklyChange = lastWeek && previousWeek ? Number(previousWeek.avgWeight) - Number(lastWeek.avgWeight) : null;
    return { latest, oldest, lost, targetLeft, totalKm, weeklyChange };
  }, [weights, runs, profile, weeklyWeights]);

  async function handleSave(event) {
    event.preventDefault();
    try {
      await saveWeightLog(userId, {
        log_date: form.log_date,
        weight_kg: Number(form.weight_kg),
        waist_cm: form.waist_cm ? Number(form.waist_cm) : null,
        notes: form.notes,
      });
      await Promise.all([load(), refreshBoot()]);
      setForm((old) => ({ ...old, waist_cm: '', notes: '' }));
    } catch (err) {
      onError(err.message);
    }
  }

  return (
    <div>
      <div className="page-title">
        <div>
          <p className="eyebrow">Progresso</p>
          <h2>Peso semanal, corrida e consistência</h2>
        </div>
      </div>

      <div className="metric-grid four">
        <SmallMetric label="Peso atual" value={stats.latest ? `${Number(stats.latest.weight_kg).toFixed(1)} kg` : '--'} sub="último registro" />
        <SmallMetric label="Perdido" value={`${stats.lost.toFixed(1)} kg`} sub="desde o primeiro log" />
        <SmallMetric label="Falta" value={stats.targetLeft !== null ? `${stats.targetLeft.toFixed(1)} kg` : '--'} sub="até a meta" />
        <SmallMetric label="Corrida" value={`${stats.totalKm.toFixed(2)} km`} sub="total registrado" />
      </div>

      <section className="panel highlight-panel">
        <p className="eyebrow">Gráfico semanal</p>
        <div className="chart-title-row">
          <h3>Média semanal do peso</h3>
          <span className="pill"><TrendingDown size={16} /> {stats.weeklyChange === null ? 'sem comparação' : `${stats.weeklyChange >= 0 ? '-' : '+'}${Math.abs(stats.weeklyChange).toFixed(1)} kg vs semana anterior`}</span>
        </div>
        <WeightChart data={weeklyWeights} target={profile?.target_weight_kg ?? 0} />
        <p className="muted">Use o peso de manhã, após ir ao banheiro, e compare a média semanal. Peso diário oscila por água, sal, treino e sono.</p>
      </section>

      <form className="panel form-grid" onSubmit={handleSave}>
        <p className="eyebrow full">Registrar peso atualizado</p>
        <label>Data
          <input type="date" value={form.log_date} onChange={(e) => setForm({ ...form, log_date: e.target.value })} />
        </label>
        <label>Peso kg
          <input type="number" min="1" step="0.1" value={form.weight_kg} onChange={(e) => setForm({ ...form, weight_kg: e.target.value })} />
        </label>
        <label>Cintura cm
          <input type="number" min="1" step="0.1" value={form.waist_cm} onChange={(e) => setForm({ ...form, waist_cm: e.target.value })} />
        </label>
        <label className="full">Notas
          <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="sono, fome, treino, dor, compulsão..." />
        </label>
        <button className="primary-btn"><Save size={16} /> Salvar peso</button>
      </form>

      <section className="panel">
        <p className="eyebrow">Histórico de peso</p>
        {weights.length === 0 ? <p className="muted">Sem registros ainda.</p> : weights.map((item) => (
          <div className="entry-row" key={item.id}>
            <div><strong>{Number(item.weight_kg).toFixed(1)} kg {item.waist_cm ? `· ${Number(item.waist_cm).toFixed(1)} cm` : ''}</strong><span>{new Date(`${item.log_date}T12:00:00`).toLocaleDateString('pt-BR')} · {item.notes}</span></div>
          </div>
        ))}
      </section>
    </div>
  );
}

function SmallMetric({ label, value, sub }) {
  return <div className="small-metric"><span>{label}</span><strong>{value}</strong><p>{sub}</p></div>;
}

function WeightChart({ data, target }) {
  if (data.length < 1) {
    return <div className="chart-empty">Registre seu peso pelo menos uma vez para iniciar o gráfico.</div>;
  }

  const width = 760;
  const height = 260;
  const pad = { top: 22, right: 28, bottom: 44, left: 54 };
  const values = [...data.map((item) => Number(item.avgWeight)), Number(target)].filter((v) => Number.isFinite(v));
  const min = Math.floor(Math.min(...values) - 1);
  const max = Math.ceil(Math.max(...values) + 1);
  const range = Math.max(max - min, 1);
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;
  const xOf = (idx) => pad.left + (data.length === 1 ? chartW / 2 : (idx / (data.length - 1)) * chartW);
  const yOf = (value) => pad.top + ((max - value) / range) * chartH;
  const points = data.map((item, idx) => `${xOf(idx)},${yOf(Number(item.avgWeight))}`).join(' ');
  const targetY = yOf(Number(target));
  const ticks = [max, Math.round((max + min) / 2), min];

  return (
    <div className="weight-chart-wrap">
      <svg className="weight-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Gráfico semanal de peso">
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={pad.left} x2={width - pad.right} y1={yOf(tick)} y2={yOf(tick)} className="chart-grid-line" />
            <text x={pad.left - 10} y={yOf(tick) + 4} textAnchor="end" className="chart-axis-text">{tick} kg</text>
          </g>
        ))}
        <line x1={pad.left} x2={width - pad.right} y1={targetY} y2={targetY} className="chart-target-line" />
        <text x={width - pad.right} y={targetY - 7} textAnchor="end" className="chart-target-text">meta {target} kg</text>
        <polyline points={points} className="chart-line" />
        {data.map((item, idx) => (
          <g key={item.weekKey}>
            <circle cx={xOf(idx)} cy={yOf(Number(item.avgWeight))} r="5" className="chart-point" />
            <text x={xOf(idx)} y={yOf(Number(item.avgWeight)) - 12} textAnchor="middle" className="chart-value-text">{Number(item.avgWeight).toFixed(1)}</text>
            <text x={xOf(idx)} y={height - 14} textAnchor="middle" className="chart-axis-text">{item.label}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function buildWeeklyWeights(weights) {
  const buckets = new Map();
  weights.forEach((item) => {
    const date = parseLocalDate(item.log_date);
    const weekStart = startOfWeek(date);
    const weekKey = weekStart.toISOString().slice(0, 10);
    const existing = buckets.get(weekKey) ?? { weekKey, weekStart, values: [] };
    existing.values.push(Number(item.weight_kg));
    buckets.set(weekKey, existing);
  });

  return [...buckets.values()]
    .sort((a, b) => a.weekStart - b.weekStart)
    .slice(-12)
    .map((bucket) => {
      const avg = bucket.values.reduce((sum, value) => sum + value, 0) / bucket.values.length;
      return {
        weekKey: bucket.weekKey,
        label: `${String(bucket.weekStart.getDate()).padStart(2, '0')}/${String(bucket.weekStart.getMonth() + 1).padStart(2, '0')}`,
        avgWeight: Number(avg.toFixed(2)),
        count: bucket.values.length,
      };
    });
}

function parseLocalDate(value) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0);
}

function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}
