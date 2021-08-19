import { GetServerSideProps } from 'next'
import Head from "next/head"
import { getPokemonData } from '@/lib/fetch'
import PokemonForm from '@/components/pokemon'

import type { Pokemon } from '@/types/Pokemon'

interface PokemonApi {
  data: Pokemon
}

const Ditto = (props: PokemonApi) => {
  if (!props?.data?.name) return null;

  const pokeName = props.data.species.name.charAt(0).toUpperCase() + props.data.species.name.slice(1)

  return (
    <section className="container">
      <Head>
        <title>{pokeName} | PokéServeless - AWS Serverless Lambda@Edge</title>
        <meta property="og:title" content={`${pokeName} | PokéServeless - AWS Serverless Lambda@Edge`} key="title" />
      </Head>
      <header>
          <h1>PokéServerless — Server Side Rendering</h1>
      </header>
      <PokemonForm poke={props} />
    </section>
  )

}


export const getServerSideProps: GetServerSideProps = async (context) => {
  let data;

  const { ditto} = context.query;

  if (typeof ditto === 'string') {
    data = await getPokemonData(ditto)
  } else {
    data = {}
  }

  return { props: { data } }
}

export default Ditto
