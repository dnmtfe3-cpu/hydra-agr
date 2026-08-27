const WIRED = "data-hydra-comment-wired";

function focusComment(action: HTMLElement) {
  const input = action.closest(".post-card")?.querySelector<HTMLInputElement>(".comment-form input");
  if (!input) return;
  input.focus({ preventScroll: true });
  input.scrollIntoView({ behavior: "smooth", block: "center" });
}

function wireCommentActions(root: ParentNode = document) {
  root.querySelectorAll<HTMLElement>(".community-screen .post-actions > span").forEach((action) => {
    if (action.hasAttribute(WIRED)) return;
    action.setAttribute(WIRED, "true");
    action.classList.add("comment-action");
    action.setAttribute("role", "button");
    action.setAttribute("tabindex", "0");
    action.setAttribute("aria-label", "Comentar publicação");

    action.addEventListener("click", () => focusComment(action));
    action.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      focusComment(action);
    });
  });
}

if (typeof document !== "undefined") {
  wireCommentActions();
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (node instanceof Element) wireCommentActions(node);
      });
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}
