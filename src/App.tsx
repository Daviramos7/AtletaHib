import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Activity, ArrowLeft, BarChart3, ClipboardCheck, Dumbbell, Home, LineChart, LogOut, Menu, Moon, Salad, Settings, SlidersHorizontal, Timer, TrendingUp, User, Waves, Watch, X } from 'lucide-react';
import { isSupabaseConfigured } from './lib/supabaseClient';
import { getSession, onAuthStateChange, signOut } from './services/authService';
import { ensureUserBootstrap } from './services/bootstrapService';
import LoginView from './components/LoginView';
import Dashboard from './components/Dashboard';
import DietView from './components/DietView';
import TrainingView from './components/TrainingView';
import StrengthView from './components/StrengthView';
import RunView from './components/RunView';
import SleepView from './components/SleepView';
import ProgressView from './components/ProgressView';
import ProfileView from './components/ProfileView';
import CheckInView from './components/CheckInView';
import WeeklyReviewView from './components/WeeklyReviewView';
import PlanBuilderView from './components/PlanBuilderView';
import IntegrationsView from './components/IntegrationsView';
import OnboardingView from './components/OnboardingView';
import OfflineBanner from './components/OfflineBanner';

const NAV = [
  { id: 'dashboard', label: 'Hoje', icon: Activity },
  { id: 'diet', label: 'Dieta', icon: Salad },
  { id: 'training', label: 'Treino', icon: Dumbbell },
  { id: 'run', label: 'Cardio', icon: Timer },
  { id: 'sleep', label: 'Sono', icon: Moon },
  { id: 'strength', label: 'Força', icon: TrendingUp },
  { id: 'checkin', label: 'Check-in', icon: ClipboardCheck },
  { id: 'progress', label: 'Progresso', icon: LineChart },
  { id: 'review', label: 'Semana', icon: BarChart3 },
  { id: 'integrations', label: 'Saúde', icon: Watch },
  { id: 'builder', label: 'Criador', icon: SlidersHorizontal },
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
    refreshBoot: async () => setBoot(await ensureUserBootstrap(userId)),
  }), [userId, boot]);

  if (!isSupabaseConfigured) {
    return <SetupWarning />;
  }

  if (loading) {
    return <div className="center-screen"><div className="loader" /><p>Carregando Atleta Híbrido 2.0...</p></div>;
  }

  if (!session) {
    return <LoginView onError={setError} error={error} />;
  }

  if (boot?.needsOnboarding) {
    return (
      <div className="app-shell">
        <OfflineBanner />
        {error && <div className="alert error" onClick={() => setError('')}>{error}</div>}
        <OnboardingView userId={userId} profile={boot.profile} onReady={setBoot} onError={setError} />
      </div>
    );
  }

  function navigateTo(tabId) {
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
    dashboard: Dashboard,
    diet: DietView,
    training: TrainingView,
    run: RunView,
    sleep: SleepView,
    strength: StrengthView,
    checkin: CheckInView,
    progress: ProgressView,
    review: WeeklyReviewView,
    integrations: IntegrationsView,
    builder: PlanBuilderView,
    profile: ProfileView,
  }[active];

  return (
    <div className="app-shell app-shell-v2">
      <OfflineBanner />
      <header className="topbar topbar-v2">
        <div>
          <p className="eyebrow">Atleta Híbrido 2.0</p>
          <h1>Seu painel diário</h1>
        </div>
        <div className="top-actions">
          <button className="ghost-btn" type="button" onClick={() => navigateTo('profile')}><Settings size={16} /> Perfil</button>
          <button className="ghost-btn danger" type="button" onClick={signOut}><LogOut size={16} /> Sair</button>
        </div>
      </header>

      {error && <div className="alert error" onClick={() => setError('')}>{error}</div>}

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
          <Current {...pageProps} onError={setError} />
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
