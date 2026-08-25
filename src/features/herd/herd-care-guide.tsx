import { useMemo, useState } from "react";
import { Beef, Droplets, HeartPulse, Leaf, Pill, Sprout } from "lucide-react";
import type { HydraAccount } from "../../lib/hydra-types";
import "./herd-care-guide.css";

type Guide = { food: string[]; environment: string[]; welfare: string[]; health: string[]; sustainable: string[] };

const guides: Record<string, Guide> = {
  Bovino: {
    food: ["Pastagem e forragem de boa qualidade devem formar a base da dieta.", "Água limpa e fresca precisa ficar disponível o tempo todo.", "Sal mineral e outros suplementos devem ser escolhidos conforme idade, peso, fase produtiva e orientação técnica.", "Evite mudança brusca de dieta e alimento mofado, fermentado ou deteriorado."],
    environment: ["Pastagem ou curral com espaço compatível com o lote, sombra e boa circulação de ar.", "Área seca e confortável para descanso, com drenagem suficiente para evitar lama permanente.", "Cochos e bebedouros acessíveis, limpos e sem partes cortantes.", "Cercas seguras e manejo que evite superlotação e estresse térmico."],
    welfare: ["Observar diariamente apetite, locomoção, ruminação e comportamento.", "Registrar alterações de peso, produção e condição corporal na ficha do animal.", "Separar com segurança animais que precisem de observação, sem manter isolamento desnecessário.", "Sinais de doença, lesão ou queda importante de consumo precisam de avaliação profissional."],
    health: ["Manter calendário de vacinação definido para a propriedade com médico-veterinário e de acordo com a realidade sanitária da região.", "Vermífugos e outros antiparasitários só devem ser usados quando houver indicação técnica, evitando uso repetido sem avaliação.", "Antibióticos, anti-inflamatórios e outros medicamentos de tratamento dependem de diagnóstico e prescrição veterinária.", "Não usar medicamentos humanos ou misturar produtos por conta própria; registre no Hydra o produto prescrito, a data e o responsável pelo tratamento."],
    sustainable: ["Corrigir vazamentos nos bebedouros rapidamente.", "Evitar transbordamentos e desperdício de água na limpeza.", "Armazenar ração protegida da umidade e de pragas para reduzir perdas."],
  },
  Caprino: {
    food: ["Forragem, folhas e volumosos adequados devem compor a base da alimentação.", "Água limpa precisa estar sempre acessível.", "Minerais e concentrados devem considerar fase produtiva e orientação técnica.", "Evite alimento estragado e mudanças bruscas de dieta."],
    environment: ["Local seco, ventilado e protegido de chuva, vento forte e calor excessivo.", "Piso com boa drenagem e área elevada ou seca para descanso.", "Cercas bem conservadas, pois caprinos exploram e escalam estruturas com facilidade.", "Evite acúmulo de lama próximo de água, alimento e área de descanso."],
    welfare: ["Observar comportamento, apetite, locomoção, casco e condição corporal.", "Manter instalações limpas e reduzir disputas por cocho.", "Registrar alterações rapidamente.", "Animais com sinais preocupantes devem receber avaliação profissional."],
    health: ["Vacinação deve seguir um calendário sanitário orientado por médico-veterinário para a região e o sistema de criação.", "Controle de vermes deve ser planejado com avaliação do rebanho; usar vermífugo sem critério favorece resistência.", "Medicamentos para infecções, dor, inflamação ou outros problemas exigem avaliação e prescrição profissional.", "Não reutilize receitas antigas nem adapte dose de outra espécie; registre tratamentos prescritos na ficha do animal."],
    sustainable: ["Reduzir perdas de forragem nos cochos.", "Armazenar alimento em local seco.", "Conferir bebedouros diariamente para evitar vazamento."],
  },
  Ovino: {
    food: ["Priorizar pasto e forragem de qualidade, com água limpa sempre disponível.", "Suplementação deve considerar idade, peso, gestação, lactação e objetivo da criação.", "Minerais precisam ser apropriados para ovinos; não use suplementos de outra espécie sem orientação.", "Evite mudanças repentinas de alimentação e alimento mofado."],
    environment: ["Abrigo seco, sombreado, ventilado e com boa drenagem.", "Cercas seguras e áreas sem materiais que possam causar ferimentos.", "Evitar excesso de umidade nos locais de descanso e ao redor dos cochos.", "Disponibilizar espaço suficiente para alimentação sem disputa excessiva."],
    welfare: ["Observar apetite, marcha, lã, casco e comportamento.", "Manter acompanhamento de condição corporal e peso quando possível.", "Registrar ocorrências no histórico.", "Solicitar avaliação profissional quando houver sinais persistentes de alteração."],
    health: ["O calendário de vacinação deve ser definido para o rebanho por profissional habilitado.", "O controle de parasitas deve combinar manejo, higiene e avaliação técnica antes do uso de vermífugos.", "Antibióticos, anti-inflamatórios e demais medicamentos de tratamento não devem ser escolhidos sem diagnóstico veterinário.", "Registre no Hydra todo tratamento prescrito, incluindo data, responsável e observações."],
    sustainable: ["Proteger alimento da chuva.", "Monitorar vazamentos.", "Usar cochos que diminuam perdas de alimento."],
  },
  Equino: {
    food: ["Forragem de boa qualidade é parte central da alimentação.", "Água limpa e fresca deve permanecer disponível.", "Concentrados e suplementos exigem manejo cuidadoso e devem ser ajustados à atividade, idade e condição corporal.", "Mudanças de dieta precisam ser graduais."],
    environment: ["Pasto, piquete ou baia com espaço para movimentação, sombra, ventilação e piso seguro.", "Abrigo contra chuva e sol forte, com área seca para descanso.", "Cercas sem arame ou objetos que aumentem risco de ferimento.", "Cochos e bebedouros devem permanecer limpos e acessíveis."],
    welfare: ["Observar apetite, postura, marcha, casco e comportamento.", "Permitir movimento e contato social compatível com o manejo da propriedade.", "Registrar qualquer mudança importante.", "Cólicas, lesões, dificuldade para caminhar ou alterações importantes exigem avaliação profissional rápida."],
    health: ["Vacinas e controle parasitário devem seguir um programa definido com médico-veterinário.", "Vermífugos devem ser usados com critério técnico, não apenas por calendário repetitivo.", "Analgésicos, anti-inflamatórios, antibióticos e outros medicamentos exigem indicação veterinária.", "Não ofereça medicamento humano ao animal; registre no Hydra somente tratamentos orientados por profissional."],
    sustainable: ["Corrigir bebedouros com vazamento.", "Evitar desperdício de feno e ração.", "Planejar limpeza com uso racional de água."],
  },
  "Suíno": {
    food: ["Usar alimentação formulada para idade e fase produtiva.", "Garantir água limpa e de fácil acesso durante todo o dia.", "Manter comedouros regulados para reduzir desperdício.", "Evitar restos deteriorados, mofados ou contaminados."],
    environment: ["Instalação ventilada, limpa, com piso seguro e proteção contra calor excessivo.", "Separar área de descanso das áreas mais úmidas quando possível.", "Oferecer espaço compatível com o grupo e evitar superlotação.", "Manter manejo de dejetos e drenagem para reduzir umidade e contaminação."],
    welfare: ["Observar apetite, pele, postura, respiração e comportamento do grupo.", "Reduzir calor, disputa e outros fatores de estresse.", "Registrar mudanças importantes sem tentar diagnosticar pelo aplicativo.", "Encaminhar sinais preocupantes para avaliação profissional."],
    health: ["O programa de vacinação e biossegurança deve ser definido com médico-veterinário conforme a criação.", "Antiparasitários devem ser usados somente quando houver indicação técnica.", "Antibióticos e outros medicamentos de tratamento precisam de diagnóstico e prescrição profissional.", "Não medique o lote inteiro por conta própria; registre tratamentos prescritos e mantenha atenção aos períodos de carência informados pelo veterinário."],
    sustainable: ["Verificar vazamentos em bebedouros.", "Evitar excesso de ração nos comedouros.", "Organizar manejo e limpeza para reduzir desperdício de água."],
  },
  Ave: {
    food: ["Fornecer ração adequada à espécie, idade e fase de criação.", "Água fresca deve ficar disponível e protegida de contaminação.", "Manter comedouros secos e protegidos de chuva e fezes.", "Não usar alimento com cheiro, cor ou aspecto alterado."],
    environment: ["Galpão, galinheiro ou abrigo com ventilação, cama seca e proteção contra chuva, predadores e calor excessivo.", "Disponibilizar espaço adequado para movimentação e acesso a água e alimento.", "Evitar excesso de aves no mesmo espaço.", "Higienizar comedouros, bebedouros e instalações com frequência."],
    welfare: ["Observar consumo, atividade, respiração e condição das penas.", "Reduzir estresse térmico com sombra e ventilação.", "Separar aves muito debilitadas para avaliação sem atrasar o atendimento.", "Quando necessário, buscar avaliação profissional."],
    health: ["Programas de vacinação variam conforme espécie, finalidade e região e devem ser definidos com médico-veterinário.", "Antiparasitários e antimicrobianos só devem ser usados quando houver indicação profissional.", "Evite colocar medicamentos na água ou ração sem orientação, pois a dose ingerida pode variar entre as aves.", "Higiene, quarentena de novos animais e controle de acesso são partes importantes da prevenção."],
    sustainable: ["Regular altura e vazão dos bebedouros para diminuir desperdício.", "Manter a ração em recipientes fechados.", "Planejar a limpeza para usar apenas a água necessária."],
  },
  Outra: {
    food: ["Identifique corretamente a espécie antes de definir a alimentação.", "Use alimento apropriado para a espécie e fase de vida, com água limpa sempre disponível.", "Evite restos deteriorados, alimento mofado e mudanças bruscas de dieta.", "Quando a espécie tiver exigências específicas, peça orientação a profissional com experiência naquele animal."],
    environment: ["Ofereça abrigo contra chuva, sol forte, frio e predadores, respeitando o comportamento natural da espécie.", "Mantenha área limpa, ventilada, segura e com espaço compatível com o porte e o número de animais.", "Evite piso escorregadio, objetos cortantes, lama permanente e superlotação.", "Adapte cercas, poleiros, baias ou piquetes às necessidades reais da espécie."],
    welfare: ["Observe diariamente consumo de alimento e água, locomoção e comportamento.", "Registre alterações de peso, produção ou condição corporal quando aplicável.", "Evite manejo agressivo e situações de estresse desnecessário.", "Procure avaliação profissional diante de sinais de doença ou lesão."],
    health: ["Não existe um medicamento seguro que sirva para todas as espécies.", "Vacinas, antiparasitários e tratamentos precisam ser escolhidos após identificar corretamente o animal e avaliar seu estado de saúde.", "Não use medicamento humano ou produto indicado para outra espécie sem orientação profissional.", "Use o Hydra para registrar prescrições e acompanhamento, não para substituir diagnóstico veterinário."],
    sustainable: ["Evite desperdício de água e alimento.", "Armazene ração e insumos em local seco e protegido.", "Mantenha bebedouros, comedouros e instalações em bom estado."],
  },
};

