import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd());
const migration = readFileSync(resolve(root, "supabase/migrations/202608160001_hydra_agro_plus.sql"), "utf8");
const plusScreen = readFileSync(resolve(root, "src/features/premium/plus-screen.tsx"), "utf8");
const profileScreen = readFileSync(resolve(root, "src/features/profile/profile-screen.tsx"), "utf8");
const adminScreen = readFileSync(resolve(root, "src/features/admin/admin-screen.tsx"), "utf8");
const hydraStore = readFileSync(resolve(root, "src/hooks/use-hydra-store.ts"), "utf8");
const waterScreen = readFileSync(resolve(root, "src/features/water/water-screen.tsx"), "utf8");
const communityScreen = readFileSync(resolve(root, "src/features/community/community-screen.tsx"), "utf8");
const styles = readFileSync(resolve(root, "src/globals.css"), "utf8");

describe("contratos do Hydra Agro+ e confirmações", () => {
  it("protege a assinatura no servidor sem migration destrutiva", () => {
    expect(migration).toContain("security definer");
    expect(migration).toContain("admin_set_subscription");
    expect(migration).toContain("'admin'::public.app_role, 'owner'::public.app_role");
    expect(migration).toContain("revoke insert, update, delete on public.subscriptions from authenticated");
    expect(migration).toContain("premium_started_at");
    expect(migration).toContain("premium_expires_at");
    expect(migration).not.toMatch(/\b(drop table|truncate)\b/i);
    expect(hydraStore).toContain('profile: { ...cached.profile, plan: "Gratuito" }');
    expect(hydraStore).toContain('subscription: { status: "unverified" }');
  });

  it("mantém pagamento manual e apoio voluntário separados", () => {
    expect(plusScreen).toContain("R$ 6/mês");
    expect(plusScreen).toContain("Continuar pelo Instagram");
    expect(plusScreen).toContain("não simula pagamento");
    expect(profileScreen).toContain("Apoio não é assinatura");
    expect(profileScreen).toContain("Quero apoiar o projeto");
    expect(adminScreen).toContain("Liberar Hydra Agro+");
    expect(adminScreen).toContain("Remover Hydra Agro+");
  });

  it("usa dados reais e oferece confirmações explícitas", () => {
    expect(plusScreen).toContain("account.waterRecords");
    expect(plusScreen).toContain("account.animals");
    expect(plusScreen).toContain("Histórico completo");
    expect(communityScreen).toContain('title="Confirmar aviso"');
    expect(communityScreen).toContain('confirmLabel="Publicar aviso"');
    expect(communityScreen).toContain('title="Confirmar exclusão"');
    expect(waterScreen).toContain("Confirmar leitura");
    expect(waterScreen).toContain("Confirmar exclusão");
  });

  it("corrige globalmente altura e scroll dos modais", () => {
    expect(styles).toContain("height: 100dvh");
    expect(styles).toContain("height: min(94dvh, 920px)");
    expect(styles).toContain("max-height: calc(100dvh");
    expect(styles).toContain("overflow-y: auto");
    expect(styles).toContain("env(safe-area-inset-bottom)");
    expect(styles).toContain(".bottom-nav.is-hidden");
    expect(styles).toContain("translate3d(-50%, calc(100% + 28px), 0)");
  });
});
