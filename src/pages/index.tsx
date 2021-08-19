import Image from "next/image"
import Link from "next/link"
import Button from "@/components/button"
import Spacer from "@/components/spacer"


const PokemonsPage = () => {

  return (
    <>
      <div className="wrapper">
        <div></div>
        <div className="poke-content">
          <h1>PokéServerless</h1>
          <Spacer size="12" style={{marginBottom: '20px'}}/>
          <div className="poke-options">
            <div>
              <Link href="/ssr">
                <a title="Server Side Rendering">
                  <Image
                    src="https://raw.githubusercontent.com/ibrahimcesar/nextjs-ssr-cdk-aws/main/public/ditto.png" width="250"
                    height="225"
                  />
                  <h2>Server Side Rendering<br/>(SSR)</h2>
                </a>
              </Link>
            </div>
            <div>
              <Link href="/isr">
                <a title="Incremental Static Regeneration">
                  <Image
                    src="https://raw.githubusercontent.com/ibrahimcesar/nextjs-ssr-cdk-aws/main/public/porygon.png" width="250"
                    height="225"
                  />
                  <h2>Incremental Static Regeneration<br/>(ISR)</h2>
                </a>
              </Link>
            </div>
          </div>
          <Spacer size="12" style={{marginBottom: '20px'}}/>
          <Button />
          <Spacer size="12" style={{marginBottom: '40px'}}/>
        </div>
        <div></div>
      </div>
      </>
  )
}



export default PokemonsPage
