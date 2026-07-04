import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Activity, ArrowLeft, BarChart3, Dumbbell, Home, LogOut, Menu, Salad, Settings, User, Waves, Watch, X } from 'lucide-react';
import { isSupabaseConfigured } from './lib/supabaseClient';
import { getSession, onAuthStateChange, signOut } from './services/authService';
import { ensureUserBootstrap } from './services/bootstrapService';
import LoginView from './components/LoginView';
import TodayView from './components/TodayView';
import GymModeView from './components/GymModeView';
import RegisterHubView from './components/RegisterHubView';
import ProgressHubView from './components/ProgressHubView';
import ProfileView from './components/ProfileView';
import IntegrationsView from './components/IntegrationsView';
import OnboardingView from './components/OnboardingView';
import OfflineBanner from './components/OfflineBanner';

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
  const [quickOpen, setQuickOpen] = useState(false);
  const tabHistoryRef = useRef([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
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
          <div className="loader" />
          <div>
            <p className="eyebrow">Atleta Híbrido</p>
            <h1>Carregando</h1>
            <span>Preparando seus dados do dia.</span>
          </div>
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
        {error && <div className={`alert ${classifyNotice(error)}`} onClick={() => setError('')} role="status" aria-live="polite">{error}</div>}
        <OnboardingView userId={userId} profile={boot.profile} onReady={setBoot} onError={setError} />
      </div>
    );
  }

  function navigateTo(tabId) {
    if (!NAV.some((item) => item.id === tabId)) return;

    if (tabId !== active) {
      tabHistoryRef.current = [...tabHistoryRef.current, active].slice(-12);
      setActive(tabId);
    }

    setQuickOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function goBack() {
    const previous = tabHistoryRef.current.pop();
    if (previous) {
      setActive(previous);
      setQuickOpen(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (active !== 'dashboard') {
      setActive('dashboard');
      setQuickOpen(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function goHome() {
    navigateTo('dashboard');
  }

  const Current = {
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
      <OfflineBanner />
      <header className="topbar topbar-v2">
        <div>
          <p className="eyebrow">Atleta Híbrido</p>
          <h1>{activeNavItem.label}</h1>
        </div>
        <div className="top-actions">
          <button className="ghost-btn" type="button" onClick={() => navigateTo('profile')}><Settings size={16} /> Perfil</button>
          <button className="ghost-btn danger" type="button" onClick={() => window.confirm('Sair da conta?') && signOut()}><LogOut size={16} /> Sair</button>
        </div>
      </header>

      {error && <div className={`alert ${classifyNotice(error)}`} onClick={() => setError('')} role="status" aria-live="polite">{error}</div>}

      <main className="main-grid main-grid-v2">
        <aside className="sidebar sidebar-v2">
          <div className="profile-mini">
            <div className="avatar"><Waves size={22} /></div>
            <div>
              <strong>{boot?.profile?.name ?? 'Atleta'}</strong>
              <span>{boot?.profile?.objective ?? 'Perfil personalizado'}</span>
            </div>
          </div>
          <nav>
            {NAV.map((item) => {
              const Icon = item.icon;
              return (
                <button key={item.id} type="button" className={active === item.id ? 'active' : ''} onClick={() => navigateTo(item.id)}>
                  <Icon size={18} /> {item.label}
                </button>
              );
            })}
          </nav>
        </aside>

        <section className="content-card content-card-v2">
          <Current {...pageProps} onError={setError} onNavigate={navigateTo} />
        </section>
      </main>

      <QuickAccessDock
        active={active}
        isOpen={quickOpen}
        onToggle={() => setQuickOpen((value) => !value)}
        onClose={() => setQuickOpen(false)}
        onNavigate={navigateTo}
        onBack={goBack}
        onHome={goHome}
      />
    </div>
  );
}


function QuickAccessDock({ active, isOpen, onToggle, onClose, onNavigate, onBack, onHome }) {
  const dock = (
    <div className={`quick-access-dock ${isOpen ? 'open' : ''}`}>
      <button
        className="quick-access-backdrop"
        type="button"
        aria-label="Fechar acesso rápido"
        onClick={onClose}
      />

      <nav className="quick-access-panel" aria-label="Acesso rápido">
        <div className="quick-access-head">
          <div>
            <p className="eyebrow">Navegação</p>
            <strong>Acesso rápido</strong>
          </div>
          <button className="quick-access-close" type="button" onClick={onClose} aria-label="Fechar menu">
            <X size={18} />
          </button>
        </div>

        <div className="quick-access-grid">
          {NAV.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                className={active === item.id ? 'active' : ''}
                onClick={() => onNavigate(item.id)}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <div className="quick-access-bar" role="group" aria-label="Controles rápidos">
        <button className="quick-side-btn" type="button" onClick={onBack} aria-label="Voltar para a aba anterior">
          <ArrowLeft size={20} />
        </button>

        <button
          className="quick-access-main"
          type="button"
          aria-label={isOpen ? 'Fechar acesso rápido' : 'Abrir acesso rápido'}
          aria-expanded={isOpen}
          onClick={onToggle}
        >
          {isOpen ? <X size={21} /> : <Menu size={21} />}
          <span>Acesso rápido</span>
        </button>

        <button className="quick-side-btn home" type="button" onClick={onHome} aria-label="Ir para a tela inicial">
          <Home size={20} />
        </button>
      </div>
    </div>
  );

  return createPortal(dock, document.body);
}


function classifyNotice(message) {
  const text = String(message ?? '').toLowerCase();

  if (
    text.includes('salv') ||
    text.includes('importad') ||
    text.includes('iniciad') ||
    text.includes('copiad') ||
    text.includes('atualizad') ||
    text.includes('conclu')
  ) {
    return 'success';
  }

  return 'error';
}

function SetupWarning() {
  return (
    <div className="center-screen setup-warning">
      <h1>Supabase ainda não configurado</h1>
      <p>Copie <code>.env.example</code> para <code>.env</code> e preencha:</p>
      <pre>{`VITE_SUPABASE_URL=https://seu-projeto.supabase.co\nVITE_SUPABASE_ANON_KEY=sua-chave-anon-publica`}</pre>
      <p>Depois execute o SQL em <code>database/schema.sql</code> e <code>database/policies.sql</code>.</p>
    </div>
  );
}
