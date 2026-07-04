import { useState } from 'react';
import { CheckCircle2, Copy, FileJson, Plus, ShieldCheck } from 'lucide-react';
import { normalizeCardioImportPayload, saveCardioSessionFromJson } from '../services/cardioService';
import { normalizeMealImportPayload, saveMealEntriesFromJson } from '../services/mealService';
import { normalizeSleepImportPayload, saveSleepSessionFromJson } from '../services/sleepService';
import { normalizeWearableWorkoutPayload, saveWearableWorkoutSessionFromJson } from '../services/strengthWearableService';

const CARDIO_EXAMPLE = `{
  "type": "cardio_session",
  "activity_type": "treadmill",
  "activity_label": "Esteira",
  "date": "2026-07-02",
  "start_time": "17:51",
  "duration_seconds": 1368,
  "distance_km": 2.0,
  "active_kcal": 238,
  "total_kcal": 280,
  "avg_heart_rate": 131,
  "max_heart_rate": 170,
  "steps": 2667,
  "source": "mi_fitness_screenshot",
  "source_app": "Mi Fitness",
  "device_name": "Redmi Watch 5 Active",
  "counts_toward_daily_totals": false,
  "metrics_may_already_exist_in_health_connect": true,
  "confidence": "high"
}`;

const SLEEP_EXAMPLE = `{
  "type": "sleep_session",
  "date": "2026-07-03",
  "sleep_start": "22:57",
  "sleep_end": "06:20",
  "duration_minutes": 438,
  "duration_text": "7h18min",
  "sleep_score": 76,
  "sleep_quality_label": "Razoável",
  "deep_sleep_minutes": 110,
  "deep_sleep_percent": 25,
  "light_sleep_minutes": 263,
  "light_sleep_percent": 60,
  "rem_sleep_minutes": 65,
  "rem_sleep_percent": 15,
  "awake_minutes": 5,
  "awake_count": 4,
  "avg_heart_rate": 57,
  "avg_spo2": 98,
  "breathing_score": 94,
  "source": "mi_fitness_screenshot",
  "source_app": "Mi Fitness",
  "device_name": "Redmi Watch 5 Active",
  "replaces_health_connect_sleep": true,
  "counts_toward_daily_totals": true,
  "metrics_may_already_exist_in_health_connect": true,
  "confidence": "high"
}`;

const FOOD_TEXT_EXAMPLE = `{
  "type": "meal_import",
  "date": "2026-07-04",
  "meal_type": "almoco",
  "items": [
    {
      "food_name": "Arroz branco cozido",
      "grams": 150,
      "kcal": 192,
      "protein_g": 3.8,
      "carbs_g": 42,
      "fat_g": 0.3
    },
    {
      "food_name": "Patinho moído cozido",
      "grams": 125,
      "kcal": 274,
      "protein_g": 33.8,
      "carbs_g": 0,
      "fat_g": 15
    },
    {
      "food_name": "Salada com alface, tomate, maçã e manga",
      "grams": 100,
      "kcal": 55,
      "protein_g": 1,
      "carbs_g": 13,
      "fat_g": 0.2
    }
  ],
  "source": "food_text_ai",
  "confidence": "estimated",
  "warnings": []
}`;

const FOOD_PHOTO_EXAMPLE = `{
  "type": "meal_import",
  "date": "2026-07-04",
  "meal_type": "jantar",
  "items": [
    {
      "food_name": "Hambúrguer artesanal estimado",
      "grams": 280,
      "kcal": 720,
      "protein_g": 36,
      "carbs_g": 58,
      "fat_g": 38
    },
    {
      "food_name": "Batata frita estimada",
      "grams": 120,
      "kcal": 375,
      "protein_g": 4,
      "carbs_g": 49,
      "fat_g": 18
    }
  ],
  "source": "food_photo_ai",
  "confidence": "estimated",
  "warnings": [
    "Valores estimados por foto. Confirme peso/ingredientes se possível."
  ]
}`;

const FOOD_SNACK_EXAMPLE = `{
  "type": "meal_import",
  "date": "2026-07-04",
  "meal_type": "lanche2",
  "items": [
    {
      "food_name": "Shake de morango com leite e whey",
      "grams": 450,
      "kcal": 360,
      "protein_g": 36,
      "carbs_g": 42,
      "fat_g": 6
    }
  ],
  "source": "food_text_ai",
  "confidence": "estimated",
  "warnings": []
}`;

