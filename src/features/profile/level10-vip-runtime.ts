import { supabase } from "../../services/supabase";
import "../community/community-social-runtime";
import "../community/community-follow-runtime";
import "../community/community-follow.css";
import "../community/community-search-report-runtime";

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
