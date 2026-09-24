import { ArrowRight, ClipboardCheck, Footprints, Moon, Salad } from 'lucide-react';
import type { DailyTruth } from '../domain/dailyTypes';

export default function DailyStatusCard({ dailyTruth, onNavigate }: { dailyTruth: DailyTruth; onNavigate: (tab: string, intent?: any) => void }) {
  const kcal = dailyTruth.nutrition.kcal.value;
  const sleep = dailyTruth.sleepTruth.value;
  const steps = dailyTruth.wearableTruth.steps?.value ?? dailyTruth.checkinEvening?.steps ?? null;
  const morning = dailyTruth.checkinMorning;
  const items = [
    { id: 'food', icon: Salad, label: 'Alimentação', value: kcal === null ? 'Sem registro' : `${Math.round(kcal).toLocaleString('pt-BR')} kcal`, detail: dailyTruth.nutrition.kcal.state === 'estimated' ? 'Inclui estimativas' : dailyTruth.meals.length ? `${dailyTruth.meals.length} ${dailyTruth.meals.length === 1 ? 'registro' : 'registros'}` : 'Registrar refeição', target: 'register', intent: { registerTab: 'diet' } },
    { id: 'sleep', icon: Moon, label: 'Sono', value: sleep === null ? 'Sem registro' : `${Math.floor(sleep / 60)}h ${Math.round(sleep % 60)}min`, detail: sleep === null ? 'Importar sono' : 'Ver histórico', target: sleep === null ? 'register' : 'progressHub', intent: sleep === null ? { registerTab: 'json' } : { progressTab: 'sleep' } },
    { id: 'steps', icon: Footprints, label: 'Passos', value: steps === null ? 'Sem registro' : Number(steps).toLocaleString('pt-BR'), detail: 'Ver dados de saúde', target: 'integrations', intent: null },
    { id: 'checkin', icon: ClipboardCheck, label: 'Check-in', value: morning ? 'Manhã registrada' : 'Pendente', detail: morning ? 'Revisar respostas' : 'Como você está?', target: 'register', intent: { registerTab: 'checkin' } },
  ];

  return <section className="simple-panel daily-summary">
    <h3>Registros do dia</h3>
    <div className="daily-summary-grid">
      {items.map(({ id, icon: Icon, label, value, detail, target, intent }) => <button key={id} type="button" onClick={() => onNavigate(target, intent)}>
        <Icon size={18} aria-hidden /><span><span className="metric-label">{label}</span><strong>{value}</strong><small>{detail}</small></span><ArrowRight size={15} aria-hidden />
      </button>)}
    </div>
  </section>;
}
