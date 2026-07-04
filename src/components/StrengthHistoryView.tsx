import { useEffect, useMemo, useState } from 'react';
import { Dumbbell, Search, Trophy } from 'lucide-react';
import { calculateEstimatedOneRepMax, listStrengthSets } from '../services/workoutService';

const RANGE_OPTIONS = [
  { id: 30, label: '30 dias' },
  { id: 90, label: '90 dias' },
  { id: 180, label: '180 dias' },
  { id: 365, label: '1 ano' },
];

export default function StrengthHistoryView({ userId, onError }: any) {
  const [sets, setSets] = useState<any[]>([]);
  const [days, setDays] = useState(180);
  const [query, setQuery] = useState('');
  const [selectedExercise, setSelectedExercise] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      if (!userId) return;

      try {
        setLoading(true);
        setSets(await listStrengthSets(userId, days));
      } catch (err: any) {
        onError?.(err.message);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [days, onError, userId]);

  const exercises = useMemo(() => buildExerciseSummaries(sets), [sets]);

  const filteredExercises = useMemo(() => {
    const normalized = normalize(query);
    if (!normalized) return exercises;
    return exercises.filter((exercise: any) => normalize(exercise.name).includes(normalized));
  }, [exercises, query]);

  const activeExercise = useMemo(() => {
    if (selectedExercise) {
      return exercises.find((exercise: any) => exercise.name === selectedExercise) ?? filteredExercises[0] ?? null;
    }
    return filteredExercises[0] ?? null;
  }, [exercises, filteredExercises, selectedExercise]);

  const activeSets = useMemo(() => {
    if (!activeExercise) return [];
    return sets.filter((set: any) => set.exercise_name === activeExercise.name);
  }, [activeExercise, sets]);

  const sessions = useMemo(() => groupSetsBySession(activeSets), [activeSets]);
  const weekly = useMemo(() => buildWeeklyBuckets(activeSets), [activeSets]);
  const trend = buildTrend(weekly);

  return (
    <div className="strength-history-v38">
      <div className="page-title compact-title">
        <div>
          <p className="eyebrow">Força</p>
          <h2>Histórico por exercício</h2>
          <p className="muted-text">Veja carga, volume, melhor série e evolução sem abrir treino por treino.</p>
        </div>
      </div>

      <section className="simple-panel strength-history-toolbar-v38">
        <label>
          <Search size={16} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar exercício..." />
        </label>

        <div className="strength-range-v38">
          {RANGE_OPTIONS.map((option) => (
            <button key={option.id} type="button" className={days === option.id ? 'active' : ''} onClick={() => setDays(option.id)}>
              {option.label}
            </button>
          ))}
        </div>
      </section>

      <section className="strength-history-layout-v38">
        <aside className="simple-panel strength-exercise-list-v38">
          <div className="simple-section-head">
            <div>
              <p className="eyebrow">Exercícios</p>
              <h3>{loading ? 'Carregando...' : `${filteredExercises.length} encontrados`}</h3>
            </div>
          </div>

          {!filteredExercises.length ? (
            <div className="empty-state">
              <Dumbbell size={34} />
              <strong>Nenhum exercício salvo ainda</strong>
              <p>Finalize treinos na Academia para alimentar este histórico.</p>
            </div>
          ) : (
            <div className="exercise-pick-list-v38">
              {filteredExercises.map((exercise: any) => (
                <button
                  key={exercise.name}
                  type="button"
                  className={activeExercise?.name === exercise.name ? 'active' : ''}
                  onClick={() => setSelectedExercise(exercise.name)}
                >
                  <strong>{exercise.name}</strong>
                  <span>{exercise.sets} séries · {Math.round(exercise.volume)} kg</span>
                </button>
              ))}
            </div>
          )}
        </aside>

        <main className="strength-detail-v38">
          {!activeExercise ? (
            <section className="simple-panel">
              <h3>Sem exercício selecionado</h3>
              <p className="muted-text">Quando houver séries salvas, o histórico detalhado aparece aqui.</p>
            </section>
          ) : (
            <>
              <section className="simple-panel strength-main-card-v38">
                <div className="simple-section-head">
                  <div>
                    <p className="eyebrow">Exercício selecionado</p>
                    <h3>{activeExercise.name}</h3>
                    <span>{trend.label}</span>
                  </div>
                  <Trophy size={34} />
                </div>

                <div className="strength-metric-grid-v38">
                  <Metric label="Melhor carga" value={`${formatKg(activeExercise.bestLoad)} kg`} />
                  <Metric label="Melhor estimado" value={`${formatKg(activeExercise.bestOneRm)} kg`} sub="1RM estimado" />
                  <Metric label="Volume total" value={`${Math.round(activeExercise.volume)} kg`} />
                  <Metric label="Última vez" value={formatDate(activeExercise.lastDate)} />
                </div>
              </section>

              <section className="simple-panel">
                <div className="simple-section-head">
                  <div>
                    <p className="eyebrow">Evolução semanal</p>
                    <h3>{weekly.length ? `${weekly.length} semana(s)` : 'sem semanas'}</h3>
                  </div>
                </div>

                {weekly.length === 0 ? (
                  <p className="muted-text">Sem dados suficientes para evolução semanal.</p>
                ) : (
                  <div className="weekly-bars-v38">
                    {weekly.map((week: any) => (
                      <div key={week.weekKey} className="weekly-row-v38">
                        <span>{week.label}</span>
                        <div>
                          <i style={{ width: `${week.percent}%` }} />
                        </div>
                        <strong>{Math.round(week.volume)} kg</strong>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="simple-panel">
                <div className="simple-section-head">
                  <div>
                    <p className="eyebrow">Sessões recentes</p>
                    <h3>{sessions.length} sessão(ões)</h3>
                  </div>
                </div>

                <div className="strength-session-list-v38">
                  {sessions.slice(0, 12).map((session: any) => (
                    <article key={session.key} className="strength-session-card-v38">
                      <div>
                        <strong>{formatDateTime(session.performedAt)}</strong>
                        <span>{session.sets.length} séries · volume {Math.round(session.volume)} kg · melhor {formatKg(session.bestLoad)} kg</span>
                      </div>
                      <div className="session-set-pills-v38">
                        {session.sets.map((set: any) => (
                          <span key={set.id ?? `${set.set_number}-${set.reps}-${set.load_kg}`}>
                            {set.set_number}ª · {formatKg(set.load_kg)}kg x {set.reps}
                          </span>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </>
          )}
        </main>
      </section>
    </div>
  );
}

function Metric({ label, value, sub = null }: any) {
  return (
    <div className="strength-metric-v38">
      <span>{label}</span>
      <strong>{value}</strong>
      {sub && <small>{sub}</small>}
    </div>
  );
}

function buildExerciseSummaries(sets: any[]) {
  const map = new Map();

  sets.forEach((set: any) => {
    const name = String(set.exercise_name ?? 'Exercício').trim();
    const volume = Number(set.load_kg || 0) * Number(set.reps || 0);
    const oneRm = calculateEstimatedOneRepMax(set.load_kg, set.reps);
    const current = map.get(name) ?? {
      name,
      sets: 0,
      volume: 0,
      bestLoad: 0,
      bestOneRm: 0,
      lastDate: null,
    };

    current.sets += 1;
    current.volume += volume;
    current.bestLoad = Math.max(current.bestLoad, Number(set.load_kg || 0));
    current.bestOneRm = Math.max(current.bestOneRm, oneRm);

    const date = new Date(set.performed_at);
    if (!current.lastDate || date > new Date(current.lastDate)) current.lastDate = set.performed_at;

    map.set(name, current);
  });

  return [...map.values()].sort((a: any, b: any) => {
    const dateDiff = new Date(b.lastDate).getTime() - new Date(a.lastDate).getTime();
    if (dateDiff !== 0) return dateDiff;
    return b.volume - a.volume;
  });
}

function groupSetsBySession(sets: any[]) {
  const map = new Map();

  sets.forEach((set: any) => {
    const key = set.workout_session_id ?? dateKey(set.performed_at);
    const current = map.get(key) ?? {
      key,
      performedAt: set.performed_at,
      sets: [],
      volume: 0,
      bestLoad: 0,
    };

    current.sets.push(set);
    current.volume += Number(set.load_kg || 0) * Number(set.reps || 0);
    current.bestLoad = Math.max(current.bestLoad, Number(set.load_kg || 0));

    if (new Date(set.performed_at) < new Date(current.performedAt)) {
      current.performedAt = set.performed_at;
    }

    map.set(key, current);
  });

  return [...map.values()]
    .map((session: any) => ({
      ...session,
      sets: session.sets.sort((a: any, b: any) => Number(a.set_number || 0) - Number(b.set_number || 0)),
    }))
    .sort((a: any, b: any) => new Date(b.performedAt).getTime() - new Date(a.performedAt).getTime());
}

function buildWeeklyBuckets(sets: any[]) {
  const map = new Map();

  sets.forEach((set: any) => {
    const start = startOfWeek(new Date(set.performed_at));
    const key = dateKey(start);
    const current = map.get(key) ?? {
      weekKey: key,
      label: `${String(start.getDate()).padStart(2, '0')}/${String(start.getMonth() + 1).padStart(2, '0')}`,
      volume: 0,
      sets: 0,
    };

    current.volume += Number(set.load_kg || 0) * Number(set.reps || 0);
    current.sets += 1;
    map.set(key, current);
  });

  const rows = [...map.values()].sort((a: any, b: any) => a.weekKey.localeCompare(b.weekKey)).slice(-10);
  const maxVolume = Math.max(...rows.map((row: any) => Number(row.volume || 0)), 1);

  return rows.map((row: any) => ({
    ...row,
    percent: Math.max(4, Math.round((Number(row.volume || 0) / maxVolume) * 100)),
  }));
}

function buildTrend(weekly: any[]) {
  if (weekly.length < 2) return { label: 'Tendência aparece com pelo menos 2 semanas.' };

  const previous = Number(weekly[weekly.length - 2]?.volume ?? 0);
  const current = Number(weekly[weekly.length - 1]?.volume ?? 0);

  if (!previous && current) return { label: 'Primeira semana com volume registrado.' };

  const diff = current - previous;
  const percent = previous ? Math.round((diff / previous) * 100) : 0;

  if (percent > 10) return { label: `Volume subindo: +${percent}% vs semana anterior.` };
  if (percent < -10) return { label: `Volume caiu ${Math.abs(percent)}% vs semana anterior.` };
  return { label: 'Volume estável vs semana anterior.' };
}

function startOfWeek(date: Date) {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function normalize(value: any) {
  return String(value ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function dateKey(value: any) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatDate(value: any) {
  if (!value) return '--';
  return new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function formatDateTime(value: any) {
  if (!value) return '--';
  return new Date(value).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function formatKg(value: any) {
  const number = Number(value || 0);
  return Number.isInteger(number) ? String(number) : number.toFixed(1);
}
