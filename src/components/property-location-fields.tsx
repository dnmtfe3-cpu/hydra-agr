import { useEffect, useRef, useState } from "react";
import { CheckCircle2, LoaderCircle, RefreshCw } from "lucide-react";
import type { Property } from "../lib/hydra-types";
import {
  brazilStates,
  cepStateMismatch,
  formatCep,
  isValidCep,
  lookupBrazilianCep,
  type BrazilAddress,
} from "../lib/brazil-location";
import { Field } from "./ui";

type Props = {
  property: Property;
  onChange: (property: Property) => void;
  onError?: (message: string) => void;
  namePlaceholder?: string;
};

type LookupState = "idle" | "loading" | "ready" | "error";

function mergeAddress(property: Property, address: BrazilAddress): Property {
  return {
    ...property,
    postalCode: address.postalCode,
    municipality: address.municipality,
    municipalityIbgeCode: address.municipalityIbgeCode,
    stateName: address.stateName,
    region: address.region,
    street: address.street,
    district: address.district,
    addressComplement: address.addressComplement,
    ddd: address.ddd,
  };
}

export function PropertyLocationFields({ property, onChange, onError, namePlaceholder = "Fazenda Boa Vista" }: Props) {
  const [lookupState, setLookupState] = useState<LookupState>(property.municipality ? "ready" : "idle");
  const [lookupMessage, setLookupMessage] = useState("");
  const lastLookup = useRef("");
  const lookupVersion = useRef(0);

  async function lookup(force = false) {
    const cep = property.postalCode;
    if (!isValidCep(cep)) {
      setLookupState("idle");
      setLookupMessage("");
      return;
    }
    const key = `${cep}|${property.state}`;
    if (!force && lastLookup.current === key && property.municipality) return;
    const version = ++lookupVersion.current;
    setLookupState("loading");
    setLookupMessage("");
    try {
      const address = await lookupBrazilianCep(cep);
      if (version !== lookupVersion.current) return;
      const mismatch = cepStateMismatch(property.state, address);
      if (mismatch) {
        setLookupState("error");
        setLookupMessage(mismatch);
        onChange({ ...mergeAddress(property, address), municipality: address.municipality });
        onError?.(mismatch);
        return;
      }
      lastLookup.current = key;
      setLookupState("ready");
      setLookupMessage(`${address.municipality}, ${address.state} identificado pelo CEP.`);
      onError?.("");
      onChange(mergeAddress(property, address));
    } catch (error) {
      if (version !== lookupVersion.current) return;
      const message = error instanceof Error ? error.message : "Não foi possível consultar o CEP agora. Tente novamente.";
      setLookupState("error");
      setLookupMessage(message);
      onError?.(message);
    }
  }

  useEffect(() => {
    if (!isValidCep(property.postalCode)) return;
    const timer = window.setTimeout(() => { void lookup(); }, 320);
    return () => window.clearTimeout(timer);
    // O lookup depende somente dos valores digitados; onChange é estável no fluxo do formulário.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [property.postalCode, property.state]);

  function changeUf(uf: string) {
    lastLookup.current = "";
    setLookupState(property.municipality ? "ready" : "idle");
    setLookupMessage("");
    onError?.("");
    onChange({
      ...property,
      state: uf,
      stateName: brazilStates.find((item) => item.uf === uf)?.name,
    });
  }

  function changeCep(value: string) {
    lastLookup.current = "";
    const formatted = formatCep(value);
    setLookupState("idle");
    setLookupMessage("");
    onError?.("");
    onChange({
      ...property,
      postalCode: formatted,
      municipality: "",
      municipalityIbgeCode: undefined,
      region: undefined,
      street: undefined,
      district: undefined,
      addressComplement: undefined,
      ddd: undefined,
    });
  }

  return (
    <div className="property-location-fields">
      <Field label="UF">
        <select value={property.state} onChange={(event) => changeUf(event.target.value)} aria-label="UF da propriedade">
          <option value="">Selecione a UF</option>
          {brazilStates.map((state) => <option key={state.uf} value={state.uf}>{state.uf} — {state.name}</option>)}
        </select>
      </Field>

      <Field label="CEP" hint="A cidade será identificada automaticamente.">
        <div className="input-with-action property-cep-input">
          <input
            inputMode="numeric"
            autoComplete="postal-code"
            value={property.postalCode}
            onChange={(event) => changeCep(event.target.value)}
            onBlur={() => void lookup()}
            placeholder="00000-000"
            maxLength={9}
            aria-describedby="property-cep-status"
          />
          {lookupState === "loading" && <span className="property-cep-indicator" aria-label="Consultando CEP"><LoaderCircle size={18} className="spin" /></span>}
          {lookupState === "error" && isValidCep(property.postalCode) && <button type="button" onClick={() => void lookup(true)} aria-label="Tentar consultar CEP novamente"><RefreshCw size={18} /></button>}
          {lookupState === "ready" && <span className="property-cep-indicator is-ready" aria-label="CEP localizado"><CheckCircle2 size={18} /></span>}
        </div>
      </Field>

      {lookupMessage && <p id="property-cep-status" className={lookupState === "error" ? "form-error property-location-message" : "form-notice property-location-message"} role={lookupState === "error" ? "alert" : "status"}>{lookupMessage}</p>}

      <Field label="Nome da propriedade">
        <input
          value={property.name}
          onChange={(event) => { onError?.(""); onChange({ ...property, name: event.target.value }); }}
          placeholder={namePlaceholder}
          autoComplete="organization"
        />
      </Field>
    </div>
  );
}
