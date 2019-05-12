const inquirer = require("inquirer")
const figlet = require("figlet")

const serial_bindings = require('@serialport/bindings')

run()

async function run() {
  banner()
  askQuestions()
}

function banner() {
  console.log(figlet.textSync('ScanBot', { font: 'big' }))
}

async function askQuestions() {
  const serial_ports = await serialPorts()
  const default_port = serial_ports.find(p => p.match(/arduino/i))
  const default_port_index = default_port && serial_ports.indexOf(default_port)

  const questions = [
    {
      name: 'operation',
      type: 'list',
      message: 'Do you want to scan or render?',
      choices: ['Scan', 'Render']
    },
    {
      name: 'port',
      type: 'list',
      message: 'Which port?',
      choices: serial_ports,
      default: default_port_index
    },
    {
      name: 'name',
      type: 'input',
      message: 'Name this scan?',
      default: 'scan',
      filter: (n) => n.replace(/\W+/g, '-')
    }
  ]
  inquirer.prompt(questions)
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
