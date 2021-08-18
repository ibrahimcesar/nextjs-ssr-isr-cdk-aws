// To parse this data:
//
//   import { Convert, Pokemon } from "./file";
//
//   const pokemon = Convert.toPokemon(json);
//
// These functions will throw an error if the JSON doesn't
// match the expected interface, even if the JSON is valid.

export interface Pokemon {
  abilities: Ability[];
  base_experience: number;
  forms: Species[];
  game_indices: GameIndex[];
  height: number;
  held_items: HeldItem[];
  id: number;
  is_default: boolean;
  location_area_encounters: string;
  moves: Move[];
  name: string;
  order: number;
  past_types: any[];
  species: Species;
  sprites: Sprites;
  stats: Stat[];
  types: Type[];
  weight: number;
}

export interface Ability {
  ability: Species;
  is_hidden: boolean;
  slot: number;
}

export interface Species {
  name: string;
  url: string;
}

export interface GameIndex {
  game_index: number;
  version: Species;
}

export interface HeldItem {
  item: Species;
  version_details: VersionDetail[];
}

export interface VersionDetail {
  rarity: number;
  version: Species;
}

export interface Move {
  move: Species;
  version_group_details: VersionGroupDetail[];
}

export interface VersionGroupDetail {
  level_learned_at: number;
  move_learn_method: Species;
  version_group: Species;
}

export interface GenerationV {
  "black-white": Sprites;
}

export interface GenerationIv {
  "diamond-pearl": Sprites;
  "heartgold-soulsilver": Sprites;
  "platinum": Sprites;
}

export interface Versions {
  "generation-i": GenerationI;
  "generation-ii": GenerationIi;
  "generation-iii": GenerationIii;
  "generation-iv": GenerationIv;
  "generation-v": GenerationV;
  "generation-vi": { [key: string]: GenerationVi };
  "generation-vii": GenerationVii;
  "generation-viii": GenerationViii;
}

export interface Sprites {
  back_default: string;
  back_female: string;
  back_shiny: string;
  back_shiny_female: string;
  front_default: string;
  front_female: string;
  front_shiny: string;
  front_shiny_female: string;
  other?: Other;
  versions?: Versions;
  animated?: Sprites;
}

export interface GenerationI {
  "red-blue": RedBlue;
  "yellow": RedBlue;
}

export interface RedBlue {
  back_default: string;
  back_gray: string;
  front_default: string;
  front_gray: string;
}

export interface GenerationIi {
  crystal: Crystal;
  gold: Crystal;
  silver: Crystal;
}

export interface Crystal {
  back_default: string;
  back_shiny: string;
  front_default: string;
  front_shiny: string;
}

export interface GenerationIii {
  "emerald": Emerald;
  "firered-leafgreen": Crystal;
  "ruby-sapphire": Crystal;
}

export interface Emerald {
  front_default: string;
  front_shiny: string;
}

export interface GenerationVi {
  front_default: string;
  front_female: string;
  front_shiny: string;
  front_shiny_female: string;
}

export interface GenerationVii {
  "icons": DreamWorld;
  "ultra-sun-ultra-moon": GenerationVi;
}

export interface DreamWorld {
  front_default: string;
  front_female: null | string;
}

export interface GenerationViii {
  icons: DreamWorld;
}

export interface Other {
  "dream_world": DreamWorld;
  "official-artwork": OfficialArtwork;
}

export interface OfficialArtwork {
  front_default: string;
}

export interface Stat {
  base_stat: number;
  effort: number;
  stat: Species;
}

export interface Type {
  slot: number;
  type: Species;
}

// Converts JSON strings to/from your types
// and asserts the results of JSON.parse at runtime
export class Convert {
  public static toPokemon(json: string): Pokemon {
    return cast(JSON.parse(json), r("Pokemon"));
  }

  public static pokemonToJson(value: Pokemon): string {
    return JSON.stringify(uncast(value, r("Pokemon")), null, 2);
  }
}

