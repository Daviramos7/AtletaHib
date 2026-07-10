import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { listMeals } from '../services/mealService';
import { listCardioSessions } from '../services/cardioService';
import { listSleepSessions } from '../services/sleepService';
import { getCheckin } from '../services/checkinService';
import { buildDataQualityWarnings, getLocalDateKey, summarizeQualityWarnings } from '../utils/dataQualityRules';

export default function DataQualityCard({ userId, todayPlan, dailyTruth, dailyTruthLoading = false, onNavigate }: any) {
  const [state, setState] = useState<any>({ loading: true, meals: [], cardios: [], sleeps: [], checkin: null });

  useEffect(() => {
    let alive = true;

    async function load() {
      if (!userId) return;
      if (dailyTruthLoading) return;
      if (dailyTruth) {
        setState({ loading: false, meals: dailyTruth.meals, cardios: dailyTruth.cardio, sleeps: dailyTruth.sleep, checkin: dailyTruth.checkin });
        return;
      }

      const todayKey = getLocalDateKey();

      const [meals, cardios, sleeps, checkin] = await Promise.all([
        safeLoad(() => listMeals(userId, todayKey), []),
        safeLoad(() => listCardioSessions(userId, 30), []),
        safeLoad(() => listSleepSessions(userId, 14), []),
        safeLoad(() => getCheckin(userId, todayKey), null),
      ]);

      if (!alive) return;
      setState({ loading: false, meals, cardios, sleeps, checkin });
    }

    load();

    return () => { alive = false; };
  }, [dailyTruth, dailyTruthLoading, userId]);

  const todayKey = useMemo(() => getLocalDateKey(), []);
  const warnings = useMemo(() => dailyTruth?.warnings ?? buildDataQualityWarnings({
    todayKey,
    meals: state.meals,
    cardios: state.cardios,
    sleeps: state.sleeps,
    checkin: state.checkin,
    todayPlan,
  }), [dailyTruth, state, todayKey, todayPlan]);

  const summary = summarizeQualityWarnings(warnings);
  const visibleWarnings = warnings.slice(0, 4);

  return (
    <section className={`simple-panel data-quality-card-v40 ${summary.tone}`}>
      <div className="simple-section-head">
        <div>
          <p className="eyebrow">Qualidade dos dados</p>
          <h3>{state.loading ? 'Verificando...' : summary.label}</h3>
        </div>
        <span className="quality-score-v40">{dailyTruth?.data_quality_score ?? summary.score}%</span>
      </div>

      {!state.loading && warnings.length === 0 && (
        <div className="quality-ok-v40">
          <CheckCircle2 size={18} />
          <span>Sem inconsistências óbvias para hoje.</span>
        </div>
      )}

      {!state.loading && visibleWarnings.length > 0 && (
        <div className="quality-list-v40">
          {visibleWarnings.map((warning, index) => (
            <article className={`quality-warning-v40 ${warning.level}`} key={`${warning.title}-${index}`}>
              {warning.level === 'info' ? <Info size={16} /> : <AlertTriangle size={16} />}
              <div>
                <strong>{warning.title}</strong>
                <p>{warning.message}</p>
              </div>
            </article>
          ))}
        </div>
      )}

      {!state.loading && warnings.length > 4 && (
        <p className="muted-text">Mais {warnings.length - 4} aviso(s) ocultos. Priorize os de atenção alta/média.</p>
      )}

      <div className="quality-actions-v40">
        <button type="button" className="ghost-btn" onClick={() => onNavigate?.('register')}>Corrigir registros</button>
        <button type="button" className="ghost-btn" onClick={() => onNavigate?.('gym')}>Abrir Academia</button>
      </div>
    </section>
  );
}

async function safeLoad(fn, fallback) {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}
