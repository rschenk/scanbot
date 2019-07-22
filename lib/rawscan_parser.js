/*
 * As data is read from the mouse scanner, it is streamed directly to a file.
 * This is to preserve as much data as possible should the scanbot app crash
 * or whatever. The problem is, after the scan is complete, we want to collect
 * more metadata about the scans contained within, then re-write the rawscan
 * file with this extra metadata. That's were this little parser comes in...it
 * re-reads the rawscan file, parses the metadata, with the intention of
 * allowing us to add more and overwriting the file.
 */

const fs = require ('fs')
const YAML = require('yaml')
const readline = require('readline')

function parse(filename) {
  let raw_metadata = '',
      raw_data = '',
      num_scans = 0,
      parsed_metadata,
      reading_front_matter = false

  return new Promise((resolve, reject) => {
    readline.createInterface({
      input: fs.createReadStream(filename),
      terminal: false
    }).on('line', line => {
      if(line.startsWith('---')) {
        reading_front_matter = !reading_front_matter
        return
      }

      if(reading_front_matter) {
        raw_metadata += line + "\n"
        return
      }

      if(line.startsWith('BEGIN')) {
        num_scans++
      }

      raw_data += line + "\n"
    }).on('close', () => {
      parsed_metadata = YAML.parse(raw_metadata)

      resolve({
        parsed_metadata,
        num_scans,
        raw_metadata,
        raw_data
      })
    })
  })
}

exports.parse = parse