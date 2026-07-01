import { useState } from 'react';
import { signIn, signUp } from '../services/authService';

export default function LoginView({ error, onError }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const isLogin = mode === 'login';

  async function handleSubmit(event) {
    event.preventDefault();
    onError('');
    setBusy(true);
    try {
      if (isLogin) {
        await signIn(email, password);
      } else {
        await signUp(email, password);
        onError('Cadastro criado. Se o Supabase exigir confirmação de e-mail, confirme antes de entrar.');
        setMode('login');
      }
    } catch (err) {
      onError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <section className="login-hero">
        <p className="eyebrow">Atleta Híbrido Cloud</p>
        <h1>Seu app de dieta, treino e corrida sincronizado por perfil.</h1>
        <p>Registre no celular. Abra no PC. Os dados seguem o login do usuário, não o navegador.</p>
        <div className="hero-stats">
          <span>perfil próprio</span>
          <span>metas personalizadas</span>
          <span>rotina editável</span>
          <span>dados isolados por usuário</span>
        </div>
      </section>

      <form className="login-card" onSubmit={handleSubmit}>
        <p className="eyebrow">{isLogin ? 'Entrar' : 'Criar conta'}</p>
        <h2>{isLogin ? 'Acessar perfil' : 'Novo usuário'}</h2>
        {error && <div className="alert error">{error}</div>}
        <label>
          E-mail
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" required />
        </label>
        <label>
          Senha
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} placeholder="mínimo 6 caracteres" required />
        </label>
        <button className="primary-btn" disabled={busy}>{busy ? 'Processando...' : isLogin ? 'Entrar' : 'Criar conta'}</button>
        <button type="button" className="link-btn" onClick={() => setMode(isLogin ? 'signup' : 'login')}>
          {isLogin ? 'Não tenho conta ainda' : 'Já tenho conta'}
        </button>
      </form>
    </div>
  );
}
