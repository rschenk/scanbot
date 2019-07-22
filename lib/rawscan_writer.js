const fs = require ('fs')
const YAML = require('yaml')

function write(filename, metadata, data) {
  const metadata_string = YAML.stringify(metadata)
  const file_contents = `---\n${metadata_string}---\n${data}`

  return new Promise((res, rej) => {
    fs.writeFile(filename, file_contents, (err) => {
      if(err) {
        rej(err)
      } else {
        res(filename)
      }
    })
  })
}

exports.write = write

