# Clic Med

MVP de gestão para psicólogos e terapeutas autônomos. Inclui agenda, cadastro de pacientes, prontuário administrativo, controle financeiro e autenticação por usuário.

## Aplicação

[Acessar o Clic Med](https://clic-med.vercel.app)

## Desenvolvimento

1. Copie `.env.example` para `.env.local`.
2. Preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
3. Execute o SQL de `supabase/schema.sql` no projeto Supabase.
4. Rode `pnpm install` e `pnpm dev`.

## Segurança

As tabelas usam Row Level Security. Cada registro possui `user_id`, e as políticas permitem acesso apenas ao usuário autenticado proprietário do registro.
