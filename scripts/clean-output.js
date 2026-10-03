const fs = require('node:fs')
const path = require('node:path')

function cleanOutput() {
  const projectRoot = path.resolve(__dirname, '..')
  const outputDirectory = path.resolve(projectRoot, '_site')

  if (outputDirectory !== path.join(projectRoot, '_site')) {
    throw new Error(`Refusing to clean an unexpected output directory: ${outputDirectory}`)
  }

  fs.rmSync(outputDirectory, { recursive: true, force: true })
  fs.mkdirSync(outputDirectory, { recursive: true })
}

module.exports = cleanOutput

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) cleanOutput()
