import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { markOnboardingComplete } from '../services/bootstrapService';
import { saveWeightLog } from '../services/weightService';
import { todayKey } from '../services/dailyService';
import { DIET_STYLE_OPTIONS, GOAL_OPTIONS, HEALTH_PLATFORM_OPTIONS, LEVEL_OPTIONS, PROFILE_FORM_DEFAULTS, SYNC_MODE_OPTIONS, WEARABLE_OPTIONS } from '../data/defaultPlan';
import '../styles/onboarding.css';

type StepId = 'profile' | 'goal' | 'training' | 'routine' | 'fuel' | 'health' | 'review';
type SelectField = 'main_goal' | 'training_level' | 'diet_style' | 'wearable_provider' | 'preferred_sync_mode' | 'health_platform';
type OptionMap = Record<string, string>;
type FormErrors = Record<string, string>;
type ControlElement = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

interface ProfileForm {
  name: string;
  height_cm: string | number;
  starting_weight_kg: string | number;
  current_weight_kg: string | number;
  target_weight_kg: string | number;
  kcal_goal: string | number;
  water_goal_ml: string | number;
  dietary_restriction: string;
  lunch_time: string;
  training_time: string;
  routine_notes: string;
  objective?: string;
  onboarding_completed?: boolean;
  training_level: string;
  main_goal: string;
  weekly_strength_days: number;
  weekly_cardio_days: number;
  plays_football: boolean;
  diet_style: string;
  wearable_provider: string;
  preferred_sync_mode: string;
  health_platform: string;
}

interface Draft { version?: number; step?: number; form: Partial<ProfileForm>; }
interface OnboardingProps { userId?: string; profile?: Partial<ProfileForm> | null; onReady: (boot: unknown) => void; onError: (message: string) => void; }
type Step = readonly [StepId, string, string, string, readonly (keyof ProfileForm)[]];

const steps: readonly Step[] = [
  ['profile', 'Você', 'Vamos começar pelo seu ponto de partida', 'Só o necessário para calibrar seu plano com segurança.', ['name', 'height_cm', 'current_weight_kg', 'target_weight_kg']],
  ['goal', 'Direção', 'Qual resultado você quer construir?', 'Seu objetivo e sua experiência definem o ponto de partida do treino.', ['main_goal', 'training_level']],
  ['training', 'Treino', 'Como sua semana consegue se mover?', 'Monte uma frequência que caiba na rotina real.', ['weekly_strength_days', 'weekly_cardio_days']],
  ['routine', 'Rotina', 'Em que ritmo seu dia acontece?', 'Os horários ajudam a transformar intenção em um plano praticável.', []],
  ['fuel', 'Recuperação', 'Como vamos sustentar esse esforço?', 'Metas simples de energia, hidratação e alimentação.', ['kcal_goal', 'water_goal_ml']],
  ['health', 'Conexão', 'Você quer conectar alguma fonte de saúde?', 'Isso é opcional e pode ser ajustado depois.', []],
  ['review', 'Revisão', 'Revise sua base antes de criar o plano', 'Você poderá corrigir qualquer resposta sem perder o que já informou.', []],
];
const draftKey = (userId?: string) => userId ? `atletahib:onboarding:v1:${userId}` : null;
const err = (key: keyof ProfileForm, value: unknown): string => {
  const n = Number(value);
  if (key === 'name' && !String(value ?? '').trim()) return 'Informe como prefere ser chamado.';
  if (key === 'height_cm' && (!Number.isFinite(n) || n < 120 || n > 230)) return 'Informe uma altura entre 120 e 230 cm.';
  if (['current_weight_kg', 'target_weight_kg'].includes(key) && (!Number.isFinite(n) || n < 30 || n > 300)) return 'Informe um peso entre 30 e 300 kg.';
  if (key === 'kcal_goal' && (!Number.isFinite(n) || n < 1200 || n > 6000)) return 'Escolha uma meta entre 1200 e 6000 kcal.';
  if (key === 'water_goal_ml' && (!Number.isFinite(n) || n < 1000 || n > 7000)) return 'Escolha uma meta entre 1000 e 7000 ml.';
  return '';
};
function readDraft(userId?: string): Draft | null { const key = draftKey(userId); if (!key) return null; try { const saved: unknown = JSON.parse(window.localStorage.getItem(key) || 'null'); return saved && typeof saved === 'object' && 'form' in saved && saved.form && typeof saved.form === 'object' ? saved as Draft : null; } catch { return null; } }
function Art({ id }: { id: StepId }) { const p = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }; const all: Record<StepId, ReactElement> = { profile: <><circle cx="45" cy="35" r="13" {...p}/><path d="M18 78c4-18 16-27 27-27s23 9 27 27M86 27v35M76 37h20" {...p}/></>, goal: <><path d="M20 73 41 52l15 14 29-34M69 32h16v16M20 82h70" {...p}/></>, training: <><path d="M19 63h13l8-19 13 38 12-27 7 8h17M24 29h52M34 20v18M66 20v18" {...p}/></>, routine: <><circle cx="50" cy="50" r="31" {...p}/><path d="M50 31v20l14 9M20 82h60" {...p}/></>, fuel: <><path d="M32 22h36l-4 58H36l-4-58ZM39 22v-6h22v6M43 42h14M43 56h14M78 35c7 8 7 18 0 25-7-7-7-17 0-25Z" {...p}/></>, health: <><rect x="32" y="18" width="36" height="64" rx="7" {...p}/><path d="M42 42h16M42 52h16M46 68h8" {...p}/></>, review: <><path d="m25 51 15 15 31-35M20 82h60" {...p}/><circle cx="50" cy="50" r="34" {...p}/></> }; return <svg className="onboarding-art" viewBox="0 0 100 100" aria-hidden="true">{all[id]}</svg>; }
function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactElement<{ id?: string }> }) { const id = children.props.id; return <label className="onboarding-field" htmlFor={id}><span>{label}{hint && <small>{hint}</small>}</span>{children}{error && <em id={`${id}-error`} role="alert">{error}</em>}</label>; }

