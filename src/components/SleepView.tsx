import { useCallback, useEffect, useMemo, useState } from 'react';
import { BedDouble, Brain, CheckCircle2, Clock3, HeartPulse, Moon, ShieldCheck, Sparkles, TriangleAlert, Watch } from 'lucide-react';
import { listSleepSessions } from '../services/sleepService';
import { DataSourceBadge, EmptyState, MetricCard, PageHeader } from './ui';


export default function SleepView({ userId, onError }) {
  const [sessions, setSessions] = useState([]);

  const load = useCallback(async () => {
    try {
      setSessions(await listSleepSessions(userId, 45));
    } catch (err) {
      onError(err.message);
    }
  }, [onError, userId]);

  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => buildSleepStats(sessions), [sessions]);
  const last = sessions[0] ?? null;


  return (
    <div className="sleep-page">
      <PageHeader
        eyebrow="Sono"
        title="Sono corrigido e recuperação"
        description="O sono consolidado corrige registros duplicados, incompletos ou com horários divergentes."
        action={<span className="pill"><Moon size={16} /> Prioridade sobre Health Connect</span>}
      />

      <section className="panel sleep-hero-panel">
        <div className="sleep-hero-main">
          <div>
            <p className="eyebrow">Último sono confiável</p>
            <h3>{last ? `${minutesToHours(last.duration_minutes)} · ${formatDate(last.sleep_date)}` : 'Nenhum sono corrigido ainda'}</h3>
            <p>{last ? `${last.sleep_start_time} → ${last.sleep_end_time} · ${last.source_app || last.source} · ${last.confidence}` : 'Use Registrar > JSON para importar sono corrigido.'}</p>
          </div>
          <div className="sleep-score-orb">
            <span>{last?.sleep_score ?? '--'}</span>
            <small>score</small>
          </div>
        </div>

        <div className="sleep-stage-grid">
          <SleepStage label="Profundo" value={minutesToHours(last?.deep_sleep_minutes)} percent={last?.deep_sleep_percent} tone="deep" />
          <SleepStage label="Leve" value={minutesToHours(last?.light_sleep_minutes)} percent={last?.light_sleep_percent} tone="light" />
          <SleepStage label="REM" value={minutesToHours(last?.rem_sleep_minutes)} percent={last?.rem_sleep_percent} tone="rem" />
          <SleepStage label="Acordado" value={minutesToHours(last?.awake_minutes)} percent={last?.awake_count ? `${last.awake_count}x` : null} tone="awake" />
        </div>
      </section>

      <div className="metric-grid four">
        <MetricCard icon={Clock3} label="Média corrigida" value={stats.avgHours ? `${stats.avgHours.toFixed(1)}h` : '--'} detail={`${sessions.length} registro(s)`} />
        <MetricCard icon={HeartPulse} label="FC média sono" value={stats.avgHeartRate ? `${stats.avgHeartRate} bpm` : '--'} detail="nos registros importados" />
        <MetricCard icon={Sparkles} label="Score médio" value={stats.avgScore || '--'} detail="pontuação Mi Fitness" />
        <MetricCard icon={ShieldCheck} label="SpO₂ médio" value={stats.avgSpo2 ? `${stats.avgSpo2}%` : '--'} detail="quando visível no print" />
      </div>

      <section className="panel centralized-json-note-v364">
        <div>
          <p className="eyebrow">Importação por JSON</p>
          <h3>Agora fica em Registrar &gt; JSON</h3>
          <p>Esta aba mostra histórico e métricas de sono. Para colar JSON do leitor de sono, use a central única de importação.</p>
        </div>
        <span className="pill">centralizado</span>
      </section>

      <section className="panel">
        <div className="section-title-row">
          <div>
            <p className="eyebrow">Histórico</p>
            <h3>Sessões corrigidas</h3>
          </div>
          <span className="pill">{sessions.length} registros</span>
        </div>

        {sessions.length === 0 ? (
          <EmptyState icon={BedDouble} title="Nenhum sono importado ainda" description="Use Registrar > JSON para importar o primeiro sono corrigido." />
        ) : (
          <div className="sleep-history-list">
            {sessions.map((item) => (
              <article className="sleep-history-card" key={item.id}>
                <div className="sleep-history-head">
                  <div>
                    <strong>{formatDate(item.sleep_date)} · {minutesToHours(item.duration_minutes)}</strong>
                    <span>{item.sleep_start_time} → {item.sleep_end_time} · {item.sleep_quality_label ?? 'sem classificação'}</span>
                  </div>
                  <span className="score-mini">{item.sleep_score ?? '--'}</span>
                </div>
                <DataSourceBadge source={item.import_method ?? item.source} label={item.source_app ?? item.source ?? 'Origem não informada'} />

                <div className="sleep-history-metrics">
                  <span>Prof. {minutesToHours(item.deep_sleep_minutes)}</span>
                  <span>Leve {minutesToHours(item.light_sleep_minutes)}</span>
                  <span>REM {minutesToHours(item.rem_sleep_minutes)}</span>
                  <span>Acordou {item.awake_count ?? '--'}x</span>
                  <span>FC {item.avg_heart_rate ?? '--'} bpm</span>
                  <span>SpO₂ {item.avg_spo2 ?? '--'}%</span>
                </div>

                {(item.overlap_detected || item.corrected_from_overlapping_records || item.warnings?.length > 0) && (
                  <div className="sleep-warning">
                    <TriangleAlert size={15} />
                    <span>{item.notes || 'Registro usado para corrigir divergência do Health Connect.'}</span>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="panel compact-panel">
        <p className="eyebrow">Como o app usa este dado</p>
        <div className="rules-explainer">
          <span><CheckCircle2 size={16} /> Se existir sono importado para o dia, ele tem prioridade no Dashboard e na aba Semana.</span>
          <span><Brain size={16} /> O relatório semanal usa o sono corrigido para cruzar recuperação, fome, treino e progresso.</span>
          <span><Watch size={16} /> O Health Connect continua sendo fonte automática, mas o print corrige quando houver divergência.</span>
        </div>
      </section>
    </div>
  );
}

function SleepStage({ label, value, percent, tone }) {
  return (
    <div className={`sleep-stage-card ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{percent ? `${percent}${typeof percent === 'number' ? '%' : ''}` : '--'}</small>
    </div>
  );
}

function buildSleepStats(sessions) {
  const durations = sessions.map((item) => Number(item.duration_minutes || 0)).filter(Boolean);
  const heartRates = sessions.map((item) => Number(item.avg_heart_rate || 0)).filter(Boolean);
  const scores = sessions.map((item) => Number(item.sleep_score || 0)).filter(Boolean);
  const spo2 = sessions.map((item) => Number(item.avg_spo2 || 0)).filter(Boolean);

  return {
    avgHours: durations.length ? (sum(durations) / durations.length) / 60 : 0,
    avgHeartRate: heartRates.length ? Math.round(sum(heartRates) / heartRates.length) : 0,
    avgScore: scores.length ? Math.round(sum(scores) / scores.length) : 0,
    avgSpo2: spo2.length ? Math.round(sum(spo2) / spo2.length) : 0,
  };
}

function minutesToHours(minutes) {
  if (minutes === null || minutes === undefined || minutes === '') return '--';
  const total = Number(minutes || 0);
  if (!total) return '--';
  const h = Math.floor(total / 60);
  const m = Math.round(total % 60);
  return h ? `${h}h${m ? ` ${m}min` : ''}` : `${m}min`;
}

function formatDate(dateKey) {
  if (!dateKey) return '--';
  const [year, month, day] = String(dateKey).split('-').map(Number);
  if (!year || !month || !day) return dateKey;
  return new Date(year, month - 1, day).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function sum(values) {
  return values.reduce((total, value) => total + Number(value || 0), 0);
}
