import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AuthFlow } from "../src/features/auth/auth-flow";

const handlers = {
  onLogin: vi.fn(async () => ({ ok: true, message: "ok" })),
  onGoogleLogin: vi.fn(async () => ({ ok: true, message: "ok" })),
  onStaffLogin: vi.fn(async () => ({ ok: true, message: "ok" })),
  onSignup: vi.fn(async () => ({ ok: true, message: "ok" })),
  onResetPassword: vi.fn(async () => ({ ok: true, message: "ok" })),
};

describe("autenticação", () => {
  it("mostra a tela inicial restaurada", () => {
    render(<AuthFlow {...handlers} />);
    expect(screen.getByRole("button", { name: /^entrar$/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /criar conta/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /acesso de funcionário/i })).toBeEnabled();
  });

  it("abre o formulário de login", () => {
    render(<AuthFlow {...handlers} />);
    fireEvent.click(screen.getByRole("button", { name: /^entrar$/i }));
    expect(screen.getByRole("heading", { name: /bem-vindo de volta/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/e-mail/i)).toBeInTheDocument();
  });

  it("abre o fluxo de criação de conta", () => {
    render(<AuthFlow {...handlers} />);
    fireEvent.click(screen.getByRole("button", { name: /criar conta/i }));
    expect(screen.getByRole("heading", { name: /vamos criar sua conta/i })).toBeInTheDocument();
  });
});
