export interface LandMass {
  name: string;
  x: number;
  y: number;
  r: number;
  countries: number;
}

/** Three continents and three island nations: 6 + 6 + 5 + 1 + 1 + 1 = 20 countries. */
export const LAND_MASSES: LandMass[] = [
  { name: "Aurelia", x: 450, y: 430, r: 330, countries: 6 },
  { name: "Khazara", x: 1300, y: 380, r: 300, countries: 6 },
  { name: "Velmora", x: 900, y: 770, r: 190, countries: 5 },
  { name: "Outer Isles", x: 880, y: 150, r: 75, countries: 1 },
  { name: "Outer Isles", x: 1620, y: 870, r: 80, countries: 1 },
  { name: "Outer Isles", x: 130, y: 880, r: 70, countries: 1 },
];

export type ArchetypeId =
  | "industrial"
  | "wealthy-aging"
  | "developing"
  | "resource-rich"
  | "military-debt"
  | "trader"
  | "island";

export interface ArchetypeProfile {
  label: string;
  /** Population multiplier per map cell */
  density: number;
  gdpPerCapita: number;
  debt: [number, number];
  approval: [number, number];
  stability: [number, number];
  militaryRate: number;
}

export const ARCHETYPES: Record<ArchetypeId, ArchetypeProfile> = {
  industrial: {
    label: "Industrial economy",
    density: 1.0,
    gdpPerCapita: 38000,
    debt: [0.5, 0.9],
    approval: [45, 65],
    stability: [65, 85],
    militaryRate: 0.004,
  },
  "wealthy-aging": {
    label: "Wealthy, ageing society",
    density: 0.8,
    gdpPerCapita: 52000,
    debt: [0.7, 1.1],
    approval: [40, 60],
    stability: [70, 90],
    militaryRate: 0.003,
  },
  developing: {
    label: "Developing nation",
    density: 1.8,
    gdpPerCapita: 4200,
    debt: [0.3, 0.6],
    approval: [45, 70],
    stability: [45, 70],
    militaryRate: 0.004,
  },
  "resource-rich": {
    label: "Resource exporter",
    density: 0.6,
    gdpPerCapita: 14000,
    debt: [0.2, 0.5],
    approval: [40, 65],
    stability: [50, 75],
    militaryRate: 0.005,
  },
  "military-debt": {
    label: "Military power, high debt",
    density: 1.1,
    gdpPerCapita: 22000,
    debt: [1.1, 1.6],
    approval: [35, 55],
    stability: [45, 65],
    militaryRate: 0.012,
  },
  trader: {
    label: "Trading hub",
    density: 1.5,
    gdpPerCapita: 26000,
    debt: [0.4, 0.8],
    approval: [50, 70],
    stability: [60, 80],
    militaryRate: 0.003,
  },
  island: {
    label: "Island trading nation",
    density: 0.9,
    gdpPerCapita: 30000,
    debt: [0.5, 0.9],
    approval: [50, 70],
    stability: [65, 85],
    militaryRate: 0.002,
  },
};

export interface CountryDef {
  name: string;
  capital: string;
  governmentType: string;
  archetype: ArchetypeId;
  color: number;
}

/** Order matters: the first 6 go to Aurelia, the next 6 to Khazara, and so on. */
export const COUNTRY_DEFS: CountryDef[] = [
  // Aurelia (industrial continent)
  {
    name: "Valdoria",
    capital: "Karsten",
    governmentType: "Parliamentary republic",
    archetype: "industrial",
    color: 0x5b8def,
  },
  {
    name: "Northmark",
    capital: "Eldholm",
    governmentType: "Constitutional monarchy",
    archetype: "wealthy-aging",
    color: 0xe0645c,
  },
  {
    name: "Drevania",
    capital: "Port Drev",
    governmentType: "Federal republic",
    archetype: "industrial",
    color: 0x58b368,
  },
  {
    name: "Kestrin",
    capital: "Kestra",
    governmentType: "Presidential republic",
    archetype: "developing",
    color: 0xe3b341,
  },
  {
    name: "Orlavia",
    capital: "Orlav",
    governmentType: "Military government",
    archetype: "military-debt",
    color: 0x9b6bd6,
  },
  {
    name: "Brannmoor",
    capital: "Brannfield",
    governmentType: "Parliamentary republic",
    archetype: "wealthy-aging",
    color: 0x3fb8b0,
  },
  // Khazara (resource-rich continent)
  {
    name: "Tarsis",
    capital: "Tarsa",
    governmentType: "Absolute monarchy",
    archetype: "resource-rich",
    color: 0xe08a3c,
  },
  {
    name: "Ombara",
    capital: "Ombar City",
    governmentType: "One-party state",
    archetype: "resource-rich",
    color: 0xc9619b,
  },
  {
    name: "Zandria",
    capital: "Zand",
    governmentType: "Presidential republic",
    archetype: "developing",
    color: 0x7aa23f,
  },
  {
    name: "Kharvost",
    capital: "Fort Khar",
    governmentType: "Military government",
    archetype: "military-debt",
    color: 0x5aa0c8,
  },
  {
    name: "Veshan",
    capital: "Veshal",
    governmentType: "Federal republic",
    archetype: "resource-rich",
    color: 0xb5714d,
  },
  {
    name: "Ulvarra",
    capital: "Ulvar",
    governmentType: "Presidential republic",
    archetype: "developing",
    color: 0x8e9bb5,
  },
  // Velmora (densely populated trading continent)
  {
    name: "Lumeria",
    capital: "Lumen",
    governmentType: "Constitutional monarchy",
    archetype: "trader",
    color: 0xd9d36a,
  },
  {
    name: "Sundara",
    capital: "Sundar",
    governmentType: "Presidential republic",
    archetype: "developing",
    color: 0x4e9f7e,
  },
  {
    name: "Qirata",
    capital: "Qirat",
    governmentType: "Parliamentary republic",
    archetype: "trader",
    color: 0xc7566b,
  },
  {
    name: "Isharan",
    capital: "Ishar",
    governmentType: "One-party state",
    archetype: "developing",
    color: 0x6f7be0,
  },
  {
    name: "Dorvath",
    capital: "Dorn",
    governmentType: "Federal republic",
    archetype: "trader",
    color: 0xa8b84a,
  },
  // Island nations
  {
    name: "Corvane",
    capital: "Port Corvan",
    governmentType: "Parliamentary republic",
    archetype: "island",
    color: 0x8d5fa8,
  },
  {
    name: "Tidemark",
    capital: "Tidehaven",
    governmentType: "Constitutional monarchy",
    archetype: "island",
    color: 0x3f86a0,
  },
  {
    name: "Pelagos",
    capital: "Pelagia",
    governmentType: "Presidential republic",
    archetype: "island",
    color: 0xbf8f5a,
  },
];
