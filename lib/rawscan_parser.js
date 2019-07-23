/*
 * As data is read from the mouse scanner, it is streamed directly to a file.
 * This is to preserve as much data as possible should the scanbot app crash
 * or whatever. The problem is, after the scan is complete, we want to collect
 * more metadata about the scans contained within, then re-write the rawscan
 * file with this extra metadata. That's where this little parser comes in...it
 * re-reads the rawscan file, parses the metadata, with the intention of
 * allowing us to add more and overwriting the file, but it does not do any of
 * the fancy aggregation or anylization that the usual object_parser does.
 */

const fs = require('fs')
const YAML = require('yaml')
const readline = require('readline')

function parse (filename) {
  let rawMetadata = ''
  let rawData = ''
  let numScans = 0
  let parsedMetadata
  let readingFrontMatter = false

  return new Promise((resolve, reject) => {
    readline.createInterface({
      input: fs.createReadStream(filename),
      terminal: false
    }).on('line', line => {
      if (line.startsWith('---')) {
        readingFrontMatter = !readingFrontMatter
        return
      }

      if (readingFrontMatter) {
        rawMetadata += line + '\n'
        return
      }

      if (line.startsWith('BEGIN')) {
        numScans++
      }

      rawData += line + '\n'
    }).on('close', () => {
      parsedMetadata = YAML.parse(rawMetadata)

      resolve({
        parsedMetadata,
        numScans,
        rawMetadata,
        rawData
      })
    })
  })
}

exports.parse = parse
