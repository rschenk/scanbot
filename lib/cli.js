const inquirer = require('inquirer')
inquirer.registerPrompt('fuzzypath', require('inquirer-fuzzy-path'))
const figlet = require('figlet')
const ora = require('ora')
const strftime = require('strftime')
const path = require('path')
const serial_bindings = require('@serialport/bindings')
const fs = require('fs')

const MouseReader = require('./mouse_reader')
const RawScanParser = require('./rawscan_parser')
const RawScanWriter = require('./rawscan_writer')
const ObjectParser = require('./object_parser')
const Renderer = require('./renderer')

const scans_dir = '../scans'

run()

async function run() {
  banner()

  let mode = await inquirer.prompt([
    {
      name: 'mode',
      type: 'list',
      message: 'Do you want to...?',
      choices: ['Scan', 'Re-Render'],
      default: 0
    }
  ])

  if (mode.mode === 'Scan') {
    return(
      scan()
      .then(post_process)
      .then(filepath => {
        return parse(filepath)
                .then(parsed_obj => {
                  write_json(filepath, parsed_obj)
                  return parsed_obj
                })
                .then(obj => write_renders(filepath, obj))
      })
      .then(echo_write)
    )
  } else {
    return (
      prompt_scans('json')
      .then(file => {
        return load_json(file)
          .then(obj => write_renders(file, obj))
      })
      .then(echo_write)
    )
  }
}

async function scan() {
  return (
    getScanConfig()
    .then(config => {
      return new Promise((resolve, reject) => {
        let filepath = filepath_for(config['name'])
        let relative_filepath = path.relative(process.cwd(), filepath)

        let reader = new MouseReader(
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
  console.log(figlet.textSync('ScanBot 69420', { font: 'big' }))
}

async function prompt_scans(extension) {
    let scans_dir_full_path = path.normalize([__dirname, scans_dir].join(path.sep))
    let dir = path.relative(process.cwd(), scans_dir_full_path)

    return inquirer.prompt([
    {
      type: 'fuzzypath',
      name: 'path',
      excludePath: path => { 
        let include = path == dir || path.match(extension)
        return !include
      },
      itemType: 'file',
      rootPath: dir,
      message: 'Select file:',
      default: '',
    }
  ]).then(answer => path.normalize([process.cwd(), answer['path']].join(path.sep)))
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

async function post_process(filepath) {
  let new_filepath = `${filepath}~`
  let {
    parsed_metadata,
    num_scans,
    raw_data,
  } = await RawScanParser.parse(filepath)

  console.log(`\n\nYou scanned ${num_scans} scans. Name them:`)

  let questions = new Array(num_scans).fill(null).map((_, i) => {
    return({
      type: 'input',
      name: `scan_${i}`,
      message: `Scan ${i + 1} of ${num_scans}`,
    })
  })
  let answers = await inquirer.prompt(questions)

  // Probably overkill but order is extremely important
  let names = new Array(num_scans).fill(null).map((_, i) => answers[`scan_${i}`])

  parsed_metadata.scans = names

  // Write additional metadata to new file, then overwrite the old one
  return RawScanWriter
    .write(new_filepath, parsed_metadata, raw_data)
    .then(() => {
      return new Promise((res, rej) => {
        fs.rename(new_filepath, filepath, (err) => {
          err ? rej(err) : res(filepath)
        })
      })
    })
}

async function parse(filepath) {
  return ObjectParser.parse(filepath)
}

async function load_json(file) {
  return Promise.resolve(require(file))
}

async function write_json(rawscan_filepath, obj) {
  let path_parts = rawscan_filepath.split('.rawscan.'),
      json_path = `${path_parts[0]}.json`,
      json_data = JSON.stringify(obj, null, 2)

  return new Promise((res,rej) => {
    fs.writeFile(json_path, json_data, (err) => {
      if (err) rej(err)
      res(json_path)
    })
  })
}

async function write_renders(rawscan_filepath, obj) {
  let path_parts = rawscan_filepath.split(/(\.rawscan\.|\.json)/),
      base_filename = path_parts[0]

  let render_1x = new Promise((res, rej) => {
    let svg = Renderer.render(obj, 1),
        file = `${base_filename}.svg`
    fs.writeFile(file, svg, (err) => {
      if(err) rej(err)
      res(file)
    })
  })

  let render_3x = new Promise((res, rej) => {
    let svg = Renderer.render(obj, 3),
        file = `${base_filename}@3y.svg`
    fs.writeFile(file, svg, (err) => {
      if(err) rej(err)
      res(file)
    })
  })

  return Promise.all([render_1x, render_3x])
}

function echo_write(files) {
  files.forEach(f => console.log(path.relative(process.cwd(), f)))
}