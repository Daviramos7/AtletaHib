import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { RUN_PLAN } from '../data/defaultPlan';
import { deleteCardioSession, listCardioSessions, saveManualCardioSession } from '../services/cardioService';
import { ConfirmDialog, DataSourceBadge, EmptyState, FormField, PageHeader, TimelineItem, WarningBanner } from './ui';
import { formatDurationClock } from '../utils/durations';


export default function RunView({ userId, onError }) {
  const [cardios, setCardios] = useState([]);
  const [form, setForm] = useState({ distance_km: '1', minutes: '', seconds: '', run_walk_protocol: RUN_PLAN[0].protocol, notes: '' });
  const [deletingCardioId, setDeletingCardioId] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);

  const load = useCallback(async () => {
    try {
      setCardios(await listCardioSessions(userId));
    } catch (err) {
      onError(err.message);
    }
  }, [onError, userId]);

  useEffect(() => { load(); }, [load]);

  const best1k = useMemo(() => {
    const candidates = [...cardios]
      .filter((run) => Number(run.distance_km) >= 1 && Number(run.duration_seconds) > 0);
    if (!candidates.length) return null;
    return candidates.sort((a, b) => (Number(a.duration_seconds) / Number(a.distance_km)) - (Number(b.duration_seconds) / Number(b.distance_km)))[0];
  }, [cardios]);

  async function handleSubmit(event) {
    event.preventDefault();
    try {
      const duration = Number(form.minutes || 0) * 60 + Number(form.seconds || 0);
      await saveManualCardioSession(userId, {
        activity_type: 'outdoor_run',
        activity_label: 'Corrida',
        distance_km: Number(form.distance_km),
        duration_seconds: duration,
        notes: [form.run_walk_protocol, form.notes].filter(Boolean).join(' · '),
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

    try {
      setDeletingCardioId(session.id);
      await deleteCardioSession(userId, session.id);
      setCardios((current) => current.filter((item) => item.id !== session.id));
      setPendingDelete(null);
      onError?.('Cardio apagado.');
    } catch (err) {
      onError?.(err.message ?? 'Erro ao apagar cardio.');
    } finally {
      setDeletingCardioId(null);
    }
  }

  return (
    <div className="cardio-page">
      <PageHeader
        eyebrow="Cardio"
        title="Corrida, esteira e escada"
        description="Use Health Connect para os totais diários. Sessões manuais e importadas ficam em um único histórico."
        action={<span className="pill">Melhor ritmo médio: {best1k ? `${formatTime(Number(best1k.duration_seconds) / Number(best1k.distance_km))}/km` : 'sem marca'}</span>}
      />

      <WarningBanner title="Sessão registrada não soma de novo nos totais" className="cardio-dedupe-panel">
        <p>Passos, FC, kcal e distância diária continuam vindo do Health Connect. O registro cria o histórico da sessão sem duplicar o total diário.</p>
        <span className="pill"><ShieldCheck size={16} /> não entra no total diário</span>
      </WarningBanner>

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

        {cardios.length === 0 ? <EmptyState title="Nenhuma sessão de cardio" description="Registre manualmente ou importe um JSON para iniciar o histórico." /> : cardios.map((session) => (
          <div className="entry-row cardio-entry cardio-entry-v408" key={session.id}>
            <div>
              <div className="cardio-entry-head-v408">
                <strong>{session.activity_label ?? labelForActivity(session.activity_type)} · {formatDistance(session.distance_km, session)} · {formatTime(session.duration_seconds)}</strong>
                <DataSourceBadge source={sourceKind(session).tone} label={sourceKind(session).label} />
              </div>
              <span>{new Date(session.performed_at).toLocaleString('pt-BR')} · {pace(session)} · {formatKcal(session.active_kcal)} · FC {session.avg_heart_rate ?? '--'} bpm</span>
              <small>{session.source_app || session.source} · {session.device_name || 'sem dispositivo'} · {formatConfidence(session.confidence)}</small>
            </div>

            <div className="cardio-entry-actions-v408">
              <span className="pill">não soma</span>
              <button
                className="ghost-btn danger-ghost-v405"
                type="button"
                onClick={() => setPendingDelete(session)}
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
            <TimelineItem key={week.week} marker={`S${week.week}`} title={week.title} description={week.protocol} detail={week.goal} />
          ))}
        </div>
      </section>

      <form className="panel form-grid" onSubmit={handleSubmit}>
        <p className="eyebrow full">Registro manual simples</p>
        <FormField label="Distância km">
          <input type="number" min="0" step="0.01" value={form.distance_km} onChange={(e) => setForm({ ...form, distance_km: e.target.value })} />
        </FormField>
        <FormField label="Minutos">
          <input type="number" min="0" value={form.minutes} onChange={(e) => setForm({ ...form, minutes: e.target.value })} />
        </FormField>
        <FormField label="Segundos">
          <input type="number" min="0" max="59" value={form.seconds} onChange={(e) => setForm({ ...form, seconds: e.target.value })} />
        </FormField>
        <FormField label="Protocolo">
          <select value={form.run_walk_protocol} onChange={(e) => setForm({ ...form, run_walk_protocol: e.target.value })}>
            {RUN_PLAN.map((week) => <option key={week.week} value={week.protocol}>S{week.week} — {week.protocol}</option>)}
          </select>
        </FormField>
        <FormField label="Notas" className="full">
          <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="dor, cansaço, local, sensação..." />
        </FormField>
        <button className="primary-btn"><Plus size={16} /> Salvar registro manual</button>
      </form>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Apagar esta sessão de cardio?"
        description={pendingDelete ? `${pendingDelete.activity_label ?? labelForActivity(pendingDelete.activity_type)} · ${formatTime(pendingDelete.duration_seconds)}. Essa ação remove a sessão do histórico.` : undefined}
        confirmLabel="Apagar sessão"
        danger
        busy={Boolean(deletingCardioId)}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => handleDeleteCardio(pendingDelete)}
      />
    </div>
  );
}

function formatTime(totalSeconds) {
  return formatDurationClock(Number(totalSeconds || 0), '0:00');
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
