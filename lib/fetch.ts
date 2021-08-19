import axios from "redaxios";

export async function getPokemons(n?: number) {
  const pokemons = n || 3000;
  const { data: response } = await axios(
    `https://pokeapi.co/api/v2/pokemon?limit=${pokemons}`
  );
  return response;
}

export async function getPokemonData(name: string) {
  const { data: response } = await axios(
    `https://pokeapi.co/api/v2/pokemon/${name}`
  );
  return response;
}
