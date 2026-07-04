import { useState } from 'react';
import { ClipboardCheck, Droplets, FileJson, Salad, Timer } from 'lucide-react';
import DietView from './DietView';
import CheckInView from './CheckInView';
import RunView from './RunView';
import WaterView from './WaterView';
import ImportJsonView from './ImportJsonView';

const TABS = [
  { id: 'water', label: 'Água', icon: Droplets },
  { id: 'diet', label: 'Comida', icon: Salad },
  { id: 'checkin', label: 'Check-in', icon: ClipboardCheck },
  { id: 'cardio', label: 'Cardio', icon: Timer },
  { id: 'json', label: 'JSON', icon: FileJson },
];

export default function RegisterHubView(props) {
  const [tab, setTab] = useState('water');

  return (
    <div className="simple-page">
      <div className="page-title compact-title">
        <div>
          <p className="eyebrow">Registrar</p>
          <h2>Entradas do dia</h2>
        </div>
      </div>

      <div className="simple-tabs">
        {TABS.map((item) => {
          const Icon = item.icon;
          return <button key={item.id} type="button" className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)}><Icon size={16} /> {item.label}</button>;
        })}
      </div>

      {tab === 'water' && <WaterView {...props} />}
      {tab === 'diet' && <DietView {...props} />}
      {tab === 'checkin' && <CheckInView {...props} />}
      {tab === 'cardio' && <RunView {...props} />}
      {tab === 'json' && <ImportJsonView {...props} />}
    </div>
  );
}
