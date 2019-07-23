const path = require('path')
const parser = require('../lib/object_parser')

test('.parse', () => {
  let test_file = path.normalize([
      __dirname, '__fixtures__', 'test-scan-full-meta.rawscan.txt'
    ].join(path.sep))

  return parser.parse(test_file).then(parsed => {
    expect(parsed.name).toBe('Test Scan with full metadata')
    expect(parsed.description).toBe('This is a test')
    expect(parsed.date).toBe('Mon Jun 24 2019 21:38:06 GMT-0400 (Eastern Daylight Time)')
    expect(parsed.iso8601).toBe('2019-06-25T01:38:06.443Z')

    expect(parsed.scans.length).toBe(3)

    let scan = parsed.scans[0]
    expect(scan.name).toBe('all positive values')
    expect(scan.number).toBe(1)
    expect(scan.units).toBe('mm')
    expect(scan.width).toBe(3)
    expect(scan.height).toBe(2)
    expect(scan.min_z).toBe(0)
    expect(scan.max_z).toBe(2)
    expect(scan.points).toEqual([
      [1, 0], 
      [2, 1],
      [3, 2]
    ])

    scan = parsed.scans[1]
    expect(scan.name).toBe('all negative values')
    expect(scan.number).toBe(2)
    expect(scan.units).toBe('in')
    expect(scan.width).toBe(30)
    expect(scan.height).toBe(6)
    expect(scan.min_z).toBe(0)
    expect(scan.max_z).toBe(6)
    expect(scan.points).toEqual([
      [10, 0], 
      [20, 3],
      [30, 6]
    ])

    scan = parsed.scans[2]
    expect(scan.name).toBe('positive and negative values')
    expect(scan.number).toBe(3)
    expect(scan.units).toBe('mm')
    expect(scan.width).toBe(6)
    expect(scan.height).toBe(11)
    expect(scan.min_z).toBe(0)
    expect(scan.max_z).toBe(11)
    expect(scan.points).toEqual([
      [2, 0], 
      [4, 1],
      [6, 11]
    ])
  })
})