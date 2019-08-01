const inquirer = require('inquirer')
inquirer.registerPrompt('fuzzypath', require('inquirer-fuzzy-path'))
const chalk = require('chalk')
const figlet = require('figlet')
const ora = require('ora')
const strftime = require('strftime')
const path = require('path')
const serialBindings = require('@serialport/bindings')
const fs = require('fs')

const MouseReader = require('./mouse_reader')
const RawScanParser = require('./rawscan_parser')
const RawScanWriter = require('./rawscan_writer')
const ObjectParser = require('./object_parser')
const Renderer = require('./renderer')

const scansDir = '../scans'

let ignoredScans = []

run()

async function run () {
  banner()

  const mode = await inquirer.prompt([
    {
      name: 'mode',
      type: 'list',
      message: 'Do you want to...?',
      choices: ['Scan', 'Re-Render'],
      default: 0
    }
  ])

  if (mode.mode === 'Scan') {
    return (
      scan()
        .then(postProcess)
        .then(filepath => {
          return parse(filepath)
            .then(parsedObj => {
              writeJson(filepath, parsedObj)
              return parsedObj
            })
            .then(obj => writeRenders(filepath, obj))
        })
        .then(echoWrite)
    )
  } else {
    return (
      promptScans('json')
        .then(file => {
          return loadJson(file)
            .then(obj => writeRenders(file, obj))
        })
        .then(echoWrite)
    )
  }
}

async function scan () {
  return (
    getScanConfig()
      .then(config => {
        return new Promise((resolve, reject) => {
          const filepath = filepathFor(config['name'])
          const relativeFilepath = path.relative(process.cwd(), filepath)

          const reader = new MouseReader(
            config['port'],
            filepath,
            config['name'],
            config['description'],
            config['mirror']
          )

          let spinner
          let scanCount = 0
          ignoredScans = []

          reader.on('beginScan', () => {
            spinner = ora(`Scan ${++scanCount}`).start()
          })
          reader.on('endScan', () => spinner.succeed())

          process.stdin.resume()
          process.stdin.on('keypress', (str, key) => {
            if (key.name === 'q') {
              reader.stop()
              console.log('Done!')
              resolve(filepath)
            }

            if (key.name === 'x') {
              ignoredScans.push(scanCount - 1)
              console.log(`${chalk.red('✗')} Marked Scan ${scanCount} to be ignored`)
            }
          })

          console.log(`Listening on ${config['port']}...`)
          console.log(`Ready to scan "${config['name']}"`)
          console.log(`  to ${relativeFilepath}`)
          console.log(``)
          console.log(`Commands:`)
          console.log(`  q <Enter> when done scanning`)
          console.log(`  x <Enter> to ignore the previous scan`)
          console.log(``)
        })
      })
  )
}

function banner () {
  console.log(figlet.textSync('ScanBot 69420', { font: 'big' }))
}

async function promptScans (extension) {
  const scansDirFullPath = path.normalize([__dirname, scansDir].join(path.sep))
  const dir = path.relative(process.cwd(), scansDirFullPath)

  return inquirer.prompt([
    {
      type: 'fuzzypath',
      name: 'path',
      excludePath: path => {
        const include = path === dir || path.match(extension)
        return !include
      },
      itemType: 'file',
      rootPath: dir,
      message: 'Select file:',
      default: ''
    }
  ]).then(answer => path.normalize([process.cwd(), answer['path']].join(path.sep)))
}

async function getScanConfig () {
  const serialPorts = await listSerialPorts()
  const defaultPort = serialPorts.find(p => p.match(/arduino/i))
  const defaultPortIndex = defaultPort && serialPorts.indexOf(defaultPort)

  const questions = [
    {
      name: 'port',
      type: 'list',
      message: 'Which port?',
      choices: serialPorts,
      default: defaultPortIndex,
      filter: (p) => p.split('\t')[0]
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
    },
    {
      name: 'mirror',
      type: 'list',
      message: 'Duplicate and mirror the render? (Useful for scanning half surfboards)',
      choices: [
        { value: 'no', name: 'No' },
        { value: 'end', name: 'End - Last point recorded will be the reflection point', short: 'End' },
        { value: 'start', name: 'Start - First point recorded will be the reflection point', short: 'Start' }
      ]
    }
  ]
  return inquirer.prompt(questions)
}

async function listSerialPorts () {
  return serialBindings.list()
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

function filepathFor (name) {
  const escapedName = name
    .toLowerCase()
    .replace(/\W+/g, '-')
    .replace(/^-+|-+$/, '')

  const now = new Date()
  const timestamp = strftime('%Y-%m-%d--%H-%M-%S', now)

  const filename = `${escapedName}--${timestamp}.rawscan.txt`

  return path.normalize(
    [__dirname, scansDir, filename].join(path.sep)
  )
}

async function postProcess (filepath) {
  const newFilepath = `${filepath}~`
  const {
    parsedMetadata,
    numScans,
    rawData
  } = await RawScanParser.parse(filepath)

  console.log(`\n\nYou scanned ${numScans} scans. Name them:`)

  const questions = new Array(numScans).fill(null).map((_, i) => {
    const message = `Scan ${i + 1} of ${numScans}`
    const name = `scan_${i}`
    const ignored = ignoredScans.includes(i)

    return ({
      type: 'input',
      name,
      message,
      when: (answers) => {
        if (ignored) {
          console.log(`${chalk.green('!')} ${chalk.bold(message)} was marked as ignored`)
          answers[name] = 'IGNORE'
          return false
        }
        return true
      }
    })
  })
  const answers = await inquirer.prompt(questions)

  // Probably overkill but order is extremely important
  const names = new Array(numScans).fill(null).map((_, i) => answers[`scan_${i}`])

  parsedMetadata.scans = names

  // Write additional metadata to new file, then overwrite the old one
  return RawScanWriter
    .write(newFilepath, parsedMetadata, rawData)
    .then(() => {
      return new Promise((resolve, reject) => {
        fs.rename(newFilepath, filepath, (err) => {
          err ? reject(err) : resolve(filepath)
        })
      })
    })
}

async function parse (filepath) {
  return ObjectParser.parse(filepath)
}

async function loadJson (file) {
  return Promise.resolve(require(file))
}

async function writeJson (rawscanFilepath, obj) {
  const pathParts = rawscanFilepath.split('.rawscan.')
  const jsonPath = `${pathParts[0]}.json`
  const jsonData = JSON.stringify(obj, null, 2)

  return new Promise((resolve, reject) => {
    fs.writeFile(jsonPath, jsonData, (err) => {
      if (err) reject(err)
      resolve(jsonPath)
    })
  })
}

async function writeRenders (rawscanFilepath, obj) {
  const pathParts = rawscanFilepath.split(/(\.rawscan\.|\.json)/)
  const baseFilename = pathParts[0]

  const render1x = new Promise((resolve, reject) => {
    const svg = Renderer.render(obj, 1)
    const file = `${baseFilename}.svg`
    fs.writeFile(file, svg, (err) => {
      if (err) reject(err)
      resolve(file)
    })
  })

  const render3x = new Promise((resolve, reject) => {
    const svg = Renderer.render(obj, 3)
    const file = `${baseFilename}@3y.svg`
    fs.writeFile(file, svg, (err) => {
      if (err) reject(err)
      resolve(file)
    })
  })

  return Promise.all([render1x, render3x])
}

function echoWrite (files) {
  files.forEach(f => console.log(path.relative(process.cwd(), f)))
}
