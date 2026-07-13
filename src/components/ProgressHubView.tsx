import { useState } from 'react';
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
  { id: 'strength-watch', label: 'Relógio força', icon: Watch },
  { id: 'cardio-data', label: 'Dados cardio', icon: HeartPulse },
  { id: 'week', label: 'Semana', icon: BarChart3 },
];

export default function ProgressHubView(props) {
  const [tab, setTab] = useState('progress');

  return (
    <div className="simple-page">
      <PageHeader eyebrow="Progresso" title="Evolução e análise" description="Compare tendências sem transformar ausência de dados em zero." />

      <div className="simple-tabs">
        {TABS.map((item) => {
          const Icon = item.icon;
          return <button key={item.id} type="button" className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)}><Icon size={16} /> {item.label}</button>;
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
