import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, Dumbbell } from 'lucide-react';
import { buildTodayPlan } from '../utils/trainingPlanUtils';
import ReadinessCard from './ReadinessCard';
import { WaterQuickCard } from './WaterView';
import DailyStatusCard from './DailyStatusCard';
import DataQualityCard from './DataQualityCard';
import { buildDailyTruth } from '../domain/buildDailyTruth';
import type { DailyTruth } from '../domain/dailyTypes';
import { todayKey } from '../services/dailyService';
import { ErrorState, LoadingState, PageHeader } from './ui';

export default function TodayView({ userId, trainingPlan, profile, onNavigate, onError }: any) {
  const [dailyTruth, setDailyTruth] = useState<DailyTruth | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [reload, setReload] = useState(0);
  const todayPlan = useMemo(() => buildTodayPlan(trainingPlan), [trainingPlan]);
  const refresh = useCallback(() => setReload((value) => value + 1), []);

  useEffect(() => {
    let alive = true;
    if (!userId) return undefined;
    setFailed(false);
    buildDailyTruth(userId, todayKey())
      .then((truth) => { if (alive) setDailyTruth(truth); })
      .catch(() => { if (alive) setFailed(true); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [userId, reload]);

  return (
    <div className="simple-page today-simple-page">
      <PageHeader eyebrow={new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })} title="Hoje" />
      {failed && <ErrorState title="Não foi possível atualizar seu dia" action={<button className="ghost-btn" type="button" onClick={refresh}>Tentar novamente</button>} />}
      {loading ? <LoadingState title="Carregando seu dia" /> : dailyTruth && <>
        <ReadinessCard userId={userId} todayPlan={todayPlan} dailyTruth={dailyTruth} onError={onError} onNavigate={onNavigate} compact />
        <div className="today-overview-grid">
          <DailyStatusCard dailyTruth={dailyTruth} onNavigate={onNavigate} />
          <WaterQuickCard userId={userId} profile={profile} onError={onError} onNavigate={onNavigate} />
        </div>
        <section className="today-gym-link">
          <Dumbbell size={22} aria-hidden />
          <div><h3>Treino da semana</h3><p>{dailyTruth.strengthApp.length ? 'Treino registrado hoje.' : 'Veja a sessão recomendada na Academia.'}</p></div>
          <button className="ghost-btn" type="button" onClick={() => onNavigate('gym')}>Ver treino <ArrowRight size={16} aria-hidden /></button>
        </section>
        <DataQualityCard dailyTruth={dailyTruth} onNavigate={onNavigate} />
      </>}
    </div>
  );
}
