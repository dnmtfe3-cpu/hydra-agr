import "./student-hub.css";
import { requireSupabase } from "./services/supabase";

const SCHOOL_NAME = "Colégio de Tempo Integral Helena Souza Bispo";

type StudentPost = {
  id: string;
  user_id: string;
  author_name: string;
  body: string;
  created_at: string;
};

type AccessState = { member: boolean; manager: boolean; userId: string; name: string };

let accessState: AccessState | null = null;
let accessPromise: Promise<AccessState | null> | null = null;
let overlay: HTMLElement | null = null;
let channel: ReturnType<ReturnType<typeof requireSupabase>["channel"]> | null = null;

function escapeInitial(name: string) {
  return (name.trim()[0] || "A").toUpperCase();
}

async function loadAccess(): Promise<AccessState | null> {
  if (accessState) return accessState;
  if (accessPromise) return accessPromise;
  accessPromise = (async () => {
    try {
      const client = requireSupabase();
      const { data: auth } = await client.auth.getUser();
      const user = auth.user;
      if (!user) return null;
      const [{ data: member }, { data: manager }, { data: profile }] = await Promise.all([
        client.rpc("is_student_member", { target_user_id: user.id }),
        client.rpc("can_manage_student_access"),
        client.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
      ]);
      accessState = {
        member: Boolean(member),
        manager: Boolean(manager),
        userId: user.id,
        name: profile?.full_name?.trim() || user.user_metadata?.full_name || "Aluno",
      };
      return accessState;
    } catch {
      return null;
    } finally {
      accessPromise = null;
    }
  })();
  return accessPromise;
}

function makeMenuRow() {
  const wrapper = document.createElement("div");
  wrapper.className = "profile-menu-card student-hub-card";
  const button = document.createElement("button");
  button.className = "profile-menu-row student-hub-row";
  button.type = "button";
  button.innerHTML = '<span class="profile-menu-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 10 9-5 9 5-9 5-9-5Z"/><path d="M7 12v5c3 2 7 2 10 0v-5"/></svg></span><div><strong>Alunos</strong><small>Área exclusiva do colégio</small></div><svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>';
  button.addEventListener("click", () => void openHub());
  wrapper.appendChild(button);
  return wrapper;
}

async function injectMenu() {
  const sheet = document.querySelector<HTMLElement>(".profile-settings-sheet");
  if (!sheet || sheet.querySelector(".student-hub-card")) return;
  const access = await loadAccess();
  if (!access || (!access.member && !access.manager)) return;
  if (!sheet.isConnected || sheet.querySelector(".student-hub-card")) return;

  const labels = [...sheet.querySelectorAll<HTMLElement>(".profile-settings-label")];
  const infoLabel = labels.find((node) => node.textContent?.trim().toUpperCase() === "INFORMAÇÕES");
  const exclusive = document.createElement("span");
  exclusive.className = "profile-settings-label student-hub-exclusive-label";
  exclusive.textContent = "EXCLUSIVO";
  const card = makeMenuRow();
  if (infoLabel) {
    sheet.insertBefore(exclusive, infoLabel);
    sheet.insertBefore(card, infoLabel);
  } else {
    sheet.append(exclusive, card);
  }
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(date);
}

function closeHub() {
  if (channel) {
    void requireSupabase().removeChannel(channel);
    channel = null;
  }
  overlay?.remove();
  overlay = null;
  document.documentElement.style.overflow = "";
  document.body.style.overflow = "";
}

function createPostNode(post: StudentPost, access: AccessState) {
  const article = document.createElement("article");
  article.className = "student-post";
  const head = document.createElement("div");
  head.className = "student-post-head";
  const author = document.createElement("div");
  author.className = "student-post-author";
  const avatar = document.createElement("span");
  avatar.className = "student-post-avatar";
  avatar.textContent = escapeInitial(post.author_name);
  const copy = document.createElement("span");
  const strong = document.createElement("strong");
  strong.textContent = post.author_name || "Aluno";
  const time = document.createElement("small");
  time.textContent = formatDate(post.created_at);
  copy.append(strong, time);
  author.append(avatar, copy);
  head.appendChild(author);
  if (post.user_id === access.userId || access.manager) {
    const remove = document.createElement("button");
    remove.className = "student-post-delete";
    remove.type = "button";
    remove.textContent = "Excluir";
    remove.addEventListener("click", async () => {
      remove.disabled = true;
      const { error } = await requireSupabase().from("student_posts").delete().eq("id", post.id);
      if (error) { remove.disabled = false; return; }
      article.remove();
    });
    head.appendChild(remove);
  }
  const body = document.createElement("p");
  body.textContent = post.body;
  article.append(head, body);
  return article;
}

async function renderPosts(container: HTMLElement, access: AccessState) {
  const client = requireSupabase();
  const { data, error } = await client.from("student_posts").select("id,user_id,author_name,body,created_at").order("created_at", { ascending: false }).limit(60);
  container.replaceChildren();
  if (error) {
    const errorNode = document.createElement("div");
    errorNode.className = "student-hub-error";
    errorNode.textContent = "Não foi possível carregar o mural agora.";
    container.appendChild(errorNode);
    return;
  }
  const posts = (data ?? []) as StudentPost[];
  if (!posts.length) {
    const empty = document.createElement("div");
    empty.className = "student-empty";
    empty.textContent = "O mural ainda está vazio. A primeira publicação pode ser sua.";
    container.appendChild(empty);
    return;
  }
  posts.forEach((post) => container.appendChild(createPostNode(post, access)));
}

