import { requireSupabase } from "./services/supabase";

type MaintenanceSetting = { enabled?: boolean; message?: string };

const STYLE_ID = "hydra-maintenance-runtime-style";
const CHECK_INTERVAL = 30_000;

const css = `
.hydra-maintenance-screen{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;padding:max(28px,env(safe-area-inset-top)) 28px max(28px,env(safe-area-inset-bottom));background:#063524;color:#f7f5ee;font-family:Manrope,system-ui,sans-serif;text-align:center}.hydra-maintenance-inner{width:min(100%,360px)}.hydra-maintenance-mark{width:76px;height:76px;margin:0 auto 28px;border-radius:23px;display:grid;place-items:center;background:#0c4b34;border:1px solid rgba(255,255,255,.1);font-family:Sora,Manrope,sans-serif;font-size:26px;font-weight:800;color:#f39a49}.hydra-maintenance-screen h1{margin:0;color:#fffaf3;font-family:Sora,Manrope,sans-serif;font-size:30px;line-height:1.08;letter-spacing:-.04em}.hydra-maintenance-screen p{margin:13px auto 0;max-width:310px;color:rgba(244,247,242,.68);font-size:15px;line-height:1.5}.hydra-maintenance-screen small{display:block;margin-top:28px;color:rgba(244,247,242,.42);font-size:11px;letter-spacing:.12em;text-transform:uppercase}.hydra-maintenance-admin{margin-top:24px;border:0;background:transparent;color:rgba(255,255,255,.42);font:700 12px Manrope,system-ui;padding:10px}.hydra-maintenance-admin:hover{color:#fff}
`;

function ensureStyle(){if(document.getElementById(STYLE_ID))return;const s=document.createElement("style");s.id=STYLE_ID;s.textContent=css;document.head.appendChild(s)}
function currentRole(){try{const raw=localStorage.getItem("hydra-account");if(!raw)return "";return String(JSON.parse(raw)?.role||"")}catch{return ""}}
function isAdmin(){return ["moderator","admin","owner"].includes(currentRole())}
function hide(){document.querySelector(".hydra-maintenance-screen")?.remove()}
function show(message:string){if(isAdmin()){hide();return}ensureStyle();let el=document.querySelector<HTMLElement>(".hydra-maintenance-screen");if(!el){el=document.createElement("main");el.className="hydra-maintenance-screen";el.innerHTML='<div class="hydra-maintenance-inner"><div class="hydra-maintenance-mark">H</div><h1>App em atualização</h1><p></p><small>hydra agro</small><button class="hydra-maintenance-admin" type="button">Acesso administrativo</button></div>';el.querySelector("button")?.addEventListener("click",()=>{hide()});document.body.appendChild(el)}const p=el.querySelector("p");if(p)p.textContent=message||"Volte em breve!"}

export async function checkMaintenanceMode(){
  try{
    const db=requireSupabase();
    const {data,error}=await db.from("app_settings").select("value").eq("key","maintenance_mode").maybeSingle();
    if(error)throw error;
    const value=(data?.value||{}) as MaintenanceSetting;
    if(value.enabled)show(value.message||"Volte em breve!");else hide();
  }catch{ /* Falha aberta: não bloqueia o app se a configuração não puder ser consultada. */ }
}

if(typeof window!=="undefined"){
  void checkMaintenanceMode();
  window.setInterval(()=>void checkMaintenanceMode(),CHECK_INTERVAL);
  window.addEventListener("focus",()=>void checkMaintenanceMode());
}
