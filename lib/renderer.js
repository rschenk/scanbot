const paper = require('paper-jsdom')

// Conversion functions for real units
const dpi = 72
function inch (n) { return n * dpi }
function mm (n) { return inch(n / 25.4) }

function scale (n, units) {
  if (units.toLowerCase() === 'in') return inch(n)
  if (units.toLowerCase() === 'mm') return mm(n)
  return n
}

function format (n, units) {
  if (units.toLowerCase() === 'in') return n.toFixed(3)
  if (units.toLowerCase() === 'mm') return n.toFixed(1)
  return n
}

const scanStyle = {
  strokeWidth: 1,
  strokeColor: 'black'
}

const textStyle = {
  fontFamily: 'Avenir Next',
  strokeWidth: 0,
  fillColor: 'black'
}

function render (scan, yScaleFactor = 1) {
  const padding = inch(0.5)
  const totalHeight = scan.scans.map(s => scale(s.height, s.units) * yScaleFactor).reduce((t, c) => t + c, 0)
  const maxWidth = Math.max(...scan.scans.map(s => scale(s.width, s.units)))
  let cumulativeHeight = 0

  paper.setup(new paper.Size(
    maxWidth + 2 * padding,
    totalHeight + padding * scan.scans.length
  ))

  // Metadata
  const metadata = new paper.PointText([padding, padding])
  metadata.style = textStyle
  metadata.content = `${scan.name}\n${scan.description}\n${scan.date}`
  if (yScaleFactor > 1) metadata.content += `\nY values scaled ${yScaleFactor}x`

  paper.view.viewSize.height += metadata.bounds.height + padding
  cumulativeHeight += metadata.bounds.height + padding

  // Ruler
  const ruler = drawRuler()
  ruler.bounds.topLeft = metadata.bounds.bottomLeft.add([0, padding])
  paper.view.viewSize.height += ruler.bounds.height + padding + padding
  cumulativeHeight += ruler.bounds.height + padding + padding

  scan.scans.forEach(s => {
    if (s.points.length === 0) return

    const path = new paper.Path(s.points.map(([x, z]) => [scale(x, s.units), scale(z, s.units) * -yScaleFactor]))
    path.style = scanStyle
    path.bounds.topCenter = [
      paper.project.view.center.x,
      cumulativeHeight
    ]

    const metadata = new paper.PointText([paper.project.view.center.x, cumulativeHeight - 5])
    metadata.style = { ...textStyle, justification: 'center' }
    metadata.content = `${s.name} (${format(s.width, s.units)}x${format(s.height, s.units)}${s.units})`

    cumulativeHeight += path.bounds.height + padding
  })

  return paper.project.exportSVG({
    asString: true,
    precision: 3
  })
}

function drawRuler () {
  const tickSize = inch(1 / 8)

  const inchScale = new paper.Path()
  inchScale.style = scanStyle
  inchScale.moveTo(0, 0)
  inchScale.lineBy(0, tickSize)
  inchScale.lineBy(inch(1), 0)
  inchScale.lineBy(0, -tickSize)

  const cmScale = new paper.Path()
  cmScale.style = scanStyle
  cmScale.moveTo(0, 0)
  cmScale.lineBy(0, -tickSize)
  cmScale.lineBy(mm(10), 0)
  cmScale.lineBy(0, tickSize)

  cmScale.bounds.topLeft = inchScale.bounds.topRight

  const inchLabel = new paper.PointText(inchScale.bounds.topLeft.subtract([0, 5]))
  inchLabel.content = 'inch'

  const cmLabel = new paper.PointText(cmScale.bounds.topLeft.subtract([0, 5]))
  cmLabel.content = 'cm'

  return new paper.Group(inchLabel, inchScale, cmLabel, cmScale)
}

exports.render = render
