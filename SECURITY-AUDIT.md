# Hydra Agro — Security Audit

Auditoria de segurança e hardening do Hydra Agro. Este documento descreve o estado observado e as proteções realmente implementadas em produção. Nenhum sistema conectado à internet pode ser considerado 100% impossível de comprometer; o objetivo é defesa em profundidade, menor privilégio, redução de superfície e resposta segura a abuso.

## Escopo auditado

- React/Vite e frontend web/PWA
- Vercel e `/api/hydra-assistant`
- Supabase Auth, Postgres, RLS, RPCs e Edge Functions
- Hydra Tag/NFC/QR
- Resend e fluxos de e-mail
- Web Push
- Storage/uploads
- Admin, comunidade e mensagens
- GitHub Actions/CI

## Vulnerabilidades encontradas e correções

### ALTO — cadastro podia reutilizar uma verificação de e-mail sem provar o token daquela confirmação

**Status: CORRIGIDO.**

O fluxo validava que havia um desafio `signup` verificado para o e-mail, mas a chamada final de criação não exigia o `verificationToken` gerado naquela verificação. O servidor agora exige uma prova criptográfica one-time vinculada ao e-mail. A prova fica somente em memória no cliente, é enviada apenas para `signup-no-confirmation`, é comparada por hash no servidor e é consumida após uso.

Arquivos principais:
- `src/services/supabase.ts`
- `src/services/auth-email-service.ts`
- `supabase/functions/signup-no-confirmation/index.ts`

### ALTO — login de funcionário sem rate limit compartilhado

**Status: CORRIGIDO.**

O endpoint já possuía código de alta entropia e atraso, mas não tinha limitação compartilhada entre instâncias. Agora utiliza Postgres como armazenamento central do rate limit:
- 12 tentativas/minuto por origem
- 80 tentativas/hora por origem
- 5 tentativas/10 minutos para o mesmo hash de código
- HTTP 429 + `Retry-After`
- atraso adicional nas falhas
- fail-closed se o serviço de rate limit estiver indisponível

### ALTO — endpoint do Hydra Assistente podia sofrer abuso de custo por conta autenticada

**Status: CORRIGIDO.**

`/api/hydra-assistant` agora exige sessão válida e possui rate limit compartilhado no Postgres:
- 20 solicitações/minuto por usuário
- 300 solicitações/dia por usuário
- 429 + `Retry-After`
- limite de tamanho de request
- métodos HTTP restritos
- `Cache-Control: no-store, private`
- erros de produção não retornam segredo, stack trace ou resposta bruta do provedor

### ALTO — funções `SECURITY DEFINER` internas estavam expostas como RPC

**Status: CORRIGIDO nas funções identificadas como internas/anônimas.**

Triggers e helpers internos tiveram `EXECUTE` removido de `anon`/`authenticated` quando não precisam ser chamados pela API. Funções sociais/ranking que só fazem sentido depois do login tiveram acesso anônimo removido.

A exceção intencional é `public_animal_by_hydra_code(text)`, necessária para que uma pessoa consiga ler uma Hydra Tag/NFC/QR sem possuir conta.

### ALTO — envio de e-mail de animal encontrado precisava ser vinculado ao caller

**Status: CORRIGIDO.**

`found-animal-email` agora exige JWT válido e verifica que o caller é o usuário registrado como `finder_user_id` da ocorrência antes de usar a service role e enviar dados de contato ao proprietário.

### MÉDIO — spam em comunidade, mensagens e Hydra Tag

**Status: CORRIGIDO.**

Rate limits de banco foram adicionados para chamadas que continuam válidas mesmo quando o frontend é ignorado:
- mensagens diretas: 30/minuto por usuário
- posts: 10/5 minutos
- comentários: 30/5 minutos
- follows: 60/minuto
- denúncias: 10/hora
- ocorrência `animal encontrado`: 5/10 minutos

A ocorrência da Hydra Tag também:
- exige autenticação
- só aceita animal marcado como perdido
- bloqueia o próprio proprietário
- reaproveita ocorrência recente do mesmo usuário/animal para evitar duplicação

### MÉDIO — headers HTTP de segurança ausentes

**Status: CORRIGIDO/PARCIAL para CSP.**

