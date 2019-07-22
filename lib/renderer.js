const paper = require('paper-jsdom')

// Conversion functions for real units 
const dpi = 72
function inch(n) { return n * dpi }
function mm(n) { return inch(n / 25.4) }

function scale(n, units) {
  if(units.toLowerCase() === 'in') return inch(n)
  if(units.toLowerCase() === 'mm') return mm(n)
  return n
}

function format(n, units) {
  if(units.toLowerCase() === 'in') return n.toFixed(3)
  if(units.toLowerCase() === 'mm') return n.toFixed(1)
  return n
}

const scan_style = {
  strokeWidth: 1,
  strokeColor: 'black'
}

const text_style = {
  fontFamily: 'Avenir Next',
  strokeWidth: 0,
  fillColor: 'black'
}

function render(scan, y_scale_factor = 1) {
  let padding = inch(0.5),
      total_height = scan.scans.map(s => scale(s.height, s.units) * y_scale_factor).reduce((t, c) => t+c, 0),
      max_width = Math.max(...scan.scans.map(s => scale(s.width, s.units))),
      cumulative_height = 0

  paper.setup(new paper.Size(
    max_width + 2*padding,
    total_height + padding * scan.scans.length
  ))

  // Metadata
  let metadata = new paper.PointText([padding, padding])
  metadata.style = text_style
  metadata.content = `${scan.name}\n${scan.description}\n${scan.date}`
  if(y_scale_factor > 1) metadata.content += `\nY values scaled ${y_scale_factor}x`

  paper.view.viewSize.height += metadata.bounds.height + padding
  cumulative_height += metadata.bounds.height + padding

  scan.scans.forEach(s => {
    if(s.points.length == 0) return

    let path = new paper.Path(s.points.map( ([x,z]) => [ scale(x, s.units), scale(z, s.units) * -y_scale_factor]) )
    path.style = scan_style
    path.bounds.topCenter = [
      paper.project.view.center.x,
      cumulative_height
    ]

    let metadata = new paper.PointText([paper.project.view.center.x, cumulative_height - 5])
    metadata.style = { ...text_style, justification: 'center' }
    metadata.content = `${s.name} (${format(s.width, s.units)}x${format(s.height, s.units)}${s.units})`

    cumulative_height += path.bounds.height + padding
  })

  return paper.project.exportSVG({
    asString: true,
    precision: 3
  })
}

exports.render = render
