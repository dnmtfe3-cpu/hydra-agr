import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authEmailMocks = vi.hoisted(() => ({
  requestLoginCode: vi.fn(async () => undefined),
  verifyLoginCode: vi.fn(async () => ({ session: {}, user: {} })),
  requestPasswordResetCode: vi.fn(async () => undefined),
  verifyPasswordResetCode: vi.fn(async () => "https://example.com/recovery"),
  openPasswordRecoveryLink: vi.fn(async () => undefined),
  requestSignupCode: vi.fn(async () => undefined),
  verifySignupCode: vi.fn(async () => "verification-token"),
  requestPasswordChangeCode: vi.fn(async () => undefined),
  verifyPasswordChangeCode: vi.fn(async () => "verification-token"),
}));

vi.mock("../src/services/auth-email-service", () => authEmailMocks);

import { AuthFlow } from "../src/features/auth/auth-flow";

const handlers = {
  onLogin: vi.fn(async () => ({ ok: true, message: "ok" })),
  onGoogleLogin: vi.fn(async () => ({ ok: true, message: "ok" })),
  onStaffLogin: vi.fn(async () => ({ ok: true, message: "ok" })),
  onSignup: vi.fn(async () => ({ ok: true, message: "ok" })),
  onResetPassword: vi.fn(async () => ({ ok: true, message: "ok" })),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("autenticação", () => {
  it("valida o e-mail antes de pedir senha", () => {
    render(<AuthFlow {...handlers} />);
    fireEvent.click(screen.getByRole("button", { name: /^entrar$/i }));
    const email = screen.getByLabelText(/e-mail/i);
    fireEvent.change(email, { target: { value: "invalido" } });
    fireEvent.submit(email.closest("form")!);
    expect(screen.getByText(/digite um e-mail válido/i)).toBeInTheDocument();
    expect(handlers.onLogin).not.toHaveBeenCalled();
  });

  it("mantém senha, Google, código e funcionário disponíveis", () => {
    render(<AuthFlow {...handlers} />);
    expect(screen.getByRole("button", { name: /criar conta/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /acesso de funcionário/i })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: /^entrar$/i }));
    expect(screen.getByRole("button", { name: /continuar com google/i })).toBeEnabled();
    fireEvent.change(screen.getByLabelText(/e-mail/i), { target: { value: "produtor@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /avançar/i }));
    expect(screen.getByRole("button", { name: /esqueci minha senha/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /entrar com código/i })).toBeEnabled();
  });

  it("abre o acesso de funcionário sem pedir e-mail ou senha", async () => {
    render(<AuthFlow {...handlers} />);
    fireEvent.click(screen.getByRole("button", { name: /acesso de funcionário/i }));
    const code = screen.getByLabelText(/código de acesso/i);
    fireEvent.change(code, { target: { value: "HA-7K3M-9Q2P-4RX8" } });
    fireEvent.click(screen.getByRole("button", { name: /entrar na propriedade/i }));
    expect(handlers.onStaffLogin).toHaveBeenCalledWith("HA-7K3M-9Q2P-4RX8");
  });

  it("envia e valida o código de acesso pelo e-mail", async () => {
    render(<AuthFlow {...handlers} />);
    fireEvent.click(screen.getByRole("button", { name: /^entrar$/i }));
    fireEvent.change(screen.getByLabelText(/^e-mail$/i), { target: { value: "produtor@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /avançar/i }));
    fireEvent.click(screen.getByRole("button", { name: /entrar com código/i }));
    await waitFor(() => expect(authEmailMocks.requestLoginCode).toHaveBeenCalledWith("produtor@example.com"));
    const code = await screen.findByPlaceholderText("000000");
    fireEvent.change(code, { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: /confirmar código/i }));
    await waitFor(() => expect(authEmailMocks.verifyLoginCode).toHaveBeenCalledWith("produtor@example.com", "123456"));
  });

  it("exige código antes de abrir a troca de senha", async () => {
    render(<AuthFlow {...handlers} />);
    fireEvent.click(screen.getByRole("button", { name: /^entrar$/i }));
    fireEvent.change(screen.getByLabelText(/^e-mail$/i), { target: { value: "produtor@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /avançar/i }));
    fireEvent.click(screen.getByRole("button", { name: /esqueci minha senha/i }));
    fireEvent.click(screen.getByRole("button", { name: /^enviar código$/i }));
    await waitFor(() => expect(authEmailMocks.requestPasswordResetCode).toHaveBeenCalledWith("produtor@example.com"));
    const code = await screen.findByPlaceholderText("000000");
    fireEvent.change(code, { target: { value: "654321" } });
    fireEvent.click(screen.getByRole("button", { name: /confirmar e trocar senha/i }));
    await waitFor(() => expect(authEmailMocks.verifyPasswordResetCode).toHaveBeenCalledWith("produtor@example.com", "654321"));
    await waitFor(() => expect(authEmailMocks.openPasswordRecoveryLink).toHaveBeenCalledWith("https://example.com/recovery"));
  });
});
