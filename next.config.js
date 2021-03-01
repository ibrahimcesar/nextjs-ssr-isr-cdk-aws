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
  images: {
    domains: ['raw.githubusercontent.com'],
  }
}
