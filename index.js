const fs = require('fs')
const strftime = require('strftime')
const SerialPort = require('serialport')
const Readline = require('@serialport/parser-readline')

const serial_path = '/dev/tty.usbmodem1411' // ls /dev/tty* | grep usb
const baud = 115200

let scan_count = 0

const now = new Date()
const output_path = `scan--${strftime('%Y-%m-%d--%H-%M-%S', now)}.txt`
const wstream = fs.createWriteStream(output_path)

process.stdin.resume();
process.on('SIGINT', () => {
  wstream.end()
  console.log(`\n${scan_count} scans written to ${output_path}`)
  process.exit(0)
})

console.log(`Writing to ${output_path}`)

wstream.write("# Scanbot\n")
wstream.write(`# Date: ${now.toString()}\n`)
wstream.write(`# ISO8601: ${now.toISOString()}\n`)

const port = new SerialPort(serial_path, { baudRate: baud })
const parser = new Readline()
port.pipe(parser)

parser.on('data', onData)

console.log(`Listening on ${serial_path}`)

function onData(line) {
  console.log(line)

  if(line.match(/^BEGIN/)) {
    scan_count++
    wstream.write(`BEGIN SCAN ${scan_count}\n`)
  } else {
    wstream.write(`${line}\n`)
  }
}

