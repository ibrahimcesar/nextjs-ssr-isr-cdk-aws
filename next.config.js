const terryPratchett = {
            key: 'X-Clacks-Overhead',
            value: 'GNU Terry Pratchett',
          }

module.exports = {
    async headers() {
    return [
      {
        source: '/',
        headers: [
          terryPratchett
        ],
      },
      {
        source: '/:ditto',
        headers: [
          terryPratchett
        ],
      },
      {
        source: '/_next\/([^\/]+\/?)*',
        headers: [
          terryPratchett
        ],
      },
    ]
  },
  env: {
    baseUrl: "https://aws-ssr-pokemon.ibrahimcesar.cloud",
    NEXT_PUBLIC_GA_ID: "G-0H4982YVLL"
  },
  images: {
    domains: ['raw.githubusercontent.com'],
  }
}