const FOOD_OUT_EXAMPLE = `{
  "type": "meal_import",
  "date": "2026-07-04",
  "meal_type": "extra",
  "items": [
    {
      "food_name": "Salgado de feira de presunto e queijo estimado",
      "grams": 180,
      "kcal": 520,
      "protein_g": 18,
      "carbs_g": 55,
      "fat_g": 26
    },
    {
      "food_name": "Suco de maracujá adoçado estimado",
      "grams": 500,
      "kcal": 220,
      "protein_g": 1,
      "carbs_g": 54,
      "fat_g": 0
    }
  ],
  "source": "food_text_ai",
  "confidence": "estimated",
  "warnings": [
    "Refeição fora de casa estimada; pode variar bastante."
  ]
}`;

const STRENGTH_EXAMPLE = `{
  "type": "strength_wearable_session",
  "activity_type": "strength_training",
  "activity_label": "Força",
  "date": "2026-07-03",
  "start_time": "18:10",
  "duration_seconds": 1569,
  "duration_text": "00:26:09",
  "active_kcal": 178,
  "total_kcal": 226,
  "avg_heart_rate": 96,
  "max_heart_rate": 133,
  "training_effect": 1,
  "source": "mi_fitness_screenshot",
  "source_app": "Mi Fitness",
  "device_name": "Redmi Watch 5 Active",
  "import_method": "screenshot_json",
  "counts_toward_daily_totals": false,
  "metrics_may_already_exist_in_health_connect": true,
  "confidence": "high"
}`;

const IMPORT_TYPES = [
  {
    id: 'auto',
    label: 'Detectar',
    title: 'Detectar automaticamente',
    description: 'Cole qualquer JSON do projeto: comida, sono, cardio ou treino do relógio.',
    example: FOOD_TEXT_EXAMPLE,
    promptHint: 'Cole o JSON gerado por um dos leitores oficiais do projeto Atleta Híbrido. A central tentará detectar se é comida, sono, cardio ou treino do relógio.',
  },
  {
    id: 'meal',
    label: 'Comida',
    title: 'Comida por JSON',
    description: 'Importa alimentos estimados por foto, texto, print ou lista com gramas.',
    example: FOOD_TEXT_EXAMPLE,
    examples: [
      { id: 'text', label: 'Almoço com gramas', value: FOOD_TEXT_EXAMPLE },
      { id: 'photo', label: 'Foto estimada', value: FOOD_PHOTO_EXAMPLE },
      { id: 'snack', label: 'Lanche/shake', value: FOOD_SNACK_EXAMPLE },
      { id: 'out', label: 'Fora de casa', value: FOOD_OUT_EXAMPLE },
    ],
    promptHint: 'Use o chat Leitor de Comida do projeto Atleta Híbrido. Envie foto, print ou texto da refeição e peça somente o JSON no formato meal_import.',
  },
  {
    id: 'sleep',
    label: 'Sono',
    title: 'Sono do Mi Fitness',
    description: 'Corrige o sono consolidado e substitui divergências do Health Connect.',
    example: SLEEP_EXAMPLE,
    promptHint: 'Use o chat Leitor de Sono do projeto Atleta Híbrido. Envie o print do Mi Fitness e peça somente o JSON.',
  },
  {
    id: 'cardio',
    label: 'Cardio',
    title: 'Cardio / corrida / esteira',
    description: 'Cria uma sessão de cardio sem duplicar os totais diários.',
    example: CARDIO_EXAMPLE,
    promptHint: 'Use o chat Leitor de Cardio do projeto Atleta Híbrido. Envie o print do treino e peça somente o JSON.',
  },
  {
    id: 'strength',
    label: 'Força relógio',
    title: 'Treino de força do relógio',
    description: 'Salva os dados fisiológicos do treino: duração, kcal, FC e efeito.',
    example: STRENGTH_EXAMPLE,
    promptHint: 'Use o chat Leitor de Treino do Relógio do projeto Atleta Híbrido. Envie o print do Mi Fitness e peça somente o JSON.',
  },
];

