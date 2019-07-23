const fs = require('fs')
const YAML = require('yaml')

function write (filename, metadata, data) {
  const metadataString = YAML.stringify(metadata)
  const fileContents = `---\n${metadataString}---\n${data}`

  return new Promise((resolve, reject) => {
    fs.writeFile(filename, fileContents, (err) => {
      if (err) {
        reject(err)
      } else {
        resolve(filename)
      }
    })
  })
}

exports.write = write
