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

## Controle de acesso

O proprietário `oliverziver@gmail.com` possui acesso permanente e visualiza a aba **Acessos**.

1. Informe o e-mail que a pessoa usará no cadastro.
2. Escolha a duração da liberação em dias. Para teste gratuito, use `3`.
3. Clique em **Liberar acesso**.
4. Para renovar, libere novamente o mesmo e-mail com o novo período.
5. Para encerrar antes do vencimento, clique em **Bloquear**.

Uma conta autenticada sem liberação ativa não consegue consultar pacientes ou sessões, pois a restrição também é aplicada nas políticas do banco.

## Relatórios

Na aba **Financeiro**, selecione **Dia** ou **Mês inteiro** e use **Baixar PDF**. O documento é gerado localmente no navegador e não envia os dados financeiros ou dos pacientes para serviços externos.
