import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authEmailMocks = vi.hoisted(() => ({
  requestLoginCode: vi.fn(async () => undefined),
  verifyLoginCode: vi.fn(async () => ({ session: {}, user: {} })),
  requestBrandedPasswordRecovery: vi.fn(async () => undefined),
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

  it("mantém a entrada principal e oferece os fluxos de conta", () => {
    render(<AuthFlow {...handlers} />);
    expect(screen.getByRole("button", { name: /criar conta/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /acesso de funcionário/i })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: /^entrar$/i }));
    expect(screen.getByRole("button", { name: /entrar como funcionário/i })).toBeEnabled();
    fireEvent.change(screen.getByLabelText(/e-mail/i), { target: { value: "produtor@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /avançar/i }));
    expect(screen.getByRole("button", { name: /esqueci minha senha/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /entrar com código/i })).toBeEnabled();
  });

  it("abre o acesso de funcionário sem pedir e-mail ou senha", async () => {
    render(<AuthFlow {...handlers} />);
    fireEvent.click(screen.getByRole("button", { name: /acesso de funcionário/i }));
    expect(screen.getByRole("heading", { name: /acesso de funcionário/i })).toBeInTheDocument();
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
    expect(await screen.findByRole("heading", { name: /código de acesso/i })).toBeInTheDocument();

    const code = screen.getByPlaceholderText("000000");
    fireEvent.change(code, { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: /confirmar código/i }));

    await waitFor(() => expect(authEmailMocks.verifyLoginCode).toHaveBeenCalledWith("produtor@example.com", "123456"));
  });

  it("abre a recuperação e envia o link pelo e-mail do Hydra Agro", async () => {
    render(<AuthFlow {...handlers} />);
    fireEvent.click(screen.getByRole("button", { name: /^entrar$/i }));
    fireEvent.change(screen.getByLabelText(/^e-mail$/i), { target: { value: "produtor@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /avançar/i }));
    fireEvent.click(screen.getByRole("button", { name: /esqueci minha senha/i }));

    expect(screen.getByRole("heading", { name: /recuperar acesso/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /enviar link de recuperação/i }));

    await waitFor(() => expect(authEmailMocks.requestBrandedPasswordRecovery).toHaveBeenCalledWith("produtor@example.com"));
    expect(await screen.findByRole("status")).toHaveTextContent(/se houver uma conta/i);
    expect(handlers.onResetPassword).not.toHaveBeenCalled();
  });
});
