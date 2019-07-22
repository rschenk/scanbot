const path = require('path')
const parser = require('../lib/rawscan_parser')

test('.parse', () => {
  let test_file = path.normalize([
      __dirname, '__fixtures__', 'test-scan.rawscan.txt'
    ].join(path.sep))

  return parser.parse(test_file).then(parsed => {
    expect(parsed.num_scans).toBe(2)

    expect(parsed.raw_metadata).toBeDefined()
    expect(parsed.parsed_metadata.name).toBe('Test Scan')
    expect(parsed.parsed_metadata.description).toBe('This is a test')
    expect(parsed.parsed_metadata.date).toBe('Mon Jun 24 2019 21:38:06 GMT-0400 (Eastern Daylight Time)')
    expect(parsed.parsed_metadata.iso8601).toBe('2019-06-25T01:38:06.443Z')

    expect(parsed.raw_data).toBe(
      "BEGIN\n" +
      "0.99mm -0.98mm\n" +
      "2.98mm -0.97mm\n" +
      "END\n" +
      "BEGIN\n" +
      "30.75mm -0.86mm\n" +
      "34.72mm -0.84mm\n" +
      "END\n"
    )
  })
})