import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { RUN_PLAN } from '../data/defaultPlan';
import { listRuns, saveRun } from '../services/runService';
import { deleteCardioSession, listCardioSessions } from '../services/cardioService';


export default function RunView({ userId, onError }) {
  const [runs, setRuns] = useState([]);
  const [cardios, setCardios] = useState([]);
  const [form, setForm] = useState({ distance_km: '1', minutes: '', seconds: '', run_walk_protocol: RUN_PLAN[0].protocol, notes: '' });
  const [deletingCardioId, setDeletingCardioId] = useState(null);

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


  async function handleDeleteCardio(session) {
    if (!session?.id) {
      onError?.('Não consegui apagar: sessão sem ID.');
      return;
    }

    const confirmed = window.confirm(`Apagar este cardio?\n\n${session.activity_label ?? labelForActivity(session.activity_type)} · ${formatTime(session.duration_seconds)}\n\nIsso remove a sessão do histórico.`);
    if (!confirmed) return;

    try {
      setDeletingCardioId(session.id);
      await deleteCardioSession(userId, session.id);
      setCardios((current) => current.filter((item) => item.id !== session.id));
      onError?.('Cardio apagado.');
    } catch (err) {
      onError?.(err.message ?? 'Erro ao apagar cardio.');
    } finally {
      setDeletingCardioId(null);
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

      <section className="panel cardio-history-panel-v408">
        <div className="section-title-row">
          <div>
            <p className="eyebrow">Histórico de cardio registrado</p>
            <h3>{cardios.length ? `${cardios.length} sessão(ões)` : 'sem sessões'}</h3>
            <p className="muted-text">Mostra cardios manuais, da Academia e importados por JSON. “Sem distância” não significa erro no JSON; normalmente é cardio manual/planejado.</p>
          </div>
        </div>

        {cardios.length === 0 ? <p className="muted">Nenhuma sessão de cardio ainda.</p> : cardios.map((session) => (
          <div className="entry-row cardio-entry cardio-entry-v408" key={session.id}>
            <div>
              <div className="cardio-entry-head-v408">
                <strong>{session.activity_label ?? labelForActivity(session.activity_type)} · {formatDistance(session.distance_km, session)} · {formatTime(session.duration_seconds)}</strong>
                <span className={`cardio-source-badge-v408 ${sourceKind(session).tone}`}>{sourceKind(session).label}</span>
              </div>
              <span>{new Date(session.performed_at).toLocaleString('pt-BR')} · {pace(session)} · {formatKcal(session.active_kcal)} · FC {session.avg_heart_rate ?? '--'} bpm</span>
              <small>{session.source_app || session.source} · {session.device_name || 'sem dispositivo'} · {formatConfidence(session.confidence)}</small>
            </div>

            <div className="cardio-entry-actions-v408">
              <span className="pill">não soma</span>
              <button
                className="ghost-btn danger-ghost-v405"
                type="button"
                onClick={() => handleDeleteCardio(session)}
                disabled={deletingCardioId === session.id}
              >
                <Trash2 size={15} /> {deletingCardioId === session.id ? 'Apagando...' : 'Apagar'}
              </button>
            </div>
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

function formatDistance(distanceKm, session = null) {
  const distance = Number(distanceKm || 0);
  if (distance) return `${distance.toFixed(2)} km`;
  const kind = sourceKind(session);
  return kind.isManual ? 'sem distância (manual)' : 'sem distância';
}

function formatKcal(value) {
  return value === null || value === undefined ? 'kcal não informada' : `${value} kcal`;
}

function formatConfidence(value) {
  return ({
    low: 'baixa confiança',
    medium: 'confiança média',
    high: 'alta confiança',
    manual_review: 'revisão manual',
  })[value] ?? value ?? 'sem confiança';
}

function sourceKind(session) {
  const source = String(session?.source ?? '').toLowerCase();
  const importMethod = String(session?.import_method ?? '').toLowerCase();
  const sourceApp = String(session?.source_app ?? '').toLowerCase();
  const label = String(session?.activity_label ?? '').toLowerCase();

  if (importMethod.includes('screenshot') || source.includes('mi_fitness') || sourceApp.includes('mi fitness')) {
    return { label: 'JSON / relógio', tone: 'json', isManual: false };
  }

  if (source.includes('manual') || sourceApp.includes('atleta') || label.includes('planejado')) {
    return { label: 'manual / academia', tone: 'manual', isManual: true };
  }

  return { label: 'cardio', tone: 'neutral', isManual: false };
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
