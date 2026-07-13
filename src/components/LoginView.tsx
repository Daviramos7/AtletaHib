import { useState } from 'react';
import { signIn, signUp } from '../services/authService';
import { BrandLogo, FormField } from './ui';

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
        <BrandLogo className="login-brand" />
        <p className="eyebrow">Sua rotina, uma fonte de verdade</p>
        <h1>Treino, alimentação e recuperação no mesmo ritmo.</h1>
        <p>Registre no celular e acompanhe no computador. Seus dados seguem sua conta, com origem e qualidade visíveis.</p>
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
        <FormField label="E-mail">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" required />
        </FormField>
        <FormField label="Senha" hint="Use no mínimo 6 caracteres.">
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} placeholder="mínimo 6 caracteres" required />
        </FormField>
        <button className="primary-btn" disabled={busy}>{busy ? 'Processando...' : isLogin ? 'Entrar' : 'Criar conta'}</button>
        <button type="button" className="link-btn" onClick={() => setMode(isLogin ? 'signup' : 'login')}>
          {isLogin ? 'Não tenho conta ainda' : 'Já tenho conta'}
        </button>
      </form>
    </div>
  );
}
