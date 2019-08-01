/* Reads a rawscan, returns a fully parsed javascript object */
const fs = require('fs')
const YAML = require('yaml')
const readline = require('readline')

function parse (filename) {
  let rawMetadata = ''
  const scans = []
  let numScansRead = 0
  let readingFrontMatter = false
  let currentScan
  let metadata

  const promise = new Promise((resolve, reject) => {
    readline.createInterface({
      input: fs.createReadStream(filename),
      terminal: false
    }).on('line', line => {
      if (line.startsWith('#')) return

      if (line.startsWith('---')) {
        if (readingFrontMatter) { metadata = YAML.parse(rawMetadata) }

        readingFrontMatter = !readingFrontMatter
        return
      }

      if (readingFrontMatter) {
        rawMetadata += line + '\n'
        return
      }

      if (line.startsWith('BEGIN')) {
        currentScan = initScan(numScansRead++, scans.length, metadata)
        return
      }

      if (line.startsWith('END')) {
        if (currentScan.name !== 'IGNORE') {
          scans.push(processScan(currentScan))
        }
        return
      }

      const parsedLine = parseLine(line)
      currentScan.points.push(parsedLine.points)
      currentScan.units = currentScan.units || parsedLine.unit
    }).on('close', (_) => {
      resolve({
        name: metadata.name,
        description: metadata.description,
        mirror: metadata.mirror,
        date: metadata.date,
        iso8601: metadata.iso8601,
        scans: scans
      })
    })
  })

  return promise
}

function initScan (scanFileIndex, savedScansCount, metadata) {
  const scanName = metadata['scans'] && metadata['scans'][scanFileIndex]

  return {
    name: scanName,
    number: savedScansCount + 1,
    units: null,
    width: null,
    height: null,
    min_z: null,
    max_z: null,
    points: []
  }
}

function processScan (scan) {
  if (scan.points.length > 0) {
    const points = scan.points

    const width = points[points.length - 1][0]
    const min = Math.min(...points.map(([x, z]) => z))
    const max = Math.max(...points.map(([x, z]) => z))

    // Normalize points so that the min is 0
    scan.width = width
    scan.height = max - min
    scan.min_z = min - min
    scan.max_z = max - min
    scan.points = points.map(([x, z]) => [x, z - min])
  }

  return scan
}

function parseLine (line) {
  const points = line.trim().split(' ')

  const parsed = points.map(parsePoint)

  return {
    points: parsed.map(point => point.value),
    unit: parsed[0].unit
  }
}

function parsePoint (point) {
  const re = /(-?[0-9.]+)(mm|in)/
  const match = point.match(re)
  const value = +match[1]
  const unit = match[2]

  return { value, unit }
}

exports.parse = parse
