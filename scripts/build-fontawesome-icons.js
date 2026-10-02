const result = await Bun.build({
  entrypoints: ['scripts/fontawesome-icons.entry.js'],
  outdir: '.build',
  naming: 'fontawesome-icons.js',
  target: 'browser',
  format: 'esm',
  minify: true,
})

if (!result.success) {
  for (const log of result.logs) console.error(log)
  process.exit(1)
}
