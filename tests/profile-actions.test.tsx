import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProfileScreen } from "../src/features/profile/profile-screen";
import { createEmptyAccount, type UpdateAccount } from "../src/lib/hydra-types";

function setup() {
  const account = createEmptyAccount({ id: "profile-user", email: "produtor@hydra.test" });
  account.profile.name = "Produtor Teste";
  account.property.name = "Fazenda Teste";
  const updateAccountMock = vi.fn<UpdateAccount>(async () => undefined);
  const updateAccount = updateAccountMock;
  const navigate = vi.fn();
  const logout = vi.fn(async () => undefined);
  const changeCredentials = vi.fn(async () => ({ ok: true, message: "Atualizado" }));

  render(<ProfileScreen
    account={account}
    links={[]}
    updateAccount={updateAccount}
    navigate={navigate}
    logout={logout}
    saveAvatar={async () => false}
    savePropertyCover={async () => false}
    changeCredentials={changeCredentials}
  />);

  return { account, updateAccount, updateAccountMock, logout, changeCredentials };
}

function openSettings() {
  fireEvent.click(screen.getByRole("button", { name: "Abrir menu do perfil" }));
  expect(screen.getByRole("dialog", { name: "Menu e configurações" })).toBeInTheDocument();
}

function openSetting(buttonName: string | RegExp) {
  openSettings();
  fireEvent.click(screen.getByRole("button", { name: buttonName }));
}

describe("ações de preferências e segurança", () => {
  it.each([
    [/^Segurança/, "E-mail e senha"],
    [/^Notificações/, "Notificações do aplicativo"],
    [/^Apoie o Hydra Agro/, "Apoie o Hydra Agro"],
    [/^Termos de uso/, "Termos de uso"],
    [/^Política de privacidade/, "Política de privacidade"],
    [/^Sobre o Hydra Agro/, "Sobre o Hydra Agro"],
  ] as const)("abre %s no modal correto", (buttonName, dialogName) => {
    setup();
    openSetting(buttonName);
    expect(screen.getByRole("dialog", { name: dialogName })).toBeInTheDocument();
  });

  it("salva as preferências de notificações no estado da conta", async () => {
    const { account, updateAccountMock } = setup();
    openSetting(/^Notificações/);
    fireEvent.click(screen.getByRole("switch", { name: "Avisos do aplicativo" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(updateAccountMock).toHaveBeenCalledTimes(1));
    const updater = updateAccountMock.mock.calls[0][0];
    expect(updater(account).settings.pushNotifications).toBe(false);
    expect(updateAccountMock.mock.calls[0][1]).toEqual({ requireRemote: true });
  });

  it("altera a senha usando a autenticação existente", async () => {
    const { changeCredentials } = setup();
    openSetting(/^Segurança/);
    fireEvent.change(screen.getByLabelText(/^Nova senha/), { target: { value: "senha-segura-123" } });
    fireEvent.change(screen.getByLabelText("Confirmar nova senha"), { target: { value: "senha-segura-123" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() => expect(changeCredentials).toHaveBeenCalledWith({ password: "senha-segura-123" }));
  });

  it("mostra conteúdo completo nos termos", () => {
    setup();
    openSetting(/^Termos de uso/);
    expect(screen.getByRole("heading", { name: "1. Para que serve" })).toBeInTheDocument();
    expect(screen.getByText(/não substitui orientação veterinária/i)).toBeInTheDocument();
  });

  it("abre a confirmação e conclui a saída da conta", async () => {
    const { logout } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Sair desta conta" }));
    expect(screen.getByRole("dialog", { name: "Finalizar sessão" })).toBeInTheDocument();
    expect(screen.getByText("Deseja sair desta conta?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sair" }));
    await waitFor(() => expect(logout).toHaveBeenCalledTimes(1));
  });

  it("cancela a saída sem encerrar a sessão", () => {
    const { logout } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Sair desta conta" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(logout).not.toHaveBeenCalled();
  });
});