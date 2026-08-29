export const brazilStates = [
  { uf: "AC", name: "Acre" },
  { uf: "AL", name: "Alagoas" },
  { uf: "AP", name: "Amapá" },
  { uf: "AM", name: "Amazonas" },
  { uf: "BA", name: "Bahia" },
  { uf: "CE", name: "Ceará" },
  { uf: "DF", name: "Distrito Federal" },
  { uf: "ES", name: "Espírito Santo" },
  { uf: "GO", name: "Goiás" },
  { uf: "MA", name: "Maranhão" },
  { uf: "MT", name: "Mato Grosso" },
  { uf: "MS", name: "Mato Grosso do Sul" },
  { uf: "MG", name: "Minas Gerais" },
  { uf: "PA", name: "Pará" },
  { uf: "PB", name: "Paraíba" },
  { uf: "PR", name: "Paraná" },
  { uf: "PE", name: "Pernambuco" },
  { uf: "PI", name: "Piauí" },
  { uf: "RJ", name: "Rio de Janeiro" },
  { uf: "RN", name: "Rio Grande do Norte" },
  { uf: "RS", name: "Rio Grande do Sul" },
  { uf: "RO", name: "Rondônia" },
  { uf: "RR", name: "Roraima" },
  { uf: "SC", name: "Santa Catarina" },
  { uf: "SP", name: "São Paulo" },
  { uf: "SE", name: "Sergipe" },
  { uf: "TO", name: "Tocantins" },
] as const;

export type BrazilStateCode = (typeof brazilStates)[number]["uf"];

export function isBrazilState(value: string): value is BrazilStateCode {
  const uf = value.trim().toUpperCase();
  return brazilStates.some((state) => state.uf === uf);
}

export function brazilStateName(uf: string) {
  return brazilStates.find((state) => state.uf === uf.trim().toUpperCase())?.name ?? "";
}

export function normalizeCep(value: string) {
  return value.replace(/\D/g, "").slice(0, 8);
}

export function formatCep(value: string) {
  const digits = normalizeCep(value);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}

export function isValidCep(value: string) {
  return normalizeCep(value).length === 8;
}

export type BrazilAddress = {
  postalCode: string;
  municipality: string;
  municipalityIbgeCode?: string;
  state: string;
  stateName?: string;
  region?: string;
  street?: string;
  district?: string;
  addressComplement?: string;
  ddd?: string;
};

type ViaCepResponse = {
  erro?: boolean;
  cep?: string;
  logradouro?: string;
  complemento?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  estado?: string;
  regiao?: string;
  ibge?: string;
  ddd?: string;
};

export class PostalCodeLookupError extends Error {
  code: "invalid" | "not_found" | "offline" | "unavailable";

  constructor(code: PostalCodeLookupError["code"], message: string) {
    super(message);
    this.name = "PostalCodeLookupError";
    this.code = code;
  }
}

export async function lookupBrazilianCep(value: string, fetcher: typeof fetch = fetch): Promise<BrazilAddress> {
  const cep = normalizeCep(value);
  if (cep.length !== 8) {
    throw new PostalCodeLookupError("invalid", "Digite um CEP completo no formato 00000-000.");
  }

  try {
    const response = await fetcher(`https://viacep.com.br/ws/${cep}/json/`, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      throw new PostalCodeLookupError("unavailable", "Não foi possível consultar o CEP agora. Tente novamente em instantes.");
    }
    const data = await response.json() as ViaCepResponse;
    if (data.erro || !data.localidade || !data.uf) {
      throw new PostalCodeLookupError("not_found", "CEP não encontrado. Confira o número e tente novamente.");
    }

    return {
      postalCode: formatCep(data.cep || cep),
      municipality: data.localidade.trim(),
      municipalityIbgeCode: data.ibge?.trim() || undefined,
      state: data.uf.trim().toUpperCase(),
      stateName: data.estado?.trim() || brazilStateName(data.uf),
      region: data.regiao?.trim() || undefined,
      street: data.logradouro?.trim() || undefined,
      district: data.bairro?.trim() || undefined,
      addressComplement: data.complemento?.trim() || undefined,
      ddd: data.ddd?.trim() || undefined,
    };
  } catch (error) {
    if (error instanceof PostalCodeLookupError) throw error;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      throw new PostalCodeLookupError("offline", "Sem internet para consultar o CEP. Verifique a conexão e tente novamente.");
    }
    throw new PostalCodeLookupError("unavailable", "Não foi possível consultar o CEP agora. Verifique sua conexão e tente novamente.");
  }
}

export function cepStateMismatch(selectedUf: string, address: BrazilAddress) {
  const selected = selectedUf.trim().toUpperCase();
  if (!selected || selected === address.state) return "";
  return `Este CEP pertence a ${address.state} (${address.stateName || brazilStateName(address.state)}), mas você selecionou ${selected}. Confira a UF para continuar.`;
}
