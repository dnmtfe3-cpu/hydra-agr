import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NfcScreen } from "../src/features/nfc/nfc-screen";
import { createEmptyAccount, type UpdateAccount } from "../src/lib/hydra-types";

describe("NFC na web", () => {
  it("não oferece leitura NFC simulada e mantém apenas fallbacks reais", () => {
    const account = createEmptyAccount({ id: "owner-web", email: "owner@hydra.test" });
    account.animals = [{
      id: "animal-1",
      identification: "BRINCO-027",
      name: "Estrela",
      species: "Bovino",
      breed: "Nelore",
      status: "Ativo",
      electronicId: "TAG-027",
    }];
    const onRealRead = vi.fn(async () => true);
    const onFound = vi.fn();

    render(<NfcScreen
      account={account}
      updateAccount={vi.fn<UpdateAccount>(async () => undefined)}
      onBack={vi.fn()}
      onFound={onFound}
      onRealRead={onRealRead}
    />);

    expect(screen.getByText("NFC identifica, mas não rastreia")).toBeInTheDocument();
    expect(screen.queryByText("Modo demonstração")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Simular leitura" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Simular localização" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Como usar NFC" })).toBeInTheDocument();
    expect(screen.getByText(/Neste dispositivo, use o QR Code ou o código da identificação/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Código da identificação")).toBeInTheDocument();
    expect(onRealRead).not.toHaveBeenCalled();
    expect(onFound).not.toHaveBeenCalled();
  });
});
