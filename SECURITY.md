# Segurança

## Credenciais

- Use somente a URL e a chave pública/anon no frontend e no Android Bridge.
- Variáveis `VITE_*` ficam visíveis no bundle. Nunca inclua `service_role`, chaves secretas, senhas ou tokens de sessão.
- Mantenha `.env.local`, propriedades locais do Android e credenciais fora do Git. Os arquivos de exemplo devem conter apenas placeholders.
- Ao identificar um segredo exposto, revogue/rotacione a credencial. Apagar o arquivo não remove a exposição do histórico.

## Banco e autenticação

- Preserve RLS e políticas de proprietário baseadas em `auth.uid() = user_id`.
- Filtros no cliente são conveniência, não fronteira de segurança.
- Preserve as validações de propriedade dos vínculos entre força, cardio e wearable.
- Antes de publicar um novo banco, teste com duas contas que leitura, escrita e associação a dados de outro usuário sejam recusadas.
- Revise confirmação de e-mail, URLs de redirecionamento e permissões do Supabase Auth no ambiente de produção.
- Revise o histórico aplicado antes de executar SQL; não reproduza automaticamente todas as migrations históricas sobre o schema consolidado.

## Dados pessoais

O companion Android cifra a sessão com AES-GCM/Android Keystore, não salva a senha, bloqueia tráfego HTTP e exclui dados privados de backup/transferência. A versão release bloqueia screenshots da janela. O APK debug é destinado a testes e não equivale a uma distribuição release endurecida.

Logout Web e Android usa o escopo global oficial do Supabase Auth. A revogação impede novos refreshes; access tokens já emitidos podem permanecer válidos até expirar. Sem confirmação do backend, a interface não afirma revogação global. Refresh inválido ou segundo 401 no Android encerra a sessão sem loop. [Semântica oficial](https://supabase.com/docs/guides/auth/signout).

Registros de saúde e treino são privados. Use dados sintéticos em screenshots, testes públicos e demonstrações. Não publique exports JSON, notas, IDs, e-mails ou sessões autenticadas reais.

O smoke test local intercepta o Supabase e utiliza uma sessão sintética. Ele valida a interface, não substitui testes de RLS no banco remoto. A revisão de arquivos locais também não constitui auditoria do histórico completo do Git ou da infraestrutura hospedada.

## Relatar vulnerabilidades

Não abra uma issue pública contendo credenciais ou dados pessoais. Contate o responsável pelo repositório por um canal privado, descrevendo o impacto e a reprodução com dados de teste.
