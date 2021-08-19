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
