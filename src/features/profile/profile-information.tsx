import { Code2, ExternalLink, FileCheck2, Instagram, Mail, Scale, ShieldCheck, Sprout } from "lucide-react";

export type ProfileInformationKind = "legal" | "terms" | "privacy" | "credits" | "about";

const information = {
  legal: {
    eyebrow: "JURÍDICO",
    title: "Informações jurídicas",
    icon: <Scale size={28} />,
    introduction: "Esta área reúne as principais informações jurídicas do Hydra Agro, incluindo responsabilidades, privacidade, propriedade intelectual e direitos do usuário.",
    sections: [
      ["Natureza do serviço", "O Hydra Agro é uma plataforma de apoio à gestão rural e organização de informações. Os recursos do aplicativo não substituem orientação veterinária, agronômica, contábil, jurídica, ambiental, trabalhista ou de segurança profissional."],
      ["Responsabilidade do usuário", "O usuário é responsável pela veracidade dos dados cadastrados, pelo uso das informações exibidas e pelas decisões tomadas na propriedade. Identificações NFC/RFID, registros de animais, tarefas, alertas e indicadores devem ser conferidos antes de servirem de base para uma decisão operacional."],
      ["Disponibilidade e terceiros", "Algumas funções dependem de internet, aparelho, NFC, serviços de autenticação, notificações, clima, hospedagem e outros fornecedores. Podem ocorrer indisponibilidades temporárias, manutenção ou limitações fora do controle direto do Hydra Agro."],
      ["Proteção de dados e LGPD", "O tratamento de dados pessoais segue os princípios da Lei Geral de Proteção de Dados (Lei nº 13.709/2018). Dados são utilizados para autenticação, funcionamento da conta, segurança, suporte, sincronização e prestação das funções solicitadas pelo usuário, conforme descrito na Política de Privacidade."],
      ["Direitos do titular", "O titular pode solicitar confirmação de tratamento, acesso, correção, portabilidade quando aplicável, informação sobre compartilhamentos e exclusão de dados tratados com consentimento, observadas as hipóteses legais de conservação. Solicitações podem ser feitas pelo canal oficial de suporte."],
      ["Propriedade intelectual", "A identidade, interface, textos próprios, organização do produto e elementos desenvolvidos especificamente para o Hydra Agro são protegidos pela legislação aplicável. Marcas, bibliotecas, serviços e tecnologias de terceiros permanecem pertencentes aos seus respectivos titulares."],
      ["Uso proibido", "É proibido usar o Hydra Agro para fraude, invasão, tentativa de acesso não autorizado, abuso de recursos, coleta indevida de dados, violação de direitos de terceiros ou qualquer finalidade ilegal. Contas e conteúdos podem ser restringidos quando necessário para segurança, cumprimento legal ou proteção da comunidade."],
      ["Hydra Tag e ficha pública", "A Hydra Tag pode disponibilizar uma ficha pública mínima para permitir a identificação de animal encontrado. Informações privadas da propriedade e da conta não devem ser expostas além do necessário para essa finalidade."],
      ["Atualizações destes documentos", "Termos, política de privacidade e informações jurídicas podem ser atualizados quando o produto, a legislação ou os serviços utilizados mudarem. A data de atualização exibida nesta área indica a versão vigente dentro do aplicativo."],
      ["Contato jurídico e privacidade", "Dúvidas, solicitações relacionadas a dados pessoais, exercício de direitos ou comunicações jurídicas podem ser encaminhadas pelo e-mail oficial de suporte exibido no aplicativo."],
    ],
  },
  terms: {
    eyebrow: "TERMOS DE USO",
    title: "Termos de uso",
    icon: <FileCheck2 size={28} />,
    introduction: "Ao usar o Hydra Agro, você concorda com estas regras básicas de uso.",
    sections: [
      ["1. Para que serve", "O Hydra Agro ajuda a organizar dados da propriedade, rebanho, tarefas, setores, comunidade, NFC/RFID e monitoramentos. O aplicativo não substitui orientação veterinária, agronômica, jurídica ou de segurança."],
      ["2. Seus registros", "Mantenha os dados da conta corretos, proteja suas credenciais e confira as informações antes de salvar. As decisões de manejo e operação continuam sob responsabilidade do produtor."],
      ["3. Recursos externos", "Leitura NFC/RFID, clima, notificações, autenticação e outros recursos podem depender do aparelho, da internet, de permissões ou de serviços externos."],
      ["4. Comunidade", "Não é permitido publicar conteúdo ilegal, ofensivo, enganoso, fraudulento ou que viole direitos de outras pessoas. Publicações podem ser moderadas quando necessário."],
      ["5. Segurança da conta", "O usuário deve proteger suas credenciais e não compartilhar códigos de acesso. Tentativas de invasão, automação abusiva, fraude ou acesso não autorizado podem resultar em bloqueio e registro de segurança."],
      ["6. Atualizações", "O aplicativo pode receber melhorias, correções e períodos de manutenção. Sempre que possível, os dados já sincronizados permanecem vinculados à conta."],
    ],
  },
  privacy: {
    eyebrow: "PRIVACIDADE E LGPD",
    title: "Política de privacidade",
    icon: <ShieldCheck size={28} />,
    introduction: "Os dados da conta são usados para manter as funções do Hydra Agro e o acesso à propriedade.",
    sections: [
      ["Dados armazenados", "Podem ser armazenados nome, e-mail, telefone, foto, dados da propriedade, animais, tarefas, setores, monitoramentos, publicações, mensagens, preferências, registros técnicos de segurança e informações necessárias ao funcionamento da conta."],
      ["Como os dados são usados", "Essas informações servem para autenticar a conta, manter a ficha da propriedade, sincronizar registros, mostrar avisos, combater abuso, prestar suporte e liberar as funções escolhidas pelo usuário."],
      ["Bases e finalidades", "O tratamento ocorre conforme a finalidade do recurso utilizado, podendo se apoiar na execução do serviço solicitado, cumprimento de obrigação legal, legítimo interesse relacionado à segurança e funcionamento do produto ou consentimento quando aplicável."],
      ["Acesso e segurança", "Registros privados ficam vinculados à conta e seguem regras de acesso configuradas no servidor. Recursos administrativos exigem permissão válida. São aplicadas medidas técnicas para reduzir acesso indevido, abuso e exposição de dados."],
      ["Fornecedores e infraestrutura", "O Hydra Agro pode utilizar provedores de autenticação, banco de dados, hospedagem, e-mail, notificações e outros serviços necessários. Somente os dados necessários para cada finalidade devem ser tratados por esses serviços."],
      ["Clima e serviços externos", "Na consulta do clima, o aplicativo usa a localização cadastrada necessária para obter a previsão. Informações do rebanho não fazem parte dessa consulta."],
      ["Retenção e exclusão", "Os dados são mantidos enquanto necessários para a conta, segurança, funcionamento do serviço ou cumprimento de obrigações aplicáveis. Solicitações de exclusão serão atendidas quando juridicamente e tecnicamente cabíveis."],
      ["Seus direitos", "Você pode solicitar confirmação de tratamento, acesso, correção, informações sobre uso e compartilhamento, portabilidade quando aplicável e exclusão nas hipóteses previstas pela LGPD, pelos canais oficiais do Hydra Agro."],
    ],
  },
  credits: {
    eyebrow: "CRÉDITOS DO PROJETO",
    title: "Créditos",
    icon: <Code2 size={28} />,
    introduction: "Hydra Agro é um projeto de tecnologia aplicado ao campo, criado para aproximar gestão rural, identificação animal e ferramentas digitais em uma experiência simples.",
    sections: [
      ["Criador e desenvolvedor", "Daniel — idealização do projeto, desenvolvimento do aplicativo, experiência de uso, identidade do produto e evolução das funcionalidades do Hydra Agro."],
      ["Origem do projeto", "O Hydra Agro nasceu como um projeto desenvolvido em Brejões, Bahia, com foco em soluções que possam ser demonstradas e aplicadas à realidade de propriedades rurais."],
      ["Objetivo", "Facilitar tarefas do dia a dia da propriedade reunindo rebanho, identificação NFC/RFID, atividades, equipe, produção, monitoramentos e recursos de comunidade em um único aplicativo."],
      ["Tecnologias", "Aplicação desenvolvida com React e TypeScript. O Supabase é utilizado em recursos de autenticação, banco de dados e sincronização, enquanto o Capacitor permite integrar o projeto a recursos de dispositivos móveis."],
      ["Identificação animal", "O sistema permite associar identificadores NFC/RFID aos animais e acessar suas fichas digitais, reunindo informações importantes de identificação e acompanhamento."],
      ["Design e experiência", "A interface foi planejada para manter uma identidade visual própria do Hydra Agro, priorizando leitura rápida, navegação simples e uso em telas de celular."],
      ["Desenvolvimento contínuo", "O Hydra Agro continua em evolução. Novas funções, melhorias de desempenho e ajustes de experiência são adicionados conforme o projeto avança e recebe novos testes."],
      ["Projeto independente", "O Hydra Agro é um projeto independente. Marcas e tecnologias citadas pertencem aos seus respectivos proprietários."],
    ],
  },
  about: {
    eyebrow: "HYDRA AGRO",
    title: "Sobre o Hydra Agro",
    icon: <Sprout size={28} />,
    introduction: "O Hydra Agro reúne ferramentas de gestão rural em um aplicativo simples para o dia a dia da propriedade.",
    sections: [
      ["O que você encontra", "Rebanho, identificação NFC/RFID, tarefas, setores, equipe, comunidade e monitoramentos."],
      ["Abrangência", "O Hydra Agro pode ser utilizado por propriedades cadastradas em diferentes municípios e estados. A localização cadastrada também pode ser usada em recursos como previsão do tempo."],
      ["Informações da conta", "Telas, históricos e indicadores usam os registros disponíveis na sua conta."],
      ["Recursos externos", "Algumas funções dependem de hardware, internet ou serviços externos, como NFC, clima e notificações."],
    ],
  },
} as const;

export function ProfileInformation({ kind, onClose, onEmail, onInstagram }: { kind: ProfileInformationKind; onClose: () => void; onEmail: () => void; onInstagram: () => void }) {
  const content = information[kind];
  return (
    <div className="profile-information">
      <header className="legal-intro">
        <span>{content.icon}</span>
        <div><small>{content.eyebrow}</small><p>{content.introduction}</p></div>
      </header>
      <div className="legal-sections">
        {content.sections.map(([title, text]) => <section key={title}><h3>{title}</h3><p>{text}</p></section>)}
      </div>
      <div className="legal-meta"><strong>Hydra Agro · versão 1.2.2</strong><span>Última atualização: 31 de agosto de 2026</span></div>
      <div className="legal-contact-actions">
        <button className="secondary-button" onClick={onEmail}><Mail size={18} /> Suporte</button>
        <button className="secondary-button" onClick={onInstagram}><Instagram size={18} /> Instagram <ExternalLink size={14} /></button>
      </div>
      <button className="primary-button full" onClick={onClose}>Fechar</button>
    </div>
  );
}
