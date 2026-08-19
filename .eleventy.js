module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy({
    'src/assets/favicon.svg': 'assets/favicon.svg',
    'node_modules/@fortawesome/fontawesome-free/svgs': 'assets/fontawesome/svgs',
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
