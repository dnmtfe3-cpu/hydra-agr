/* Pré-carrega as telas antes da primeira navegação para evitar fallback e atraso visual. */

const routeModules = [
  () => import("./features/herd/herd-screen"),
  () => import("./features/monitor/monitor-screen"),
  () => import("./features/profile/profile-screen"),
  () => import("./features/community/community-screen"),
  () => import("./features/challenges/challenges-screen"),
  () => import("./features/property/property-screen"),
  () => import("./features/activities/activities-screen"),
  () => import("./features/operations/operations-screen"),
  () => import("./features/assistant"),
  () => import("./features/today"),
  () => import("./features/history"),
  () => import("./features/nfc/nfc-screen"),
  () => import("./features/notifications/notifications-screen"),
  () => import("./features/premium/plus-screen"),
  () => import("./features/family-farming/family-farming-screen"),
  () => import("./features/admin/admin-screen"),
];

void Promise.allSettled(routeModules.map((load) => load()));