export default function ImportJsonView({ userId, onError }) {
  const [kind, setKind] = useState('auto');
  const [jsonText, setJsonText] = useState('');
  const [preview, setPreview] = useState(null);
  const [resolvedKind, setResolvedKind] = useState(null);
  const [busy, setBusy] = useState(false);

  const config = getImportType(kind);
  const examples = config.examples ?? [{ id: 'default', label: 'Exemplo', value: config.example }];

  function resolveKind(raw) {
    if (kind !== 'auto') return kind;

    const type = String(raw?.type ?? raw?.activity_type ?? '').toLowerCase();

    if (type.includes('meal') || type.includes('food') || type.includes('nutrition') || raw?.food_name || raw?.alimento || raw?.items || raw?.foods || raw?.meals) return 'meal';
    if (type.includes('sleep') || raw?.sleep_start || raw?.sleep_end || raw?.sleep_score) return 'sleep';
    if (type.includes('strength') || type.includes('força') || raw?.training_effect || raw?.vitality_score) return 'strength';
    if (type.includes('cardio') || raw?.distance_km || raw?.avg_pace_min_per_km || raw?.activity_label === 'Esteira') return 'cardio';

    throw new Error('Não consegui detectar o tipo do JSON. Escolha Comida, Sono, Cardio ou Força relógio manualmente.');
  }

  function normalizeByKind(targetKind, raw) {
    if (targetKind === 'meal') return normalizeMealImportPayload(raw);
    if (targetKind === 'sleep') return normalizeSleepImportPayload(raw);
    if (targetKind === 'strength') return normalizeWearableWorkoutPayload(raw);
    return normalizeCardioImportPayload(raw);
  }

  async function saveByKind(targetKind, raw) {
    if (targetKind === 'meal') return saveMealEntriesFromJson(userId, raw);
    if (targetKind === 'sleep') return saveSleepSessionFromJson(userId, raw);
    if (targetKind === 'strength') return saveWearableWorkoutSessionFromJson(userId, raw);
    return saveCardioSessionFromJson(userId, raw);
  }

  function parseJson() {
    try {
      return JSON.parse(jsonText);
    } catch {
      throw new Error('JSON inválido. Verifique vírgulas, aspas e chaves. Dica: cole exatamente o JSON puro retornado pelo leitor.');
    }
  }

  function handlePreview() {
    try {
      const raw = parseJson();
      const targetKind = resolveKind(raw);
      const normalized = normalizeByKind(targetKind, raw);

      setResolvedKind(targetKind);
      setPreview(normalized);
      onError?.(`JSON validado como ${getImportType(targetKind).label}.`);
    } catch (err: any) {
      setPreview(null);
      setResolvedKind(null);
      onError?.(err.message);
    }
  }

  async function handleImport() {
    try {
      setBusy(true);
      const raw = parseJson();
      const targetKind = resolveKind(raw);

      await saveByKind(targetKind, raw);

      setJsonText('');
      setPreview(null);
      setResolvedKind(null);
      onError?.(`${getImportType(targetKind).label} importado com sucesso.`);
    } catch (err: any) {
      onError?.(err.message);
    } finally {
      setBusy(false);
    }
  }

  function applyExample(example = examples[0]) {
    setJsonText(example.value);
    setPreview(null);
    setResolvedKind(null);
  }

  async function copyPromptHint() {
    try {
      await navigator.clipboard.writeText(config.promptHint);
      onError?.('Instrução do leitor copiada.');
    } catch {
      onError?.('Não consegui copiar automaticamente. Copie manualmente a instrução exibida na tela.');
    }
  }

  return (
    <div className="json-hub-page-v364">
      <div className="page-title compact-title">
        <div>
          <p className="eyebrow">Importar JSON</p>
          <h2>Central de atualizações</h2>
          <p className="muted-text">Todos os JSONs do projeto ficam aqui: comida, sono, cardio e treino do relógio.</p>
        </div>
      </div>

      <section className="simple-panel json-hub-help-v364">
        <ShieldCheck size={22} />
        <div>
          <strong>Regra anti-bagunça</strong>
          <span>As outras abas mostram histórico e uso diário. Importação por JSON agora fica centralizada só aqui.</span>
        </div>
      </section>

      <section className="simple-panel json-importer-v364">
        <div className="json-type-tabs-v364">
          {IMPORT_TYPES.map((item) => (
            <button key={item.id} type="button" className={kind === item.id ? 'active' : ''} onClick={() => {
              setKind(item.id);
              setPreview(null);
              setResolvedKind(null);
            }}>
              {item.label}
            </button>
          ))}
        </div>

        <div className="json-import-head-v364">
          <div>
            <p className="eyebrow">{config.label}</p>
            <h3>{config.title}</h3>
            <span>{config.description}</span>
          </div>
          <div className="json-head-actions-v367">
            <button className="ghost-btn" type="button" onClick={copyPromptHint}><Copy size={16} /> Copiar instrução</button>
            <button className="ghost-btn" type="button" onClick={() => applyExample()}><FileJson size={16} /> Exemplo</button>
          </div>
        </div>

        {config.promptHint && (
          <div className="json-prompt-hint-v367">
            <strong>Leitor recomendado</strong>
            <span>{config.promptHint}</span>
          </div>
        )}

        {examples.length > 1 && (
          <div className="json-example-list-v367">
            {examples.map((example) => (
              <button key={example.id} type="button" onClick={() => applyExample(example)}>
                {example.label}
              </button>
            ))}
          </div>
        )}

        <textarea
          className="json-import-box json-hub-textarea-v364"
          value={jsonText}
          onChange={(event) => {
            setJsonText(event.target.value);
            setPreview(null);
            setResolvedKind(null);
          }}
          placeholder="Cole aqui o JSON puro retornado pelo leitor."
        />

        <div className="form-actions">
          <button className="ghost-btn" type="button" onClick={handlePreview} disabled={!jsonText.trim()}>Validar JSON</button>
          <button className="primary-btn" type="button" onClick={handleImport} disabled={!jsonText.trim() || busy}><Plus size={16} /> Importar</button>
        </div>

        {preview && (
          <div className="json-preview-v364">
            <CheckCircle2 size={18} />
            <div>
              <strong>{buildPreviewTitle(resolvedKind, preview)}</strong>
              <span>{buildPreviewSubtitle(resolvedKind, preview)}</span>
              <small>Tipo detectado: {getImportType(resolvedKind).label}</small>
              {resolvedKind === 'meal' && <MealPreviewItems items={preview.items ?? []} />}
            </div>
          </div>
        )}
      </section>

      <section className="simple-panel json-rules-v364">
        <p className="eyebrow">Onde cada coisa entra</p>
        <div>
          <span><strong>Comida</strong> aparece em Registrar &gt; Comida e entra nas kcal do dia.</span>
          <span><strong>Sono</strong> aparece em Progresso &gt; Sono e influencia prontidão/semana.</span>
          <span><strong>Cardio</strong> aparece em Registrar &gt; Cardio e no histórico de cardio.</span>
          <span><strong>Força relógio</strong> aparece na Academia como dado fisiológico do treino.</span>
        </div>
      </section>
    </div>
  );
}

