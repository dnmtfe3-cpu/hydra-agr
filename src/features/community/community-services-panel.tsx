import { useMemo, useState } from "react";
import {
  BadgeCheck,
  Bell,
  Beef as Cow,
  BookOpenCheck,
  CalendarDays,
  ChevronRight,
  ClipboardCheck,
  FileCheck2,
  GraduationCap,
  Info,
  Search,
  ShieldCheck,
  Store,
  UsersRound,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { Modal } from "../../components/ui";
import type { CommunityPost, HydraAccount } from "../../lib/hydra-types";

type ServiceCategory = "Todos" | "Produção" | "Capacitação" | "Animais" | "Organização" | "Eventos" | "Oportunidades";

type ServiceGuide = {
  id: string;
  title: string;
  subtitle: string;
  category: Exclude<ServiceCategory, "Todos">;
  icon: LucideIcon;
  tone: "green" | "blue" | "orange";
  usefulFor: string;
  purpose: string;
  prepare: string[];
  check: string[];
};

type Props = {
  account: HydraAccount;
  onOpenNotices: () => void;
};

const serviceGuides: ServiceGuide[] = [
  {
    id: "assistencia",
    title: "Assistência técnica",
    subtitle: "Ajuda para organizar dúvidas de manejo, produção, solo, pastagem e estrutura.",
    category: "Produção",
    icon: Wrench,
    tone: "green",
    usefulFor: "Quando um problema da propriedade precisa de orientação técnica antes de virar gasto ou perda.",
    purpose: "O Hydra ajuda você a chegar ao atendimento com o problema melhor descrito: setor, histórico, fotos e objetivo. Isso reduz informação solta e facilita explicar a situação.",
    prepare: ["Fotos e registros recentes.", "Setor ou área onde o problema acontece.", "O que mudou e há quanto tempo.", "Qual resultado você quer alcançar."],
    check: ["Quem presta o atendimento e qual é a especialidade.", "Se a orientação é técnica ou divulgação comercial.", "O que foi recomendado e o que realmente foi executado."],
  },
  {
    id: "cursos",
    title: "Cursos e capacitações",
    subtitle: "Oficinas, dias de campo, treinamentos e oportunidades de aprendizagem.",
    category: "Capacitação",
    icon: GraduationCap,
    tone: "blue",
    usefulFor: "Quando você quer aprender uma prática nova ou melhorar uma atividade que já faz.",
    purpose: "Centralizar informações úteis de curso evita depender de mensagens espalhadas. O produtor consegue conferir tema, local, data, responsável e exigências antes de se deslocar.",
    prepare: ["Tema que você quer aprender.", "Data e horário disponíveis.", "Requisitos de idade ou inscrição.", "Documentos pedidos pela organização, se houver."],
    check: ["Quem organiza o curso.", "Data, local e custo confirmados.", "Se existe inscrição oficial ou limite de vagas."],
  },
  {
    id: "eventos",
    title: "Feiras e eventos rurais",
    subtitle: "Feiras, exposições, reuniões, encontros e dias de campo da região.",
    category: "Eventos",
    icon: CalendarDays,
    tone: "orange",
    usefulFor: "Para acompanhar atividades que possam ajudar na produção, comercialização ou contato entre produtores.",
    purpose: "Reunir os dados essenciais de cada evento em um lugar simples: quando, onde, quem organiza e para quem é destinado.",
    prepare: ["Data e horário.", "Local ou ponto de referência público.", "Nome de quem organiza.", "Se precisa de inscrição prévia."],
    check: ["Se houve mudança de horário ou cancelamento.", "Se a organização realmente confirmou o evento.", "Evite publicar endereço particular sem autorização."],
  },
  {
    id: "manejo",
    title: "Vacinação e manejo animal",
    subtitle: "Organização de campanhas, manejo preventivo e registros do rebanho.",
    category: "Animais",
    icon: Cow,
    tone: "green",
    usefulFor: "Para organizar lotes, datas, histórico e informações confirmadas de campanhas ou atendimentos.",
    purpose: "O Hydra pode reunir os registros do rebanho e facilitar a preparação antes de um atendimento ou ação de manejo.",
    prepare: ["Identificação dos animais ou lotes.", "Histórico sanitário disponível.", "Datas de manejos anteriores.", "Informação confirmada sobre campanha ou atendimento."],
    check: ["Orientações de saúde animal devem vir de profissional ou fonte competente.", "O app não substitui avaliação veterinária.", "Dados privados da propriedade não devem ir para avisos públicos."],
  },
  {
    id: "associacoes",
    title: "Associações e cooperativas",
    subtitle: "Reuniões, serviços, compras coletivas e iniciativas da comunidade rural.",
    category: "Organização",
    icon: UsersRound,
    tone: "blue",
    usefulFor: "Quando o produtor precisa acompanhar uma organização coletiva da região.",
    purpose: "Organizar informações sobre reuniões, serviços e ações coletivas sem tratar nenhuma entidade como parceira oficial sem autorização.",
    prepare: ["Nome completo da organização.", "Objetivo do encontro ou serviço.", "Data, local e regras de participação."],
    check: ["Se a informação veio da própria organização ou de responsável identificado.", "Taxas e condições diretamente com a organização.", "Se houve atualização depois da publicação."],
  },
  {
    id: "oportunidades",
    title: "Oportunidades rurais",
    subtitle: "Chamadas, vagas, iniciativas, compras coletivas e oportunidades úteis.",
    category: "Oportunidades",
    icon: ClipboardCheck,
    tone: "orange",
    usefulFor: "Para encontrar uma oportunidade concreta sem depender só de grupos de mensagem.",
    purpose: "Mostrar prazo, público, requisitos e origem da oportunidade de forma curta e comparável.",
    prepare: ["Prazo de participação.", "Quem pode participar.", "Requisitos principais.", "Responsável ou fonte da oportunidade."],
    check: ["Desconfie de cobrança antecipada sem origem clara.", "Nunca publique senha, documento ou dado bancário.", "Confirme as condições antes de assumir compromisso."],
  },
  {
    id: "documentos",
    title: "Documentação e regularização",
    subtitle: "Checklist para chegar mais preparado a cadastros e atendimentos administrativos.",
    category: "Organização",
    icon: FileCheck2,
    tone: "green",
    usefulFor: "Antes de resolver um cadastro, atualização ou atendimento que exige documentação.",
    purpose: "Ajudar o produtor a organizar o que precisa conferir antes de sair da propriedade, sem armazenar documentos pessoais em área pública.",
    prepare: ["Objetivo do atendimento.", "Lista de documentos exigidos pela fonte responsável.", "Cópias ou versões digitais organizadas, quando necessário."],
    check: ["Exigências e prazos podem mudar.", "Confirme sempre na fonte responsável.", "O Hydra não valida documentos nem substitui o órgão competente."],
  },
  {
    id: "comercializacao",
    title: "Comercialização e produção",
    subtitle: "Organização de produção, entrega, disponibilidade e informações de mercado local.",
    category: "Produção",
    icon: Store,
    tone: "blue",
    usefulFor: "Quando produtores precisam compartilhar informações de produção sem expor dados privados.",
    purpose: "Permitir avisos objetivos sobre produto, período, disponibilidade e região, mantendo negociação financeira fora da área pública.",
    prepare: ["Produto ou atividade.", "Quantidade ou disponibilidade quando fizer sentido.", "Período e região de referência."],
    check: ["Não publique dados bancários.", "Não prometa preço ou condição que não esteja confirmada.", "Mantenha o aviso informativo e objetivo."],
  },
];

const serviceCategories: ServiceCategory[] = ["Todos", "Produção", "Capacitação", "Animais", "Organização", "Eventos", "Oportunidades"];
const serviceNoticeKinds = ["[Curso]", "[Evento]", "[Produção]", "[Oportunidade]", "[Reunião]", "[Animais]"];

function postCategory(post: CommunityPost) {
  const prefix = serviceNoticeKinds.find((kind) => post.text.startsWith(kind));
  return prefix ? prefix.replace(/[\[\]]/g, "") : "Informação";
}

function cleanPostText(post: CommunityPost) {
  return post.text.replace(/^\[[^\]]+\]\s*/, "");
}

