import { HttpieResponse } from 'httpie';
import Metalsmith, { Plugin, Files } from 'metalsmith';
import { RequestOptions } from 'https';
export default requests;

export type OutFunction<T = any> = (response:HttpieResponse<T>, files:Files, metalsmith:Metalsmith) => void
export type RequestConfig = {
    /**
     * A URL or URL pattern to request. May contain placeholders mapping to params like `:paramname`
     */
    url: string;
    /**
     * Body of the request in case it is a POST/PUT/PATCH etc
     */
    body?: string;
    /**
     * Defines What to do with the request response. Can be `{ path: 'file/in/:param/source.html' }` to output to a file in the metalsmith build.
     * Can be `{ key: 'nested.:param.key' }` to store the response in a metadata key. Both metadata keypaths & file paths may contain param placeholders.
     * If more flexibility is required you can provide a function with the signature `out(response, files, metalsmith)`
     */
    out?: OutFunction | {
        path?: string;
        key?: string;
    };
    /**
     * An array of params objects for each of which the `url` will be requested.
     * For example, the URL `https://api.github.com/:owner/:repo` would be requested twice with the `params` option
     * set to `[{repo: 'one', owner: 'me'}, {repo: 'two', owner: 'you'}]`.
     */
    params?: Record<string, any>[];
    /**
     * An options object you would pass to [Node http.request](https://nodejs.org/api/https.html#httpsrequesturl-options-callback)
     * The most important options are perhaps `method`, `auth` and `headers`. `@metalsmith/requests` defaults the method to GET and
     * adds a User-Agent header if none is provided.
     */
    options?: RequestOptions;
};
/**
 * A metalsmith plugin to query API's and add the results to files and metadata
 *
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
declare function requests(options: string | RequestConfig | RequestConfig[]): Plugin;