export function HerdCareGuide({ account }: { account: HydraAccount }) {
  const availableSpecies = useMemo(() => {
    const fromHerd = Array.from(new Set(account.animals.map((animal) => animal.species))).filter((name) => guides[name]);
    return fromHerd.length ? fromHerd : Object.keys(guides);
  }, [account.animals]);
  const [species, setSpecies] = useState(availableSpecies[0] || "Bovino");
  const guide = guides[species] || guides.Outra;

  return <div className="herd-care-guide">
    <div className="herd-care-intro"><span><Sprout size={21} /></span><div><strong>Nutrição, alimentação e manejo</strong><small>Orientações por espécie com foco em alimentação adequada, bem-estar e uso responsável dos recursos.</small></div></div>
    <div className="herd-care-species">{availableSpecies.map((name) => <button key={name} className={species === name ? "active" : ""} onClick={() => setSpecies(name)}>{name}</button>)}</div>
    <div className="herd-care-grid">
      <CareCard icon={<Beef size={20} />} title="Nutrição e alimentação" items={guide.food} />
      <CareCard icon={<Sprout size={20} />} title="Habitat adequado" items={guide.environment} />
      <CareCard icon={<HeartPulse size={20} />} title="Bem-estar e observação" items={guide.welfare} />
      <CareCard icon={<Pill size={20} />} title="Saúde e medicamentos" items={guide.health} />
      <CareCard icon={<Droplets size={20} />} title="Uso sustentável" items={guide.sustainable} />
    </div>
    <div className="herd-care-warning"><Leaf size={18} /><p>O Hydra não prescreve medicamentos nem doses. A área de saúde mostra prevenção e uso responsável: vacinação, antiparasitários e tratamentos devem seguir avaliação e orientação de médico-veterinário, especialmente porque espécie, idade, peso, produção e período de carência mudam a conduta.</p></div>
  </div>;
}

function CareCard({ icon, title, items }: { icon: React.ReactNode; title: string; items: string[] }) {
  return <article className="herd-care-card"><span>{icon}</span><h3>{title}</h3><ul>{items.map((item) => <li key={item}>{item}</li>)}</ul></article>;
}
