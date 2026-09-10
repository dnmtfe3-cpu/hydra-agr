import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NfcScreen } from "../src/features/nfc/nfc-screen";
import { createEmptyAccount, type UpdateAccount } from "../src/lib/hydra-types";

afterEach(() => vi.useRealTimers());

describe("demonstração NFC na web", () => {
  it("simula a aproximação e mostra um animal sem registrar leitura real", async () => {
    vi.useFakeTimers();
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

    render(<NfcScreen
      account={account}
      updateAccount={vi.fn<UpdateAccount>(async () => undefined)}
      onBack={vi.fn()}
      onFound={vi.fn()}
      onRealRead={onRealRead}
    />);

    fireEvent.click(screen.getByRole("button", { name: "Simular leitura" }));
    expect(screen.getByRole("status", { name: "Lendo etiqueta NFC" })).toBeInTheDocument();

    await act(async () => { await vi.advanceTimersByTimeAsync(1800); });

    expect(screen.getByText("Estrela")).toBeInTheDocument();
    expect(screen.getByText("Tag lida. Animal localizado na demonstração.")).toBeInTheDocument();
    expect(onRealRead).not.toHaveBeenCalled();
  });
});
