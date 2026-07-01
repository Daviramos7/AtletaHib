import { useEffect, useMemo, useState } from 'react';
import { Activity, BarChart3, ClipboardCheck, Dumbbell, LineChart, LogOut, Salad, Settings, SlidersHorizontal, Timer, TrendingUp, User, Waves, Watch } from 'lucide-react';
import { isSupabaseConfigured } from './lib/supabaseClient';
import { getSession, onAuthStateChange, signOut } from './services/authService';
import { ensureUserBootstrap } from './services/bootstrapService';
import LoginView from './components/LoginView';
import Dashboard from './components/Dashboard';
import DietView from './components/DietView';
import TrainingView from './components/TrainingView';
import StrengthView from './components/StrengthView';
import RunView from './components/RunView';
import ProgressView from './components/ProgressView';
import ProfileView from './components/ProfileView';
import CheckInView from './components/CheckInView';
import WeeklyReviewView from './components/WeeklyReviewView';
import PlanBuilderView from './components/PlanBuilderView';
import IntegrationsView from './components/IntegrationsView';
import OnboardingView from './components/OnboardingView';
import OfflineBanner from './components/OfflineBanner';

const NAV = [
  { id: 'dashboard', label: 'Início', icon: Activity },
  { id: 'diet', label: 'Dieta', icon: Salad },
  { id: 'training', label: 'Treino', icon: Dumbbell },
  { id: 'run', label: '1 km', icon: Timer },
  { id: 'strength', label: 'Força', icon: TrendingUp },
  { id: 'checkin', label: 'Check-in', icon: ClipboardCheck },
  { id: 'progress', label: 'Progresso', icon: LineChart },
  { id: 'review', label: 'Semana', icon: BarChart3 },
  { id: 'integrations', label: 'Integrações', icon: Watch },
  { id: 'builder', label: 'Criador', icon: SlidersHorizontal },
  { id: 'profile', label: 'Perfil', icon: User },
];

export default function App() {
  const [session, setSession] = useState(null);
  const [boot, setBoot] = useState(null);
  const [active, setActive] = useState('dashboard');
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
    return <div className="center-screen"><div className="loader" /><p>Carregando Atleta Híbrido Cloud...</p></div>;
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

  const Current = {
    dashboard: Dashboard,
    diet: DietView,
    training: TrainingView,
    run: RunView,
    strength: StrengthView,
    checkin: CheckInView,
    progress: ProgressView,
    review: WeeklyReviewView,
    integrations: IntegrationsView,
    builder: PlanBuilderView,
    profile: ProfileView,
  }[active];

  return (
    <div className="app-shell">
      <OfflineBanner />
      <header className="topbar">
        <div>
          <p className="eyebrow">Atleta Híbrido</p>
          <h1>Cloud OS</h1>
        </div>
        <div className="top-actions">
          <button className="ghost-btn" onClick={() => setActive('profile')}><Settings size={16} /> Perfil</button>
          <button className="ghost-btn danger" onClick={signOut}><LogOut size={16} /> Sair</button>
        </div>
      </header>

      {error && <div className="alert error" onClick={() => setError('')}>{error}</div>}

      <main className="main-grid">
        <aside className="sidebar">
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
                <button key={item.id} className={active === item.id ? 'active' : ''} onClick={() => setActive(item.id)}>
                  <Icon size={18} /> {item.label}
                </button>
              );
            })}
          </nav>
        </aside>

        <section className="content-card">
          <Current {...pageProps} onError={setError} />
        </section>
      </main>
    </div>
  );
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
