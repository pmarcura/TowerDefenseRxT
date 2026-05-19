import type { PlayerClassDefinition } from "../models/types";

export const playerClassDefinitions: readonly PlayerClassDefinition[] = [
  {
    id: "christian-vitrail-custodian",
    name: "Custódio do Vitral",
    shortName: "Cristianismo",
    visualMotif: "vitral, nave e coro",
    pattern: "vitrail",
    accent: 0x40d8ff,
    secondaryAccent: 0xf6e7a6,
    rangeBonus: 12,
    costMultiplier: 1,
    damageMultiplier: 1,
    rewardMultiplier: 1,
    specialty: "Equilibrada",
    passive: "Torres fáceis de entender, bom alcance e dano estável.",
    description: "Classe simples e segura. Boa para aprender, cobrir corredores e manter dano constante.",
    note:
      "Base visual em vitrais, nave, coro e luz filtrada; evita representar santos, Cristo ou a cruz como arma."
  },
  {
    id: "umbanda-gira-medium",
    name: "Médium da Gira",
    shortName: "Umbanda",
    visualMotif: "gira, guias e pontos cantados",
    pattern: "gira",
    accent: 0x9fe8ff,
    secondaryAccent: 0xffffff,
    rangeBonus: 4,
    costMultiplier: 0.92,
    damageMultiplier: 1.04,
    rewardMultiplier: 1.1,
    specialty: "Economia",
    passive: "+10% créditos, +4% dano e torres 8% mais baratas.",
    description: "Boa para juntar dinheiro cedo. Ajuda o time a crescer sem perder controle da rota.",
    note:
      "Base visual em gira, pontos cantados, guias e caridade; trata entidades como inspiração cultural, não como unidades de combate."
  },
  {
    id: "islamic-zellige-geometer",
    name: "Geômetra do Zellige",
    shortName: "Islamismo",
    visualMotif: "zellige, mihrab e arabesco",
    pattern: "zellige",
    accent: 0x5ef1c6,
    secondaryAccent: 0xf0d891,
    rangeBonus: 8,
    costMultiplier: 1.04,
    damageMultiplier: 1.04,
    rewardMultiplier: 0.98,
    specialty: "Dano preciso",
    passive: "+4% dano e +8 alcance. Torres um pouco mais caras.",
    description: "Forte contra inimigos resistentes e chefes. Melhor quando posiciona bem.",
    note:
      "Base visual em geometria, arabesco e mihrab; não usa caligrafia sagrada, versículos ou figuração profética."
  },
  {
    id: "hindu-dharma-weaver",
    name: "Tecelã do Dharma",
    shortName: "Hinduísmo",
    visualMotif: "mandala, lótus e ciclo",
    pattern: "lotus",
    accent: 0xf2c85b,
    secondaryAccent: 0xff7aa8,
    rangeBonus: 0,
    costMultiplier: 0.88,
    damageMultiplier: 1.02,
    rewardMultiplier: 1.04,
    specialty: "Construção rápida",
    passive: "Torres 12% mais baratas, +4% créditos e dano um pouco maior.",
    description: "Consegue montar defesa cedo. Boa para controle, rotas novas e adaptação.",
    note:
      "Base visual em mandala, lótus, puja e ciclos de karma/samsara; evita converter murtis ou divindades em armas."
  },
  {
    id: "buddhist-middle-path",
    name: "Vigia do Caminho Médio",
    shortName: "Budismo",
    visualMotif: "stupa, roda e silêncio",
    pattern: "wheel",
    accent: 0xffd89a,
    secondaryAccent: 0xfff3c9,
    rangeBonus: 6,
    costMultiplier: 0.94,
    damageMultiplier: 0.98,
    rewardMultiplier: 1.08,
    specialty: "Run longa",
    passive: "+8% créditos, +6 alcance e torres 6% mais baratas.",
    description: "Ganha força com tempo e posicionamento. Boa para segurar inimigos e economizar.",
    note:
      "Base visual em stupa, roda do dharma, meditação e caminho médio; não transforma o Buda em personagem de combate."
  },
  {
    id: "shinto-torii-keeper",
    name: "Guardião do Torii",
    shortName: "Xintoísmo",
    visualMotif: "torii, harae e lanternas",
    pattern: "torii",
    accent: 0xff7a5c,
    secondaryAccent: 0xffffff,
    rangeBonus: 10,
    costMultiplier: 1,
    damageMultiplier: 1.06,
    rewardMultiplier: 1,
    specialty: "Controle de mapa",
    passive: "+10 alcance e +6% dano. Controle forte sem custo extra.",
    description: "Boa para proteger entradas novas. Controla velocidade e cobre espaços grandes.",
    note:
      "Base visual em torii, harae, madeira, lanternas e fronteira entre espaço comum e sagrado; sem caricaturar kami."
  },
  {
    id: "candomble-axe-guardian",
    name: "Guardião do Axé",
    shortName: "Candomblé",
    visualMotif: "axé, contas e atabaque",
    pattern: "axe",
    accent: 0xb4ff72,
    secondaryAccent: 0xffd166,
    rangeBonus: -2,
    costMultiplier: 1.06,
    damageMultiplier: 1.06,
    rewardMultiplier: 1.02,
    specialty: "DPS e boss",
    passive: "+6% dano e +2% créditos. Torres mais caras e alcance menor.",
    description: "Bate forte, especialmente em grupos e chefes. Precisa posicionar perto da rota.",
    note:
      "Base visual em axé, atabaques, contas, terreiro e reciprocidade com a natureza; orixás não aparecem como armas."
  }
];

export const getPlayerClassDefinition = (classId: string): PlayerClassDefinition => {
  const playerClass = playerClassDefinitions.find((definition) => definition.id === classId);

  if (!playerClass) {
    throw new Error(`Player class definition not found: ${classId}`);
  }

  return playerClass;
};
