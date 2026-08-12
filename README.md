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

## Assinaturas e controle de acesso

O plano **Clic Med Mensal** custa **R$ 67,00 por mês** e inclui **3 dias de teste gratuito**. O Checkout, a cobrança recorrente e o portal do cliente são hospedados pela Stripe. Depois de um pagamento ou alteração da assinatura, o webhook atualiza `stripe_subscriptions` no Supabase e o banco libera ou bloqueia o acesso automaticamente.

Estados que liberam o sistema: `trialing` e `active`, desde que o período atual ainda esteja válido. Cancelamentos, testes vencidos e pagamentos não regularizados bloqueiam os dados também pelas políticas de Row Level Security.

### Configuração da integração

As Edge Functions estão em `supabase/functions` e usam estes secrets do projeto Supabase:

- `STRIPE_SECRET_KEY`: chave secreta da Stripe para o modo correspondente.
- `STRIPE_PRICE_ID`: identificador do preço mensal de R$ 67,00.
- `STRIPE_WEBHOOK_SECRET`: segredo de assinatura do destino de eventos.
- `APP_URL`: URL pública do aplicativo.

O webhook deve apontar para `https://<project-ref>.supabase.co/functions/v1/stripe-webhook` e receber os eventos de Checkout, assinatura e fatura listados na função. Nunca coloque essas chaves no frontend, em `.env.local` ou no Git.

No momento, a integração está configurada no **modo de teste da Stripe**. Para cobrar cartões reais, conclua a ativação da conta e recrie produto, preço, chaves e webhook no modo de produção antes de substituir os secrets.

### Cortesias manuais

O proprietário `oliverziver@gmail.com` possui acesso permanente e visualiza a aba **Acessos**.

1. Informe o e-mail que a pessoa usará no cadastro.
2. Escolha a duração da liberação em dias. Para teste gratuito, use `3`.
3. Clique em **Liberar acesso**.
4. Para renovar, libere novamente o mesmo e-mail com o novo período.
5. Para encerrar antes do vencimento, clique em **Bloquear**.

Uma conta autenticada sem assinatura válida ou liberação manual ativa não consegue consultar pacientes ou sessões, pois a restrição também é aplicada nas políticas do banco.

## Relatórios

Na aba **Financeiro**, selecione **Dia** ou **Mês inteiro** e use **Baixar PDF**. O documento é gerado localmente no navegador e não envia os dados financeiros ou dos pacientes para serviços externos.
