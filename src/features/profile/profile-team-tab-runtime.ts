function wireProfileTeamTab() {
  document.querySelectorAll<HTMLElement>(".profile-screen .profile-social-tabs").forEach((tabs) => {
    if (tabs.dataset.teamTabWired === "1") return;
    const buttons = tabs.querySelectorAll<HTMLButtonElement>("button");
    if (buttons.length < 2) return;

    tabs.dataset.teamTabWired = "1";
    const teamButton = buttons[1];
    teamButton.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
      <span>Equipe e operações</span>`;
    teamButton.setAttribute("aria-label", "Abrir equipe e operações");
    teamButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      const operationsButton = Array.from(document.querySelectorAll<HTMLButtonElement>(".profile-menu-row"))
        .find((button) => button.textContent?.includes("Equipe e operações"));
      operationsButton?.click();
    }, true);
  });
}

if (typeof document !== "undefined") {
  new MutationObserver(wireProfileTeamTab).observe(document.body, { childList: true, subtree: true });
  wireProfileTeamTab();
}
