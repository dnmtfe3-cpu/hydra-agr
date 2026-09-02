function makeProviderMark(kind: "google" | "apple") {
  const mark = document.createElement("span");
  mark.className = `auth-provider-mark auth-provider-mark-${kind}`;
  mark.setAttribute("aria-hidden", "true");
  mark.innerHTML = kind === "google"
    ? `<svg viewBox="0 0 24 24" focusable="false" aria-hidden="true"><path fill="currentColor" d="M21.35 12.2c0-.69-.06-1.21-.19-1.75H12v3.31h5.38a4.58 4.58 0 0 1-1.99 2.92v2.15h2.76c1.61-1.49 3.2-3.69 3.2-6.63Z"/><path fill="currentColor" opacity=".9" d="M12 21.7c2.3 0 4.23-.76 5.64-2.06l-2.76-2.15c-.76.51-1.74.87-2.88.87-2.22 0-4.1-1.5-4.77-3.52H4.38v2.21A8.52 8.52 0 0 0 12 21.7Z"/><path fill="currentColor" opacity=".72" d="M7.23 14.84a5.14 5.14 0 0 1 0-3.27V9.35H4.38a8.52 8.52 0 0 0 0 7.7l2.85-2.21Z"/><path fill="currentColor" opacity=".82" d="M12 8.04c1.26 0 2.39.43 3.28 1.28l2.45-2.45A8.23 8.23 0 0 0 12 4.63a8.52 8.52 0 0 0-7.62 4.72l2.85 2.22C7.9 9.54 9.78 8.04 12 8.04Z"/></svg>`
    : `<svg viewBox="0 0 24 24" focusable="false" aria-hidden="true"><path fill="currentColor" d="M16.7 12.74c-.03-2.8 2.29-4.16 2.39-4.22-1.31-1.91-3.34-2.17-4.06-2.2-1.71-.18-3.37 1.02-4.24 1.02-.89 0-2.23-1-3.68-.97-1.86.03-3.6 1.1-4.56 2.75-1.97 3.41-.5 8.42 1.38 11.18.94 1.35 2.03 2.85 3.47 2.79 1.4-.06 1.93-.9 3.62-.9 1.68 0 2.18.9 3.64.87 1.51-.03 2.46-1.35 3.36-2.71 1.09-1.55 1.52-3.07 1.54-3.15-.04-.01-2.88-1.1-2.86-4.46ZM13.91 4.5a4.77 4.77 0 0 0 1.09-3.43 4.86 4.86 0 0 0-3.13 1.63 4.55 4.55 0 0 0-1.12 3.31 4.02 4.02 0 0 0 3.16-1.51Z"/></svg>`;
  return mark;
}

function makeCopy(nameText: string) {
  const copy = document.createElement("span");
  copy.className = "auth-provider-copy";
  const name = document.createElement("strong");
  name.textContent = nameText;
  const status = document.createElement("small");
  status.textContent = "Em breve";
  copy.append(name, status);
  return copy;
}

function decorateComingSoonProviders() {
  const googleButtons = Array.from(document.querySelectorAll<HTMLButtonElement>(".auth-shell .google-auth-button"));

  for (const google of googleButtons) {
    if (google.dataset.providerComingSoon !== "1") {
      google.dataset.providerComingSoon = "1";
      google.disabled = true;
      google.setAttribute("aria-disabled", "true");
      google.setAttribute("title", "Google — em breve");
      google.replaceChildren(makeProviderMark("google"), makeCopy("Google"));
    }

    const currentNext = google.nextElementSibling;
    if (currentNext?.classList.contains("apple-auth-button")) continue;

    const apple = document.createElement("button");
    apple.type = "button";
    apple.disabled = true;
    apple.className = "apple-auth-button auth-provider-coming-soon";
    apple.setAttribute("aria-disabled", "true");
    apple.setAttribute("title", "Apple — em breve");
    apple.append(makeProviderMark("apple"), makeCopy("Apple"));
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