function buildAdmin(access: AccessState) {
  if (!access.manager) return null;
  const section = document.createElement("section");
  section.className = "student-admin";
  const head = document.createElement("div");
  head.className = "student-admin-head";
  head.innerHTML = "<strong>Controle de acesso</strong><small>Libere somente contas de alunos confirmados do colégio.</small>";
  const row = document.createElement("div");
  row.className = "student-admin-row";
  const input = document.createElement("input");
  input.type = "email";
  input.autocomplete = "off";
  input.placeholder = "email do aluno";
  const actions = document.createElement("div");
  actions.className = "student-admin-actions";
  const grant = document.createElement("button");
  grant.className = "student-action";
  grant.textContent = "Liberar";
  const revoke = document.createElement("button");
  revoke.className = "student-action student-revoke";
  revoke.textContent = "Remover";
  const feedback = document.createElement("small");
  feedback.style.display = "block";
  feedback.style.marginTop = "8px";

  async function change(kind: "grant" | "revoke") {
    const email = input.value.trim();
    if (!email) return;
    grant.disabled = true;
    revoke.disabled = true;
    feedback.textContent = "Salvando…";
    const rpc = kind === "grant" ? "grant_student_access_by_email" : "revoke_student_access_by_email";
    const { data, error } = await requireSupabase().rpc(rpc, { target_email: email });
    feedback.textContent = error ? "Não foi possível alterar o acesso." : data ? (kind === "grant" ? "Acesso liberado." : "Acesso removido.") : "Nenhuma conta foi encontrada com esse e-mail.";
    if (!error && data) input.value = "";
    grant.disabled = false;
    revoke.disabled = false;
  }
  grant.addEventListener("click", () => void change("grant"));
  revoke.addEventListener("click", () => void change("revoke"));
  actions.append(grant, revoke);
  row.append(input, actions);
  section.append(head, row, feedback);
  return section;
}

async function openHub() {
  if (overlay) return;
  const access = await loadAccess();
  if (!access || (!access.member && !access.manager)) return;

  document.documentElement.style.overflow = "hidden";
  document.body.style.overflow = "hidden";
  overlay = document.createElement("div");
  overlay.className = "student-hub-overlay";
  const shell = document.createElement("main");
  shell.className = "student-hub-shell";

  const header = document.createElement("header");
  header.className = "student-hub-header";
  const back = document.createElement("button");
  back.className = "student-hub-back";
  back.type = "button";
  back.setAttribute("aria-label", "Voltar");
  back.textContent = "‹";
  back.addEventListener("click", closeHub);
  const title = document.createElement("div");
  title.className = "student-hub-title";
  title.innerHTML = "<small>ÁREA PRIVADA</small><h1>Alunos</h1>";
  header.append(back, title);

  const campus = document.createElement("section");
  campus.className = "student-campus-card";
  const campusEyebrow = document.createElement("span");
  campusEyebrow.textContent = "HYDRA CAMPUS";
  const campusTitle = document.createElement("h2");
  campusTitle.textContent = SCHOOL_NAME;
  const campusText = document.createElement("p");
  campusText.textContent = "Um espaço privado para projetos, ideias, avisos e colaboração entre alunos autorizados.";
  const lock = document.createElement("div");
  lock.className = "student-hub-lock";
  lock.textContent = "Acesso protegido por conta aprovada no Hydra Agro";
  campus.append(campusEyebrow, campusTitle, campusText, lock);

  shell.append(header, campus);
  const admin = buildAdmin(access);
  if (admin) shell.appendChild(admin);

  const compose = document.createElement("section");
  compose.className = "student-compose";
  const textarea = document.createElement("textarea");
  textarea.maxLength = 1200;
  textarea.placeholder = "Compartilhe uma ideia, projeto ou aviso com os alunos…";
  const footer = document.createElement("div");
  footer.className = "student-compose-footer";
  const counter = document.createElement("small");
  counter.textContent = "0/1200";
  textarea.addEventListener("input", () => { counter.textContent = `${textarea.value.length}/1200`; });
  const publish = document.createElement("button");
  publish.className = "student-action";
  publish.textContent = "Publicar";
  footer.append(counter, publish);
  compose.append(textarea, footer);
  shell.appendChild(compose);

  const feedHead = document.createElement("div");
  feedHead.className = "student-feed-head";
  feedHead.innerHTML = "<div><span>MURAL PRIVADO</span><strong>Alunos</strong></div>";
  const feed = document.createElement("div");
  feed.className = "student-feed";
  shell.append(feedHead, feed);
  overlay.appendChild(shell);
  document.body.appendChild(overlay);

  publish.addEventListener("click", async () => {
    const body = textarea.value.trim();
    if (!body) return;
    publish.disabled = true;
    publish.textContent = "Publicando…";
    const { error } = await requireSupabase().from("student_posts").insert({ user_id: access.userId, author_name: access.name, body });
    publish.disabled = false;
    publish.textContent = "Publicar";
    if (error) return;
    textarea.value = "";
    counter.textContent = "0/1200";
    await renderPosts(feed, access);
  });

  await renderPosts(feed, access);
  channel = requireSupabase().channel("hydra-student-posts").on("postgres_changes", { event: "*", schema: "public", table: "student_posts" }, () => { void renderPosts(feed, access); }).subscribe();
}

const observer = new MutationObserver(() => { void injectMenu(); });
observer.observe(document.documentElement, { childList: true, subtree: true });
void injectMenu();

window.addEventListener("hydra:logout", () => {
  accessState = null;
  accessPromise = null;
  closeHub();
});
