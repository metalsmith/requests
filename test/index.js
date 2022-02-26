const assert = require('assert')
const equals = require('assert-dir-equal')
const { describe, it } = require('mocha')
const Metalsmith = require('metalsmith')
const { name } = require('../package.json')
const plugin = require('..')

function fixture(p) {
  return require('path').resolve(__dirname, 'fixtures', p)
}

const googleHumansTxt =
  "Google is built by a large team of engineers, designers, researchers, robots, and others in many different sites across the globe. It is updated continuously, and built with more tools and technologies than we can shake a stick at. If you'd like to help us out, see careers.google.com.\n"

describe('@metalsmith/requests', function () {
  it('should export a named plugin function matching package.json name', function () {
    const namechars = name.split('/')[1]
    const camelCased = namechars.split('').reduce((str, char, i) => {
      str += namechars[i - 1] === '-' ? char.toUpperCase() : char === '-' ? '' : char
      return str
    }, '')
    assert.strictEqual(plugin().name, camelCased)
  })

  it('should not crash the metalsmith build when using default options', function (done) {
    Metalsmith(fixture('default'))
      .use(plugin())
      .build((err) => {
        if (err) done(err)
        equals(fixture('default/build'), fixture('default/expected'))
        done()
      })
  })

  it("should add a response's content to metadata", function (done) {
    const ms = Metalsmith(fixture('default'))
    ms.use(
      plugin({
        url: 'https://www.google.com/humans.txt',
        out: { metadata: 'googlehumans' }
      })
    ).process((err) => {
      if (err) done(err)
      assert.strictEqual(ms.metadata().googlehumans, googleHumansTxt)
      done()
    })
  })

  it("should add a response's content to a file, appending its data, and preserving its other metadata", function (done) {
    const ms = Metalsmith(fixture('default'))
    ms.use(function (files) {
      files['test.md'] = {
        layout: 'default.njk',
        contents: Buffer.from('testest')
      }
    })
      .use(
        plugin({
          url: 'https://www.google.com/humans.txt',
          out: { path: 'test.md' }
        })
      )
      .process((err, files) => {
        if (err) done(err)
        assert.strictEqual(files['test.md'].contents.toString(), 'testest' + googleHumansTxt)
        done()
      })
  })

  it('should treat files with a "request" key in metadata as entries', function (done) {
    Metalsmith(fixture('implicit-entries'))
      .use(plugin())
      .build((err) => {
        if (err) return done(err)
        equals(fixture('implicit-entries/build'), fixture('implicit-entries/expected'))
        done()
      })
  })

  it('should allow specifying a single request config', function (done) {
    Metalsmith(fixture('single-request-option'))
      .use(
        plugin({
          url: 'https://webketje.com/assets/css/main.css',
          out: { path: 'main.css' }
        })
      )
      .build((err) => {
        if (err) done(err)
        equals(fixture('single-request-option/build'), fixture('single-request-option/expected'))
        done()
      })
  })

  it('should parse a response as JSON when "out.json" is set', function (done) {
    const ms = Metalsmith(fixture('default'))
    ms.use(
      plugin({
        // parameterized w options
        url: 'https://api.github.com/repos/metalsmith/drafts/contents/README.md',
        out: { metadata: 'readme', json: true },
        options: {
          method: 'GET',
          auth: `metalsmith:${process.env.GITHUB_TOKEN}`,
          headers: {
            Accept: 'application/json'
          }
        }
      })
    ).process((err) => {
      if (err) done(err)
      assert.strictEqual(
        ms.metadata().readme.download_url,
        'https://raw.githubusercontent.com/metalsmith/drafts/master/README.md'
      )
      done()
    })
  })

  it('should provide basic support for GraphQL queries', function (done) {
    if (!process.env.GITHUB_TOKEN) {
      this.skip()
    }
    const gqlQuery = `query {
        repository(owner: "metalsmith", name: "sass") {
          object(expression: "master:README.md") {
            ... on Blob { text }
          }
        }
      }`
    const ms = Metalsmith(fixture('default'))
    ms.use(
      plugin({
        url: 'https://api.github.com/graphql',
        out: { metadata: 'sassreadme' },
        body: JSON.stringify({ query: gqlQuery }),
        options: {
          method: 'POST',
          headers: {
            Authorization: 'bearer ' + process.env.GITHUB_TOKEN,
            'Content-Type': 'application/json',
            Accept: 'application/json'
          }
        }
      })
    ).process((err) => {
      if (err) done(err)
      assert.strictEqual(
        ms.metadata().sassreadme.slice(0, 82),
        '{"data":{"repository":{"object":{"text":"# @metalsmith/sass\\n\\nA Metalsmith plugin'
      )
      done()
    })
  })

  it('should replace path placeholders in out and url options accordingly', function (done) {
    Metalsmith(fixture('placeholders'))
      .use(
        plugin({
          url: 'https://webketje.com/assets/css/:filename.css',
          out: { path: ':filename.css' },
          params: [{ filename: 'main' }, { filename: 'style' }]
        })
      )
      .build((err) => {
        if (err) done(err)
        equals(fixture('placeholders/build'), fixture('placeholders/expected'))
        done()
      })
  })

  describe('should throw error', function () {
    it('"unsupported_protocol" when the protocol is not supported', function (done) {
      Metalsmith(fixture('default'))
        .use(
          plugin({
            url: 'ftp://bad-protocol.com',
            out: { metadata: 'bad' }
          })
        )
        .process((err) => {
          assert.strictEqual(err.code, 'unsupported_protocol')
          done()
        })
    })

    it('"invalid_http_method" when the HTTP method is invalid', function (done) {
      Metalsmith(fixture('default'))
        .use(
          plugin({
            url: 'http://bad-httpmethod.com',
            out: { metadata: 'bad' },
            options: {
              method: 'FAULTY'
            }
          })
        )
        .process((err) => {
          assert.strictEqual(err.code, 'invalid_http_method')
          done()
        })
    })

    it('"invalid_outconfig" when the outconfig is invalid', function (done) {
      Metalsmith(fixture('default'))
        .use(
          plugin({
            url: 'http://bad-outoption.com',
            out: { faulty: 'bad' }
          })
        )
        .process((err) => {
          assert.strictEqual(err.code, 'invalid_outconfig')
          done()
        })
    })

    it('"http_error" when the HTTP method is invalid', function (done) {
      if (!process.env.GITHUB_TOKEN) {
        this.skip()
      }
      Metalsmith(fixture('default'))
        .use(
          plugin({
            url: 'https://graphql.github.com/graphql',
            out: { metadata: 'bad' },
            body: JSON.stringify({ query: 'query test { view { user { login }}}' }),
            options: {
              headers: {
                Authorization: 'bearer ' + process.env.GITHUB_TOKEN,
                'Content-Type': 'application/json',
                Accept: 'application/json'
              }
            }
          })
        )
        .process((err) => {
          assert.strictEqual(err.code, 'http_error')
          done()
        })
    })

    it('"invalid_json" when "out.json" is set and the response is invalid', function (done) {
      const ms = Metalsmith(fixture('default'))
      ms.use(
        plugin({
          url: 'https://www.google.com/humans.txt',
          out: { metadata: 'googlehumans', json: true }
        })
      ).process((err) => {
        assert.strictEqual(err.code, 'invalid_json')
        done()
      })
    })
  })
})
