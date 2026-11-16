export interface Capital {
  name: string;
  x: number;
  y: number;
}

export interface Country {
  id: number;
  name: string;
  region: string;
  capital: Capital;
  color: number;
  governmentType: string;
  archetype: string;
  /** Number of map cells owned */
  area: number;
  population: number;
  /** US dollars */
  gdp: number;
  gdpPerCapita: number;
  debtPercentGdp: number;
  approval: number;
  stability: number;
  armyPersonnel: number;
}

export interface WorldCell {
  /** Flat list of vertices: x1, y1, x2, y2, ... */
  polygon: number[];
  countryId: number;
}

/** A border or coastline edge. b === -1 means a coastline of country a. */
export interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  a: number;
  b: number;
}

export interface World {
  seed: number;
  width: number;
  height: number;
  countries: Country[];
  /** Land cells only */
  cells: WorldCell[];
  segments: Segment[];
  /** Flat x, y of every cell site (land and water), used for picking */
  sites: number[];
  /** Owner country id for every site, -1 for water */
  siteOwner: number[];
}
