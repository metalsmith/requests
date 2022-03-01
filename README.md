# @metalsmith/requests

A metalsmith plugin add request responses to file contents or metadata and metalsmith metadata

[![metalsmith: core plugin][metalsmith-badge]][metalsmith-url]
[![npm: version][npm-badge]][npm-url]
[![ci: build][ci-badge]][ci-url]
[![code coverage][codecov-badge]][codecov-url]
[![license: MIT][license-badge]][license-url]

## Features

- Supports adding response data to file metadata, contents, and `metalsmith.metadata()`
- Automatically parses JSON responses
- Use front-matter `request: 'https://some-page.html'` key to replace a file's contents with a request's response
- Use route `:parameter`s to batch requests for URL's with similar structure

## Installation

NPM:

```
npm install @metalsmith/requests
```

Yarn:

```
yarn add @metalsmith/requests
```

## Usage

Pass `@metalsmith/requests` to `metalsmith.use` :

```js
const metalsmith = require('metalsmith')
const requests = require('@metalsmith/requests')

// defaults, process files with the `request` metadata key
metalsmith.use(requests())

// single GET request
metalsmith.use(requests('https://www.google.com/humans.txt'))

// multiple parallel GET requests
metalsmith.use(['https://www.google.com/humans.txt', 'https://flickr.com/humans.txt'])

// extended config, placeholder params, batch requests
metalsmith.use(
  requests({
    url: 'https://api.github.com/repos/:owner/:repo/contents/README.md',
    params: [
      { owner: 'metalsmith', repo: 'drafts' },
      { owner: 'metalsmith', repo: 'sass' }
    ],
    out: { path: 'core-plugins/:owner-:repo.md' },
    options: {
      method: 'GET',
      auth: `metalsmith:${process.env.GITHUB_TOKEN}`,
      headers: {
        Accept: 'application/vnd.github.3.raw'
      }
    }
  })
)
```

### Options

You can pass a single requests config, or an array of request configs to `@metalsmith/requests`. Every request config has the following options:

| Property  | Type                        | Description                                                                                                                                                                                                                                        |
| :-------- | :-------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `url`     | `string`                    | A url or url pattern with [params placeholders](#params-placeholders). Supported protocols are `http:`,`https:`, and `file:`.                                                                                                                      |
| `params`  | `Object[]`                  | _(optional)_ An object with params to fill placeholders in the url pattern.                                                                                                                                                                        |
| `body`    | `string`                    | _(optional)_ The request body                                                                                                                                                                                                                      |
| `out`     | `{path:string, key:string}` | _(optional)_ An object of the form `{ key: 'key.path.target' }` to store the response in metadata, or an object of the form `{ path: 'path/to/file.ext' }` to store the response in a file in the `build`                                          |
|           | `Function`                  | If you need more flexibility, you can specify a callback instead, which is passed a result object with the data (response body) and request config, and the metalsmith files and instance: `out: (response, config, files, metalsmith) => { ... }` |
| `options` | `Object`                    | _(optional)_ An object with options you would pass to [Node's https.request](). If `method` is not set, it will default to `GET`. `@metalsmith/requests` also adds a `User-Agent: @metalsmith/requests` header if no other headers are set.        |

You can also pass a string (`.use(['https://<url>'])`) as shorthand, which will expand to `{ url: '<url>', options: { method: 'GET', headers: { 'User-Agent': '@metalsmith/requests' }}}`.

### The `out` option

The out option supports a matrix of 4 combinations:

- If `out` it is not defined, the response of the request will be logged with [debug](https://github.com/debug-js/debug) by default. This is useful to inspect newly added requests (be sure to set `DEBUG=@metalsmith/requests`)
- If `out.path` is defined without `out.key`, the response's data will replace the `files[out.path].contents`: useful for fetching remote data without changes (translations, HTML content)
- If `out.key` is defined without `out.path`, the response's data will be added to `metalsmith.metadata()`: useful for sharing the response data across files with eg [@metalsmith/layouts](https://github.com/metalsmith/layouts)
- If `out.key` and `out.path` are both defined, the response's data will be added to `files[out.path][out.key]`: useful for attaching response content to a single file.

`out.key` can be a _keypath_, for example: `request.translation.en`

If you need more flexibility you can also specify a function with the signature: `out: (response, config, files, metalsmith) => void` where you can apply any transform you need.

### Params placeholders

`@metalsmith/requests` uses [regexparam](https://github.com/lukeed/regexparam) to parse urls. It supports `:param` placeholders & optional `:param?` placeholders. Params placeholders will be replaced by their values in the `url`, `out.key` and `out.path` options. For example, using a URL `https://:host/:uri` with a param set `{ host: 'registry.npmjs.org', uri: 'metalsmith/latest' }`, you can run parallel requests for nearly any endpoints. Here's an example of getting the number of downloads for a few core metalsmith plugins:

```js
metalsmith.use(
  requests({
    url: 'https://api.npmjs.org/downloads/point/last-week/@metalsmith/:plugin',
    params: [{ plugin: 'drafts' }, { plugin: 'sass' }, { plugin: 'remove' }],
    out: { path: 'core-plugins/download-counts/:plugin.md', key: 'downloadCount' },
    options: {
      method: 'GET',
      auth: `metalsmith:${process.env.GITHUB_TOKEN}`
    }
  })
)
```

### GraphQL support

git
This plugin also supports GraphQL, here's an example calling the Github API:

```js
metalsmith.use(
  plugin({
    url: 'https://api.github.com/graphql',
    out: { key: 'coreplugin.sass.readme' },
    body: {
      query: `
      query {
        repository(owner: "metalsmith", name: "sass") {
          object(expression: "master:README.md") {
            ... on Blob { text }
          }
        }
      }`
    },
    options: {
      method: 'POST',
      headers: {
        Authorization: 'bearer ' + process.env.GITHUB_TOKEN
      }
    }
  })
)
```

### Debug

To enable debug logs, set the `DEBUG` environment variable to `@metalsmith/requests`:

Linux/Mac:

```
DEBUG=@metalsmith/requests
```

Windows:

```
set "DEBUG=@metalsmith/requests"
```

Alternatively you can set `DEBUG` to `@metalsmith/*` to debug all Metalsmith core plugins.

### CLI usage

To use this plugin with the Metalsmith CLI, add `@metalsmith/requests` to the `plugins` key in your `metalsmith.json` file:

```json
{
  "plugins": [
    {
      "@metalsmith/requests": {}
    }
  ]
}
```

## License

[LGPL](LICENSE)

[npm-badge]: https://img.shields.io/npm/v/@metalsmith/requests.svg
[npm-url]: https://www.npmjs.com/package/@metalsmith/requests
[ci-badge]: https://github.com/metalsmith/requests/actions/workflows/test.yml/badge.svg
[ci-url]: https://github.com/metalsmith/requests/actions/workflows/test.yml
[metalsmith-badge]: https://img.shields.io/badge/metalsmith-core_plugin-green.svg?longCache=true
[metalsmith-url]: https://metalsmith.io
[codecov-badge]: https://img.shields.io/coveralls/github/metalsmith/requests
[codecov-url]: https://coveralls.io/github/metalsmith/requests
[license-badge]: https://img.shields.io/github/license/metalsmith/requests
[license-url]: LICENSE
