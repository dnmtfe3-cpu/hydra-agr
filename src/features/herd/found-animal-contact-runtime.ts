import { publicMediaUrl, requireSupabase } from "../../services/supabase";

type FoundContact = {
  reportId: string;
  finderUserId: string;
  name: string;
  phone?: string;
  email?: string;
  avatarPath?: string;
  message?: string;
  createdAt?: string;
};

type DirectMessage = {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

const CONTACT_STYLE_ID = "hydra-found-contact-style";

function installStyles() {
  if (document.getElementById(CONTACT_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = CONTACT_STYLE_ID;
  style.textContent = `
    .found-contact-runtime{position:fixed;inset:0;z-index:10050;overflow-y:auto;-webkit-overflow-scrolling:touch;background:#f4f3ed;color:#173629;font-family:var(--font-manrope),system-ui,sans-serif;padding:max(18px,env(safe-area-inset-top)) 14px calc(28px + env(safe-area-inset-bottom));}
    .found-contact-shell{width:min(100%,520px);min-height:100%;margin:0 auto;display:flex;flex-direction:column;gap:14px;}
    .found-contact-top{display:flex;align-items:center;gap:12px;padding:4px 2px 2px;}
    .found-contact-back{width:42px;height:42px;border:1px solid #d9e0d9;border-radius:14px;background:#fff;display:grid;place-items:center;color:#174c36;font-size:21px;cursor:pointer;}
    .found-contact-title{min-width:0;display:flex;flex-direction:column;}.found-contact-title strong{font-size:16px}.found-contact-title small{margin-top:2px;color:#748178;font-size:11px}
    .found-contact-card{border:1px solid #dce3dc;border-radius:24px;background:#fffefb;box-shadow:0 24px 60px -44px rgba(19,72,48,.55);overflow:hidden;}
    .found-contact-profile{padding:22px;display:grid;grid-template-columns:64px 1fr;gap:14px;align-items:center;background:linear-gradient(145deg,#174c36,#0d3526);color:#fff;}
    .found-contact-avatar{width:64px;height:64px;border-radius:20px;display:grid;place-items:center;overflow:hidden;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.16);font-size:24px;font-weight:800}.found-contact-avatar img{width:100%;height:100%;object-fit:cover}
    .found-contact-profile h1{margin:0;font-size:22px;line-height:1.15}.found-contact-profile p{margin:5px 0 0;color:#d7e7dd;font-size:12px;line-height:1.45}
    .found-contact-info{padding:18px;display:grid;gap:9px}.found-contact-info a,.found-contact-info .contact-empty{min-height:52px;padding:10px 13px;border:1px solid #e0e6df;border-radius:16px;background:#f8f8f4;color:#214d38;text-decoration:none;display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:13px}.found-contact-info a span{color:#748178;font-size:11px}
    .found-contact-note{margin:0 18px 18px;padding:12px 13px;border-radius:15px;background:#edf4ea;color:#486356;font-size:12px;line-height:1.5}
    .found-chat-card{border:1px solid #dce3dc;border-radius:24px;background:#fffefb;overflow:hidden;display:flex;flex-direction:column;min-height:330px;}
    .found-chat-head{padding:17px 18px;border-bottom:1px solid #e7ebe6;display:flex;flex-direction:column}.found-chat-head strong{font-size:14px}.found-chat-head small{margin-top:2px;color:#7d8981;font-size:10px}
    .found-chat-list{padding:16px;display:flex;flex-direction:column;gap:9px;max-height:42vh;overflow-y:auto;overscroll-behavior:contain}.found-chat-empty{margin:auto;text-align:center;color:#87918b;font-size:12px;padding:26px}
    .found-chat-bubble{max-width:82%;padding:10px 12px;border-radius:15px;background:#eef2ed;color:#385144;font-size:12px;line-height:1.45;align-self:flex-start}.found-chat-bubble.mine{align-self:flex-end;background:#174c36;color:#fff}.found-chat-bubble time{display:block;margin-top:5px;opacity:.62;font-size:9px}
    .found-chat-form{margin-top:auto;padding:12px;border-top:1px solid #e7ebe6;display:grid;grid-template-columns:1fr auto;gap:8px;background:#fff}.found-chat-form textarea{min-height:48px;max-height:120px;resize:none;padding:12px 13px;border:1px solid #d9dfd9;border-radius:15px;background:#f8f8f4;color:#173629;outline:none}.found-chat-form textarea:focus{border-color:#83ba5b;box-shadow:0 0 0 3px rgba(131,186,91,.14)}.found-chat-send{min-width:54px;border:0;border-radius:15px;background:#ff8712;color:#fff;font-weight:800;cursor:pointer}.found-chat-send:disabled{opacity:.48}
    .found-contact-status{padding:20px;border:1px solid #dce3dc;border-radius:20px;background:#fff;text-align:center;color:#617068;font-size:13px;line-height:1.55}.found-contact-status strong{display:block;margin-bottom:5px;color:#173629;font-size:15px}
    @media(max-width:380px){.found-contact-runtime{padding-left:10px;padding-right:10px}.found-contact-profile{grid-template-columns:54px 1fr;padding:18px}.found-contact-avatar{width:54px;height:54px;border-radius:17px}.found-contact-profile h1{font-size:19px}}
  `;
  document.head.appendChild(style);
}

function removeQueryParams() {
  const url = new URL(window.location.href);
  url.searchParams.delete("foundReport");
  url.searchParams.delete("mode");
  window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}` || "/");
}

function makeText(tag: keyof HTMLElementTagNameMap, text: string, className?: string) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = text;
  return element;
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "HA";
}

async function startFoundContactRuntime(reportId: string, mode: string) {
  installStyles();
  const client = requireSupabase();
  let overlay: HTMLDivElement | null = null;
  let loading = false;

  function close() {
    overlay?.remove();
    overlay = null;
    removeQueryParams();
  }

  async function openForCurrentUser() {
    if (loading || overlay) return;
    const { data: { user } } = await client.auth.getUser();
    if (!user) return;
    loading = true;
    try {
      const { data, error } = await client.rpc("found_report_contact", { p_report_id: reportId });
      if (error || !data || typeof data !== "object") {
        mountError("Contato indisponível", "Entre com a conta proprietária do animal para acessar os dados de quem o encontrou.");
        return;
      }
      mountContact(data as FoundContact, user.id);
    } catch {
      mountError("Não foi possível abrir o contato", "Tente novamente em instantes.");
    } finally {
      loading = false;
    }
  }

  function mountError(title: string, message: string) {
    if (overlay) return;
    overlay = document.createElement("div");
    overlay.className = "found-contact-runtime";
    const shell = document.createElement("div");
    shell.className = "found-contact-shell";
    const top = document.createElement("div");
    top.className = "found-contact-top";
    const back = makeText("button", "←", "found-contact-back");
    back.setAttribute("aria-label", "Voltar");
    back.addEventListener("click", close);
    const titleBox = document.createElement("div");
    titleBox.className = "found-contact-title";
    titleBox.append(makeText("strong", "Animal encontrado"), makeText("small", "Hydra Tag · contato protegido"));
    top.append(back, titleBox);
    const status = document.createElement("div");
    status.className = "found-contact-status";
    status.append(makeText("strong", title), document.createTextNode(message));
    shell.append(top, status);
    overlay.appendChild(shell);
    document.body.appendChild(overlay);
  }

  function mountContact(contact: FoundContact, currentUserId: string) {
    if (overlay) return;
    overlay = document.createElement("div");
    overlay.className = "found-contact-runtime";
    const shell = document.createElement("div");
    shell.className = "found-contact-shell";

    const top = document.createElement("div");
    top.className = "found-contact-top";
    const back = makeText("button", "←", "found-contact-back");
    back.setAttribute("aria-label", "Voltar");
    back.addEventListener("click", close);
    const titleBox = document.createElement("div");
    titleBox.className = "found-contact-title";
    titleBox.append(makeText("strong", "Quem encontrou o animal"), makeText("small", "Perfil e conversa da ocorrência"));
    top.append(back, titleBox);

    const profileCard = document.createElement("section");
    profileCard.className = "found-contact-card";
    const profile = document.createElement("div");
    profile.className = "found-contact-profile";
    const avatar = document.createElement("div");
    avatar.className = "found-contact-avatar";
    const avatarUrl = publicMediaUrl("avatars", contact.avatarPath);
    if (avatarUrl) {
      const img = document.createElement("img");
      img.src = avatarUrl;
      img.alt = `Foto de ${contact.name}`;
      avatar.appendChild(img);
    } else {
      avatar.textContent = initials(contact.name);
    }
    const profileCopy = document.createElement("div");
    const heading = makeText("h1", contact.name || "Usuário Hydra Agro");
    const subtitle = makeText("p", "Informou pelo Hydra Agro que encontrou o seu animal.");
    profileCopy.append(heading, subtitle);
    profile.append(avatar, profileCopy);

    const info = document.createElement("div");
    info.className = "found-contact-info";
    if (contact.phone) {
      const phone = document.createElement("a");
      phone.href = `tel:${contact.phone.replace(/[^\d+]/g, "")}`;
      phone.append(makeText("strong", contact.phone), makeText("span", "Ligar"));
      info.appendChild(phone);
    }
    if (contact.email) {
      const email = document.createElement("a");
      email.href = `mailto:${contact.email}`;
      email.append(makeText("strong", contact.email), makeText("span", "Enviar e-mail"));
      info.appendChild(email);
    }
    if (!contact.phone && !contact.email) info.appendChild(makeText("div", "Sem telefone ou e-mail público. Use a conversa abaixo.", "contact-empty"));

    const note = makeText("p", contact.message ? `Mensagem enviada: “${contact.message}”` : "Use o chat para combinar onde e como recuperar o animal.", "found-contact-note");
    profileCard.append(profile, info, note);

    const chatCard = document.createElement("section");
    chatCard.className = "found-chat-card";
    const chatHead = document.createElement("div");
    chatHead.className = "found-chat-head";
    chatHead.append(makeText("strong", `Conversa com ${contact.name.split(" ")[0] || "quem encontrou"}`), makeText("small", "Mensagens ficam salvas no Hydra Agro"));
    const list = document.createElement("div");
    list.className = "found-chat-list";
    const form = document.createElement("form");
    form.className = "found-chat-form";
    const textarea = document.createElement("textarea");
    textarea.placeholder = "Escreva uma mensagem para recuperar o animal…";
    textarea.maxLength = 1200;
    const send = makeText("button", "Enviar", "found-chat-send") as HTMLButtonElement;
    send.type = "submit";
    form.append(textarea, send);
    chatCard.append(chatHead, list, form);

    async function loadMessages() {
      list.replaceChildren(makeText("div", "Carregando conversa…", "found-chat-empty"));
      const finderId = contact.finderUserId;
      const pairFilter = `and(sender_id.eq.${currentUserId},recipient_id.eq.${finderId}),and(sender_id.eq.${finderId},recipient_id.eq.${currentUserId})`;
      const { data: messages, error } = await client.from("direct_messages")
        .select("id,sender_id,recipient_id,body,read_at,created_at")
        .or(pairFilter)
        .order("created_at", { ascending: true })
        .limit(100);
      if (error) {
        list.replaceChildren(makeText("div", "Não foi possível carregar as mensagens.", "found-chat-empty"));
        return;
      }
      const rows = (messages ?? []) as DirectMessage[];
      if (!rows.length) list.replaceChildren(makeText("div", "Nenhuma mensagem ainda. Envie a primeira para combinar a recuperação.", "found-chat-empty"));
      else {
        list.replaceChildren(...rows.map((row) => {
          const bubble = document.createElement("div");
          bubble.className = `found-chat-bubble${row.sender_id === currentUserId ? " mine" : ""}`;
          bubble.append(document.createTextNode(row.body));
          const time = document.createElement("time");
          time.textContent = new Date(row.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
          bubble.appendChild(time);
          return bubble;
        }));
        list.scrollTop = list.scrollHeight;
      }
      void client.from("direct_messages").update({ read_at: new Date().toISOString() }).eq("recipient_id", currentUserId).eq("sender_id", finderId).is("read_at", null);
    }

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const body = textarea.value.trim();
      if (!body || send.disabled) return;
      send.disabled = true;
      send.textContent = "…";
      void client.from("direct_messages").insert({ sender_id: currentUserId, recipient_id: contact.finderUserId, body }).then(async ({ error }) => {
        if (!error) {
          textarea.value = "";
          await loadMessages();
        }
        send.disabled = false;
        send.textContent = error ? "Tentar" : "Enviar";
      });
    });

    shell.append(top, profileCard, chatCard);
    overlay.appendChild(shell);
    document.body.appendChild(overlay);
    void loadMessages();
    if (mode === "chat") window.setTimeout(() => textarea.focus(), 80);
  }

  const { data: authListener } = client.auth.onAuthStateChange((_event, session) => {
    if (session?.user) void openForCurrentUser();
  });
  window.addEventListener("pagehide", () => authListener.subscription.unsubscribe(), { once: true });
  void openForCurrentUser();
}

if (typeof window !== "undefined") {
  const url = new URL(window.location.href);
  const reportId = url.searchParams.get("foundReport")?.trim() ?? "";
  const mode = url.searchParams.get("mode") === "chat" ? "chat" : "profile";
  if (/^found-[a-f0-9]{32}$/i.test(reportId)) {
    window.setTimeout(() => void startFoundContactRuntime(reportId, mode), 0);
  }
}
