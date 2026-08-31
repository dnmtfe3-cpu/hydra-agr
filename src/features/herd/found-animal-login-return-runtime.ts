import { supabase } from "../../services/supabase";

export const PENDING_FOUND_ANIMAL_URL_KEY = "hydra.pending-found-animal-url";

function pendingUrl() {
  try {
    const value = window.sessionStorage.getItem(PENDING_FOUND_ANIMAL_URL_KEY);
    if (!value) return null;
    const url = new URL(value, window.location.origin);
    if (url.origin !== window.location.origin || url.searchParams.get("pa") !== "1") {
      window.sessionStorage.removeItem(PENDING_FOUND_ANIMAL_URL_KEY);
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

function restorePendingFoundAnimal() {
  const target = pendingUrl();
  if (!target) return;
  const current = new URL(window.location.href);
  if (current.searchParams.get("pa") === "1") return;
  window.sessionStorage.removeItem(PENDING_FOUND_ANIMAL_URL_KEY);
  window.location.replace(target);
}

if (typeof window !== "undefined" && supabase) {
  void supabase.auth.getSession().then(({ data }) => {
    if (data.session?.user) restorePendingFoundAnimal();
  }).catch(() => undefined);

  supabase.auth.onAuthStateChange((event, session) => {
    if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && session?.user) {
      window.setTimeout(restorePendingFoundAnimal, 80);
    }
  });
}