export default function OnboardingView({ userId, profile, onReady, onError }: OnboardingProps) {
  const saved = useMemo(() => readDraft(userId), [userId]);
  const [form, setForm] = useState<ProfileForm>(() => { const value = { ...PROFILE_FORM_DEFAULTS, ...(profile ?? {}), ...(saved?.form ?? {}) } as ProfileForm; return { ...value, name: value.name ?? '', height_cm: value.height_cm ?? '', starting_weight_kg: value.starting_weight_kg ?? value.current_weight_kg ?? '', current_weight_kg: value.current_weight_kg ?? '', target_weight_kg: value.target_weight_kg ?? '' }; });
  const [step, setStep] = useState(() => Math.min(Math.max(Number(saved?.step) || 0, 0), steps.length - 1));
  const [errors, setErrors] = useState<FormErrors>({}); const [submitError, setSubmitError] = useState(''); const [busy, setBusy] = useState(false); const refs = useRef<Record<string, ControlElement | null>>({}); const summary = useRef<HTMLDivElement | null>(null);
  const [id,, title, description] = steps[step];
  const preview = useMemo(() => `${GOAL_OPTIONS[form.main_goal] ?? 'Saúde geral'}, ${(LEVEL_OPTIONS[form.training_level] ?? 'Iniciante').toLowerCase()}, ${form.weekly_strength_days}x força e ${form.weekly_cardio_days}x cardio por semana.`, [form]);
  useEffect(() => { const key = draftKey(userId); if (!key) return; try { window.localStorage.setItem(key, JSON.stringify({ version: 1, step, form })); } catch { /* local persistence is optional */ } }, [form, step, userId]);
  useEffect(() => { if (submitError) summary.current?.focus(); }, [submitError]);
  const update = <K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) => { setForm((old) => ({ ...old, [key]: value })); if (errors[key]) setErrors((old) => ({ ...old, [key]: '' })); if (submitError) setSubmitError(''); };
  const input = (key: string) => ({ id: key, name: key, autoComplete: 'off', ref: (node: ControlElement | null) => { refs.current[key] = node; }, 'aria-invalid': Boolean(errors[key]), 'aria-describedby': errors[key] ? `${key}-error` : undefined });
  const validate = (index: number): boolean => { const found: FormErrors = {}; steps[index][4].forEach((key) => { const message = err(key, form[key]); if (message) found[key] = message; }); setErrors(found); const first = Object.keys(found)[0]; if (first) { requestAnimationFrame(() => refs.current[first]?.focus()); return false; } return true; };
  const next = () => { if (!busy && validate(step)) setStep((value) => Math.min(value + 1, steps.length - 1)); };
  async function submit(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); if (busy) return; for (let index = 0; index < steps.length - 1; index += 1) if (!validate(index)) { setStep(index); return; } setBusy(true); setSubmitError(''); try { const currentWeight = Number(form.current_weight_kg || form.starting_weight_kg); const payload = { ...form, name: form.name.trim(), height_cm: Number(form.height_cm), starting_weight_kg: Number(form.starting_weight_kg || currentWeight), current_weight_kg: currentWeight, target_weight_kg: Number(form.target_weight_kg), kcal_goal: Number(form.kcal_goal), water_goal_ml: Number(form.water_goal_ml), weekly_strength_days: Number(form.weekly_strength_days), weekly_cardio_days: Number(form.weekly_cardio_days), plays_football: Boolean(form.plays_football), objective: buildObjective(form), routine_notes: buildRoutineNotes(form), onboarding_completed: true, preferred_sync_mode: form.preferred_sync_mode, health_platform: form.health_platform }; const boot = await markOnboardingComplete(userId, payload); await saveWeightLog(userId, { log_date: todayKey(), weight_kg: payload.current_weight_kg, notes: 'Peso inicial configurado no onboarding.' }); const key = draftKey(userId); if (key) try { window.localStorage.removeItem(key); } catch { /* no-op */ } onReady(boot); } catch (cause: unknown) { const message = cause instanceof Error ? cause.message : 'Não foi possível criar seu plano agora. Revise os dados e tente de novo.'; setSubmitError(message); onError(message); } finally { setBusy(false); } }
  const Select = ({ field, options }: { field: SelectField; options: OptionMap }) => <select {...input(field)} value={form[field]} onChange={(event) => update(field, event.target.value)}>{Object.entries(options).map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select>;
  return <main className="onboarding-page"><div className="onboarding-frame"><header className="onboarding-header"><p>AtletaHib</p><span>Configuração inicial · passo {step + 1} de {steps.length}</span></header><nav className="onboarding-rail" aria-label="Progresso da configuração">{steps.map((item, index) => <span key={item[0]} className={index === step ? 'is-current' : index < step ? 'is-done' : ''}><i aria-hidden="true" />{item[1]}</span>)}</nav><form className="onboarding-flow" onSubmit={submit} noValidate><section className="onboarding-intro"><Art id={id}/><div><p>Passo {step + 1} de {steps.length}</p><h1>{title}</h1><span>{description}</span></div></section>{submitError && <div className="onboarding-error" ref={summary} tabIndex={-1} role="alert" aria-live="polite">{submitError}</div>}<div className="onboarding-fields">
    {id === 'profile' && <><Field label="Como podemos chamar você?" error={errors.name}><input {...input('name')} autoComplete="name" value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="Seu nome" /></Field><div className="onboarding-split"><Field label="Sua altura" error={errors.height_cm}><input {...input('height_cm')} type="number" inputMode="decimal" min="120" max="230" step="0.1" value={form.height_cm} onChange={(e) => update('height_cm', e.target.value)} /></Field><Field label="Peso atual" error={errors.current_weight_kg}><input {...input('current_weight_kg')} type="number" inputMode="decimal" min="30" max="300" step="0.1" value={form.current_weight_kg} onChange={(e) => update('current_weight_kg', e.target.value)} /></Field></div><Field label="Meta de peso" error={errors.target_weight_kg}><input {...input('target_weight_kg')} type="number" inputMode="decimal" min="30" max="300" step="0.1" value={form.target_weight_kg} onChange={(e) => update('target_weight_kg', e.target.value)} /></Field></>}
    {id === 'goal' && <><Field label="Objetivo principal"><Select field="main_goal" options={GOAL_OPTIONS}/></Field><Field label="Experiência de treino"><Select field="training_level" options={LEVEL_OPTIONS}/></Field></>}
    {id === 'training' && <><Field label="Dias de musculação por semana"><select {...input('weekly_strength_days')} value={form.weekly_strength_days} onChange={(e) => update('weekly_strength_days', Number(e.target.value))}>{[2,3,4,5].map((v) => <option key={v} value={v}>{v} dias</option>)}</select></Field><Field label="Dias de cardio por semana"><select {...input('weekly_cardio_days')} value={form.weekly_cardio_days} onChange={(e) => update('weekly_cardio_days', Number(e.target.value))}>{[1,2,3,4].map((v) => <option key={v} value={v}>{v} dias</option>)}</select></Field><label className="onboarding-check"><input {...input('plays_football')} type="checkbox" checked={Boolean(form.plays_football)} onChange={(e) => update('plays_football', e.target.checked)} />Jogo futebol ou quero foco em arrancada e agilidade.</label></>}
    {id === 'routine' && <><div className="onboarding-split"><Field label="Horário do almoço"><input {...input('lunch_time')} type="time" value={String(form.lunch_time ?? '12:30').slice(0,5)} onChange={(e) => update('lunch_time', e.target.value)} /></Field><Field label="Horário preferido de treino"><input {...input('training_time')} type="time" value={String(form.training_time ?? '18:00').slice(0,5)} onChange={(e) => update('training_time', e.target.value)} /></Field></div><Field label="O que sua semana pede?" hint="Dias difíceis, trabalho, faculdade ou observações"><textarea {...input('routine_notes')} value={form.routine_notes ?? ''} onChange={(e) => update('routine_notes', e.target.value)} placeholder="Ex.: não treino às quartas; saio tarde do trabalho." /></Field></>}
    {id === 'fuel' && <><div className="onboarding-split"><Field label="Meta diária de energia" error={errors.kcal_goal}><input {...input('kcal_goal')} type="number" inputMode="numeric" min="1200" max="6000" value={form.kcal_goal} onChange={(e) => update('kcal_goal', e.target.value)} /></Field><Field label="Meta diária de água" error={errors.water_goal_ml}><input {...input('water_goal_ml')} type="number" inputMode="numeric" min="1000" max="7000" value={form.water_goal_ml} onChange={(e) => update('water_goal_ml', e.target.value)} /></Field></div><Field label="Estilo de alimentação"><Select field="diet_style" options={DIET_STYLE_OPTIONS}/></Field><Field label="Há alguma restrição alimentar?"><textarea {...input('dietary_restriction')} value={form.dietary_restriction ?? ''} onChange={(e) => update('dietary_restriction', e.target.value)} /></Field></>}
    {id === 'health' && <><Field label="Relógio ou fonte de saúde"><Select field="wearable_provider" options={WEARABLE_OPTIONS}/></Field><Field label="Modo de sincronização desejado"><Select field="preferred_sync_mode" options={SYNC_MODE_OPTIONS}/></Field><Field label="Plataforma intermediária"><Select field="health_platform" options={HEALTH_PLATFORM_OPTIONS}/></Field></>}
    {id === 'review' && <div className="onboarding-review"><p>{preview}</p><p>Almoço às {String(form.lunch_time).slice(0,5)} · treino às {String(form.training_time).slice(0,5)} · {DIET_STYLE_OPTIONS[form.diet_style] ?? 'Flexível'}.</p>{steps.slice(0,-1).map((item, index) => <button key={item[0]} type="button" onClick={() => !busy && setStep(index)}>Corrigir {item[1].toLowerCase()}</button>)}</div>}
  </div><footer className="onboarding-actions">{step > 0 && <button type="button" onClick={() => !busy && setStep((value) => value - 1)} disabled={busy}>Voltar</button>}{step < steps.length - 1 ? <button key="onboarding-continue" type="button" className="primary" onClick={next} disabled={busy}>Continuar</button> : <button key="onboarding-submit" type="submit" className="primary" disabled={busy}>{busy ? 'Criando seu plano…' : 'Criar meu plano'}</button>}</footer></form></div></main>;
}
function buildObjective(form: ProfileForm): string { const goal = GOAL_OPTIONS[form.main_goal] ?? 'Saúde geral'; return `${goal} com rotina de ${form.weekly_strength_days} treinos de força e ${form.weekly_cardio_days} cardios por semana.`; }
function buildRoutineNotes(form: ProfileForm): string { const base = form.routine_notes?.trim(); const diet = DIET_STYLE_OPTIONS[form.diet_style] ?? 'Flexível'; const football = form.plays_football ? 'Inclui futebol/agilidade quando possível.' : 'Sem futebol obrigatório.'; return [base, `Almoço preferencial: ${String(form.lunch_time || '12:30').slice(0,5)}. Treino preferencial: ${String(form.training_time || '18:00').slice(0,5)}.`, `Dieta: ${diet}. ${football}`].filter(Boolean).join(' '); }
