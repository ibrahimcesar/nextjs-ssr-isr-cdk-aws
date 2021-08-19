import { GetServerSideProps } from 'next'
import Head from "next/head"
import { getPokemons, getPokemonData } from '@/lib/fetch'
import PokemonForm from '@/components/pokemon'

import type { Pokemon } from '@/types/Pokemon'
import type { Pokedex } from '@/types/Pokedex'

interface PokemonApi {
  data: Pokemon
}

const Ditto = (props: PokemonApi) => {
  if (!props.data.name) return null;

  const pokeName = props.data.species.name.charAt(0).toUpperCase() + props.data.species.name.slice(1)

  return (
    <section className="container">
      <Head>
        <title>A wild {pokeName} appears! | PokéSSR - AWS Serverless Lambda@Edge</title>
        <meta property="og:title" content={`A wild ${pokeName} appears! | PokéSSR - AWS Serverless Lambda@Edge`} key="title" />
      </Head>
      <PokemonForm poke={props}/>
    </section>
    )
}


export const getServerSideProps: GetServerSideProps = async () => {
  const random = await getPokemons() as Pokedex

  const ditto = random?.results[random.results.length * Math.random() | 0]?.name

  let data;

  if (typeof ditto === 'string') {
    data = await getPokemonData(ditto)
  } else {
    data = {}
  }

  return {
    props: {
      data
    }
  }
}

export default Ditto