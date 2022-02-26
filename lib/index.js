const { dset } = require('dset')
const debug = require('debug')('@metalsmith/requests')
const clients = {
  'file:': require('fs').readFile,
  'http:': require('http').request,
  'https:': require('https').request
}
const { URL } = require('url')
const regexparam = require('regexparam')

const validMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']

const write = {
  path({ data, config }, files) {
    if (files[config.out]) {
      files[config.out].contents = Buffer.from(files[config.out].contents.toString() + data)
    } else {
      files[config.out] = {
        contents: Buffer.from(data),
        mode: '0664',
        stats: {}
      }
    }
  },
  metadata({ data, config }, files, metalsmith) {
    dset(metalsmith.metadata(), config.out, data)
  },
  log({ data }) {
    process.stdout.write(data)
  }
}

const error = {
  invalid_outconfig(url) {
    const err = new Error(`Invalid 'out' configuration for '${url}'`)
    err.code = 'invalid_outconfig'
    return err
  },
  unsupported_protocol(protocol) {
    const err = new Error(`Unsupported protocol '${protocol}'. Must be one of ${Object.keys(clients).join()}`)
    err.code = 'unsupported_protocol'
    return err
  },
  invalid_http_method(method) {
    const err = new Error(`Invalid HTTP request method: '${method}'. Must be one of ${validMethods.join()}`)
    err.code = 'invalid_http_method'
    return err
  },
  http_error(code, message) {
    const err = new Error(`HTTP ${code}${message ? ' : ' + JSON.stringify(message) : ''}`)
    err.code = 'http_error'
    return err
  },
  invalid_json(url, message) {
    const err = new Error(`Invalid JSON response for request "${url}": ${message}`)
    err.code = 'invalid_json'
    return err
  }
}

/**
 * @typedef {object} RequestConfig
 * @property {string} url A URL or URL pattern to request. May contain placeholders mapping to params like `:paramname`
 * @property {string} body Body of the request in case it is a POST/PUT/PATCH etc
 * @property {{path:?string,metadata:?string,call:?Function}} [out]
 * Defines What to do with the request response. Can be `{ path: 'file/in/:param/source.html' }` to output to a file in the metalsmith build.
 * Can be `{ metadata: 'nested.:param.key' }` to store the response in a metadata key. Both metadata keypaths & file paths may contain param placeholders.
 * If more flexibility is required you can provide a function with the signature `out(response, files, metalsmith)`
 * @property {{name:value}[]} [params]
 * An array of params objects for each of which the `url` will be requested.
 * For example, the URL `https://api.github.com/:owner/:repo` would be requested twice with the `params` option
 * set to `[{repo: 'one', owner: 'me'}, {repo: 'two', owner: 'you'}]`.
 * @property {Object} [options]
 * An options object you would pass to [Node http.request](https://nodejs.org/api/https.html#httpsrequesturl-options-callback)
 * The most important options are perhaps `method`, `auth` and `headers`. `@metalsmith/requests` defaults the method to GET and
 * adds a User-Agent header if none is provided.
 **/

/**
 * Normalize plugin options
 * @param {Options} [options]
 * @returns {Object}
 */
