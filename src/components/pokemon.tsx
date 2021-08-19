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

  const number = props?.poke?.data?.order;
  const isPositive = number >= 1;

  const pokeNumber = isPositive ? number : "Max version"

  return (
    <>
    <article className="ditto">
        <Image
          src={pokeImage}
          width={240}
          height={240}
          alt={`Pokémon ${props?.poke?.data?.name}`}
        />
        <h1 className="poke-name">{props?.poke?.data?.name}</h1>
        <p>Number: {pokeNumber}</p>
        <p>Type:</p>
        <ul className="poke-list">
          {props?.poke?.data?.types?.map((info: Type, index: number) => (
            <li key={index}> {info.type.name}</li>
          ))}
        </ul>
        <Spacer size="12" style={{marginTop: '20px'}}/>
        <Button />
      </article>
      <div className="poke-footer">
        <div></div>
        <div className="poke-options">
            <div>
              <Link href="/ssr">
                <a title="Server Side Rendering">
                  <Image
                    src="https://raw.githubusercontent.com/ibrahimcesar/nextjs-ssr-cdk-aws/main/public/ditto.png" width="125"
                    height="112"
                  />
                  <h2>Server Side Rendering<br/>(SSR)</h2>
                </a>
              </Link>
            </div>
            <div>
              <Link href="/isr">
                <a title="Incremental Static Regeneration">
                  <Image
                    src="https://raw.githubusercontent.com/ibrahimcesar/nextjs-ssr-cdk-aws/main/public/porygon.png" width="125"
                    height="112"
                  />
                  <h2>Incremental Static Regeneration<br/>(ISR)</h2>
                </a>
              </Link>
            </div>
        </div>
        <div></div>
      </div>
    </>
  )
}

export default PokemonForm
