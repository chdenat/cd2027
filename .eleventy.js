module.exports = function (eleventyConfig) {
  eleventyConfig.setServerOptions({
    port: 4555,
  })

  eleventyConfig.addPassthroughCopy({
    'src/assets': 'assets',
    'node_modules/@awesome.me/webawesome/dist-cdn': 'assets/webawesome',
    'node_modules/@fortawesome/fontawesome-free/svgs': 'assets/fontawesome/svgs',
  })

  eleventyConfig.addFilter('frenchDate', (value) => value ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' }).format(new Date(value)) : '')
  eleventyConfig.addFilter('summary', (value, count = 40) => {
    const words = String(value || '').split(/\s+/)
    return words.length > count ? `${words.slice(0, count).join(' ')}…` : value
  })
  eleventyConfig.addFilter('json', (value) => JSON.stringify(value))
  eleventyConfig.addWatchTarget('.data/wordpress-revision.json')
  eleventyConfig.addFilter('price', (prices) => {
    if (!prices || prices.price == null || prices.price === '') return ''
    const minorUnit = Number(prices.currency_minor_unit ?? 2)
    const amount = Number(prices.price) / 10 ** minorUnit
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: prices.currency_code || 'EUR',
    }).format(amount)
  })

  return {
    dir: {
      input: 'src',
      includes: '_includes',
      output: '_site',
    },
    templateFormats: ['njk', 'md'],
    htmlTemplateEngine: 'njk',
    markdownTemplateEngine: 'njk',
  }
}
