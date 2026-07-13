import type { ComponentType, HTMLAttributes, ReactNode } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Database, Info, LoaderCircle, X } from 'lucide-react';

type IconType = ComponentType<{ size?: number; 'aria-hidden'?: boolean }>;

export function BrandLogo({ compact = false, className = '' }: { compact?: boolean; className?: string }) {
  return (
    <img
      className={`brand-logo ${compact ? 'brand-logo--compact' : ''} ${className}`.trim()}
      src={compact ? '/branding/atleta-hib-simbolo.png' : '/branding/atleta-hib-logo-horizontal.png'}
      alt="Atleta Hib"
    />
  );
}

export function Card({ children, className = '', tone = 'default', ...props }: HTMLAttributes<HTMLElement> & { tone?: 'default' | 'accent' | 'warning' | 'danger' }) {
  return <section className={`ds-card ds-card--${tone} ${className}`.trim()} {...props}>{children}</section>;
}

export function MetricCard({ label, value, detail, icon: Icon, className = '' }: { label: string; value: ReactNode; detail?: ReactNode; icon?: IconType; className?: string }) {
  return (
    <article className={`ds-metric-card ${className}`.trim()}>
      <div className="ds-metric-card__label">{Icon && <Icon size={17} aria-hidden />}<span>{label}</span></div>
      <strong>{value}</strong>
      {detail && <p>{detail}</p>}
    </article>
  );
}

const SOURCE_LABELS: Record<string, string> = {
  manual: 'Manual', json: 'JSON', screenshot_json: 'JSON de imagem', health_connect: 'Health Connect',
  wearable: 'Relógio', imported: 'Importado', estimated: 'Estimado', legacy: 'Migrado', app: 'Atleta Hib',
};

export function DataSourceBadge({ source, label, className = '' }: { source?: string | null; label?: string; className?: string }) {
  const normalized = String(source ?? 'unknown').toLowerCase();
  const tone = normalized.includes('health') || normalized.includes('wearable') || normalized.includes('watch')
    ? 'wearable'
    : normalized.includes('json') || normalized.includes('screenshot') || normalized.includes('import')
      ? 'imported'
      : normalized.includes('manual') || normalized.includes('app')
        ? 'manual'
        : normalized.includes('legacy') ? 'legacy' : 'neutral';
  return <span className={`ds-badge ds-source-badge ds-source-badge--${tone} ${className}`.trim()}><Database size={13} aria-hidden />{label ?? SOURCE_LABELS[normalized] ?? source ?? 'Origem desconhecida'}</span>;
}

export function DataQualityBadge({ score, label }: { score?: number | null; label?: string }) {
  const safeScore = Number.isFinite(Number(score)) ? Math.max(0, Math.min(100, Number(score))) : null;
  const tone = safeScore === null ? 'unknown' : safeScore >= 80 ? 'good' : safeScore >= 55 ? 'warning' : 'danger';
  return <span className={`ds-badge ds-quality-badge ds-quality-badge--${tone}`}>{safeScore === null ? '--' : `${safeScore}%`}<span>{label ?? 'qualidade'}</span></span>;
}

export function WarningBanner({ title, children, tone = 'warning', className = '' }: { title: string; children?: ReactNode; tone?: 'info' | 'success' | 'warning' | 'danger'; className?: string }) {
  const Icon = tone === 'success' ? CheckCircle2 : tone === 'info' ? Info : tone === 'danger' ? AlertCircle : AlertTriangle;
  return (
    <aside className={`ds-banner ds-banner--${tone} ${className}`.trim()} role={tone === 'danger' ? 'alert' : 'status'}>
      <Icon size={19} aria-hidden />
      <div><strong>{title}</strong>{children && <div className="ds-banner__body">{children}</div>}</div>
    </aside>
  );
}

export function EmptyState({ title, description, action, icon: Icon = Info, className = '' }: { title: string; description?: string; action?: ReactNode; icon?: IconType; className?: string }) {
  return <div className={`ds-state ds-empty-state ${className}`.trim()}><Icon size={23} aria-hidden /><strong>{title}</strong>{description && <p>{description}</p>}{action}</div>;
}

export function LoadingState({ title = 'Carregando', description = 'Preparando seus dados.' }: { title?: string; description?: string }) {
  return <div className="ds-state ds-loading-state" role="status"><LoaderCircle className="ds-spin" size={28} aria-hidden /><strong>{title}</strong><p>{description}</p></div>;
}

export function ErrorState({ title = 'Não foi possível carregar', description, action }: { title?: string; description?: string; action?: ReactNode }) {
  return <div className="ds-state ds-error-state" role="alert"><AlertCircle size={25} aria-hidden /><strong>{title}</strong>{description && <p>{description}</p>}{action}</div>;
}

export function ConfirmDialog({ open, title, description, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', danger = false, busy = false, onConfirm, onCancel }: { open: boolean; title: string; description?: ReactNode; confirmLabel?: string; cancelLabel?: string; danger?: boolean; busy?: boolean; onConfirm: () => void; onCancel: () => void }) {
  if (!open) return null;
  return (
    <div className="ds-dialog-layer" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}>
      <div className="ds-dialog" role="alertdialog" aria-modal="true" aria-labelledby="ds-dialog-title">
        <button className="ds-dialog__close" type="button" onClick={onCancel} aria-label="Fechar"><X size={18} /></button>
        <p className="eyebrow">Confirmação</p>
        <h2 id="ds-dialog-title">{title}</h2>
        {description && <div className="ds-dialog__description">{description}</div>}
        <div className="ds-dialog__actions">
          <button className="ghost-btn" type="button" onClick={onCancel} disabled={busy}>{cancelLabel}</button>
          <button className={danger ? 'danger-btn' : 'primary-btn'} type="button" onClick={onConfirm} disabled={busy}>{busy ? 'Processando...' : confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

export function SectionHeader({ eyebrow, title, description, action, className = '' }: { eyebrow?: string; title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string }) {
  return <div className={`ds-section-header ${className}`.trim()}><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h3>{title}</h3>{description && <p>{description}</p>}</div>{action && <div className="ds-section-header__action">{action}</div>}</div>;
}

export function PageHeader({ eyebrow, title, description, action, className = '' }: { eyebrow?: string; title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string }) {
  return <header className={`ds-page-header ${className}`.trim()}><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h2>{title}</h2>{description && <p>{description}</p>}</div>{action && <div className="ds-page-header__action">{action}</div>}</header>;
}

export function FormField({ label, hint, error, children, className = '' }: { label: string; hint?: ReactNode; error?: ReactNode; children: ReactNode; className?: string }) {
  return <label className={`ds-form-field ${className}`.trim()}><span className="ds-form-field__label">{label}</span>{children}{hint && <small>{hint}</small>}{error && <small className="ds-form-field__error">{error}</small>}</label>;
}

export function StatRow({ label, value, detail, icon: Icon }: { label: ReactNode; value: ReactNode; detail?: ReactNode; icon?: IconType }) {
  return <div className="ds-stat-row"><div>{Icon && <Icon size={17} aria-hidden />}<span>{label}</span>{detail && <small>{detail}</small>}</div><strong>{value}</strong></div>;
}

export function TimelineItem({ marker, title, description, detail }: { marker: ReactNode; title: ReactNode; description?: ReactNode; detail?: ReactNode }) {
  return <article className="ds-timeline-item"><span>{marker}</span><div><strong>{title}</strong>{description && <p>{description}</p>}{detail && <small>{detail}</small>}</div></article>;
}
