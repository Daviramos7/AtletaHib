import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { requireSupabase } from '../lib/supabaseClient';
import { BrandLogo, FormField } from './ui';

export default function ResetPasswordView({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (password.length < 6) { setFailed(true); return setMessage('Use uma senha com pelo menos 6 caracteres.'); }
    if (password !== confirmation) { setFailed(true); return setMessage('As senhas precisam ser iguais.'); }
    setBusy(true); setMessage(''); setFailed(false);
    try {
      const { error } = await requireSupabase().auth.updateUser({ password });
      if (error) throw error;
      setMessage('Senha atualizada com segurança.');
      window.setTimeout(onDone, 1200);
    } catch (err) { setFailed(true); setMessage(err.message); } finally { setBusy(false); }
  }

  return <div className="login-page"><section className="login-hero"><BrandLogo className="login-brand" /><h1>Crie sua nova senha.</h1><p>Escolha uma senha segura para voltar ao seu treino.</p></section><form className="login-card" onSubmit={submit}><h2>Redefinir senha</h2>{message && <div className={`alert ${failed ? 'error' : ''}`} role={failed ? 'alert' : 'status'} aria-live={failed ? 'assertive' : 'polite'}>{message}</div>}<FormField label="Nova senha" hint="No mínimo 6 caracteres."><div className="password-field"><input type={showPassword ? 'text' : 'password'} name="new-password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={6} required /><button type="button" className="password-toggle" aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}</button></div></FormField><FormField label="Confirmar nova senha"><input type={showPassword ? 'text' : 'password'} name="confirm-password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} minLength={6} required /></FormField><button className="primary-btn" disabled={busy}>{busy ? 'Atualizando…' : 'Atualizar senha'}</button><button className="link-btn" type="button" onClick={onDone}>Voltar ao Atleta Hib</button></form></div>;
}
