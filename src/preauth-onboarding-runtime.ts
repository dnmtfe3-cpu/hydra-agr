export {};

const STORAGE_KEY = "hydra.preauth.onboarding.v2";
const ROOT_CLASS = "hydra-preauth-onboarding";

const slides = [
  { title: "Bem-vindo ao Hydra Agro", copy: "Gestão rural simples para acompanhar sua propriedade, água, rebanho e rotina em um só lugar.", art: "brand", chips: ["Propriedade", "Água", "Rotina"] },
  { title: "Seu rebanho na palma da mão", copy: "Cadastre animais, acompanhe informações importantes e use identificação NFC/RFID para agilizar o manejo no campo.", art: "herd", chips: ["Animais", "NFC / RFID", "Histórico"] },
  { title: "Acompanhe o que importa", copy: "Tenha uma visão mais organizada da propriedade e das atividades do dia a dia, sem espalhar informações por vários lugares.", art: "farm", chips: ["Gestão", "Organização", "Campo"] },
  { title: "Evolua enquanto cuida da fazenda", copy: "Complete missões em sequência, ganhe XP e acompanhe sua evolução e posição no ranking do Hydra Agro.", art: "progress", chips: ["Missões", "XP", "Ranking"] },
];

const icons: Record<string,string> = {
  herd: `<svg viewBox="0 0 120 120"><path d="M33 43c-13-12-22-9-25-2 8 2 13 7 17 14m62-12c13-12 22-9 25-2-8 2-13 7-17 14"/><path d="M30 39c5-18 18-27 30-27s25 9 30 27v36c0 22-13 35-30 35S30 97 30 75V39Z"/><circle cx="45" cy="58" r="3"/><circle cx="75" cy="58" r="3"/><path d="M47 80c8 6 18 6 26 0M60 68v9"/></svg>`,
  farm: `<svg viewBox="0 0 120 120"><path d="M13 104h94M21 104V51l39-28 39 28v53M43 104V70h34v34"/><path d="M26 47h68M16 82c10-10 18-10 28 0M76 86c9-11 18-11 28 0"/></svg>`,
  progress: `<svg viewBox="0 0 120 120"><path d="M60 12 73 39l30 4-22 21 6 30-27-14-27 14 6-30-22-21 30-4 13-27Z"/><path d="M45 62l10 10 21-24"/></svg>`,
};

function wasSeen(){ try{return localStorage.getItem(STORAGE_KEY)==="1"}catch{return false} }
function markSeen(){ try{localStorage.setItem(STORAGE_KEY,"1")}catch{} }
function action(kind:"login"|"signup"){ const l=document.querySelector<HTMLElement>(".auth-landing"); return l?.querySelector<HTMLButtonElement>(kind==="login"?".auth-landing-primary":".auth-landing-secondary") }

function mountOnboarding(){
  if(wasSeen()||document.querySelector(`.${ROOT_CLASS}`)||!document.querySelector(".auth-landing")) return;
  let index=0;
  const overlay=document.createElement("section"); overlay.className=ROOT_CLASS; overlay.setAttribute("aria-label","Conheça o Hydra Agro");
  const render=()=>{
    const s=slides[index], last=index===slides.length-1;
    const visual=s.art==="brand"?`<div class="preauth-brand-art"><span class="hydra-drop"><i></i></span><strong>Hydra Agro</strong><small>Gestão rural inteligente</small></div>`:`<div class="preauth-scene ${s.art}"><span class="scene-sun"></span><span class="scene-hill hill-a"></span><span class="scene-hill hill-b"></span><span class="scene-icon">${icons[s.art]}</span><span class="scene-tag">HYDRA AGRO</span></div>`;
    overlay.innerHTML=`<header class="preauth-topbar"><button class="preauth-back-top" ${index===0?'disabled':''} aria-label="Voltar">‹</button><button class="preauth-skip">Pular</button></header><main class="preauth-stage"><div class="preauth-visual">${visual}</div><div class="preauth-copy"><span class="preauth-step">${String(index+1).padStart(2,'0')} / ${String(slides.length).padStart(2,'0')}</span><h1>${s.title}</h1><p>${s.copy}</p><div class="preauth-chips">${s.chips.map(x=>`<span>${x}</span>`).join('')}</div></div></main><footer class="preauth-footer"><div class="preauth-dots">${slides.map((_,i)=>`<span class="${i===index?'active':''}"></span>`).join('')}</div>${last?`<button class="preauth-create">Criar minha conta</button><button class="preauth-login">Já tenho uma conta</button>`:`<button class="preauth-next">Continuar <b>→</b></button>`}</footer>`;
    overlay.querySelector<HTMLButtonElement>(".preauth-skip")?.addEventListener("click",()=>{markSeen();overlay.remove()});
    overlay.querySelector<HTMLButtonElement>(".preauth-next")?.addEventListener("click",()=>{index++;render()});
    overlay.querySelector<HTMLButtonElement>(".preauth-back-top")?.addEventListener("click",()=>{if(index>0){index--;render()}});
    overlay.querySelector<HTMLButtonElement>(".preauth-create")?.addEventListener("click",()=>{markSeen();overlay.remove();action("signup")?.click()});
    overlay.querySelector<HTMLButtonElement>(".preauth-login")?.addEventListener("click",()=>{markSeen();overlay.remove();action("login")?.click()});
  }; render(); document.querySelector(".auth-landing")?.insertAdjacentElement("afterend",overlay);
}
if(typeof document!=="undefined"){mountOnboarding();new MutationObserver(()=>{if(!wasSeen()&&document.querySelector(".auth-landing"))mountOnboarding()}).observe(document.documentElement,{childList:true,subtree:true})}