function invalidValue(typ: any, val: any, key: any = ""): never {
  if (key) {
    throw Error(
      `Invalid value for key "${key}". Expected type ${JSON.stringify(
        typ
      )} but got ${JSON.stringify(val)}`
    );
  }
  throw Error(
    `Invalid value ${JSON.stringify(val)} for type ${JSON.stringify(typ)}`
  );
}

function jsonToJSProps(typ: any): any {
  if (typ.jsonToJS === undefined) {
    const map: any = {};
    typ.props.forEach((p: any) => (map[p.json] = { key: p.js, typ: p.typ }));
    typ.jsonToJS = map;
  }
  return typ.jsonToJS;
}

function jsToJSONProps(typ: any): any {
  if (typ.jsToJSON === undefined) {
    const map: any = {};
    typ.props.forEach((p: any) => (map[p.js] = { key: p.json, typ: p.typ }));
    typ.jsToJSON = map;
  }
  return typ.jsToJSON;
}

function transform(val: any, typ: any, getProps: any, key: any = ""): any {
  function transformPrimitive(typ: string, val: any): any {
    if (typeof typ === typeof val) return val;
    return invalidValue(typ, val, key);
  }

  function transformUnion(typs: any[], val: any): any {
    // val must validate against one typ in typs
    const l = typs.length;
    for (let i = 0; i < l; i++) {
      const typ = typs[i];
      try {
        return transform(val, typ, getProps);
      } catch (_) {}
    }
    return invalidValue(typs, val);
  }

  function transformEnum(cases: string[], val: any): any {
    if (cases.indexOf(val) !== -1) return val;
    return invalidValue(cases, val);
  }

  function transformArray(typ: any, val: any): any {
    // val must be an array with no invalid elements
    if (!Array.isArray(val)) return invalidValue("array", val);
    return val.map(el => transform(el, typ, getProps));
  }

  function transformDate(val: any): any {
    if (val === null) {
      return null;
    }
    const d = new Date(val);
    if (isNaN(d.valueOf())) {
      return invalidValue("Date", val);
    }
    return d;
  }

  function transformObject(
    props: { [k: string]: any },
    additional: any,
    val: any
  ): any {
    if (val === null || typeof val !== "object" || Array.isArray(val)) {
      return invalidValue("object", val);
    }
    const result: any = {};
    Object.getOwnPropertyNames(props).forEach(key => {
      const prop = props[key];
      const v = Object.prototype.hasOwnProperty.call(val, key)
        ? val[key]
        : undefined;
      result[prop.key] = transform(v, prop.typ, getProps, prop.key);
    });
    Object.getOwnPropertyNames(val).forEach(key => {
      if (!Object.prototype.hasOwnProperty.call(props, key)) {
        result[key] = transform(val[key], additional, getProps, key);
      }
    });
    return result;
  }

  if (typ === "any") return val;
  if (typ === null) {
    if (val === null) return val;
    return invalidValue(typ, val);
  }
  if (typ === false) return invalidValue(typ, val);
  while (typeof typ === "object" && typ.ref !== undefined) {
    typ = typeMap[typ.ref];
  }
  if (Array.isArray(typ)) return transformEnum(typ, val);
  if (typeof typ === "object") {
    return typ.hasOwnProperty("unionMembers")
      ? transformUnion(typ.unionMembers, val)
      : typ.hasOwnProperty("arrayItems")
      ? transformArray(typ.arrayItems, val)
      : typ.hasOwnProperty("props")
      ? transformObject(getProps(typ), typ.additional, val)
      : invalidValue(typ, val);
  }
  // Numbers can be parsed by Date but shouldn't be.
  if (typ === Date && typeof val !== "number") return transformDate(val);
  return transformPrimitive(typ, val);
}

function cast<T>(val: any, typ: any): T {
  return transform(val, typ, jsonToJSProps);
}

function uncast<T>(val: T, typ: any): any {
  return transform(val, typ, jsToJSONProps);
}

function a(typ: any) {
  return { arrayItems: typ };
}

function u(...typs: any[]) {
  return { unionMembers: typs };
}

function o(props: any[], additional: any) {
  return { props, additional };
}

function m(additional: any) {
  return { props: [], additional };
}

