import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { EasyModeProvider, GuidedForm, AudioHelp } from "../src/features/easy-mode/easy-mode";
import { EasyModeSetting } from "../src/features/easy-mode/easy-mode-setting";
import { Field } from "../src/components/ui";

afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals(); });

function DemoForm({ save }: { save: () => void }) {
  const [name, setName] = useState("");
  return <GuidedForm onSubmit={event => { event.preventDefault(); save(); }}>
    <Field label="Nome"><input value={name} onChange={event => setName(event.target.value)} /></Field>
    <Field label="Quantidade"><input /></Field>
    <div className="modal-action-row"><button type="submit">Salvar</button></div>
  </GuidedForm>;
}

describe("Modo Fácil", () => {
  it("starts off, restores the original form when disabled, and stores the preference per account", () => {
    render(<EasyModeProvider accountId="a"><EasyModeSetting /><DemoForm save={vi.fn()} /></EasyModeProvider>);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
    expect(screen.getAllByRole("textbox")).toHaveLength(2);
    fireEvent.click(screen.getByRole("switch"));
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
    expect(localStorage.getItem("hydra-easy-mode:a")).toBe("true");
    fireEvent.click(screen.getByRole("switch"));
    expect(screen.getAllByRole("textbox")).toHaveLength(2);
    expect(document.body).not.toHaveClass("hydra-easy-mode");
  });

  it("keeps entered values across steps and only saves after confirmation", () => {
    localStorage.setItem("hydra-easy-mode:a", "true");
    const save = vi.fn();
    render(<EasyModeProvider accountId="a"><DemoForm save={save} /></EasyModeProvider>);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Estrela" } });
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(screen.getByRole("textbox")).toHaveValue("Estrela");
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("cleans up on logout and does not enable another account", () => {
    localStorage.setItem("hydra-easy-mode:a", "true");
    const view = render(<EasyModeProvider key="a" accountId="a"><EasyModeSetting /></EasyModeProvider>);
    expect(document.body).toHaveClass("hydra-easy-mode");
    view.rerender(<EasyModeProvider key="b" accountId="b"><EasyModeSetting /></EasyModeProvider>);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
    view.unmount();
    expect(document.body).not.toHaveClass("hydra-easy-mode");
  });

  it("speaks only when requested, in Portuguese", () => {
    const speak = vi.fn();
    vi.stubGlobal("speechSynthesis", { speak, cancel: vi.fn() });
    vi.stubGlobal("SpeechSynthesisUtterance", class { constructor(public text: string) {} });
    render(<AudioHelp text="Animais. Veja seus animais." />);
    expect(speak).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button"));
    expect(speak).toHaveBeenCalledWith(expect.objectContaining({ lang: "pt-BR", text: "Animais. Veja seus animais." }));
  });
});
