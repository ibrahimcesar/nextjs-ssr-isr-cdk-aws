import { GetServerSideProps } from 'next'
import Head from "next/head"
import Link from "next/link"
import { getPokemons } from '@/lib/fetch'
import Button from "@/components/button"
import Spacer from "@/components/spacer"

import type { Pokedex, Result } from '@/types/Pokedex'

interface PokeDexApi {
  data: Pokedex
}

const PokemonsPage = (props: PokeDexApi) => {

  return (
    <>
      <Head>
        <title>PokéSSR - AWS Amplify</title>
        <meta property="og:title" content="PokéSSR - AWS Amplify" key="title" />
        <link rel="preconnect" href="https://fonts.gstatic.com"/>
        <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:ital,wght@0,300;0,400;0,500;0,600;1,700&display=swap" rel="stylesheet" />
        <meta name="viewport" content="initial-scale=1.0, width=device-width" />
        <meta property="og:image" content={`${process.env.baseUrl}/og.png`} key="image" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@ibrahimcesar" />
        <meta name="twitter:title" content="PokéSSR - AWS Amplify" />
        <meta name="twitter:description" content="Just another SSR site" />
        <meta name="twitter:image" content={`${process.env.baseUrl}/og.png`} />
      </Head>
      <div className="wrapper">
        <div></div>
        <div className="poke-content">
          <h1>Pokémons</h1>
          <p>Page to test Amplify SSR deployments with NextJS.</p>
          <p>Total of Pokémons: {props.data.count}</p>
          <Spacer size="12" style={{marginBottom: '20px'}}/>
          <Button />
          <Spacer size="12" style={{marginBottom: '40px'}}/>
              <ul className="poke-list">
              {props.data.results.map((pokemon: Result, index: number) => (
                <li key={pokemon.name}>
                  <article>
                  <span>{index + 1} </span>
                  <Link href={pokemon.name}><a className="poke-names">{pokemon.name}</a></Link>
                  </article>
                </li>
              ))}
            </ul>
          <Spacer size="12" style={{marginBottom: '20px'}}/>
          <Button />
          <Spacer size="12" style={{marginBottom: '40px'}}/>
        </div>
        <div></div>
      </div>
      </>
  )
}

export const getServerSideProps: GetServerSideProps = async () => {
  const data = await getPokemons()
  return {
    props: {
      data
    }
  }
}

export default PokemonsPage