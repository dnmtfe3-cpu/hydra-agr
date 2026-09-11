import { useMemo, useState } from "react";
import {
  BadgeCheck,
  Bell,
  Beef as Cow,
  BookOpenCheck,
  CalendarDays,
  ChevronRight,
  ClipboardCheck,
  Droplets,
  FileCheck2,
  GraduationCap,
  Info,
  MapPin,
  Megaphone,
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
  noticeKind: string;
  icon: LucideIcon;
  tone: "green" | "blue" | "orange";
  when: string[];
  prepare: string[];
  verify: string[];
};

type Props = {
  account: HydraAccount;
  onOpenWater: () => void;
  onOpenAnimals: () => void;
  onOpenOccurrences: () => void;
  onOpenNotices: () => void;
  onCreateNotice: (kind: string) => void;
};

const serviceGuides: ServiceGuide[] = [
  {
    id: "assistencia",
    title: "Assistência técnica",
    subtitle: "Orientação para produção, manejo, solo, pastagem e organização da propriedade.",
    category: "Produção",
    noticeKind: "Produção",
    icon: Wrench,
    tone: "green",
    when: ["Quando houver dúvida técnica que afete produtividade, manejo ou organização.", "Antes de fazer mudanças importantes em estrutura, alimentação, pastagem ou rotina produtiva."],
    prepare: ["Fotos e registros do problema.", "Área ou setor envolvido.", "Histórico recente e objetivo que você quer alcançar."],
    verify: ["Confira quem presta o atendimento e qual é a área de atuação.", "Diferencie orientação técnica de propaganda de produto.", "Registre no Hydra Agro o que foi recomendado e o que realmente foi feito."],
  },
  {
    id: "cursos",
    title: "Cursos e capacitações",
    subtitle: "Treinamentos, oficinas, dias de campo e conteúdos para aprender novas práticas.",
    category: "Capacitação",
    noticeKind: "Curso",
    icon: GraduationCap,
    tone: "blue",
    when: ["Para aprender uma prática nova ou melhorar uma atividade que já existe.", "Quando surgir curso presencial, remoto, oficina ou dia de campo na região."],
    prepare: ["Tema que você quer aprender.", "Disponibilidade de data e horário.", "Requisitos de idade, inscrição e documentos, quando existirem."],
    verify: ["Veja quem organiza e onde a informação foi publicada.", "Confirme data, local, custo e exigências antes de sair de casa.", "Não trate certificado como garantia de qualidade sem verificar o conteúdo."],
  },
  {
    id: "eventos",
    title: "Feiras e eventos rurais",
    subtitle: "Feiras, exposições, encontros, reuniões e atividades abertas na região.",
    category: "Eventos",
    noticeKind: "Evento",
    icon: CalendarDays,
    tone: "orange",
    when: ["Para acompanhar eventos que possam ajudar produção, comercialização ou contato entre produtores.", "Para divulgar uma atividade comunitária com local, data e responsável identificados."],
    prepare: ["Data e horário confirmados.", "Local ou ponto de referência público.", "Nome de quem organiza e forma segura de confirmar a informação."],
    verify: ["Evite publicar endereço particular sem autorização.", "Atualize o aviso se houver mudança ou cancelamento.", "Não marque evento como oficial se a entidade responsável não confirmou isso."],
  },
  {
    id: "manejo",
    title: "Vacinação e manejo animal",
    subtitle: "Organização de campanhas, manejo preventivo e cuidados do rebanho.",
    category: "Animais",
    noticeKind: "Animais",
    icon: Cow,
    tone: "green",
    when: ["Para lembrar ou divulgar ações de manejo e campanhas confirmadas.", "Quando o produtor precisar organizar registros de aplicação, lote e data."],
    prepare: ["Identificação dos animais ou lotes.", "Histórico sanitário disponível.", "Informação confirmada sobre campanha ou atendimento."],
    verify: ["Orientações de saúde animal devem vir de profissional ou fonte competente.", "O Hydra Agro organiza informação; ele não substitui avaliação veterinária.", "Não publique dados privados da propriedade no aviso comunitário."],
  },
  {
    id: "associacoes",
    title: "Associações e cooperativas",
    subtitle: "Organização coletiva, reuniões, serviços, compras e iniciativas da comunidade.",
    category: "Organização",
    noticeKind: "Reunião",
    icon: UsersRound,
    tone: "blue",
    when: ["Para encontrar ou divulgar grupos rurais identificados na região.", "Quando houver reunião, assembleia, ação coletiva ou serviço para associados."],
    prepare: ["Nome completo da organização.", "Objetivo do encontro ou serviço.", "Regras de participação, quando houver."],
    verify: ["Confirme se a publicação veio da própria organização ou de responsável identificado.", "Não presuma parceria com o Hydra Agro.", "Contribuições, taxas e compromissos devem ser verificados diretamente com a organização."],
  },
  {
    id: "oportunidades",
    title: "Oportunidades rurais",
    subtitle: "Chamadas, vagas, compras coletivas, iniciativas e oportunidades úteis ao produtor.",
    category: "Oportunidades",
    noticeKind: "Oportunidade",
    icon: ClipboardCheck,
    tone: "orange",
    when: ["Quando houver uma oportunidade concreta e com origem identificável.", "Para reunir informações que normalmente ficam espalhadas em grupos e conversas."],
    prepare: ["Prazo, público e requisitos.", "Responsável pela oportunidade.", "Forma oficial ou segura de obter mais informações."],
    verify: ["Desconfie de cobrança antecipada sem origem clara.", "Não publique documentos pessoais, senhas ou dados bancários no aviso.", "Confirme condições antes de assumir qualquer compromisso."],
  },
  {
    id: "documentos",
    title: "Documentação e regularização",
    subtitle: "Checklist para organizar documentos da propriedade e demandas administrativas.",
    category: "Organização",
    noticeKind: "Outro",
    icon: FileCheck2,
    tone: "green",
    when: ["Quando precisar separar documentos para atendimento, cadastro ou atualização.", "Antes de deslocamentos para resolver uma demanda administrativa."],
    prepare: ["Liste o objetivo do atendimento antes de separar documentos.", "Leve apenas o necessário e mantenha cópias organizadas.", "Confirme previamente quais documentos são exigidos pela fonte responsável."],
    verify: ["Exigências e prazos podem mudar; confirme na fonte responsável.", "Não envie documentos pessoais em avisos públicos.", "O Hydra Agro não valida documento nem substitui órgão responsável."],
  },
  {
    id: "comercializacao",
    title: "Comercialização e produção",
    subtitle: "Informações comunitárias sobre produção, entrega, organização e canais de venda.",
    category: "Produção",
    noticeKind: "Produção",
    icon: Store,
    tone: "blue",
    when: ["Para divulgar informação útil sobre produção ou organização comercial da região.", "Quando produtores precisarem combinar logística, entrega ou disponibilidade sem expor dados privados."],
    prepare: ["Produto ou atividade.", "Período ou disponibilidade.", "Região de referência sem endereço particular."],
    verify: ["Negociações financeiras devem acontecer fora do aviso público.", "Evite promessas de preço ou garantia que não estejam confirmadas.", "Mantenha o aviso informativo e objetivo."],
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

export function CommunityServicesPanel({ account, onOpenWater, onOpenAnimals, onOpenOccurrences, onOpenNotices, onCreateNotice }: Props) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ServiceCategory>("Todos");
  const [selected, setSelected] = useState<ServiceGuide | null>(null);

  const filteredGuides = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    return serviceGuides.filter((guide) => {
      if (category !== "Todos" && guide.category !== category) return false;
      if (!normalized) return true;
      return `${guide.title} ${guide.subtitle} ${guide.category}`.toLocaleLowerCase("pt-BR").includes(normalized);
    });
  }, [category, query]);

  const regionalPosts = useMemo(() => {
    const sameRegion = account.posts.filter((post) => {
      const serviceRelated = serviceNoticeKinds.some((kind) => post.text.startsWith(kind));
      if (!serviceRelated) return false;
      if (!account.property.municipality || !account.property.state) return true;
      return post.municipality === account.property.municipality && post.state === account.property.state;
    });
    return sameRegion.slice(0, 4);
  }, [account.posts, account.property.municipality, account.property.state]);

  return (
    <div className="community-rural-body community-services-body">
      <section className="community-rural-hero community-services-hero">
        <div>
          <small>CENTRAL RURAL</small>
          <h2>Serviços e informações que ajudam no dia a dia</h2>
          <p>Guias práticos do Hydra e avisos reais publicados pela comunidade, sempre com origem identificada.</p>
          <div className="community-services-hero-actions">
            <button className="community-rural-primary" onClick={() => onCreateNotice("Outro")}><Megaphone size={16} /> Publicar informação</button>
            <button className="community-rural-secondary" onClick={onOpenNotices}>Ver avisos</button>
          </div>
        </div>
        <span className="community-rural-hero-icon"><BookOpenCheck size={24} /></span>
      </section>

      <div className="community-service-summary">
        <div><strong>{serviceGuides.length}</strong><span>guias úteis</span></div>
        <div><strong>{regionalPosts.length}</strong><span>avisos da região</span></div>
        <div><strong>{account.property.municipality || "Sua região"}</strong><span>{account.property.state || "localidade"}</span></div>
      </div>

      <div className="community-service-search">
        <Search size={18} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar assistência, curso, evento…" aria-label="Buscar serviços e informações" />
      </div>

      <div className="community-rural-chips" aria-label="Categorias de serviços">
        {serviceCategories.map((item) => <button key={item} className={`community-rural-chip ${category === item ? "active" : ""}`} onClick={() => setCategory(item)}>{item}</button>)}
      </div>

      <div className="community-rural-section-title"><div><small>GUIA HYDRA</small><h3>Encontre o que você precisa</h3></div><span className="community-service-count">{filteredGuides.length}</span></div>

      {filteredGuides.length ? <div className="community-services-grid">{filteredGuides.map((guide) => {
        const Icon = guide.icon;
        return <button className={`community-service-card ${guide.tone}`} key={guide.id} onClick={() => setSelected(guide)}><span className="community-service-card-icon"><Icon size={19} /></span><span className="community-service-card-copy"><small>{guide.category}</small><strong>{guide.title}</strong><p>{guide.subtitle}</p><span className="community-service-card-foot"><BadgeCheck size={13} /> Guia informativo do Hydra</span></span><ChevronRight size={17} className="community-service-card-arrow" /></button>;
      })}</div> : <div className="community-rural-empty"><Search size={22} /><strong>Nenhum guia encontrado</strong><p>Tente outra palavra ou selecione outra categoria.</p></div>}

      <div className="community-rural-section-title"><div><small>NA SUA REGIÃO</small><h3>Informações recentes</h3></div><button onClick={onOpenNotices}>Ver todas</button></div>
      {regionalPosts.length ? <div className="community-service-news">{regionalPosts.map((post) => <button className="community-service-news-card" key={post.id} onClick={onOpenNotices}><span className="community-service-news-icon"><Bell size={16} /></span><span><small>{postCategory(post)} · {post.author}</small><strong>{cleanPostText(post) || "Informação comunitária"}</strong><p>{[post.municipality, post.state].filter(Boolean).join("/") || "Região informada"} · {new Date(post.date).toLocaleDateString("pt-BR")}</p></span><ChevronRight size={16} /></button>)}</div> : <div className="community-rural-empty compact"><Bell size={21} /><strong>Ainda não há informações desse tipo na região</strong><p>Você pode publicar um curso, evento, reunião ou oportunidade com origem identificada.</p><button className="community-rural-secondary" onClick={() => onCreateNotice("Outro")}>Publicar informação</button></div>}

      <div className="community-rural-section-title"><div><small>ATALHOS ÚTEIS</small><h3>Resolver outras necessidades</h3></div></div>
      <div className="community-service-shortcuts">
        <button onClick={onOpenWater}><span className="blue"><Droplets size={18} /></span><div><strong>Problema de água</strong><small>Falta, vazamento ou abastecimento</small></div><ChevronRight size={16} /></button>
        <button onClick={onOpenAnimals}><span><Cow size={18} /></span><div><strong>Animal encontrado</strong><small>Identificação e registro seguro</small></div><ChevronRight size={16} /></button>
        <button onClick={onOpenOccurrences}><span className="orange"><MapPin size={18} /></span><div><strong>Estrada ou acesso</strong><small>Registrar ocorrência rural</small></div><ChevronRight size={16} /></button>
      </div>

      <div className="community-service-trust">
        <span><ShieldCheck size={18} /></span>
        <div><strong>Informação com origem clara</strong><p>Guias do Hydra são orientativos. Avisos da comunidade mostram autor e região. Nenhuma entidade é tratada como parceira oficial sem autorização e configuração específica.</p></div>
      </div>

      <Modal open={Boolean(selected)} onClose={() => setSelected(null)} eyebrow={selected?.category.toUpperCase() || "GUIA RURAL"} title={selected?.title || "Informação"}>
        {selected && <div className="community-service-detail">
          <div className={`community-service-detail-head ${selected.tone}`}><span><selected.icon size={22} /></span><div><small>GUIA INFORMATIVO</small><strong>{selected.subtitle}</strong></div></div>
          <section><h4><Info size={16} /> Quando faz sentido usar</h4>{selected.when.map((item) => <p key={item}>{item}</p>)}</section>
          <section><h4><ClipboardCheck size={16} /> O que preparar</h4>{selected.prepare.map((item) => <p key={item}>{item}</p>)}</section>
          <section><h4><ShieldCheck size={16} /> Como verificar a informação</h4>{selected.verify.map((item) => <p key={item}>{item}</p>)}</section>
          <div className="community-service-detail-note"><BadgeCheck size={17} /><span>Este conteúdo é um guia de organização do Hydra Agro. Ele não representa atendimento, recomendação profissional individual nem comunicação oficial de órgão público.</span></div>
          <div className="community-rural-actions"><button className="community-rural-primary" onClick={() => { setSelected(null); onCreateNotice(selected.noticeKind); }}><Megaphone size={16} /> Publicar sobre isso</button><button className="community-rural-secondary" onClick={() => setSelected(null)}>Fechar</button></div>
        </div>}
      </Modal>
    </div>
  );
}
