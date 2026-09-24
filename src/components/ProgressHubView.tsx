import { useEffect, useState } from 'react';
import { BarChart3, Dumbbell, HeartPulse, LineChart, Moon, Watch } from 'lucide-react';
import ProgressView from './ProgressView';
import SleepView from './SleepView';
import WeeklyReviewView from './WeeklyReviewView';
import StrengthHistoryView from './StrengthHistoryView';
import StrengthWearableHistoryView from './StrengthWearableHistoryView';
import CardioDataHistoryView from './CardioDataHistoryView';
import { PageHeader } from './ui';

const TABS = [
  { id: 'progress', label: 'Peso', icon: LineChart },
  { id: 'sleep', label: 'Sono', icon: Moon },
  { id: 'strength', label: 'Força', icon: Dumbbell },
  { id: 'strength-watch', label: 'Relógio', icon: Watch },
  { id: 'cardio-data', label: 'Cardio', icon: HeartPulse },
  { id: 'week', label: 'Semana', icon: BarChart3 },
];

export default function ProgressHubView(props) {
  const [tab, setTab] = useState(props.navigationIntent?.progressTab ?? 'progress');
  useEffect(() => {
    const next = props.navigationIntent?.progressTab;
    if (TABS.some((item) => item.id === next)) setTab(next);
  }, [props.navigationIntent]);

  return (
    <div className="simple-page progress-hub">
      <PageHeader title="Progresso" />

      <div className="simple-tabs">
        {TABS.map((item) => {
          const Icon = item.icon;
          return <button key={item.id} type="button" aria-pressed={tab === item.id} className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)}><Icon size={16} aria-hidden /> {item.label}</button>;
        })}
      </div>

      {tab === 'progress' && <ProgressView {...props} />}
      {tab === 'sleep' && <SleepView {...props} />}
      {tab === 'strength' && <StrengthHistoryView {...props} />}
      {tab === 'strength-watch' && <StrengthWearableHistoryView {...props} />}
      {tab === 'cardio-data' && <CardioDataHistoryView {...props} />}
      {tab === 'week' && <WeeklyReviewView {...props} />}
    </div>
  );
}
