import { useCallback, useEffect, useState } from 'react';
import { Activity, Bluetooth, CheckCircle2, FileUp, Link2, RefreshCcw, Save, Smartphone, Trash2, Watch } from 'lucide-react';
import { todayKey } from '../services/dailyService';
import {
  configureRedmiMiFitness,
  deleteWearableMetric,
  listHealthIntegrations,
  listWearableMetrics,
  upsertHealthIntegration,
  upsertWearableMetric,
} from '../services/wearableService';
import { HEALTH_PLATFORM_OPTIONS, SYNC_MODE_OPTIONS, WEARABLE_OPTIONS } from '../data/defaultPlan';
import { PageHeader } from './ui';
import { localDateKey } from '../utils/dates';

const EMPTY_INTEGRATION = {
  provider: 'redmi_mi_fitness',
  device_name: 'Redmi Watch 5 Active',
  source_app: 'Mi Fitness',
  sync_mode: 'health_connect',
  status: 'configured',
  permissions_text: 'passos, sono, frequência cardíaca, treino, distância, calorias ativas',
  notes: 'Fluxo recomendado para Android: Mi Fitness → Health Connect → app Android ponte → Supabase.',
};


const EMPTY_METRIC = {
  metric_date: todayKey(),
  provider: 'redmi_mi_fitness',
  source: 'manual_mi_fitness',
  steps: '',
  sleep_hours: '',
  avg_heart_rate: '',
  resting_heart_rate: '',
  active_kcal: '',
  workout_minutes: '',
  distance_km: '',
  notes: '',
};

