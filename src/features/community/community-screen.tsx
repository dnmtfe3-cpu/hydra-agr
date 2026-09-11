import "../../community-polish.css";
import "./community-rural.css";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  Bell,
  Beef as Cow,
  Camera,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Droplets,
  FileText,
  Heart,
  ImagePlus,
  Info,
  LoaderCircle,
  Map as MapIcon,
  MapPin,
  MessageCircle,
  RefreshCw,
  Search,
  Send,
  Share2,
  Shield,
  Trash2,
  UsersRound,
  WifiOff,
  Wrench,
} from "lucide-react";
import { ConfirmDialog, EmptyState, Field, LoadingButton, Modal, ScreenHeader } from "../../components/ui";
import { showAppToast } from "../../components/modal-system";
import type { AuthResult, CommunityPost, HydraAccount } from "../../lib/hydra-types";
import { publicMediaUrl, requireSupabase } from "../../services/supabase";
import {
  confirmRuralOccurrence,
  createRuralOccurrence,
  findSimilarOccurrence,
  listRuralOccurrences,
  ruralOccurrenceShareText,
  syncPendingRuralOccurrences,
  updateRuralOccurrenceStatus,
  type CreateRuralOccurrenceInput,
  type RuralOccurrence,
  type RuralOccurrenceCategory,
} from "./community-rural-service";

type Props = {
  account: HydraAccount;
  onBack: () => void;
  publishPost: (text: string, file?: File) => Promise<AuthResult>;
  likePost: (post: CommunityPost) => Promise<void>;
  commentPost: (postId: string, text: string) => Promise<AuthResult>;
  deletePost: (postId: string) => Promise<AuthResult>;
  refreshCommunity: () => Promise<AuthResult>;
  createRequest?: number;
  onRequestHandled?: () => void;
};

type CommunityView = "hub" | "water" | "occurrences" | "mine" | "my-community" | "notices" | "services" | "animals" | "map";
type FeedFilter = "all" | "region" | "mine";
type AnimalAction = "found" | "missing";

type Draft = {
  category: RuralOccurrenceCategory;
  subtype: string;
  community: string;
  region: string;
  description: string;
  duration: string;
  affected: boolean;
  ongoing: boolean;
  impact: string;
  latitude?: number;
  longitude?: number;
};

const waterKinds = ["Falta de água", "Vazamento", "Cano rompido", "Baixa pressão", "Abastecimento irregular", "Ponto de água com problema", "Outro"];
const ruralKinds: { category: RuralOccurrenceCategory; label: string }[] = [
  { category: "road", label: "Estrada" },
  { category: "bridge", label: "Ponte" },
  { category: "culvert", label: "Bueiro" },
  { category: "access", label: "Acesso rural" },
  { category: "animal_road", label: "Animal na pista" },
  { category: "fence", label: "Cerca danificada" },
  { category: "structure", label: "Estrutura comunitária" },
  { category: "road_risk", label: "Risco na estrada" },
  { category: "other", label: "Outro" },
];
const noticeKinds = ["Água", "Estrada", "Animais", "Reunião", "Curso", "Evento", "Produção", "Oportunidade", "Outro"];

function categoryLabel(category: RuralOccurrenceCategory) {
  if (category === "water") return "Água";
  if (category === "animal_found") return "Animal encontrado";
  if (category === "animal_missing") return "Animal desaparecido";
  return ruralKinds.find((item) => item.category === category)?.label || "Ocorrência rural";
}

function occurrenceIcon(item: RuralOccurrence) {
  if (item.category === "water") return <Droplets size={18} />;
  if (item.category === "animal_found" || item.category === "animal_missing" || item.category === "animal_road") return <Cow size={18} />;
  return <AlertTriangle size={18} />;
}

function initialCommunity(account: HydraAccount) {
  return account.property.region || account.property.district || account.property.municipality || "";
}

function newDraft(account: HydraAccount, category: RuralOccurrenceCategory = "water", subtype = "Falta de água"): Draft {
  return {
    category,
    subtype,
    community: initialCommunity(account),
    region: account.property.municipality || "",
    description: "",
    duration: "Hoje",
    affected: false,
    ongoing: category === "water" && ["Vazamento", "Cano rompido"].includes(subtype),
    impact: "",
  };
}

