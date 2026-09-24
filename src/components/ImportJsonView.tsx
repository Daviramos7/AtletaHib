import { useState } from 'react';
import { CheckCircle2, Copy, FileJson, Plus } from 'lucide-react';
import { findCardioGymCandidates, isCardioImportShape, normalizeCardioImportPayload, saveCardioSessionFromJson } from '../services/cardioService';
import { normalizeMealImportPayload, saveMealEntriesFromJson } from '../services/mealService';
import { normalizeSleepImportPayload, saveSleepSessionFromJson } from '../services/sleepService';
import { findStrengthGymCandidates, isStrengthWearableImportShape, normalizeWearableWorkoutPayload, saveWearableWorkoutSessionFromJson } from '../services/strengthWearableService';
import { formatDatePtBr, localDateKeyFromInstant, normalizeDateKey, todayLocalKey } from '../utils/dates';
import { formatDurationClock } from '../utils/durations';

const CARDIO_EXAMPLE = `{"synthetic":true}`;

const SLEEP_EXAMPLE = `{"synthetic":true}`;

const FOOD_TEXT_EXAMPLE = `{"synthetic":true}`;

const FOOD_PHOTO_EXAMPLE = `{"synthetic":true}`;

const FOOD_SNACK_EXAMPLE = `{"synthetic":true}`;

const FOOD_OUT_EXAMPLE = `{"synthetic":true}`;

