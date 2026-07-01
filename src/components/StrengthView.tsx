import { useEffect, useMemo, useState } from 'react';
import { Activity, Dumbbell, TrendingUp } from 'lucide-react';
import { buildWeeklyStrengthProgress, calculateEstimatedOneRepMax, calculateVolumeKg, listStrengthSets } from '../services/workoutService';

export default function StrengthView({ userId, onError }) {
  const [sets, setSets] = useState([]);
  const [exerciseName, setExerciseName] = useState('');
  const [days, setDays] = useState(120);

  useEffect(() => {
    async function load() {
      try {
        const data = await listStrengthSets(userId, days);
        setSets(data);
        setExerciseName((current) => current || data[0]?.exercise_name || '');
      } catch (err) {
        onError(err.message);
      }
    }
    load();
  }, [userId, days, onError]);

  const exerciseOptions = useMemo(() => [...new Set(sets.map((set) => set.exercise_name))].sort(), [sets]);
  const selectedSets = useMemo(() => sets.filter((set) => set.exercise_name === exerciseName), [sets, exerciseName]);
  const weeklyData = useMemo(() => buildWeeklyStrengthProgress(sets, exerciseName), [sets, exerciseName]);
  const bestSet = useMemo(() => {
    return [...selectedSets].sort((a, b) => calculateEstimatedOneRepMax(b.load_kg, b.reps) - calculateEstimatedOneRepMax(a.load_kg, a.reps))[0] ?? null;
  }, [selectedSets]);

  const totalVolume = calculateVolumeKg(selectedSets);
  const lastSet = selectedSets[0];

  return (
    <div>
      <div className="page-title">
        <div>
          <p className="eyebrow">Força</p>
          <h2>Evolução de carga</h2>
        </div>
        <div className="top-actions">
          <select className="date-input" value={days} onChange={(e) => setDays(Number(e.target.value))}>
            <option value={60}>Últimos 60 dias</option>
            <option value={120}>Últimos 120 dias</option>
            <option value={365}>Último ano</option>
          </select>
        </div>
      </div>

      {!sets.length ? (
        <section className="panel highlight-panel">
          <p className="eyebrow">Primeiro passo</p>
          <h3>Salve um treino com séries reais</h3>
          <p>Abra a aba Treino, preencha reps e carga de cada série, e salve a execução. Depois esta tela mostra volume, melhor carga e estimativa de 1RM por semana.</p>
        </section>
      ) : (
        <>
          <section className="panel">
            <label>Exercício analisado
              <select value={exerciseName} onChange={(e) => setExerciseName(e.target.value)}>
                {exerciseOptions.map((name) => <option value={name} key={name}>{name}</option>)}
              </select>
            </label>
          </section>

          <div className="metric-grid four">
            <Metric icon={Dumbbell} label="Séries registradas" value={selectedSets.length} sub={exerciseName || 'Selecione um exercício'} />
            <Metric icon={Activity} label="Volume total" value={`${totalVolume.toFixed(0)} kg`} sub="kg x reps na janela" />
            <Metric icon={TrendingUp} label="Melhor carga" value={bestSet ? `${Number(bestSet.load_kg).toFixed(1)} kg` : '--'} sub={bestSet ? `${bestSet.reps} reps` : 'sem dado'} />
            <Metric icon={TrendingUp} label="Estimativa 1RM" value={bestSet ? `${calculateEstimatedOneRepMax(bestSet.load_kg, bestSet.reps).toFixed(1)} kg` : '--'} sub="Epley: carga x (1 + reps/30)" />
          </div>

          <section className="panel">
            <div className="chart-title-row">
              <div>
                <p className="eyebrow">Tendência semanal</p>
                <h3>{exerciseName}</h3>
              </div>
              <span className="pill">último registro: {lastSet ? new Date(lastSet.performed_at).toLocaleDateString('pt-BR') : '--'}</span>
            </div>
            <StrengthChart data={weeklyData} />
          </section>

          <section className="panel">
            <p className="eyebrow">Últimas séries registradas</p>
            <div className="set-history-list">
              {selectedSets.slice(0, 18).map((set) => (
                <div className="set-history-row" key={set.id}>
                  <div>
                    <strong>{new Date(set.performed_at).toLocaleDateString('pt-BR')}</strong>
                    <span>Série {set.set_number} · RPE {set.perceived_effort ?? '--'}</span>
                  </div>
                  <div><strong>{set.reps} reps</strong><span>{Number(set.load_kg).toFixed(1)} kg</span></div>
                  <div><strong>{calculateEstimatedOneRepMax(set.load_kg, set.reps).toFixed(1)} kg</strong><span>1RM estimado</span></div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function Metric({ icon: Icon, label, value, sub }) {
  return <div className="small-metric"><span><Icon size={15} /> {label}</span><strong>{value}</strong><p>{sub}</p></div>;
}

function StrengthChart({ data }) {
  if (!data.length) return <div className="chart-empty">Ainda não há dados suficientes para gráfico desse exercício.</div>;

  const width = 760;
  const height = 300;
  const pad = { top: 30, right: 28, bottom: 44, left: 58 };
  const values = data.flatMap((item) => [Number(item.bestOneRm), Number(item.bestLoad)]).filter((value) => Number.isFinite(value));
  const min = Math.max(Math.floor(Math.min(...values) - 5), 0);
  const max = Math.ceil(Math.max(...values) + 5);
  const range = Math.max(max - min, 1);
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;
  const xOf = (idx) => pad.left + (data.length === 1 ? chartW / 2 : (idx / (data.length - 1)) * chartW);
  const yOf = (value) => pad.top + ((max - value) / range) * chartH;
  const oneRmPoints = data.map((item, idx) => `${xOf(idx)},${yOf(Number(item.bestOneRm))}`).join(' ');
  const loadPoints = data.map((item, idx) => `${xOf(idx)},${yOf(Number(item.bestLoad))}`).join(' ');
  const ticks = [max, Math.round((max + min) / 2), min];

  return (
    <div className="weight-chart-wrap">
      <svg className="weight-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Gráfico semanal de força">
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={pad.left} x2={width - pad.right} y1={yOf(tick)} y2={yOf(tick)} className="chart-grid-line" />
            <text x={pad.left - 10} y={yOf(tick) + 4} textAnchor="end" className="chart-axis-text">{tick} kg</text>
          </g>
        ))}
        <polyline points={oneRmPoints} className="chart-line" />
        <polyline points={loadPoints} className="chart-line secondary" />
        {data.map((item, idx) => (
          <g key={item.weekKey}>
            <circle cx={xOf(idx)} cy={yOf(Number(item.bestOneRm))} r="5" className="chart-point" />
            <circle cx={xOf(idx)} cy={yOf(Number(item.bestLoad))} r="4" className="chart-point secondary" />
            <text x={xOf(idx)} y={yOf(Number(item.bestOneRm)) - 12} textAnchor="middle" className="chart-value-text">{Number(item.bestOneRm).toFixed(0)}</text>
            <text x={xOf(idx)} y={height - 14} textAnchor="middle" className="chart-axis-text">{item.label}</text>
          </g>
        ))}
        <text x={width - pad.right} y={pad.top} textAnchor="end" className="chart-target-text">linha forte: 1RM estimado · linha fraca: melhor carga</text>
      </svg>
    </div>
  );
}
