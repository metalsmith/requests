/* eslint-env node, mocha */
import assert from 'node:assert'
import { resolve, dirname } from 'node:path'
import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import equals from 'assert-dir-equal'
import Metalsmith from 'metalsmith'
import plugin from '../src/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const { name } = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf-8'))

function fixture(p) {
  return resolve(__dirname, 'fixtures', p)
}

const googleHumansTxt =
  "Google is built by a large team of engineers, designers, researchers, robots, and others in many different sites across the globe. It is updated continuously, and built with more tools and technologies than we can shake a stick at. If you'd like to help us out, see careers.google.com.\n"

describe('@metalsmith/requests', function () {
  let server

  before(() => {
    function handler(req, res) {
      res.setHeader('Content-Type', 'application/json')
      res.end('{invalid_json')
    }
    server = createServer(handler)
    server.listen('3000')
  })

  after(() => {
    server.close()
  })

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

  describe('should support out option matrix', function () {
    it('!out.key && !out.path: should default out option to debug logging', function (done) {
      let res
      const ms = Metalsmith(fixture('default'))
      const customDebugger = () =>
        function () {
          res = arguments[1]
        }
      customDebugger.enable = () => {}
      customDebugger.disable = () => {}
      customDebugger.info = () => {}
      customDebugger.error = () => {}
      customDebugger.warn = () => {}
      ms.debug = customDebugger
      ms.env('DEBUG', '@metalsmith/requests*')
        .use(plugin('https://www.google.com/humans.txt'))
        .process((err) => {
          if (err) done(err)
          try {
            assert(!!res.data.match('Google is built by a large team of engineers'))
            done()
          } catch (err) {
            done(err)
          }
        })
    })

    it("out.key && !out.path: should assign a response's data to global metadata", function (done) {
      const ms = Metalsmith(fixture('default'))
      const files = {}
      const config = {
        url: 'https://www.google.com/humans.txt',
        out: { key: 'googlehumans' }
      }
      plugin(config)(files, ms, (err) => {
        if (err) done(err)
        assert.strictEqual(ms.metadata().googlehumans, googleHumansTxt)
        done()
      })
    })

    it("!out.key && out.path: should assign a response's data to a file's 'contents' by default", function (done) {
      const ms = Metalsmith(fixture('default'))
      const files = { 'test.md': {} }
      const config = {
        url: 'https://www.google.com/humans.txt',
        out: { path: 'test.md' }
      }
      plugin(config)(files, ms, (err) => {
        if (err) done(err)
        assert.strictEqual(files['test.md'].contents.toString(), googleHumansTxt)
        done()
      })
    })

    it("out.key && out.path: should assign a response's data to file metadata at files[out.path][out.key]", function (done) {
      const ms = Metalsmith(fixture('default'))
      const files = { 'test.md': { layout: 'default.njk' } }
      const config = {
        url: 'https://www.google.com/humans.txt',
        out: { path: 'test.md', key: 'request' }
      }
      plugin(config)(files, ms, (err) => {
        if (err) done(err)
        assert.strictEqual(files['test.md'].request, googleHumansTxt)
        assert.strictEqual(files['test.md'].layout, 'default.njk')
        done()
      })
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

  it('should allow specifying shorthands', function (done) {
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

  it("should auto-parse a response as JSON when the response's Content-Type header is application/json", function (done) {
    const ms = Metalsmith(fixture('default'))
    ms.use(
      plugin({
        url: 'https://api.github.com/repos/metalsmith/drafts/contents/README.md',
        out: { key: 'readme' },
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
        'https://raw.githubusercontent.com/metalsmith/drafts/main/README.md'
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
          object(expression: "main:README.md") {
            ... on Blob { text }
          }
        }
      }`
    const ms = Metalsmith(fixture('default'))
    ms.use(
      plugin({
        url: 'https://api.github.com/graphql',
        out: { key: 'sassreadme' },
        body: { query: gqlQuery },
        options: {
          method: 'POST',
          headers: {
            Authorization: 'bearer ' + process.env.GITHUB_TOKEN
          }
        }
      })
    ).process((err) => {
      if (err) done(err)
      assert.strictEqual(
        ms.metadata().sassreadme.data.repository.object.text.slice(0, 39),
        '# @metalsmith/sass\n\nA Metalsmith plugin'
      )
      done()
    })
  })

  describe('should throw error', function () {
    it('"unsupported_protocol" when the protocol is not supported', function (done) {
      Metalsmith(fixture('default'))
        .use(
          plugin({
            url: 'ftp://bad-protocol.com',
            out: { key: 'bad' }
          })
        )
        .process((err) => {
          assert.strictEqual(err.name, 'unsupported_protocol')
          done()
        })
    })

    it('"ERR_INVALID_URL" when the URL is invalid', function (done) {
      Metalsmith(fixture('default'))
        .use(
          plugin({
            url: 'random-invalid',
            out: { key: 'bad' }
          })
        )
        .process((err) => {
          assert.strictEqual(err.toString().slice(0, 40), 'TypeError [ERR_INVALID_URL]: Invalid URL')
          done()
        })
    })

    it('"invalid_http_method" when the HTTP method is invalid', function (done) {
      Metalsmith(fixture('default'))
        .use(
          plugin({
            url: 'http://bad-httpmethod.com',
            out: { key: 'bad' },
            options: {
              method: 'FAULTY'
            }
          })
        )
        .process((err) => {
          assert.strictEqual(err.name, 'invalid_http_method')
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
          assert.strictEqual(err.name, 'invalid_outconfig')
          done()
        })
    })

    it('"invalid_outconfig" when the outconfig is of the wrong type', function (done) {
      Metalsmith(fixture('default'))
        .use(
          plugin({
            url: 'http://bad-outoption.com',
            out: 124124
          })
        )
        .process((err) => {
          assert.strictEqual(err.name, 'invalid_outconfig')
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
            out: { key: 'bad' },
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
          assert.strictEqual(err.name, 'http_error')
          done()
        })
    })

    it('"invalid_json" when the response has Content-Type: application/json and is malformed', function (done) {
      const ms = Metalsmith(fixture('default'))
      ms.use(
        plugin({
          url: 'http://localhost:3000',
          out: { key: 'googlehumans' }
        })
      ).process((err) => {
        assert.strictEqual(err.name, 'invalid_json')
        done()
      })
    })
  })
})
