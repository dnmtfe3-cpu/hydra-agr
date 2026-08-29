import { MapPin } from "lucide-react";

/**
 * Componente legado mantido apenas por compatibilidade.
 * O cadastro principal do Hydra Agro não solicita município manualmente:
 * município/UF são identificados e persistidos a partir do CEP.
 */
export function MunicipalityPicker({ value, onChange }: { value: string; onChange: (municipality: string) => void }) {
  return (
    <label className="municipality-picker municipality-picker-legacy">
      <span className="municipality-trigger">
        <span className="municipality-pin"><MapPin size={20} /></span>
        <span className="municipality-current">
          <strong>Município</strong>
          <small>Identificado pela localização da propriedade</small>
        </span>
      </span>
      <input
        aria-label="Município"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Município identificado pelo CEP"
        autoComplete="address-level2"
      />
    </label>
  );
}
