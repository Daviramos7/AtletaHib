import { useState } from 'react';
import { BarChart3, Dumbbell, LineChart, Moon } from 'lucide-react';
import ProgressView from './ProgressView';
import SleepView from './SleepView';
import WeeklyReviewView from './WeeklyReviewView';
import StrengthHistoryView from './StrengthHistoryView';

const TABS = [
  { id: 'progress', label: 'Peso', icon: LineChart },
  { id: 'sleep', label: 'Sono', icon: Moon },
  { id: 'strength', label: 'Força', icon: Dumbbell },
  { id: 'week', label: 'Semana', icon: BarChart3 },
];

export default function ProgressHubView(props) {
  const [tab, setTab] = useState('progress');

  return (
    <div className="simple-page">
      <div className="page-title compact-title">
        <div>
          <p className="eyebrow">Progresso</p>
          <h2>Evolução e análise</h2>
        </div>
      </div>

      <div className="simple-tabs">
        {TABS.map((item) => {
          const Icon = item.icon;
          return <button key={item.id} type="button" className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)}><Icon size={16} /> {item.label}</button>;
        })}
      </div>

      {tab === 'progress' && <ProgressView {...props} />}
      {tab === 'sleep' && <SleepView {...props} />}
      {tab === 'strength' && <StrengthHistoryView {...props} />}
      {tab === 'week' && <WeeklyReviewView {...props} />}
    </div>
  );
}
