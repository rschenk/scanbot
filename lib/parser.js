const fs = require ('fs')
var readline = require('readline')

function parse(filename) {
  let output = []
  let current_scan;

  let promise = new Promise((resolve, reject) => {
    readline.createInterface({
      input: fs.createReadStream(filename),
      terminal: false
    }).on('line', line => {
      if(line.startsWith('#')) return

      if(line.startsWith('BEGIN')) {
        current_scan = {
          scan: output.length + 1,
          units: null,
          width: null,
          min_z: null,
          max_z: null,
          points: []
        }
        return
      }

      if(line.startsWith('END')) {
        if(current_scan.points.length > 0) {
          let points = current_scan.points
          current_scan.width = points[points.length - 1][0]
          current_scan.min_z = Math.min( ...points.map(([x, z]) => z) )
          current_scan.max_z = Math.max( ...points.map(([x, z]) => z) )
        }
        output.push(current_scan)
        return
      }

      let parsed_line = parseLine(line)
      current_scan.points.push(parsed_line.points)
      current_scan.units = current_scan.units || parsed_line.unit
    }).on('close', (_) => resolve(output) )
  })

  return promise
}



function parseLine(line) {
  let points = line.trim().split(' ')

  let parsed = points.map(parsePoint)

  return {
    points: parsed.map(point => point.value),
    unit: parsed[0].unit
  }
}

function parsePoint(point) {
  let re = /([0-9.]+)(mm|in)/
  let match = point.match(re)
  let value = +match[1]
  let unit = match[2]

  return { value, unit }
}

exports.parse = parse
