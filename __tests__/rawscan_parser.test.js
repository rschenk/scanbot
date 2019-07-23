const path = require('path')
const parser = require('../lib/rawscan_parser')

test('.parse', () => {
  const testFile = path.normalize([
    __dirname, '__fixtures__', 'test-scan.rawscan.txt'
  ].join(path.sep))

  return parser.parse(testFile).then(parsed => {
    expect(parsed.numScans).toBe(2)

    expect(parsed.rawMetadata).toBeDefined()
    expect(parsed.parsedMetadata.name).toBe('Test Scan')
    expect(parsed.parsedMetadata.description).toBe('This is a test')
    expect(parsed.parsedMetadata.date).toBe('Mon Jun 24 2019 21:38:06 GMT-0400 (Eastern Daylight Time)')
    expect(parsed.parsedMetadata.iso8601).toBe('2019-06-25T01:38:06.443Z')

    expect(parsed.rawData).toBe(
      'BEGIN\n' +
      '0.99mm -0.98mm\n' +
      '2.98mm -0.97mm\n' +
      'END\n' +
      'BEGIN\n' +
      '30.75mm -0.86mm\n' +
      '34.72mm -0.84mm\n' +
      'END\n'
    )
  })
})