export function CommunityServicesPanel({ account, onOpenNotices }: Props) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ServiceCategory>("Todos");
  const [selected, setSelected] = useState<ServiceGuide | null>(null);

  const filteredGuides = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    return serviceGuides.filter((guide) => {
      if (category !== "Todos" && guide.category !== category) return false;
      if (!normalized) return true;
      return `${guide.title} ${guide.subtitle} ${guide.category} ${guide.usefulFor}`.toLocaleLowerCase("pt-BR").includes(normalized);
    });
  }, [category, query]);

  const regionalPosts = useMemo(() => {
    const sameRegion = account.posts.filter((post) => {
      const serviceRelated = serviceNoticeKinds.some((kind) => post.text.startsWith(kind));
      if (!serviceRelated) return false;
      if (!account.property.municipality || !account.property.state) return true;
      return post.municipality === account.property.municipality && post.state === account.property.state;
    });
    return sameRegion.slice(0, 3);
  }, [account.posts, account.property.municipality, account.property.state]);

  return (
    <div className="community-rural-body community-services-body">
      <section className="community-rural-hero community-services-hero">
        <div>
          <small>CENTRAL RURAL</small>
          <h2>Informação útil, sem complicar.</h2>
          <p>Consulte guias práticos e veja informações da sua região. Nada aqui presume parceria oficial com órgão público ou empresa.</p>
        </div>
        <span className="community-rural-hero-icon"><BookOpenCheck size={24} /></span>
      </section>

      <div className="community-service-context">
        <div><span>Localidade</span><strong>{[account.property.municipality, account.property.state].filter(Boolean).join("/") || "Não informada"}</strong></div>
        <div><span>Guias disponíveis</span><strong>{serviceGuides.length}</strong></div>
        <div><span>Informações recentes</span><strong>{regionalPosts.length}</strong></div>
      </div>

      <div className="community-service-tools">
        <label className="community-service-search">
          <Search size={18} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar assunto…" aria-label="Buscar serviços e informações" />
        </label>
        <label className="community-service-filter">
          <span>Categoria</span>
          <select value={category} onChange={(event) => setCategory(event.target.value as ServiceCategory)}>
            {serviceCategories.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
      </div>

      <div className="community-rural-section-title"><div><small>GUIAS PRÁTICOS</small><h3>O que você precisa resolver?</h3></div><span className="community-service-count">{filteredGuides.length}</span></div>

      {filteredGuides.length ? <div className="community-services-grid">{filteredGuides.map((guide) => {
        const Icon = guide.icon;
        return <button className={`community-service-card ${guide.tone}`} key={guide.id} onClick={() => setSelected(guide)}>
          <span className="community-service-card-icon"><Icon size={19} /></span>
          <span className="community-service-card-copy"><small>{guide.category}</small><strong>{guide.title}</strong><p>{guide.subtitle}</p></span>
          <ChevronRight size={17} className="community-service-card-arrow" />
        </button>;
      })}</div> : <div className="community-rural-empty"><Search size={22} /><strong>Nenhum guia encontrado</strong><p>Tente outra palavra ou mude a categoria.</p></div>}

      <section className="community-service-explain">
        <span className="community-service-explain-icon"><BadgeCheck size={18} /></span>
        <div><small>COMO ESSA ÁREA FUNCIONA</small><strong>Guia é orientação. Aviso é informação da comunidade.</strong><p>Os guias ajudam a organizar o que verificar e preparar. Já cursos, eventos e oportunidades publicados por usuários aparecem separados, com autor, região e data.</p></div>
      </section>

      <div className="community-rural-section-title"><div><small>NA SUA REGIÃO</small><h3>Informações recentes</h3></div>{regionalPosts.length > 0 && <button onClick={onOpenNotices}>Ver avisos</button>}</div>
      {regionalPosts.length ? <div className="community-service-news">{regionalPosts.map((post) => <article className="community-service-news-card" key={post.id}>
        <span className="community-service-news-icon"><Bell size={16} /></span>
        <span><small>{postCategory(post)} · {post.author}</small><strong>{cleanPostText(post) || "Informação comunitária"}</strong><p>{[post.municipality, post.state].filter(Boolean).join("/") || "Região informada"} · {new Date(post.date).toLocaleDateString("pt-BR")}</p></span>
      </article>)}</div> : <div className="community-rural-empty compact"><Bell size={21} /><strong>Nenhuma informação regional publicada ainda</strong><p>Quando houver curso, evento, reunião ou oportunidade identificada, ela aparecerá aqui.</p></div>}

      <div className="community-service-trust">
        <span><ShieldCheck size={18} /></span>
        <div><strong>Origem e privacidade primeiro</strong><p>Não exibimos documentos, endereço exato ou dados bancários. Informações comunitárias não recebem selo oficial automaticamente.</p></div>
      </div>

      <Modal open={Boolean(selected)} onClose={() => setSelected(null)} eyebrow={selected?.category.toUpperCase() || "GUIA RURAL"} title={selected?.title || "Informação"}>
        {selected && (() => {
          const Icon = selected.icon;
          return <div className="community-service-detail">
            <div className={`community-service-detail-head ${selected.tone}`}><span><Icon size={22} /></span><div><small>PARA QUE SERVE</small><strong>{selected.purpose}</strong></div></div>
            <section><h4><Info size={16} /> Quando isso pode ajudar</h4><p>{selected.usefulFor}</p></section>
            <section><h4><ClipboardCheck size={16} /> O que preparar</h4>{selected.prepare.map((item) => <p key={item}>{item}</p>)}</section>
            <section><h4><ShieldCheck size={16} /> Antes de confiar na informação</h4>{selected.check.map((item) => <p key={item}>{item}</p>)}</section>
            <div className="community-service-detail-note"><BadgeCheck size={17} /><span>Conteúdo de organização do Hydra Agro. Não substitui atendimento profissional nem comunicação oficial da entidade responsável.</span></div>
          </div>;
        })()}
      </Modal>
    </div>
  );
}
