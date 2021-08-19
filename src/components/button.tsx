import Link from "next/link"

const Button = () => {
  return (
    <Link href="/random">
      <a>
        <button className="pushable">
          <span className="shadow"></span>
          <span className="edge"></span>
          <span className="front">
            Surprise Me!
          </span>
        </button>
      </a>
    </Link>
  )
}

export default Button
