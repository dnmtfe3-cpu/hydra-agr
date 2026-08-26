# Homologação Android — Hydra Agro

Registre aparelho, versão Android, versão do APK, data, responsável e evidência para cada execução.

## Autenticação e isolamento

- [ ] Splash nativa preenche a tela sem moldura branca.
- [ ] Primeiro acesso abre Entrar/Criar conta.
- [ ] Criação de conta aceita somente a região atendida.
- [ ] Dados do onboarding aparecem no perfil e na ficha da propriedade.
- [ ] Login permanece após fechar e abrir o app.
- [ ] Recuperação de senha retorna pelo deep link e salva a nova senha.
- [ ] Logout volta ao login.
- [ ] Conta A cria animal, leitura, setor e atividade.
- [ ] Após logout, Conta B não vê nenhum dado da Conta A.
- [ ] Ao voltar para Conta A, seus dados reaparecem.
- [ ] Conta bloqueada não acessa dados privados.
- [ ] Conta comum não vê nem abre o painel administrativo.
- [ ] `danqxy7@gmail.com` recebe `owner` pelo banco.

## Propriedade e recursos rurais

- [ ] Editar propriedade persiste após reiniciar.
- [ ] Fonte de água: criar, editar situação, abrir detalhes e excluir.
- [ ] Leitura de água: criar, editar, abrir detalhes e excluir.
- [ ] Fonte e leitura exibem Cancelar/Confirmar; exclusão exige segunda confirmação.
- [ ] Gráfico usa apenas registros reais.
- [ ] Animal: criar, editar, pesquisar, filtrar, abrir ficha e excluir.
- [ ] Foto do animal funciona por câmera e galeria.
- [ ] Setor: criar, editar, abrir detalhes e excluir.
- [ ] Atividade: criar, editar, concluir/reabrir e excluir.
- [ ] Monitoramento: criar, abrir detalhes, anexar foto e excluir.
- [ ] Clima usa o município cadastrado e exibe temperatura, sensação, umidade, chuva e vento reais.
- [ ] Sem internet, clima mostra erro ou dado salvo identificado, sem inventar valores.

## NFC/RFID

- [ ] Em aparelho sem NFC, o app explica a limitação e oferece código manual.
- [ ] Em aparelho com NFC desativado, o app abre as configurações.
- [ ] Uma tag real retorna seu código, sem valor inventado.
- [ ] Código cadastrado localiza e abre a ficha correta.
- [ ] Vínculo a outro animal respeita unicidade.
- [ ] Timeout/cancelamento encerra a leitura corretamente.

## Comunidade, perfil e administração

- [ ] Publicar texto e imagem.
- [ ] Curtir, descurtir, comentar e excluir publicação própria.
- [ ] Nova publicação exibe Cancelar/Confirmar; exclusão exige segunda confirmação.
- [ ] Estado vazio aparece sem posts falsos.
- [ ] Foto de perfil persiste e aparece na comunidade.
- [ ] Lápis do perfil abre nome, telefone, biografia, propriedade, referência, cidade e estado.
- [ ] Foto do perfil e capa da propriedade persistem após reiniciar.
- [ ] E-mail e senha são editáveis pela área Segurança.
- [ ] Preferências de notificações abrem, salvam com loading e persistem após reiniciar.
- [ ] Termos, Privacidade e Sobre exibem conteúdo completo, legível e canais oficiais.
- [ ] Apoio voluntário abre Instagram/e-mail e permanece separado da assinatura.
- [ ] Card Gratuito mostra Hydra Agro+ por R$ 6/mês e abre o fluxo manual pelo Instagram.
- [ ] “Apoie o Hydra Agro” fica separado da assinatura e não bloqueia funções.
- [ ] Suporte abre `rlkdn.dev@hydracity.sbs`.
- [ ] Instagram abre `@hydraagroo`.
- [ ] Owner cria, edita e exclui aviso e link.
- [ ] Owner envia aviso individual.
- [ ] Owner/moderação oculta, restaura e remove publicação.
- [ ] Owner bloqueia e desbloqueia usuário.
- [ ] Owner altera cargo sem permitir outro `owner`.
- [ ] Owner libera/remove Hydra Agro+ somente após a confirmação obrigatória.
- [ ] Mudança do plano chega à conta do usuário e remoção preserva os dados.
- [ ] Usuário comum não consegue alterar a própria assinatura pela API.
- [ ] Logout do owner remove totalmente o painel.

## Sistema Android e build

- [ ] Ícone correto no launcher normal e redondo.
- [ ] Status bar e safe areas não cobrem conteúdo.
- [ ] Bottom navigation fica centralizada em diferentes larguras.
- [ ] Teclado não cobre o campo ativo.
- [ ] Botão voltar fecha modal/rota antes de sair.
- [ ] Modal longo ocupa aproximadamente 80–90% da tela e tem scroll interno.
- [ ] Modal curto se ajusta ao conteúdo e nenhum botão fica atrás da barra inferior.
- [ ] Feedback tátil é discreto.
- [ ] App abre a interface sem internet após login/cache válido.
- [ ] Alterações offline sincronizam quando a internet retorna.
- [ ] `npm run verify` passa.
- [ ] `npm run android:apk` gera `app-debug.apk`.
- [ ] GitHub Actions gera o artifact `hydra-agro-apk`.
- [ ] APK instala em aparelho limpo e atualiza uma instalação anterior.