function r(name: string) {
  return { ref: name };
}

const typeMap: any = {
  Pokemon: o(
    [
      { json: "abilities", js: "abilities", typ: a(r("Ability")) },
      { json: "base_experience", js: "base_experience", typ: 0 },
      { json: "forms", js: "forms", typ: a(r("Species")) },
      { json: "game_indices", js: "game_indices", typ: a(r("GameIndex")) },
      { json: "height", js: "height", typ: 0 },
      { json: "held_items", js: "held_items", typ: a(r("HeldItem")) },
      { json: "id", js: "id", typ: 0 },
      { json: "is_default", js: "is_default", typ: true },
      {
        json: "location_area_encounters",
        js: "location_area_encounters",
        typ: "",
      },
      { json: "moves", js: "moves", typ: a(r("Move")) },
      { json: "name", js: "name", typ: "" },
      { json: "order", js: "order", typ: 0 },
      { json: "past_types", js: "past_types", typ: a("any") },
      { json: "species", js: "species", typ: r("Species") },
      { json: "sprites", js: "sprites", typ: r("Sprites") },
      { json: "stats", js: "stats", typ: a(r("Stat")) },
      { json: "types", js: "types", typ: a(r("Type")) },
      { json: "weight", js: "weight", typ: 0 },
    ],
    false
  ),
  Ability: o(
    [
      { json: "ability", js: "ability", typ: r("Species") },
      { json: "is_hidden", js: "is_hidden", typ: true },
      { json: "slot", js: "slot", typ: 0 },
    ],
    false
  ),
  Species: o(
    [
      { json: "name", js: "name", typ: "" },
      { json: "url", js: "url", typ: "" },
    ],
    false
  ),
  GameIndex: o(
    [
      { json: "game_index", js: "game_index", typ: 0 },
      { json: "version", js: "version", typ: r("Species") },
    ],
    false
  ),
  HeldItem: o(
    [
      { json: "item", js: "item", typ: r("Species") },
      {
        json: "version_details",
        js: "version_details",
        typ: a(r("VersionDetail")),
      },
    ],
    false
  ),
  VersionDetail: o(
    [
      { json: "rarity", js: "rarity", typ: 0 },
      { json: "version", js: "version", typ: r("Species") },
    ],
    false
  ),
  Move: o(
    [
      { json: "move", js: "move", typ: r("Species") },
      {
        json: "version_group_details",
        js: "version_group_details",
        typ: a(r("VersionGroupDetail")),
      },
    ],
    false
  ),
  VersionGroupDetail: o(
    [
      { json: "level_learned_at", js: "level_learned_at", typ: 0 },
      { json: "move_learn_method", js: "move_learn_method", typ: r("Species") },
      { json: "version_group", js: "version_group", typ: r("Species") },
    ],
    false
  ),
  GenerationV: o(
    [{ json: "black-white", js: "black-white", typ: r("Sprites") }],
    false
  ),
  GenerationIv: o(
    [
      { json: "diamond-pearl", js: "diamond-pearl", typ: r("Sprites") },
      {
        json: "heartgold-soulsilver",
        js: "heartgold-soulsilver",
        typ: r("Sprites"),
      },
      { json: "platinum", js: "platinum", typ: r("Sprites") },
    ],
    false
  ),
  Versions: o(
    [
      { json: "generation-i", js: "generation-i", typ: r("GenerationI") },
      { json: "generation-ii", js: "generation-ii", typ: r("GenerationIi") },
      { json: "generation-iii", js: "generation-iii", typ: r("GenerationIii") },
      { json: "generation-iv", js: "generation-iv", typ: r("GenerationIv") },
      { json: "generation-v", js: "generation-v", typ: r("GenerationV") },
      { json: "generation-vi", js: "generation-vi", typ: m(r("GenerationVi")) },
      { json: "generation-vii", js: "generation-vii", typ: r("GenerationVii") },
      {
        json: "generation-viii",
        js: "generation-viii",
        typ: r("GenerationViii"),
      },
    ],
    false
  ),
  Sprites: o(
    [
      { json: "back_default", js: "back_default", typ: "" },
      { json: "back_female", js: "back_female", typ: "" },
      { json: "back_shiny", js: "back_shiny", typ: "" },
      { json: "back_shiny_female", js: "back_shiny_female", typ: "" },
      { json: "front_default", js: "front_default", typ: "" },
      { json: "front_female", js: "front_female", typ: "" },
      { json: "front_shiny", js: "front_shiny", typ: "" },
      { json: "front_shiny_female", js: "front_shiny_female", typ: "" },
      { json: "other", js: "other", typ: u(undefined, r("Other")) },
      { json: "versions", js: "versions", typ: u(undefined, r("Versions")) },
      { json: "animated", js: "animated", typ: u(undefined, r("Sprites")) },
    ],
    false
  ),
  GenerationI: o(
    [
      { json: "red-blue", js: "red-blue", typ: r("RedBlue") },
      { json: "yellow", js: "yellow", typ: r("RedBlue") },
    ],
    false
  ),
  RedBlue: o(
    [
      { json: "back_default", js: "back_default", typ: "" },
      { json: "back_gray", js: "back_gray", typ: "" },
      { json: "front_default", js: "front_default", typ: "" },
      { json: "front_gray", js: "front_gray", typ: "" },
    ],
    false
  ),
  GenerationIi: o(
    [
      { json: "crystal", js: "crystal", typ: r("Crystal") },
      { json: "gold", js: "gold", typ: r("Crystal") },
      { json: "silver", js: "silver", typ: r("Crystal") },
    ],
    false
  ),
  Crystal: o(
    [
      { json: "back_default", js: "back_default", typ: "" },
      { json: "back_shiny", js: "back_shiny", typ: "" },
      { json: "front_default", js: "front_default", typ: "" },
      { json: "front_shiny", js: "front_shiny", typ: "" },
    ],
    false
  ),
  GenerationIii: o(
    [
      { json: "emerald", js: "emerald", typ: r("Emerald") },
      { json: "firered-leafgreen", js: "firered-leafgreen", typ: r("Crystal") },
      { json: "ruby-sapphire", js: "ruby-sapphire", typ: r("Crystal") },
    ],
    false
  ),
  Emerald: o(
    [
      { json: "front_default", js: "front_default", typ: "" },
      { json: "front_shiny", js: "front_shiny", typ: "" },
    ],
    false
  ),
  GenerationVi: o(
    [
      { json: "front_default", js: "front_default", typ: "" },
      { json: "front_female", js: "front_female", typ: "" },
      { json: "front_shiny", js: "front_shiny", typ: "" },
      { json: "front_shiny_female", js: "front_shiny_female", typ: "" },
    ],
    false
  ),
  GenerationVii: o(
    [
      { json: "icons", js: "icons", typ: r("DreamWorld") },
      {
        json: "ultra-sun-ultra-moon",
        js: "ultra-sun-ultra-moon",
        typ: r("GenerationVi"),
      },
    ],
    false
  ),
  DreamWorld: o(
    [
      { json: "front_default", js: "front_default", typ: "" },
      { json: "front_female", js: "front_female", typ: u(null, "") },
    ],
    false
  ),
  GenerationViii: o(
    [{ json: "icons", js: "icons", typ: r("DreamWorld") }],
    false
  ),
  Other: o(
    [
      { json: "dream_world", js: "dream_world", typ: r("DreamWorld") },
      {
        json: "official-artwork",
        js: "official-artwork",
        typ: r("OfficialArtwork"),
      },
    ],
    false
  ),
  OfficialArtwork: o(
    [{ json: "front_default", js: "front_default", typ: "" }],
    false
  ),
  Stat: o(
    [
      { json: "base_stat", js: "base_stat", typ: 0 },
      { json: "effort", js: "effort", typ: 0 },
      { json: "stat", js: "stat", typ: r("Species") },
    ],
    false
  ),
  Type: o(
    [
      { json: "slot", js: "slot", typ: 0 },
      { json: "type", js: "type", typ: r("Species") },
    ],
    false
  ),
};
