import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { RUN_PLAN } from '../data/defaultPlan';
import { listRuns, saveRun } from '../services/runService';

export default function RunView({ userId, onError }) {
  const [runs, setRuns] = useState([]);
  const [form, setForm] = useState({ distance_km: '1', minutes: '', seconds: '', run_walk_protocol: RUN_PLAN[0].protocol, notes: '' });

  const load = useCallback(async () => {
    try {
      setRuns(await listRuns(userId));
    } catch (err) {
      onError(err.message);
    }
  }, [onError, userId]);

  useEffect(() => { load(); }, [load]);

  const best1k = useMemo(() => {
    const candidates = runs.filter((run) => Number(run.distance_km) >= 1 && run.duration_seconds > 0);
    if (!candidates.length) return null;
    return candidates.sort((a, b) => (a.duration_seconds / a.distance_km) - (b.duration_seconds / b.distance_km))[0];
  }, [runs]);

  async function handleSubmit(event) {
    event.preventDefault();
    try {
      const duration = Number(form.minutes || 0) * 60 + Number(form.seconds || 0);
      await saveRun(userId, {
        distance_km: Number(form.distance_km),
        duration_seconds: duration,
        run_walk_protocol: form.run_walk_protocol,
        notes: form.notes,
      });
      setForm({ distance_km: '1', minutes: '', seconds: '', run_walk_protocol: form.run_walk_protocol, notes: '' });
      await load();
    } catch (err) {
      onError(err.message);
    }
  }

  return (
    <div>
      <div className="page-title">
        <div>
          <p className="eyebrow">Corrida</p>
          <h2>Projeto primeiro 1 km</h2>
        </div>
        <span className="pill">Melhor 1 km: {best1k ? formatTime(best1k.duration_seconds / best1k.distance_km) : 'sem marca'}</span>
      </div>

      <section className="panel">
        <p className="eyebrow">Progressão de 6 semanas</p>
        <div className="timeline">
          {RUN_PLAN.map((week) => (
            <div className="timeline-item" key={week.week}>
              <span>S{week.week}</span>
              <div><strong>{week.title}</strong><p>{week.protocol}</p><small>{week.goal}</small></div>
            </div>
          ))}
        </div>
      </section>

      <form className="panel form-grid" onSubmit={handleSubmit}>
        <p className="eyebrow full">Registrar corrida</p>
        <label>Distância km
          <input type="number" min="0" step="0.01" value={form.distance_km} onChange={(e) => setForm({ ...form, distance_km: e.target.value })} />
        </label>
        <label>Minutos
          <input type="number" min="0" value={form.minutes} onChange={(e) => setForm({ ...form, minutes: e.target.value })} />
        </label>
        <label>Segundos
          <input type="number" min="0" max="59" value={form.seconds} onChange={(e) => setForm({ ...form, seconds: e.target.value })} />
        </label>
        <label>Protocolo
          <select value={form.run_walk_protocol} onChange={(e) => setForm({ ...form, run_walk_protocol: e.target.value })}>
            {RUN_PLAN.map((week) => <option key={week.week} value={week.protocol}>S{week.week} — {week.protocol}</option>)}
          </select>
        </label>
        <label className="full">Notas
          <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="dor, cansaço, local, sensação..." />
        </label>
        <button className="primary-btn"><Plus size={16} /> Salvar corrida</button>
      </form>

      <section className="panel">
        <p className="eyebrow">Histórico</p>
        {runs.length === 0 ? <p className="muted">Nenhuma corrida registrada ainda.</p> : runs.map((run) => (
          <div className="entry-row" key={run.id}>
            <div><strong>{Number(run.distance_km).toFixed(2)} km · {formatTime(run.duration_seconds)}</strong><span>{new Date(run.performed_at).toLocaleString('pt-BR')} · {pace(run)}</span></div>
          </div>
        ))}
      </section>
    </div>
  );
}

function formatTime(totalSeconds) {
  const min = Math.floor(totalSeconds / 60);
  const sec = String(Math.round(totalSeconds % 60)).padStart(2, '0');
  return `${min}:${sec}`;
}

function pace(run) {
  const secondsPerKm = run.duration_seconds / Number(run.distance_km || 1);
  return `${formatTime(secondsPerKm)}/km`;
}
