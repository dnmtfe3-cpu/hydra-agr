import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { ClipboardCheck, Beef as Cow, History, Home, MapPin, Nfc, Plus, Send, UserRound, UsersRound, X } from "lucide-react";
import { SplashBrand } from "./components/brand";
import { requestCloseTopOverlay, useAppOverlay, useModalNavigation } from "./components/modal-system";
import { BackendSetupScreen, BannedScreen, PasswordRecoveryScreen, SyncBanner } from "./components/system-state";
import { AppToastRegion } from "./components/ui";
import { AuthFlow } from "./features/auth/auth-flow";
import { HomeScreen } from "./features/home/home-screen";
import { PublicAnimalScreen, clearPublicAnimalParams, readPublicAnimalSnapshot } from "./features/herd/public-animal-card";
import { StaffHomeScreen } from "./features/staff/staff-home-screen";
import { StaffProfileScreen } from "./features/staff/staff-profile-screen";
import { useHydraStore } from "./hooks/use-hydra-store";
import type { AppRoute, StaffRole } from "./lib/hydra-types";
import { handleAuthCallbackUrl, supabase } from "./services/supabase";

const HerdScreen = lazy(() => import("./features/herd/herd-screen").then((module) => ({ default: module.HerdScreen })));
const MonitorScreen = lazy(() => import("./features/monitor/monitor-screen").then((module) => ({ default: module.MonitorScreen })));
const ProfileScreen = lazy(() => import("./features/profile/profile-screen").then((module) => ({ default: module.ProfileScreen })));
const CommunityScreen = lazy(() => import("./features/community/community-screen").then((module) => ({ default: module.CommunityScreen })));
const ChallengesScreen = lazy(() => import("./features/challenges/challenges-screen").then((module) => ({ default: module.ChallengesScreen })));
const PropertyScreen = lazy(() => import("./features/property/property-screen").then((module) => ({ default: module.PropertyScreen })));
const ActivitiesScreen = lazy(() => import("./features/activities/activities-screen").then((module) => ({ default: module.ActivitiesScreen })));
const OperationsScreen = lazy(() => import("./features/operations/operations-screen").then((module) => ({ default: module.OperationsScreen })));
const HydraAssistantScreen = lazy(() => import("./features/assistant").then((module) => ({ default: module.HydraAssistantScreen })));
const TodayScreen = lazy(() => import("./features/today").then((module) => ({ default: module.TodayScreen })));
const PropertyHistoryScreen = lazy(() => import("./features/history").then((module) => ({ default: module.PropertyHistoryScreen })));
const NfcScreen = lazy(() => import("./features/nfc/nfc-screen").then((module) => ({ default: module.NfcScreen })));
const NotificationsScreen = lazy(() => import("./features/notifications/notifications-screen").then((module) => ({ default: module.NotificationsScreen })));
const PlusScreen = lazy(() => import("./features/premium/plus-screen").then((module) => ({ default: module.PlusScreen })));
const FamilyFarmingScreen = lazy(() => import("./features/family-farming/family-farming-screen").then((module) => ({ default: module.FamilyFarmingScreen })));
const AdminScreen = lazy(() => import("./features/admin/admin-screen").then((module) => ({ default: module.AdminScreen })));

type NavTab = { id: AppRoute; label: string; icon: typeof Home };

const ownerMainTabs: NavTab[] = [
  { id: "home", label: "Início", icon: Home },
  { id: "community", label: "Comunidade", icon: UsersRound },
  { id: "nfc", label: "NFC", icon: Nfc },
  { id: "herd", label: "Rebanho", icon: Cow },
  { id: "profile", label: "Perfil", icon: UserRound },
];

const staffMainTabs: NavTab[] = [
  { id: "home", label: "Início", icon: Home },
  { id: "history", label: "Histórico", icon: History },
  { id: "nfc", label: "NFC", icon: Nfc },
  { id: "operations", label: "Rotina", icon: ClipboardCheck },
  { id: "profile", label: "Perfil", icon: UserRound },
];