`vercel.json` adiciona:
- HSTS
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy`
- `Permissions-Policy`
- `Cross-Origin-Opener-Policy`
- bloqueio de cross-domain policy
- CSP
- `upgrade-insecure-requests`
- `no-store` em `/api/*`
- política especial para `sw.js`

A CSP ainda permite `unsafe-inline` para compatibilidade com estilos/JSON-LD atuais. Remover isso exige externalizar conteúdo inline sem quebrar o frontend.

## RLS e IDOR/BOLA

As tabelas centrais auditadas possuem RLS e políticas vinculadas a `auth.uid()`, propriedade, membership/manager ou role administrativa.

Foi executado um teste transacional simulando explicitamente uma conta `role=user`. O usuário comum enxergou somente o próprio perfil, propriedade, assinatura e role e não obteve registros pertencentes a outras contas. Também foi confirmado que `authenticated` não possui privilégio direto de UPDATE sobre `roles` ou `subscriptions`.

Tabelas/áreas revisadas incluem:
- profiles
- properties
- animals
- animal_identifications
- nfc_tags
- activities
- monitoring_records
- water_sources / water_records
- notifications
- direct_messages
- roles
- subscriptions
- property_members
- animal_found_reports
- web_push_subscriptions

## Admin

As RPCs administrativas auditadas são `SECURITY DEFINER`, mas fazem validação de role no banco antes da operação. Alteração de role, banimento, assinatura, moderação e notificações administrativas não dependem de `isAdmin` no React/localStorage. Ações administrativas importantes também alimentam logs/auditoria.

O linter do Supabase continuará sinalizando funções administrativas `SECURITY DEFINER` executáveis por `authenticated`; isso é esperado porque o frontend precisa alcançar a RPC, enquanto a autorização efetiva ocorre dentro da função. Essas funções devem continuar sendo revisadas sempre que forem alteradas.

## Uploads / Storage

Proteções encontradas e confirmadas no servidor:
- `avatars`: público, máximo 5 MB
- `community-media`: público, máximo 10 MB
- `farm-media`: privado, máximo 10 MB
- MIME permitido apenas `image/jpeg`, `image/png`, `image/webp`
- escrita vinculada à pasta do `auth.uid()` ou membership/manager correspondente
- leitura privada do `farm-media` controlada por policy e URLs assinadas
- nomes usados pelo app são gerados/controlados pelo Hydra, não reaproveitados diretamente do filename do usuário

## Secrets

A varredura do código atual não encontrou valores literais de `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY` ou `OPENAI_API_KEY` commitados. As referências encontradas usam variáveis de ambiente no servidor. A chave `VITE_SUPABASE_PUBLISHABLE_KEY` é pública por projeto e não deve ser confundida com service role.

Se qualquer service-role/API key tiver sido publicada em histórico antigo fora do escopo desta varredura, ela deve ser rotacionada. Valores de secrets nunca devem ser documentados aqui.

## Web Push

- subscriptions vinculadas a `auth.uid()` com RLS
- chave privada VAPID fica no servidor
- trigger interno não pode mais ser chamado como RPC externa
- função de envio exige token interno armazenado em configuração protegida
- subscriptions inválidas podem ser removidas

## Hydra Tag pública

A ficha pública é uma exceção de segurança deliberada: quem encontra um animal precisa conseguir abrir a tag sem autenticação.

**Risco restante:** os `hydra_code` legados observados possuem 9 caracteres. Eles não são IDs sequenciais simples, mas uma futura versão deve migrar para tokens públicos de alta entropia sem invalidar NFC/QR já gravados. Até essa migração, o endpoint público deve continuar retornando somente o conjunto mínimo de dados autorizado.

## CORS

CORS com allowlist foi aplicado em endpoints de alto privilégio revisados, incluindo cadastro, login de funcionário, troca de senha e animal encontrado.

**Pendente:** `auth-email` ainda precisa ser migrado de wildcard para a mesma allowlist sem quebrar web/Android. O endpoint já possui limites de envio/tentativas no servidor, portanto o wildcard não substitui autorização nem elimina os controles de abuso, mas deve ser removido numa próxima alteração compatível.

## Firewall / WAF

A aplicação está atrás da infraestrutura/edge da Vercel e possui hardening HTTP, mas **não foi possível ativar por esta integração uma regra customizada persistente do Vercel Firewall/WAF**.

Recomendação externa:
- manter proteções nativas da Vercel ativas
- usar Attack Mode durante incidentes volumétricos
- criar regras WAF/rate-limit para `/api/*` e padrões abusivos se o plano/console permitir
- não depender do WAF como única defesa; os limites de aplicação/banco implementados continuam necessários

## Autenticação

Proteções presentes:
- Supabase Auth em vez de autenticação própria
- PKCE
- senha, Google, OTP e funcionário preservados
- cadastro exige código e prova one-time
- recuperação/troca de senha exige código
- troca de senha autenticada liga o token ao e-mail da própria sessão
- desafios expiram e têm limite de tentativas
- mensagens de recuperação/cadastro evitam enumeração direta sempre que possível

**Configuração externa pendente:** o Advisor do Supabase informa que `Leaked Password Protection` está desativado. Deve ser ativado no Supabase Auth para rejeitar senhas conhecidas como comprometidas.

## Dependências / CI

Foi criado `.github/workflows/security-audit.yml` para executar em push/PR e semanalmente:
- `npm ci`
- TypeScript/typecheck
- testes
- build
- `npm audit --audit-level=high`

A auditoria de dependências não foi executada localmente nesta sessão porque o ambiente de execução não possui acesso de rede ao registry. O resultado do workflow do GitHub passa a ser a fonte de verdade desta etapa.

## Proteções — status

| PROTEÇÃO | STATUS | IMPLEMENTAÇÃO |
|---|---|---|
| Firewall/WAF | ⚠️ PARCIAL | Edge Vercel + app hardening; regras WAF customizadas dependem de configuração externa |
| Rate Limit | ✅ PROTEGIDO | Postgres compartilhado; assistente, staff, OTP e operações de abuso |
| Brute Force | ✅ PROTEGIDO | OTP, staff, desafios com expiração/tentativas e rate limit server-side; Supabase Auth para senha |
| SQL Injection | ✅ PROTEGIDO | Supabase SDK/RPC parametrizados; nenhuma concatenação SQL com input encontrada nos caminhos auditados |
| XSS | ⚠️ PARCIAL | React escaping + escaping em e-mails + CSP; CSP ainda contém `unsafe-inline` |
| CSRF | ✅ PROTEGIDO | Auth por Bearer/PKCE, sem sessão crítica baseada em cookie tradicional |
| CORS | ⚠️ PARCIAL | Allowlist em funções críticas; `auth-email` ainda precisa retirar wildcard |
| CSP | ⚠️ PARCIAL | Ativa, mas mantém `unsafe-inline` por compatibilidade atual |
| Security Headers | ✅ PROTEGIDO | HSTS, nosniff, frame deny, referrer e permissions policy |
| RLS | ✅ PROTEGIDO | Core auditado com policies por uid/owner/member/admin |
| IDOR/BOLA | ✅ PROTEGIDO | RLS testada com usuário comum; recursos principais isolados por conta |
| Admin | ✅ PROTEGIDO | Role validada no banco/RPC + audit log |
| Uploads | ✅ PROTEGIDO | MIME/size server-side, RLS de Storage, bucket privado quando necessário |
| Webhooks/Push | ✅ PROTEGIDO | Web Push usa segredo interno + tabela protegida; trigger RPC fechado |
| Secrets | ✅ PROTEGIDO | Nenhum valor secreto literal encontrado no código atual auditado |
| Logs | ⚠️ PARCIAL | Admin/activity logs existem; detecção centralizada de todos os eventos suspeitos ainda pode evoluir |
| HTTPS | ✅ PROTEGIDO | Vercel HTTPS + HSTS + upgrade-insecure-requests |
| Dependency Audit | ⚠️ PARCIAL | Workflow automático criado; resultado deve ser acompanhado no GitHub Actions |
| OWASP | ⚠️ PARCIAL | Principais classes auditadas; WAF/CSP/Auth externo e token público legado ainda têm trabalho restante |

## Arquivos/migrations principais adicionados ou alterados

- `vercel.json`
- `api/hydra-assistant.js`
- `src/services/supabase.ts`
- `src/services/auth-email-service.ts`
- `supabase/functions/signup-no-confirmation/index.ts`
- `supabase/functions/staff-code-login/index.ts`
- `supabase/functions/change-password-verified/index.ts`
- `supabase/functions/found-animal-email/index.ts`
- `.github/workflows/security-audit.yml`
- `supabase/migrations/202609010210_harden_internal_rpc_execute_permissions.sql`
- `supabase/migrations/202609010215_add_shared_api_rate_limit.sql`
- `supabase/migrations/202609010230_add_service_side_anonymous_rate_limit.sql`
- `supabase/migrations/202609010240_add_database_abuse_limits.sql`
- `supabase/migrations/202609010250_remove_anonymous_private_rpc_access.sql`
- `supabase/migrations/202609010255_harden_found_animal_reports.sql`
- `supabase/migrations/202609010258_close_demo_trigger_rpc_surface.sql`

## Próximos passos obrigatórios para elevar ainda mais o nível

1. Ativar `Leaked Password Protection` no Supabase Auth.
2. Migrar `auth-email` para CORS allowlist web + Capacitor mantendo todos os testes de OTP.
3. Remover `unsafe-inline` da CSP após externalizar estilos/JSON-LD inline.
4. Implantar tokens públicos de Hydra Tag com maior entropia e compatibilidade com tags legadas.
5. Configurar regras customizadas de Vercel Firewall/WAF conforme recursos disponíveis no plano.
6. Acompanhar e corrigir qualquer HIGH/CRITICAL reportado pelo workflow `Security Audit`.
7. Repetir testes RLS/IDOR sempre que novas tabelas/RPCs forem adicionadas.

## Conclusão

O Hydra Agro está significativamente mais resistente a abuso de API, brute force, spam, IDOR, vazamento por RLS, replay de cadastro, uso indevido de service role, upload perigoso e exploração por endpoints sem limite. A segurança deve continuar sendo tratada como processo contínuo, não como um estado permanente de “100% protegido”.
