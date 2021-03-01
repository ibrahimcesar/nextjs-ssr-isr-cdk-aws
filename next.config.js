module.exports = {
  images: {
    domains: ['raw.githubusercontent.com'],
  },
  async headers() {
    return [
      {
        source: '*',
        headers: [
          {
            key: 'X-Clacks-Overhead',
            value: 'GNU Terry Pratchett',
          }
        ],
      },
    ]
  },
}