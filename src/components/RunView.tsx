import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, ShieldCheck } from 'lucide-react';
import { RUN_PLAN } from '../data/defaultPlan';
import { listRuns, saveRun } from '../services/runService';
import { listCardioSessions } from '../services/cardioService';


export default function RunView({ userId, onError }) {
  const [runs, setRuns] = useState([]);
  const [cardios, setCardios] = useState([]);
  const [form, setForm] = useState({ distance_km: '1', minutes: '', seconds: '', run_walk_protocol: RUN_PLAN[0].protocol, notes: '' });

  const load = useCallback(async () => {
    try {
      const [runData, cardioData] = await Promise.all([
        listRuns(userId),
        listCardioSessions(userId),
      ]);
      setRuns(runData);
      setCardios(cardioData);
    } catch (err) {
      onError(err.message);
    }
  }, [onError, userId]);

  useEffect(() => { load(); }, [load]);

  const best1k = useMemo(() => {
    const candidates = [...runs, ...cardios]
      .filter((run) => Number(run.distance_km) >= 1 && Number(run.duration_seconds) > 0);
    if (!candidates.length) return null;
    return candidates.sort((a, b) => (Number(a.duration_seconds) / Number(a.distance_km)) - (Number(b.duration_seconds) / Number(b.distance_km)))[0];
  }, [runs, cardios]);

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
    <div className="cardio-page">
      <div className="page-title">
        <div>
          <p className="eyebrow">Cardio</p>
          <h2>Corrida, esteira e escada</h2>
          <p className="muted-text">Use Health Connect para os totais diários e importe JSON apenas para criar a sessão que o Mi Fitness não gravou como treino.</p>
        </div>
        <span className="pill">Melhor 1 km: {best1k ? formatTime(Number(best1k.duration_seconds) / Number(best1k.distance_km)) : 'sem marca'}</span>
      </div>

      <section className="panel warning-panel cardio-dedupe-panel">
        <div>
          <p className="eyebrow">Regra anti-duplicidade</p>
          <h3>Sessão importada não soma de novo nos totais</h3>
          <p>Passos, FC, kcal e distância diária continuam vindo do Health Connect. O JSON do print serve para mostrar “você fez esteira/corrida/escada” no histórico de cardio.</p>
        </div>
        <span className="pill"><ShieldCheck size={16} /> counts_toward_daily_totals = false</span>
      </section>

      <section className="panel centralized-json-note-v364">
        <div>
          <p className="eyebrow">Importação por JSON</p>
          <h3>Agora fica em Registrar &gt; JSON</h3>
          <p>Esta aba fica só para histórico e registro manual de cardio. Para colar JSON de print, use a central única de importação.</p>
        </div>
        <span className="pill">centralizado</span>
      </section>

      <section className="panel">
        <p className="eyebrow">Histórico de cardio importado</p>
        {cardios.length === 0 ? <p className="muted">Nenhuma sessão importada ainda.</p> : cardios.map((session) => (
          <div className="entry-row cardio-entry" key={session.id}>
            <div>
              <strong>{session.activity_label ?? labelForActivity(session.activity_type)} · {formatDistance(session.distance_km)} · {formatTime(session.duration_seconds)}</strong>
              <span>{new Date(session.performed_at).toLocaleString('pt-BR')} · {pace(session)} · {session.active_kcal ?? '--'} kcal · FC {session.avg_heart_rate ?? '--'} bpm</span>
              <small>{session.source_app || session.source} · {session.device_name || 'sem dispositivo'} · {session.confidence}</small>
            </div>
            <span className="pill">não soma</span>
          </div>
        ))}
      </section>

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
        <p className="eyebrow full">Registro manual simples</p>
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
        <button className="primary-btn"><Plus size={16} /> Salvar registro manual</button>
      </form>

      <section className="panel">
        <p className="eyebrow">Histórico manual antigo</p>
        {runs.length === 0 ? <p className="muted">Nenhuma corrida manual registrada ainda.</p> : runs.map((run) => (
          <div className="entry-row" key={run.id}>
            <div><strong>{Number(run.distance_km).toFixed(2)} km · {formatTime(run.duration_seconds)}</strong><span>{new Date(run.performed_at).toLocaleString('pt-BR')} · {pace(run)}</span></div>
          </div>
        ))}
      </section>
    </div>
  );
}

function formatTime(totalSeconds) {
  const safeSeconds = Number(totalSeconds || 0);
  const min = Math.floor(safeSeconds / 60);
  const sec = String(Math.round(safeSeconds % 60)).padStart(2, '0');
  return `${min}:${sec}`;
}

function pace(run) {
  const distance = Number(run.distance_km || 0);
  const duration = Number(run.duration_seconds || 0);
  if (!distance || !duration) return 'sem pace';
  const secondsPerKm = duration / distance;
  return `${formatTime(secondsPerKm)}/km`;
}

function formatDistance(distanceKm) {
  const distance = Number(distanceKm || 0);
  return distance ? `${distance.toFixed(2)} km` : 'sem distância';
}

function labelForActivity(type) {
  return ({
    treadmill: 'Esteira',
    outdoor_run: 'Corrida',
    walk: 'Caminhada',
    stairs: 'Escada',
    bike: 'Bike',
    elliptical: 'Elíptico',
  })[type] ?? 'Cardio';
}
