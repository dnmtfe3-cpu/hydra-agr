import { Code2, ExternalLink, FileCheck2, Instagram, Mail, ShieldCheck, Sprout } from "lucide-react";

export type ProfileInformationKind = "terms" | "privacy" | "credits" | "about";

const information = {
  terms: {
    eyebrow: "TERMOS DE USO",
    title: "Termos de uso",
    icon: <FileCheck2 size={28} />,
    introduction: "Ao usar o Hydra Agro, você concorda com estas regras básicas de uso.",
    sections: [
      ["1. Para que serve", "O Hydra Agro ajuda a organizar dados da propriedade, rebanho, tarefas, setores, comunidade, NFC/RFID e monitoramentos. O aplicativo não substitui orientação veterinária, agronômica, jurídica ou de segurança."],
      ["2. Seus registros", "Mantenha os dados da conta corretos, proteja suas credenciais e confira as informações antes de salvar. As decisões de manejo e operação continuam sob responsabilidade do produtor."],
      ["3. Recursos externos", "Leitura NFC/RFID, clima, notificações e pagamentos podem depender do aparelho, da internet, de permissões ou de serviços externos."],
      ["4. Comunidade", "Não é permitido publicar conteúdo ilegal, ofensivo, enganoso ou que viole direitos de outras pessoas. Publicações podem ser moderadas quando necessário."],
      ["5. Atualizações", "O aplicativo pode receber melhorias, correções e períodos de manutenção. Sempre que possível, os dados já sincronizados permanecem vinculados à conta."],
    ],
  },
  privacy: {
    eyebrow: "PRIVACIDADE",
    title: "Política de privacidade",
    icon: <ShieldCheck size={28} />,
    introduction: "Os dados da conta são usados para manter as funções do Hydra Agro e o acesso à propriedade.",
    sections: [
      ["Dados armazenados", "Podem ser armazenados nome, e-mail, telefone, foto, dados da propriedade, animais, tarefas, setores, monitoramentos, publicações e preferências."],
      ["Como os dados são usados", "Essas informações servem para autenticar a conta, manter a ficha da propriedade, sincronizar registros, mostrar avisos e liberar as funções escolhidas pelo usuário."],
      ["Acesso e segurança", "Registros privados ficam vinculados à conta e seguem as regras de acesso configuradas no servidor. Recursos administrativos exigem permissão válida."],
      ["Clima e serviços externos", "Na consulta do clima, o aplicativo usa apenas a cidade cadastrada e dados necessários para localizar a previsão. Informações da conta e do rebanho não fazem parte dessa consulta."],
      ["Seus direitos", "Você pode solicitar acesso, correção ou exclusão dos seus dados pelos canais oficiais do Hydra Agro, respeitando eventuais obrigações legais."],
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
      ["Região atendida", "O projeto começou em Brejões e municípios vizinhos da Bahia. A cidade cadastrada também é usada para mostrar a previsão do tempo."],
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
      <div className="legal-meta"><strong>Hydra Agro · versão 1.2.2</strong><span>Última atualização: 25 de agosto de 2026</span></div>
      <div className="legal-contact-actions">
        <button className="secondary-button" onClick={onEmail}><Mail size={18} /> Suporte</button>
        <button className="secondary-button" onClick={onInstagram}><Instagram size={18} /> Instagram <ExternalLink size={14} /></button>
      </div>
      <button className="primary-button full" onClick={onClose}>Fechar</button>
    </div>
  );
}