function relativeUpdate(date: string) {
  const diffMinutes = Math.max(0, Math.round((Date.now() - new Date(date).getTime()) / 60000));
  if (diffMinutes < 1) return "agora";
  if (diffMinutes < 60) return `há ${diffMinutes} min`;
  const hours = Math.round(diffMinutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.round(hours / 24);
  return `há ${days} d`;
}

function priorityFor(draft: Draft) {
  if (draft.category !== "water") return draft.category === "road_risk" || draft.category === "animal_road" ? "Atenção" as const : "Normal" as const;
  if (draft.subtype === "Cano rompido" && (draft.ongoing || draft.impact === "Grande perda de água")) return "Alta atenção" as const;
  if (["Cano rompido", "Vazamento"].includes(draft.subtype) || ["2 a 3 dias", "Mais de 3 dias"].includes(draft.duration)) return "Atenção" as const;
  return "Normal" as const;
}

export function CommunityScreen({ account, onBack, publishPost, likePost, commentPost, deletePost, refreshCommunity, createRequest, onRequestHandled }: Props) {
  const [view, setView] = useState<CommunityView>("hub");
  const [animalAction, setAnimalAction] = useState<AnimalAction>("found");
  const [occurrences, setOccurrences] = useState<RuralOccurrence[]>([]);
  const [occurrencesBusy, setOccurrencesBusy] = useState(true);
  const [occurrenceModalOpen, setOccurrenceModalOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => newDraft(account));
  const [draftPhoto, setDraftPhoto] = useState<File>();
  const [draftPreview, setDraftPreview] = useState<string>();
  const [draftBusy, setDraftBusy] = useState(false);
  const [draftError, setDraftError] = useState("");
  const [locationStatus, setLocationStatus] = useState("");
  const [similar, setSimilar] = useState<RuralOccurrence | null>(null);
  const [selectedOccurrence, setSelectedOccurrence] = useState<RuralOccurrence | null>(null);
  const occurrencePhotoRef = useRef<HTMLInputElement>(null);

  const [animalLookupCode, setAnimalLookupCode] = useState("");
  const [animalLookupBusy, setAnimalLookupBusy] = useState(false);
  const [animalLookupError, setAnimalLookupError] = useState("");
  const [animalLookup, setAnimalLookup] = useState<{ identification: string; name?: string; species: string; breed?: string; municipality?: string; state?: string; photoPath?: string } | null>(null);
  const [missingAnimalId, setMissingAnimalId] = useState(account.animals[0]?.id || "");

  const [composerOpen, setComposerOpen] = useState(false);
  const [publishConfirmOpen, setPublishConfirmOpen] = useState(false);
  const [publishError, setPublishError] = useState("");
  const [noticeKind, setNoticeKind] = useState("Outro");
  const [text, setText] = useState("");
  const [imageFile, setImageFile] = useState<File>();
  const [imagePreview, setImagePreview] = useState<string>();
  const [comments, setComments] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<FeedFilter>("all");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<CommunityPost | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function loadOccurrences(sync = false) {
    setOccurrencesBusy(true);
    try {
      if (sync) await syncPendingRuralOccurrences(account);
      setOccurrences(await listRuralOccurrences(account));
    } finally {
      setOccurrencesBusy(false);
    }
  }

  useEffect(() => {
    void loadOccurrences(true);
    const online = () => void loadOccurrences(true);
    window.addEventListener("online", online);
    return () => window.removeEventListener("online", online);
  }, [account.id]);

  useEffect(() => {
    if (createRequest !== undefined) {
      setView("notices");
      setComposerOpen(true);
      onRequestHandled?.();
    }
  }, [createRequest, onRequestHandled]);

  useEffect(() => () => {
    if (draftPreview) URL.revokeObjectURL(draftPreview);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
  }, [draftPreview, imagePreview]);

  const activeOccurrences = useMemo(() => occurrences.filter((item) => !["Resolvido", "Recuperado"].includes(item.status)), [occurrences]);
  const animalOccurrences = useMemo(() => activeOccurrences.filter((item) => item.category === "animal_found" || item.category === "animal_missing"), [activeOccurrences]);
  const waterOccurrences = useMemo(() => activeOccurrences.filter((item) => item.category === "water"), [activeOccurrences]);
  const waterRegions = useMemo(() => new Set(waterOccurrences.map((item) => item.community || item.region).filter(Boolean)).size, [waterOccurrences]);
  const mine = useMemo(() => occurrences.filter((item) => item.mine), [occurrences]);
  const myCommunityName = initialCommunity(account);
  const myCommunityItems = useMemo(() => occurrences.filter((item) => !myCommunityName || item.community.toLocaleLowerCase("pt-BR") === myCommunityName.toLocaleLowerCase("pt-BR") || item.municipality === account.property.municipality), [occurrences, myCommunityName, account.property.municipality]);

  const filteredPosts = useMemo(() => account.posts.filter((post) => {
    if (filter === "mine") return post.authorId === account.id;
    if (filter === "region") {
      return Boolean(account.property.municipality && account.property.state)
        && post.municipality === account.property.municipality
        && post.state === account.property.state;
    }
    return true;
  }), [account.id, account.posts, account.property.municipality, account.property.state, filter]);

  function goCommunityBack() {
    if (view === "hub") onBack();
    else setView("hub");
  }

  function openOccurrence(category: RuralOccurrenceCategory, subtype: string) {
    setDraft(newDraft(account, category, subtype));
    setDraftError("");
    setSimilar(null);
    setLocationStatus("");
    setDraftPhoto(undefined);
    if (draftPreview) URL.revokeObjectURL(draftPreview);
    setDraftPreview(undefined);
    setOccurrenceModalOpen(true);
  }

  function chooseOccurrencePhoto(file?: File) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setDraftError("Use uma imagem JPG, PNG ou WebP.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setDraftError("A foto deve ter no máximo 10 MB.");
      return;
    }
    if (draftPreview) URL.revokeObjectURL(draftPreview);
    setDraftPhoto(file);
    setDraftPreview(URL.createObjectURL(file));
    setDraftError("");
  }

  function requestApproximateLocation() {
    if (!navigator.geolocation) {
      setLocationStatus("Localização não disponível neste aparelho.");
      return;
    }
    setLocationStatus("Obtendo localização…");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setDraft((current) => ({ ...current, latitude: position.coords.latitude, longitude: position.coords.longitude }));
        setLocationStatus("Localização aproximada pronta. A posição publicada será reduzida em precisão.");
      },
      () => setLocationStatus("Não foi possível obter a localização. Você pode continuar sem ela."),
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 },
    );
  }

  async function saveOccurrence(force = false) {
    if (!draft.subtype.trim() || !draft.community.trim()) {
      setDraftError("Informe o tipo do problema e a comunidade/região.");
      return;
    }

    if (!force) {
      const match = findSimilarOccurrence(occurrences, draft);
      if (match) {
        setSimilar(match);
        return;
      }
    }

    setDraftBusy(true);
    setDraftError("");
    const extra = [
      draft.duration && draft.category === "water" && draft.subtype === "Falta de água" ? `Tempo sem abastecimento: ${draft.duration}.` : "",
      draft.affected ? "Outras pessoas também foram informadas como afetadas." : "",
      draft.impact ? `Impacto informado: ${draft.impact}.` : "",
    ].filter(Boolean).join(" ");

    const input: CreateRuralOccurrenceInput = {
      category: draft.category,
      subtype: draft.subtype,
      community: draft.community,
      region: draft.region,
      description: [draft.description.trim(), extra].filter(Boolean).join(" ").slice(0, 600),
      latitude: draft.latitude,
      longitude: draft.longitude,
      priority: priorityFor(draft),
      affectedCount: draft.affected ? 2 : 1,
      ongoing: draft.ongoing,
      publicVisible: true,
    };

    try {
      const created = await createRuralOccurrence(account, input, draftPhoto);
      setOccurrenceModalOpen(false);
      setSimilar(null);
      showAppToast(created.syncState === "Sincronizado" ? "Ocorrência registrada" : "Ocorrência salva e pendente de sincronização");
      await loadOccurrences(false);
    } catch (error) {
      setDraftError(error instanceof Error ? error.message : "Não foi possível registrar agora.");
    } finally {
      setDraftBusy(false);
    }
  }

  async function confirmExisting(item: RuralOccurrence) {
    try {
      await confirmRuralOccurrence(item, account.id);
      showAppToast(item.category === "water" && item.subtype === "Falta de água" ? "Seu relato foi somado" : "Confirmação registrada");
      setSimilar(null);
      setOccurrenceModalOpen(false);
      await loadOccurrences(false);
    } catch (error) {
      setDraftError(error instanceof Error ? error.message : "Não foi possível confirmar agora.");
    }
  }

  async function shareOccurrence(item: RuralOccurrence) {
    const shareText = ruralOccurrenceShareText(item);
    try {
      if (navigator.share) await navigator.share({ title: item.protocol, text: shareText });
      else {
        await navigator.clipboard.writeText(shareText);
        showAppToast("Resumo copiado");
      }
    } catch {
      // O usuário pode cancelar o compartilhamento sem alterar a ocorrência.
    }
  }

  async function markResolved(item: RuralOccurrence) {
    const next = item.category === "animal_found" || item.category === "animal_missing" ? "Recuperado" as const : "Resolvido" as const;
    try {
      await updateRuralOccurrenceStatus(item, next);
      setSelectedOccurrence(null);
      showAppToast("Ocorrência movida para o histórico");
      await loadOccurrences(true);
    } catch {
      showAppToast("Não foi possível atualizar o status agora");
    }
  }

  async function lookupHydraId(event: FormEvent) {
    event.preventDefault();
    const code = animalLookupCode.trim().slice(0, 40);
    if (!code) return;
    setAnimalLookupBusy(true);
    setAnimalLookupError("");
    setAnimalLookup(null);
    try {
      const { data, error } = await requireSupabase().rpc("public_animal_by_hydra_code", { p_code: code });
      if (error || !data || typeof data !== "object") {
        setAnimalLookupError("Hydra ID não encontrado. Confira o código sem se aproximar do animal.");
        return;
      }
      const record = data as Record<string, unknown>;
      setAnimalLookup({
        identification: String(record.identification || code),
        name: typeof record.name === "string" ? record.name : undefined,
        species: String(record.species || "Animal"),
        breed: typeof record.breed === "string" ? record.breed : undefined,
        municipality: typeof record.municipality === "string" ? record.municipality : undefined,
        state: typeof record.state === "string" ? record.state : undefined,
        photoPath: typeof record.photoPath === "string" ? record.photoPath : typeof record.photo_path === "string" ? record.photo_path : undefined,
      });
    } catch {
      setAnimalLookupError("Não foi possível consultar a Hydra Tag agora.");
    } finally {
      setAnimalLookupBusy(false);
    }
  }

  function openMissingRegisteredAnimal() {
    const animal = account.animals.find((item) => item.id === missingAnimalId);
    if (!animal) {
      openOccurrence("animal_missing", "Animal não cadastrado");
      return;
    }
    setDraft({
      ...newDraft(account, "animal_missing", `${animal.species} · ${animal.identification}`),
      description: [animal.name, animal.breed, animal.sex].filter(Boolean).join(" · "),
    });
    setDraftError("");
    setSimilar(null);
    setOccurrenceModalOpen(true);
  }

  function chooseImage(file?: File) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setMessage("Essa imagem é grande demais. Escolha uma de até 10 MB.");
      return;
    }
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setMessage("");
  }

  function clearImage() {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(undefined);
    setImagePreview(undefined);
    if (fileRef.current) fileRef.current.value = "";
  }

  function requestPublish(event: FormEvent) {
    event.preventDefault();
    if (!text.trim() && !imageFile) return;
    setPublishError("");
    setPublishConfirmOpen(true);
  }

  async function confirmPublish() {
    if (busy === "publish") return;
    setBusy("publish");
    setPublishError("");
    const prefix = noticeKind ? `[${noticeKind}] ` : "";
    const result = await publishPost(`${prefix}${text}`.trim(), imageFile);
    setBusy("");
    if (result.ok) {
      setPublishConfirmOpen(false);
      setText("");
      clearImage();
      setComposerOpen(false);
      setMessage("");
      showAppToast("Aviso publicado");
      return;
    }
    setPublishError(result.message);
  }

  async function addComment(postId: string) {
    const value = comments[postId]?.trim();
    if (!value) return;
    setBusy(`comment-${postId}`);
    const result = await commentPost(postId, value);
    setBusy("");
    setMessage(result.message);
    if (result.ok) setComments((current) => ({ ...current, [postId]: "" }));
  }

  async function remove(postId: string) {
    setBusy(`delete-${postId}`);
    const result = await deletePost(postId);
    setBusy("");
    if (result.ok) {
      setDeleteTarget(null);
      showAppToast("Publicação removida");
    } else setDeleteError(result.message);
  }

  async function refresh() {
    setBusy("refresh");
    const result = await refreshCommunity();
    setBusy("");
    setMessage(result.message);
  }

  function renderOccurrenceList(items: RuralOccurrence[]) {
    if (occurrencesBusy) return <div className="community-rural-empty"><LoaderCircle size={22} className="spin" /><strong>Carregando ocorrências</strong></div>;
    if (!items.length) return <div className="community-rural-empty"><strong>Nenhuma ocorrência por aqui</strong><p>Os registros autorizados aparecem aqui sem expor endereço ou localização interna de propriedades.</p></div>;
    return (
      <div className="community-occurrence-list">
        {items.map((item) => (
          <button className="community-occurrence-card" key={item.id} onClick={() => setSelectedOccurrence(item)}>
            <span className={`community-occurrence-icon ${item.category === "water" ? "water" : item.priority !== "Normal" ? "attention" : ""}`}>{occurrenceIcon(item)}</span>
            <span className="community-occurrence-copy">
              <small>{categoryLabel(item.category)} · {relativeUpdate(item.updatedAt)}</small>
              <strong>{item.subtype}</strong>
              <p>{item.community || item.region || item.municipality || "Região aproximada"}</p>
              <span className="community-occurrence-meta">
                <span>{item.status}</span>
                <span>{item.reportCount} relato{item.reportCount === 1 ? "" : "s"}</span>
                {item.syncState !== "Sincronizado" && <span className="pending">{item.syncState}</span>}
              </span>
            </span>
            <ChevronRight className="community-occurrence-arrow" size={17} />
          </button>
        ))}
      </div>
    );
  }

  function renderHub() {
    return (
      <div className="community-rural-body">
        <section className="community-rural-hero">
          <div><small>HYDRA COMUNIDADE</small><h2>Problemas reais do campo, organizados.</h2><p>Registre, confirme e acompanhe informações da região sem expor dados privados da fazenda.</p></div>
          <span className="community-rural-hero-icon"><UsersRound size={24} /></span>
        </section>

        <div className="community-rural-grid">
          <button className="community-rural-card" onClick={() => { setAnimalAction("found"); setView("animals"); }}><span className="community-rural-card-icon"><Cow size={19} /></span><div><strong>Animal encontrado</strong><p>Identificar ou registrar</p></div></button>
          <button className="community-rural-card warning" onClick={() => { setAnimalAction("missing"); setView("animals"); }}><span className="community-rural-card-icon"><Search size={19} /></span><div><strong>Animal desaparecido</strong><p>Publicar busca autorizada</p></div></button>
          <button className="community-rural-card water" onClick={() => setView("water")}><span className="community-rural-card-icon"><Droplets size={19} /></span><div><strong>Hydra Água</strong><p>Abastecimento e vazamentos</p></div></button>
          <button className="community-rural-card warning" onClick={() => setView("occurrences")}><span className="community-rural-card-icon"><AlertTriangle size={19} /></span><div><strong>Ocorrências</strong><p>Estrada, ponte e acesso</p></div></button>
          <button className="community-rural-card" onClick={() => setView("map")}><span className="community-rural-card-icon"><MapIcon size={19} /></span><div><strong>Mapa rural</strong><p>Pontos aproximados</p></div></button>
          <button className="community-rural-card" onClick={() => setView("my-community")}><span className="community-rural-card-icon"><MapPin size={19} /></span><div><strong>Minha comunidade</strong><p>{myCommunityName || "Definir região"}</p></div></button>
          <button className="community-rural-card" onClick={() => setView("notices")}><span className="community-rural-card-icon"><Bell size={19} /></span><div><strong>Avisos</strong><p>Informações curtas</p></div></button>
          <button className="community-rural-card" onClick={() => setView("mine")}><span className="community-rural-card-icon"><ClipboardList size={19} /></span><div><strong>Minhas ocorrências</strong><p>Abertas e histórico</p></div></button>
        </div>

        <div className="community-rural-indicators">
          <div className="community-rural-indicator"><strong>{activeOccurrences.length}</strong><span>relatos ativos</span></div>
          <div className="community-rural-indicator"><strong>{animalOccurrences.length}</strong><span>animais em busca</span></div>
          <div className="community-rural-indicator"><strong>{waterRegions}</strong><span>regiões com água</span></div>
        </div>

        <button className="community-rural-card" style={{ minHeight: 74 }} onClick={() => setView("services")}><span className="community-rural-card-icon"><Info size={19} /></span><div><strong>Serviços e informações</strong><p>Cursos, assistência, feiras e oportunidades</p></div></button>

        <div className="community-rural-note"><Shield size={17} /><span>O Hydra Agro organiza relatos da comunidade. Protocolos gerados aqui são internos e não representam protocolo oficial de Prefeitura, companhia de água ou outro órgão.</span></div>
        {!navigator.onLine && <div className="community-rural-note warning"><WifiOff size={17} /><span>Sem internet. Novas ocorrências ficam salvas no aparelho e entram na fila de sincronização.</span></div>}
      </div>
    );
  }

  function renderWater() {
    return (
      <div className="community-rural-body">
        <section className="community-rural-hero"><div><small>HYDRA ÁGUA</small><h2>Água da comunidade</h2><p>Esta área é separada da gestão privada de água da sua propriedade.</p></div><span className="community-rural-hero-icon" style={{ background: "#2f7fa4" }}><Droplets size={24} /></span></section>
        <div className="community-rural-grid">
          {waterKinds.map((kind) => <button key={kind} className={`community-rural-card ${kind === "Cano rompido" ? "warning" : "water"}`} onClick={() => openOccurrence("water", kind)}><span className="community-rural-card-icon">{kind === "Vazamento" || kind === "Cano rompido" ? <Wrench size={18} /> : <Droplets size={18} />}</span><div><strong>{kind}</strong><p>Registrar problema</p></div></button>)}
        </div>
        <div className="community-rural-section-title"><div><small>RELATOS DA REGIÃO</small><h3>Ocorrências de água</h3></div><button onClick={() => void loadOccurrences(true)}>Atualizar</button></div>
        {renderOccurrenceList(occurrences.filter((item) => item.category === "water"))}
      </div>
    );
  }

  function renderRuralOccurrences() {
    return (
      <div className="community-rural-body">
        <section className="community-rural-hero"><div><small>OCORRÊNCIAS RURAIS</small><h2>Registrar ocorrência</h2><p>Categoria, região, localização aproximada e foto opcional. Poucos passos.</p></div><span className="community-rural-hero-icon" style={{ background: "#d9772a" }}><AlertTriangle size={24} /></span></section>
        <div className="community-rural-grid">{ruralKinds.map((item) => <button key={item.category} className="community-rural-card warning" onClick={() => openOccurrence(item.category, item.label)}><span className="community-rural-card-icon"><AlertTriangle size={18} /></span><div><strong>{item.label}</strong><p>Registrar</p></div></button>)}</div>
        <div className="community-rural-section-title"><div><small>COMUNIDADE</small><h3>Relatos recentes</h3></div><button onClick={() => void loadOccurrences(true)}>Atualizar</button></div>
        {renderOccurrenceList(occurrences.filter((item) => item.category !== "water" && !item.category.startsWith("animal_")))}
      </div>
    );
  }

  function renderAnimals() {
    if (animalAction === "missing") {
      return (
        <div className="community-rural-body">
          <section className="community-rural-hero"><div><small>ANIMAIS</small><h2>Meu animal desapareceu</h2><p>Use um animal já cadastrado ou faça um registro básico. O endereço da propriedade nunca é publicado.</p></div><span className="community-rural-hero-icon"><Search size={24} /></span></section>
          {account.animals.length > 0 && <Field label="Animal cadastrado"><select value={missingAnimalId} onChange={(event) => setMissingAnimalId(event.target.value)}>{account.animals.map((animal) => <option key={animal.id} value={animal.id}>{animal.identification} · {animal.name || animal.species}</option>)}</select></Field>}
          <div className="community-rural-actions"><button className="community-rural-primary" onClick={openMissingRegisteredAnimal}>{account.animals.length ? "Usar animal cadastrado" : "Registrar animal desaparecido"}</button>{account.animals.length > 0 && <button className="community-rural-secondary" onClick={() => openOccurrence("animal_missing", "Animal não cadastrado")}>Não está cadastrado</button>}</div>
          <div className="community-rural-note"><Shield size={17} /><span>Possíveis correspondências são apenas sugestões. O Hydra Agro não afirma automaticamente que dois registros são do mesmo animal.</span></div>
          <div className="community-rural-section-title"><div><small>NA REGIÃO</small><h3>Animais procurando responsável</h3></div></div>
          {renderOccurrenceList(occurrences.filter((item) => item.category === "animal_missing"))}
        </div>
      );
    }

    return (
      <div className="community-rural-body">
        <section className="community-rural-hero"><div><small>ANIMAIS</small><h2>Encontrei um animal</h2><p>Tente Hydra ID primeiro. Se não houver identificação, registre visualmente sem se aproximar.</p></div><span className="community-rural-hero-icon"><Cow size={24} /></span></section>
        <div className="community-rural-note warning"><AlertTriangle size={17} /><span><strong>Não se aproxime se não for seguro.</strong> Animal agressivo, assustado, com cria, na estrada ou difícil de alcançar deve ser observado à distância.</span></div>
        <form className="community-rural-form" onSubmit={lookupHydraId}>
          <Field label="Hydra ID ou código do brinco"><input value={animalLookupCode} onChange={(event) => { setAnimalLookupCode(event.target.value.toUpperCase()); setAnimalLookupError(""); }} placeholder="Ex.: HYDRA-8F2K" maxLength={40} /></Field>
          <button className="community-rural-primary" type="submit" disabled={animalLookupBusy}>{animalLookupBusy ? <LoaderCircle size={17} className="spin" /> : <Search size={17} />} Consultar identificação</button>
          {animalLookupError && <p className="form-error" role="alert">{animalLookupError}</p>}
        </form>
        {animalLookup && <div className="community-occurrence-detail-head"><small>ANIMAL IDENTIFICADO</small><h3>{animalLookup.name || animalLookup.identification}</h3><p>{animalLookup.species}{animalLookup.breed ? ` · ${animalLookup.breed}` : ""}{animalLookup.municipality ? ` · ${animalLookup.municipality}${animalLookup.state ? `/${animalLookup.state}` : ""}` : ""}</p>{animalLookup.photoPath && <img className="community-occurrence-photo" style={{ marginTop: 10 }} src={publicMediaUrl("community-media", animalLookup.photoPath)} alt="Animal identificado" />}<div className="community-rural-actions" style={{ marginTop: 10 }}><button className="community-rural-primary" onClick={() => window.location.assign(`/tag/${encodeURIComponent(animalLookup.identification)}`)}>Abrir ficha segura</button><button className="community-rural-secondary" onClick={() => openOccurrence("animal_found", `Animal identificado · ${animalLookup.identification}`)}>Informar onde foi encontrado</button></div></div>}
        <div className="community-rural-grid">
          <button className="community-rural-card" onClick={() => openOccurrence("animal_found", "Animal sem identificação")}><span className="community-rural-card-icon"><Camera size={18} /></span><div><strong>Animal sem identificação</strong><p>Foto e características</p></div></button>
          <div className="community-rural-card"><span className="community-rural-card-icon"><FileText size={18} /></span><div><strong>QR sujo ou danificado?</strong><p>Use NFC, Hydra ID, código manual ou identificação visual. O leitor NFC/QR continua disponível na barra do app.</p></div></div>
        </div>
        <div className="community-rural-section-title"><div><small>NA REGIÃO</small><h3>Animais encontrados</h3></div></div>
        {renderOccurrenceList(occurrences.filter((item) => item.category === "animal_found"))}
      </div>
    );
  }

  function renderMine() {
    return <div className="community-rural-body"><div className="community-rural-section-title"><div><small>HISTÓRICO ÚNICO</small><h3>Minhas ocorrências</h3></div><button onClick={() => void loadOccurrences(true)}>Sincronizar</button></div><div className="community-rural-chips"><button className="community-rural-chip active">Todas</button><button className="community-rural-chip" onClick={() => setView("water")}>Água</button><button className="community-rural-chip" onClick={() => { setAnimalAction("found"); setView("animals"); }}>Animais</button><button className="community-rural-chip" onClick={() => setView("occurrences")}>Estradas e outras</button></div>{renderOccurrenceList(mine)}</div>;
  }

  function renderMyCommunity() {
    const cutoff = Date.now() - 30 * 86400000;
    const recent = myCommunityItems.filter((item) => new Date(item.createdAt).getTime() >= cutoff);
    const waterCount = recent.filter((item) => item.category === "water" && item.subtype === "Falta de água").length;
    const leakCount = recent.filter((item) => item.category === "water" && ["Vazamento", "Cano rompido"].includes(item.subtype)).length;
    return <div className="community-rural-body"><section className="community-rural-hero"><div><small>MINHA COMUNIDADE</small><h2>{myCommunityName || account.property.municipality || "Sua região"}</h2><p>Resumo construído apenas com dados registrados no Hydra Agro.</p></div><span className="community-rural-hero-icon"><MapPin size={24} /></span></section>{(waterCount > 0 || leakCount > 0) && <div className="community-rural-note"><Info size={17} /><span>{waterCount > 0 ? `Esta região registrou ${waterCount} ocorrência${waterCount === 1 ? "" : "s"} de falta de água nos últimos 30 dias. ` : ""}{leakCount > 0 ? `${leakCount} relato${leakCount === 1 ? "" : "s"} recente${leakCount === 1 ? "" : "s"} de vazamento.` : ""}</span></div>}{renderOccurrenceList(myCommunityItems)}</div>;
  }

  function renderMap() {
    const mapped = occurrences.filter((item) => item.latitude !== undefined && item.longitude !== undefined);
    return <div className="community-rural-body"><section className="community-rural-hero"><div><small>MAPA RURAL</small><h2>Pontos comunitários aproximados</h2><p>O Hydra Comunidade não publica posição exata de residência nem localização interna de propriedade.</p></div><span className="community-rural-hero-icon"><MapIcon size={24} /></span></section><div className="community-rural-note"><Shield size={17} /><span>As coordenadas comunitárias são reduzidas em precisão antes de serem registradas. Este módulo reaproveita a mesma lógica de localização do Hydra Agro e não cria rastreamento ao vivo.</span></div>{mapped.length ? renderOccurrenceList(mapped) : <div className="community-rural-empty"><MapPin size={22} /><strong>Nenhum ponto comunitário ainda</strong><p>Quando uma ocorrência for registrada com localização autorizada, ela aparecerá aqui de forma aproximada.</p></div>}</div>;
  }

  function renderServices() {
    return <div className="community-rural-body"><section className="community-rural-hero"><div><small>SERVIÇOS E INFORMAÇÕES</small><h2>Referências úteis do campo</h2><p>Espaço preparado para informações identificadas, sem parceria oficial presumida.</p></div><span className="community-rural-hero-icon"><Info size={24} /></span></section><div className="community-rural-services">{[["Assistência técnica", Wrench], ["Cursos e capacitações", FileText], ["Feiras e eventos", Bell], ["Vacinação e manejo", Cow], ["Associações e cooperativas", UsersRound], ["Oportunidades", ClipboardList]].map(([label, Icon]) => { const RowIcon = Icon as typeof Info; return <div className="community-rural-service-row" key={String(label)}><span><RowIcon size={18} /></span><div><strong>{String(label)}</strong><small>Cadastros identificados poderão aparecer aqui</small></div></div>; })}</div><div className="community-rural-note"><Info size={17} /><span>As informações podem ser cadastradas pela comunidade ou por fontes parceiras identificadas. Nenhuma entidade recebe selo ou acesso especial sem configuração e autorização.</span></div></div>;
  }

  function renderNotices() {
    return <div className="community-rural-body"><div className="community-rural-section-title"><div><small>AVISOS COMUNITÁRIOS</small><h3>Informações curtas</h3></div><div className="community-rural-actions"><button onClick={() => void refresh()} aria-label="Atualizar avisos">{busy === "refresh" ? <LoaderCircle size={17} className="spin" /> : <RefreshCw size={17} />}</button><button className="community-rural-primary" onClick={() => setComposerOpen(true)}>Novo aviso</button></div></div><div className="community-rural-chips"><button className={`community-rural-chip ${filter === "all" ? "active" : ""}`} onClick={() => setFilter("all")}>Todos</button><button className={`community-rural-chip ${filter === "region" ? "active" : ""}`} onClick={() => setFilter("region")}>Minha região</button><button className={`community-rural-chip ${filter === "mine" ? "active" : ""}`} onClick={() => setFilter("mine")}>Meus avisos</button></div>{message && <div className="community-message" role="status">{message}</div>}{filteredPosts.length === 0 ? <EmptyState icon={<Bell size={27} />} title="Nenhum aviso neste filtro" text="Publique somente informações úteis e curtas para a comunidade." action={<button className="primary-button" onClick={() => setComposerOpen(true)}>Criar aviso</button>} /> : <div className="post-list">{filteredPosts.map((post) => <article className="post-card" key={post.id}><header>{post.authorAvatarUrl ? <img src={post.authorAvatarUrl} alt={`Foto de ${post.author}`} /> : <span>{post.author.charAt(0).toUpperCase()}</span>}<div><strong>{post.author}</strong><small>{[post.municipality, post.state].filter(Boolean).join("/") || new Date(post.date).toLocaleDateString("pt-BR")}</small></div>{post.authorId === account.id && <button className="post-delete" onClick={() => { setDeleteError(""); setDeleteTarget(post); }} aria-label="Excluir aviso">{busy === `delete-${post.id}` ? <LoaderCircle size={17} className="spin" /> : <Trash2 size={17} />}</button>}</header>{post.text && <p>{post.text}</p>}{post.image && <img className="post-image" src={post.image} alt="Imagem do aviso" />}<div className="post-actions"><button className={post.liked ? "liked" : ""} onClick={() => void likePost(post)}><Heart size={18} fill={post.liked ? "currentColor" : "none"} /> {post.likes || "Útil"}</button><span><MessageCircle size={18} /> {post.comments.length || "Responder"}</span><time>{new Date(post.date).toLocaleDateString("pt-BR")}</time></div>{post.comments.length > 0 && <div className="comment-list">{post.comments.map((comment) => <p key={comment.id}><strong>{comment.author.split(" ")[0]}</strong> {comment.text}</p>)}</div>}<div className="comment-form"><input value={comments[post.id] || ""} onChange={(event) => setComments({ ...comments, [post.id]: event.target.value })} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void addComment(post.id); } }} placeholder="Resposta curta" /><button onClick={() => void addComment(post.id)} aria-label="Enviar resposta">{busy === `comment-${post.id}` ? <LoaderCircle size={17} className="spin" /> : <Send size={17} />}</button></div></article>)}</div>}</div>;
  }

  const titles: Record<CommunityView, { title: string; subtitle: string }> = {
    hub: { title: "Hydra Comunidade", subtitle: "Informações úteis da região rural." },
    water: { title: "Hydra Água", subtitle: "Relatos comunitários de abastecimento." },
    occurrences: { title: "Ocorrências rurais", subtitle: "Problemas de estrada, acesso e estrutura." },
    mine: { title: "Minhas ocorrências", subtitle: "Registros, pendências e histórico." },
    "my-community": { title: "Minha comunidade", subtitle: "O que está acontecendo na sua região." },
    notices: { title: "Avisos", subtitle: "Informações curtas, sem virar feed social." },
    services: { title: "Serviços e informações", subtitle: "Referências rurais identificadas." },
    animals: { title: animalAction === "found" ? "Animal encontrado" : "Animal desaparecido", subtitle: "Identificação e recuperação com privacidade." },
    map: { title: "Mapa rural", subtitle: "Ocorrências com posição aproximada." },
  };

  return (
    <div className="screen page-enter extra-screen community-screen community-rural-screen">
      <ScreenHeader title={titles[view].title} subtitle={titles[view].subtitle} onBack={goCommunityBack} action={view !== "hub" ? <button className="icon-button" onClick={() => void loadOccurrences(true)} aria-label="Atualizar"><RefreshCw size={18} /></button> : undefined} />
      {view === "hub" && renderHub()}
      {view === "water" && renderWater()}
      {view === "occurrences" && renderRuralOccurrences()}
      {view === "animals" && renderAnimals()}
      {view === "mine" && renderMine()}
      {view === "my-community" && renderMyCommunity()}
      {view === "map" && renderMap()}
      {view === "services" && renderServices()}
      {view === "notices" && renderNotices()}

      <Modal open={occurrenceModalOpen} onClose={() => { if (!draftBusy) { setOccurrenceModalOpen(false); setSimilar(null); } }} eyebrow={draft.category === "water" ? "HYDRA ÁGUA" : draft.category.startsWith("animal") ? "HYDRA ANIMAL" : "HYDRA COMUNIDADE"} title={draft.subtype || "Registrar ocorrência"} dismissible={!draftBusy}>
        <form className="community-rural-form" onSubmit={(event) => { event.preventDefault(); void saveOccurrence(false); }}>
          {draft.category === "water" && <Field label="O que está acontecendo?"><select value={draft.subtype} onChange={(event) => setDraft((current) => ({ ...current, subtype: event.target.value, ongoing: ["Vazamento", "Cano rompido"].includes(event.target.value) }))}>{waterKinds.map((kind) => <option key={kind}>{kind}</option>)}</select></Field>}
          <Field label="Comunidade ou região"><input value={draft.community} onChange={(event) => setDraft((current) => ({ ...current, community: event.target.value }))} placeholder="Ex.: comunidade, povoado ou trecho" maxLength={80} /></Field>
          {draft.category === "water" && draft.subtype === "Falta de água" && <><Field label="Há quanto tempo está sem abastecimento?"><select value={draft.duration} onChange={(event) => setDraft((current) => ({ ...current, duration: event.target.value }))}>{["Menos de 6 horas", "Hoje", "1 dia", "2 a 3 dias", "Mais de 3 dias"].map((item) => <option key={item}>{item}</option>)}</select></Field><label className="toggle-line"><input type="checkbox" checked={draft.affected} onChange={(event) => setDraft((current) => ({ ...current, affected: event.target.checked }))} /><span>Outras pessoas também estão afetadas</span></label></>}
          {draft.category === "water" && ["Vazamento", "Cano rompido"].includes(draft.subtype) && <><label className="toggle-line"><input type="checkbox" checked={draft.ongoing} onChange={(event) => setDraft((current) => ({ ...current, ongoing: event.target.checked }))} /><span>Ainda está vazando / fluxo contínuo</span></label><Field label="Está causando"><select value={draft.impact} onChange={(event) => setDraft((current) => ({ ...current, impact: event.target.value }))}><option value="">Nenhum desses / não sei</option>{["Grande perda de água", "Alagamento", "Dificuldade de passagem", "Dano na estrada", "Próximo de residência", "Próximo de propriedade"].map((item) => <option key={item}>{item}</option>)}</select></Field></>}
          <Field label={draft.category.startsWith("animal") ? "Características e observação" : "Descrição curta"}><textarea value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} maxLength={600} placeholder={draft.category.startsWith("animal") ? "Espécie, cor, sexo aproximado, tamanho, marcas visuais…" : "Descreva somente o necessário…"} /></Field>
          <div className="community-rural-location"><p><strong>Localização aproximada</strong><br />{locationStatus || (draft.latitude !== undefined ? "Localização autorizada" : "Opcional. Nunca publicamos endereço exato.")}</p><button type="button" onClick={requestApproximateLocation}><MapPin size={15} /> Usar local</button></div>
          <input ref={occurrencePhotoRef} className="community-rural-photo-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => chooseOccurrencePhoto(event.target.files?.[0])} />
          {draftPreview ? <div className="community-rural-photo-preview"><img src={draftPreview} alt="Foto escolhida" /><button type="button" onClick={() => { URL.revokeObjectURL(draftPreview); setDraftPreview(undefined); setDraftPhoto(undefined); }}>Remover foto</button></div> : <button className="community-rural-secondary" type="button" onClick={() => occurrencePhotoRef.current?.click()}><ImagePlus size={17} /> Adicionar foto opcional</button>}
          {similar && <div className="community-similar-box"><strong>Já existe um relato semelhante nesta região.</strong><p>{similar.subtype} · {similar.community || similar.region} · {similar.reportCount} relato{similar.reportCount === 1 ? "" : "s"}</p><div className="community-rural-actions"><button className="community-rural-primary" type="button" onClick={() => void confirmExisting(similar)}>{draft.category === "water" && draft.subtype === "Falta de água" ? "Estou sem água também" : "Confirmar este relato"}</button><button className="community-rural-secondary" type="button" onClick={() => { setSelectedOccurrence(similar); setOccurrenceModalOpen(false); }}>Ver ocorrência</button><button className="community-rural-secondary" type="button" onClick={() => void saveOccurrence(true)}>Registrar outro problema</button></div></div>}
          {draftError && <p className="form-error" role="alert">{draftError}</p>}
          <div className="modal-action-row"><button className="secondary-button" type="button" onClick={() => setOccurrenceModalOpen(false)} disabled={draftBusy}>Cancelar</button><LoadingButton className="primary-button" type="submit" loading={draftBusy} disabled={!draft.community.trim() || !draft.subtype.trim()}>Registrar</LoadingButton></div>
          <p style={{ margin: 0, color: "#7b8982", fontSize: 10, lineHeight: 1.4 }}>O protocolo gerado pertence ao Hydra Agro e não é protocolo oficial de órgão público.</p>
        </form>
      </Modal>

      <Modal open={Boolean(selectedOccurrence)} onClose={() => setSelectedOccurrence(null)} eyebrow="OCORRÊNCIA" title={selectedOccurrence?.protocol || "Detalhes"}>
        {selectedOccurrence && <div className="community-occurrence-detail"><div className="community-occurrence-detail-head"><small>{categoryLabel(selectedOccurrence.category)}</small><h3>{selectedOccurrence.subtype}</h3><p>{selectedOccurrence.community || selectedOccurrence.region || selectedOccurrence.municipality || "Região aproximada"} · atualizado {relativeUpdate(selectedOccurrence.updatedAt)}</p></div>{selectedOccurrence.photoUrl && <img className="community-occurrence-photo" src={selectedOccurrence.photoUrl} alt="Foto autorizada da ocorrência" />}<div className="community-occurrence-detail-grid"><div><small>Status</small><strong>{selectedOccurrence.status}</strong></div><div><small>Prioridade interna</small><strong>{selectedOccurrence.priority}</strong></div><div><small>Relatos</small><strong>{selectedOccurrence.reportCount}</strong></div><div><small>Sincronização</small><strong>{selectedOccurrence.syncState}</strong></div></div>{selectedOccurrence.description && <div className="community-rural-note"><Info size={17} /><span>{selectedOccurrence.description}</span></div>}{selectedOccurrence.category === "water" && selectedOccurrence.ongoing && <div className="community-rural-note warning"><AlertTriangle size={17} /><span>{selectedOccurrence.updatedAt ? `Última confirmação ${relativeUpdate(selectedOccurrence.updatedAt)}.` : "Sem confirmação recente."}</span></div>}<div className="community-rural-actions">{!["Resolvido", "Recuperado"].includes(selectedOccurrence.status) && <button className="community-rural-primary" onClick={() => void confirmExisting(selectedOccurrence)}><CheckCircle2 size={16} /> {selectedOccurrence.category === "water" && selectedOccurrence.subtype === "Falta de água" ? "Estou sem água também" : selectedOccurrence.category === "water" && selectedOccurrence.ongoing ? "Ainda está vazando" : "Confirmar relato"}</button>}<button className="community-rural-secondary" onClick={() => void shareOccurrence(selectedOccurrence)}><Share2 size={16} /> Compartilhar ocorrência</button>{selectedOccurrence.mine && !["Resolvido", "Recuperado"].includes(selectedOccurrence.status) && <button className="community-rural-secondary" onClick={() => void markResolved(selectedOccurrence)}>Marcar como {selectedOccurrence.category.startsWith("animal") ? "recuperado" : "resolvido"}</button>}</div><div className="community-rural-note"><Shield size={17} /><span>Localização comunitária é aproximada. Dados privados, telefone, documentos e endereço da propriedade não são exibidos aqui.</span></div></div>}
      </Modal>

      <Modal open={composerOpen} onClose={() => { setComposerOpen(false); setMessage(""); setPublishConfirmOpen(false); setPublishError(""); }} eyebrow="AVISO COMUNITÁRIO" title="Novo aviso" dismissible={busy !== "publish"}>
        <form className="modal-form" onSubmit={requestPublish}><Field label="Categoria"><select value={noticeKind} onChange={(event) => setNoticeKind(event.target.value)}>{noticeKinds.map((kind) => <option key={kind}>{kind}</option>)}</select></Field><Field label="Aviso curto"><textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="Informação útil e objetiva para a comunidade…" autoFocus maxLength={700} /></Field><input className="hidden-file" ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => chooseImage(event.target.files?.[0])} />{imagePreview ? <div className="image-preview"><img src={imagePreview} alt="Imagem escolhida" /><button type="button" onClick={clearImage}>Tirar imagem</button></div> : <button className="upload-button" type="button" onClick={() => fileRef.current?.click()}><ImagePlus size={20} /> Escolher imagem</button>}{message && <p className="form-error" role="alert">{message}</p>}<div className="modal-action-row"><button className="secondary-button" type="button" onClick={() => setComposerOpen(false)} disabled={busy === "publish"}>Cancelar</button><LoadingButton className="primary-button" type="submit" disabled={!text.trim() && !imageFile} loading={false}>Publicar aviso</LoadingButton></div></form>
      </Modal>

      <ConfirmDialog open={publishConfirmOpen} title="Confirmar aviso" text="O aviso ficará visível para pessoas da comunidade. Não inclua telefone, endereço exato, documentos ou dados privados da fazenda." confirmLabel="Publicar aviso" busy={busy === "publish"} error={publishError} onCancel={() => { if (busy !== "publish") { setPublishConfirmOpen(false); setPublishError(""); } }} onConfirm={confirmPublish} />
      <ConfirmDialog open={Boolean(deleteTarget)} title="Confirmar exclusão" text="O aviso e as respostas serão removidos da comunidade." confirmLabel="Excluir aviso" busy={Boolean(deleteTarget && busy === `delete-${deleteTarget.id}`)} error={deleteError} onCancel={() => { setDeleteTarget(null); setDeleteError(""); }} onConfirm={() => deleteTarget ? remove(deleteTarget.id) : Promise.resolve()} />
    </div>
  );
}
