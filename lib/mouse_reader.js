const EventEmitter = require('events')
const fs = require('fs')
const SerialPort = require('serialport')
const Readline = require('@serialport/parser-readline')
const YAML = require('yaml')

module.exports = class Reader extends EventEmitter {
  constructor (serialPath, outputPath, name, description) {
    super()

    this.baud = 115200
    this.outputPath = outputPath

    this.port = new SerialPort(serialPath, { baudRate: this.baud })
    this.readline = new Readline()
    this.port.pipe(this.readline)
    this.readline.on('data', this.onData.bind(this))

    this.file_stream = fs.createWriteStream(outputPath)
    this.writeFileHeader(name, description)
    this.file_stream.on('close', () => this.emit('close'))
  }

  writeFileHeader (name, description) {
    const now = new Date()
    const metadata = {
      name,
      description,
      date: now.toString(),
      iso8601: now.toISOString()
    }
    this.file_stream.write(`---\n`)
    this.file_stream.write(YAML.stringify(metadata))
    this.file_stream.write(`---\n`)
  }

  onData (line) {
    this.file_stream.write(`${line}\n`)

    if (line.match(/^BEGIN/)) { this.emit('beginScan') }

    if (line.match(/^END/)) { this.emit('endScan') }
  }

  stop () {
    this.file_stream.end()
    this.port.close()
  }
}
