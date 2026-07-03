import { useCallback, useEffect, useMemo, useState } from 'react';
import { BedDouble, Brain, CheckCircle2, Clock3, Copy, FileJson, HeartPulse, Moon, Plus, ShieldCheck, Sparkles, TriangleAlert, Watch } from 'lucide-react';
import { listSleepSessions, normalizeSleepImportPayload, saveSleepSessionFromJson } from '../services/sleepService';

const EXAMPLE_SLEEP_JSON = `{
  "type": "sleep_session",
  "date": "2026-07-03",
  "sleep_start": "22:57",
  "sleep_end": "06:20",
  "duration_minutes": 438,
  "duration_text": "7h18min",
  "sleep_score": 76,
  "sleep_quality_label": "Razoável",
  "sleep_score_delta": 6,
  "sleep_percentile_text": "Superior a 62% de usuários na sua faixa etária.",
  "deep_sleep_minutes": 110,
  "deep_sleep_text": "1h50min",
  "deep_sleep_percent": 25,
  "deep_sleep_reference": "20%-40%",
  "light_sleep_minutes": 263,
  "light_sleep_text": "4h23min",
  "light_sleep_percent": 60,
  "light_sleep_reference": "20%-60%",
  "rem_sleep_minutes": 65,
  "rem_sleep_text": "1h5min",
  "rem_sleep_percent": 15,
  "rem_sleep_reference": "10%-30%",
  "awake_minutes": 5,
  "awake_text": "5min",
  "awake_count": 4,
  "awake_reference": "0-2 despertares",
  "awake_warning_label": "Alta",
  "avg_heart_rate": 57,
  "avg_spo2": 98,
  "breathing_score": 94,
  "source": "mi_fitness_screenshot",
  "source_app": "Mi Fitness",
  "device_name": "Redmi Watch 5 Active",
  "import_method": "screenshot_json",
  "replaces_health_connect_sleep": true,
  "counts_toward_daily_totals": true,
  "metrics_may_already_exist_in_health_connect": true,
  "overlap_detected": false,
  "corrected_from_overlapping_records": false,
  "confidence": "high",
  "dedupe_key": "2026-07-03_sleep_2257_0620_mi_fitness",
  "warnings": [],
  "notes": "Sono extraído de print do Mi Fitness. Este registro deve substituir o sono automático do Health Connect para este dia caso haja divergência."
}`;

export default function SleepView({ userId, onError }) {
  const [sessions, setSessions] = useState([]);
  const [jsonText, setJsonText] = useState('');
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);

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

  function handlePreview() {
    try {
      const parsed = JSON.parse(jsonText);
      setPreview(normalizeSleepImportPayload(parsed));
    } catch (err) {
      setPreview(null);
      onError(err.message);
    }
  }

  async function handleImport() {
    setBusy(true);
    try {
      const parsed = JSON.parse(jsonText);
      await saveSleepSessionFromJson(userId, parsed);
      setJsonText('');
      setPreview(null);
      await load();
      onError('Sono importado com sucesso. Ele terá prioridade no Dashboard e no relatório semanal.');
    } catch (err) {
      onError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function copyPromptHint() {
    const hint = 'Use o chat Leitor de Sono do projeto Atleta Híbrido. Envie o print do Mi Fitness e peça somente o JSON.';
    try {
      await navigator.clipboard.writeText(hint);
      onError('Instrução copiada para usar no chat leitor de sono.');
    } catch {
      onError('Não consegui copiar automaticamente.');
    }
  }

  return (
    <div className="sleep-page">
      <div className="page-title">
        <div>
          <p className="eyebrow">Sono</p>
          <h2>Sono corrigido e recuperação</h2>
          <p className="muted-text">Use esta aba para registrar o sono consolidado do Mi Fitness quando o Health Connect vier duplicado, incompleto ou com horário divergente.</p>
        </div>
        <span className="pill"><Moon size={16} /> Prioridade sobre Health Connect</span>
      </div>

      <section className="panel sleep-hero-panel">
        <div className="sleep-hero-main">
          <div>
            <p className="eyebrow">Último sono confiável</p>
            <h3>{last ? `${minutesToHours(last.duration_minutes)} · ${formatDate(last.sleep_date)}` : 'Nenhum sono corrigido ainda'}</h3>
            <p>{last ? `${last.sleep_start_time} → ${last.sleep_end_time} · ${last.source_app || last.source} · ${last.confidence}` : 'Cole o JSON gerado pelo leitor de sono para corrigir a sessão do dia.'}</p>
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
        <Metric icon={Clock3} label="Média corrigida" value={stats.avgHours ? `${stats.avgHours.toFixed(1)}h` : '--'} sub={`${sessions.length} registro(s)`} />
        <Metric icon={HeartPulse} label="FC média sono" value={stats.avgHeartRate ? `${stats.avgHeartRate} bpm` : '--'} sub="nos registros importados" />
        <Metric icon={Sparkles} label="Score médio" value={stats.avgScore || '--'} sub="pontuação Mi Fitness" />
        <Metric icon={ShieldCheck} label="SpO₂ médio" value={stats.avgSpo2 ? `${stats.avgSpo2}%` : '--'} sub="quando visível no print" />
      </div>

      <section className="panel sleep-import-panel">
        <div className="section-title-row">
          <div>
            <p className="eyebrow">Importar sono</p>
            <h3>JSON do leitor de imagem de sono</h3>
            <p className="muted-text">Esse registro substitui o sono automático do Health Connect naquele dia. Não soma com o sono automático.</p>
          </div>
          <div className="form-actions compact-actions">
            <button className="ghost-btn" type="button" onClick={copyPromptHint}><Copy size={16} /> Instrução</button>
            <button className="ghost-btn" type="button" onClick={() => setJsonText(EXAMPLE_SLEEP_JSON)}><FileJson size={16} /> Exemplo</button>
          </div>
        </div>

        <textarea
          className="json-import-box sleep-json-box"
          value={jsonText}
          onChange={(event) => setJsonText(event.target.value)}
          placeholder="Cole aqui o JSON retornado pelo chat leitor de sono."
        />

        <div className="form-actions">
          <button className="ghost-btn" type="button" onClick={handlePreview} disabled={!jsonText.trim()}>Validar JSON</button>
          <button className="primary-btn" type="button" onClick={handleImport} disabled={!jsonText.trim() || busy}><Plus size={16} /> Importar sono</button>
        </div>

        {preview && (
          <div className="sleep-preview">
            <strong>{minutesToHours(preview.duration_minutes)} · {formatDate(preview.sleep_date)}</strong>
            <span>{preview.sleep_start_time} → {preview.sleep_end_time} · score {preview.sleep_score ?? '--'} · FC {preview.avg_heart_rate ?? '--'} bpm · SpO₂ {preview.avg_spo2 ?? '--'}%</span>
            <small>Fonte: {preview.source_app || preview.source}. Substitui o sono automático do Health Connect para esse dia.</small>
          </div>
        )}
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
          <div className="empty-state">
            <BedDouble size={34} />
            <strong>Nenhum sono importado ainda</strong>
            <p>Cole o JSON do leitor de sono para começar a corrigir divergências do Health Connect.</p>
          </div>
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

function Metric({ icon: Icon, label, value, sub }) {
  return <div className="small-metric"><span><Icon size={15} /> {label}</span><strong>{value}</strong><p>{sub}</p></div>;
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
