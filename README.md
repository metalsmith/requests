# @metalsmith/requests

A metalsmith plugin to add request responses to file contents/metadata and metalsmith metadata

[![metalsmith: core plugin][metalsmith-badge]][metalsmith-url]
[![npm: version][npm-badge]][npm-url]
[![ci: build][ci-badge]][ci-url]
[![code coverage][codecov-badge]][codecov-url]
[![license: MIT][license-badge]][license-url]

## Features

- Supports adding response data to file metadata, contents, and `metalsmith.metadata()`
- Automatically parses JSON responses and sets common request headers
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
import requests from '@metalsmith/requests'

// defaults, process files with the `request` metadata key
metalsmith.use(requests())

// single GET request
metalsmith.use(requests('https://www.google.com/humans.txt'))

// parallel GET requests
metalsmith.use(requests(['https://www.google.com/humans.txt', 'https://flickr.com/humans.txt']))

// sequential GET requests
metalsmith
  .use(requests('https://www.google.com/humans.txt')
  .use(requests('https://flickr.com/humans.txt'))

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

### Front matter

By default `@metalsmith/requests` will find files that define a `request` metadata key, call it and replace the file's `contents`, so that the config below:

`humans.txt`

```yaml
---
request: 'https://www.google.com/humans.txt'
---
```

...would result in

`humans.txt`

```txt
Google is built by a large team of engineers, designers, researchers, robots, and others in many different sites across the globe. It is updated continuously, and built with more tools and technologies than we can shake a stick at. If you'd like to help us out, see careers.google.com.

```

But you could also store it in the file's metadata for further processing using the `out` option. In this example we _replace_ the request metadata key with its response:

```yml
---
request:
  url: 'https://www.google.com/humans.txt'
  out:
    key: request
---
```

### Options

You can pass a single request config, or an array of request configs to `@metalsmith/requests`. Every request config has the following options:

| Property  | Type                          | Description                                                                                                                                                                                                                                                                                                     |
| :-------- | :---------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `url`     | `string`                      | A url or url pattern with [params placeholders](#params-placeholders). Supported protocols are `http:`,`https:`.                                                                                                                                                                                                |
| `params`  | `Object[]`                    | _(optional)_ An array of objects with params to fill placeholders in the url pattern. The number of 'param sets' determines the number of requests that will be made                                                                                                                                            |
| `body`    | `string`                      | _(optional)_ The request body                                                                                                                                                                                                                                                                                   |
| `out`     | `{path:?string, key:?string}` | _(optional)_ An object of the form `{ key: 'key.path.target' }` to store the response in metadata, or an object of the form `{ path: 'path/to/file.ext' }` to output the response to a file's contents in the '`build`. See [The out option](#the-out-option) for more info.                                    |
|           | `Function`                    | If you need more flexibility, you can specify a callback instead, which is passed a result object with the response (response.data contains the body), request config, and the metalsmith files and instance: `out: (response, config, files, metalsmith) => { ... }`                                           |
| `options` | `Object`                      | _(optional)_ An object with options you would pass to [Node's https.request](https://nodejs.org/docs/latest/api/http.html#http_http_request_options_callback). If `method` is not set, it will default to `GET`. `@metalsmith/requests` also adds a `User-Agent: @metalsmith/requests` header if it is not set. |

Passing a string (`.use(['https://<url>'])`) as shorthand will expand to `{ url: '<url>', options: { method: 'GET', headers: { 'User-Agent': '@metalsmith/requests', 'Content-Length': '...' }}}`.

All requests that are part of a single config are executed in parallel.

### The `out` option

The out option supports a matrix of 4 combinations:

- If `out` it is not defined, the response of the request will be logged with [debug](https://github.com/debug-js/debug) by default. This is useful to inspect newly added requests (be sure to set `DEBUG=@metalsmith/requests`)
- If `out.path` is defined without `out.key`, the response's data will replace the `files[out.path].contents`: useful for fetching remote data without changes (translations, HTML content)
- If `out.key` is defined without `out.path`, the response's data will be added to `metalsmith.metadata()`: useful for sharing the response data across files with eg [@metalsmith/layouts](https://github.com/metalsmith/layouts)
- If `out.key` and `out.path` are both defined, the response's data will be added to `files[out.path][out.key]`: useful for attaching response content to a single file.

`out.key` can be a _keypath_, for example: `request.translation.en`

If you need more flexibility (for example, access to response headers) you can also specify a function with the signature: `out: (response, config, files, metalsmith) => void` where you can apply any transform you need.

### Params placeholders

`@metalsmith/requests` uses [regexparam](https://github.com/lukeed/regexparam) to parse urls. It supports `:param` placeholders & optional `:param?` placeholders. Params placeholders will be replaced by their values in the `url`, `out.key` and `out.path` options. Using a URL like `https://:host/:uri`, you can run parallel requests for nearly any endpoints with a single config. Here's an example of getting the number of downloads for a few core metalsmith plugins and adding them to dynamically generated files in the key `downloadCount`:

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

The result in the `build` directory would be (where x = number):

```txt
core-plugins/
└── download-counts
    ├── drafts.md -> { downloadCount: x, contents: Buffer<...> }
    ├── remove.md -> { downloadCount: x, contents: Buffer<...> }
    └── sass.md   -> { downloadCount: x, contents: Buffer<...> }
```

### POST and other methods

You could use `@metalsmith/requests` to notify a webhook or make POST/PUT/DELETE updates to other API's.  
In the example below we send a markdown-enabled build notification to a Gitter webhook and log the response, only when NODE_ENV is production:

```js
metalsmith.use(
  process.env.NODE_ENV === 'production'
    ? requests({
        url: process.env.GITTER_WEBHOOK_URL,
        out: (response) => console.log(response),
        body: 'message=New updates to **My site** are being published...',
        options: {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      })
    : () => {}
)
```

### GraphQL support

This plugin also supports GraphQL, here's an example calling the Github API:

```js
metalsmith.use(
  requests({
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

### Executing after build success

Because metalsmith plugins are just functions, you _can_ run this plugin in the build callback; just make sure to pass it `files`,`metalsmith` and a callback. The example below sends an error notification to a Gitter webhook:

```js
metalsmith.build(function (err, files) {
  if (err) {
    requests({
      url: process.env.GITTER_WEBHOOK_URL,
      body: 'message=There was an error building **My site**!',
      options: {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      }
    })(files, metalsmith, (pluginErr) => {
      throw pluginErr ? pluginErr : err
    })
  } else {
    console.log('Build success')
  }
})
```

### Error handling

`@metalsmith/requests` throws errors which you can check for the `error.code` property. For `http_error`s the error also has a `statusCode` property.

```js
metalsmith.build(function (err, files) {
  if (err) {
    if (err.code === 'http_error' && err.statusCode === 500) {
      // do something if specific http error code
    }
  } else {
    console.log('Build success')
  }
})
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
      "@metalsmith/requests": [
        "https://www.google.com/humans.txt",
        {
          "url": "https://api.github.com/repos/:owner/:repo/contents/README.md",
          "params": [
            { "owner": "metalsmith", "repo": "drafts" },
            { "owner": "metalsmith", "repo": "sass" }
          ],
          "out": { "path": "core-plugins/:owner-:repo.md" },
          "options": {
            "method": "GET",
            "auth": "<user>:<access_token>",
            "headers": {
              "Accept": "application/vnd.github.3.raw"
            }
          }
        }
      ]
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
