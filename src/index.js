/* eslint-disable-next-line import/no-internal-modules */
import { dset } from 'dset/merge'
import { send } from 'httpie'
import { URL } from 'url'
import { inject } from 'regexparam'

const validMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']

function toMetalsmith({ key, path }, files, metalsmith) {
  // default to logging output
  if (!key && !path) {
    return (value) =>
      metalsmith.debug('@metalsmith/requests')('%o', {
        data: value.data,
        statusCode: value.statusCode,
        headers: value.headers
      })
  }

  // if a key is given but no path, add it to metadata
  if (key && !path) {
    return (value) => dset(metalsmith.metadata(), key, value.data)
  }

  let file = files[path]
  if (!file) {
    file = { mode: '0664' }
  }

  // if a path is given, and the key is "contents", replace its contents with it
  if (key === 'contents') {
    return (value) => {
      files[path] = file
      file.contents = Buffer.from(typeof value.data === 'string' ? value.data : JSON.stringify(value.data))
    }
  }

  // else for other keys, set on file metadata
  return (value) => {
    files[path] = file
    dset(file, key, value.data)
  }
}

const error = {
  invalid_outconfig(url) {
    const err = new Error(`Invalid 'out' configuration for '${url}'`)
    err.name = 'invalid_outconfig'
    return err
  },
  unsupported_protocol(protocol) {
    const err = new Error(`Unsupported protocol '${protocol}'. Must be one of http:, https:`)
    err.name = 'unsupported_protocol'
    return err
  },
  invalid_http_method(method) {
    const err = new Error(`Invalid HTTP request method: '${method}'. Must be one of ${validMethods.join()}`)
    err.name = 'invalid_http_method'
    return err
  },
  http_error(code, message) {
    const err = new Error(`HTTP ${code}${message ? ' : ' + JSON.stringify(message) : ''}`)
    err.statusCode = message.statusCode
    err.name = 'http_error'
    return err
  },
  invalid_json(url, message) {
    const err = new Error(`Invalid JSON response for request "${url}": ${message}`)
    err.name = 'invalid_json'
    return err
  }
}

/**
 * @typedef {object} RequestConfig
 * @property {string} url A URL or URL pattern to request. May contain placeholders mapping to params like `:paramname`
 * @property {string} body Body of the request in case it is a POST/PUT/PATCH etc
 * @property {{path:?string,key:?string,call:?Function}} [out]
 * Defines What to do with the request response. Can be `{ path: 'file/in/:param/source.html' }` to output to a file in the metalsmith build.
 * Can be `{ key: 'nested.:param.key' }` to store the response in a metadata key. Both metadata keypaths & file paths may contain param placeholders.
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
  // shorthand
  if (typeof options === 'string') {
    options = { url: options, out: (res, config, ...args) => toMetalsmith(config, ...args)(res) }
  }

  let url
  try {
    url = new URL(options.url)
    if (!url.protocol.startsWith('http')) {
      onerror(error.unsupported_protocol(url.protocol))
    }
  } catch (err) {
    onerror(err)
  }

  const paramsets = options.params || [{}]

  let httpOptions = options.options
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

  const out = options.out

  if (!['object', 'function'].includes(typeof out) || (typeof out === 'object' && !(out.key || out.path))) {
    onerror(error.invalid_outconfig(options.url))
  }
  if (out.path && !out.key) out.key = 'contents'

  // regexparam.inject doesn't work on dot-delimited paths, convert to slash first
  const keyAsPath = out.key && out.key.replace(/\./g, '/')

  const ret = paramsets.map((paramset) => {
    return {
      params: paramset,
      url: inject(url.href, paramset),
      out:
        typeof out === 'function'
          ? out
          : {
              // remove leading slash inserted by regexparam.inject + for key, re-replace slashes with dots
              key: out.key ? inject(keyAsPath, paramset).replace(/^\//, '').replace(/\//g, '.') : null,
              path: out.path ? inject(out.path, paramset).replace(/^\//, '') : null
            },
      httpOptions,
      body: options.body ? options.body : null
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
  return options
    .map((requestConfig) => processRequestConfig(requestConfig, onerror))
    .filter((config) => !!config)
    .flat()
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
 *   out: { key: 'google.humans' }
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
function requests(options) {
  return function requests(files, metalsmith, done) {
    const debug = metalsmith.debug('@metalsmith/requests')
    done = done || (() => {})
    options = normalizeOptions(options, done)
    const promises = []

    // process files with the metadata 'request' and replace their contents with the response
    // no support for arrays, because only a single request can be mapped here
    const implicitRequests = Object.entries(files)
      // eslint-disable-next-line no-unused-vars
      .filter(([path, file]) => ['string', 'object'].includes(typeof file.request))
      .map(([path, file]) => {
        let config = file.request
        if (typeof config === 'string') {
          config = { url: config }
        }
        config.out = { path, key: (config.out && config.out.key) || 'contents' }
        return processRequestConfig(config, done)
      })
      .flat()

    const allRequests = [...options, ...implicitRequests]

    allRequests.forEach((config) => {
      debug('Executing request: %s', config.url)
      promises.push(
        send(config.httpOptions.method, config.url, { ...config.httpOptions, body: config.body })
          .then((response) => ({ response, config }))
          .catch((err) => {
            if (err.name === 'SyntaxError') return Promise.reject(error.invalid_json(config.url, err.message))
            return Promise.reject(error.http_error(err.statusCode, err))
          })
      )
    })

    Promise.all(promises)
      .then((results) => {
        debug('Executed all requests successfully')
        results.forEach(({ config, response }) => {
          debug('Processing response of %s', config.url)
          const { out, ...other } = config
          if (typeof out === 'function') {
            out(response, other, files, metalsmith)
          } else {
            toMetalsmith(out, files, metalsmith)(response)
          }
        })
        done()
      })
      .catch((err) => {
        debug(err)
        done(err)
      })
  }
}

export default requests
