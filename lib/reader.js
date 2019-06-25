const EventEmitter = require('events');
const fs = require('fs')
const SerialPort = require('serialport')
const Readline = require('@serialport/parser-readline')

module.exports = class Reader extends EventEmitter {
  constructor(serial_path, output_path, name, description) {
    super()

    this.baud = 115200
    this.output_path = output_path

    this.port = new SerialPort(serial_path, {baudRate: this.baud})
    this.readline = new Readline()
    this.port.pipe(this.readline)
    this.readline.on('data', this.onData.bind(this))

    this.file_stream = fs.createWriteStream(output_path)
    this.writeFileHeader(name, description)
    this.file_stream.on('close', () => this.emit('close'))
  }

  writeFileHeader(name, description) {
    const now = new Date()
    this.file_stream.write(`---\n`)
    this.file_stream.write(`name: ${name}\n`)
    this.file_stream.write(`description: ${description}\n`)
    this.file_stream.write(`date: ${now.toString()}\n`)
    this.file_stream.write(`iso8601: ${now.toISOString()}\n`)
    this.file_stream.write(`---\n`)
  }

  onData(line) {
    this.file_stream.write(`${line}\n`)

    if(line.match(/^BEGIN/))
      this.emit('beginScan')

    if(line.match(/^END/))
      this.emit('endScan')
  }

  stop() {
    this.file_stream.end()
    this.port.close()
  }
}