function MealPreviewItems({ items }) {
  if (!items.length) return null;

  return (
    <div className="meal-preview-items-v367">
      {items.slice(0, 5).map((item, index) => (
        <div key={`${item.food_name}-${index}`}>
          <strong>{item.food_name}</strong>
          <span>{item.grams}g · {item.kcal} kcal · P {item.protein_g ?? 0}g · C {item.carbs_g ?? 0}g · G {item.fat_g ?? 0}g</span>
        </div>
      ))}
    </div>
  );
}

function getImportType(kind) {
  return IMPORT_TYPES.find((item) => item.id === kind) ?? IMPORT_TYPES[0];
}

function buildPreviewTitle(kind, preview) {
  if (kind === 'meal') return `${preview.items?.length ?? 0} item(ns) · ${preview.total_kcal ?? 0} kcal`;
  if (kind === 'sleep') return `${minutesToHours(preview.duration_minutes)} · ${formatDate(preview.sleep_date)}`;
  if (kind === 'strength') return `${preview.activity_label ?? 'Força'} · ${formatDuration(preview.duration_seconds)}`;
  return `${preview.activity_label ?? 'Cardio'} · ${Number(preview.distance_km || 0).toFixed(2)} km`;
}

function buildPreviewSubtitle(kind, preview) {
  if (kind === 'meal') return `${formatDate(preview.log_date)} · ${preview.items?.map((item) => item.food_name).slice(0, 3).join(', ')}`;
  if (kind === 'sleep') return `${preview.sleep_start_time} → ${preview.sleep_end_time} · score ${preview.sleep_score ?? '--'}`;
  if (kind === 'strength') return `${preview.active_kcal ?? '--'} kcal ativas · FC ${preview.avg_heart_rate ?? '--'} bpm`;
  return `${formatDuration(preview.duration_seconds)} · ${preview.active_kcal ?? '--'} kcal · FC ${preview.avg_heart_rate ?? '--'} bpm`;
}

function minutesToHours(minutes) {
  const total = Number(minutes || 0);
  if (!total) return '--';
  const h = Math.floor(total / 60);
  const m = Math.round(total % 60);
  return h ? `${h}h${m ? ` ${m}min` : ''}` : `${m}min`;
}

function formatDuration(seconds) {
  const total = Number(seconds || 0);
  if (!total) return '--';
  const min = Math.floor(total / 60);
  const sec = String(Math.round(total % 60)).padStart(2, '0');
  return `${min}:${sec}`;
}

function formatDate(dateKey) {
  if (!dateKey) return '--';
  const [year, month, day] = String(dateKey).split('-').map(Number);
  if (!year || !month || !day) return dateKey;
  return new Date(year, month - 1, day).toLocaleDateString('pt-BR');
}
