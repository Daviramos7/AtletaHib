import { AlertTriangle, Info } from 'lucide-react';
import type { DailyTruth } from '../domain/dailyTypes';

export default function DataQualityCard({ dailyTruth, onNavigate }: { dailyTruth: DailyTruth; onNavigate: (tab: string) => void }) {
  const warnings = dailyTruth.warnings;
  if (!warnings.length) return null;
  return <details className="disclosure-panel quality-details">
    <summary><Info size={17} aria-hidden /> Sobre os dados de hoje <span>{warnings.length} {warnings.length === 1 ? 'aviso' : 'avisos'}</span></summary>
    <div className="quality-list-v40">
      {warnings.map((warning) => <article className={`quality-warning-v40 ${warning.level}`} key={warning.code}>
        {warning.level === 'info' ? <Info size={16} aria-hidden /> : <AlertTriangle size={16} aria-hidden />}
        <div><strong>{warning.title}</strong><p>{warning.message}</p></div>
      </article>)}
    </div>
    <button className="ghost-btn" type="button" onClick={() => onNavigate('register')}>Revisar registros</button>
  </details>;
}
