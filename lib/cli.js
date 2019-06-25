const inquirer = require('inquirer')
const figlet = require('figlet')
const ora = require('ora')
const strftime = require('strftime')
const path = require('path')
const serial_bindings = require('@serialport/bindings')

const Reader = require('./reader')

const scans_dir = '../scans'

run()

async function run() {
  banner()

  let mode = await inquirer.prompt([
    {
      name: 'mode',
      type: 'list',
      message: 'Do you want to...?',
      choices: ['Scan', 'Render'],
      default: 0
    }
  ])

  console.log(mode['mode'])

  return(
    scan()
    .then((filepath) => console.log(`party! ${filepath}`))
  )
}

async function scan() {
  return (
    getScanConfig()
    .then(config => {
      return new Promise((resolve, reject) => {
        let filepath = filepath_for(config['name'])
        let relative_filepath = path.relative('./', filepath)

        let reader = new Reader(
          config['port'],
          filepath,
          config['name'],
          config['description']
        )

        let spinner,
            scan_count = 0

        reader.on('beginScan', () => {
          spinner = ora(`Scan ${++scan_count}`).start()
        })
        reader.on('endScan', () => spinner.succeed() )

        process.stdin.resume();
        process.stdin.on('keypress', (str, key) => {
          if (key.name === 'q') {
            reader.stop()
            console.log('Done!')
            resolve(filepath)
          }
        });

        console.log(`Listening on ${config["port"]}...`)
        console.log(`Ready to scan "${config["name"]}"`)
        console.log(`  to ${relative_filepath}`)
        console.log('')
        console.log(`Hit q <Enter> when done scanning`)
      })
    })
  )
}

function banner() {
  console.log(figlet.textSync('ScanBot', { font: 'big' }))
}

async function getScanConfig() {
  const serial_ports = await serialPorts()
  const default_port = serial_ports.find(p => p.match(/arduino/i))
  const default_port_index = default_port && serial_ports.indexOf(default_port)

  const questions = [
    {
      name: 'port',
      type: 'list',
      message: 'Which port?',
      choices: serial_ports,
      default: default_port_index,
      filter: (p) => p.split("\t")[0]
    },
    {
      name: 'name',
      type: 'input',
      message: 'Name this scan',
      default: 'scan'
    },
    {
      name: 'description',
      type: 'input',
      message: 'Description:',
      default: ''
    }
  ]
  return inquirer.prompt(questions)
}

async function serialPorts() {
  return serial_bindings.list()
    .then(ports => {
      return ports.map(port => {
        return `${port.comName}\t${port.pnpId || ''}\t${port.manufacturer || ''}`
      })
    })
    .catch(err => {
      console.error(JSON.stringify(err))
      process.exit(1)
    })
}

function filepath_for(name) {
  let escaped_name = name
    .toLowerCase()
    .replace(/\W+/g, '-')
    .replace(/^-+|-+$/, '')

  let now = new Date()
  let timestamp = strftime('%Y-%m-%d--%H-%M-%S', now)

  let filename = `${escaped_name}--${timestamp}.rawscan.txt`

  return path.normalize(
    [__dirname, scans_dir, filename].join(path.sep)
  )
}
