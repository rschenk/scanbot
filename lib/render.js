const paper = require('paper-jsdom')
const parser = require('./parser.js')

const filename = process.argv[2]

const y_scale_factor = 3 // Increase the y-scale for easy viewing

parser.parse(filename).then(renderScans)

function renderScans(scans) {

  let padding = 50,
      cumulative_height = padding

  paper.setup(new paper.Size(500,500))
  paper.project.currentStyle = {
    strokeWidth: 1,
    strokeColor: 'black'
  }


  scans.forEach( scan => {
    if(scan.points.length == 0) return

    let path = new paper.Path(scan.points.map( ([x,z]) => [x, z*y_scale_factor]) )
    path.bounds.topCenter = [
      paper.project.view.center.x,
      cumulative_height
    ]

    cumulative_height += path.bounds.height + padding
  })

  console.log(
    paper.project.exportSVG({
      asString: true,
      precision: 3
    })

  )
}
