# Segurança

- Não coloque service role key no front-end.
- Use apenas a anon key pública no Vite.
- Execute `database/policies.sql` e as migrations para ativar RLS.
- Cada tabela possui `user_id` e políticas `auth.uid() = user_id`.
- Se publicar em produção, configure confirmação de e-mail no Supabase Auth.
- Para logs de erro reais, plugue Sentry/LogRocket no `ErrorBoundary.tsx`.
