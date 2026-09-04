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
  it("abre login e valida o e-mail", () => {
    render(<AuthFlow {...handlers} />);
    fireEvent.click(screen.getByRole("button", { name: /^login$/i }));

    const email = screen.getByPlaceholderText(/^email$/i);
    fireEvent.change(email, { target: { value: "invalido" } });
    fireEvent.submit(email.closest("form")!);

    expect(screen.getByText(/digite um e-mail válido/i)).toBeInTheDocument();
    expect(handlers.onLogin).not.toHaveBeenCalled();
  });

  it("entra com e-mail e senha", async () => {
    render(<AuthFlow {...handlers} />);
    fireEvent.click(screen.getByRole("button", { name: /^login$/i }));

    fireEvent.change(screen.getByPlaceholderText(/^email$/i), { target: { value: "produtor@example.com" } });
    fireEvent.change(screen.getByPlaceholderText(/^senha$/i), { target: { value: "senha-segura" } });
    fireEvent.click(screen.getByRole("button", { name: /^entrar$/i }));

    await waitFor(() => expect(handlers.onLogin).toHaveBeenCalledWith("produtor@example.com", "senha-segura"));
  });

  it("abre o acesso de funcionário pelo login", async () => {
    render(<AuthFlow {...handlers} />);
    fireEvent.click(screen.getByRole("button", { name: /^login$/i }));
    fireEvent.click(screen.getByRole("button", { name: /acesso de funcionário/i }));

    const code = screen.getByPlaceholderText("HA-7K3M-9Q2P-4RX8");
    fireEvent.change(code, { target: { value: "HA-7K3M-9Q2P-4RX8" } });
    fireEvent.click(screen.getByRole("button", { name: /^entrar$/i }));

    await waitFor(() => expect(handlers.onStaffLogin).toHaveBeenCalledWith("HA-7K3M-9Q2P-4RX8"));
  });

  it("mantém o fluxo de recuperação por código", async () => {
    render(<AuthFlow {...handlers} />);
    fireEvent.click(screen.getByRole("button", { name: /^login$/i }));
    fireEvent.click(screen.getByRole("button", { name: /esqueceu sua senha/i }));

    fireEvent.change(screen.getByPlaceholderText(/^email$/i), { target: { value: "produtor@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /^enviar código$/i }));

    await waitFor(() => expect(authEmailMocks.requestPasswordResetCode).toHaveBeenCalledWith("produtor@example.com"));

    const code = await screen.findByPlaceholderText("000000");
    fireEvent.change(code, { target: { value: "654321" } });
    fireEvent.click(screen.getByRole("button", { name: /^continuar$/i }));

    await waitFor(() => expect(authEmailMocks.verifyPasswordResetCode).toHaveBeenCalledWith("produtor@example.com", "654321"));
    await waitFor(() => expect(authEmailMocks.openPasswordRecoveryLink).toHaveBeenCalledWith("https://example.com/recovery"));
  });

  it("mantém a criação de conta no layout novo", () => {
    render(<AuthFlow {...handlers} />);
    fireEvent.click(screen.getByRole("button", { name: /^criar conta$/i }));

    expect(screen.getByRole("heading", { name: /comece agora a usar o hydra agro/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/^email$/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/^senha$/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/confirmar a senha/i)).toBeInTheDocument();
  });
});