export default function IntegrationsView({ userId, profile, onError, onNavigate }) {
  const [integrations, setIntegrations] = useState([]);
  const [metrics, setMetrics] = useState([]);
  const [integrationForm, setIntegrationForm] = useState(EMPTY_INTEGRATION);
  const [metricForm, setMetricForm] = useState(EMPTY_METRIC);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [integrationData, metricData] = await Promise.all([
        listHealthIntegrations(userId),
        listWearableMetrics(userId, 21),
      ]);
      setIntegrations(integrationData);
      setMetrics(metricData);
      if (integrationData[0]) {
        setIntegrationForm({ ...EMPTY_INTEGRATION, ...integrationData[0] });
      }
    } catch (err) {
      onError(err.message);
    }
  }, [userId, onError]);

  useEffect(() => {
    load();
  }, [load]);

  const lastMetric = metrics[0];
  const todayMetric = metrics.find((metric) => metric.metric_date === todayKey()) ?? lastMetric;
  const derivedStatus = buildIntegrationStatus(integrations[0], lastMetric);

  async function handleConfigureRedmi() {
    setBusy(true);
    try {
      await configureRedmiMiFitness(userId);
      await load();
      onError('Integração Redmi Watch + Mi Fitness preparada. Próximo passo: ponte Health Connect ou registro manual.');
    } catch (err) {
      onError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveIntegration(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await upsertHealthIntegration(userId, integrationForm);
      await load();
      onError('Configuração de integração salva.');
    } catch (err) {
      onError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveMetric(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await upsertWearableMetric(userId, {
        metric_date: metricForm.metric_date,
        provider: metricForm.provider,
        source: metricForm.source || 'manual_mi_fitness',
        steps: metricForm.steps,
        sleep_minutes: hoursToMinutes(metricForm.sleep_hours),
        avg_heart_rate: metricForm.avg_heart_rate,
        resting_heart_rate: metricForm.resting_heart_rate,
        active_kcal: metricForm.active_kcal,
        workout_minutes: metricForm.workout_minutes,
        distance_km: metricForm.distance_km,
        notes: metricForm.notes,
      });
      setMetricForm({ ...EMPTY_METRIC, metric_date: todayKey() });
      await load();
      onError('Métricas do relógio salvas.');
    } catch (err) {
      onError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteMetric(id) {
    if (!confirm('Remover este registro de métricas?')) return;
    try {
      await deleteWearableMetric(userId, id);
      await load();
    } catch (err) {
      onError(err.message);
    }
  }


  async function handleFileImport(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const text = await file.text();
      const rows = parseHealthFile(text, file.name);
      if (!rows.length) throw new Error('Não encontrei linhas compatíveis. Use CSV/JSON com campos como date, steps, sleep, avg_heart_rate, active_kcal, distance_km.');

      for (const row of rows) {
        await upsertWearableMetric(userId, row);
      }
      await load();
      onError(`${rows.length} registro(s) importado(s). Confira os dados antes de usar para decisões.`);
    } catch (err) {
      onError(err.message);
    } finally {
      setBusy(false);
      event.target.value = '';
    }
  }

  return (
    <div>
      <PageHeader
        title="Saúde"
        description="Dados recebidos do relógio e conexão com o celular."
        action={<span className="pill"><Watch size={16} /> {WEARABLE_OPTIONS[profile?.wearable_provider] ?? 'Manual'}</span>}
      />

      <details className="panel disclosure-panel">
        <summary>Conectar relógio</summary>
        <p>Sincronize o Mi Fitness com o Health Connect e envie os dados pelo aplicativo Android Atleta Hib.</p>
        <div className="integration-flow">
          <span><Watch size={18} /> Relógio</span>
          <span><Smartphone size={18} /> Mi Fitness</span>
          <span><Activity size={18} /> Health Connect</span>
          <span><Link2 size={18} /> Supabase</span>
        </div>
        <button className="primary-btn" onClick={handleConfigureRedmi} disabled={busy}><Bluetooth size={16} /> Preparar Redmi + Mi Fitness</button>
      </details>

      <div className="metric-grid">
        <Metric icon={CheckCircle2} label="Status" value={derivedStatus.value} sub={derivedStatus.sub} />
        <Metric icon={Activity} label="FC média" value={todayMetric?.avg_heart_rate ? `${todayMetric.avg_heart_rate} bpm` : '--'} sub={todayMetric?.metric_date ? `registro ${formatDate(todayMetric.metric_date)}` : 'sem registro'} />
        <Metric icon={RefreshCcw} label="Kcal ativas" value={todayMetric?.active_kcal ?? '--'} sub={formatWearableSource(todayMetric?.source, todayMetric?.provider)} />
        <Metric icon={Watch} label="Passos hoje" value={todayMetric?.metric_date === todayKey() ? `${todayMetric.steps ?? '--'}` : '--'} sub={todayMetric?.metric_date === todayKey() ? 'último registro recebido' : 'sem registro hoje'} />
      </div>

      {lastMetric && <p className="muted-text">Últimos dados: {formatDate(lastMetric.metric_date)} · {formatWearableSource(lastMetric.source, lastMetric.provider)}</p>}
      <button className="ghost-btn" type="button" onClick={() => onNavigate?.('progressHub', { progressTab: 'week' })}>Ver tendências em Progresso</button>

      <details className="panel disclosure-panel">
        <summary>Configuração da integração</summary>
        <form className="form-grid" onSubmit={handleSaveIntegration}>
          <label>Dispositivo
            <input value={integrationForm.device_name ?? ''} onChange={(e) => setIntegrationForm({ ...integrationForm, device_name: e.target.value })} />
          </label>
          <label>App origem
            <input value={integrationForm.source_app ?? ''} onChange={(e) => setIntegrationForm({ ...integrationForm, source_app: e.target.value })} />
          </label>
          <label>Fornecedor
            <select value={integrationForm.provider ?? 'manual'} onChange={(e) => setIntegrationForm({ ...integrationForm, provider: e.target.value })}>
              {Object.entries(WEARABLE_OPTIONS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label>Modo de sincronização
            <select value={integrationForm.sync_mode ?? 'manual'} onChange={(e) => setIntegrationForm({ ...integrationForm, sync_mode: e.target.value })}>
              {Object.entries(SYNC_MODE_OPTIONS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label>Plataforma de saúde
            <select value={profile?.health_platform ?? 'none'} disabled>
              {Object.entries(HEALTH_PLATFORM_OPTIONS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label>Status
            <select value={integrationForm.status ?? 'planned'} onChange={(e) => setIntegrationForm({ ...integrationForm, status: e.target.value })}>
              <option value="planned">planejado</option>
              <option value="configured">configurado</option>
              <option value="connected">conectado</option>
              <option value="paused">pausado</option>
              <option value="error">erro</option>
            </select>
          </label>
          <label className="full">Permissões pretendidas
            <textarea value={integrationForm.permissions_text ?? ''} onChange={(e) => setIntegrationForm({ ...integrationForm, permissions_text: e.target.value })} />
          </label>
          <label className="full">Notas técnicas
            <textarea value={integrationForm.notes ?? ''} onChange={(e) => setIntegrationForm({ ...integrationForm, notes: e.target.value })} />
          </label>
          <button className="primary-btn" disabled={busy}><Save size={16} /> Salvar integração</button>
        </form>
      </details>
      <details className="panel disclosure-panel">
        <summary>Registrar métricas manualmente</summary>
        <form className="form-grid" onSubmit={handleSaveMetric}>
          <label>Data
            <input type="date" value={metricForm.metric_date} onChange={(e) => setMetricForm({ ...metricForm, metric_date: e.target.value })} />
          </label>
          <label>Fonte
            <select value={metricForm.source} onChange={(e) => setMetricForm({ ...metricForm, source: e.target.value })}>
              <option value="manual_mi_fitness">Manual — Mi Fitness</option>
              <option value="health_connect">Health Connect</option>
              <option value="strava">Strava</option>
              <option value="xiaomi_export">Exportação Xiaomi</option>
            </select>
          </label>
          <label>Passos
            <input type="number" value={metricForm.steps} onChange={(e) => setMetricForm({ ...metricForm, steps: e.target.value })} />
          </label>
          <label>Sono horas
            <input type="number" step="0.1" value={metricForm.sleep_hours} onChange={(e) => setMetricForm({ ...metricForm, sleep_hours: e.target.value })} />
          </label>
          <label>FC média
            <input type="number" value={metricForm.avg_heart_rate} onChange={(e) => setMetricForm({ ...metricForm, avg_heart_rate: e.target.value })} />
          </label>
          <label>FC repouso
            <input type="number" value={metricForm.resting_heart_rate} onChange={(e) => setMetricForm({ ...metricForm, resting_heart_rate: e.target.value })} />
          </label>
          <label>Calorias ativas
            <input type="number" value={metricForm.active_kcal} onChange={(e) => setMetricForm({ ...metricForm, active_kcal: e.target.value })} />
          </label>
          <label>Treino minutos
            <input type="number" value={metricForm.workout_minutes} onChange={(e) => setMetricForm({ ...metricForm, workout_minutes: e.target.value })} />
          </label>
          <label>Distância km
            <input type="number" step="0.01" value={metricForm.distance_km} onChange={(e) => setMetricForm({ ...metricForm, distance_km: e.target.value })} />
          </label>
          <label className="full">Notas
            <textarea value={metricForm.notes} onChange={(e) => setMetricForm({ ...metricForm, notes: e.target.value })} />
          </label>
          <button className="primary-btn" disabled={busy}><Save size={16} /> Salvar métricas</button>
        </form>
      </details>

      <details className="panel disclosure-panel">
        <summary>Importar arquivo de métricas</summary>
        <p className="muted-text">Aceita arquivos com campos parecidos com: date, steps, sleep_minutes, avg_heart_rate, resting_heart_rate, active_kcal, workout_minutes, distance_km. Como exportações variam, confira os registros importados.</p>
        <label className="file-drop">
          <FileUp size={18} /> Importar CSV/JSON
          <input type="file" accept=".csv,.json,.txt" onChange={handleFileImport} />
        </label>
      </details>

      <section className="panel">
        <p className="eyebrow">Histórico importado/manual</p>
        {metrics.length === 0 ? <p className="muted-text">Nenhum dado de relógio registrado ainda.</p> : (
          <div className="table-list">
            {metrics.map((item) => (
              <div className="table-row" key={item.id}>
                <div>
                  <strong>{formatDate(item.metric_date)} · {formatWearableSource(item.source, item.provider)}</strong>
                  <span>{item.readiness_hint ?? 'Sem alerta.'}</span>
                </div>
                <div className="metric-inline">
                  <span>{item.steps ?? '--'} passos</span>
                  <span>{item.avg_heart_rate ? `${item.avg_heart_rate} bpm` : '-- bpm'}</span>
                  <span>{item.active_kcal ?? '--'} kcal</span>
                  <span>{minutesToHours(item.sleep_minutes)}</span>
                  <span>{item.distance_km ? `${Number(item.distance_km).toFixed(2)} km` : '-- km'}</span>
                  <button className="icon-danger" type="button" aria-label="Remover registro de métricas" title="Remover registro" onClick={() => handleDeleteMetric(item.id)}><Trash2 size={16} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}


function buildIntegrationStatus(integration, lastMetric) {
  if (lastMetric) {
    return {
      value: 'conectado',
      sub: `${formatWearableSource(lastMetric.source, lastMetric.provider)} · ${formatDate(lastMetric.metric_date)}`,
    };
  }

  return {
    value: integration?.status ?? 'não configurado',
    sub: integration?.sync_mode ?? 'manual',
  };
}

function formatWearableSource(source, provider) {
  const raw = String(source || provider || '').toLowerCase();
  if (raw.includes('health_connect') || raw.includes('bridge')) return 'Health Connect';
  if (raw.includes('mi_fitness') || raw.includes('redmi')) return 'Mi Fitness';
  if (raw.includes('manual')) return 'manual';
  return source || provider || 'wearable';
}

function Metric({ icon: Icon, label, value, sub }) {
  return (
    <div className="metric-card">
      <div className="metric-head"><Icon size={20} /><span>{label}</span></div>
      <strong>{value}</strong>
      <p>{sub}</p>
    </div>
  );
}

function hoursToMinutes(hours) {
  if (hours === '' || hours === null || hours === undefined) return null;
  return Math.round(Number(hours) * 60);
}

function minutesToHours(minutes) {
  if (!minutes) return '-- h';
  return `${(Number(minutes) / 60).toFixed(1)}h sono`;
}

function formatDate(value) {
  if (!value) return '--';
  const [year, month, day] = String(value).split('-');
  return `${day}/${month}/${year}`;
}

function parseHealthFile(text, fileName) {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.json')) return parseJsonHealth(text);
  return parseCsvHealth(text);
}

function parseJsonHealth(text) {
  const parsed = JSON.parse(text);
  const rows = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.data) ? parsed.data : Array.isArray(parsed?.records) ? parsed.records : [];
  return rows.map(normalizeHealthRow).filter(Boolean);
}

function parseCsvHealth(text) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];
  const separator = lines[0].includes(';') ? ';' : ',';
  const headers = lines[0].split(separator).map((h) => cleanKey(h));
  return lines.slice(1).map((line) => {
    const values = line.split(separator).map((v) => v.trim().replace(/^"|"$/g, ''));
    const row = headers.reduce((obj, key, index) => ({ ...obj, [key]: values[index] }), {});
    return normalizeHealthRow(row);
  }).filter(Boolean);
}

function normalizeHealthRow(row) {
  const date = findValue(row, ['date', 'data', 'metric_date', 'day', 'start_time', 'time']);
  const metricDate = normalizeDate(date);
  if (!metricDate) return null;

  return {
    metric_date: metricDate,
    provider: 'redmi_mi_fitness',
    source: 'xiaomi_export',
    steps: findNumber(row, ['steps', 'passos', 'step_count']),
    sleep_minutes: findNumber(row, ['sleep_minutes', 'sono_minutos', 'sleep', 'sleep_duration']),
    avg_heart_rate: findNumber(row, ['avg_heart_rate', 'heart_rate', 'hr_avg', 'fc_media']),
    resting_heart_rate: findNumber(row, ['resting_heart_rate', 'resting_hr', 'fc_reposo', 'fc_repouso']),
    active_kcal: findNumber(row, ['active_kcal', 'calories', 'calorias_ativas', 'active_calories']),
    workout_minutes: findNumber(row, ['workout_minutes', 'duration_minutes', 'exercise_minutes', 'treino_minutos']),
    distance_km: findNumber(row, ['distance_km', 'distance', 'distancia_km']),
    notes: 'Importado por arquivo. Conferir mapeamento.',
    raw_payload: row,
  };
}

function cleanKey(value) {
  return String(value).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_');
}

function findValue(row, keys) {
  const normalized = Object.fromEntries(Object.entries(row).map(([key, value]) => [cleanKey(key), value]));
  for (const key of keys) {
    if (normalized[cleanKey(key)] !== undefined && normalized[cleanKey(key)] !== '') return normalized[cleanKey(key)];
  }
  return null;
}

function findNumber(row, keys) {
  const value = findValue(row, keys);
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(String(value).replace(',', '.').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeDate(value) {
  if (!value) return null;
  const raw = String(value).trim();
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = raw.match(/^(\d{2})[/-](\d{2})[/-](\d{4})/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return localDateKey(date);
}
