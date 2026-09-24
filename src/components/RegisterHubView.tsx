import { useEffect, useState } from 'react';
import { ClipboardCheck, Droplets, FileJson, Salad, Timer } from 'lucide-react';
import DietView from './DietView';
import CheckInView from './CheckInView';
import RunView from './RunView';
import WaterView from './WaterView';
import ImportJsonView from './ImportJsonView';
import { PageHeader } from './ui';

const TABS = [
  { id: 'water', label: 'Água', icon: Droplets },
  { id: 'diet', label: 'Comida', icon: Salad },
  { id: 'checkin', label: 'Check-in', icon: ClipboardCheck },
  { id: 'cardio', label: 'Cardio', icon: Timer },
  { id: 'json', label: 'JSON', icon: FileJson },
];

export default function RegisterHubView(props) {
  const [tab, setTab] = useState(() => props.navigationIntent?.registerTab ?? 'water');
  useEffect(() => {
    const next = props.navigationIntent?.registerTab;
    if (TABS.some((item) => item.id === next)) setTab(next);
  }, [props.navigationIntent]);

  return (
    <div className="simple-page">
      <PageHeader title="Registrar" />

      <div className="simple-tabs" aria-label="Tipo de registro">
        {TABS.map((item) => {
          const Icon = item.icon;
          return <button key={item.id} type="button" aria-pressed={tab === item.id} className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)}><Icon size={16} aria-hidden="true" /> {item.label}</button>;
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
