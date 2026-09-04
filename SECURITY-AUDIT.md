# Hydra Agro — Security Audit

Auditoria e hardening do Hydra Agro com foco em OWASP, abuso de API, autenticação, autorização, RLS, serverless, uploads, Web Push e produção. Nenhum sistema conectado à internet pode ser considerado 100% impossível de comprometer; o objetivo deste trabalho é defesa em profundidade, menor privilégio e redução real de superfície de ataque.

## Estado geral

As falhas críticas/altas encontradas durante esta rodada foram corrigidas sem redesenhar o app nem remover senha, Google, código por e-mail, funcionário, Hydra Tag/NFC, Android, Resend ou Web Push.

O Advisor final do Supabase não aponta mais RPC privada `SECURITY DEFINER` disponível anonimamente. A única RPC anônima restante é `public_animal_by_hydra_code(text)`, mantida de propósito porque uma Hydra Tag precisa abrir para qualquer pessoa que escaneie NFC/QR. As demais advertências de `SECURITY DEFINER` são funções alcançáveis por usuários autenticados e continuam protegidas por checks de `auth.uid()`, owner/member ou role dentro do banco.

## Vulnerabilidades encontradas e corrigidas

### ALTO — replay/uso frouxo da confirmação de cadastro

**CORRIGIDO.** O cadastro agora exige a prova one-time produzida pela verificação do código daquele e-mail. A prova fica apenas em memória no cliente, é enviada somente para `signup-no-confirmation`, comparada por hash no servidor e consumida após a criação da conta.

### ALTO — brute force no acesso de funcionário

**CORRIGIDO.** `staff-code-login` usa rate limit compartilhado no Postgres, atraso de falha e mensagens neutras:
- 12 tentativas/minuto por origem;
- 80/hora por origem;
- 5/10 minutos para o mesmo hash de código;
- HTTP 429 + `Retry-After`;
- fail-closed se o limitador estiver indisponível.

### ALTO — abuso do Hydra Assistente

**CORRIGIDO.** `/api/hydra-assistant` exige sessão Supabase válida e limita 20 chamadas/minuto e 300/dia por usuário em armazenamento compartilhado no Postgres. Também possui limite de payload, métodos HTTP restritos, `no-store` e mensagens de erro seguras. O endpoint foi migrado para Python e mantém o mesmo contrato HTTP usado pelo frontend.

### ALTO — RPCs internas expostas

**CORRIGIDO.** Triggers/helpers internos tiveram `EXECUTE` removido de `anon`/`authenticated` quando não precisam ser chamados pela API. RPCs sociais/ranking privadas perderam acesso anônimo. O Advisor final confirma que a única função `SECURITY DEFINER` executável por `anon` é a consulta pública da Hydra Tag, intencional.

### ALTO — envio de e-mail de animal encontrado

**CORRIGIDO.** `found-animal-email` exige JWT válido e só aceita o usuário registrado como `finder_user_id` na ocorrência. A função evita reenvio duplicado e só envia os dados de contato necessários ao proprietário.

### MÉDIO — spam e automação

**CORRIGIDO no banco.** Limites atuais:
- mensagens diretas: 30/minuto;
- posts: 10/5 minutos;
- comentários: 30/5 minutos;
- follows: 60/minuto;
- denúncias: 10/hora;
- “animal encontrado”: 5/10 minutos.

O aviso da Hydra Tag também exige login, exige animal em modo perdido, impede o próprio dono de gerar a ocorrência e reaproveita ocorrência recente para evitar duplicação.

## Headers, HTTPS e CSP

