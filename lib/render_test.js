const fs = require('fs')
const path = require('path')
const Renderer = require('./renderer')

const scans_dir = '../scans',
	  scans_dir_full = path.normalize([__dirname, scans_dir].join(path.sep)),
	  input  = `${scans_dir_full}/render_test.json`
      output = `${scans_dir_full}/render_test.svg`

let obj = require(input)
let svg = Renderer.render(obj)

fs.writeFileSync(output, svg)

console.log(`Wrote ${output}`)