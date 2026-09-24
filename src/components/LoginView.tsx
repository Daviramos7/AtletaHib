import { useState } from 'react';
import { signIn, signUp } from '../services/authService';
import { BrandLogo, FormField } from './ui';
import { noticeText } from '../utils/notices';

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
        onError('Conta criada. Confira seu e-mail para confirmar o cadastro antes de entrar.');
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
        <h1>Seu treino e sua rotina, no mesmo lugar.</h1>
        <p>Registre alimentação, acompanhe a recuperação e mantenha seu histórico de treinos.</p>
      </section>

      <form className="login-card" onSubmit={handleSubmit}>
        <h2>{isLogin ? 'Entrar' : 'Criar conta'}</h2>
        {error && <div className="alert error" role="alert">{noticeText(error)}</div>}
        <FormField label="E-mail">
          <input type="email" name="email" autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" required />
        </FormField>
        <FormField label="Senha" hint={isLogin ? undefined : 'No mínimo 6 caracteres.'}>
          <input type="password" name="password" autoComplete={isLogin ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required />
        </FormField>
        <button className="primary-btn" disabled={busy}>{busy ? 'Processando...' : isLogin ? 'Entrar' : 'Criar conta'}</button>
        <button type="button" className="link-btn" disabled={busy} onClick={() => { setMode(isLogin ? 'signup' : 'login'); onError(''); }}>
          {isLogin ? 'Criar uma conta' : 'Já tenho conta'}
        </button>
      </form>
    </div>
  );
}