`vercel.json` aplica HSTS, `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, COOP, bloqueio de cross-domain policy, `upgrade-insecure-requests`, `no-store` em `/api/*` e política própria para o service worker.

A CSP está ativa, porém ainda contém `unsafe-inline` por compatibilidade com conteúdo inline atual. Por isso CSP/XSS continuam marcados como parciais até a remoção segura desses trechos.

## CORS

**PROTEGIDO nos fluxos críticos revisados.** Cadastro, `auth-email`, funcionário, troca de senha e animal encontrado usam allowlist compatível com os domínios oficiais, Capacitor e localhost de desenvolvimento. Não se depende de CORS como autorização: JWT, token one-time, RLS e rate limit continuam sendo as defesas efetivas.

## RLS / IDOR / BOLA

Foram auditadas policies de profiles, properties, animals, NFC, activities, monitoring, water, notifications, messages, roles, subscriptions, property_members, found reports e Web Push.

Um teste transacional simulando uma conta comum (`role=user`) confirmou que ela enxerga apenas seus próprios dados centrais. Também foi confirmado que `authenticated` não possui UPDATE direto sobre `roles` nem `subscriptions`. Autorização administrativa ocorre no banco/RPC, não em estado React/localStorage.

As tabelas `auth_email_challenges`, `security_rate_limits` e `web_push_config` aparecem no linter como “RLS sem policy”. Isso é intencional: são tabelas internas sem policy de cliente, com acesso reservado ao backend/service role.

## Admin

As RPCs administrativas são alcançáveis por sessão autenticada, mas validam role dentro do banco antes de ler ou alterar dados. Mudança de role é owner-only; assinatura, banimento, moderação e avisos também possuem checks server-side e auditoria. Os avisos do Advisor sobre essas funções são esperados por serem `SECURITY DEFINER`, não evidência de bypass por si só.

## Uploads / Storage

Proteções confirmadas no servidor:
- `avatars`: público, máximo 5 MB;
- `community-media`: público, máximo 10 MB;
- `farm-media`: privado, máximo 10 MB;
- somente JPEG/PNG/WebP;
- escrita vinculada ao usuário/propriedade;
- `farm-media` protegido por policies e URLs assinadas;
- nomes de arquivos gerados/controlados pelo Hydra.

## Secrets

A varredura do código atual não encontrou valores literais de `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY` ou `OPENAI_API_KEY` commitados. As referências usam variáveis de ambiente server-side. A chave publishable do Supabase é pública por definição e não equivale à service role.

Se algum secret tiver sido publicado em histórico antigo fora do escopo atual, ele deve ser rotacionado; valores secretos nunca são incluídos neste relatório.

## Web Push

- subscriptions vinculadas a `auth.uid()` com RLS;
- private VAPID somente no servidor;
- trigger interno fora da superfície RPC;
- função de envio protegida por segredo interno;
- subscriptions inválidas removíveis;
- webhook interno endurecido.

## Hydra Tag pública

A leitura pública é deliberada e retorna somente o conjunto autorizado de dados. Os códigos legados observados possuem 9 caracteres e não são simples IDs sequenciais. Uma futura migração deve aumentar a entropia do token público sem invalidar NFC/QR já gravados; por compatibilidade, os códigos existentes não foram rotacionados à força.

## Firewall / WAF

A aplicação está atrás da edge da Vercel e possui proteção real na aplicação/banco, porém regras customizadas do Vercel Firewall/WAF não puderam ser alteradas por esta integração. O WAF deve ser tratado como camada adicional, não substituto do RLS/rate limit implementado.

Durante incidente volumétrico, recomenda-se habilitar Attack Mode e, se disponível no plano/console, criar regras específicas para `/api/*`, scanners e padrões abusivos.

## Autenticação

Proteções atuais:
- Supabase Auth e PKCE;
- senha, Google, código de e-mail e funcionário preservados;
- código obrigatório no cadastro;
- prova one-time vinculada ao cadastro;
- recuperação/troca de senha por código;
- troca de senha liga token ao e-mail da própria sessão;
- desafios expiram e têm limite de tentativas;
- mensagens de autenticação endurecidas contra enumeração.

**PENDÊNCIA EXTERNA:** o Advisor do Supabase ainda informa `Leaked Password Protection Disabled`. Essa opção deve ser ativada nas configurações de Auth para bloquear senhas conhecidas como comprometidas.

## Dependências / CI

`.github/workflows/security-audit.yml` executa em push/PR e semanalmente:
- `npm install`;
- typecheck/lint;
- testes;
- build;
- compilação do backend Python;
- testes unitários Python;
- `npm audit --audit-level=high`.

O resultado do GitHub Actions é a fonte de verdade para vulnerabilidades de dependências, pois o ambiente local desta auditoria não possui acesso ao registry npm.

## Proteções — status

| PROTEÇÃO | STATUS | IMPLEMENTAÇÃO |
|---|---|---|
| Firewall/WAF | ⚠️ PARCIAL | Edge Vercel + hardening app/DB; regras customizadas dependem do console/plano |
| Rate Limit | ✅ PROTEGIDO | Postgres compartilhado, serverless-safe |
| Brute Force | ✅ PROTEGIDO | OTP, staff e endpoints sensíveis com limites/expiração |
| SQL Injection | ✅ PROTEGIDO | Supabase SDK/RPC parametrizados nos caminhos auditados |
| XSS | ⚠️ PARCIAL | React escaping + escaping de HTML + CSP; ainda há `unsafe-inline` |
| CSRF | ✅ PROTEGIDO | Bearer/PKCE e ações críticas sem sessão tradicional baseada em cookie |
| CORS | ✅ PROTEGIDO | Allowlist nos fluxos privilegiados auditados |
| CSP | ⚠️ PARCIAL | Ativa; `unsafe-inline` permanece por compatibilidade |
| Security Headers | ✅ PROTEGIDO | HSTS, nosniff, frame deny, referrer, permissions |
| RLS | ✅ PROTEGIDO | Core auditado por uid/owner/member/admin |
| IDOR/BOLA | ✅ PROTEGIDO | RLS testada com usuário comum |
| Admin | ✅ PROTEGIDO | Role verificada server-side + audit log |
| Uploads | ✅ PROTEGIDO | MIME/tamanho/RLS/storage privado |
| Web Push | ✅ PROTEGIDO | Segredo interno + RLS + trigger fechado |
| Secrets | ✅ PROTEGIDO | Nenhum valor secreto literal encontrado no código atual |
| Logs | ⚠️ PARCIAL | Audit/activity logs existem; correlação/detecção pode evoluir |
| HTTPS | ✅ PROTEGIDO | Vercel HTTPS + HSTS |
| Dependency Audit | ⚠️ PARCIAL | CI criado; acompanhar HIGH/CRITICAL do GitHub Actions |
| OWASP | ⚠️ PARCIAL | Principais classes auditadas; itens externos abaixo permanecem |

## Principais arquivos alterados

- `vercel.json`
- `api/hydra-assistant.py`
- `api/python-health.py`
- `src/services/supabase.ts`
- `src/services/auth-email-service.ts`
- `supabase/functions/auth-email/index.ts`
- `supabase/functions/signup-no-confirmation/index.ts`
- `supabase/functions/staff-code-login/index.ts`
- `supabase/functions/change-password-verified/index.ts`
- `supabase/functions/found-animal-email/index.ts`
- `.github/workflows/security-audit.yml`
- migrations de hardening em `supabase/migrations/20260901*.sql`

## Pendências reais

1. Ativar `Leaked Password Protection` no Supabase Auth.
2. Remover `unsafe-inline` da CSP após externalizar conteúdo inline sem regressão visual.
3. Planejar Hydra Codes públicos de maior entropia mantendo compatibilidade com tags já gravadas.
4. Configurar regras customizadas de Vercel Firewall/WAF quando disponíveis no plano/console.
5. Corrigir qualquer HIGH/CRITICAL apontado pelo workflow `Security Audit`.
6. Repetir RLS/IDOR e revisão de `SECURITY DEFINER` sempre que novas tabelas/RPCs forem adicionadas.

## Conclusão

O Hydra Agro ficou significativamente mais resistente a brute force, replay de cadastro, abuso de API/custo, spam, IDOR, bypass de admin, vazamento por RLS, upload perigoso e uso indevido de funções privilegiadas. O Hydra Assistente agora executa em backend Python na Vercel sem expor segredos no cliente. O projeto não deve ser descrito como “impossível de invadir”; segurança continua sendo um processo contínuo e precisa de monitoramento e atualização.