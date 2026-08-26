import { supabase } from "../../services/supabase";

async function syncLevel10Vip() {
  const client = supabase;
  if (!client) return;
  const { data } = await client.auth.getSession();
  if (!data.session?.user) return;
  await client.rpc("sync_level10_vip");
}

if (typeof window !== "undefined") {
  void syncLevel10Vip();
  window.addEventListener("focus", () => { void syncLevel10Vip(); });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void syncLevel10Vip();
  });
}
