function decorateComingSoonProviders() {
  const googleButtons = Array.from(document.querySelectorAll<HTMLButtonElement>(".auth-shell .google-auth-button"));

  for (const google of googleButtons) {
    if (google.dataset.providerComingSoon !== "1") {
      google.dataset.providerComingSoon = "1";
      google.disabled = true;
      google.setAttribute("aria-disabled", "true");
      google.setAttribute("title", "Google — em breve");
      google.replaceChildren();

      const mark = document.createElement("span");
      mark.className = "auth-provider-mark auth-provider-mark-google";
      mark.setAttribute("aria-hidden", "true");
      mark.textContent = "G";

      const copy = document.createElement("span");
      copy.className = "auth-provider-copy";
      const name = document.createElement("strong");
      name.textContent = "Google";
      const status = document.createElement("small");
      status.textContent = "Em breve";
      copy.append(name, status);

      google.append(mark, copy);
    }

    const currentNext = google.nextElementSibling;
    if (currentNext?.classList.contains("apple-auth-button")) continue;

    const apple = document.createElement("button");
    apple.type = "button";
    apple.disabled = true;
    apple.className = "apple-auth-button auth-provider-coming-soon";
    apple.setAttribute("aria-disabled", "true");
    apple.setAttribute("title", "Apple — em breve");

    const mark = document.createElement("span");
    mark.className = "auth-provider-mark auth-provider-mark-apple";
    mark.setAttribute("aria-hidden", "true");
    mark.textContent = "A";

    const copy = document.createElement("span");
    copy.className = "auth-provider-copy";
    const name = document.createElement("strong");
    name.textContent = "Apple";
    const status = document.createElement("small");
    status.textContent = "Em breve";
    copy.append(name, status);

    apple.append(mark, copy);
    google.insertAdjacentElement("afterend", apple);
  }
}

let scheduled = false;
function scheduleProvidersSync() {
  if (scheduled) return;
  scheduled = true;
  window.requestAnimationFrame(() => {
    scheduled = false;
    decorateComingSoonProviders();
  });
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  const start = () => {
    scheduleProvidersSync();
    const observer = new MutationObserver(scheduleProvidersSync);
    observer.observe(document.documentElement, { childList: true, subtree: true });
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
}
