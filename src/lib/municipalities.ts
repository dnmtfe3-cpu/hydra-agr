/**
 * Compatibilidade com componentes antigos.
 * O Hydra Agro não restringe mais municípios: a localização oficial da
 * propriedade é identificada pelo CEP e pela UF selecionada.
 */
export const supportedMunicipalities: readonly string[] = [];
export type SupportedMunicipality = string;

export function isSupportedMunicipality(value: string) {
  return value.trim().length > 0;
}
