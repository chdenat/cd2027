module.exports = function (eleventyConfig) {
  eleventyConfig.setServerOptions({
    port: 4555,
  })

  eleventyConfig.addPassthroughCopy({
    'src/assets': 'assets',
    'node_modules/@awesome.me/webawesome/dist-cdn': 'assets/webawesome',
    '.build/fontawesome-icons.js': 'assets/fontawesome-icons.js',
  })

  if (process.env.CD2027_WP_AUTH === '1') {
    eleventyConfig.addPassthroughCopy({
      'deploy/cd2027-auth/.htaccess': '.htaccess',
      'deploy/cd2027-auth/login.css': 'cd2027-login.css',
    })
  }

  eleventyConfig.addFilter('frenchDate', (value) => value ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' }).format(new Date(value)) : '')
  eleventyConfig.addFilter('summary', (value, count = 40) => {
    const words = String(value || '').split(/\s+/)
    return words.length > count ? `${words.slice(0, count).join(' ')}…` : value
  })
  eleventyConfig.addFilter('json', (value) => JSON.stringify(value))
  eleventyConfig.addWatchTarget('.data/wordpress-revision.json')
  if (process.env.CD2027_WP_AUTH !== '1') {
    eleventyConfig.on('eleventy.after', () => {
      const fs = require('node:fs')
      const path = require('node:path')
      for (const file of ['.htaccess', 'cd2027-gate.php', 'cd2027-login.css']) {
        fs.rmSync(path.join(__dirname, '_site', file), { force: true })
      }
    })
  }
  eleventyConfig.addFilter('price', (prices) => {
    if (!prices || prices.price == null || prices.price === '') return ''
    const minorUnit = Number(prices.currency_minor_unit ?? 2)
    const value = (Number(prices.price) / 10 ** minorUnit).toFixed(minorUnit)
    const [integer, fraction] = value.split('.')
    const groupedInteger = prices.currency_thousand_separator
      ? integer.replace(/\B(?=(\d{3})+(?!\d))/g, prices.currency_thousand_separator)
      : integer
    const amount = minorUnit ? `${groupedInteger}${prices.currency_decimal_separator ?? ','}${fraction}` : groupedInteger
    const symbol = prices.currency_symbol || prices.currency_code || 'EUR'
    return `${prices.currency_prefix || ''}${amount}${prices.currency_suffix ?? symbol}`
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
