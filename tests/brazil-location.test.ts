import { describe, expect, it, vi } from "vitest";
import {
  brazilStates,
  cepStateMismatch,
  formatCep,
  isBrazilState,
  isValidCep,
  lookupBrazilianCep,
  PostalCodeLookupError,
} from "../src/lib/brazil-location";

describe("localização nacional do Hydra Agro", () => {
  it("contém as 27 UFs brasileiras sem digitação livre", () => {
    expect(brazilStates).toHaveLength(27);
    expect(new Set(brazilStates.map((state) => state.uf)).size).toBe(27);
    expect(isBrazilState("SP")).toBe(true);
    expect(isBrazilState("BA")).toBe(true);
    expect(isBrazilState("XX")).toBe(false);
  });

  it("aplica e valida a máscara brasileira de CEP", () => {
    expect(formatCep("01001000")).toBe("01001-000");
    expect(formatCep("01001-000")).toBe("01001-000");
    expect(isValidCep("01001-000")).toBe(true);
    expect(isValidCep("01001-00")).toBe(false);
  });

  it("identifica município, UF e IBGE a partir de um CEP válido", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      cep: "01001-000",
      logradouro: "Praça da Sé",
      complemento: "lado ímpar",
      bairro: "Sé",
      localidade: "São Paulo",
      uf: "SP",
      estado: "São Paulo",
      regiao: "Sudeste",
      ibge: "3550308",
      ddd: "11",
    }), { status: 200, headers: { "Content-Type": "application/json" } }));

    const address = await lookupBrazilianCep("01001-000", fetcher as typeof fetch);
    expect(address).toMatchObject({
      postalCode: "01001-000",
      municipality: "São Paulo",
      municipalityIbgeCode: "3550308",
      state: "SP",
      region: "Sudeste",
      district: "Sé",
      ddd: "11",
    });
    expect(cepStateMismatch("SP", address)).toBe("");
  });

  it("detecta quando o CEP pertence a outra UF", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      cep: "01001-000", localidade: "São Paulo", uf: "SP", estado: "São Paulo", ibge: "3550308",
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    const address = await lookupBrazilianCep("01001000", fetcher as typeof fetch);
    expect(cepStateMismatch("BA", address)).toContain("Este CEP pertence a SP");
  });

  it("não depende de um estado específico", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      cep: "30140-071", localidade: "Belo Horizonte", uf: "MG", estado: "Minas Gerais", regiao: "Sudeste", ibge: "3106200",
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    const address = await lookupBrazilianCep("30140071", fetcher as typeof fetch);
    expect(address.municipality).toBe("Belo Horizonte");
    expect(address.state).toBe("MG");
    expect(address.municipalityIbgeCode).toBe("3106200");
  });

  it("mostra mensagem em português para CEP inválido", async () => {
    await expect(lookupBrazilianCep("123", vi.fn() as unknown as typeof fetch)).rejects.toMatchObject({
      code: "invalid",
      message: "Digite um CEP completo no formato 00000-000.",
    } satisfies Partial<PostalCodeLookupError>);
  });

  it("mostra mensagem clara quando o CEP não existe", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ erro: true }), { status: 200, headers: { "Content-Type": "application/json" } }));
    await expect(lookupBrazilianCep("99999-999", fetcher as typeof fetch)).rejects.toMatchObject({
      code: "not_found",
      message: "CEP não encontrado. Confira o número e tente novamente.",
    } satisfies Partial<PostalCodeLookupError>);
  });

  it("não expõe erro técnico quando a consulta falha", async () => {
    const fetcher = vi.fn(async () => { throw new TypeError("Failed to fetch"); });
    await expect(lookupBrazilianCep("01001-000", fetcher as unknown as typeof fetch)).rejects.toMatchObject({
      code: "unavailable",
      message: "Não foi possível consultar o CEP agora. Verifique sua conexão e tente novamente.",
    } satisfies Partial<PostalCodeLookupError>);
  });
});
