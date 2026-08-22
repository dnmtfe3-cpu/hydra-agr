import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
    const email = screen.getByLabelText(/e-mail/i);
    fireEvent.change(email, { target: { value: "invalido" } });
    fireEvent.submit(email.closest("form")!);
    expect(screen.getByText(/digite um e-mail válido/i)).toBeInTheDocument();
    expect(handlers.onLogin).not.toHaveBeenCalled();
  });

  it("oferece criação de conta, funcionário e recuperação de senha", () => {
    render(<AuthFlow {...handlers} />);
    expect(screen.getByRole("button", { name: /criar conta/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /entrar como funcionário/i })).toBeEnabled();
    fireEvent.change(screen.getByLabelText(/e-mail/i), { target: { value: "produtor@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /avançar/i }));
    expect(screen.getByRole("button", { name: /esqueci minha senha/i })).toBeEnabled();
  });

  it("abre o acesso de funcionário sem pedir e-mail ou senha", async () => {
    render(<AuthFlow {...handlers} />);
    fireEvent.click(screen.getByRole("button", { name: /entrar como funcionário/i }));
    expect(screen.getByRole("heading", { name: /acesso de funcionário/i })).toBeInTheDocument();
    const code = screen.getByLabelText(/código de acesso/i);
    fireEvent.change(code, { target: { value: "HA-7K3M-9Q2P-4RX8" } });
    fireEvent.click(screen.getByRole("button", { name: /entrar na propriedade/i }));
    expect(handlers.onStaffLogin).toHaveBeenCalledWith("HA-7K3M-9Q2P-4RX8");
  });

  it("abre a recuperação e solicita o link para o e-mail informado", async () => {
    render(<AuthFlow {...handlers} />);
    fireEvent.change(screen.getByLabelText(/^e-mail$/i), { target: { value: "produtor@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /avançar/i }));
    fireEvent.click(screen.getByRole("button", { name: /esqueci minha senha/i }));

    expect(screen.getByRole("heading", { name: /recuperar acesso/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /enviar link de recuperação/i }));

    expect(handlers.onResetPassword).toHaveBeenCalledWith("produtor@example.com");
    expect(await screen.findByRole("status")).toHaveTextContent("ok");
  });
});
