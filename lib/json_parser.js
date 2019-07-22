/* Reads a rawscan, returns a json object */
const fs = require ('fs')
const YAML = require('yaml')
const readline = require('readline')

function parse(filename) {
  let raw_metadata = '',
      scans = [],
      reading_front_matter = false,
      current_scan,
      metadata

  let promise = new Promise((resolve, reject) => {
    readline.createInterface({
      input: fs.createReadStream(filename),
      terminal: false
    }).on('line', line => {
      if(line.startsWith('#')) return

      if(line.startsWith('---')) {
        if(reading_front_matter)
          metadata = YAML.parse(raw_metadata)

        reading_front_matter = !reading_front_matter
        return
      }

      if(reading_front_matter) {
        raw_metadata += line + "\n"
        return
      }

      if(line.startsWith('BEGIN')) {
        current_scan = initScan(scans.length, metadata)
        return
      }

      if(line.startsWith('END')) {
        scans.push(processScan(current_scan))
        return
      }

      let parsed_line = parseLine(line)
      current_scan.points.push(parsed_line.points)
      current_scan.units = current_scan.units || parsed_line.unit
    }).on('close', (_) => {
      resolve({
        name: metadata.name,
        description: metadata.description,
        date: metadata.date,
        iso8601: metadata.iso8601,
        scans: scans
      })
    })
  })

  return promise
}

function initScan(scan_index, metadata) {
  let scan_name = metadata['scans'] && metadata['scans'][scan_index]

  return {
    name: scan_name,
    number: scan_index + 1,
    units: null,
    width: null,
    height: null,
    min_z: null,
    max_z: null,
    points: []
  }
}

function processScan(scan) {
  if(scan.points.length > 0) {
    let points = scan.points,
        min,
        max,
        width

    width = points[points.length - 1][0]
    min = Math.min( ...points.map(([x, z]) => z) )
    max = Math.max( ...points.map(([x, z]) => z) )

    // Normalize points so that the min is 0
    scan.width = width
    scan.height = max - min
    scan.min_z = min - min
    scan.max_z = max - min
    scan.points = points.map(([x,z]) => [x, z - min])
  }

  return scan
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
  let re = /(-?[0-9.]+)(mm|in)/
  let match = point.match(re)
  let value = +match[1]
  let unit = match[2]

  return { value, unit }
}

exports.parse = parse