function processRequestConfig(options, onerror) {
  if (typeof options === 'string') {
    options = { url: options, out: out.log }
  }

  let url
  try {
    url = new URL(options.url)
    if (!Object.prototype.hasOwnProperty.call(clients, url.protocol)) {
      onerror(error.unsupported_protocol(url.protocol))
    }
  } catch (err) {
    onerror(err)
  }

  const client = clients[url.protocol]
  const paramsets = options.params ? (Array.isArray(options.params) ? options.params : [options.params]) : [{}]

  let httpOptions = options.options
  if (url.protocol !== 'file:') {
    if (!httpOptions) {
      httpOptions = {
        method: 'GET',
        headers: {
          'User-Agent': '@metalsmith/requests'
        }
      }
    } else {
      httpOptions.method = httpOptions.method || 'GET'
      if (!validMethods.includes(httpOptions.method)) {
        onerror(error.invalid_http_method(httpOptions.method))
      }
      if (!httpOptions.headers['User-Agent']) {
        httpOptions.headers['User-Agent'] = '@metalsmith/requests'
      }
    }
  }

  let out = options.out
  let process = write.log
  if (typeof options.out === 'object') {
    if (options.out.metadata) {
      out = options.out.metadata
      process = write.metadata
    } else if (options.out.path) {
      out = options.out.path
      process = write.path
    } else {
      onerror(error.invalid_outconfig(options.url))
    }
    if (options.out.json) {
      const cachedProcess = process
      process = (result, ...args) => {
        try {
          result.data = JSON.parse(result.data)
          cachedProcess(result, ...args)
        } catch (err) {
          onerror(error.invalid_json(url.href, err.message))
        }
      }
    }
  } else if (typeof options.out !== 'function') {
    onerror(error.invalid_outconfig(options.url))
  }
  const ret = paramsets.map((paramset) => {
    return {
      params: paramset,
      url: regexparam.inject(url.href, paramset),
      out: typeof options.out === 'function' ? options.out : regexparam.inject(out, paramset).replace(/^\//, ''),
      httpOptions,
      client,
      body: options.body ? options.body : null,
      process
    }
  })
  return ret
}

function normalizeOptions(options, onerror) {
  if (!options || options === true) {
    options = []
  } else if (!Array.isArray(options)) {
    options = [options]
  }
  return options.map((requestConfig) => processRequestConfig(requestConfig, onerror)).flat()
}

/**
 * A metalsmith plugin to query API's and add the results to files and metadata
 *
 * @param {string|RequestConfig|RequestConfig[]} options
 * @returns {import('metalsmith').Plugin}
 * @link https://github.com/metalsmith/requests
 * @example
 * ```js
 * metalsmith.use(requests()) // defaults
 *
 * metalsmith.use(requests({  // single GET request set
 *   url: 'https://www.google.com/humans.txt',
 *   out: { metadata: 'google.humans' }
 * }))
 *
 * metalsmith.use(requests({  // parameterized w options
 *   url: 'https://api.github.com/repos/:owner/:repo/contents/README.md',
 *   params: [
 *     { owner: 'metalsmith', repo: 'drafts' },
 *     { owner: 'metalsmith', repo: 'sass' }
 *   ],
 *   out: { path: 'core-plugins/:owner-:repo.md' },
 *   options: {
 *     method: 'GET',
 *     auth: `metalsmith:${process.env.GITHUB_TOKEN}`,
 *     headers: {
 *       Accept: 'application/vnd.github.3.raw'
 *     }
 *   }
 * }))
 * ```
 */
function initRequests(options) {
  return function requests(files, metalsmith, done) {
    options = normalizeOptions(options, done)
    const promises = []

    // process files with the metadata 'request' and replace their contents with the response
    const implicitRequests = Object.entries(files)
      // eslint-disable-next-line no-unused-vars
      .filter(([path, file]) => ['string', 'object', 'array'].includes(typeof file.request))
      .map(([path, file]) => {
        let config = file.request
        if (typeof config === 'string') {
          config = { url: config, out: { path } }
        } else if (!config.out) {
          config.out = { path }
        }
        return processRequestConfig(config, done)
      })
      .flat()

    const allRequests = [...options, ...implicitRequests]

    debug(
      'Executing %s requests: %O',
      allRequests.length,
      allRequests.map((c) => c.url)
    )

    allRequests.forEach((config) => {
      promises.push(
        new Promise((resolve, reject) => {
          config = Object.assign({}, config)
          const req = config.client(config.url, config.httpOptions, function (res) {
            let data = ''
            res.setEncoding('utf-8')
            res
              .on('data', (chunk) => (data += chunk.toString()))
              .on('error', reject)
              .on('end', () => {
                /*if(res.statusCode === 301 || res.statusCode === 302) {
                return config.client(res.headers.location, resolve, reject)
              }*/
                if (res.statusCode < 200 || res.statusCode >= 400) {
                  reject(error.http_error(res.statusCode, data))
                }
                resolve({ data, config })
              })
          })
          req.on('error', (err) => {
            reject(err)
          })

          if (config.body) {
            req.write(config.body)
          }
          req.end()
        })
      )
    })

    Promise.all(promises)
      .then((results) => {
        results.forEach((result) => result.config.process(result, files, metalsmith))
        debug('Successfully queried all urls')
        done()
      })
      .catch((err) => {
        debug('error: %O', err)
        done(err)
      })
  }
}

module.exports = initRequests
