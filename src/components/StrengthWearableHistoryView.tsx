import { useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, Clock3, Flame, HeartPulse, Watch } from 'lucide-react';
import { listWearableWorkoutSessions } from '../services/strengthWearableService';

const PERIODS = [
  { label: '30 dias', value: 30 },
  { label: '90 dias', value: 90 },
  { label: '180 dias', value: 180 },
];

export default function StrengthWearableHistoryView({ userId, onError }: any) {
  const [period, setPeriod] = useState(30);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    async function load() {
      if (!userId) return;

      try {
        setLoading(true);
        const data = await listWearableWorkoutSessions(userId, 120);
        if (!alive) return;
        setSessions(Array.isArray(data) ? data : []);
      } catch (err: any) {
        onError?.(err.message ?? 'Erro ao carregar treinos do relógio.');
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

  const summary = useMemo(() => summarizeWearableStrength(filtered), [filtered]);

  return (
    <div className="strength-watch-page-v403">
      <section className="simple-panel strength-watch-hero-v403">
        <div className="simple-section-head">
          <div>
            <p className="eyebrow">Força do relógio</p>
            <h3>Calorias, frequência cardíaca e duração</h3>
          </div>
          <Watch size={24} />
        </div>

        <p className="muted-text">
          Aqui ficam os dados fisiológicos importados do Mi Fitness/relógio nos treinos de força. Isso é diferente das séries, cargas e reps da aba Força.
        </p>

        <div className="strength-watch-warning-v403">
          <AlertTriangle size={16} />
          <span>Kcal do relógio são detalhe da sessão. Não some manualmente com kcal ativas do dia se o Health Connect já registrou o total.</span>
        </div>

        <div className="strength-watch-periods-v403">
          {PERIODS.map((item) => (
            <button key={item.value} type="button" className={period === item.value ? 'active' : ''} onClick={() => setPeriod(item.value)}>
              {item.label}
            </button>
          ))}
        </div>
      </section>

      <section className="strength-watch-grid-v403">
        <MetricCard icon={Activity} label="Sessões" value={loading ? '...' : summary.sessions} sub={`${period} dias`} />
        <MetricCard icon={Flame} label="Kcal ativas" value={loading ? '...' : formatNumber(summary.activeKcal)} sub={summary.activeKcal ? 'não somar duas vezes' : 'sem kcal importada'} />
        <MetricCard icon={Clock3} label="Tempo total" value={loading ? '...' : formatDuration(summary.durationSeconds)} sub={summary.sessions ? `${summary.avgMinutes} min/sessão` : 'sem sessões'} />
        <MetricCard icon={HeartPulse} label="FC média" value={loading ? '...' : summary.avgHeartRate ? `${summary.avgHeartRate} bpm` : '--'} sub={summary.maxHeartRate ? `máx ${summary.maxHeartRate} bpm` : 'sem FC'} />
      </section>

      <section className="simple-panel">
        <div className="simple-section-head">
          <div>
            <p className="eyebrow">Histórico importado</p>
            <h3>Últimos treinos do relógio</h3>
          </div>
        </div>

        {loading && <p className="muted-text">Carregando treinos do relógio...</p>}

        {!loading && filtered.length === 0 && (
          <div className="empty-state-v403">
            <p>Nenhum treino de força do relógio nesse período.</p>
            <span>Importe em Registrar &gt; JSON usando o tipo Força relógio.</span>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="strength-watch-list-v403">
            {filtered.map((session) => (
              <article className="strength-watch-row-v403" key={session.id ?? session.dedupe_key}>
                <div>
                  <strong>{session.activity_label ?? 'Força'}</strong>
                  <span>{formatDateTime(session.performed_at)} · {session.device_name ?? session.source_app ?? 'Relógio'}</span>
                </div>

                <div className="strength-watch-row-metrics-v403">
                  <Badge label="Tempo" value={formatDuration(Number(session.duration_seconds || 0))} />
                  <Badge label="Ativas" value={session.active_kcal === null || session.active_kcal === undefined ? '--' : `${session.active_kcal} kcal`} />
                  <Badge label="Total" value={session.total_kcal === null || session.total_kcal === undefined ? '--' : `${session.total_kcal} kcal`} />
                  <Badge label="FC" value={session.avg_heart_rate ? `${session.avg_heart_rate}/${session.max_heart_rate ?? '--'} bpm` : '--'} />
                </div>

                {session.metrics_may_already_exist_in_health_connect && (
                  <p className="strength-watch-note-v403">Pode já estar incluído nas kcal ativas diárias do Health Connect.</p>
                )}
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
    <article className="simple-panel strength-watch-metric-v403">
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
    <span className="strength-watch-badge-v403">
      <small>{label}</small>
      <strong>{value}</strong>
    </span>
  );
}

function summarizeWearableStrength(sessions: any[]) {
  const totalDuration = sessions.reduce((total, session) => total + Number(session.duration_seconds || 0), 0);
  const activeKcal = sessions.reduce((total, session) => total + Number(session.active_kcal || 0), 0);
  const heartRateRows = sessions.filter((session) => Number(session.avg_heart_rate || 0) > 0);
  const maxHrRows = sessions.map((session) => Number(session.max_heart_rate || 0)).filter((value) => value > 0);

  const avgHeartRate = heartRateRows.length
    ? Math.round(heartRateRows.reduce((total, session) => total + Number(session.avg_heart_rate || 0), 0) / heartRateRows.length)
    : null;

  const maxHeartRate = maxHrRows.length ? Math.max(...maxHrRows) : null;
  const avgMinutes = sessions.length ? Math.round((totalDuration / 60) / sessions.length) : 0;

  return {
    sessions: sessions.length,
    durationSeconds: totalDuration,
    activeKcal,
    avgHeartRate,
    maxHeartRate,
    avgMinutes,
  };
}

function formatDuration(seconds: number) {
  const safeSeconds = Math.max(Number(seconds || 0), 0);
  const minutes = Math.round(safeSeconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h${String(rest).padStart(2, '0')}` : `${hours}h`;
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
