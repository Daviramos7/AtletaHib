import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import type { ComponentType } from 'react';
import { Activity, BarChart3, Dumbbell, LogOut, Salad, Settings, User, Watch, X } from 'lucide-react';
import { isSupabaseConfigured } from './lib/supabaseClient';
import { getSession, onAuthStateChange, signOut } from './services/authService';
import { ensureUserBootstrap } from './services/bootstrapService';
import LoginView from './components/LoginView';
import TodayView from './components/TodayView';
import { classifyNotice, noticeText } from './utils/notices';
import OnboardingView from './components/OnboardingView';
import OfflineBanner from './components/OfflineBanner';
import { BrandLogo, ConfirmDialog, ErrorState, LoadingState } from './components/ui';

const GymModeView = lazy(() => import('./components/GymModeView'));
const RegisterHubView = lazy(() => import('./components/RegisterHubView'));
const ProgressHubView = lazy(() => import('./components/ProgressHubView'));
const ProfileView = lazy(() => import('./components/ProfileView'));
const IntegrationsView = lazy(() => import('./components/IntegrationsView'));

const NAV = [
  { id: 'dashboard', label: 'Hoje', icon: Activity },
  { id: 'register', label: 'Registrar', icon: Salad },
  { id: 'gym', label: 'Academia', icon: Dumbbell },
  { id: 'progressHub', label: 'Progresso', icon: BarChart3 },
  { id: 'integrations', label: 'Saúde', icon: Watch },
  { id: 'profile', label: 'Perfil', icon: User },
];


export default function App() {
  const [session, setSession] = useState(null);
  const [boot, setBoot] = useState(null);
  const [active, setActive] = useState('dashboard');
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [navigationIntent, setNavigationIntent] = useState(null);
  const userId = session?.user?.id;

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    let mounted = true;
    getSession()
      .then((currentSession) => {
        if (mounted) setSession(currentSession);
      })
      .catch((err) => setError(err.message))
      .finally(() => mounted && setLoading(false));

    const unsubscribe = onAuthStateChange((newSession) => setSession(newSession));
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!userId) {
      setBoot(null);
      return;
    }

    let mounted = true;
    setLoading(true);
    ensureUserBootstrap(userId)
      .then((data) => mounted && setBoot(data))
      .catch((err) => mounted && setError(err.message))
      .finally(() => mounted && setLoading(false));

    return () => {
      mounted = false;
    };
  }, [userId]);

  const pageProps = useMemo(() => ({
    userId,
    profile: boot?.profile,
    trainingPlan: boot?.trainingPlan,
    refreshBoot: async () => {
      if (!userId) return;
      setBoot(await ensureUserBootstrap(userId));
    },
  }), [userId, boot]);

  useEffect(() => {
    if (!error) return undefined;
    const timer = window.setTimeout(() => setError(''), classifyNotice(error) === 'error' ? 7000 : 3500);
    return () => window.clearTimeout(timer);
  }, [error]);

  if (!isSupabaseConfigured) {
    return <SetupWarning />;
  }

  if (loading) {
    return (
      <div className="center-screen">
        <div className="loading-card-v35">
          <BrandLogo className="loading-brand" />
          <LoadingState title="Carregando Atleta Hib" />
        </div>
      </div>
    );
  }

  if (!session) {
    return <LoginView onError={setError} error={error} />;
  }

  if (boot?.needsOnboarding) {
    return (
      <div className="app-shell">
        <OfflineBanner />
        {error && <Notice message={error} onClose={() => setError('')} />}
        <OnboardingView userId={userId} profile={boot.profile} onReady={setBoot} onError={setError} />
      </div>
    );
  }

  function navigateTo(tabId, intent = null) {
    if (!NAV.some((item) => item.id === tabId)) return;

    if (tabId !== active) {
      setActive(tabId);
    }

    setNavigationIntent(intent);

    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  const Current: ComponentType<any> = {
    dashboard: TodayView,
    register: RegisterHubView,
    gym: GymModeView,
    progressHub: ProgressHubView,
    integrations: IntegrationsView,
    profile: ProfileView,
  }[active] ?? TodayView;

  const activeNavItem = NAV.find((item) => item.id === active) ?? NAV[0];

  return (
    <div className="app-shell app-shell-v2">
      <a className="skip-link" href="#main-content">Ir para o conteúdo</a>
      <OfflineBanner />
      <header className="topbar topbar-v2">
        <div className="topbar-identity">
          <BrandLogo className="topbar-brand" />
          <div className="topbar-current">
            <h1>{activeNavItem.label}</h1>
          </div>
        </div>
        <div className="top-actions">
          <button aria-label="Abrir perfil" className="ghost-btn" type="button" onClick={() => navigateTo('profile')}><Settings size={16} /><span>Perfil</span></button>
          <button aria-label="Sair da conta" className="ghost-btn danger" type="button" onClick={() => setLogoutOpen(true)}><LogOut size={16} /><span>Sair</span></button>
        </div>
      </header>

      {error && <Notice message={error} onClose={() => setError('')} />}

      <main className="main-grid main-grid-v2">
        <aside className="sidebar sidebar-v2">
          <div className="profile-mini">
            <div className="avatar"><BrandLogo compact /></div>
            <div>
              <strong>{boot?.profile?.name ?? 'Atleta'}</strong>
              <span>{boot?.profile?.objective ?? 'Perfil personalizado'}</span>
            </div>
          </div>
          <nav aria-label="Navegação principal">
            {NAV.map((item) => {
              const Icon = item.icon;
              return (
                <button key={item.id} type="button" aria-current={active === item.id ? 'page' : undefined} className={active === item.id ? 'active' : ''} onClick={() => navigateTo(item.id)}>
                  <Icon size={18} /> {item.label}
                </button>
              );
            })}
          </nav>
        </aside>

        <section id="main-content" tabIndex={-1} aria-label={activeNavItem.label} className="content-card content-card-v2">
          <Suspense fallback={<LoadingState title="Carregando" />}>
          <Current
            {...pageProps}
            navigationIntent={navigationIntent}
            onError={setError}
            onNavigate={navigateTo}
            onCheckinSaved={(_data, mode) => {
              if (mode === 'morning' && navigationIntent?.returnTo === 'gym') navigateTo('gym');
            }}
          />
          </Suspense>
        </section>
      </main>

      <nav className="mobile-nav" aria-label="Navegação principal no celular">
        {NAV.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" aria-current={active === id ? 'page' : undefined} onClick={() => navigateTo(id)}>
            <Icon size={20} aria-hidden /><span>{label}</span>
          </button>
        ))}
      </nav>
      <ConfirmDialog
        open={logoutOpen}
        title="Sair da sua conta?"
        description="Sair em todos os dispositivos. Os dados permanecem salvos; outras sessões serão encerradas ao renovar o acesso."
        confirmLabel="Sair agora"
        danger
        onCancel={() => setLogoutOpen(false)}
        onConfirm={() => { setLogoutOpen(false); signOut().catch((err) => setError(err.message)); }}
      />
    </div>
  );
}


function Notice({ message, onClose }) {
  const tone = classifyNotice(message);
  return <div className={`app-notice ${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
    <span>{noticeText(message)}</span>
    <button type="button" onClick={onClose} aria-label="Fechar mensagem"><X size={18} /></button>
  </div>;
}

function SetupWarning() {
  return (
    <div className="center-screen setup-warning">
      <BrandLogo className="loading-brand" />
      <ErrorState
        title="Supabase ainda não configurado"
        description="Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env. Depois execute database/schema.sql e database/policies.sql."
      />
    </div>
  );
}