const STRENGTH_EXAMPLE = `{"synthetic":true}`;

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
  const [linkCandidates, setLinkCandidates] = useState([]);
  const previewDateWarning = preview ? buildImportDateWarning(resolvedKind, preview) : null;

  const config = getImportType(kind);
  const examples = config.examples ?? [{ id: 'default', label: 'Exemplo', value: config.example }];

  function resolveKind(raw) {
    if (kind !== 'auto') return kind;

    const type = String(raw?.type ?? raw?.activity_type ?? '').toLowerCase();

    if (type.includes('meal') || type.includes('food') || type.includes('nutrition') || raw?.food_name || raw?.alimento || raw?.items || raw?.foods || raw?.meals) return 'meal';
    if (type.includes('sleep') || raw?.sleep_start || raw?.sleep_end || raw?.sleep_score) return 'sleep';
    // Cardio precisa vencer strength: prints de esteira/corrida podem trazer training_effect.
    if (isCardioImportShape(raw)) return 'cardio';
    if (isStrengthWearableImportShape(raw)) return 'strength';

    throw new Error('Não consegui detectar o tipo do JSON. Escolha Comida, Sono, Cardio ou Força relógio manualmente.');
  }

  function normalizeByKind(targetKind, raw) {
    if (targetKind === 'meal') return normalizeMealImportPayload(raw);
    if (targetKind === 'sleep') return normalizeSleepImportPayload(raw);
    if (targetKind === 'strength') return normalizeWearableWorkoutPayload(raw);
    return normalizeCardioImportPayload(raw);
  }

  async function saveByKind(targetKind, raw, workoutSessionId = null) {
    if (targetKind === 'meal') return saveMealEntriesFromJson(userId, raw);
    if (targetKind === 'sleep') return saveSleepSessionFromJson(userId, raw);
    if (targetKind === 'strength') return saveWearableWorkoutSessionFromJson(userId, raw, { workoutSessionId });
    return saveCardioSessionFromJson(userId, raw, { workoutSessionId });
  }

  function parseJson() {
    try {
      return JSON.parse(jsonText);
    } catch {
      throw new Error('JSON inválido. Verifique vírgulas, aspas e chaves. Dica: cole exatamente o JSON puro retornado pelo leitor.');
    }
  }

  async function handlePreview() {
    try {
      const raw = parseJson();
      const targetKind = resolveKind(raw);
      const normalized = normalizeByKind(targetKind, raw);

      setResolvedKind(targetKind);
      setPreview(normalized);
      setLinkCandidates(await findLinkCandidates(targetKind, normalized));
      onError?.(`JSON validado como ${getImportType(targetKind).label}.`);
    } catch (err: any) {
      setPreview(null);
      setResolvedKind(null);
      setLinkCandidates([]);
      onError?.(err.message);
    }
  }

  async function handleImport() {
    try {
      setBusy(true);
      const raw = parseJson();
      const targetKind = resolveKind(raw);
      const normalized = normalizeByKind(targetKind, raw);
      const dateWarning = buildImportDateWarning(targetKind, normalized);

      const candidates = await findLinkCandidates(targetKind, normalized);
      if (candidates.length) {
        setResolvedKind(targetKind);
        setPreview(normalized);
        setLinkCandidates(candidates);
        onError?.('Encontrei uma sessão compatível. Escolha explicitamente vincular ou salvar separado.');
        return;
      }

      if (dateWarning && !window.confirm(`${dateWarning.title}\n\n${dateWarning.message}\n\nImportar mesmo assim?`)) {
        onError?.('Importação cancelada para evitar salvar na data errada.');
        return;
      }

      await saveByKind(targetKind, raw, null);

      setJsonText('');
      setPreview(null);
      setResolvedKind(null);
      setLinkCandidates([]);
      onError?.(`${getImportType(targetKind).label} importado com sucesso.`);
    } catch (err: any) {
      onError?.(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleImportChoice(workoutSessionId) {
    try {
      setBusy(true);
      const raw = parseJson();
      const targetKind = resolveKind(raw);
      const normalized = normalizeByKind(targetKind, raw);
      const dateWarning = buildImportDateWarning(targetKind, normalized);
      if (dateWarning && !window.confirm(`${dateWarning.title}\n\n${dateWarning.message}\n\nImportar mesmo assim?`)) return;
      await saveByKind(targetKind, raw, workoutSessionId);
      setJsonText('');
      setPreview(null);
      setResolvedKind(null);
      setLinkCandidates([]);
      onError?.(workoutSessionId ? 'JSON importado e vinculado à sessão escolhida.' : 'JSON importado como sessão separada.');
    } catch (err: any) {
      onError?.(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function findLinkCandidates(targetKind, normalized) {
    if (targetKind === 'cardio') return findCardioGymCandidates(userId, normalized.performed_at);
    if (targetKind === 'strength') return findStrengthGymCandidates(userId, normalized.performed_at);
    return [];
  }

  function applyExample(example = examples[0]) {
    setJsonText(example.value);
    setPreview(null);
    setResolvedKind(null);
    setLinkCandidates([]);
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
          <h2>Central JSON</h2>
          <p className="muted-text">Cole o JSON e confira os dados antes de importar.</p>
        </div>
      </div>

      <section className="simple-panel json-importer-v364">
        <div className="json-type-tabs-v364">
          {IMPORT_TYPES.map((item) => (
            <button key={item.id} type="button" aria-pressed={kind === item.id} className={kind === item.id ? 'active' : ''} onClick={() => {
              setKind(item.id);
              setPreview(null);
              setResolvedKind(null);
              setLinkCandidates([]);
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

        <details className="gym-secondary-details"><summary>Instruções e exemplos</summary>
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
        </details>

        <textarea
          className="json-import-box json-hub-textarea-v364"
          aria-label="JSON para importar"
          spellCheck={false}
          autoCapitalize="off"
          value={jsonText}
          onChange={(event) => {
            setJsonText(event.target.value);
            setPreview(null);
            setResolvedKind(null);
            setLinkCandidates([]);
          }}
          placeholder="Cole o JSON aqui"
        />

        <div className="form-actions">
          <button className="ghost-btn" type="button" onClick={handlePreview} disabled={!jsonText.trim()}>Conferir dados</button>
          {!linkCandidates.length && <button className="primary-btn" type="button" onClick={handleImport} disabled={!preview || busy}><Plus size={16} /> Importar</button>}
        </div>

        {preview && (
          <div className="json-preview-v364">
            <CheckCircle2 size={18} />
            <div>
              <strong>{buildPreviewTitle(resolvedKind, preview)}</strong>
              <span>{buildPreviewSubtitle(resolvedKind, preview)}</span>
              <small>Tipo detectado: {getImportType(resolvedKind).label}</small>
              {previewDateWarning && (
                <div className="json-date-warning-v409">
                  <strong>{previewDateWarning.title}</strong>
                  <span>{previewDateWarning.message}</span>
                </div>
              )}
              {resolvedKind === 'meal' && <MealPreviewItems items={preview.items ?? []} />}
              {linkCandidates.length > 0 && (
                <div className="json-link-choice-v42">
                  <strong>Possível sessão da Academia</strong>
                  <span>Confira a sessão sugerida pela data e pelo horário.</span>
                  {linkCandidates.slice(0, 3).map((candidate) => (
                    <div key={candidate.id} className="json-link-candidate-v42">
                      <span>{candidate.training_day?.title ?? candidate.notes ?? 'Sessão da Academia'} · {new Date(candidate.performed_at).toLocaleDateString('pt-BR')}</span>
                      {resolvedKind === 'cardio' && <small>Planejado: {candidate.cardio_plan?.target_minutes ?? '--'} min · {candidate.cardio_plan?.intensity ?? 'intensidade não informada'}</small>}
                      <button className="primary-btn" type="button" disabled={busy} onClick={() => handleImportChoice(candidate.id)}>
                        Vincular à sessão
                      </button>
                    </div>
                  ))}
                  <button className="ghost-btn" type="button" disabled={busy} onClick={() => handleImportChoice(null)}>Salvar separado</button>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      <details className="disclosure-panel json-rules-v364">
        <summary>Onde encontrar os dados importados</summary>
        <div>
          <span><strong>Comida</strong> aparece em Registrar &gt; Comida e entra nas kcal do dia.</span>
          <span><strong>Sono</strong> aparece em Progresso &gt; Sono e influencia prontidão/semana.</span>
          <span><strong>Cardio</strong> aparece em Registrar &gt; Cardio e no histórico de cardio.</span>
          <span><strong>Força relógio</strong> aparece na Academia como dado fisiológico do treino.</span>
        </div>
      </details>
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
          <span>{item.grams == null ? 'Peso não informado' : `${item.grams}g`} · {item.kcal ?? '--'} kcal · P {formatMacro(item.protein_g)} · C {formatMacro(item.carbs_g)} · G {formatMacro(item.fat_g)}</span>
        </div>
      ))}
    </div>
  );
}

function buildImportDateWarning(kind, preview) {
  const importDate = getImportDate(kind, preview);
  const today = todayLocalKey();

  if (!importDate || !today || importDate === today) return null;

  const importLabel = formatDate(importDate);
  const todayLabel = formatDate(today);

  return {
    title: `Atenção: JSON está em ${importLabel}`,
    message: `Hoje é ${todayLabel}, mas o JSON será salvo em ${importLabel}. Se você fez agora, corrija o campo "date" do JSON antes de importar.`,
  };
}

function getImportDate(kind, preview) {
  if (!preview) return null;
  if (kind === 'meal') return normalizeDateKey(preview.log_date);
  if (kind === 'sleep') return normalizeDateKey(preview.sleep_date);
  if (kind === 'strength' || kind === 'cardio') return localDateKeyFromInstant(preview.performed_at);
  return null;
}

function getImportType(kind) {
  return IMPORT_TYPES.find((item) => item.id === kind) ?? IMPORT_TYPES[0];
}

function buildPreviewTitle(kind, preview) {
  if (kind === 'meal') return `${preview.items?.length ?? 0} item(ns) · ${preview.total_kcal ?? 0} kcal`;
  if (kind === 'sleep') return `${minutesToHours(preview.duration_minutes)} · ${formatDate(preview.sleep_date)}`;
  if (kind === 'strength') return `${preview.activity_label ?? 'Força'} · ${formatDuration(preview.duration_seconds)}`;
  const distance = preview.distance_km === null || preview.distance_km === undefined ? 'sem distância' : `${Number(preview.distance_km).toFixed(2)} km`;
  return `${preview.activity_label ?? 'Cardio'} · ${distance}`;
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
  return formatDurationClock(total);
}

function formatDate(dateKey) {
  return formatDatePtBr(dateKey);
}

function formatMacro(value) {
  return value === null || value === undefined ? 'não informado' : `${value}g`;
}
