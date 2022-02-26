# @metalsmith/requests

A metalsmith plugin to query API's and add the results to files and metadata

[![metalsmith: core plugin][metalsmith-badge]][metalsmith-url]
[![npm: version][npm-badge]][npm-url]
[![ci: build][ci-badge]][ci-url]
[![code coverage][codecov-badge]][codecov-url]
[![license: MIT][license-badge]][license-url]

## Features

An optional features section (if there are many), or an extended description of the core plugin

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
const requests = require('@metalsmith/requests')

metalsmith.use(requests()) // defaults

metalsmith.use(
  requests({
    // single GET request set
    url: 'https://www.google.com/humans.txt',
    out: { metadata: 'google.humans' }
  })
)

metalsmith.use(
  requests({
    // parameterized w options
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

| Property  | Type       | Description                                                                                                                                                                                                                                        |
| :-------- | :--------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| `url`     | `string`   | A url or url pattern with [params placeholders](#params-placeholders). Supported protocols are `http:`,`https:`, and `file:`.                                                                                                                      |
| `params`  | `Object[]` | An object with params to fill placeholders in the url pattern.                                                                                                                                                                                     |
| `out`     | `{path     | metadata:string}`                                                                                                                                                                                                                                  | An object of the form `{ metadata: 'key.path.target' }` to store the response in metadata, or an object of the form `{ path: 'path/to/file.ext' }` to store the response in a file in the `build` |     |
| `out`     | `Function` | If you need more flexibility, you can specify a callback instead, which is passed a result object with the data (response body) and request config, and the metalsmith files and instance: `out: ({ data, config }, files, metalsmith) => { ... }` |
| `options` | `Object`   | An object with options you would pass to [Node's https.request](). If `method` is not set, it will default to `GET`. `@metalsmith/requests` also adds a `User-Agent: @metalsmith/requests` header if no other headers are set.                     |

You can also pass a string (`.use(['https://<url>'])`) as shorthand, which will expand to `{ url: '<url>', options: { method: 'GET', headers: { 'User-Agent': '@metalsmith/requests' }}}`.

### Params placeholders

`@metalsmith/requests` uses [regexparam]() to parse urls.

### Specific usage example

Document a second specific usage example, the title can be "Achieve x by doing y"

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

[MIT](LICENSE)

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