const employeeRoutes = new Set<AppRoute>(["home", "history", "nfc", "operations", "profile", "notifications", "production"]);
const managerRoutes = new Set<AppRoute>([...employeeRoutes, "herd", "monitor", "activities", "assistant", "today"]);

function staffRouteAllowed(route: AppRoute, role?: StaffRole) {
  return (role === "manager" ? managerRoutes : employeeRoutes).has(route);
}

export default function HydraApp() {
  const store = useHydraStore();
  const mainTabs = store.account?.access.kind === "staff" ? staffMainTabs : ownerMainTabs;
  const mainRouteIds: AppRoute[] = mainTabs.map((tab) => tab.id);
  const [splash, setSplash] = useState(true);
  const [route, setRoute] = useState<AppRoute>("home");
  const [backRoute, setBackRoute] = useState<AppRoute>("home");
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickClosing, setQuickClosing] = useState(false);
  const [routeMotion, setRouteMotion] = useState<"forward" | "back">("forward");
  const [animalToOpen, setAnimalToOpen] = useState<string>();
  const [nfcAnimalId, setNfcAnimalId] = useState<string>();
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [publicAnimal] = useState(() => !Capacitor.isNativePlatform() ? readPublicAnimalSnapshot() : null);
  const [quickIntent, setQuickIntent] = useState<{ kind: "animal" | "activity" | "sector" | "post"; request: number }>();
  const quickTimer = useRef<number | null>(null);
  const splashTimer = useRef<number | null>(null);
  const splashInitialized = useRef(false);
  const modalNavigationOpen = useModalNavigation();

  useAppOverlay(quickOpen, () => closeQuick());

  useLayoutEffect(() => {
    const isInitialSplash = !splashInitialized.current;
    splashInitialized.current = true;
    if (!isInitialSplash && !store.account?.id) {
      setSplash(false);
      return;
    }
    setSplash(true);
    if (splashTimer.current) window.clearTimeout(splashTimer.current);
    splashTimer.current = window.setTimeout(() => {
      setSplash(false);
      splashTimer.current = null;
    }, 3000);
    return () => {
      if (splashTimer.current) window.clearTimeout(splashTimer.current);
    };
  }, [store.account?.id]);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const navTapTimers = new Map<HTMLButtonElement, number>();
    const navTapFrames = new Map<HTMLButtonElement, number>();
    const pressTimers = new Map<HTMLButtonElement, number>();
    const pressFrames = new Map<HTMLButtonElement, number>();
    function handlePointerDown(event: PointerEvent) {
      if (reducedMotion.matches || event.button !== 0) return;
      const target = event.target instanceof Element ? event.target.closest("button") : null;
      if (!(target instanceof HTMLButtonElement) || target.disabled) return;
      if (!target.matches(".bottom-nav button")) {
        const bounds = target.getBoundingClientRect();
        const diameter = Math.max(bounds.width, bounds.height) * 1.5;
        const ripple = document.createElement("span");
        ripple.className = "touch-ripple";
        ripple.style.setProperty("--touch-size", `${diameter}px`);
        ripple.style.setProperty("--touch-x", `${event.clientX - bounds.left - diameter / 2}px`);
        ripple.style.setProperty("--touch-y", `${event.clientY - bounds.top - diameter / 2}px`);
        target.appendChild(ripple);
        window.setTimeout(() => ripple.remove(), 620);
      }
      const previousPressTimer = pressTimers.get(target);
      if (previousPressTimer) window.clearTimeout(previousPressTimer);
      const previousPressFrame = pressFrames.get(target);
      if (previousPressFrame) window.cancelAnimationFrame(previousPressFrame);
      target.classList.remove("is-pressed");
      pressFrames.set(target, window.requestAnimationFrame(() => {
        pressFrames.delete(target);
        if (!target.isConnected) return;
        target.classList.add("is-pressed");
        pressTimers.set(target, window.setTimeout(() => {
          target.classList.remove("is-pressed");
          pressTimers.delete(target);
        }, 440));
      }));
      if (target.matches(".bottom-nav button")) {
        const previousTimer = navTapTimers.get(target);
        if (previousTimer) window.clearTimeout(previousTimer);
        const previousFrame = navTapFrames.get(target);
        if (previousFrame) window.cancelAnimationFrame(previousFrame);
        target.classList.remove("is-tapped");
        navTapFrames.set(target, window.requestAnimationFrame(() => {
          navTapFrames.delete(target);
          if (!target.isConnected) return;
          target.classList.add("is-tapped");
          navTapTimers.set(target, window.setTimeout(() => {
            target.classList.remove("is-tapped");
            navTapTimers.delete(target);
          }, 420));
        }));
      }
      if (target.matches(".primary-button, .icon-button.accent, .bottom-nav button, .toggle, .home-fab-label")) window.navigator.vibrate?.(7);
    }
    document.addEventListener("pointerdown", handlePointerDown, { passive: true });
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      navTapTimers.forEach((timer) => window.clearTimeout(timer));
      navTapFrames.forEach((frame) => window.cancelAnimationFrame(frame));
      pressTimers.forEach((timer) => window.clearTimeout(timer));
      pressFrames.forEach((frame) => window.cancelAnimationFrame(frame));
    };
  }, []);

  useEffect(() => () => { if (quickTimer.current) window.clearTimeout(quickTimer.current); }, []);

  useLayoutEffect(() => {
    const scrollingElement = document.scrollingElement;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    if (scrollingElement) scrollingElement.scrollTop = 0;
    document.body.scrollTop = 0;
    document.documentElement.scrollTop = 0;
  }, [route, store.account?.id]);

  useEffect(() => {
    if (!store.account) {
      setRoute("home");
      setBackRoute("home");
      setQuickOpen(false);
      setQuickIntent(undefined);
      setAnimalToOpen(undefined);
      setNfcAnimalId(undefined);
      return;
    }
    if (store.account.access.kind === "staff" && !staffRouteAllowed(route, store.account.access.staffRole)) {
      setRoute("home");
      setBackRoute("home");
      setQuickOpen(false);
      return;
    }
    if (route === "water") setRoute("operations");
    if (route === "admin" && !["moderator", "admin", "owner"].includes(store.account.role)) setRoute("home");
  }, [route, store.account?.id, store.account?.role, store.account?.access.kind, store.account?.access.staffRole]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let handle: { remove: () => Promise<void> } | undefined;
    void CapacitorApp.addListener("backButton", () => {
      if (quickOpen) { closeQuick(); return; }
      if (modalNavigationOpen) { requestCloseTopOverlay(); return; }
      if (!store.account) { void CapacitorApp.exitApp(); return; }
      if (!mainRouteIds.includes(route)) { goBack(); return; }
      if (route !== "home") { navigate("home"); return; }
      void CapacitorApp.exitApp();
    }).then((listener) => { handle = listener; });
    return () => { void handle?.remove(); };
  }, [quickOpen, modalNavigationOpen, route, store.account]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !store.configured) return;
    let active = true;
    let handle: { remove: () => Promise<void> } | undefined;
    async function receive(url?: string) {
      if (!url?.startsWith("br.com.hydraagro.app://auth/")) return;
      try {
        const recovery = await handleAuthCallbackUrl(url);
        const { Browser } = await import("@capacitor/browser");
        await Browser.close().catch(() => undefined);
        if (active && recovery) setPasswordRecovery(true);
      } catch {
        // O fluxo de login permanece disponível quando o link expirou.
      }
    }
    void CapacitorApp.getLaunchUrl().then((result) => void receive(result?.url));
    void CapacitorApp.addListener("appUrlOpen", ({ url }) => { void receive(url); }).then((listener) => { handle = listener; });
    return () => { active = false; void handle?.remove(); };
  }, [store.configured]);

  useEffect(() => {
    if (Capacitor.isNativePlatform() || !store.configured || !supabase) return;

    if (window.location.pathname.includes("/auth/recovery")) {
      setPasswordRecovery(true);
      window.history.replaceState({}, document.title, "/");
    }

    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setPasswordRecovery(true);
        window.history.replaceState({}, document.title, "/");
      }
    });

    return () => listener.subscription.unsubscribe();
  }, [store.configured]);

  useEffect(() => {
    if (Capacitor.isNativePlatform() || !store.account || publicAnimal || store.account.access.kind === "staff") return;
    const url = new URL(window.location.href);
    const animalId = url.searchParams.get("animal");
    const nfcCode = url.searchParams.get("nfc")?.trim().toLowerCase();
    if (!animalId && !nfcCode) return;

    const found = store.account.animals.find((animal) =>
      (animalId && animal.id === animalId) ||
      (nfcCode && animal.electronicId?.trim().toLowerCase() === nfcCode),
    );
    if (!found) return;

    setAnimalToOpen(found.id);
    setRouteMotion("forward");
    setRoute("herd");
    url.searchParams.delete("animal");
    url.searchParams.delete("nfc");
    window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
  }, [store.account?.id, store.account?.animals, store.account?.access.kind, publicAnimal]);

  function navigate(next: AppRoute) {
    if (next === "water") next = "operations";
    if (next === route) return;
    const access = store.account?.access;
    if (access?.kind === "staff" && !staffRouteAllowed(next, access.staffRole)) return;
    if (next === "admin" && !["moderator", "admin", "owner"].includes(store.account?.role ?? "user")) return;
    const currentIndex = mainTabs.findIndex((tab) => tab.id === route);
    const nextIndex = mainTabs.findIndex((tab) => tab.id === next);
    setRouteMotion(currentIndex >= 0 && nextIndex >= 0 && nextIndex < currentIndex ? "back" : "forward");
    if (!mainRouteIds.includes(next)) setBackRoute(route);
    setRoute(next);
  }

  function goBack() {
    setRouteMotion("back");
    setRoute(backRoute === route ? "home" : backRoute);
  }

  function openQuick() {
    if (store.account?.access.kind === "staff") return;
    if (quickTimer.current) window.clearTimeout(quickTimer.current);
    setQuickClosing(false);
    setQuickOpen(true);
  }

  function closeQuick(afterClose?: () => void) {
    if (quickClosing) return;
    setQuickClosing(true);
    quickTimer.current = window.setTimeout(() => {
      setQuickOpen(false);
      setQuickClosing(false);
      afterClose?.();
    }, 230);
  }

  function openNfc(animalId?: string) {
    setBackRoute(route);
    setNfcAnimalId(animalId);
    navigate("nfc");
  }

  function openMainTab(tab: AppRoute) {
    if (tab === "nfc") setNfcAnimalId(undefined);
    navigate(tab);
  }

  function launchQuick(kind: NonNullable<typeof quickIntent>["kind"], next: AppRoute) {
    setQuickIntent((current) => ({ kind, request: (current?.request ?? 0) + 1 }));
    navigate(next);
  }

  if (publicAnimal) {
    return <PublicAnimalScreen animal={publicAnimal} onOpenApp={() => window.location.assign(clearPublicAnimalParams())} />;
  }

  if (!store.configured) return <BackendSetupScreen />;

  const splashLayer = splash ? <main className="splash-screen"><SplashBrand /></main> : null;

  if (!store.ready) return splashLayer;

  if (!store.account) return <><AuthFlow onLogin={store.login} onGoogleLogin={store.loginGoogle} onStaffLogin={store.loginStaff} onSignup={store.createAccount} onResetPassword={store.resetPassword} />{splashLayer}</>;
  if (store.account.bannedAt) return <><BannedScreen reason={store.account.banReason} logout={store.logout} />{splashLayer}</>;
  if (passwordRecovery) return <><PasswordRecoveryScreen save={async (password) => { const result = await store.changeCredentials({ password }); if (result.ok) window.setTimeout(() => setPasswordRecovery(false), 650); return result; }} logout={async () => { setPasswordRecovery(false); await store.logout(); }} />{splashLayer}</>;

  const account = store.account;
  const isStaff = account.access.kind === "staff";
  const canOpenAnimalManagement = !isStaff || account.access.staffRole === "manager";

  function mainContent() {
    if (isStaff && !staffRouteAllowed(route, account.access.staffRole)) {
      return <StaffHomeScreen account={account} announcements={store.announcements} navigate={navigate} />;
    }
    switch (route) {
      case "home": return isStaff ? <StaffHomeScreen account={account} announcements={store.announcements} navigate={navigate} /> : <HomeScreen account={account} announcements={store.announcements} navigate={navigate} onQuickAction={openQuick} />;
      case "herd": return <HerdScreen account={account} updateAccount={store.updateAccount} openNfc={openNfc} focusAnimalId={animalToOpen} saveAnimalPhoto={store.saveAnimalPhoto} createRequest={quickIntent?.kind === "animal" ? quickIntent.request : undefined} onRequestHandled={() => setQuickIntent(undefined)} />;
      case "monitor": return <MonitorScreen account={account} updateAccount={store.updateAccount} saveMonitoringPhoto={store.saveMonitoringPhoto} createSectorRequest={quickIntent?.kind === "sector" ? quickIntent.request : undefined} onRequestHandled={() => setQuickIntent(undefined)} />;
      case "profile": return isStaff ? <StaffProfileScreen account={account} navigate={navigate} logout={store.logout} /> : <ProfileScreen account={account} links={store.links} updateAccount={store.updateAccount} navigate={navigate} logout={store.logout} saveAvatar={store.saveAvatar} savePropertyCover={store.savePropertyCover} changeCredentials={store.changeCredentials} />;
      case "community": return <CommunityScreen account={account} onBack={goBack} publishPost={store.publishPost} likePost={store.likePost} commentPost={store.commentPost} deletePost={store.deletePost} refreshCommunity={store.refreshCommunity} createRequest={quickIntent?.kind === "post" ? quickIntent.request : undefined} onRequestHandled={() => setQuickIntent(undefined)} />;
      case "challenges": return <ChallengesScreen account={account} onBack={goBack} />;
      case "property": return <PropertyScreen account={account} updateAccount={store.updateAccount} onBack={goBack} />;
      case "activities": return <ActivitiesScreen account={account} updateAccount={store.updateAccount} onBack={goBack} createRequest={quickIntent?.kind === "activity" ? quickIntent.request : undefined} onRequestHandled={() => setQuickIntent(undefined)} />;
      case "operations": return <OperationsScreen account={account} updateAccount={store.updateAccount} onBack={goBack} openNfc={() => openNfc()} />;
      case "assistant": return <HydraAssistantScreen account={account} onBack={goBack} />;
      case "today": return <TodayScreen account={account} syncStatus={store.syncStatus} lastError={store.lastError} onBack={goBack} navigate={navigate} retrySync={store.retrySync} />;
      case "history": return <PropertyHistoryScreen account={account} onBack={goBack} navigate={navigate} />;
      case "nfc": return <NfcScreen account={account} updateAccount={store.updateAccount} onBack={goBack} initialAnimalId={nfcAnimalId} onRealRead={store.registerNfcRead} onFound={(animal) => { if (!canOpenAnimalManagement) return; setAnimalToOpen(animal.id); navigate("herd"); }} />;
      case "production": return <FamilyFarmingScreen account={account} onBack={goBack} />;
      case "notifications": return <NotificationsScreen account={account} updateAccount={store.updateAccount} onBack={goBack} />;
      case "plus": return <PlusScreen account={account} updateAccount={store.updateAccount} onBack={goBack} />;
      case "admin": return ["moderator", "admin", "owner"].includes(account.role) ? <AdminScreen account={account} onBack={goBack} /> : isStaff ? <StaffHomeScreen account={account} announcements={store.announcements} navigate={navigate} /> : <HomeScreen account={account} announcements={store.announcements} navigate={navigate} onQuickAction={openQuick} />;
      default: return null;
    }
  }

  const activeTab: AppRoute = mainRouteIds.includes(route)
    ? route
    : !isStaff && (route === "monitor" || route === "property" || route === "plus" || route === "admin") ? "profile"
    : "home";
  const activeIndex = mainTabs.findIndex((tab) => tab.id === activeTab);
  const navStyle = { "--active-index": activeIndex } as CSSProperties;

  return (
    <>
    <main className="app-shell">
      <div className={`phone-app ${modalNavigationOpen ? "is-overlay-open" : ""}`}>
        <SyncBanner status={store.syncStatus} error={store.lastError} retry={store.retrySync} />
        <div key={route} className={`app-content route-motion-${routeMotion}`}><Suspense fallback={<div className="route-loading"><span /><small>Carregando…</small></div>}>{mainContent()}</Suspense></div>

        <nav className={`bottom-nav ${modalNavigationOpen ? "is-hidden" : ""}`} aria-label="Navegação principal" aria-hidden={modalNavigationOpen} style={navStyle}>
          <span className="bottom-nav-indicator" aria-hidden="true" />
          {mainTabs.map((tab) => {
            const Icon = tab.icon;
            return <button key={tab.id} className={`${activeTab === tab.id ? "active" : ""} ${tab.id === "nfc" ? "nav-nfc" : ""}`.trim()} onClick={() => openMainTab(tab.id)} aria-current={activeTab === tab.id ? "page" : undefined}><span><Icon size={21} strokeWidth={activeTab === tab.id ? 2.5 : 2} /></span><small>{tab.label}</small></button>;
          })}
        </nav>

        {quickOpen && !isStaff && <div className={`quick-layer ${quickClosing ? "is-closing" : ""}`} onMouseDown={() => closeQuick()}><section className="quick-sheet" onMouseDown={(event) => event.stopPropagation()}><div className="sheet-handle" /><header><div><span className="eyebrow orange">Nova ação</span><h2>O que você quer registrar?</h2></div><button className="icon-button" onClick={() => closeQuick()} aria-label="Fechar ações rápidas"><X size={22} /></button></header><div className="quick-grid"><QuickAction index={0} icon={<UsersRound size={22} />} title="Equipe e operações" subtitle="Funcionários, relatórios e tarefas" onClick={() => closeQuick(() => navigate("operations"))} /><QuickAction index={1} icon={<Cow size={22} />} title="Cadastrar animal" subtitle="Adicionar ao rebanho" onClick={() => closeQuick(() => launchQuick("animal", "herd"))} /><QuickAction index={2} icon={<Nfc size={22} />} title="Ler identificação" subtitle="NFC/RFID ou código" onClick={() => closeQuick(() => openNfc())} /><QuickAction index={3} icon={<ClipboardCheck size={22} />} title="Nova atividade" subtitle="Adicionar à rotina" onClick={() => closeQuick(() => launchQuick("activity", "activities"))} /><QuickAction index={4} icon={<MapPin size={22} />} title="Criar setor" subtitle="Organizar a propriedade" onClick={() => closeQuick(() => launchQuick("sector", "monitor"))} /><QuickAction index={5} icon={<Send size={22} />} title="Nova publicação" subtitle="Publicar na comunidade" onClick={() => closeQuick(() => launchQuick("post", "community"))} /></div></section></div>}
        <AppToastRegion />
      </div>
    </main>
    {splashLayer}
    </>
  );
}

function QuickAction({ icon, title, subtitle, onClick, index }: { icon: React.ReactNode; title: string; subtitle: string; onClick: () => void; index: number }) {
  return <button style={{ "--quick-index": index } as CSSProperties} onClick={onClick}><span>{icon}</span><div><strong>{title}</strong><small>{subtitle}</small></div><Plus size={17} /></button>;
}