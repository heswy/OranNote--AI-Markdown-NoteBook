const fs = require('fs')
const path = require('path')
const pngToIco = require('png-to-ico')

const src = path.resolve(__dirname, '..', 'logoforpkg.png')
const outDir = path.resolve(__dirname, '..', 'build', 'icons')
const outIco = path.join(outDir, 'icon.ico')

fs.mkdirSync(outDir, { recursive: true })
pngToIco(src).then(buf => {
  fs.writeFileSync(outIco, buf)
  console.log('Wrote', outIco)
}).catch(err => {
  console.error(err)
  process.exit(1)
})
console.log('Wrote', outIco)
