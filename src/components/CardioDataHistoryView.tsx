import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Bike, Clock3, Flame, HeartPulse, Route, Trash2 } from 'lucide-react';
import { deleteCardioSession, listCardioSessions } from '../services/cardioService';

const PERIODS = [
  { label: '30 dias', value: 30 },
  { label: '90 dias', value: 90 },
  { label: '180 dias', value: 180 },
];

export default function CardioDataHistoryView({ userId, onError }: any) {
  const [period, setPeriod] = useState(30);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    let alive = true;

    async function load() {
      if (!userId) return;

      try {
        setLoading(true);
        const data = await listCardioSessions(userId, 180);
        if (!alive) return;
        setSessions(Array.isArray(data) ? data : []);
      } catch (err: any) {
        onError?.(err.message ?? 'Erro ao carregar cardios.');
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();

    return () => { alive = false; };
  }, [userId, onError]);

  const filtered = useMemo(() => {
    const since = new Date();
    since.setDate(since.getDate() - period);

    return sessions.filter((session) => {
      const date = new Date(session.performed_at);
      return !Number.isNaN(date.getTime()) && date >= since;
    });
  }, [sessions, period]);

  const summary = useMemo(() => summarizeCardio(filtered), [filtered]);

  async function handleDelete(session) {
    if (!session?.id) {
      onError?.('Não consegui apagar: sessão sem ID.');
      return;
    }

    const label = session.activity_label ?? labelForType(session.activity_type);
    const duration = formatDuration(Number(session.duration_seconds || 0));
    const confirmed = window.confirm(`Apagar este cardio?\n\n${label} · ${duration}\n\nEssa ação remove a sessão do histórico.`);
    if (!confirmed) return;

    try {
      setDeletingId(session.id);
      await deleteCardioSession(userId, session.id);
      setSessions((current) => current.filter((item) => item.id !== session.id));
      onError?.('Cardio apagado.');
    } catch (err: any) {
      onError?.(err.message ?? 'Erro ao apagar cardio.');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="cardio-data-page-v404">
      <section className="simple-panel cardio-data-hero-v404">
        <div className="simple-section-head">
          <div>
            <p className="eyebrow">Dados de cardio</p>
            <h3>Cardios importados, manuais e do relógio</h3>
          </div>
          <HeartPulse size={24} />
        </div>

        <p className="muted-text">
          Aqui você confere os dados das sessões de cardio: duração, kcal, distância, ritmo, FC e fonte. Isso é diferente da prescrição do treino.
        </p>

        <div className="cardio-data-warning-v404">
          <AlertTriangle size={16} />
          <span>Kcal de cardio podem já estar incluídas nas kcal ativas diárias do Health Connect. Use como detalhe da sessão, não como soma automática.</span>
        </div>

        <div className="cardio-data-periods-v404">
          {PERIODS.map((item) => (
            <button key={item.value} type="button" className={period === item.value ? 'active' : ''} onClick={() => setPeriod(item.value)}>
              {item.label}
            </button>
          ))}
        </div>
      </section>

      <section className="cardio-data-grid-v404">
        <MetricCard icon={Bike} label="Sessões" value={loading ? '...' : summary.sessions} sub={`${period} dias`} />
        <MetricCard icon={Clock3} label="Tempo total" value={loading ? '...' : formatDuration(summary.durationSeconds)} sub={summary.sessions ? `${summary.avgMinutes} min/sessão` : 'sem sessões'} />
        <MetricCard icon={Flame} label="Kcal ativas" value={loading ? '...' : formatNumber(summary.activeKcal)} sub={summary.activeKcal ? 'não somar duas vezes' : 'sem kcal importada'} />
        <MetricCard icon={Route} label="Distância" value={loading ? '...' : summary.distanceKm ? `${summary.distanceKm.toFixed(2)} km` : '--'} sub={summary.distanceKm ? `${summary.avgPace}` : 'sem distância'} />
      </section>

      <section className="simple-panel">
        <div className="simple-section-head">
          <div>
            <p className="eyebrow">Histórico</p>
            <h3>Sessões de cardio registradas</h3>
          </div>
        </div>

        {loading && <p className="muted-text">Carregando cardios...</p>}

        {!loading && filtered.length === 0 && (
          <div className="empty-state-v403">
            <p>Nenhum cardio nesse período.</p>
            <span>Registre manualmente ou importe em Registrar &gt; JSON.</span>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="cardio-data-list-v404">
            {filtered.map((session) => (
              <article className="cardio-data-row-v404" key={session.id ?? session.dedupe_key}>
                <div>
                  <strong>{session.activity_label ?? labelForType(session.activity_type)}</strong>
                  <span>{formatDateTime(session.performed_at)} · {session.source_app ?? session.source ?? 'Atleta Híbrido'}</span>
                </div>

                <div className="cardio-data-row-metrics-v404">
                  <Badge label="Tempo" value={formatDuration(Number(session.duration_seconds || 0))} />
                  <Badge label="Ativas" value={session.active_kcal === null || session.active_kcal === undefined ? '--' : `${session.active_kcal} kcal`} />
                  <Badge label="Total" value={session.total_kcal === null || session.total_kcal === undefined ? '--' : `${session.total_kcal} kcal`} />
                  <Badge label="Distância" value={session.distance_km === null || session.distance_km === undefined ? 'sem distância' : `${Number(session.distance_km).toFixed(2)} km`} />
                  <Badge label="FC" value={session.avg_heart_rate ? `${session.avg_heart_rate}/${session.max_heart_rate ?? '--'} bpm` : '--'} />
                  <Badge label="Ritmo" value={session.avg_pace_seconds_per_km ? formatPace(session.avg_pace_seconds_per_km) : '--'} />
                </div>

                <div className="cardio-data-actions-v405">
                  <button
                    type="button"
                    className="ghost-btn danger-ghost-v405"
                    onClick={() => handleDelete(session)}
                    disabled={deletingId === session.id}
                  >
                    <Trash2 size={15} /> {deletingId === session.id ? 'Apagando...' : 'Apagar'}
                  </button>
                </div>

                <div className="cardio-data-flags-v404">
                  {Number(session.duration_seconds || 0) > 20 * 60 && <span>passou de 20 min</span>}
                  {session.metrics_may_already_exist_in_health_connect && <span>pode duplicar Health Connect</span>}
                  {session.counts_toward_daily_totals === false && <span>não soma nos totais diários</span>}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, sub }: any) {
  return (
    <article className="simple-panel cardio-data-metric-v404">
      <div>
        <p className="eyebrow">{label}</p>
        <h3>{value}</h3>
        <span>{sub}</span>
      </div>
      <Icon size={22} />
    </article>
  );
}

function Badge({ label, value }: any) {
  return (
    <span className="cardio-data-badge-v404">
      <small>{label}</small>
      <strong>{value}</strong>
    </span>
  );
}

function summarizeCardio(sessions: any[]) {
  const totalDuration = sessions.reduce((total, session) => total + Number(session.duration_seconds || 0), 0);
  const activeKcal = sessions.reduce((total, session) => total + Number(session.active_kcal || 0), 0);
  const distanceKm = sessions.reduce((total, session) => total + Number(session.distance_km || 0), 0);
  const avgMinutes = sessions.length ? Math.round((totalDuration / 60) / sessions.length) : 0;
  const avgPaceSeconds = distanceKm > 0 ? totalDuration / distanceKm : 0;

  return {
    sessions: sessions.length,
    durationSeconds: totalDuration,
    activeKcal,
    distanceKm,
    avgMinutes,
    avgPace: avgPaceSeconds ? `${formatPace(avgPaceSeconds)} média` : 'sem ritmo',
  };
}

function labelForType(type: string) {
  return ({
    treadmill: 'Esteira',
    outdoor_run: 'Corrida',
    walk: 'Caminhada',
    stairs: 'Escada',
    bike: 'Bike',
    elliptical: 'Elíptico',
    other: 'Cardio',
  } as any)[type] ?? 'Cardio';
}

function formatDuration(seconds: number) {
  const safeSeconds = Math.max(Math.round(Number(seconds || 0)), 0);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const restSeconds = safeSeconds % 60;
  if (hours) return `${hours}h${String(minutes).padStart(2, '0')}${restSeconds ? `:${String(restSeconds).padStart(2, '0')}` : ''}`;
  return restSeconds ? `${minutes}:${String(restSeconds).padStart(2, '0')} min` : `${minutes} min`;
}

function formatPace(seconds: number) {
  const safeSeconds = Math.max(Number(seconds || 0), 0);
  const minutes = Math.floor(safeSeconds / 60);
  const rest = Math.round(safeSeconds % 60);
  return `${minutes}:${String(rest).padStart(2, '0')}/km`;
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'data inválida';

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('pt-BR').format(Number(value || 0));
}
