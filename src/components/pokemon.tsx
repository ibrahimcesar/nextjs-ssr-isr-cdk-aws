import Image from 'next/image'
import Link from 'next/link'
import Button from '@/components/button'
import Spacer from '@/components/spacer'
import { Pokemon, Type } from '@/types/Pokemon'

interface PokemonInfo {
  poke: {
    data: Pokemon
  }
}

const PokemonForm = (props: PokemonInfo) => {


  const pokeImage = props.poke?.data?.sprites?.other?.["official-artwork"]?.front_default ?? props.poke?.data?.sprites?.front_default

  return (
  <article className="ditto">
        <Image
          src={pokeImage}
          width={240}
          height={240}
          alt={`Pokémon ${props?.poke?.data?.name}`}
        />
        <h1 className="poke-name">{props?.poke?.data?.name}</h1>
        <p>Number: {props?.poke?.data?.order}</p>
        <p>Type:</p>
      <ul className="poke-list">
        {props?.poke?.data?.types?.map((info: Type, index: number) => (
          <li key={index}> {info.type.name}</li>))}</ul>
        <Spacer size="12" style={{marginTop: '20px'}}/>
      <Button />
      <Link href="/ssr"><a className="poke-home-link">
        <span role="img" aria-label="Back to Home" className="poke-home">
          🏠
        </span>
        <span>{'<<'} Back to Home SSR</span>
      </a></Link>
            <Link href="/isr"><a className="poke-home-link">
        <span role="img" aria-label="Back to Home" className="poke-home">
          🏗️
        </span>
        <span>{'<<'} Back to Home ISR</span>
      </a></Link> 
    </article>
  )
}

export default PokemonForm
