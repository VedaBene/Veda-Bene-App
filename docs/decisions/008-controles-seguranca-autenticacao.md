# ADR 008 — Controles Complementares de Segurança de Autenticação

**Status**: Aceita
**Data**: 2026-06-11

## Contexto

O Veda Bene usa Supabase Auth como provedor de autenticação e `@supabase/ssr`
para manter a sessão em cookies. Antes desta decisão, duas lacunas relevantes
existiam na postura de segurança da aplicação:

1. **Sessões sem limite de inatividade**: uma estação deixada aberta poderia
   permanecer autenticada por tempo indeterminado enquanto os tokens fossem
   renovados pelo fluxo SSR.
2. **Tentativas de login sem bloqueio de conta/app**: a tela de login chamava
   `supabase.auth.signInWithPassword()` diretamente no navegador. Isso deixava
   o Supabase responsável pela validação da senha e por seus rate limits
   próprios, mas não havia uma regra de produto do tipo "4 falhas consecutivas
   bloqueiam novas tentativas por 24 horas".

Os rate limits nativos do Supabase continuam importantes, mas não substituem
um controle de aplicação por identidade de login, com regras específicas do
sistema.

## Decisão

Foram adicionados dois controles complementares, ambos aplicados fora da
camada puramente visual do frontend.

### 1. Timeout por inatividade

A aplicação encerra a sessão após **45 minutos sem atividade do usuário**.

- A última atividade é registrada por cookie/localStorage em
  `lib/session-timeout.ts`.
- `components/auth/SessionTimeoutProvider.tsx` monitora eventos reais do
  usuário dentro do shell autenticado.
- `utils/supabase/middleware.ts` valida o timestamp no servidor antes de
  continuar rotas protegidas.
- O proxy **não renova a atividade automaticamente**, para evitar que prefetch,
  refresh de token ou requisições em background mantenham a sessão ativa sem
  ação humana.
- Ao expirar, a sessão Supabase é encerrada com `signOut({ scope: 'local' })`
  e o usuário retorna para `/login?auth_error=session_expired`.

### 2. Bloqueio temporário após falhas de login

A tela de login deixou de chamar Supabase Auth diretamente no client. O fluxo
agora passa por `POST /api/auth/login`, uma rota server-side da própria
aplicação.

A regra aceita é:

- **4 falhas consecutivas** para o mesmo par `email normalizado + IP`;
- bloqueio por **24 horas**;
- resposta visual sempre genérica: `Email ou senha incorretos.`;
- sucesso no login limpa as falhas daquele par;
- sem `LOGIN_LOCKOUT_SECRET`, a rota falha de forma segura no servidor.

O estado do bloqueio fica em `public.auth_login_attempts`, criada pela migration
`supabase/migrations/20260611235534_auth_login_lockout.sql`.

Por privacidade e segurança operacional:

- email e IP não são gravados em claro;
- `email_key` e `ip_key` são HMACs gerados no servidor com
  `LOGIN_LOCKOUT_SECRET`;
- a tabela tem RLS habilitado e não possui policies para `anon` ou
  `authenticated`;
- o acesso é feito apenas server-side com service role encapsulado em módulo
  `server-only`.

## Fronteiras Arquiteturais

Esta decisão define uma fronteira clara para autenticação:

- **Frontend**: coleta credenciais, chama `/api/auth/login` e mostra mensagens
  genéricas.
- **Route Handler server-side**: valida origem, valida payload, consulta
  bloqueio, chama Supabase Auth e registra sucesso/falha.
- **Supabase Auth**: continua sendo a autoridade para validar senha e emitir
  sessão.
- **Banco de aplicação**: armazena apenas o estado mínimo de bloqueio, sem
  credenciais, sem email/IP crus e sem policies públicas.
- **Middleware/proxy**: valida sessão e timeout de inatividade nas rotas
  protegidas, mas não é responsável por decidir credenciais.

Essa separação evita que regras de segurança dependam apenas de JavaScript no
navegador, que pode ser ignorado por chamadas manuais ou scripts externos.

## Consequências

### Positivas

- Reduz risco de acesso indevido em estações abandonadas.
- Reduz tentativas repetidas de adivinhação de senha na aplicação.
- Evita enumeração de usuários por mensagem de erro.
- Mantém Supabase Auth como provedor central, sem reimplementar autenticação.
- Cria pontos explícitos e testáveis para políticas de segurança de login.
- Mantém dados sensíveis de bloqueio fora do alcance de clients públicos.

### Negativas / Tradeoffs

- O bloqueio por `email + IP` não impede ataques distribuídos por muitos IPs.
  Esse risco permanece parcialmente coberto pelos rate limits do Supabase e
  por controles de infraestrutura.
- Um usuário legítimo pode ficar bloqueado por 24 horas se errar várias vezes
  a senha a partir do mesmo IP.
- O controle depende de `LOGIN_LOCKOUT_SECRET`; ambientes sem esse segredo não
  conseguem autenticar via rota interna.
- A tabela `public.auth_login_attempts` precisa existir no banco de destino
  antes do login funcionar em produção.
- Em desenvolvimento por IP de rede, `next.config.ts` precisa permitir o host
  em `allowedDevOrigins` para evitar bloqueio de recursos dev do Next.

## Alternativas Consideradas

### Manter login direto no client

Descartada. A regra de bloqueio ficaria fora do controle da aplicação ou teria
de ser simulada no navegador, o que é frágil e contornável.

### Bloqueio apenas no frontend

Descartada. LocalStorage, estado React ou desabilitar botão melhoram UX, mas
não são controle de segurança. Um agente externo poderia chamar Supabase Auth
ou a rota diretamente.

### Bloqueio apenas por email

Descartada nesta versão. Embora seja mais rígido, permite negação de serviço
simples contra usuários conhecidos: basta saber o email para bloquear a conta.

### Mostrar prazo/horário de desbloqueio

Descartada nesta versão. A mensagem genérica reduz vazamento de informação e
mantém o comportamento indistinguível entre senha errada e bloqueio ativo.

### Usar somente rate limits do Supabase

Descartada como solução única. Os rate limits do provedor continuam úteis, mas
não expressam diretamente a regra de produto "4 falhas consecutivas bloqueiam
por 24 horas para este contexto de login".

## Referências

- [`lib/session-timeout.ts`](../../lib/session-timeout.ts)
- [`components/auth/SessionTimeoutProvider.tsx`](../../components/auth/SessionTimeoutProvider.tsx)
- [`utils/supabase/middleware.ts`](../../utils/supabase/middleware.ts)
- [`app/api/auth/login/route.ts`](../../app/api/auth/login/route.ts)
- [`lib/server/auth/login-lockout.ts`](../../lib/server/auth/login-lockout.ts)
- [`supabase/migrations/20260611235534_auth_login_lockout.sql`](../../supabase/migrations/20260611235534_auth_login_lockout.sql)
- [Supabase Auth rate limits](https://supabase.com/docs/guides/auth/rate-limits)
- [Supabase SSR com Next.js](https://supabase.com/docs/guides/auth/server-side/nextjs)
