import Link from "next/link"
import Head from 'next/head'

const Pokemons = ({ data }) => {
  
  return (
    <section>
          <Head>
        <title>PokéServerless</title>
        <meta name="viewport" content="initial-scale=1.0, width=device-width" />
      </Head>
      <div>
        <p style={{ fontFamily: '"Comic Sans MS", cursive, sans-serif', fontSize: "32px" }}>🤨 What is this horrible page? </p>
        <p style={{ fontSize: "20px" }}>First, thanks for the compliment! This a PoC (Proof of Concept) of a <Link style={{fontWeight: "bold", fontFamily: '"Comic Sans MS", cursive, sans-serif', color: "tomato", textDecoration: "none"}} href="https://nextjs.org/"><a>NextJS</a></Link> application using SSR (Server Side Rendering) with the open <Link style={{fontWeight: "bold", fontFamily: '"Comic Sans MS", cursive, sans-serif', color: "tomato", textDecoration: "none"}} href="https://pokeapi.co/"><a>PokéAPI</a></Link>. Also is deployed on AWS using Lambda@Edge and CloudFront wit the <Link style={{fontWeight: "bold", fontFamily: '"Comic Sans MS", cursive, sans-serif', color: "tomato", textDecoration: "none"}} href="https://serverless-nextjs.com/docs/cdkconstruct/"><a>Serverless Nextjs CDK Construct</a></Link>. I just take one Ditto to recreate all other Pokémons! Really look at the <Link style={{fontWeight: "bold", fontFamily: '"Comic Sans MS", cursive, sans-serif', color: "tomato", textDecoration: "none"}} href="https://github.com/ibrahimcesar/nextjs-isg-cdk-aws"><a>source code</a></Link>!</p>
      </div>
      <h1>Pokémons</h1>
      <ul style={{listStyle: "none"}}>
      {data.results.map((pokemon, _index) => (
        <li key={pokemon.name} style={{textTransform: "capitalize"}}>{_index + 1} <Link href={pokemon.name}><a style={{fontWeight: "bold", fontFamily: '"Comic Sans MS", cursive, sans-serif', color: "tomato", textDecoration: "none"}}>{pokemon.name}</a></Link></li>
      ))}
      </ul>
      <h3>Total of {data.count} Pokémons...</h3>
    </section>
  )
}
export async function getStaticProps() {
  const res = await fetch('https://pokeapi.co/api/v2/pokemon?limit=1118')
  const data = await res.json()

  return {
    props: {
      data,
    }
  }
}

export default Pokemons