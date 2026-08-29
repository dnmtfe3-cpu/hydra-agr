import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { MunicipalityPicker } from "../src/components/municipality-picker";

function Harness({ initialValue = "" }: { initialValue?: string }) {
  const [municipality, setMunicipality] = useState(initialValue);
  return <MunicipalityPicker value={municipality} onChange={setMunicipality} />;
}

describe("compatibilidade de município", () => {
  it("não mantém seletor regional nem lista fixa de cidades", () => {
    const { container } = render(<Harness initialValue="São Paulo" />);

    expect(container.querySelector("select")).not.toBeInTheDocument();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /município/i })).toHaveValue("São Paulo");
    expect(screen.queryByText(/brejões e cidades vizinhas/i)).not.toBeInTheDocument();
  });

  it("permite manter um município já identificado sem restringir a região", () => {
    render(<Harness />);
    const field = screen.getByRole("textbox", { name: /município/i });
    fireEvent.change(field, { target: { value: "Manaus" } });
    expect(field).toHaveValue("Manaus");
  });
});
