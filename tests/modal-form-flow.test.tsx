import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WaterScreen } from "../src/features/water/water-screen";
import { createEmptyAccount, type UpdateAccount } from "../src/lib/hydra-types";

describe("fluxo assíncrono dos formulários em modal", () => {
  it("mantém modal e valores preenchidos quando o backend falha", async () => {
    const account = createEmptyAccount({ id: "user-a", email: "a@hydra.test" });
    account.waterSources = [{ id: "source-a", name: "Cisterna", type: "Cisterna", status: "ativa" }];
    const updateAccount = vi.fn(async () => { throw new Error("Servidor indisponível para o teste."); }) as UpdateAccount;

    render(<WaterScreen account={account} updateAccount={updateAccount} />);
    fireEvent.click(screen.getByRole("button", { name: /registrar leitura/i }));
    const quantity = await screen.findByLabelText("Quantidade usada (L)");
    fireEvent.change(quantity, { target: { value: "850" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar leitura" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Servidor indisponível");
    expect(screen.getByRole("dialog", { name: "Registrar água" })).toBeInTheDocument();
    expect(quantity).toHaveValue("850");
    await waitFor(() => expect(screen.getByRole("button", { name: "Confirmar leitura" })).not.toBeDisabled());
  });
});
