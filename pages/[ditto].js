import { useRouter } from 'next/router'
import Head from 'next/head'
import Image from 'next/image'
import Link from "next/link"

const Ditto = ({ data }) => {


  const router = useRouter()
  if (router.isFallback) {
    return <div>Loading...</div>
  }
  
  return (
    <>
                <Head>
        <title>{data.name} - PokéServerless</title>
        <meta name="viewport" content="initial-scale=1.0, width=device-width" />
      </Head>
    <section>
      <h1 style={{ textTransform: "capitalize" }}>{data.species.name}</h1>
      <div>
        <Image src={data.sprites.other["official-artwork"].front_default} width={500}
        height={500} alt={`Pokémon ${data.name}`} />
      </div>
      <div>
        <p><b>Type:</b></p>
        <ul style={{listStyle: "none"}}>
          {data.types.map( (info, _i) => (
            <li style={{textTransform: "capitalize"}} key={_i}>{ info.type.name}</li>))}
        </ul>
      </div>
      <Link href="/"><a style={{textDecoration: "none", color: "#000"}}>🔙 Back to the main list</a></Link>
      </section>
      </>
  )
}

export async function getStaticPaths() {
  const req = await fetch('https://pokeapi.co/api/v2/pokemon')
  const pokeData = await req.json()
  const paths = pokeData.results.map(pokemon => ({ params: { ditto: pokemon.name }}))
  return {
    paths,
    fallback: true
  }
}

export async function getStaticProps({ params }) {
  const { ditto } = params
  const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${ditto}`)
  const data = await res.json()

  return {
    props: {
      data,
    },
    revalidate: 300,
  }
}

export default Ditto