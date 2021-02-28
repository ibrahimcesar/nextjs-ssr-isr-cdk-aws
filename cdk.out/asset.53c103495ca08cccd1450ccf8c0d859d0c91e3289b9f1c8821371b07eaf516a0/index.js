'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var manifest = require('./manifest.json');
var RoutesManifestJson = require('./routes-manifest.json');
var Stream = require('stream');
var zlib = require('zlib');
var http = require('http');
var Url = require('url');
var require$$1 = require('path');
var fs = require('fs');
var crypto = require('crypto');
var require$$0$1 = require('events');
var util$1 = require('util');
var tty = require('tty');
var require$$2 = require('net');
var https = require('https');
var buffer = require('buffer');
var os = require('os');
var child_process = require('child_process');
require('http2');
var process$1 = require('process');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

function _interopNamespace(e) {
  if (e && e.__esModule) { return e; } else {
    var n = Object.create(null);
    if (e) {
      Object.keys(e).forEach(function (k) {
        if (k !== 'default') {
          var d = Object.getOwnPropertyDescriptor(e, k);
          Object.defineProperty(n, k, d.get ? d : {
            enumerable: true,
            get: function () {
              return e[k];
            }
          });
        }
      });
    }
    n['default'] = e;
    return Object.freeze(n);
  }
}

var manifest__default = /*#__PURE__*/_interopDefaultLegacy(manifest);
var RoutesManifestJson__default = /*#__PURE__*/_interopDefaultLegacy(RoutesManifestJson);
var Stream__default = /*#__PURE__*/_interopDefaultLegacy(Stream);
var zlib__default = /*#__PURE__*/_interopDefaultLegacy(zlib);
var http__default = /*#__PURE__*/_interopDefaultLegacy(http);
var Url__default = /*#__PURE__*/_interopDefaultLegacy(Url);
var require$$1__default = /*#__PURE__*/_interopDefaultLegacy(require$$1);
var fs__default = /*#__PURE__*/_interopDefaultLegacy(fs);
var crypto__default = /*#__PURE__*/_interopDefaultLegacy(crypto);
var require$$0__default = /*#__PURE__*/_interopDefaultLegacy(require$$0$1);
var util__default = /*#__PURE__*/_interopDefaultLegacy(util$1);
var tty__default = /*#__PURE__*/_interopDefaultLegacy(tty);
var require$$2__default = /*#__PURE__*/_interopDefaultLegacy(require$$2);
var https__default = /*#__PURE__*/_interopDefaultLegacy(https);
var process__default = /*#__PURE__*/_interopDefaultLegacy(process$1);

const specialNodeHeaders = [
  "age",
  "authorization",
  "content-length",
  "content-type",
  "etag",
  "expires",
  "from",
  "host",
  "if-modified-since",
  "if-unmodified-since",
  "last-modified",
  "location",
  "max-forwards",
  "proxy-authorization",
  "referer",
  "retry-after",
  "user-agent"
];

const readOnlyCloudFrontHeaders = {
  "accept-encoding": true,
  "content-length": true,
  "if-modified-since": true,
  "if-none-match": true,
  "if-range": true,
  "if-unmodified-since": true,
  "transfer-encoding": true,
  via: true
};

const HttpStatusCodes = {
  202: "Accepted",
  502: "Bad Gateway",
  400: "Bad Request",
  409: "Conflict",
  100: "Continue",
  201: "Created",
  417: "Expectation Failed",
  424: "Failed Dependency",
  403: "Forbidden",
  504: "Gateway Timeout",
  410: "Gone",
  505: "HTTP Version Not Supported",
  418: "I'm a teapot",
  419: "Insufficient Space on Resource",
  507: "Insufficient Storage",
  500: "Server Error",
  411: "Length Required",
  423: "Locked",
  420: "Method Failure",
  405: "Method Not Allowed",
  301: "Moved Permanently",
  302: "Moved Temporarily",
  207: "Multi-Status",
  300: "Multiple Choices",
  511: "Network Authentication Required",
  204: "No Content",
  203: "Non Authoritative Information",
  406: "Not Acceptable",
  404: "Not Found",
  501: "Not Implemented",
  304: "Not Modified",
  200: "OK",
  206: "Partial Content",
  402: "Payment Required",
  308: "Permanent Redirect",
  412: "Precondition Failed",
  428: "Precondition Required",
  102: "Processing",
  407: "Proxy Authentication Required",
  431: "Request Header Fields Too Large",
  408: "Request Timeout",
  413: "Request Entity Too Large",
  414: "Request-URI Too Long",
  416: "Requested Range Not Satisfiable",
  205: "Reset Content",
  303: "See Other",
  503: "Service Unavailable",
  101: "Switching Protocols",
  307: "Temporary Redirect",
  429: "Too Many Requests",
  401: "Unauthorized",
  422: "Unprocessable Entity",
  415: "Unsupported Media Type",
  305: "Use Proxy"
};

const toCloudFrontHeaders = (headers, originalHeaders) => {
  const result = {};
  const lowerCaseOriginalHeaders = {};
  Object.entries(originalHeaders).forEach(([header, value]) => {
    lowerCaseOriginalHeaders[header.toLowerCase()] = value;
  });

  Object.keys(headers).forEach((headerName) => {
    const lowerCaseHeaderName = headerName.toLowerCase();
    const headerValue = headers[headerName];

    if (readOnlyCloudFrontHeaders[lowerCaseHeaderName]) {
      if (lowerCaseOriginalHeaders[lowerCaseHeaderName]) {
        result[lowerCaseHeaderName] =
          lowerCaseOriginalHeaders[lowerCaseHeaderName];
      }
      return;
    }

    result[lowerCaseHeaderName] = [];

    if (headerValue instanceof Array) {
      headerValue.forEach((val) => {
        result[lowerCaseHeaderName].push({
          key: headerName,
          value: val.toString()
        });
      });
    } else {
      result[lowerCaseHeaderName].push({
        key: headerName,
        value: headerValue.toString()
      });
    }
  });

  return result;
};

const isGzipSupported = (headers) => {
  let gz = false;
  const ae = headers["accept-encoding"];
  if (ae) {
    for (let i = 0; i < ae.length; i++) {
      const { value } = ae[i];
      const bits = value.split(",").map((x) => x.split(";")[0].trim());
      if (bits.indexOf("gzip") !== -1) {
        gz = true;
      }
    }
  }
  return gz;
};

const defaultOptions = {
  enableHTTPCompression: false
};

const handler = (
  event,
  { enableHTTPCompression, rewrittenUri } = defaultOptions
) => {
  const { request: cfRequest, response: cfResponse = { headers: {} } } = event;

  const response = {
    headers: {}
  };

  const newStream = new Stream__default['default'].Readable();

  const req = Object.assign(newStream, http__default['default'].IncomingMessage.prototype);
  req.url = rewrittenUri || cfRequest.uri;
  req.method = cfRequest.method;
  req.rawHeaders = [];
  req.headers = {};
  req.connection = {};

  if (cfRequest.querystring) {
    req.url = req.url + `?` + cfRequest.querystring;
  }

  const headers = cfRequest.headers || {};

  for (const lowercaseKey of Object.keys(headers)) {
    const headerKeyValPairs = headers[lowercaseKey];

    headerKeyValPairs.forEach((keyVal) => {
      req.rawHeaders.push(keyVal.key);
      req.rawHeaders.push(keyVal.value);
    });

    req.headers[lowercaseKey] = headerKeyValPairs[0].value;
  }

  req.getHeader = (name) => {
    return req.headers[name.toLowerCase()];
  };

  req.getHeaders = () => {
    return req.headers;
  };

  if (cfRequest.body && cfRequest.body.data) {
    req.push(
      cfRequest.body.data,
      cfRequest.body.encoding ? "base64" : undefined
    );
  }

  req.push(null);

  const res = new Stream__default['default']();
  res.finished = false;

  Object.defineProperty(res, "statusCode", {
    get() {
      return response.status;
    },
    set(statusCode) {
      response.status = statusCode;
      response.statusDescription = HttpStatusCodes[statusCode];
    }
  });

  res.headers = {};
  res.writeHead = (status, headers) => {
    response.status = status;

    if (headers) {
      res.headers = Object.assign(res.headers, headers);
    }
    return res;
  };
  res.write = (chunk) => {
    if (!response.body) {
      response.body = Buffer.from("");
    }

    response.body = Buffer.concat([
      response.body,
      Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    ]);
  };

  let shouldGzip = enableHTTPCompression && isGzipSupported(headers);

  const responsePromise = new Promise((resolve) => {
    res.end = (text) => {
      if (res.finished === true) {
        return;
      }

      res.finished = true;

      if (text) res.write(text);

      if (!res.statusCode) {
        res.statusCode = 200;
      }

      if (response.body) {
        response.bodyEncoding = "base64";
        response.body = shouldGzip
          ? zlib__default['default'].gzipSync(response.body).toString("base64")
          : Buffer.from(response.body).toString("base64");
      }

      response.headers = toCloudFrontHeaders(res.headers, cfResponse.headers);

      if (shouldGzip) {
        response.headers["content-encoding"] = [
          { key: "Content-Encoding", value: "gzip" }
        ];
      }
      resolve(response);
    };
  });

  res.setHeader = (name, value) => {
    res.headers[name.toLowerCase()] = value;
  };
  res.removeHeader = (name) => {
    delete res.headers[name.toLowerCase()];
  };
  res.getHeader = (name) => {
    return res.headers[name.toLowerCase()];
  };
  res.getHeaders = () => {
    return res.headers;
  };
  res.hasHeader = (name) => {
    return !!res.getHeader(name);
  };

  return {
    req,
    res,
    responsePromise
  };
};

handler.SPECIAL_NODE_HEADERS = specialNodeHeaders;

var nextAwsCloudfront = handler;

/**
 * Tokenize input string.
 */
function lexer(str) {
    var tokens = [];
    var i = 0;
    while (i < str.length) {
        var char = str[i];
        if (char === "*" || char === "+" || char === "?") {
            tokens.push({ type: "MODIFIER", index: i, value: str[i++] });
            continue;
        }
        if (char === "\\") {
            tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str[i++] });
            continue;
        }
        if (char === "{") {
            tokens.push({ type: "OPEN", index: i, value: str[i++] });
            continue;
        }
        if (char === "}") {
            tokens.push({ type: "CLOSE", index: i, value: str[i++] });
            continue;
        }
        if (char === ":") {
            var name = "";
            var j = i + 1;
            while (j < str.length) {
                var code = str.charCodeAt(j);
                if (
                // `0-9`
                (code >= 48 && code <= 57) ||
                    // `A-Z`
                    (code >= 65 && code <= 90) ||
                    // `a-z`
                    (code >= 97 && code <= 122) ||
                    // `_`
                    code === 95) {
                    name += str[j++];
                    continue;
                }
                break;
            }
            if (!name)
                throw new TypeError("Missing parameter name at " + i);
            tokens.push({ type: "NAME", index: i, value: name });
            i = j;
            continue;
        }
        if (char === "(") {
            var count = 1;
            var pattern = "";
            var j = i + 1;
            if (str[j] === "?") {
                throw new TypeError("Pattern cannot start with \"?\" at " + j);
            }
            while (j < str.length) {
                if (str[j] === "\\") {
                    pattern += str[j++] + str[j++];
                    continue;
                }
                if (str[j] === ")") {
                    count--;
                    if (count === 0) {
                        j++;
                        break;
                    }
                }
                else if (str[j] === "(") {
                    count++;
                    if (str[j + 1] !== "?") {
                        throw new TypeError("Capturing groups are not allowed at " + j);
                    }
                }
                pattern += str[j++];
            }
            if (count)
                throw new TypeError("Unbalanced pattern at " + i);
            if (!pattern)
                throw new TypeError("Missing pattern at " + i);
            tokens.push({ type: "PATTERN", index: i, value: pattern });
            i = j;
            continue;
        }
        tokens.push({ type: "CHAR", index: i, value: str[i++] });
    }
    tokens.push({ type: "END", index: i, value: "" });
    return tokens;
}
/**
 * Parse a string for the raw tokens.
 */
function parse(str, options) {
    if (options === void 0) { options = {}; }
    var tokens = lexer(str);
    var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a;
    var defaultPattern = "[^" + escapeString(options.delimiter || "/#?") + "]+?";
    var result = [];
    var key = 0;
    var i = 0;
    var path = "";
    var tryConsume = function (type) {
        if (i < tokens.length && tokens[i].type === type)
            return tokens[i++].value;
    };
    var mustConsume = function (type) {
        var value = tryConsume(type);
        if (value !== undefined)
            return value;
        var _a = tokens[i], nextType = _a.type, index = _a.index;
        throw new TypeError("Unexpected " + nextType + " at " + index + ", expected " + type);
    };
    var consumeText = function () {
        var result = "";
        var value;
        // tslint:disable-next-line
        while ((value = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR"))) {
            result += value;
        }
        return result;
    };
    while (i < tokens.length) {
        var char = tryConsume("CHAR");
        var name = tryConsume("NAME");
        var pattern = tryConsume("PATTERN");
        if (name || pattern) {
            var prefix = char || "";
            if (prefixes.indexOf(prefix) === -1) {
                path += prefix;
                prefix = "";
            }
            if (path) {
                result.push(path);
                path = "";
            }
            result.push({
                name: name || key++,
                prefix: prefix,
                suffix: "",
                pattern: pattern || defaultPattern,
                modifier: tryConsume("MODIFIER") || ""
            });
            continue;
        }
        var value = char || tryConsume("ESCAPED_CHAR");
        if (value) {
            path += value;
            continue;
        }
        if (path) {
            result.push(path);
            path = "";
        }
        var open = tryConsume("OPEN");
        if (open) {
            var prefix = consumeText();
            var name_1 = tryConsume("NAME") || "";
            var pattern_1 = tryConsume("PATTERN") || "";
            var suffix = consumeText();
            mustConsume("CLOSE");
            result.push({
                name: name_1 || (pattern_1 ? key++ : ""),
                pattern: name_1 && !pattern_1 ? defaultPattern : pattern_1,
                prefix: prefix,
                suffix: suffix,
                modifier: tryConsume("MODIFIER") || ""
            });
            continue;
        }
        mustConsume("END");
    }
    return result;
}
/**
 * Create path match function from `path-to-regexp` spec.
 */
function match(str, options) {
    var keys = [];
    var re = pathToRegexp(str, keys, options);
    return regexpToFunction(re, keys, options);
}
/**
 * Create a path match function from `path-to-regexp` output.
 */
function regexpToFunction(re, keys, options) {
    if (options === void 0) { options = {}; }
    var _a = options.decode, decode = _a === void 0 ? function (x) { return x; } : _a;
    return function (pathname) {
        var m = re.exec(pathname);
        if (!m)
            return false;
        var path = m[0], index = m.index;
        var params = Object.create(null);
        var _loop_1 = function (i) {
            // tslint:disable-next-line
            if (m[i] === undefined)
                return "continue";
            var key = keys[i - 1];
            if (key.modifier === "*" || key.modifier === "+") {
                params[key.name] = m[i].split(key.prefix + key.suffix).map(function (value) {
                    return decode(value, key);
                });
            }
            else {
                params[key.name] = decode(m[i], key);
            }
        };
        for (var i = 1; i < m.length; i++) {
            _loop_1(i);
        }
        return { path: path, index: index, params: params };
    };
}
/**
 * Escape a regular expression string.
 */
function escapeString(str) {
    return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
/**
 * Get the flags for a regexp from the options.
 */
function flags(options) {
    return options && options.sensitive ? "" : "i";
}
/**
 * Pull out keys from a regexp.
 */
function regexpToRegexp(path, keys) {
    if (!keys)
        return path;
    // Use a negative lookahead to match only capturing groups.
    var groups = path.source.match(/\((?!\?)/g);
    if (groups) {
        for (var i = 0; i < groups.length; i++) {
            keys.push({
                name: i,
                prefix: "",
                suffix: "",
                modifier: "",
                pattern: ""
            });
        }
    }
    return path;
}
/**
 * Transform an array into a regexp.
 */
function arrayToRegexp(paths, keys, options) {
    var parts = paths.map(function (path) { return pathToRegexp(path, keys, options).source; });
    return new RegExp("(?:" + parts.join("|") + ")", flags(options));
}
/**
 * Create a path regexp from string input.
 */
function stringToRegexp(path, keys, options) {
    return tokensToRegexp(parse(path, options), keys, options);
}
/**
 * Expose a function for taking tokens and returning a RegExp.
 */
function tokensToRegexp(tokens, keys, options) {
    if (options === void 0) { options = {}; }
    var _a = options.strict, strict = _a === void 0 ? false : _a, _b = options.start, start = _b === void 0 ? true : _b, _c = options.end, end = _c === void 0 ? true : _c, _d = options.encode, encode = _d === void 0 ? function (x) { return x; } : _d;
    var endsWith = "[" + escapeString(options.endsWith || "") + "]|$";
    var delimiter = "[" + escapeString(options.delimiter || "/#?") + "]";
    var route = start ? "^" : "";
    // Iterate over the tokens and create our regexp string.
    for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
        var token = tokens_1[_i];
        if (typeof token === "string") {
            route += escapeString(encode(token));
        }
        else {
            var prefix = escapeString(encode(token.prefix));
            var suffix = escapeString(encode(token.suffix));
            if (token.pattern) {
                if (keys)
                    keys.push(token);
                if (prefix || suffix) {
                    if (token.modifier === "+" || token.modifier === "*") {
                        var mod = token.modifier === "*" ? "?" : "";
                        route += "(?:" + prefix + "((?:" + token.pattern + ")(?:" + suffix + prefix + "(?:" + token.pattern + "))*)" + suffix + ")" + mod;
                    }
                    else {
                        route += "(?:" + prefix + "(" + token.pattern + ")" + suffix + ")" + token.modifier;
                    }
                }
                else {
                    route += "(" + token.pattern + ")" + token.modifier;
                }
            }
            else {
                route += "(?:" + prefix + suffix + ")" + token.modifier;
            }
        }
    }
    if (end) {
        if (!strict)
            route += delimiter + "?";
        route += !options.endsWith ? "$" : "(?=" + endsWith + ")";
    }
    else {
        var endToken = tokens[tokens.length - 1];
        var isEndDelimited = typeof endToken === "string"
            ? delimiter.indexOf(endToken[endToken.length - 1]) > -1
            : // tslint:disable-next-line
                endToken === undefined;
        if (!strict) {
            route += "(?:" + delimiter + "(?=" + endsWith + "))?";
        }
        if (!isEndDelimited) {
            route += "(?=" + delimiter + "|" + endsWith + ")";
        }
    }
    return new RegExp(route, flags(options));
}
/**
 * Normalize the given path string, returning a regular expression.
 *
 * An empty array can be passed in for the keys, which will hold the
 * placeholder key descriptions. For example, using `/user/:id`, `keys` will
 * contain `[{ name: 'id', delimiter: '/', optional: false, repeat: false }]`.
 */
function pathToRegexp(path, keys, options) {
    if (path instanceof RegExp)
        return regexpToRegexp(path, keys);
    if (Array.isArray(path))
        return arrayToRegexp(path, keys, options);
    return stringToRegexp(path, keys, options);
}

/**
 Provides matching capabilities to support custom redirects, rewrites, and headers.
 */
/**
 * Match the given path against a source path.
 * @param path
 * @param source
 */
function matchPath(path, source) {
    const matcher = match(source, { decode: decodeURIComponent });
    return matcher(path);
}

function addDefaultLocaleToPath(path, routesManifest) {
    if (routesManifest.i18n) {
        const defaultLocale = routesManifest.i18n.defaultLocale;
        const locales = routesManifest.i18n.locales;
        const basePath = routesManifest.basePath;
        // If prefixed with a locale, return that path
        for (const locale of locales) {
            if (path === `${routesManifest.basePath}/${locale}` ||
                path.startsWith(`${routesManifest.basePath}/${locale}/`)) {
                return path;
            }
        }
        // Otherwise, prefix with default locale
        if (path === "/" || path === `${basePath}`) {
            return `${basePath}/${defaultLocale}`;
        }
        else {
            return path.replace(`${basePath}/`, `${basePath}/${defaultLocale}/`);
        }
    }
    return path;
}

function addHeadersToResponse(path, response, routesManifest) {
    path = addDefaultLocaleToPath(path, routesManifest);
    // Add custom headers to response
    if (response.headers) {
        for (const headerData of routesManifest.headers) {
            const match = matchPath(path, headerData.source);
            if (match) {
                for (const header of headerData.headers) {
                    if (header.key && header.value) {
                        const headerLowerCase = header.key.toLowerCase();
                        response.headers[headerLowerCase] = [
                            {
                                key: headerLowerCase,
                                value: header.value
                            }
                        ];
                    }
                }
            }
        }
    }
}

function createCommonjsModule(fn, basedir, module) {
	return module = {
	  path: basedir,
	  exports: {},
	  require: function (path, base) {
      return commonjsRequire(path, (base === undefined || base === null) ? module.path : base);
    }
	}, fn(module, module.exports), module.exports;
}

function commonjsRequire () {
	throw new Error('Dynamic requires are not currently supported by @rollup/plugin-commonjs');
}

var stringify = function (...args) {

    try {
        return JSON.stringify.apply(null, args);
    }
    catch (err) {
        return '[Cannot display object: ' + err.message + ']';
    }
};

var error = createCommonjsModule(function (module, exports) {


module.exports = class extends Error {

    constructor(args) {

        const msgs = args
            .filter((arg) => arg !== '')
            .map((arg) => {

                return typeof arg === 'string' ? arg : arg instanceof Error ? arg.message : stringify(arg);
            });

        super(msgs.join(' ') || 'Unknown error');

        if (typeof Error.captureStackTrace === 'function') {            // $lab:coverage:ignore$
            Error.captureStackTrace(this, exports.assert);
        }
    }
};
});

var assert = function (condition, ...args) {

    if (condition) {
        return;
    }

    if (args.length === 1 &&
        args[0] instanceof Error) {

        throw args[0];
    }

    throw new error(args);
};

const internals = {};


var reach = function (obj, chain, options) {

    if (chain === false ||
        chain === null ||
        chain === undefined) {

        return obj;
    }

    options = options || {};
    if (typeof options === 'string') {
        options = { separator: options };
    }

    const isChainArray = Array.isArray(chain);

    assert(!isChainArray || !options.separator, 'Separator option no valid for array-based chain');

    const path = isChainArray ? chain : chain.split(options.separator || '.');
    let ref = obj;
    for (let i = 0; i < path.length; ++i) {
        let key = path[i];
        const type = options.iterables && internals.iterables(ref);

        if (Array.isArray(ref) ||
            type === 'set') {

            const number = Number(key);
            if (Number.isInteger(number)) {
                key = number < 0 ? ref.length + number : number;
            }
        }

        if (!ref ||
            typeof ref === 'function' && options.functions === false ||         // Defaults to true
            !type && ref[key] === undefined) {

            assert(!options.strict || i + 1 === path.length, 'Missing segment', key, 'in reach path ', chain);
            assert(typeof ref === 'object' || options.functions === true || typeof ref !== 'function', 'Invalid segment', key, 'in reach path ', chain);
            ref = options.default;
            break;
        }

        if (!type) {
            ref = ref[key];
        }
        else if (type === 'set') {
            ref = [...ref][key];
        }
        else {  // type === 'map'
            ref = ref.get(key);
        }
    }

    return ref;
};


internals.iterables = function (ref) {

    if (ref instanceof Set) {
        return 'set';
    }

    if (ref instanceof Map) {
        return 'map';
    }
};

var types = createCommonjsModule(function (module, exports) {

const internals = {};


exports = module.exports = {
    array: Array.prototype,
    buffer: Buffer && Buffer.prototype,             // $lab:coverage:ignore$
    date: Date.prototype,
    error: Error.prototype,
    generic: Object.prototype,
    map: Map.prototype,
    promise: Promise.prototype,
    regex: RegExp.prototype,
    set: Set.prototype,
    weakMap: WeakMap.prototype,
    weakSet: WeakSet.prototype
};


internals.typeMap = new Map([
    ['[object Error]', exports.error],
    ['[object Map]', exports.map],
    ['[object Promise]', exports.promise],
    ['[object Set]', exports.set],
    ['[object WeakMap]', exports.weakMap],
    ['[object WeakSet]', exports.weakSet]
]);


exports.getInternalProto = function (obj) {

    if (Array.isArray(obj)) {
        return exports.array;
    }

    if (Buffer && obj instanceof Buffer) {          // $lab:coverage:ignore$
        return exports.buffer;
    }

    if (obj instanceof Date) {
        return exports.date;
    }

    if (obj instanceof RegExp) {
        return exports.regex;
    }

    if (obj instanceof Error) {
        return exports.error;
    }

    const objName = Object.prototype.toString.call(obj);
    return internals.typeMap.get(objName) || exports.generic;
};
});

var keys = function (obj, options = {}) {

    return options.symbols !== false ? Reflect.ownKeys(obj) : Object.getOwnPropertyNames(obj);  // Defaults to true
};

var utils = {
	keys: keys
};

const internals$1 = {
    needsProtoHack: new Set([types.set, types.map, types.weakSet, types.weakMap])
};


var clone = internals$1.clone = function (obj, options = {}, _seen = null) {

    if (typeof obj !== 'object' ||
        obj === null) {

        return obj;
    }

    let clone = internals$1.clone;
    let seen = _seen;

    if (options.shallow) {
        if (options.shallow !== true) {
            return internals$1.cloneWithShallow(obj, options);
        }

        clone = (value) => value;
    }
    else if (seen) {
        const lookup = seen.get(obj);
        if (lookup) {
            return lookup;
        }
    }
    else {
        seen = new Map();
    }

    // Built-in object types

    const baseProto = types.getInternalProto(obj);
    if (baseProto === types.buffer) {
        return Buffer && Buffer.from(obj);              // $lab:coverage:ignore$
    }

    if (baseProto === types.date) {
        return new Date(obj.getTime());
    }

    if (baseProto === types.regex) {
        return new RegExp(obj);
    }

    // Generic objects

    const newObj = internals$1.base(obj, baseProto, options);
    if (newObj === obj) {
        return obj;
    }

    if (seen) {
        seen.set(obj, newObj);                              // Set seen, since obj could recurse
    }

    if (baseProto === types.set) {
        for (const value of obj) {
            newObj.add(clone(value, options, seen));
        }
    }
    else if (baseProto === types.map) {
        for (const [key, value] of obj) {
            newObj.set(key, clone(value, options, seen));
        }
    }

    const keys = utils.keys(obj, options);
    for (const key of keys) {
        if (key === '__proto__') {
            continue;
        }

        if (baseProto === types.array &&
            key === 'length') {

            newObj.length = obj.length;
            continue;
        }

        const descriptor = Object.getOwnPropertyDescriptor(obj, key);
        if (descriptor) {
            if (descriptor.get ||
                descriptor.set) {

                Object.defineProperty(newObj, key, descriptor);
            }
            else if (descriptor.enumerable) {
                newObj[key] = clone(obj[key], options, seen);
            }
            else {
                Object.defineProperty(newObj, key, { enumerable: false, writable: true, configurable: true, value: clone(obj[key], options, seen) });
            }
        }
        else {
            Object.defineProperty(newObj, key, {
                enumerable: true,
                writable: true,
                configurable: true,
                value: clone(obj[key], options, seen)
            });
        }
    }

    return newObj;
};


internals$1.cloneWithShallow = function (source, options) {

    const keys = options.shallow;
    options = Object.assign({}, options);
    options.shallow = false;

    const seen = new Map();

    for (const key of keys) {
        const ref = reach(source, key);
        if (typeof ref === 'object' ||
            typeof ref === 'function') {

            seen.set(ref, ref);
        }
    }

    return internals$1.clone(source, options, seen);
};


internals$1.base = function (obj, baseProto, options) {

    if (options.prototype === false) {                  // Defaults to true
        if (internals$1.needsProtoHack.has(baseProto)) {
            return new baseProto.constructor();
        }

        return baseProto === types.array ? [] : {};
    }

    const proto = Object.getPrototypeOf(obj);
    if (proto &&
        proto.isImmutable) {

        return obj;
    }

    if (baseProto === types.array) {
        const newObj = [];
        if (proto !== baseProto) {
            Object.setPrototypeOf(newObj, proto);
        }

        return newObj;
    }

    if (internals$1.needsProtoHack.has(baseProto)) {
        const newObj = new proto.constructor();
        if (proto !== baseProto) {
            Object.setPrototypeOf(newObj, proto);
        }

        return newObj;
    }

    return Object.create(proto);
};

const internals$2 = {};


var merge = internals$2.merge = function (target, source, options) {

    assert(target && typeof target === 'object', 'Invalid target value: must be an object');
    assert(source === null || source === undefined || typeof source === 'object', 'Invalid source value: must be null, undefined, or an object');

    if (!source) {
        return target;
    }

    options = Object.assign({ nullOverride: true, mergeArrays: true }, options);

    if (Array.isArray(source)) {
        assert(Array.isArray(target), 'Cannot merge array onto an object');
        if (!options.mergeArrays) {
            target.length = 0;                                                          // Must not change target assignment
        }

        for (let i = 0; i < source.length; ++i) {
            target.push(clone(source[i], { symbols: options.symbols }));
        }

        return target;
    }

    const keys = utils.keys(source, options);
    for (let i = 0; i < keys.length; ++i) {
        const key = keys[i];
        if (key === '__proto__' ||
            !Object.prototype.propertyIsEnumerable.call(source, key)) {

            continue;
        }

        const value = source[key];
        if (value &&
            typeof value === 'object') {

            if (target[key] === value) {
                continue;                                           // Can occur for shallow merges
            }

            if (!target[key] ||
                typeof target[key] !== 'object' ||
                (Array.isArray(target[key]) !== Array.isArray(value)) ||
                value instanceof Date ||
                (Buffer && Buffer.isBuffer(value)) ||               // $lab:coverage:ignore$
                value instanceof RegExp) {

                target[key] = clone(value, { symbols: options.symbols });
            }
            else {
                internals$2.merge(target[key], value, options);
            }
        }
        else {
            if (value !== null &&
                value !== undefined) {                              // Explicit to preserve empty strings

                target[key] = value;
            }
            else if (options.nullOverride) {
                target[key] = value;
            }
        }
    }

    return target;
};

const internals$3 = {};


var applyToDefaults = function (defaults, source, options = {}) {

    assert(defaults && typeof defaults === 'object', 'Invalid defaults value: must be an object');
    assert(!source || source === true || typeof source === 'object', 'Invalid source value: must be true, falsy or an object');
    assert(typeof options === 'object', 'Invalid options: must be an object');

    if (!source) {                                                  // If no source, return null
        return null;
    }

    if (options.shallow) {
        return internals$3.applyToDefaultsWithShallow(defaults, source, options);
    }

    const copy = clone(defaults);

    if (source === true) {                                          // If source is set to true, use defaults
        return copy;
    }

    const nullOverride = options.nullOverride !== undefined ? options.nullOverride : false;
    return merge(copy, source, { nullOverride, mergeArrays: false });
};


internals$3.applyToDefaultsWithShallow = function (defaults, source, options) {

    const keys = options.shallow;
    assert(Array.isArray(keys), 'Invalid keys');

    const seen = new Map();
    const merge$1 = source === true ? null : new Set();

    for (let key of keys) {
        key = Array.isArray(key) ? key : key.split('.');            // Pre-split optimization

        const ref = reach(defaults, key);
        if (ref &&
            typeof ref === 'object') {

            seen.set(ref, merge$1 && reach(source, key) || ref);
        }
        else if (merge$1) {
            merge$1.add(key);
        }
    }

    const copy = clone(defaults, {}, seen);

    if (!merge$1) {
        return copy;
    }

    for (const key of merge$1) {
        internals$3.reachCopy(copy, source, key);
    }

    return merge(copy, source, { mergeArrays: false, nullOverride: false });
};


internals$3.reachCopy = function (dst, src, path) {

    for (const segment of path) {
        if (!(segment in src)) {
            return;
        }

        src = src[segment];
    }

    const value = src;
    let ref = dst;
    for (let i = 0; i < path.length - 1; ++i) {
        const segment = path[i];
        if (typeof ref[segment] !== 'object') {
            ref[segment] = {};
        }

        ref = ref[segment];
    }

    ref[path[path.length - 1]] = value;
};

const internals$4 = {};


var bench = internals$4.Bench = class {

    constructor() {

        this.ts = 0;
        this.reset();
    }

    reset() {

        this.ts = internals$4.Bench.now();
    }

    elapsed() {

        return internals$4.Bench.now() - this.ts;
    }

    static now() {

        const ts = process.hrtime();
        return (ts[0] * 1e3) + (ts[1] / 1e6);
    }
};

var ignore = function () { };

var block = function () {

    return new Promise(ignore);
};

const internals$5 = {
    mismatched: null
};


var deepEqual = function (obj, ref, options) {

    options = Object.assign({ prototype: true }, options);

    return !!internals$5.isDeepEqual(obj, ref, options, []);
};


internals$5.isDeepEqual = function (obj, ref, options, seen) {

    if (obj === ref) {                                                      // Copied from Deep-eql, copyright(c) 2013 Jake Luer, jake@alogicalparadox.com, MIT Licensed, https://github.com/chaijs/deep-eql
        return obj !== 0 || 1 / obj === 1 / ref;
    }

    const type = typeof obj;

    if (type !== typeof ref) {
        return false;
    }

    if (obj === null ||
        ref === null) {

        return false;
    }

    if (type === 'function') {
        if (!options.deepFunction ||
            obj.toString() !== ref.toString()) {

            return false;
        }

        // Continue as object
    }
    else if (type !== 'object') {
        return obj !== obj && ref !== ref;                                  // NaN
    }

    const instanceType = internals$5.getSharedType(obj, ref, !!options.prototype);
    switch (instanceType) {
        case types.buffer:
            return Buffer && Buffer.prototype.equals.call(obj, ref);        // $lab:coverage:ignore$
        case types.promise:
            return obj === ref;
        case types.regex:
            return obj.toString() === ref.toString();
        case internals$5.mismatched:
            return false;
    }

    for (let i = seen.length - 1; i >= 0; --i) {
        if (seen[i].isSame(obj, ref)) {
            return true;                                                    // If previous comparison failed, it would have stopped execution
        }
    }

    seen.push(new internals$5.SeenEntry(obj, ref));

    try {
        return !!internals$5.isDeepEqualObj(instanceType, obj, ref, options, seen);
    }
    finally {
        seen.pop();
    }
};


internals$5.getSharedType = function (obj, ref, checkPrototype) {

    if (checkPrototype) {
        if (Object.getPrototypeOf(obj) !== Object.getPrototypeOf(ref)) {
            return internals$5.mismatched;
        }

        return types.getInternalProto(obj);
    }

    const type = types.getInternalProto(obj);
    if (type !== types.getInternalProto(ref)) {
        return internals$5.mismatched;
    }

    return type;
};


internals$5.valueOf = function (obj) {

    const objValueOf = obj.valueOf;
    if (objValueOf === undefined) {
        return obj;
    }

    try {
        return objValueOf.call(obj);
    }
    catch (err) {
        return err;
    }
};


internals$5.hasOwnEnumerableProperty = function (obj, key) {

    return Object.prototype.propertyIsEnumerable.call(obj, key);
};


internals$5.isSetSimpleEqual = function (obj, ref) {

    for (const entry of Set.prototype.values.call(obj)) {
        if (!Set.prototype.has.call(ref, entry)) {
            return false;
        }
    }

    return true;
};


internals$5.isDeepEqualObj = function (instanceType, obj, ref, options, seen) {

    const { isDeepEqual, valueOf, hasOwnEnumerableProperty } = internals$5;
    const { keys, getOwnPropertySymbols } = Object;

    if (instanceType === types.array) {
        if (options.part) {

            // Check if any index match any other index

            for (const objValue of obj) {
                for (const refValue of ref) {
                    if (isDeepEqual(objValue, refValue, options, seen)) {
                        return true;
                    }
                }
            }
        }
        else {
            if (obj.length !== ref.length) {
                return false;
            }

            for (let i = 0; i < obj.length; ++i) {
                if (!isDeepEqual(obj[i], ref[i], options, seen)) {
                    return false;
                }
            }

            return true;
        }
    }
    else if (instanceType === types.set) {
        if (obj.size !== ref.size) {
            return false;
        }

        if (!internals$5.isSetSimpleEqual(obj, ref)) {

            // Check for deep equality

            const ref2 = new Set(Set.prototype.values.call(ref));
            for (const objEntry of Set.prototype.values.call(obj)) {
                if (ref2.delete(objEntry)) {
                    continue;
                }

                let found = false;
                for (const refEntry of ref2) {
                    if (isDeepEqual(objEntry, refEntry, options, seen)) {
                        ref2.delete(refEntry);
                        found = true;
                        break;
                    }
                }

                if (!found) {
                    return false;
                }
            }
        }
    }
    else if (instanceType === types.map) {
        if (obj.size !== ref.size) {
            return false;
        }

        for (const [key, value] of Map.prototype.entries.call(obj)) {
            if (value === undefined && !Map.prototype.has.call(ref, key)) {
                return false;
            }

            if (!isDeepEqual(value, Map.prototype.get.call(ref, key), options, seen)) {
                return false;
            }
        }
    }
    else if (instanceType === types.error) {

        // Always check name and message

        if (obj.name !== ref.name ||
            obj.message !== ref.message) {

            return false;
        }
    }

    // Check .valueOf()

    const valueOfObj = valueOf(obj);
    const valueOfRef = valueOf(ref);
    if ((obj !== valueOfObj || ref !== valueOfRef) &&
        !isDeepEqual(valueOfObj, valueOfRef, options, seen)) {

        return false;
    }

    // Check properties

    const objKeys = keys(obj);
    if (!options.part &&
        objKeys.length !== keys(ref).length &&
        !options.skip) {

        return false;
    }

    let skipped = 0;
    for (const key of objKeys) {
        if (options.skip &&
            options.skip.includes(key)) {

            if (ref[key] === undefined) {
                ++skipped;
            }

            continue;
        }

        if (!hasOwnEnumerableProperty(ref, key)) {
            return false;
        }

        if (!isDeepEqual(obj[key], ref[key], options, seen)) {
            return false;
        }
    }

    if (!options.part &&
        objKeys.length - skipped !== keys(ref).length) {

        return false;
    }

    // Check symbols

    if (options.symbols !== false) {                                // Defaults to true
        const objSymbols = getOwnPropertySymbols(obj);
        const refSymbols = new Set(getOwnPropertySymbols(ref));

        for (const key of objSymbols) {
            if (!options.skip ||
                !options.skip.includes(key)) {

                if (hasOwnEnumerableProperty(obj, key)) {
                    if (!hasOwnEnumerableProperty(ref, key)) {
                        return false;
                    }

                    if (!isDeepEqual(obj[key], ref[key], options, seen)) {
                        return false;
                    }
                }
                else if (hasOwnEnumerableProperty(ref, key)) {
                    return false;
                }
            }

            refSymbols.delete(key);
        }

        for (const key of refSymbols) {
            if (hasOwnEnumerableProperty(ref, key)) {
                return false;
            }
        }
    }

    return true;
};


internals$5.SeenEntry = class {

    constructor(obj, ref) {

        this.obj = obj;
        this.ref = ref;
    }

    isSame(obj, ref) {

        return this.obj === obj && this.ref === ref;
    }
};

var escapeRegex = function (string) {

    // Escape ^$.*+-?=!:|\/()[]{},

    return string.replace(/[\^\$\.\*\+\-\?\=\!\:\|\\\/\(\)\[\]\{\}\,]/g, '\\$&');
};

const internals$6 = {};


var contain = function (ref, values, options = {}) {        // options: { deep, once, only, part, symbols }

    /*
        string -> string(s)
        array -> item(s)
        object -> key(s)
        object -> object (key:value)
    */

    if (typeof values !== 'object') {
        values = [values];
    }

    assert(!Array.isArray(values) || values.length, 'Values array cannot be empty');

    // String

    if (typeof ref === 'string') {
        return internals$6.string(ref, values, options);
    }

    // Array

    if (Array.isArray(ref)) {
        return internals$6.array(ref, values, options);
    }

    // Object

    assert(typeof ref === 'object', 'Reference must be string or an object');
    return internals$6.object(ref, values, options);
};


internals$6.array = function (ref, values, options) {

    if (!Array.isArray(values)) {
        values = [values];
    }

    if (!ref.length) {
        return false;
    }

    if (options.only &&
        options.once &&
        ref.length !== values.length) {

        return false;
    }

    let compare;

    // Map values

    const map = new Map();
    for (const value of values) {
        if (!options.deep ||
            !value ||
            typeof value !== 'object') {

            const existing = map.get(value);
            if (existing) {
                ++existing.allowed;
            }
            else {
                map.set(value, { allowed: 1, hits: 0 });
            }
        }
        else {
            compare = compare || internals$6.compare(options);

            let found = false;
            for (const [key, existing] of map.entries()) {
                if (compare(key, value)) {
                    ++existing.allowed;
                    found = true;
                    break;
                }
            }

            if (!found) {
                map.set(value, { allowed: 1, hits: 0 });
            }
        }
    }

    // Lookup values

    let hits = 0;
    for (const item of ref) {
        let match;
        if (!options.deep ||
            !item ||
            typeof item !== 'object') {

            match = map.get(item);
        }
        else {
            compare = compare || internals$6.compare(options);

            for (const [key, existing] of map.entries()) {
                if (compare(key, item)) {
                    match = existing;
                    break;
                }
            }
        }

        if (match) {
            ++match.hits;
            ++hits;

            if (options.once &&
                match.hits > match.allowed) {

                return false;
            }
        }
    }

    // Validate results

    if (options.only &&
        hits !== ref.length) {

        return false;
    }

    for (const match of map.values()) {
        if (match.hits === match.allowed) {
            continue;
        }

        if (match.hits < match.allowed &&
            !options.part) {

            return false;
        }
    }

    return !!hits;
};


internals$6.object = function (ref, values, options) {

    assert(options.once === undefined, 'Cannot use option once with object');

    const keys = utils.keys(ref, options);
    if (!keys.length) {
        return false;
    }

    // Keys list

    if (Array.isArray(values)) {
        return internals$6.array(keys, values, options);
    }

    // Key value pairs

    const symbols = Object.getOwnPropertySymbols(values).filter((sym) => values.propertyIsEnumerable(sym));
    const targets = [...Object.keys(values), ...symbols];

    const compare = internals$6.compare(options);
    const set = new Set(targets);

    for (const key of keys) {
        if (!set.has(key)) {
            if (options.only) {
                return false;
            }

            continue;
        }

        if (!compare(values[key], ref[key])) {
            return false;
        }

        set.delete(key);
    }

    if (set.size) {
        return options.part ? set.size < targets.length : false;
    }

    return true;
};


internals$6.string = function (ref, values, options) {

    // Empty string

    if (ref === '') {
        return values.length === 1 && values[0] === '' ||               // '' contains ''
            !options.once && !values.some((v) => v !== '');             // '' contains multiple '' if !once
    }

    // Map values

    const map = new Map();
    const patterns = [];

    for (const value of values) {
        assert(typeof value === 'string', 'Cannot compare string reference to non-string value');

        if (value) {
            const existing = map.get(value);
            if (existing) {
                ++existing.allowed;
            }
            else {
                map.set(value, { allowed: 1, hits: 0 });
                patterns.push(escapeRegex(value));
            }
        }
        else if (options.once ||
            options.only) {

            return false;
        }
    }

    if (!patterns.length) {                     // Non-empty string contains unlimited empty string
        return true;
    }

    // Match patterns

    const regex = new RegExp(`(${patterns.join('|')})`, 'g');
    const leftovers = ref.replace(regex, ($0, $1) => {

        ++map.get($1).hits;
        return '';                              // Remove from string
    });

    // Validate results

    if (options.only &&
        leftovers) {

        return false;
    }

    let any = false;
    for (const match of map.values()) {
        if (match.hits) {
            any = true;
        }

        if (match.hits === match.allowed) {
            continue;
        }

        if (match.hits < match.allowed &&
            !options.part) {

            return false;
        }

        // match.hits > match.allowed

        if (options.once) {
            return false;
        }
    }

    return !!any;
};


internals$6.compare = function (options) {

    if (!options.deep) {
        return internals$6.shallow;
    }

    const hasOnly = options.only !== undefined;
    const hasPart = options.part !== undefined;

    const flags = {
        prototype: hasOnly ? options.only : hasPart ? !options.part : false,
        part: hasOnly ? !options.only : hasPart ? options.part : false
    };

    return (a, b) => deepEqual(a, b, flags);
};


internals$6.shallow = function (a, b) {

    return a === b;
};

var escapeHeaderAttribute = function (attribute) {

    // Allowed value characters: !#$%&'()*+,-./:;<=>?@[]^_`{|}~ and space, a-z, A-Z, 0-9, \, "

    assert(/^[ \w\!#\$%&'\(\)\*\+,\-\.\/\:;<\=>\?@\[\]\^`\{\|\}~\"\\]*$/.test(attribute), 'Bad attribute value (' + attribute + ')');

    return attribute.replace(/\\/g, '\\\\').replace(/\"/g, '\\"');                             // Escape quotes and slash
};

const internals$7 = {};


var escapeHtml = function (input) {

    if (!input) {
        return '';
    }

    let escaped = '';

    for (let i = 0; i < input.length; ++i) {

        const charCode = input.charCodeAt(i);

        if (internals$7.isSafe(charCode)) {
            escaped += input[i];
        }
        else {
            escaped += internals$7.escapeHtmlChar(charCode);
        }
    }

    return escaped;
};


internals$7.escapeHtmlChar = function (charCode) {

    const namedEscape = internals$7.namedHtml[charCode];
    if (typeof namedEscape !== 'undefined') {
        return namedEscape;
    }

    if (charCode >= 256) {
        return '&#' + charCode + ';';
    }

    const hexValue = charCode.toString(16).padStart(2, '0');
    return `&#x${hexValue};`;
};


internals$7.isSafe = function (charCode) {

    return (typeof internals$7.safeCharCodes[charCode] !== 'undefined');
};


internals$7.namedHtml = {
    '38': '&amp;',
    '60': '&lt;',
    '62': '&gt;',
    '34': '&quot;',
    '160': '&nbsp;',
    '162': '&cent;',
    '163': '&pound;',
    '164': '&curren;',
    '169': '&copy;',
    '174': '&reg;'
};


internals$7.safeCharCodes = (function () {

    const safe = {};

    for (let i = 32; i < 123; ++i) {

        if ((i >= 97) ||                    // a-z
            (i >= 65 && i <= 90) ||         // A-Z
            (i >= 48 && i <= 57) ||         // 0-9
            i === 32 ||                     // space
            i === 46 ||                     // .
            i === 44 ||                     // ,
            i === 45 ||                     // -
            i === 58 ||                     // :
            i === 95) {                     // _

            safe[i] = null;
        }
    }

    return safe;
}());

var escapeJson = function (input) {

    if (!input) {
        return '';
    }

    const lessThan = 0x3C;
    const greaterThan = 0x3E;
    const andSymbol = 0x26;
    const lineSeperator = 0x2028;

    // replace method
    let charCode;
    return input.replace(/[<>&\u2028\u2029]/g, (match) => {

        charCode = match.charCodeAt(0);

        if (charCode === lessThan) {
            return '\\u003c';
        }

        if (charCode === greaterThan) {
            return '\\u003e';
        }

        if (charCode === andSymbol) {
            return '\\u0026';
        }

        if (charCode === lineSeperator) {
            return '\\u2028';
        }

        return '\\u2029';
    });
};

const internals$8 = {};


var flatten = internals$8.flatten = function (array, target) {

    const result = target || [];

    for (let i = 0; i < array.length; ++i) {
        if (Array.isArray(array[i])) {
            internals$8.flatten(array[i], result);
        }
        else {
            result.push(array[i]);
        }
    }

    return result;
};

const internals$9 = {};


var intersect = function (array1, array2, options = {}) {

    if (!array1 ||
        !array2) {

        return (options.first ? null : []);
    }

    const common = [];
    const hash = (Array.isArray(array1) ? new Set(array1) : array1);
    const found = new Set();
    for (const value of array2) {
        if (internals$9.has(hash, value) &&
            !found.has(value)) {

            if (options.first) {
                return value;
            }

            common.push(value);
            found.add(value);
        }
    }

    return (options.first ? null : common);
};


internals$9.has = function (ref, key) {

    if (typeof ref.has === 'function') {
        return ref.has(key);
    }

    return ref[key] !== undefined;
};

var isPromise = function (promise) {

    return !!promise && typeof promise.then === 'function';
};

var once = function (method) {

    if (method._hoekOnce) {
        return method;
    }

    let once = false;
    const wrapped = function (...args) {

        if (!once) {
            once = true;
            method(...args);
        }
    };

    wrapped._hoekOnce = true;
    return wrapped;
};

var reachTemplate = function (obj, template, options) {

    return template.replace(/{([^}]+)}/g, ($0, chain) => {

        const value = reach(obj, chain, options);
        return (value === undefined || value === null ? '' : value);
    });
};

var wait = function (timeout, returnValue) {

    if (typeof timeout !== 'number' && timeout !== undefined) {
        throw new TypeError('Timeout must be a number');
    }

    return new Promise((resolve) => setTimeout(resolve, timeout, returnValue));
};

var lib = {
    applyToDefaults: applyToDefaults,
    assert: assert,
    Bench: bench,
    block: block,
    clone: clone,
    contain: contain,
    deepEqual: deepEqual,
    Error: error,
    escapeHeaderAttribute: escapeHeaderAttribute,
    escapeHtml: escapeHtml,
    escapeJson: escapeJson,
    escapeRegex: escapeRegex,
    flatten: flatten,
    ignore: ignore,
    intersect: intersect,
    isPromise: isPromise,
    merge: merge,
    once: once,
    reach: reach,
    reachTemplate: reachTemplate,
    stringify: stringify,
    wait: wait
};

var lib$1 = createCommonjsModule(function (module, exports) {




const internals = {
    codes: new Map([
        [100, 'Continue'],
        [101, 'Switching Protocols'],
        [102, 'Processing'],
        [200, 'OK'],
        [201, 'Created'],
        [202, 'Accepted'],
        [203, 'Non-Authoritative Information'],
        [204, 'No Content'],
        [205, 'Reset Content'],
        [206, 'Partial Content'],
        [207, 'Multi-Status'],
        [300, 'Multiple Choices'],
        [301, 'Moved Permanently'],
        [302, 'Moved Temporarily'],
        [303, 'See Other'],
        [304, 'Not Modified'],
        [305, 'Use Proxy'],
        [307, 'Temporary Redirect'],
        [400, 'Bad Request'],
        [401, 'Unauthorized'],
        [402, 'Payment Required'],
        [403, 'Forbidden'],
        [404, 'Not Found'],
        [405, 'Method Not Allowed'],
        [406, 'Not Acceptable'],
        [407, 'Proxy Authentication Required'],
        [408, 'Request Time-out'],
        [409, 'Conflict'],
        [410, 'Gone'],
        [411, 'Length Required'],
        [412, 'Precondition Failed'],
        [413, 'Request Entity Too Large'],
        [414, 'Request-URI Too Large'],
        [415, 'Unsupported Media Type'],
        [416, 'Requested Range Not Satisfiable'],
        [417, 'Expectation Failed'],
        [418, 'I\'m a teapot'],
        [422, 'Unprocessable Entity'],
        [423, 'Locked'],
        [424, 'Failed Dependency'],
        [425, 'Too Early'],
        [426, 'Upgrade Required'],
        [428, 'Precondition Required'],
        [429, 'Too Many Requests'],
        [431, 'Request Header Fields Too Large'],
        [451, 'Unavailable For Legal Reasons'],
        [500, 'Internal Server Error'],
        [501, 'Not Implemented'],
        [502, 'Bad Gateway'],
        [503, 'Service Unavailable'],
        [504, 'Gateway Time-out'],
        [505, 'HTTP Version Not Supported'],
        [506, 'Variant Also Negotiates'],
        [507, 'Insufficient Storage'],
        [509, 'Bandwidth Limit Exceeded'],
        [510, 'Not Extended'],
        [511, 'Network Authentication Required']
    ])
};


exports.Boom = class extends Error {

    constructor(message, options = {}) {

        if (message instanceof Error) {
            return exports.boomify(lib.clone(message), options);
        }

        const { statusCode = 500, data = null, ctor = exports.Boom } = options;
        const error = new Error(message ? message : undefined);         // Avoids settings null message
        Error.captureStackTrace(error, ctor);                           // Filter the stack to our external API
        error.data = data;
        const boom = internals.initialize(error, statusCode);

        Object.defineProperty(boom, 'typeof', { value: ctor });

        if (options.decorate) {
            Object.assign(boom, options.decorate);
        }

        return boom;
    }

    static [Symbol.hasInstance](instance) {

        return exports.isBoom(instance);
    }
};


exports.isBoom = function (err, statusCode) {

    return err instanceof Error && !!err.isBoom && (!statusCode || err.output.statusCode === statusCode);
};


exports.boomify = function (err, options) {

    lib.assert(err instanceof Error, 'Cannot wrap non-Error object');

    options = options || {};

    if (options.data !== undefined) {
        err.data = options.data;
    }

    if (options.decorate) {
        Object.assign(err, options.decorate);
    }

    if (!err.isBoom) {
        return internals.initialize(err, options.statusCode || 500, options.message);
    }

    if (options.override === false ||                           // Defaults to true
        !options.statusCode && !options.message) {

        return err;
    }

    return internals.initialize(err, options.statusCode || err.output.statusCode, options.message);
};


// 4xx Client Errors

exports.badRequest = function (message, data) {

    return new exports.Boom(message, { statusCode: 400, data, ctor: exports.badRequest });
};


exports.unauthorized = function (message, scheme, attributes) {          // Or (message, wwwAuthenticate[])

    const err = new exports.Boom(message, { statusCode: 401, ctor: exports.unauthorized });

    // function (message)

    if (!scheme) {
        return err;
    }

    // function (message, wwwAuthenticate[])

    if (typeof scheme !== 'string') {
        err.output.headers['WWW-Authenticate'] = scheme.join(', ');
        return err;
    }

    // function (message, scheme, attributes)

    let wwwAuthenticate = `${scheme}`;

    if (attributes ||
        message) {

        err.output.payload.attributes = {};
    }

    if (attributes) {
        if (typeof attributes === 'string') {
            wwwAuthenticate += ' ' + lib.escapeHeaderAttribute(attributes);
            err.output.payload.attributes = attributes;
        }
        else {
            wwwAuthenticate += ' ' + Object.keys(attributes).map((name) => {

                let value = attributes[name];
                if (value === null ||
                    value === undefined) {

                    value = '';
                }

                err.output.payload.attributes[name] = value;
                return `${name}="${lib.escapeHeaderAttribute(value.toString())}"`;
            })
                .join(', ');
        }
    }

    if (message) {
        if (attributes) {
            wwwAuthenticate += ',';
        }

        wwwAuthenticate += ` error="${lib.escapeHeaderAttribute(message)}"`;
        err.output.payload.attributes.error = message;
    }
    else {
        err.isMissing = true;
    }

    err.output.headers['WWW-Authenticate'] = wwwAuthenticate;
    return err;
};


exports.paymentRequired = function (message, data) {

    return new exports.Boom(message, { statusCode: 402, data, ctor: exports.paymentRequired });
};


exports.forbidden = function (message, data) {

    return new exports.Boom(message, { statusCode: 403, data, ctor: exports.forbidden });
};


exports.notFound = function (message, data) {

    return new exports.Boom(message, { statusCode: 404, data, ctor: exports.notFound });
};


exports.methodNotAllowed = function (message, data, allow) {

    const err = new exports.Boom(message, { statusCode: 405, data, ctor: exports.methodNotAllowed });

    if (typeof allow === 'string') {
        allow = [allow];
    }

    if (Array.isArray(allow)) {
        err.output.headers.Allow = allow.join(', ');
    }

    return err;
};


exports.notAcceptable = function (message, data) {

    return new exports.Boom(message, { statusCode: 406, data, ctor: exports.notAcceptable });
};


exports.proxyAuthRequired = function (message, data) {

    return new exports.Boom(message, { statusCode: 407, data, ctor: exports.proxyAuthRequired });
};


exports.clientTimeout = function (message, data) {

    return new exports.Boom(message, { statusCode: 408, data, ctor: exports.clientTimeout });
};


exports.conflict = function (message, data) {

    return new exports.Boom(message, { statusCode: 409, data, ctor: exports.conflict });
};


exports.resourceGone = function (message, data) {

    return new exports.Boom(message, { statusCode: 410, data, ctor: exports.resourceGone });
};


exports.lengthRequired = function (message, data) {

    return new exports.Boom(message, { statusCode: 411, data, ctor: exports.lengthRequired });
};


exports.preconditionFailed = function (message, data) {

    return new exports.Boom(message, { statusCode: 412, data, ctor: exports.preconditionFailed });
};


exports.entityTooLarge = function (message, data) {

    return new exports.Boom(message, { statusCode: 413, data, ctor: exports.entityTooLarge });
};


exports.uriTooLong = function (message, data) {

    return new exports.Boom(message, { statusCode: 414, data, ctor: exports.uriTooLong });
};


exports.unsupportedMediaType = function (message, data) {

    return new exports.Boom(message, { statusCode: 415, data, ctor: exports.unsupportedMediaType });
};


exports.rangeNotSatisfiable = function (message, data) {

    return new exports.Boom(message, { statusCode: 416, data, ctor: exports.rangeNotSatisfiable });
};


exports.expectationFailed = function (message, data) {

    return new exports.Boom(message, { statusCode: 417, data, ctor: exports.expectationFailed });
};


exports.teapot = function (message, data) {

    return new exports.Boom(message, { statusCode: 418, data, ctor: exports.teapot });
};


exports.badData = function (message, data) {

    return new exports.Boom(message, { statusCode: 422, data, ctor: exports.badData });
};


exports.locked = function (message, data) {

    return new exports.Boom(message, { statusCode: 423, data, ctor: exports.locked });
};


exports.failedDependency = function (message, data) {

    return new exports.Boom(message, { statusCode: 424, data, ctor: exports.failedDependency });
};

exports.tooEarly = function (message, data) {

    return new exports.Boom(message, { statusCode: 425, data, ctor: exports.tooEarly });
};


exports.preconditionRequired = function (message, data) {

    return new exports.Boom(message, { statusCode: 428, data, ctor: exports.preconditionRequired });
};


exports.tooManyRequests = function (message, data) {

    return new exports.Boom(message, { statusCode: 429, data, ctor: exports.tooManyRequests });
};


exports.illegal = function (message, data) {

    return new exports.Boom(message, { statusCode: 451, data, ctor: exports.illegal });
};


// 5xx Server Errors

exports.internal = function (message, data, statusCode = 500) {

    return internals.serverError(message, data, statusCode, exports.internal);
};


exports.notImplemented = function (message, data) {

    return internals.serverError(message, data, 501, exports.notImplemented);
};


exports.badGateway = function (message, data) {

    return internals.serverError(message, data, 502, exports.badGateway);
};


exports.serverUnavailable = function (message, data) {

    return internals.serverError(message, data, 503, exports.serverUnavailable);
};


exports.gatewayTimeout = function (message, data) {

    return internals.serverError(message, data, 504, exports.gatewayTimeout);
};


exports.badImplementation = function (message, data) {

    const err = internals.serverError(message, data, 500, exports.badImplementation);
    err.isDeveloperError = true;
    return err;
};


internals.initialize = function (err, statusCode, message) {

    const numberCode = parseInt(statusCode, 10);
    lib.assert(!isNaN(numberCode) && numberCode >= 400, 'First argument must be a number (400+):', statusCode);

    err.isBoom = true;
    err.isServer = numberCode >= 500;

    if (!err.hasOwnProperty('data')) {
        err.data = null;
    }

    err.output = {
        statusCode: numberCode,
        payload: {},
        headers: {}
    };

    Object.defineProperty(err, 'reformat', { value: internals.reformat });

    if (!message &&
        !err.message) {

        err.reformat();
        message = err.output.payload.error;
    }

    if (message) {
        const props = Object.getOwnPropertyDescriptor(err, 'message') || Object.getOwnPropertyDescriptor(Object.getPrototypeOf(err), 'message');
        lib.assert(!props || props.configurable && !props.get, 'The error is not compatible with boom');

        err.message = message + (err.message ? ': ' + err.message : '');
        err.output.payload.message = err.message;
    }

    err.reformat();
    return err;
};


internals.reformat = function (debug = false) {

    this.output.payload.statusCode = this.output.statusCode;
    this.output.payload.error = internals.codes.get(this.output.statusCode) || 'Unknown';

    if (this.output.statusCode === 500 && debug !== true) {
        this.output.payload.message = 'An internal server error occurred';              // Hide actual error from user
    }
    else if (this.message) {
        this.output.payload.message = this.message;
    }
};


internals.serverError = function (message, data, statusCode, ctor) {

    if (data instanceof Error &&
        !data.isBoom) {

        return exports.boomify(data, { statusCode, message });
    }

    return new exports.Boom(message, { statusCode, data, ctor });
};
});

var header = createCommonjsModule(function (module, exports) {





const internals = {};


exports.selection = function (header, preferences, options) {

    const selections = exports.selections(header, preferences, options);
    return selections.length ? selections[0] : '';
};


exports.selections = function (header, preferences, options) {

    lib.assert(!preferences || Array.isArray(preferences), 'Preferences must be an array');

    return internals.parse(header || '', preferences, options);
};


//      RFC 7231 Section 5.3.3 (https://tools.ietf.org/html/rfc7231#section-5.3.3)
//
//      Accept-Charset  = *( "," OWS ) ( ( charset / "*" ) [ weight ] ) *( OWS "," [ OWS ( ( charset / "*" ) [ weight ] ) ] )
//      charset         = token
//
//      Accept-Charset: iso-8859-5, unicode-1-1;q=0.8


//      RFC 7231 Section 5.3.4 (https://tools.ietf.org/html/rfc7231#section-5.3.4)
//
//      Accept-Encoding = [ ( "," / ( codings [ weight ] ) ) *( OWS "," [ OWS ( codings [ weight ] ) ] ) ]
//      codings         = content-coding / "identity" / "*"
//      content-coding  = token
//
//      Accept-Encoding: compress, gzip
//      Accept-Encoding:
//      Accept-Encoding: *
//      Accept-Encoding: compress;q=0.5, gzip;q=1.0
//      Accept-Encoding: gzip;q=1.0, identity; q=0.5, *;q=0


//      RFC 7231 Section 5.3.5 (https://tools.ietf.org/html/rfc7231#section-5.3.5)
//
//      Accept-Language = *( "," OWS ) ( language-range [ weight ] ) *( OWS "," [ OWS ( language-range [ weight ] ) ] )
//      language-range  = ( 1*8ALPHA *( "-" 1*8alphanum ) ) / "*"   ; [RFC4647], Section 2.1
//      alphanum        = ALPHA / DIGIT
//
//       Accept-Language: da, en-gb;q=0.8, en;q=0.7


//      token           = 1*tchar
//      tchar           = "!" / "#" / "$" / "%" / "&" / "'" / "*"
//                        / "+" / "-" / "." / "^" / "_" / "`" / "|" / "~"
//                        / DIGIT / ALPHA
//                        ; any VCHAR, except delimiters
//      OWS             = *( SP / HTAB )


//      RFC 7231 Section 5.3.1 (https://tools.ietf.org/html/rfc7231#section-5.3.1)
//
//      The weight is normalized to a real number in the range 0 through 1,
//      where 0.001 is the least preferred and 1 is the most preferred; a
//      value of 0 means "not acceptable".  If no "q" parameter is present,
//      the default weight is 1.
//
//       weight = OWS ";" OWS "q=" qvalue
//       qvalue = ( "0" [ "." 0*3DIGIT ] ) / ( "1" [ "." 0*3("0") ] )


internals.parse = function (raw, preferences, options) {

    // Normalize header (remove spaces and tabs)

    const header = raw.replace(/[ \t]/g, '');

    // Normalize preferences

    const lowers = new Map();
    if (preferences) {
        for (let i = 0; i < preferences.length; ++i) {
            const preference = preferences[i];
            lowers.set(preference.toLowerCase(), { orig: preference, pos: i });
        }
    }

    // Parse selections

    const parts = header.split(',');
    const selections = [];
    const map = new Set();

    for (let i = 0; i < parts.length; ++i) {
        const part = parts[i];
        if (!part) {                            // Ignore empty parts or leading commas
            continue;
        }

        // Parse parameters

        const params = part.split(';');
        if (params.length > 2) {
            throw lib$1.badRequest(`Invalid ${options.type} header`);
        }

        let token = params[0].toLowerCase();
        if (!token) {
            throw lib$1.badRequest(`Invalid ${options.type} header`);
        }

        if (options.equivalents &&
            options.equivalents.has(token)) {

            token = options.equivalents.get(token);
        }

        const selection = {
            token,
            pos: i,
            q: 1,
            specificity: options.specificity ? token.split('-') : null
        };

        if (preferences &&
            lowers.has(token)) {

            selection.pref = lowers.get(token).pos;
        }

        map.add(selection.token);

        // Parse q=value

        if (params.length === 2) {
            const q = params[1];
            const [key, value] = q.split('=');

            if (!value ||
                key !== 'q' && key !== 'Q') {

                throw lib$1.badRequest(`Invalid ${options.type} header`);
            }

            const score = parseFloat(value);
            if (score === 0) {
                continue;
            }

            if (Number.isFinite(score) &&
                score <= 1 &&
                score >= 0.001) {

                selection.q = score;
            }
        }

        selections.push(selection);             // Only add allowed selections (q !== 0)
    }

    // Sort selection based on q and then position in header

    selections.sort(internals.sort);

    // Extract tokens

    const values = selections.map((selection) => selection.token);

    if (options.default &&
        !map.has(options.default)) {

        values.push(options.default);
    }

    if (!preferences ||
        !preferences.length) {

        return values;
    }

    const preferred = [];
    for (const selection of values) {
        if (selection === '*') {
            for (const [preference, value] of lowers) {
                if (!map.has(preference)) {
                    preferred.push(value.orig);
                }
            }
        }
        else {
            const lower = selection.toLowerCase();
            if (lowers.has(lower)) {
                preferred.push(lowers.get(lower).orig);
            }
        }
    }

    return preferred;
};


internals.sort = function (a, b) {

    const aFirst = -1;
    const bFirst = 1;

    if (b.q !== a.q) {
        return b.q - a.q;
    }

    if (b.pref !== a.pref) {
        if (a.pref === undefined) {
            return bFirst;
        }

        if (b.pref === undefined) {
            return aFirst;
        }

        return a.pref - b.pref;
    }

    if (a.specificity &&
        a.specificity[0] === b.specificity[0] &&
        a.specificity.length !== b.specificity.length) {

        return b.specificity.length - a.specificity.length;
    }

    return a.pos - b.pos;
};
});

var media = createCommonjsModule(function (module, exports) {





const internals = {};


exports.selection = function (header, preferences) {

    const selections = exports.selections(header, preferences);
    return selections.length ? selections[0] : '';
};


exports.selections = function (header, preferences) {

    lib.assert(!preferences || Array.isArray(preferences), 'Preferences must be an array');

    return internals.parse(header, preferences);
};


//      RFC 7231 Section 5.3.2 (https://tools.ietf.org/html/rfc7231#section-5.3.2)
//
//      Accept          = [ ( "," / ( media-range [ accept-params ] ) ) *( OWS "," [ OWS ( media-range [ accept-params ] ) ] ) ]
//      media-range     = ( "*/*" / ( type "/*" ) / ( type "/" subtype ) ) *( OWS ";" OWS parameter )
//      accept-params   = weight *accept-ext
//      accept-ext      = OWS ";" OWS token [ "=" ( token / quoted-string ) ]
//      type            = token
//      subtype         = token
//      parameter       = token "=" ( token / quoted-string )
//
//      quoted-string   = DQUOTE *( qdtext / quoted-pair ) DQUOTE
//      qdtext          = HTAB / SP /%x21 / %x23-5B / %x5D-7E / obs-text
//      obs-text        = %x80-FF
//      quoted-pair     = "\" ( HTAB / SP / VCHAR / obs-text )
//      VCHAR           = %x21-7E                                ; visible (printing) characters
//      token           = 1*tchar
//      tchar           = "!" / "#" / "$" / "%" / "&" / "'" / "*" / "+" / "-" / "." / "^" / "_" / "`" / "|" / "~" / DIGIT / ALPHA
//      OWS             = *( SP / HTAB )
//
//      Accept: audio/*; q=0.2, audio/basic
//      Accept: text/plain; q=0.5, text/html, text/x-dvi; q=0.8, text/x-c
//      Accept: text/plain, application/json;q=0.5, text/html, */*; q = 0.1
//      Accept: text/plain, application/json;q=0.5, text/html, text/drop;q=0
//      Accept: text/*, text/plain, text/plain;format=flowed, */*
//      Accept: text/*;q=0.3, text/html;q=0.7, text/html;level=1, text/html;level=2;q=0.4, */*;q=0.5


//      RFC 7231 Section 5.3.1 (https://tools.ietf.org/html/rfc7231#section-5.3.1)
//
//      The weight is normalized to a real number in the range 0 through 1,
//      where 0.001 is the least preferred and 1 is the most preferred; a
//      value of 0 means "not acceptable".  If no "q" parameter is present,
//      the default weight is 1.
//
//       weight = OWS ";" OWS "q=" qvalue
//       qvalue = ( "0" [ "." 0*3DIGIT ] ) / ( "1" [ "." 0*3("0") ] )


//                         */*        type/*                              type/subtype
internals.validMediaRx = /^(?:\*\/\*)|(?:[\w\!#\$%&'\*\+\-\.\^`\|~]+\/\*)|(?:[\w\!#\$%&'\*\+\-\.\^`\|~]+\/[\w\!#\$%&'\*\+\-\.\^`\|~]+)$/;


internals.parse = function (raw, preferences) {

    // Normalize header (remove spaces and temporary remove quoted strings)

    const { header, quoted } = internals.normalize(raw);

    // Parse selections

    const parts = header.split(',');
    const selections = [];
    const map = {};

    for (let i = 0; i < parts.length; ++i) {
        const part = parts[i];
        if (!part) {                                    // Ignore empty parts or leading commas
            continue;
        }

        // Parse parameters

        const pairs = part.split(';');
        const token = pairs.shift().toLowerCase();

        if (!internals.validMediaRx.test(token)) {       // Ignore invalid types
            continue;
        }

        const selection = {
            token,
            params: {},
            exts: {},
            pos: i
        };

        // Parse key=value

        let target = 'params';
        for (const pair of pairs) {
            const kv = pair.split('=');
            if (kv.length !== 2 ||
                !kv[1]) {

                throw lib$1.badRequest(`Invalid accept header`);
            }

            const key = kv[0];
            let value = kv[1];

            if (key === 'q' ||
                key === 'Q') {

                target = 'exts';

                value = parseFloat(value);
                if (!Number.isFinite(value) ||
                    value > 1 ||
                    (value < 0.001 && value !== 0)) {

                    value = 1;
                }

                selection.q = value;
            }
            else {
                if (value[0] === '"') {
                    value = `"${quoted[value]}"`;
                }

                selection[target][kv[0]] = value;
            }
        }

        const params = Object.keys(selection.params);
        selection.original = [''].concat(params.map((key) => `${key}=${selection.params[key]}`)).join(';');
        selection.specificity = params.length;

        if (selection.q === undefined) {     // Default no preference to q=1 (top preference)
            selection.q = 1;
        }

        const tparts = selection.token.split('/');
        selection.type = tparts[0];
        selection.subtype = tparts[1];

        map[selection.token] = selection;

        if (selection.q) {                   // Skip denied selections (q=0)
            selections.push(selection);
        }
    }

    // Sort selection based on q and then position in header

    selections.sort(internals.sort);

    return internals.preferences(map, selections, preferences);
};


internals.normalize = function (raw) {

    raw = raw || '*/*';

    const normalized = {
        header: raw,
        quoted: {}
    };

    if (raw.includes('"')) {
        let i = 0;
        normalized.header = raw.replace(/="([^"]*)"/g, ($0, $1) => {

            const key = '"' + ++i;
            normalized.quoted[key] = $1;
            return '=' + key;
        });
    }

    normalized.header = normalized.header.replace(/[ \t]/g, '');
    return normalized;
};


internals.sort = function (a, b) {

    // Sort by quality score

    if (b.q !== a.q) {
        return b.q - a.q;
    }

    // Sort by type

    if (a.type !== b.type) {
        return internals.innerSort(a, b, 'type');
    }

    // Sort by subtype

    if (a.subtype !== b.subtype) {
        return internals.innerSort(a, b, 'subtype');
    }

    // Sort by specificity

    if (a.specificity !== b.specificity) {
        return b.specificity - a.specificity;
    }

    return a.pos - b.pos;
};


internals.innerSort = function (a, b, key) {

    const aFirst = -1;
    const bFirst = 1;

    if (a[key] === '*') {
        return bFirst;
    }

    if (b[key] === '*') {
        return aFirst;
    }

    return a[key] < b[key] ? aFirst : bFirst;       // Group alphabetically
};


internals.preferences = function (map, selections, preferences) {

    // Return selections if no preferences

    if (!preferences ||
        !preferences.length) {

        return selections.map((selection) => selection.token + selection.original);
    }

    // Map wildcards and filter selections to preferences

    const lowers = Object.create(null);
    const flat = Object.create(null);
    let any = false;

    for (const preference of preferences) {
        const lower = preference.toLowerCase();
        flat[lower] = preference;
        const parts = lower.split('/');
        const type = parts[0];
        const subtype = parts[1];

        if (type === '*') {
            lib.assert(subtype === '*', 'Invalid media type preference contains wildcard type with a subtype');
            any = true;
            continue;
        }

        lowers[type] = lowers[type] || Object.create(null);
        lowers[type][subtype] = preference;
    }

    const preferred = [];
    for (const selection of selections) {
        const token = selection.token;
        const { type, subtype } = map[token];
        const subtypes = lowers[type];

        // */*

        if (type === '*') {
            for (const preference of Object.keys(flat)) {
                if (!map[preference]) {
                    preferred.push(flat[preference]);
                }
            }

            if (any) {
                preferred.push('*/*');
            }

            continue;
        }

        // any

        if (any) {
            preferred.push((flat[token] || token) + selection.original);
            continue;
        }

        // type/subtype

        if (subtype !== '*') {
            const pref = flat[token];
            if (pref ||
                (subtypes && subtypes['*'])) {

                preferred.push((pref || token) + selection.original);
            }

            continue;
        }

        // type/*

        if (subtypes) {
            for (const psub of Object.keys(subtypes)) {
                if (!map[`${type}/${psub}`]) {
                    preferred.push(subtypes[psub]);
                }
            }
        }
    }

    return preferred;
};
});

var lib$2 = createCommonjsModule(function (module, exports) {





const internals = {
    options: {
        charset: {
            type: 'accept-charset'
        },
        encoding: {
            type: 'accept-encoding',
            default: 'identity',
            equivalents: new Map([
                ['x-compress', 'compress'],
                ['x-gzip', 'gzip']
            ])
        },
        language: {
            type: 'accept-language',
            specificity: true
        }
    }
};


for (const type in internals.options) {
    exports[type] = (header$1, preferences) => header.selection(header$1, preferences, internals.options[type]);

    exports[`${type}s`] = (header$1, preferences) => header.selections(header$1, preferences, internals.options[type]);
}


exports.mediaType = (header, preferences) => media.selection(header, preferences);

exports.mediaTypes = (header, preferences) => media.selections(header, preferences);


exports.parseAll = function (requestHeaders) {

    return {
        charsets: exports.charsets(requestHeaders['accept-charset']),
        encodings: exports.encodings(requestHeaders['accept-encoding']),
        languages: exports.languages(requestHeaders['accept-language']),
        mediaTypes: exports.mediaTypes(requestHeaders.accept)
    };
};
});

/*!
 * depd
 * Copyright(c) 2014 Douglas Christopher Wilson
 * MIT Licensed
 */

/**
 * Module exports.
 */

var callsiteTostring = callSiteToString;

/**
 * Format a CallSite file location to a string.
 */

function callSiteFileLocation (callSite) {
  var fileName;
  var fileLocation = '';

  if (callSite.isNative()) {
    fileLocation = 'native';
  } else if (callSite.isEval()) {
    fileName = callSite.getScriptNameOrSourceURL();
    if (!fileName) {
      fileLocation = callSite.getEvalOrigin();
    }
  } else {
    fileName = callSite.getFileName();
  }

  if (fileName) {
    fileLocation += fileName;

    var lineNumber = callSite.getLineNumber();
    if (lineNumber != null) {
      fileLocation += ':' + lineNumber;

      var columnNumber = callSite.getColumnNumber();
      if (columnNumber) {
        fileLocation += ':' + columnNumber;
      }
    }
  }

  return fileLocation || 'unknown source'
}

/**
 * Format a CallSite to a string.
 */

function callSiteToString (callSite) {
  var addSuffix = true;
  var fileLocation = callSiteFileLocation(callSite);
  var functionName = callSite.getFunctionName();
  var isConstructor = callSite.isConstructor();
  var isMethodCall = !(callSite.isToplevel() || isConstructor);
  var line = '';

  if (isMethodCall) {
    var methodName = callSite.getMethodName();
    var typeName = getConstructorName(callSite);

    if (functionName) {
      if (typeName && functionName.indexOf(typeName) !== 0) {
        line += typeName + '.';
      }

      line += functionName;

      if (methodName && functionName.lastIndexOf('.' + methodName) !== functionName.length - methodName.length - 1) {
        line += ' [as ' + methodName + ']';
      }
    } else {
      line += typeName + '.' + (methodName || '<anonymous>');
    }
  } else if (isConstructor) {
    line += 'new ' + (functionName || '<anonymous>');
  } else if (functionName) {
    line += functionName;
  } else {
    addSuffix = false;
    line += fileLocation;
  }

  if (addSuffix) {
    line += ' (' + fileLocation + ')';
  }

  return line
}

/**
 * Get constructor name of reviver.
 */

function getConstructorName (obj) {
  var receiver = obj.receiver;
  return (receiver.constructor && receiver.constructor.name) || null
}

/*!
 * depd
 * Copyright(c) 2015 Douglas Christopher Wilson
 * MIT Licensed
 */

/**
 * Module exports.
 * @public
 */

var eventListenerCount_1 = eventListenerCount;

/**
 * Get the count of listeners on an event emitter of a specific type.
 */

function eventListenerCount (emitter, type) {
  return emitter.listeners(type).length
}

var compat = createCommonjsModule(function (module) {

/**
 * Module dependencies.
 * @private
 */

var EventEmitter = require$$0__default['default'].EventEmitter;

/**
 * Module exports.
 * @public
 */

lazyProperty(module.exports, 'callSiteToString', function callSiteToString () {
  var limit = Error.stackTraceLimit;
  var obj = {};
  var prep = Error.prepareStackTrace;

  function prepareObjectStackTrace (obj, stack) {
    return stack
  }

  Error.prepareStackTrace = prepareObjectStackTrace;
  Error.stackTraceLimit = 2;

  // capture the stack
  Error.captureStackTrace(obj);

  // slice the stack
  var stack = obj.stack.slice();

  Error.prepareStackTrace = prep;
  Error.stackTraceLimit = limit;

  return stack[0].toString ? toString : callsiteTostring
});

lazyProperty(module.exports, 'eventListenerCount', function eventListenerCount () {
  return EventEmitter.listenerCount || eventListenerCount_1
});

/**
 * Define a lazy property.
 */

function lazyProperty (obj, prop, getter) {
  function get () {
    var val = getter();

    Object.defineProperty(obj, prop, {
      configurable: true,
      enumerable: true,
      value: val
    });

    return val
  }

  Object.defineProperty(obj, prop, {
    configurable: true,
    enumerable: true,
    get: get
  });
}

/**
 * Call toString() on the obj
 */

function toString (obj) {
  return obj.toString()
}
});

/*!
 * depd
 * Copyright(c) 2014-2017 Douglas Christopher Wilson
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

var callSiteToString$1 = compat.callSiteToString;
var eventListenerCount$1 = compat.eventListenerCount;
var relative = require$$1__default['default'].relative;

/**
 * Module exports.
 */

var depd_1 = depd;

/**
 * Get the path to base files on.
 */

var basePath = process.cwd();

/**
 * Determine if namespace is contained in the string.
 */

function containsNamespace (str, namespace) {
  var vals = str.split(/[ ,]+/);
  var ns = String(namespace).toLowerCase();

  for (var i = 0; i < vals.length; i++) {
    var val = vals[i];

    // namespace contained
    if (val && (val === '*' || val.toLowerCase() === ns)) {
      return true
    }
  }

  return false
}

/**
 * Convert a data descriptor to accessor descriptor.
 */

function convertDataDescriptorToAccessor (obj, prop, message) {
  var descriptor = Object.getOwnPropertyDescriptor(obj, prop);
  var value = descriptor.value;

  descriptor.get = function getter () { return value };

  if (descriptor.writable) {
    descriptor.set = function setter (val) { return (value = val) };
  }

  delete descriptor.value;
  delete descriptor.writable;

  Object.defineProperty(obj, prop, descriptor);

  return descriptor
}

/**
 * Create arguments string to keep arity.
 */

function createArgumentsString (arity) {
  var str = '';

  for (var i = 0; i < arity; i++) {
    str += ', arg' + i;
  }

  return str.substr(2)
}

/**
 * Create stack string from stack.
 */

function createStackString (stack) {
  var str = this.name + ': ' + this.namespace;

  if (this.message) {
    str += ' deprecated ' + this.message;
  }

  for (var i = 0; i < stack.length; i++) {
    str += '\n    at ' + callSiteToString$1(stack[i]);
  }

  return str
}

/**
 * Create deprecate for namespace in caller.
 */

function depd (namespace) {
  if (!namespace) {
    throw new TypeError('argument namespace is required')
  }

  var stack = getStack();
  var site = callSiteLocation(stack[1]);
  var file = site[0];

  function deprecate (message) {
    // call to self as log
    log.call(deprecate, message);
  }

  deprecate._file = file;
  deprecate._ignored = isignored(namespace);
  deprecate._namespace = namespace;
  deprecate._traced = istraced(namespace);
  deprecate._warned = Object.create(null);

  deprecate.function = wrapfunction;
  deprecate.property = wrapproperty;

  return deprecate
}

/**
 * Determine if namespace is ignored.
 */

function isignored (namespace) {
  /* istanbul ignore next: tested in a child processs */
  if (process.noDeprecation) {
    // --no-deprecation support
    return true
  }

  var str = process.env.NO_DEPRECATION || '';

  // namespace ignored
  return containsNamespace(str, namespace)
}

/**
 * Determine if namespace is traced.
 */

function istraced (namespace) {
  /* istanbul ignore next: tested in a child processs */
  if (process.traceDeprecation) {
    // --trace-deprecation support
    return true
  }

  var str = process.env.TRACE_DEPRECATION || '';

  // namespace traced
  return containsNamespace(str, namespace)
}

/**
 * Display deprecation message.
 */

function log (message, site) {
  var haslisteners = eventListenerCount$1(process, 'deprecation') !== 0;

  // abort early if no destination
  if (!haslisteners && this._ignored) {
    return
  }

  var caller;
  var callFile;
  var callSite;
  var depSite;
  var i = 0;
  var seen = false;
  var stack = getStack();
  var file = this._file;

  if (site) {
    // provided site
    depSite = site;
    callSite = callSiteLocation(stack[1]);
    callSite.name = depSite.name;
    file = callSite[0];
  } else {
    // get call site
    i = 2;
    depSite = callSiteLocation(stack[i]);
    callSite = depSite;
  }

  // get caller of deprecated thing in relation to file
  for (; i < stack.length; i++) {
    caller = callSiteLocation(stack[i]);
    callFile = caller[0];

    if (callFile === file) {
      seen = true;
    } else if (callFile === this._file) {
      file = this._file;
    } else if (seen) {
      break
    }
  }

  var key = caller
    ? depSite.join(':') + '__' + caller.join(':')
    : undefined;

  if (key !== undefined && key in this._warned) {
    // already warned
    return
  }

  this._warned[key] = true;

  // generate automatic message from call site
  var msg = message;
  if (!msg) {
    msg = callSite === depSite || !callSite.name
      ? defaultMessage(depSite)
      : defaultMessage(callSite);
  }

  // emit deprecation if listeners exist
  if (haslisteners) {
    var err = DeprecationError(this._namespace, msg, stack.slice(i));
    process.emit('deprecation', err);
    return
  }

  // format and write message
  var format = process.stderr.isTTY
    ? formatColor
    : formatPlain;
  var output = format.call(this, msg, caller, stack.slice(i));
  process.stderr.write(output + '\n', 'utf8');
}

/**
 * Get call site location as array.
 */

function callSiteLocation (callSite) {
  var file = callSite.getFileName() || '<anonymous>';
  var line = callSite.getLineNumber();
  var colm = callSite.getColumnNumber();

  if (callSite.isEval()) {
    file = callSite.getEvalOrigin() + ', ' + file;
  }

  var site = [file, line, colm];

  site.callSite = callSite;
  site.name = callSite.getFunctionName();

  return site
}

/**
 * Generate a default message from the site.
 */

function defaultMessage (site) {
  var callSite = site.callSite;
  var funcName = site.name;

  // make useful anonymous name
  if (!funcName) {
    funcName = '<anonymous@' + formatLocation(site) + '>';
  }

  var context = callSite.getThis();
  var typeName = context && callSite.getTypeName();

  // ignore useless type name
  if (typeName === 'Object') {
    typeName = undefined;
  }

  // make useful type name
  if (typeName === 'Function') {
    typeName = context.name || typeName;
  }

  return typeName && callSite.getMethodName()
    ? typeName + '.' + funcName
    : funcName
}

/**
 * Format deprecation message without color.
 */

function formatPlain (msg, caller, stack) {
  var timestamp = new Date().toUTCString();

  var formatted = timestamp +
    ' ' + this._namespace +
    ' deprecated ' + msg;

  // add stack trace
  if (this._traced) {
    for (var i = 0; i < stack.length; i++) {
      formatted += '\n    at ' + callSiteToString$1(stack[i]);
    }

    return formatted
  }

  if (caller) {
    formatted += ' at ' + formatLocation(caller);
  }

  return formatted
}

/**
 * Format deprecation message with color.
 */

function formatColor (msg, caller, stack) {
  var formatted = '\x1b[36;1m' + this._namespace + '\x1b[22;39m' + // bold cyan
    ' \x1b[33;1mdeprecated\x1b[22;39m' + // bold yellow
    ' \x1b[0m' + msg + '\x1b[39m'; // reset

  // add stack trace
  if (this._traced) {
    for (var i = 0; i < stack.length; i++) {
      formatted += '\n    \x1b[36mat ' + callSiteToString$1(stack[i]) + '\x1b[39m'; // cyan
    }

    return formatted
  }

  if (caller) {
    formatted += ' \x1b[36m' + formatLocation(caller) + '\x1b[39m'; // cyan
  }

  return formatted
}

/**
 * Format call site location.
 */

function formatLocation (callSite) {
  return relative(basePath, callSite[0]) +
    ':' + callSite[1] +
    ':' + callSite[2]
}

/**
 * Get the stack as array of call sites.
 */

function getStack () {
  var limit = Error.stackTraceLimit;
  var obj = {};
  var prep = Error.prepareStackTrace;

  Error.prepareStackTrace = prepareObjectStackTrace;
  Error.stackTraceLimit = Math.max(10, limit);

  // capture the stack
  Error.captureStackTrace(obj);

  // slice this function off the top
  var stack = obj.stack.slice(1);

  Error.prepareStackTrace = prep;
  Error.stackTraceLimit = limit;

  return stack
}

/**
 * Capture call site stack from v8.
 */

function prepareObjectStackTrace (obj, stack) {
  return stack
}

/**
 * Return a wrapped function in a deprecation message.
 */

function wrapfunction (fn, message) {
  if (typeof fn !== 'function') {
    throw new TypeError('argument fn must be a function')
  }

  var args = createArgumentsString(fn.length);
  var stack = getStack();
  var site = callSiteLocation(stack[1]);

  site.name = fn.name;

   // eslint-disable-next-line no-eval
  var deprecatedfn = eval('(function (' + args + ') {\n' +
    '"use strict"\n' +
    'log.call(deprecate, message, site)\n' +
    'return fn.apply(this, arguments)\n' +
    '})');

  return deprecatedfn
}

/**
 * Wrap property in a deprecation message.
 */

function wrapproperty (obj, prop, message) {
  if (!obj || (typeof obj !== 'object' && typeof obj !== 'function')) {
    throw new TypeError('argument obj must be object')
  }

  var descriptor = Object.getOwnPropertyDescriptor(obj, prop);

  if (!descriptor) {
    throw new TypeError('must call property on owner object')
  }

  if (!descriptor.configurable) {
    throw new TypeError('property must be configurable')
  }

  var deprecate = this;
  var stack = getStack();
  var site = callSiteLocation(stack[1]);

  // set site name
  site.name = prop;

  // convert data descriptor
  if ('value' in descriptor) {
    descriptor = convertDataDescriptorToAccessor(obj, prop);
  }

  var get = descriptor.get;
  var set = descriptor.set;

  // wrap getter
  if (typeof get === 'function') {
    descriptor.get = function getter () {
      log.call(deprecate, message, site);
      return get.apply(this, arguments)
    };
  }

  // wrap setter
  if (typeof set === 'function') {
    descriptor.set = function setter () {
      log.call(deprecate, message, site);
      return set.apply(this, arguments)
    };
  }

  Object.defineProperty(obj, prop, descriptor);
}

/**
 * Create DeprecationError for deprecation
 */

function DeprecationError (namespace, message, stack) {
  var error = new Error();
  var stackString;

  Object.defineProperty(error, 'constructor', {
    value: DeprecationError
  });

  Object.defineProperty(error, 'message', {
    configurable: true,
    enumerable: false,
    value: message,
    writable: true
  });

  Object.defineProperty(error, 'name', {
    enumerable: false,
    configurable: true,
    value: 'DeprecationError',
    writable: true
  });

  Object.defineProperty(error, 'namespace', {
    configurable: true,
    enumerable: false,
    value: namespace,
    writable: true
  });

  Object.defineProperty(error, 'stack', {
    configurable: true,
    enumerable: false,
    get: function () {
      if (stackString !== undefined) {
        return stackString
      }

      // prepare stack trace
      return (stackString = createStackString.call(this, stack))
    },
    set: function setter (val) {
      stackString = val;
    }
  });

  return error
}

/* eslint no-proto: 0 */
var setprototypeof = Object.setPrototypeOf || ({ __proto__: [] } instanceof Array ? setProtoOf : mixinProperties);

function setProtoOf (obj, proto) {
  obj.__proto__ = proto;
  return obj
}

function mixinProperties (obj, proto) {
  for (var prop in proto) {
    if (!obj.hasOwnProperty(prop)) {
      obj[prop] = proto[prop];
    }
  }
  return obj
}

var codes = {
	"100": "Continue",
	"101": "Switching Protocols",
	"102": "Processing",
	"103": "Early Hints",
	"200": "OK",
	"201": "Created",
	"202": "Accepted",
	"203": "Non-Authoritative Information",
	"204": "No Content",
	"205": "Reset Content",
	"206": "Partial Content",
	"207": "Multi-Status",
	"208": "Already Reported",
	"226": "IM Used",
	"300": "Multiple Choices",
	"301": "Moved Permanently",
	"302": "Found",
	"303": "See Other",
	"304": "Not Modified",
	"305": "Use Proxy",
	"306": "(Unused)",
	"307": "Temporary Redirect",
	"308": "Permanent Redirect",
	"400": "Bad Request",
	"401": "Unauthorized",
	"402": "Payment Required",
	"403": "Forbidden",
	"404": "Not Found",
	"405": "Method Not Allowed",
	"406": "Not Acceptable",
	"407": "Proxy Authentication Required",
	"408": "Request Timeout",
	"409": "Conflict",
	"410": "Gone",
	"411": "Length Required",
	"412": "Precondition Failed",
	"413": "Payload Too Large",
	"414": "URI Too Long",
	"415": "Unsupported Media Type",
	"416": "Range Not Satisfiable",
	"417": "Expectation Failed",
	"418": "I'm a teapot",
	"421": "Misdirected Request",
	"422": "Unprocessable Entity",
	"423": "Locked",
	"424": "Failed Dependency",
	"425": "Unordered Collection",
	"426": "Upgrade Required",
	"428": "Precondition Required",
	"429": "Too Many Requests",
	"431": "Request Header Fields Too Large",
	"451": "Unavailable For Legal Reasons",
	"500": "Internal Server Error",
	"501": "Not Implemented",
	"502": "Bad Gateway",
	"503": "Service Unavailable",
	"504": "Gateway Timeout",
	"505": "HTTP Version Not Supported",
	"506": "Variant Also Negotiates",
	"507": "Insufficient Storage",
	"508": "Loop Detected",
	"509": "Bandwidth Limit Exceeded",
	"510": "Not Extended",
	"511": "Network Authentication Required"
};

/**
 * Module dependencies.
 * @private
 */



/**
 * Module exports.
 * @public
 */

var statuses = status;

// status code to message map
status.STATUS_CODES = codes;

// array of status codes
status.codes = populateStatusesMap(status, codes);

// status codes for redirects
status.redirect = {
  300: true,
  301: true,
  302: true,
  303: true,
  305: true,
  307: true,
  308: true
};

// status codes for empty bodies
status.empty = {
  204: true,
  205: true,
  304: true
};

// status codes for when you should retry the request
status.retry = {
  502: true,
  503: true,
  504: true
};

/**
 * Populate the statuses map for given codes.
 * @private
 */

function populateStatusesMap (statuses, codes) {
  var arr = [];

  Object.keys(codes).forEach(function forEachCode (code) {
    var message = codes[code];
    var status = Number(code);

    // Populate properties
    statuses[status] = message;
    statuses[message] = status;
    statuses[message.toLowerCase()] = status;

    // Add to array
    arr.push(status);
  });

  return arr
}

/**
 * Get the status code.
 *
 * Given a number, this will throw if it is not a known status
 * code, otherwise the code will be returned. Given a string,
 * the string will be parsed for a number and return the code
 * if valid, otherwise will lookup the code assuming this is
 * the status message.
 *
 * @param {string|number} code
 * @returns {number}
 * @public
 */

function status (code) {
  if (typeof code === 'number') {
    if (!status[code]) throw new Error('invalid status code: ' + code)
    return code
  }

  if (typeof code !== 'string') {
    throw new TypeError('code must be a number or string')
  }

  // '403'
  var n = parseInt(code, 10);
  if (!isNaN(n)) {
    if (!status[n]) throw new Error('invalid status code: ' + n)
    return n
  }

  n = status[code.toLowerCase()];
  if (!n) throw new Error('invalid status message: "' + code + '"')
  return n
}

var inherits_browser = createCommonjsModule(function (module) {
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    if (superCtor) {
      ctor.super_ = superCtor;
      ctor.prototype = Object.create(superCtor.prototype, {
        constructor: {
          value: ctor,
          enumerable: false,
          writable: true,
          configurable: true
        }
      });
    }
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    if (superCtor) {
      ctor.super_ = superCtor;
      var TempCtor = function () {};
      TempCtor.prototype = superCtor.prototype;
      ctor.prototype = new TempCtor();
      ctor.prototype.constructor = ctor;
    }
  };
}
});

var inherits = createCommonjsModule(function (module) {
try {
  var util = util__default['default'];
  /* istanbul ignore next */
  if (typeof util.inherits !== 'function') throw '';
  module.exports = util.inherits;
} catch (e) {
  /* istanbul ignore next */
  module.exports = inherits_browser;
}
});

/*!
 * toidentifier
 * Copyright(c) 2016 Douglas Christopher Wilson
 * MIT Licensed
 */

/**
 * Module exports.
 * @public
 */

var toidentifier = toIdentifier;

/**
 * Trasform the given string into a JavaScript identifier
 *
 * @param {string} str
 * @returns {string}
 * @public
 */

function toIdentifier (str) {
  return str
    .split(' ')
    .map(function (token) {
      return token.slice(0, 1).toUpperCase() + token.slice(1)
    })
    .join('')
    .replace(/[^ _0-9a-z]/gi, '')
}

var httpErrors = createCommonjsModule(function (module) {

/**
 * Module dependencies.
 * @private
 */

var deprecate = depd_1('http-errors');





/**
 * Module exports.
 * @public
 */

module.exports = createError;
module.exports.HttpError = createHttpErrorConstructor();

// Populate exports for all constructors
populateConstructorExports(module.exports, statuses.codes, module.exports.HttpError);

/**
 * Get the code class of a status code.
 * @private
 */

function codeClass (status) {
  return Number(String(status).charAt(0) + '00')
}

/**
 * Create a new HTTP Error.
 *
 * @returns {Error}
 * @public
 */

function createError () {
  // so much arity going on ~_~
  var err;
  var msg;
  var status = 500;
  var props = {};
  for (var i = 0; i < arguments.length; i++) {
    var arg = arguments[i];
    if (arg instanceof Error) {
      err = arg;
      status = err.status || err.statusCode || status;
      continue
    }
    switch (typeof arg) {
      case 'string':
        msg = arg;
        break
      case 'number':
        status = arg;
        if (i !== 0) {
          deprecate('non-first-argument status code; replace with createError(' + arg + ', ...)');
        }
        break
      case 'object':
        props = arg;
        break
    }
  }

  if (typeof status === 'number' && (status < 400 || status >= 600)) {
    deprecate('non-error status code; use only 4xx or 5xx status codes');
  }

  if (typeof status !== 'number' ||
    (!statuses[status] && (status < 400 || status >= 600))) {
    status = 500;
  }

  // constructor
  var HttpError = createError[status] || createError[codeClass(status)];

  if (!err) {
    // create error
    err = HttpError
      ? new HttpError(msg)
      : new Error(msg || statuses[status]);
    Error.captureStackTrace(err, createError);
  }

  if (!HttpError || !(err instanceof HttpError) || err.status !== status) {
    // add properties to generic error
    err.expose = status < 500;
    err.status = err.statusCode = status;
  }

  for (var key in props) {
    if (key !== 'status' && key !== 'statusCode') {
      err[key] = props[key];
    }
  }

  return err
}

/**
 * Create HTTP error abstract base class.
 * @private
 */

function createHttpErrorConstructor () {
  function HttpError () {
    throw new TypeError('cannot construct abstract class')
  }

  inherits(HttpError, Error);

  return HttpError
}

/**
 * Create a constructor for a client error.
 * @private
 */

function createClientErrorConstructor (HttpError, name, code) {
  var className = name.match(/Error$/) ? name : name + 'Error';

  function ClientError (message) {
    // create the error object
    var msg = message != null ? message : statuses[code];
    var err = new Error(msg);

    // capture a stack trace to the construction point
    Error.captureStackTrace(err, ClientError);

    // adjust the [[Prototype]]
    setprototypeof(err, ClientError.prototype);

    // redefine the error message
    Object.defineProperty(err, 'message', {
      enumerable: true,
      configurable: true,
      value: msg,
      writable: true
    });

    // redefine the error name
    Object.defineProperty(err, 'name', {
      enumerable: false,
      configurable: true,
      value: className,
      writable: true
    });

    return err
  }

  inherits(ClientError, HttpError);
  nameFunc(ClientError, className);

  ClientError.prototype.status = code;
  ClientError.prototype.statusCode = code;
  ClientError.prototype.expose = true;

  return ClientError
}

/**
 * Create a constructor for a server error.
 * @private
 */

function createServerErrorConstructor (HttpError, name, code) {
  var className = name.match(/Error$/) ? name : name + 'Error';

  function ServerError (message) {
    // create the error object
    var msg = message != null ? message : statuses[code];
    var err = new Error(msg);

    // capture a stack trace to the construction point
    Error.captureStackTrace(err, ServerError);

    // adjust the [[Prototype]]
    setprototypeof(err, ServerError.prototype);

    // redefine the error message
    Object.defineProperty(err, 'message', {
      enumerable: true,
      configurable: true,
      value: msg,
      writable: true
    });

    // redefine the error name
    Object.defineProperty(err, 'name', {
      enumerable: false,
      configurable: true,
      value: className,
      writable: true
    });

    return err
  }

  inherits(ServerError, HttpError);
  nameFunc(ServerError, className);

  ServerError.prototype.status = code;
  ServerError.prototype.statusCode = code;
  ServerError.prototype.expose = false;

  return ServerError
}

/**
 * Set the name of a function, if possible.
 * @private
 */

function nameFunc (func, name) {
  var desc = Object.getOwnPropertyDescriptor(func, 'name');

  if (desc && desc.configurable) {
    desc.value = name;
    Object.defineProperty(func, 'name', desc);
  }
}

/**
 * Populate the exports object with constructors for every error class.
 * @private
 */

function populateConstructorExports (exports, codes, HttpError) {
  codes.forEach(function forEachCode (code) {
    var CodeError;
    var name = toidentifier(statuses[code]);

    switch (codeClass(code)) {
      case 400:
        CodeError = createClientErrorConstructor(HttpError, name, code);
        break
      case 500:
        CodeError = createServerErrorConstructor(HttpError, name, code);
        break
    }

    if (CodeError) {
      // export the constructor
      exports[code] = CodeError;
      exports[name] = CodeError;
    }
  });

  // backwards-compatibility
  exports["I'mateapot"] = deprecate.function(exports.ImATeapot,
    '"I\'mateapot"; use "ImATeapot" instead');
}
});

/**
 * Helpers.
 */

var s = 1000;
var m = s * 60;
var h = m * 60;
var d = h * 24;
var y = d * 365.25;

/**
 * Parse or format the given `val`.
 *
 * Options:
 *
 *  - `long` verbose formatting [false]
 *
 * @param {String|Number} val
 * @param {Object} [options]
 * @throws {Error} throw an error if val is not a non-empty string or a number
 * @return {String|Number}
 * @api public
 */

var ms = function(val, options) {
  options = options || {};
  var type = typeof val;
  if (type === 'string' && val.length > 0) {
    return parse$1(val);
  } else if (type === 'number' && isNaN(val) === false) {
    return options.long ? fmtLong(val) : fmtShort(val);
  }
  throw new Error(
    'val is not a non-empty string or a valid number. val=' +
      JSON.stringify(val)
  );
};

/**
 * Parse the given `str` and return milliseconds.
 *
 * @param {String} str
 * @return {Number}
 * @api private
 */

function parse$1(str) {
  str = String(str);
  if (str.length > 100) {
    return;
  }
  var match = /^((?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|years?|yrs?|y)?$/i.exec(
    str
  );
  if (!match) {
    return;
  }
  var n = parseFloat(match[1]);
  var type = (match[2] || 'ms').toLowerCase();
  switch (type) {
    case 'years':
    case 'year':
    case 'yrs':
    case 'yr':
    case 'y':
      return n * y;
    case 'days':
    case 'day':
    case 'd':
      return n * d;
    case 'hours':
    case 'hour':
    case 'hrs':
    case 'hr':
    case 'h':
      return n * h;
    case 'minutes':
    case 'minute':
    case 'mins':
    case 'min':
    case 'm':
      return n * m;
    case 'seconds':
    case 'second':
    case 'secs':
    case 'sec':
    case 's':
      return n * s;
    case 'milliseconds':
    case 'millisecond':
    case 'msecs':
    case 'msec':
    case 'ms':
      return n;
    default:
      return undefined;
  }
}

/**
 * Short format for `ms`.
 *
 * @param {Number} ms
 * @return {String}
 * @api private
 */

function fmtShort(ms) {
  if (ms >= d) {
    return Math.round(ms / d) + 'd';
  }
  if (ms >= h) {
    return Math.round(ms / h) + 'h';
  }
  if (ms >= m) {
    return Math.round(ms / m) + 'm';
  }
  if (ms >= s) {
    return Math.round(ms / s) + 's';
  }
  return ms + 'ms';
}

/**
 * Long format for `ms`.
 *
 * @param {Number} ms
 * @return {String}
 * @api private
 */

function fmtLong(ms) {
  return plural(ms, d, 'day') ||
    plural(ms, h, 'hour') ||
    plural(ms, m, 'minute') ||
    plural(ms, s, 'second') ||
    ms + ' ms';
}

/**
 * Pluralization helper.
 */

function plural(ms, n, name) {
  if (ms < n) {
    return;
  }
  if (ms < n * 1.5) {
    return Math.floor(ms / n) + ' ' + name;
  }
  return Math.ceil(ms / n) + ' ' + name + 's';
}

var debug = createCommonjsModule(function (module, exports) {
/**
 * This is the common logic for both the Node.js and web browser
 * implementations of `debug()`.
 *
 * Expose `debug()` as the module.
 */

exports = module.exports = createDebug.debug = createDebug['default'] = createDebug;
exports.coerce = coerce;
exports.disable = disable;
exports.enable = enable;
exports.enabled = enabled;
exports.humanize = ms;

/**
 * The currently active debug mode names, and names to skip.
 */

exports.names = [];
exports.skips = [];

/**
 * Map of special "%n" handling functions, for the debug "format" argument.
 *
 * Valid key names are a single, lower or upper-case letter, i.e. "n" and "N".
 */

exports.formatters = {};

/**
 * Previous log timestamp.
 */

var prevTime;

/**
 * Select a color.
 * @param {String} namespace
 * @return {Number}
 * @api private
 */

function selectColor(namespace) {
  var hash = 0, i;

  for (i in namespace) {
    hash  = ((hash << 5) - hash) + namespace.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }

  return exports.colors[Math.abs(hash) % exports.colors.length];
}

/**
 * Create a debugger with the given `namespace`.
 *
 * @param {String} namespace
 * @return {Function}
 * @api public
 */

function createDebug(namespace) {

  function debug() {
    // disabled?
    if (!debug.enabled) return;

    var self = debug;

    // set `diff` timestamp
    var curr = +new Date();
    var ms = curr - (prevTime || curr);
    self.diff = ms;
    self.prev = prevTime;
    self.curr = curr;
    prevTime = curr;

    // turn the `arguments` into a proper Array
    var args = new Array(arguments.length);
    for (var i = 0; i < args.length; i++) {
      args[i] = arguments[i];
    }

    args[0] = exports.coerce(args[0]);

    if ('string' !== typeof args[0]) {
      // anything else let's inspect with %O
      args.unshift('%O');
    }

    // apply any `formatters` transformations
    var index = 0;
    args[0] = args[0].replace(/%([a-zA-Z%])/g, function(match, format) {
      // if we encounter an escaped % then don't increase the array index
      if (match === '%%') return match;
      index++;
      var formatter = exports.formatters[format];
      if ('function' === typeof formatter) {
        var val = args[index];
        match = formatter.call(self, val);

        // now we need to remove `args[index]` since it's inlined in the `format`
        args.splice(index, 1);
        index--;
      }
      return match;
    });

    // apply env-specific formatting (colors, etc.)
    exports.formatArgs.call(self, args);

    var logFn = debug.log || exports.log || console.log.bind(console);
    logFn.apply(self, args);
  }

  debug.namespace = namespace;
  debug.enabled = exports.enabled(namespace);
  debug.useColors = exports.useColors();
  debug.color = selectColor(namespace);

  // env-specific initialization logic for debug instances
  if ('function' === typeof exports.init) {
    exports.init(debug);
  }

  return debug;
}

/**
 * Enables a debug mode by namespaces. This can include modes
 * separated by a colon and wildcards.
 *
 * @param {String} namespaces
 * @api public
 */

function enable(namespaces) {
  exports.save(namespaces);

  exports.names = [];
  exports.skips = [];

  var split = (typeof namespaces === 'string' ? namespaces : '').split(/[\s,]+/);
  var len = split.length;

  for (var i = 0; i < len; i++) {
    if (!split[i]) continue; // ignore empty strings
    namespaces = split[i].replace(/\*/g, '.*?');
    if (namespaces[0] === '-') {
      exports.skips.push(new RegExp('^' + namespaces.substr(1) + '$'));
    } else {
      exports.names.push(new RegExp('^' + namespaces + '$'));
    }
  }
}

/**
 * Disable debug output.
 *
 * @api public
 */

function disable() {
  exports.enable('');
}

/**
 * Returns true if the given mode name is enabled, false otherwise.
 *
 * @param {String} name
 * @return {Boolean}
 * @api public
 */

function enabled(name) {
  var i, len;
  for (i = 0, len = exports.skips.length; i < len; i++) {
    if (exports.skips[i].test(name)) {
      return false;
    }
  }
  for (i = 0, len = exports.names.length; i < len; i++) {
    if (exports.names[i].test(name)) {
      return true;
    }
  }
  return false;
}

/**
 * Coerce `val`.
 *
 * @param {Mixed} val
 * @return {Mixed}
 * @api private
 */

function coerce(val) {
  if (val instanceof Error) return val.stack || val.message;
  return val;
}
});

var browser = createCommonjsModule(function (module, exports) {
/**
 * This is the web browser implementation of `debug()`.
 *
 * Expose `debug()` as the module.
 */

exports = module.exports = debug;
exports.log = log;
exports.formatArgs = formatArgs;
exports.save = save;
exports.load = load;
exports.useColors = useColors;
exports.storage = 'undefined' != typeof chrome
               && 'undefined' != typeof chrome.storage
                  ? chrome.storage.local
                  : localstorage();

/**
 * Colors.
 */

exports.colors = [
  'lightseagreen',
  'forestgreen',
  'goldenrod',
  'dodgerblue',
  'darkorchid',
  'crimson'
];

/**
 * Currently only WebKit-based Web Inspectors, Firefox >= v31,
 * and the Firebug extension (any Firefox version) are known
 * to support "%c" CSS customizations.
 *
 * TODO: add a `localStorage` variable to explicitly enable/disable colors
 */

function useColors() {
  // NB: In an Electron preload script, document will be defined but not fully
  // initialized. Since we know we're in Chrome, we'll just detect this case
  // explicitly
  if (typeof window !== 'undefined' && window.process && window.process.type === 'renderer') {
    return true;
  }

  // is webkit? http://stackoverflow.com/a/16459606/376773
  // document is undefined in react-native: https://github.com/facebook/react-native/pull/1632
  return (typeof document !== 'undefined' && document.documentElement && document.documentElement.style && document.documentElement.style.WebkitAppearance) ||
    // is firebug? http://stackoverflow.com/a/398120/376773
    (typeof window !== 'undefined' && window.console && (window.console.firebug || (window.console.exception && window.console.table))) ||
    // is firefox >= v31?
    // https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
    (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/) && parseInt(RegExp.$1, 10) >= 31) ||
    // double check webkit in userAgent just in case we are in a worker
    (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/));
}

/**
 * Map %j to `JSON.stringify()`, since no Web Inspectors do that by default.
 */

exports.formatters.j = function(v) {
  try {
    return JSON.stringify(v);
  } catch (err) {
    return '[UnexpectedJSONParseError]: ' + err.message;
  }
};


/**
 * Colorize log arguments if enabled.
 *
 * @api public
 */

function formatArgs(args) {
  var useColors = this.useColors;

  args[0] = (useColors ? '%c' : '')
    + this.namespace
    + (useColors ? ' %c' : ' ')
    + args[0]
    + (useColors ? '%c ' : ' ')
    + '+' + exports.humanize(this.diff);

  if (!useColors) return;

  var c = 'color: ' + this.color;
  args.splice(1, 0, c, 'color: inherit');

  // the final "%c" is somewhat tricky, because there could be other
  // arguments passed either before or after the %c, so we need to
  // figure out the correct index to insert the CSS into
  var index = 0;
  var lastC = 0;
  args[0].replace(/%[a-zA-Z%]/g, function(match) {
    if ('%%' === match) return;
    index++;
    if ('%c' === match) {
      // we only are interested in the *last* %c
      // (the user may have provided their own)
      lastC = index;
    }
  });

  args.splice(lastC, 0, c);
}

/**
 * Invokes `console.log()` when available.
 * No-op when `console.log` is not a "function".
 *
 * @api public
 */

function log() {
  // this hackery is required for IE8/9, where
  // the `console.log` function doesn't have 'apply'
  return 'object' === typeof console
    && console.log
    && Function.prototype.apply.call(console.log, console, arguments);
}

/**
 * Save `namespaces`.
 *
 * @param {String} namespaces
 * @api private
 */

function save(namespaces) {
  try {
    if (null == namespaces) {
      exports.storage.removeItem('debug');
    } else {
      exports.storage.debug = namespaces;
    }
  } catch(e) {}
}

/**
 * Load `namespaces`.
 *
 * @return {String} returns the previously persisted debug modes
 * @api private
 */

function load() {
  var r;
  try {
    r = exports.storage.debug;
  } catch(e) {}

  // If debug isn't set in LS, and we're in Electron, try to load $DEBUG
  if (!r && typeof process !== 'undefined' && 'env' in process) {
    r = process.env.DEBUG;
  }

  return r;
}

/**
 * Enable namespaces listed in `localStorage.debug` initially.
 */

exports.enable(load());

/**
 * Localstorage attempts to return the localstorage.
 *
 * This is necessary because safari throws
 * when a user disables cookies/localstorage
 * and you attempt to access it.
 *
 * @return {LocalStorage}
 * @api private
 */

function localstorage() {
  try {
    return window.localStorage;
  } catch (e) {}
}
});

var node = createCommonjsModule(function (module, exports) {
/**
 * Module dependencies.
 */




/**
 * This is the Node.js implementation of `debug()`.
 *
 * Expose `debug()` as the module.
 */

exports = module.exports = debug;
exports.init = init;
exports.log = log;
exports.formatArgs = formatArgs;
exports.save = save;
exports.load = load;
exports.useColors = useColors;

/**
 * Colors.
 */

exports.colors = [6, 2, 3, 4, 5, 1];

/**
 * Build up the default `inspectOpts` object from the environment variables.
 *
 *   $ DEBUG_COLORS=no DEBUG_DEPTH=10 DEBUG_SHOW_HIDDEN=enabled node script.js
 */

exports.inspectOpts = Object.keys(process.env).filter(function (key) {
  return /^debug_/i.test(key);
}).reduce(function (obj, key) {
  // camel-case
  var prop = key
    .substring(6)
    .toLowerCase()
    .replace(/_([a-z])/g, function (_, k) { return k.toUpperCase() });

  // coerce string value into JS value
  var val = process.env[key];
  if (/^(yes|on|true|enabled)$/i.test(val)) val = true;
  else if (/^(no|off|false|disabled)$/i.test(val)) val = false;
  else if (val === 'null') val = null;
  else val = Number(val);

  obj[prop] = val;
  return obj;
}, {});

/**
 * The file descriptor to write the `debug()` calls to.
 * Set the `DEBUG_FD` env variable to override with another value. i.e.:
 *
 *   $ DEBUG_FD=3 node script.js 3>debug.log
 */

var fd = parseInt(process.env.DEBUG_FD, 10) || 2;

if (1 !== fd && 2 !== fd) {
  util__default['default'].deprecate(function(){}, 'except for stderr(2) and stdout(1), any other usage of DEBUG_FD is deprecated. Override debug.log if you want to use a different log function (https://git.io/debug_fd)')();
}

var stream = 1 === fd ? process.stdout :
             2 === fd ? process.stderr :
             createWritableStdioStream(fd);

/**
 * Is stdout a TTY? Colored output is enabled when `true`.
 */

function useColors() {
  return 'colors' in exports.inspectOpts
    ? Boolean(exports.inspectOpts.colors)
    : tty__default['default'].isatty(fd);
}

/**
 * Map %o to `util.inspect()`, all on a single line.
 */

exports.formatters.o = function(v) {
  this.inspectOpts.colors = this.useColors;
  return util__default['default'].inspect(v, this.inspectOpts)
    .split('\n').map(function(str) {
      return str.trim()
    }).join(' ');
};

/**
 * Map %o to `util.inspect()`, allowing multiple lines if needed.
 */

exports.formatters.O = function(v) {
  this.inspectOpts.colors = this.useColors;
  return util__default['default'].inspect(v, this.inspectOpts);
};

/**
 * Adds ANSI color escape codes if enabled.
 *
 * @api public
 */

function formatArgs(args) {
  var name = this.namespace;
  var useColors = this.useColors;

  if (useColors) {
    var c = this.color;
    var prefix = '  \u001b[3' + c + ';1m' + name + ' ' + '\u001b[0m';

    args[0] = prefix + args[0].split('\n').join('\n' + prefix);
    args.push('\u001b[3' + c + 'm+' + exports.humanize(this.diff) + '\u001b[0m');
  } else {
    args[0] = new Date().toUTCString()
      + ' ' + name + ' ' + args[0];
  }
}

/**
 * Invokes `util.format()` with the specified arguments and writes to `stream`.
 */

function log() {
  return stream.write(util__default['default'].format.apply(util__default['default'], arguments) + '\n');
}

/**
 * Save `namespaces`.
 *
 * @param {String} namespaces
 * @api private
 */

function save(namespaces) {
  if (null == namespaces) {
    // If you set a process.env field to null or undefined, it gets cast to the
    // string 'null' or 'undefined'. Just delete instead.
    delete process.env.DEBUG;
  } else {
    process.env.DEBUG = namespaces;
  }
}

/**
 * Load `namespaces`.
 *
 * @return {String} returns the previously persisted debug modes
 * @api private
 */

function load() {
  return process.env.DEBUG;
}

/**
 * Copied from `node/src/node.js`.
 *
 * XXX: It's lame that node doesn't expose this API out-of-the-box. It also
 * relies on the undocumented `tty_wrap.guessHandleType()` which is also lame.
 */

function createWritableStdioStream (fd) {
  var stream;
  var tty_wrap = process.binding('tty_wrap');

  // Note stream._type is used for test-module-load-list.js

  switch (tty_wrap.guessHandleType(fd)) {
    case 'TTY':
      stream = new tty__default['default'].WriteStream(fd);
      stream._type = 'tty';

      // Hack to have stream not keep the event loop alive.
      // See https://github.com/joyent/node/issues/1726
      if (stream._handle && stream._handle.unref) {
        stream._handle.unref();
      }
      break;

    case 'FILE':
      var fs = fs__default['default'];
      stream = new fs.SyncWriteStream(fd, { autoClose: false });
      stream._type = 'fs';
      break;

    case 'PIPE':
    case 'TCP':
      var net = require$$2__default['default'];
      stream = new net.Socket({
        fd: fd,
        readable: false,
        writable: true
      });

      // FIXME Should probably have an option in net.Socket to create a
      // stream from an existing fd which is writable only. But for now
      // we'll just add this hack and set the `readable` member to false.
      // Test: ./node test/fixtures/echo.js < /etc/passwd
      stream.readable = false;
      stream.read = null;
      stream._type = 'pipe';

      // FIXME Hack to have stream not keep the event loop alive.
      // See https://github.com/joyent/node/issues/1726
      if (stream._handle && stream._handle.unref) {
        stream._handle.unref();
      }
      break;

    default:
      // Probably an error on in uv_guess_handle()
      throw new Error('Implement me. Unknown stream file type!');
  }

  // For supporting legacy API we put the FD here.
  stream.fd = fd;

  stream._isStdio = true;

  return stream;
}

/**
 * Init logic for `debug` instances.
 *
 * Create a new `inspectOpts` object in case `useColors` is set
 * differently for a particular `debug` instance.
 */

function init (debug) {
  debug.inspectOpts = {};

  var keys = Object.keys(exports.inspectOpts);
  for (var i = 0; i < keys.length; i++) {
    debug.inspectOpts[keys[i]] = exports.inspectOpts[keys[i]];
  }
}

/**
 * Enable namespaces listed in `process.env.DEBUG` initially.
 */

exports.enable(load());
});

var src = createCommonjsModule(function (module) {
/**
 * Detect Electron renderer process, which is node, but we should
 * treat as a browser.
 */

if (typeof process !== 'undefined' && process.type === 'renderer') {
  module.exports = browser;
} else {
  module.exports = node;
}
});

/**
 * Module dependencies.
 * @private
 */

var ReadStream = fs__default['default'].ReadStream;


/**
 * Module exports.
 * @public
 */

var destroy_1 = destroy;

/**
 * Destroy a stream.
 *
 * @param {object} stream
 * @public
 */

function destroy(stream) {
  if (stream instanceof ReadStream) {
    return destroyReadStream(stream)
  }

  if (!(stream instanceof Stream__default['default'])) {
    return stream
  }

  if (typeof stream.destroy === 'function') {
    stream.destroy();
  }

  return stream
}

/**
 * Destroy a ReadStream.
 *
 * @param {object} stream
 * @private
 */

function destroyReadStream(stream) {
  stream.destroy();

  if (typeof stream.close === 'function') {
    // node.js core bug work-around
    stream.on('open', onOpenClose);
  }

  return stream
}

/**
 * On open handler to close stream.
 * @private
 */

function onOpenClose() {
  if (typeof this.fd === 'number') {
    // actually close down the fd
    this.close();
  }
}

/*!
 * encodeurl
 * Copyright(c) 2016 Douglas Christopher Wilson
 * MIT Licensed
 */

/**
 * Module exports.
 * @public
 */

var encodeurl = encodeUrl;

/**
 * RegExp to match non-URL code points, *after* encoding (i.e. not including "%")
 * and including invalid escape sequences.
 * @private
 */

var ENCODE_CHARS_REGEXP = /(?:[^\x21\x25\x26-\x3B\x3D\x3F-\x5B\x5D\x5F\x61-\x7A\x7E]|%(?:[^0-9A-Fa-f]|[0-9A-Fa-f][^0-9A-Fa-f]|$))+/g;

/**
 * RegExp to match unmatched surrogate pair.
 * @private
 */

var UNMATCHED_SURROGATE_PAIR_REGEXP = /(^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]|[\uD800-\uDBFF]([^\uDC00-\uDFFF]|$)/g;

/**
 * String to replace unmatched surrogate pair with.
 * @private
 */

var UNMATCHED_SURROGATE_PAIR_REPLACE = '$1\uFFFD$2';

/**
 * Encode a URL to a percent-encoded form, excluding already-encoded sequences.
 *
 * This function will take an already-encoded URL and encode all the non-URL
 * code points. This function will not encode the "%" character unless it is
 * not part of a valid sequence (`%20` will be left as-is, but `%foo` will
 * be encoded as `%25foo`).
 *
 * This encode is meant to be "safe" and does not throw errors. It will try as
 * hard as it can to properly encode the given URL, including replacing any raw,
 * unpaired surrogate pairs with the Unicode replacement character prior to
 * encoding.
 *
 * @param {string} url
 * @return {string}
 * @public
 */

function encodeUrl (url) {
  return String(url)
    .replace(UNMATCHED_SURROGATE_PAIR_REGEXP, UNMATCHED_SURROGATE_PAIR_REPLACE)
    .replace(ENCODE_CHARS_REGEXP, encodeURI)
}

/*!
 * escape-html
 * Copyright(c) 2012-2013 TJ Holowaychuk
 * Copyright(c) 2015 Andreas Lubbe
 * Copyright(c) 2015 Tiancheng "Timothy" Gu
 * MIT Licensed
 */

/**
 * Module variables.
 * @private
 */

var matchHtmlRegExp = /["'&<>]/;

/**
 * Module exports.
 * @public
 */

var escapeHtml_1 = escapeHtml$1;

/**
 * Escape special characters in the given string of html.
 *
 * @param  {string} string The string to escape for inserting into HTML
 * @return {string}
 * @public
 */

function escapeHtml$1(string) {
  var str = '' + string;
  var match = matchHtmlRegExp.exec(str);

  if (!match) {
    return str;
  }

  var escape;
  var html = '';
  var index = 0;
  var lastIndex = 0;

  for (index = match.index; index < str.length; index++) {
    switch (str.charCodeAt(index)) {
      case 34: // "
        escape = '&quot;';
        break;
      case 38: // &
        escape = '&amp;';
        break;
      case 39: // '
        escape = '&#39;';
        break;
      case 60: // <
        escape = '&lt;';
        break;
      case 62: // >
        escape = '&gt;';
        break;
      default:
        continue;
    }

    if (lastIndex !== index) {
      html += str.substring(lastIndex, index);
    }

    lastIndex = index + 1;
    html += escape;
  }

  return lastIndex !== index
    ? html + str.substring(lastIndex, index)
    : html;
}

/**
 * Module exports.
 * @public
 */

var etag_1 = etag;

/**
 * Module dependencies.
 * @private
 */


var Stats = fs__default['default'].Stats;

/**
 * Module variables.
 * @private
 */

var toString = Object.prototype.toString;

/**
 * Generate an entity tag.
 *
 * @param {Buffer|string} entity
 * @return {string}
 * @private
 */

function entitytag (entity) {
  if (entity.length === 0) {
    // fast-path empty
    return '"0-2jmj7l5rSw0yVb/vlWAYkK/YBwk"'
  }

  // compute hash of entity
  var hash = crypto__default['default']
    .createHash('sha1')
    .update(entity, 'utf8')
    .digest('base64')
    .substring(0, 27);

  // compute length of entity
  var len = typeof entity === 'string'
    ? Buffer.byteLength(entity, 'utf8')
    : entity.length;

  return '"' + len.toString(16) + '-' + hash + '"'
}

/**
 * Create a simple ETag.
 *
 * @param {string|Buffer|Stats} entity
 * @param {object} [options]
 * @param {boolean} [options.weak]
 * @return {String}
 * @public
 */

function etag (entity, options) {
  if (entity == null) {
    throw new TypeError('argument entity is required')
  }

  // support fs.Stats object
  var isStats = isstats(entity);
  var weak = options && typeof options.weak === 'boolean'
    ? options.weak
    : isStats;

  // validate argument
  if (!isStats && typeof entity !== 'string' && !Buffer.isBuffer(entity)) {
    throw new TypeError('argument entity must be string, Buffer, or fs.Stats')
  }

  // generate entity tag
  var tag = isStats
    ? stattag(entity)
    : entitytag(entity);

  return weak
    ? 'W/' + tag
    : tag
}

/**
 * Determine if object is a Stats object.
 *
 * @param {object} obj
 * @return {boolean}
 * @api private
 */

function isstats (obj) {
  // genuine fs.Stats
  if (typeof Stats === 'function' && obj instanceof Stats) {
    return true
  }

  // quack quack
  return obj && typeof obj === 'object' &&
    'ctime' in obj && toString.call(obj.ctime) === '[object Date]' &&
    'mtime' in obj && toString.call(obj.mtime) === '[object Date]' &&
    'ino' in obj && typeof obj.ino === 'number' &&
    'size' in obj && typeof obj.size === 'number'
}

/**
 * Generate a tag for a stat.
 *
 * @param {object} stat
 * @return {string}
 * @private
 */

function stattag (stat) {
  var mtime = stat.mtime.getTime().toString(16);
  var size = stat.size.toString(16);

  return '"' + size + '-' + mtime + '"'
}

/*!
 * fresh
 * Copyright(c) 2012 TJ Holowaychuk
 * Copyright(c) 2016-2017 Douglas Christopher Wilson
 * MIT Licensed
 */

/**
 * RegExp to check for no-cache token in Cache-Control.
 * @private
 */

var CACHE_CONTROL_NO_CACHE_REGEXP = /(?:^|,)\s*?no-cache\s*?(?:,|$)/;

/**
 * Module exports.
 * @public
 */

var fresh_1 = fresh;

/**
 * Check freshness of the response using request and response headers.
 *
 * @param {Object} reqHeaders
 * @param {Object} resHeaders
 * @return {Boolean}
 * @public
 */

function fresh (reqHeaders, resHeaders) {
  // fields
  var modifiedSince = reqHeaders['if-modified-since'];
  var noneMatch = reqHeaders['if-none-match'];

  // unconditional request
  if (!modifiedSince && !noneMatch) {
    return false
  }

  // Always return stale when Cache-Control: no-cache
  // to support end-to-end reload requests
  // https://tools.ietf.org/html/rfc2616#section-14.9.4
  var cacheControl = reqHeaders['cache-control'];
  if (cacheControl && CACHE_CONTROL_NO_CACHE_REGEXP.test(cacheControl)) {
    return false
  }

  // if-none-match
  if (noneMatch && noneMatch !== '*') {
    var etag = resHeaders['etag'];

    if (!etag) {
      return false
    }

    var etagStale = true;
    var matches = parseTokenList(noneMatch);
    for (var i = 0; i < matches.length; i++) {
      var match = matches[i];
      if (match === etag || match === 'W/' + etag || 'W/' + match === etag) {
        etagStale = false;
        break
      }
    }

    if (etagStale) {
      return false
    }
  }

  // if-modified-since
  if (modifiedSince) {
    var lastModified = resHeaders['last-modified'];
    var modifiedStale = !lastModified || !(parseHttpDate(lastModified) <= parseHttpDate(modifiedSince));

    if (modifiedStale) {
      return false
    }
  }

  return true
}

/**
 * Parse an HTTP Date into a number.
 *
 * @param {string} date
 * @private
 */

function parseHttpDate (date) {
  var timestamp = date && Date.parse(date);

  // istanbul ignore next: guard against date.js Date.parse patching
  return typeof timestamp === 'number'
    ? timestamp
    : NaN
}

/**
 * Parse a HTTP token list.
 *
 * @param {string} str
 * @private
 */

function parseTokenList (str) {
  var end = 0;
  var list = [];
  var start = 0;

  // gather tokens
  for (var i = 0, len = str.length; i < len; i++) {
    switch (str.charCodeAt(i)) {
      case 0x20: /*   */
        if (start === end) {
          start = end = i + 1;
        }
        break
      case 0x2c: /* , */
        list.push(str.substring(start, end));
        start = end = i + 1;
        break
      default:
        end = i + 1;
        break
    }
  }

  // final token
  list.push(str.substring(start, end));

  return list
}

var require$$0 = {
	"application/andrew-inset": [
	"ez"
],
	"application/applixware": [
	"aw"
],
	"application/atom+xml": [
	"atom"
],
	"application/atomcat+xml": [
	"atomcat"
],
	"application/atomsvc+xml": [
	"atomsvc"
],
	"application/bdoc": [
	"bdoc"
],
	"application/ccxml+xml": [
	"ccxml"
],
	"application/cdmi-capability": [
	"cdmia"
],
	"application/cdmi-container": [
	"cdmic"
],
	"application/cdmi-domain": [
	"cdmid"
],
	"application/cdmi-object": [
	"cdmio"
],
	"application/cdmi-queue": [
	"cdmiq"
],
	"application/cu-seeme": [
	"cu"
],
	"application/dash+xml": [
	"mpd"
],
	"application/davmount+xml": [
	"davmount"
],
	"application/docbook+xml": [
	"dbk"
],
	"application/dssc+der": [
	"dssc"
],
	"application/dssc+xml": [
	"xdssc"
],
	"application/ecmascript": [
	"ecma"
],
	"application/emma+xml": [
	"emma"
],
	"application/epub+zip": [
	"epub"
],
	"application/exi": [
	"exi"
],
	"application/font-tdpfr": [
	"pfr"
],
	"application/font-woff": [
],
	"application/font-woff2": [
],
	"application/geo+json": [
	"geojson"
],
	"application/gml+xml": [
	"gml"
],
	"application/gpx+xml": [
	"gpx"
],
	"application/gxf": [
	"gxf"
],
	"application/gzip": [
	"gz"
],
	"application/hyperstudio": [
	"stk"
],
	"application/inkml+xml": [
	"ink",
	"inkml"
],
	"application/ipfix": [
	"ipfix"
],
	"application/java-archive": [
	"jar",
	"war",
	"ear"
],
	"application/java-serialized-object": [
	"ser"
],
	"application/java-vm": [
	"class"
],
	"application/javascript": [
	"js",
	"mjs"
],
	"application/json": [
	"json",
	"map"
],
	"application/json5": [
	"json5"
],
	"application/jsonml+json": [
	"jsonml"
],
	"application/ld+json": [
	"jsonld"
],
	"application/lost+xml": [
	"lostxml"
],
	"application/mac-binhex40": [
	"hqx"
],
	"application/mac-compactpro": [
	"cpt"
],
	"application/mads+xml": [
	"mads"
],
	"application/manifest+json": [
	"webmanifest"
],
	"application/marc": [
	"mrc"
],
	"application/marcxml+xml": [
	"mrcx"
],
	"application/mathematica": [
	"ma",
	"nb",
	"mb"
],
	"application/mathml+xml": [
	"mathml"
],
	"application/mbox": [
	"mbox"
],
	"application/mediaservercontrol+xml": [
	"mscml"
],
	"application/metalink+xml": [
	"metalink"
],
	"application/metalink4+xml": [
	"meta4"
],
	"application/mets+xml": [
	"mets"
],
	"application/mods+xml": [
	"mods"
],
	"application/mp21": [
	"m21",
	"mp21"
],
	"application/mp4": [
	"mp4s",
	"m4p"
],
	"application/msword": [
	"doc",
	"dot"
],
	"application/mxf": [
	"mxf"
],
	"application/octet-stream": [
	"bin",
	"dms",
	"lrf",
	"mar",
	"so",
	"dist",
	"distz",
	"pkg",
	"bpk",
	"dump",
	"elc",
	"deploy",
	"exe",
	"dll",
	"deb",
	"dmg",
	"iso",
	"img",
	"msi",
	"msp",
	"msm",
	"buffer"
],
	"application/oda": [
	"oda"
],
	"application/oebps-package+xml": [
	"opf"
],
	"application/ogg": [
	"ogx"
],
	"application/omdoc+xml": [
	"omdoc"
],
	"application/onenote": [
	"onetoc",
	"onetoc2",
	"onetmp",
	"onepkg"
],
	"application/oxps": [
	"oxps"
],
	"application/patch-ops-error+xml": [
	"xer"
],
	"application/pdf": [
	"pdf"
],
	"application/pgp-encrypted": [
	"pgp"
],
	"application/pgp-signature": [
	"asc",
	"sig"
],
	"application/pics-rules": [
	"prf"
],
	"application/pkcs10": [
	"p10"
],
	"application/pkcs7-mime": [
	"p7m",
	"p7c"
],
	"application/pkcs7-signature": [
	"p7s"
],
	"application/pkcs8": [
	"p8"
],
	"application/pkix-attr-cert": [
	"ac"
],
	"application/pkix-cert": [
	"cer"
],
	"application/pkix-crl": [
	"crl"
],
	"application/pkix-pkipath": [
	"pkipath"
],
	"application/pkixcmp": [
	"pki"
],
	"application/pls+xml": [
	"pls"
],
	"application/postscript": [
	"ai",
	"eps",
	"ps"
],
	"application/prs.cww": [
	"cww"
],
	"application/pskc+xml": [
	"pskcxml"
],
	"application/raml+yaml": [
	"raml"
],
	"application/rdf+xml": [
	"rdf"
],
	"application/reginfo+xml": [
	"rif"
],
	"application/relax-ng-compact-syntax": [
	"rnc"
],
	"application/resource-lists+xml": [
	"rl"
],
	"application/resource-lists-diff+xml": [
	"rld"
],
	"application/rls-services+xml": [
	"rs"
],
	"application/rpki-ghostbusters": [
	"gbr"
],
	"application/rpki-manifest": [
	"mft"
],
	"application/rpki-roa": [
	"roa"
],
	"application/rsd+xml": [
	"rsd"
],
	"application/rss+xml": [
	"rss"
],
	"application/rtf": [
	"rtf"
],
	"application/sbml+xml": [
	"sbml"
],
	"application/scvp-cv-request": [
	"scq"
],
	"application/scvp-cv-response": [
	"scs"
],
	"application/scvp-vp-request": [
	"spq"
],
	"application/scvp-vp-response": [
	"spp"
],
	"application/sdp": [
	"sdp"
],
	"application/set-payment-initiation": [
	"setpay"
],
	"application/set-registration-initiation": [
	"setreg"
],
	"application/shf+xml": [
	"shf"
],
	"application/smil+xml": [
	"smi",
	"smil"
],
	"application/sparql-query": [
	"rq"
],
	"application/sparql-results+xml": [
	"srx"
],
	"application/srgs": [
	"gram"
],
	"application/srgs+xml": [
	"grxml"
],
	"application/sru+xml": [
	"sru"
],
	"application/ssdl+xml": [
	"ssdl"
],
	"application/ssml+xml": [
	"ssml"
],
	"application/tei+xml": [
	"tei",
	"teicorpus"
],
	"application/thraud+xml": [
	"tfi"
],
	"application/timestamped-data": [
	"tsd"
],
	"application/vnd.3gpp.pic-bw-large": [
	"plb"
],
	"application/vnd.3gpp.pic-bw-small": [
	"psb"
],
	"application/vnd.3gpp.pic-bw-var": [
	"pvb"
],
	"application/vnd.3gpp2.tcap": [
	"tcap"
],
	"application/vnd.3m.post-it-notes": [
	"pwn"
],
	"application/vnd.accpac.simply.aso": [
	"aso"
],
	"application/vnd.accpac.simply.imp": [
	"imp"
],
	"application/vnd.acucobol": [
	"acu"
],
	"application/vnd.acucorp": [
	"atc",
	"acutc"
],
	"application/vnd.adobe.air-application-installer-package+zip": [
	"air"
],
	"application/vnd.adobe.formscentral.fcdt": [
	"fcdt"
],
	"application/vnd.adobe.fxp": [
	"fxp",
	"fxpl"
],
	"application/vnd.adobe.xdp+xml": [
	"xdp"
],
	"application/vnd.adobe.xfdf": [
	"xfdf"
],
	"application/vnd.ahead.space": [
	"ahead"
],
	"application/vnd.airzip.filesecure.azf": [
	"azf"
],
	"application/vnd.airzip.filesecure.azs": [
	"azs"
],
	"application/vnd.amazon.ebook": [
	"azw"
],
	"application/vnd.americandynamics.acc": [
	"acc"
],
	"application/vnd.amiga.ami": [
	"ami"
],
	"application/vnd.android.package-archive": [
	"apk"
],
	"application/vnd.anser-web-certificate-issue-initiation": [
	"cii"
],
	"application/vnd.anser-web-funds-transfer-initiation": [
	"fti"
],
	"application/vnd.antix.game-component": [
	"atx"
],
	"application/vnd.apple.installer+xml": [
	"mpkg"
],
	"application/vnd.apple.mpegurl": [
	"m3u8"
],
	"application/vnd.apple.pkpass": [
	"pkpass"
],
	"application/vnd.aristanetworks.swi": [
	"swi"
],
	"application/vnd.astraea-software.iota": [
	"iota"
],
	"application/vnd.audiograph": [
	"aep"
],
	"application/vnd.blueice.multipass": [
	"mpm"
],
	"application/vnd.bmi": [
	"bmi"
],
	"application/vnd.businessobjects": [
	"rep"
],
	"application/vnd.chemdraw+xml": [
	"cdxml"
],
	"application/vnd.chipnuts.karaoke-mmd": [
	"mmd"
],
	"application/vnd.cinderella": [
	"cdy"
],
	"application/vnd.claymore": [
	"cla"
],
	"application/vnd.cloanto.rp9": [
	"rp9"
],
	"application/vnd.clonk.c4group": [
	"c4g",
	"c4d",
	"c4f",
	"c4p",
	"c4u"
],
	"application/vnd.cluetrust.cartomobile-config": [
	"c11amc"
],
	"application/vnd.cluetrust.cartomobile-config-pkg": [
	"c11amz"
],
	"application/vnd.commonspace": [
	"csp"
],
	"application/vnd.contact.cmsg": [
	"cdbcmsg"
],
	"application/vnd.cosmocaller": [
	"cmc"
],
	"application/vnd.crick.clicker": [
	"clkx"
],
	"application/vnd.crick.clicker.keyboard": [
	"clkk"
],
	"application/vnd.crick.clicker.palette": [
	"clkp"
],
	"application/vnd.crick.clicker.template": [
	"clkt"
],
	"application/vnd.crick.clicker.wordbank": [
	"clkw"
],
	"application/vnd.criticaltools.wbs+xml": [
	"wbs"
],
	"application/vnd.ctc-posml": [
	"pml"
],
	"application/vnd.cups-ppd": [
	"ppd"
],
	"application/vnd.curl.car": [
	"car"
],
	"application/vnd.curl.pcurl": [
	"pcurl"
],
	"application/vnd.dart": [
	"dart"
],
	"application/vnd.data-vision.rdz": [
	"rdz"
],
	"application/vnd.dece.data": [
	"uvf",
	"uvvf",
	"uvd",
	"uvvd"
],
	"application/vnd.dece.ttml+xml": [
	"uvt",
	"uvvt"
],
	"application/vnd.dece.unspecified": [
	"uvx",
	"uvvx"
],
	"application/vnd.dece.zip": [
	"uvz",
	"uvvz"
],
	"application/vnd.denovo.fcselayout-link": [
	"fe_launch"
],
	"application/vnd.dna": [
	"dna"
],
	"application/vnd.dolby.mlp": [
	"mlp"
],
	"application/vnd.dpgraph": [
	"dpg"
],
	"application/vnd.dreamfactory": [
	"dfac"
],
	"application/vnd.ds-keypoint": [
	"kpxx"
],
	"application/vnd.dvb.ait": [
	"ait"
],
	"application/vnd.dvb.service": [
	"svc"
],
	"application/vnd.dynageo": [
	"geo"
],
	"application/vnd.ecowin.chart": [
	"mag"
],
	"application/vnd.enliven": [
	"nml"
],
	"application/vnd.epson.esf": [
	"esf"
],
	"application/vnd.epson.msf": [
	"msf"
],
	"application/vnd.epson.quickanime": [
	"qam"
],
	"application/vnd.epson.salt": [
	"slt"
],
	"application/vnd.epson.ssf": [
	"ssf"
],
	"application/vnd.eszigno3+xml": [
	"es3",
	"et3"
],
	"application/vnd.ezpix-album": [
	"ez2"
],
	"application/vnd.ezpix-package": [
	"ez3"
],
	"application/vnd.fdf": [
	"fdf"
],
	"application/vnd.fdsn.mseed": [
	"mseed"
],
	"application/vnd.fdsn.seed": [
	"seed",
	"dataless"
],
	"application/vnd.flographit": [
	"gph"
],
	"application/vnd.fluxtime.clip": [
	"ftc"
],
	"application/vnd.framemaker": [
	"fm",
	"frame",
	"maker",
	"book"
],
	"application/vnd.frogans.fnc": [
	"fnc"
],
	"application/vnd.frogans.ltf": [
	"ltf"
],
	"application/vnd.fsc.weblaunch": [
	"fsc"
],
	"application/vnd.fujitsu.oasys": [
	"oas"
],
	"application/vnd.fujitsu.oasys2": [
	"oa2"
],
	"application/vnd.fujitsu.oasys3": [
	"oa3"
],
	"application/vnd.fujitsu.oasysgp": [
	"fg5"
],
	"application/vnd.fujitsu.oasysprs": [
	"bh2"
],
	"application/vnd.fujixerox.ddd": [
	"ddd"
],
	"application/vnd.fujixerox.docuworks": [
	"xdw"
],
	"application/vnd.fujixerox.docuworks.binder": [
	"xbd"
],
	"application/vnd.fuzzysheet": [
	"fzs"
],
	"application/vnd.genomatix.tuxedo": [
	"txd"
],
	"application/vnd.geogebra.file": [
	"ggb"
],
	"application/vnd.geogebra.tool": [
	"ggt"
],
	"application/vnd.geometry-explorer": [
	"gex",
	"gre"
],
	"application/vnd.geonext": [
	"gxt"
],
	"application/vnd.geoplan": [
	"g2w"
],
	"application/vnd.geospace": [
	"g3w"
],
	"application/vnd.gmx": [
	"gmx"
],
	"application/vnd.google-apps.document": [
	"gdoc"
],
	"application/vnd.google-apps.presentation": [
	"gslides"
],
	"application/vnd.google-apps.spreadsheet": [
	"gsheet"
],
	"application/vnd.google-earth.kml+xml": [
	"kml"
],
	"application/vnd.google-earth.kmz": [
	"kmz"
],
	"application/vnd.grafeq": [
	"gqf",
	"gqs"
],
	"application/vnd.groove-account": [
	"gac"
],
	"application/vnd.groove-help": [
	"ghf"
],
	"application/vnd.groove-identity-message": [
	"gim"
],
	"application/vnd.groove-injector": [
	"grv"
],
	"application/vnd.groove-tool-message": [
	"gtm"
],
	"application/vnd.groove-tool-template": [
	"tpl"
],
	"application/vnd.groove-vcard": [
	"vcg"
],
	"application/vnd.hal+xml": [
	"hal"
],
	"application/vnd.handheld-entertainment+xml": [
	"zmm"
],
	"application/vnd.hbci": [
	"hbci"
],
	"application/vnd.hhe.lesson-player": [
	"les"
],
	"application/vnd.hp-hpgl": [
	"hpgl"
],
	"application/vnd.hp-hpid": [
	"hpid"
],
	"application/vnd.hp-hps": [
	"hps"
],
	"application/vnd.hp-jlyt": [
	"jlt"
],
	"application/vnd.hp-pcl": [
	"pcl"
],
	"application/vnd.hp-pclxl": [
	"pclxl"
],
	"application/vnd.hydrostatix.sof-data": [
	"sfd-hdstx"
],
	"application/vnd.ibm.minipay": [
	"mpy"
],
	"application/vnd.ibm.modcap": [
	"afp",
	"listafp",
	"list3820"
],
	"application/vnd.ibm.rights-management": [
	"irm"
],
	"application/vnd.ibm.secure-container": [
	"sc"
],
	"application/vnd.iccprofile": [
	"icc",
	"icm"
],
	"application/vnd.igloader": [
	"igl"
],
	"application/vnd.immervision-ivp": [
	"ivp"
],
	"application/vnd.immervision-ivu": [
	"ivu"
],
	"application/vnd.insors.igm": [
	"igm"
],
	"application/vnd.intercon.formnet": [
	"xpw",
	"xpx"
],
	"application/vnd.intergeo": [
	"i2g"
],
	"application/vnd.intu.qbo": [
	"qbo"
],
	"application/vnd.intu.qfx": [
	"qfx"
],
	"application/vnd.ipunplugged.rcprofile": [
	"rcprofile"
],
	"application/vnd.irepository.package+xml": [
	"irp"
],
	"application/vnd.is-xpr": [
	"xpr"
],
	"application/vnd.isac.fcs": [
	"fcs"
],
	"application/vnd.jam": [
	"jam"
],
	"application/vnd.jcp.javame.midlet-rms": [
	"rms"
],
	"application/vnd.jisp": [
	"jisp"
],
	"application/vnd.joost.joda-archive": [
	"joda"
],
	"application/vnd.kahootz": [
	"ktz",
	"ktr"
],
	"application/vnd.kde.karbon": [
	"karbon"
],
	"application/vnd.kde.kchart": [
	"chrt"
],
	"application/vnd.kde.kformula": [
	"kfo"
],
	"application/vnd.kde.kivio": [
	"flw"
],
	"application/vnd.kde.kontour": [
	"kon"
],
	"application/vnd.kde.kpresenter": [
	"kpr",
	"kpt"
],
	"application/vnd.kde.kspread": [
	"ksp"
],
	"application/vnd.kde.kword": [
	"kwd",
	"kwt"
],
	"application/vnd.kenameaapp": [
	"htke"
],
	"application/vnd.kidspiration": [
	"kia"
],
	"application/vnd.kinar": [
	"kne",
	"knp"
],
	"application/vnd.koan": [
	"skp",
	"skd",
	"skt",
	"skm"
],
	"application/vnd.kodak-descriptor": [
	"sse"
],
	"application/vnd.las.las+xml": [
	"lasxml"
],
	"application/vnd.llamagraphics.life-balance.desktop": [
	"lbd"
],
	"application/vnd.llamagraphics.life-balance.exchange+xml": [
	"lbe"
],
	"application/vnd.lotus-1-2-3": [
	"123"
],
	"application/vnd.lotus-approach": [
	"apr"
],
	"application/vnd.lotus-freelance": [
	"pre"
],
	"application/vnd.lotus-notes": [
	"nsf"
],
	"application/vnd.lotus-organizer": [
	"org"
],
	"application/vnd.lotus-screencam": [
	"scm"
],
	"application/vnd.lotus-wordpro": [
	"lwp"
],
	"application/vnd.macports.portpkg": [
	"portpkg"
],
	"application/vnd.mcd": [
	"mcd"
],
	"application/vnd.medcalcdata": [
	"mc1"
],
	"application/vnd.mediastation.cdkey": [
	"cdkey"
],
	"application/vnd.mfer": [
	"mwf"
],
	"application/vnd.mfmp": [
	"mfm"
],
	"application/vnd.micrografx.flo": [
	"flo"
],
	"application/vnd.micrografx.igx": [
	"igx"
],
	"application/vnd.mif": [
	"mif"
],
	"application/vnd.mobius.daf": [
	"daf"
],
	"application/vnd.mobius.dis": [
	"dis"
],
	"application/vnd.mobius.mbk": [
	"mbk"
],
	"application/vnd.mobius.mqy": [
	"mqy"
],
	"application/vnd.mobius.msl": [
	"msl"
],
	"application/vnd.mobius.plc": [
	"plc"
],
	"application/vnd.mobius.txf": [
	"txf"
],
	"application/vnd.mophun.application": [
	"mpn"
],
	"application/vnd.mophun.certificate": [
	"mpc"
],
	"application/vnd.mozilla.xul+xml": [
	"xul"
],
	"application/vnd.ms-artgalry": [
	"cil"
],
	"application/vnd.ms-cab-compressed": [
	"cab"
],
	"application/vnd.ms-excel": [
	"xls",
	"xlm",
	"xla",
	"xlc",
	"xlt",
	"xlw"
],
	"application/vnd.ms-excel.addin.macroenabled.12": [
	"xlam"
],
	"application/vnd.ms-excel.sheet.binary.macroenabled.12": [
	"xlsb"
],
	"application/vnd.ms-excel.sheet.macroenabled.12": [
	"xlsm"
],
	"application/vnd.ms-excel.template.macroenabled.12": [
	"xltm"
],
	"application/vnd.ms-fontobject": [
	"eot"
],
	"application/vnd.ms-htmlhelp": [
	"chm"
],
	"application/vnd.ms-ims": [
	"ims"
],
	"application/vnd.ms-lrm": [
	"lrm"
],
	"application/vnd.ms-officetheme": [
	"thmx"
],
	"application/vnd.ms-outlook": [
	"msg"
],
	"application/vnd.ms-pki.seccat": [
	"cat"
],
	"application/vnd.ms-pki.stl": [
	"stl"
],
	"application/vnd.ms-powerpoint": [
	"ppt",
	"pps",
	"pot"
],
	"application/vnd.ms-powerpoint.addin.macroenabled.12": [
	"ppam"
],
	"application/vnd.ms-powerpoint.presentation.macroenabled.12": [
	"pptm"
],
	"application/vnd.ms-powerpoint.slide.macroenabled.12": [
	"sldm"
],
	"application/vnd.ms-powerpoint.slideshow.macroenabled.12": [
	"ppsm"
],
	"application/vnd.ms-powerpoint.template.macroenabled.12": [
	"potm"
],
	"application/vnd.ms-project": [
	"mpp",
	"mpt"
],
	"application/vnd.ms-word.document.macroenabled.12": [
	"docm"
],
	"application/vnd.ms-word.template.macroenabled.12": [
	"dotm"
],
	"application/vnd.ms-works": [
	"wps",
	"wks",
	"wcm",
	"wdb"
],
	"application/vnd.ms-wpl": [
	"wpl"
],
	"application/vnd.ms-xpsdocument": [
	"xps"
],
	"application/vnd.mseq": [
	"mseq"
],
	"application/vnd.musician": [
	"mus"
],
	"application/vnd.muvee.style": [
	"msty"
],
	"application/vnd.mynfc": [
	"taglet"
],
	"application/vnd.neurolanguage.nlu": [
	"nlu"
],
	"application/vnd.nitf": [
	"ntf",
	"nitf"
],
	"application/vnd.noblenet-directory": [
	"nnd"
],
	"application/vnd.noblenet-sealer": [
	"nns"
],
	"application/vnd.noblenet-web": [
	"nnw"
],
	"application/vnd.nokia.n-gage.data": [
	"ngdat"
],
	"application/vnd.nokia.n-gage.symbian.install": [
	"n-gage"
],
	"application/vnd.nokia.radio-preset": [
	"rpst"
],
	"application/vnd.nokia.radio-presets": [
	"rpss"
],
	"application/vnd.novadigm.edm": [
	"edm"
],
	"application/vnd.novadigm.edx": [
	"edx"
],
	"application/vnd.novadigm.ext": [
	"ext"
],
	"application/vnd.oasis.opendocument.chart": [
	"odc"
],
	"application/vnd.oasis.opendocument.chart-template": [
	"otc"
],
	"application/vnd.oasis.opendocument.database": [
	"odb"
],
	"application/vnd.oasis.opendocument.formula": [
	"odf"
],
	"application/vnd.oasis.opendocument.formula-template": [
	"odft"
],
	"application/vnd.oasis.opendocument.graphics": [
	"odg"
],
	"application/vnd.oasis.opendocument.graphics-template": [
	"otg"
],
	"application/vnd.oasis.opendocument.image": [
	"odi"
],
	"application/vnd.oasis.opendocument.image-template": [
	"oti"
],
	"application/vnd.oasis.opendocument.presentation": [
	"odp"
],
	"application/vnd.oasis.opendocument.presentation-template": [
	"otp"
],
	"application/vnd.oasis.opendocument.spreadsheet": [
	"ods"
],
	"application/vnd.oasis.opendocument.spreadsheet-template": [
	"ots"
],
	"application/vnd.oasis.opendocument.text": [
	"odt"
],
	"application/vnd.oasis.opendocument.text-master": [
	"odm"
],
	"application/vnd.oasis.opendocument.text-template": [
	"ott"
],
	"application/vnd.oasis.opendocument.text-web": [
	"oth"
],
	"application/vnd.olpc-sugar": [
	"xo"
],
	"application/vnd.oma.dd2+xml": [
	"dd2"
],
	"application/vnd.openofficeorg.extension": [
	"oxt"
],
	"application/vnd.openxmlformats-officedocument.presentationml.presentation": [
	"pptx"
],
	"application/vnd.openxmlformats-officedocument.presentationml.slide": [
	"sldx"
],
	"application/vnd.openxmlformats-officedocument.presentationml.slideshow": [
	"ppsx"
],
	"application/vnd.openxmlformats-officedocument.presentationml.template": [
	"potx"
],
	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
	"xlsx"
],
	"application/vnd.openxmlformats-officedocument.spreadsheetml.template": [
	"xltx"
],
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
	"docx"
],
	"application/vnd.openxmlformats-officedocument.wordprocessingml.template": [
	"dotx"
],
	"application/vnd.osgeo.mapguide.package": [
	"mgp"
],
	"application/vnd.osgi.dp": [
	"dp"
],
	"application/vnd.osgi.subsystem": [
	"esa"
],
	"application/vnd.palm": [
	"pdb",
	"pqa",
	"oprc"
],
	"application/vnd.pawaafile": [
	"paw"
],
	"application/vnd.pg.format": [
	"str"
],
	"application/vnd.pg.osasli": [
	"ei6"
],
	"application/vnd.picsel": [
	"efif"
],
	"application/vnd.pmi.widget": [
	"wg"
],
	"application/vnd.pocketlearn": [
	"plf"
],
	"application/vnd.powerbuilder6": [
	"pbd"
],
	"application/vnd.previewsystems.box": [
	"box"
],
	"application/vnd.proteus.magazine": [
	"mgz"
],
	"application/vnd.publishare-delta-tree": [
	"qps"
],
	"application/vnd.pvi.ptid1": [
	"ptid"
],
	"application/vnd.quark.quarkxpress": [
	"qxd",
	"qxt",
	"qwd",
	"qwt",
	"qxl",
	"qxb"
],
	"application/vnd.realvnc.bed": [
	"bed"
],
	"application/vnd.recordare.musicxml": [
	"mxl"
],
	"application/vnd.recordare.musicxml+xml": [
	"musicxml"
],
	"application/vnd.rig.cryptonote": [
	"cryptonote"
],
	"application/vnd.rim.cod": [
	"cod"
],
	"application/vnd.rn-realmedia": [
	"rm"
],
	"application/vnd.rn-realmedia-vbr": [
	"rmvb"
],
	"application/vnd.route66.link66+xml": [
	"link66"
],
	"application/vnd.sailingtracker.track": [
	"st"
],
	"application/vnd.seemail": [
	"see"
],
	"application/vnd.sema": [
	"sema"
],
	"application/vnd.semd": [
	"semd"
],
	"application/vnd.semf": [
	"semf"
],
	"application/vnd.shana.informed.formdata": [
	"ifm"
],
	"application/vnd.shana.informed.formtemplate": [
	"itp"
],
	"application/vnd.shana.informed.interchange": [
	"iif"
],
	"application/vnd.shana.informed.package": [
	"ipk"
],
	"application/vnd.simtech-mindmapper": [
	"twd",
	"twds"
],
	"application/vnd.smaf": [
	"mmf"
],
	"application/vnd.smart.teacher": [
	"teacher"
],
	"application/vnd.solent.sdkm+xml": [
	"sdkm",
	"sdkd"
],
	"application/vnd.spotfire.dxp": [
	"dxp"
],
	"application/vnd.spotfire.sfs": [
	"sfs"
],
	"application/vnd.stardivision.calc": [
	"sdc"
],
	"application/vnd.stardivision.draw": [
	"sda"
],
	"application/vnd.stardivision.impress": [
	"sdd"
],
	"application/vnd.stardivision.math": [
	"smf"
],
	"application/vnd.stardivision.writer": [
	"sdw",
	"vor"
],
	"application/vnd.stardivision.writer-global": [
	"sgl"
],
	"application/vnd.stepmania.package": [
	"smzip"
],
	"application/vnd.stepmania.stepchart": [
	"sm"
],
	"application/vnd.sun.wadl+xml": [
	"wadl"
],
	"application/vnd.sun.xml.calc": [
	"sxc"
],
	"application/vnd.sun.xml.calc.template": [
	"stc"
],
	"application/vnd.sun.xml.draw": [
	"sxd"
],
	"application/vnd.sun.xml.draw.template": [
	"std"
],
	"application/vnd.sun.xml.impress": [
	"sxi"
],
	"application/vnd.sun.xml.impress.template": [
	"sti"
],
	"application/vnd.sun.xml.math": [
	"sxm"
],
	"application/vnd.sun.xml.writer": [
	"sxw"
],
	"application/vnd.sun.xml.writer.global": [
	"sxg"
],
	"application/vnd.sun.xml.writer.template": [
	"stw"
],
	"application/vnd.sus-calendar": [
	"sus",
	"susp"
],
	"application/vnd.svd": [
	"svd"
],
	"application/vnd.symbian.install": [
	"sis",
	"sisx"
],
	"application/vnd.syncml+xml": [
	"xsm"
],
	"application/vnd.syncml.dm+wbxml": [
	"bdm"
],
	"application/vnd.syncml.dm+xml": [
	"xdm"
],
	"application/vnd.tao.intent-module-archive": [
	"tao"
],
	"application/vnd.tcpdump.pcap": [
	"pcap",
	"cap",
	"dmp"
],
	"application/vnd.tmobile-livetv": [
	"tmo"
],
	"application/vnd.trid.tpt": [
	"tpt"
],
	"application/vnd.triscape.mxs": [
	"mxs"
],
	"application/vnd.trueapp": [
	"tra"
],
	"application/vnd.ufdl": [
	"ufd",
	"ufdl"
],
	"application/vnd.uiq.theme": [
	"utz"
],
	"application/vnd.umajin": [
	"umj"
],
	"application/vnd.unity": [
	"unityweb"
],
	"application/vnd.uoml+xml": [
	"uoml"
],
	"application/vnd.vcx": [
	"vcx"
],
	"application/vnd.visio": [
	"vsd",
	"vst",
	"vss",
	"vsw"
],
	"application/vnd.visionary": [
	"vis"
],
	"application/vnd.vsf": [
	"vsf"
],
	"application/vnd.wap.wbxml": [
	"wbxml"
],
	"application/vnd.wap.wmlc": [
	"wmlc"
],
	"application/vnd.wap.wmlscriptc": [
	"wmlsc"
],
	"application/vnd.webturbo": [
	"wtb"
],
	"application/vnd.wolfram.player": [
	"nbp"
],
	"application/vnd.wordperfect": [
	"wpd"
],
	"application/vnd.wqd": [
	"wqd"
],
	"application/vnd.wt.stf": [
	"stf"
],
	"application/vnd.xara": [
	"xar"
],
	"application/vnd.xfdl": [
	"xfdl"
],
	"application/vnd.yamaha.hv-dic": [
	"hvd"
],
	"application/vnd.yamaha.hv-script": [
	"hvs"
],
	"application/vnd.yamaha.hv-voice": [
	"hvp"
],
	"application/vnd.yamaha.openscoreformat": [
	"osf"
],
	"application/vnd.yamaha.openscoreformat.osfpvg+xml": [
	"osfpvg"
],
	"application/vnd.yamaha.smaf-audio": [
	"saf"
],
	"application/vnd.yamaha.smaf-phrase": [
	"spf"
],
	"application/vnd.yellowriver-custom-menu": [
	"cmp"
],
	"application/vnd.zul": [
	"zir",
	"zirz"
],
	"application/vnd.zzazz.deck+xml": [
	"zaz"
],
	"application/voicexml+xml": [
	"vxml"
],
	"application/wasm": [
	"wasm"
],
	"application/widget": [
	"wgt"
],
	"application/winhlp": [
	"hlp"
],
	"application/wsdl+xml": [
	"wsdl"
],
	"application/wspolicy+xml": [
	"wspolicy"
],
	"application/x-7z-compressed": [
	"7z"
],
	"application/x-abiword": [
	"abw"
],
	"application/x-ace-compressed": [
	"ace"
],
	"application/x-apple-diskimage": [
],
	"application/x-arj": [
	"arj"
],
	"application/x-authorware-bin": [
	"aab",
	"x32",
	"u32",
	"vox"
],
	"application/x-authorware-map": [
	"aam"
],
	"application/x-authorware-seg": [
	"aas"
],
	"application/x-bcpio": [
	"bcpio"
],
	"application/x-bdoc": [
],
	"application/x-bittorrent": [
	"torrent"
],
	"application/x-blorb": [
	"blb",
	"blorb"
],
	"application/x-bzip": [
	"bz"
],
	"application/x-bzip2": [
	"bz2",
	"boz"
],
	"application/x-cbr": [
	"cbr",
	"cba",
	"cbt",
	"cbz",
	"cb7"
],
	"application/x-cdlink": [
	"vcd"
],
	"application/x-cfs-compressed": [
	"cfs"
],
	"application/x-chat": [
	"chat"
],
	"application/x-chess-pgn": [
	"pgn"
],
	"application/x-chrome-extension": [
	"crx"
],
	"application/x-cocoa": [
	"cco"
],
	"application/x-conference": [
	"nsc"
],
	"application/x-cpio": [
	"cpio"
],
	"application/x-csh": [
	"csh"
],
	"application/x-debian-package": [
	"udeb"
],
	"application/x-dgc-compressed": [
	"dgc"
],
	"application/x-director": [
	"dir",
	"dcr",
	"dxr",
	"cst",
	"cct",
	"cxt",
	"w3d",
	"fgd",
	"swa"
],
	"application/x-doom": [
	"wad"
],
	"application/x-dtbncx+xml": [
	"ncx"
],
	"application/x-dtbook+xml": [
	"dtb"
],
	"application/x-dtbresource+xml": [
	"res"
],
	"application/x-dvi": [
	"dvi"
],
	"application/x-envoy": [
	"evy"
],
	"application/x-eva": [
	"eva"
],
	"application/x-font-bdf": [
	"bdf"
],
	"application/x-font-ghostscript": [
	"gsf"
],
	"application/x-font-linux-psf": [
	"psf"
],
	"application/x-font-pcf": [
	"pcf"
],
	"application/x-font-snf": [
	"snf"
],
	"application/x-font-type1": [
	"pfa",
	"pfb",
	"pfm",
	"afm"
],
	"application/x-freearc": [
	"arc"
],
	"application/x-futuresplash": [
	"spl"
],
	"application/x-gca-compressed": [
	"gca"
],
	"application/x-glulx": [
	"ulx"
],
	"application/x-gnumeric": [
	"gnumeric"
],
	"application/x-gramps-xml": [
	"gramps"
],
	"application/x-gtar": [
	"gtar"
],
	"application/x-hdf": [
	"hdf"
],
	"application/x-httpd-php": [
	"php"
],
	"application/x-install-instructions": [
	"install"
],
	"application/x-iso9660-image": [
],
	"application/x-java-archive-diff": [
	"jardiff"
],
	"application/x-java-jnlp-file": [
	"jnlp"
],
	"application/x-latex": [
	"latex"
],
	"application/x-lua-bytecode": [
	"luac"
],
	"application/x-lzh-compressed": [
	"lzh",
	"lha"
],
	"application/x-makeself": [
	"run"
],
	"application/x-mie": [
	"mie"
],
	"application/x-mobipocket-ebook": [
	"prc",
	"mobi"
],
	"application/x-ms-application": [
	"application"
],
	"application/x-ms-shortcut": [
	"lnk"
],
	"application/x-ms-wmd": [
	"wmd"
],
	"application/x-ms-wmz": [
	"wmz"
],
	"application/x-ms-xbap": [
	"xbap"
],
	"application/x-msaccess": [
	"mdb"
],
	"application/x-msbinder": [
	"obd"
],
	"application/x-mscardfile": [
	"crd"
],
	"application/x-msclip": [
	"clp"
],
	"application/x-msdos-program": [
],
	"application/x-msdownload": [
	"com",
	"bat"
],
	"application/x-msmediaview": [
	"mvb",
	"m13",
	"m14"
],
	"application/x-msmetafile": [
	"wmf",
	"emf",
	"emz"
],
	"application/x-msmoney": [
	"mny"
],
	"application/x-mspublisher": [
	"pub"
],
	"application/x-msschedule": [
	"scd"
],
	"application/x-msterminal": [
	"trm"
],
	"application/x-mswrite": [
	"wri"
],
	"application/x-netcdf": [
	"nc",
	"cdf"
],
	"application/x-ns-proxy-autoconfig": [
	"pac"
],
	"application/x-nzb": [
	"nzb"
],
	"application/x-perl": [
	"pl",
	"pm"
],
	"application/x-pilot": [
],
	"application/x-pkcs12": [
	"p12",
	"pfx"
],
	"application/x-pkcs7-certificates": [
	"p7b",
	"spc"
],
	"application/x-pkcs7-certreqresp": [
	"p7r"
],
	"application/x-rar-compressed": [
	"rar"
],
	"application/x-redhat-package-manager": [
	"rpm"
],
	"application/x-research-info-systems": [
	"ris"
],
	"application/x-sea": [
	"sea"
],
	"application/x-sh": [
	"sh"
],
	"application/x-shar": [
	"shar"
],
	"application/x-shockwave-flash": [
	"swf"
],
	"application/x-silverlight-app": [
	"xap"
],
	"application/x-sql": [
	"sql"
],
	"application/x-stuffit": [
	"sit"
],
	"application/x-stuffitx": [
	"sitx"
],
	"application/x-subrip": [
	"srt"
],
	"application/x-sv4cpio": [
	"sv4cpio"
],
	"application/x-sv4crc": [
	"sv4crc"
],
	"application/x-t3vm-image": [
	"t3"
],
	"application/x-tads": [
	"gam"
],
	"application/x-tar": [
	"tar"
],
	"application/x-tcl": [
	"tcl",
	"tk"
],
	"application/x-tex": [
	"tex"
],
	"application/x-tex-tfm": [
	"tfm"
],
	"application/x-texinfo": [
	"texinfo",
	"texi"
],
	"application/x-tgif": [
	"obj"
],
	"application/x-ustar": [
	"ustar"
],
	"application/x-virtualbox-hdd": [
	"hdd"
],
	"application/x-virtualbox-ova": [
	"ova"
],
	"application/x-virtualbox-ovf": [
	"ovf"
],
	"application/x-virtualbox-vbox": [
	"vbox"
],
	"application/x-virtualbox-vbox-extpack": [
	"vbox-extpack"
],
	"application/x-virtualbox-vdi": [
	"vdi"
],
	"application/x-virtualbox-vhd": [
	"vhd"
],
	"application/x-virtualbox-vmdk": [
	"vmdk"
],
	"application/x-wais-source": [
	"src"
],
	"application/x-web-app-manifest+json": [
	"webapp"
],
	"application/x-x509-ca-cert": [
	"der",
	"crt",
	"pem"
],
	"application/x-xfig": [
	"fig"
],
	"application/x-xliff+xml": [
	"xlf"
],
	"application/x-xpinstall": [
	"xpi"
],
	"application/x-xz": [
	"xz"
],
	"application/x-zmachine": [
	"z1",
	"z2",
	"z3",
	"z4",
	"z5",
	"z6",
	"z7",
	"z8"
],
	"application/xaml+xml": [
	"xaml"
],
	"application/xcap-diff+xml": [
	"xdf"
],
	"application/xenc+xml": [
	"xenc"
],
	"application/xhtml+xml": [
	"xhtml",
	"xht"
],
	"application/xml": [
	"xml",
	"xsl",
	"xsd",
	"rng"
],
	"application/xml-dtd": [
	"dtd"
],
	"application/xop+xml": [
	"xop"
],
	"application/xproc+xml": [
	"xpl"
],
	"application/xslt+xml": [
	"xslt"
],
	"application/xspf+xml": [
	"xspf"
],
	"application/xv+xml": [
	"mxml",
	"xhvml",
	"xvml",
	"xvm"
],
	"application/yang": [
	"yang"
],
	"application/yin+xml": [
	"yin"
],
	"application/zip": [
	"zip"
],
	"audio/3gpp": [
],
	"audio/adpcm": [
	"adp"
],
	"audio/basic": [
	"au",
	"snd"
],
	"audio/midi": [
	"mid",
	"midi",
	"kar",
	"rmi"
],
	"audio/mp3": [
],
	"audio/mp4": [
	"m4a",
	"mp4a"
],
	"audio/mpeg": [
	"mpga",
	"mp2",
	"mp2a",
	"mp3",
	"m2a",
	"m3a"
],
	"audio/ogg": [
	"oga",
	"ogg",
	"spx"
],
	"audio/s3m": [
	"s3m"
],
	"audio/silk": [
	"sil"
],
	"audio/vnd.dece.audio": [
	"uva",
	"uvva"
],
	"audio/vnd.digital-winds": [
	"eol"
],
	"audio/vnd.dra": [
	"dra"
],
	"audio/vnd.dts": [
	"dts"
],
	"audio/vnd.dts.hd": [
	"dtshd"
],
	"audio/vnd.lucent.voice": [
	"lvp"
],
	"audio/vnd.ms-playready.media.pya": [
	"pya"
],
	"audio/vnd.nuera.ecelp4800": [
	"ecelp4800"
],
	"audio/vnd.nuera.ecelp7470": [
	"ecelp7470"
],
	"audio/vnd.nuera.ecelp9600": [
	"ecelp9600"
],
	"audio/vnd.rip": [
	"rip"
],
	"audio/wav": [
	"wav"
],
	"audio/wave": [
],
	"audio/webm": [
	"weba"
],
	"audio/x-aac": [
	"aac"
],
	"audio/x-aiff": [
	"aif",
	"aiff",
	"aifc"
],
	"audio/x-caf": [
	"caf"
],
	"audio/x-flac": [
	"flac"
],
	"audio/x-m4a": [
],
	"audio/x-matroska": [
	"mka"
],
	"audio/x-mpegurl": [
	"m3u"
],
	"audio/x-ms-wax": [
	"wax"
],
	"audio/x-ms-wma": [
	"wma"
],
	"audio/x-pn-realaudio": [
	"ram",
	"ra"
],
	"audio/x-pn-realaudio-plugin": [
	"rmp"
],
	"audio/x-realaudio": [
],
	"audio/x-wav": [
],
	"audio/xm": [
	"xm"
],
	"chemical/x-cdx": [
	"cdx"
],
	"chemical/x-cif": [
	"cif"
],
	"chemical/x-cmdf": [
	"cmdf"
],
	"chemical/x-cml": [
	"cml"
],
	"chemical/x-csml": [
	"csml"
],
	"chemical/x-xyz": [
	"xyz"
],
	"font/collection": [
	"ttc"
],
	"font/otf": [
	"otf"
],
	"font/ttf": [
	"ttf"
],
	"font/woff": [
	"woff"
],
	"font/woff2": [
	"woff2"
],
	"image/apng": [
	"apng"
],
	"image/bmp": [
	"bmp"
],
	"image/cgm": [
	"cgm"
],
	"image/g3fax": [
	"g3"
],
	"image/gif": [
	"gif"
],
	"image/ief": [
	"ief"
],
	"image/jp2": [
	"jp2",
	"jpg2"
],
	"image/jpeg": [
	"jpeg",
	"jpg",
	"jpe"
],
	"image/jpm": [
	"jpm"
],
	"image/jpx": [
	"jpx",
	"jpf"
],
	"image/ktx": [
	"ktx"
],
	"image/png": [
	"png"
],
	"image/prs.btif": [
	"btif"
],
	"image/sgi": [
	"sgi"
],
	"image/svg+xml": [
	"svg",
	"svgz"
],
	"image/tiff": [
	"tiff",
	"tif"
],
	"image/vnd.adobe.photoshop": [
	"psd"
],
	"image/vnd.dece.graphic": [
	"uvi",
	"uvvi",
	"uvg",
	"uvvg"
],
	"image/vnd.djvu": [
	"djvu",
	"djv"
],
	"image/vnd.dvb.subtitle": [
],
	"image/vnd.dwg": [
	"dwg"
],
	"image/vnd.dxf": [
	"dxf"
],
	"image/vnd.fastbidsheet": [
	"fbs"
],
	"image/vnd.fpx": [
	"fpx"
],
	"image/vnd.fst": [
	"fst"
],
	"image/vnd.fujixerox.edmics-mmr": [
	"mmr"
],
	"image/vnd.fujixerox.edmics-rlc": [
	"rlc"
],
	"image/vnd.ms-modi": [
	"mdi"
],
	"image/vnd.ms-photo": [
	"wdp"
],
	"image/vnd.net-fpx": [
	"npx"
],
	"image/vnd.wap.wbmp": [
	"wbmp"
],
	"image/vnd.xiff": [
	"xif"
],
	"image/webp": [
	"webp"
],
	"image/x-3ds": [
	"3ds"
],
	"image/x-cmu-raster": [
	"ras"
],
	"image/x-cmx": [
	"cmx"
],
	"image/x-freehand": [
	"fh",
	"fhc",
	"fh4",
	"fh5",
	"fh7"
],
	"image/x-icon": [
	"ico"
],
	"image/x-jng": [
	"jng"
],
	"image/x-mrsid-image": [
	"sid"
],
	"image/x-ms-bmp": [
],
	"image/x-pcx": [
	"pcx"
],
	"image/x-pict": [
	"pic",
	"pct"
],
	"image/x-portable-anymap": [
	"pnm"
],
	"image/x-portable-bitmap": [
	"pbm"
],
	"image/x-portable-graymap": [
	"pgm"
],
	"image/x-portable-pixmap": [
	"ppm"
],
	"image/x-rgb": [
	"rgb"
],
	"image/x-tga": [
	"tga"
],
	"image/x-xbitmap": [
	"xbm"
],
	"image/x-xpixmap": [
	"xpm"
],
	"image/x-xwindowdump": [
	"xwd"
],
	"message/rfc822": [
	"eml",
	"mime"
],
	"model/gltf+json": [
	"gltf"
],
	"model/gltf-binary": [
	"glb"
],
	"model/iges": [
	"igs",
	"iges"
],
	"model/mesh": [
	"msh",
	"mesh",
	"silo"
],
	"model/vnd.collada+xml": [
	"dae"
],
	"model/vnd.dwf": [
	"dwf"
],
	"model/vnd.gdl": [
	"gdl"
],
	"model/vnd.gtw": [
	"gtw"
],
	"model/vnd.mts": [
	"mts"
],
	"model/vnd.vtu": [
	"vtu"
],
	"model/vrml": [
	"wrl",
	"vrml"
],
	"model/x3d+binary": [
	"x3db",
	"x3dbz"
],
	"model/x3d+vrml": [
	"x3dv",
	"x3dvz"
],
	"model/x3d+xml": [
	"x3d",
	"x3dz"
],
	"text/cache-manifest": [
	"appcache",
	"manifest"
],
	"text/calendar": [
	"ics",
	"ifb"
],
	"text/coffeescript": [
	"coffee",
	"litcoffee"
],
	"text/css": [
	"css"
],
	"text/csv": [
	"csv"
],
	"text/hjson": [
	"hjson"
],
	"text/html": [
	"html",
	"htm",
	"shtml"
],
	"text/jade": [
	"jade"
],
	"text/jsx": [
	"jsx"
],
	"text/less": [
	"less"
],
	"text/markdown": [
	"markdown",
	"md"
],
	"text/mathml": [
	"mml"
],
	"text/n3": [
	"n3"
],
	"text/plain": [
	"txt",
	"text",
	"conf",
	"def",
	"list",
	"log",
	"in",
	"ini"
],
	"text/prs.lines.tag": [
	"dsc"
],
	"text/richtext": [
	"rtx"
],
	"text/rtf": [
],
	"text/sgml": [
	"sgml",
	"sgm"
],
	"text/slim": [
	"slim",
	"slm"
],
	"text/stylus": [
	"stylus",
	"styl"
],
	"text/tab-separated-values": [
	"tsv"
],
	"text/troff": [
	"t",
	"tr",
	"roff",
	"man",
	"me",
	"ms"
],
	"text/turtle": [
	"ttl"
],
	"text/uri-list": [
	"uri",
	"uris",
	"urls"
],
	"text/vcard": [
	"vcard"
],
	"text/vnd.curl": [
	"curl"
],
	"text/vnd.curl.dcurl": [
	"dcurl"
],
	"text/vnd.curl.mcurl": [
	"mcurl"
],
	"text/vnd.curl.scurl": [
	"scurl"
],
	"text/vnd.dvb.subtitle": [
	"sub"
],
	"text/vnd.fly": [
	"fly"
],
	"text/vnd.fmi.flexstor": [
	"flx"
],
	"text/vnd.graphviz": [
	"gv"
],
	"text/vnd.in3d.3dml": [
	"3dml"
],
	"text/vnd.in3d.spot": [
	"spot"
],
	"text/vnd.sun.j2me.app-descriptor": [
	"jad"
],
	"text/vnd.wap.wml": [
	"wml"
],
	"text/vnd.wap.wmlscript": [
	"wmls"
],
	"text/vtt": [
	"vtt"
],
	"text/x-asm": [
	"s",
	"asm"
],
	"text/x-c": [
	"c",
	"cc",
	"cxx",
	"cpp",
	"h",
	"hh",
	"dic"
],
	"text/x-component": [
	"htc"
],
	"text/x-fortran": [
	"f",
	"for",
	"f77",
	"f90"
],
	"text/x-handlebars-template": [
	"hbs"
],
	"text/x-java-source": [
	"java"
],
	"text/x-lua": [
	"lua"
],
	"text/x-markdown": [
	"mkd"
],
	"text/x-nfo": [
	"nfo"
],
	"text/x-opml": [
	"opml"
],
	"text/x-org": [
],
	"text/x-pascal": [
	"p",
	"pas"
],
	"text/x-processing": [
	"pde"
],
	"text/x-sass": [
	"sass"
],
	"text/x-scss": [
	"scss"
],
	"text/x-setext": [
	"etx"
],
	"text/x-sfv": [
	"sfv"
],
	"text/x-suse-ymp": [
	"ymp"
],
	"text/x-uuencode": [
	"uu"
],
	"text/x-vcalendar": [
	"vcs"
],
	"text/x-vcard": [
	"vcf"
],
	"text/xml": [
],
	"text/yaml": [
	"yaml",
	"yml"
],
	"video/3gpp": [
	"3gp",
	"3gpp"
],
	"video/3gpp2": [
	"3g2"
],
	"video/h261": [
	"h261"
],
	"video/h263": [
	"h263"
],
	"video/h264": [
	"h264"
],
	"video/jpeg": [
	"jpgv"
],
	"video/jpm": [
	"jpgm"
],
	"video/mj2": [
	"mj2",
	"mjp2"
],
	"video/mp2t": [
	"ts"
],
	"video/mp4": [
	"mp4",
	"mp4v",
	"mpg4"
],
	"video/mpeg": [
	"mpeg",
	"mpg",
	"mpe",
	"m1v",
	"m2v"
],
	"video/ogg": [
	"ogv"
],
	"video/quicktime": [
	"qt",
	"mov"
],
	"video/vnd.dece.hd": [
	"uvh",
	"uvvh"
],
	"video/vnd.dece.mobile": [
	"uvm",
	"uvvm"
],
	"video/vnd.dece.pd": [
	"uvp",
	"uvvp"
],
	"video/vnd.dece.sd": [
	"uvs",
	"uvvs"
],
	"video/vnd.dece.video": [
	"uvv",
	"uvvv"
],
	"video/vnd.dvb.file": [
	"dvb"
],
	"video/vnd.fvt": [
	"fvt"
],
	"video/vnd.mpegurl": [
	"mxu",
	"m4u"
],
	"video/vnd.ms-playready.media.pyv": [
	"pyv"
],
	"video/vnd.uvvu.mp4": [
	"uvu",
	"uvvu"
],
	"video/vnd.vivo": [
	"viv"
],
	"video/webm": [
	"webm"
],
	"video/x-f4v": [
	"f4v"
],
	"video/x-fli": [
	"fli"
],
	"video/x-flv": [
	"flv"
],
	"video/x-m4v": [
	"m4v"
],
	"video/x-matroska": [
	"mkv",
	"mk3d",
	"mks"
],
	"video/x-mng": [
	"mng"
],
	"video/x-ms-asf": [
	"asf",
	"asx"
],
	"video/x-ms-vob": [
	"vob"
],
	"video/x-ms-wm": [
	"wm"
],
	"video/x-ms-wmv": [
	"wmv"
],
	"video/x-ms-wmx": [
	"wmx"
],
	"video/x-ms-wvx": [
	"wvx"
],
	"video/x-msvideo": [
	"avi"
],
	"video/x-sgi-movie": [
	"movie"
],
	"video/x-smv": [
	"smv"
],
	"x-conference/x-cooltalk": [
	"ice"
]
};

function Mime() {
  // Map of extension -> mime type
  this.types = Object.create(null);

  // Map of mime type -> extension
  this.extensions = Object.create(null);
}

/**
 * Define mimetype -> extension mappings.  Each key is a mime-type that maps
 * to an array of extensions associated with the type.  The first extension is
 * used as the default extension for the type.
 *
 * e.g. mime.define({'audio/ogg', ['oga', 'ogg', 'spx']});
 *
 * @param map (Object) type definitions
 */
Mime.prototype.define = function (map) {
  for (var type in map) {
    var exts = map[type];
    for (var i = 0; i < exts.length; i++) {
      if (process.env.DEBUG_MIME && this.types[exts[i]]) {
        console.warn((this._loading || "define()").replace(/.*\//, ''), 'changes "' + exts[i] + '" extension type from ' +
          this.types[exts[i]] + ' to ' + type);
      }

      this.types[exts[i]] = type;
    }

    // Default extension is the first one we encounter
    if (!this.extensions[type]) {
      this.extensions[type] = exts[0];
    }
  }
};

/**
 * Load an Apache2-style ".types" file
 *
 * This may be called multiple times (it's expected).  Where files declare
 * overlapping types/extensions, the last file wins.
 *
 * @param file (String) path of file to load.
 */
Mime.prototype.load = function(file) {
  this._loading = file;
  // Read file and split into lines
  var map = {},
      content = fs__default['default'].readFileSync(file, 'ascii'),
      lines = content.split(/[\r\n]+/);

  lines.forEach(function(line) {
    // Clean up whitespace/comments, and split into fields
    var fields = line.replace(/\s*#.*|^\s*|\s*$/g, '').split(/\s+/);
    map[fields.shift()] = fields;
  });

  this.define(map);

  this._loading = null;
};

/**
 * Lookup a mime type based on extension
 */
Mime.prototype.lookup = function(path, fallback) {
  var ext = path.replace(/^.*[\.\/\\]/, '').toLowerCase();

  return this.types[ext] || fallback || this.default_type;
};

/**
 * Return file extension associated with a mime type
 */
Mime.prototype.extension = function(mimeType) {
  var type = mimeType.match(/^\s*([^;\s]*)(?:;|\s|$)/)[1].toLowerCase();
  return this.extensions[type];
};

// Default instance
var mime = new Mime();

// Define built-in types
mime.define(require$$0);

// Default type
mime.default_type = mime.lookup('bin');

//
// Additional API specific to the default instance
//

mime.Mime = Mime;

/**
 * Lookup a charset based on mime type.
 */
mime.charsets = {
  lookup: function(mimeType, fallback) {
    // Assume text types are utf8
    return (/^text\/|^application\/(javascript|json)/).test(mimeType) ? 'UTF-8' : fallback;
  }
};

var mime_1 = mime;

/**
 * Helpers.
 */

var s$1 = 1000;
var m$1 = s$1 * 60;
var h$1 = m$1 * 60;
var d$1 = h$1 * 24;
var w = d$1 * 7;
var y$1 = d$1 * 365.25;

/**
 * Parse or format the given `val`.
 *
 * Options:
 *
 *  - `long` verbose formatting [false]
 *
 * @param {String|Number} val
 * @param {Object} [options]
 * @throws {Error} throw an error if val is not a non-empty string or a number
 * @return {String|Number}
 * @api public
 */

var ms$1 = function(val, options) {
  options = options || {};
  var type = typeof val;
  if (type === 'string' && val.length > 0) {
    return parse$2(val);
  } else if (type === 'number' && isNaN(val) === false) {
    return options.long ? fmtLong$1(val) : fmtShort$1(val);
  }
  throw new Error(
    'val is not a non-empty string or a valid number. val=' +
      JSON.stringify(val)
  );
};

/**
 * Parse the given `str` and return milliseconds.
 *
 * @param {String} str
 * @return {Number}
 * @api private
 */

function parse$2(str) {
  str = String(str);
  if (str.length > 100) {
    return;
  }
  var match = /^((?:\d+)?\-?\d?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)?$/i.exec(
    str
  );
  if (!match) {
    return;
  }
  var n = parseFloat(match[1]);
  var type = (match[2] || 'ms').toLowerCase();
  switch (type) {
    case 'years':
    case 'year':
    case 'yrs':
    case 'yr':
    case 'y':
      return n * y$1;
    case 'weeks':
    case 'week':
    case 'w':
      return n * w;
    case 'days':
    case 'day':
    case 'd':
      return n * d$1;
    case 'hours':
    case 'hour':
    case 'hrs':
    case 'hr':
    case 'h':
      return n * h$1;
    case 'minutes':
    case 'minute':
    case 'mins':
    case 'min':
    case 'm':
      return n * m$1;
    case 'seconds':
    case 'second':
    case 'secs':
    case 'sec':
    case 's':
      return n * s$1;
    case 'milliseconds':
    case 'millisecond':
    case 'msecs':
    case 'msec':
    case 'ms':
      return n;
    default:
      return undefined;
  }
}

/**
 * Short format for `ms`.
 *
 * @param {Number} ms
 * @return {String}
 * @api private
 */

function fmtShort$1(ms) {
  var msAbs = Math.abs(ms);
  if (msAbs >= d$1) {
    return Math.round(ms / d$1) + 'd';
  }
  if (msAbs >= h$1) {
    return Math.round(ms / h$1) + 'h';
  }
  if (msAbs >= m$1) {
    return Math.round(ms / m$1) + 'm';
  }
  if (msAbs >= s$1) {
    return Math.round(ms / s$1) + 's';
  }
  return ms + 'ms';
}

/**
 * Long format for `ms`.
 *
 * @param {Number} ms
 * @return {String}
 * @api private
 */

function fmtLong$1(ms) {
  var msAbs = Math.abs(ms);
  if (msAbs >= d$1) {
    return plural$1(ms, msAbs, d$1, 'day');
  }
  if (msAbs >= h$1) {
    return plural$1(ms, msAbs, h$1, 'hour');
  }
  if (msAbs >= m$1) {
    return plural$1(ms, msAbs, m$1, 'minute');
  }
  if (msAbs >= s$1) {
    return plural$1(ms, msAbs, s$1, 'second');
  }
  return ms + ' ms';
}

/**
 * Pluralization helper.
 */

function plural$1(ms, msAbs, n, name) {
  var isPlural = msAbs >= n * 1.5;
  return Math.round(ms / n) + ' ' + name + (isPlural ? 's' : '');
}

/*!
 * ee-first
 * Copyright(c) 2014 Jonathan Ong
 * MIT Licensed
 */

/**
 * Module exports.
 * @public
 */

var eeFirst = first;

/**
 * Get the first event in a set of event emitters and event pairs.
 *
 * @param {array} stuff
 * @param {function} done
 * @public
 */

function first(stuff, done) {
  if (!Array.isArray(stuff))
    throw new TypeError('arg must be an array of [ee, events...] arrays')

  var cleanups = [];

  for (var i = 0; i < stuff.length; i++) {
    var arr = stuff[i];

    if (!Array.isArray(arr) || arr.length < 2)
      throw new TypeError('each array member must be [ee, events...]')

    var ee = arr[0];

    for (var j = 1; j < arr.length; j++) {
      var event = arr[j];
      var fn = listener(event, callback);

      // listen to the event
      ee.on(event, fn);
      // push this listener to the list of cleanups
      cleanups.push({
        ee: ee,
        event: event,
        fn: fn,
      });
    }
  }

  function callback() {
    cleanup();
    done.apply(null, arguments);
  }

  function cleanup() {
    var x;
    for (var i = 0; i < cleanups.length; i++) {
      x = cleanups[i];
      x.ee.removeListener(x.event, x.fn);
    }
  }

  function thunk(fn) {
    done = fn;
  }

  thunk.cancel = cleanup;

  return thunk
}

/**
 * Create the event listener.
 * @private
 */

function listener(event, done) {
  return function onevent(arg1) {
    var args = new Array(arguments.length);
    var ee = this;
    var err = event === 'error'
      ? arg1
      : null;

    // copy args to prevent arguments escaping scope
    for (var i = 0; i < args.length; i++) {
      args[i] = arguments[i];
    }

    done(err, ee, event, args);
  }
}

/**
 * Module exports.
 * @public
 */

var onFinished_1 = onFinished;
var isFinished_1 = isFinished;

/**
 * Module dependencies.
 * @private
 */



/**
 * Variables.
 * @private
 */

/* istanbul ignore next */
var defer = typeof setImmediate === 'function'
  ? setImmediate
  : function(fn){ process.nextTick(fn.bind.apply(fn, arguments)); };

/**
 * Invoke callback when the response has finished, useful for
 * cleaning up resources afterwards.
 *
 * @param {object} msg
 * @param {function} listener
 * @return {object}
 * @public
 */

function onFinished(msg, listener) {
  if (isFinished(msg) !== false) {
    defer(listener, null, msg);
    return msg
  }

  // attach the listener to the message
  attachListener(msg, listener);

  return msg
}

/**
 * Determine if message is already finished.
 *
 * @param {object} msg
 * @return {boolean}
 * @public
 */

function isFinished(msg) {
  var socket = msg.socket;

  if (typeof msg.finished === 'boolean') {
    // OutgoingMessage
    return Boolean(msg.finished || (socket && !socket.writable))
  }

  if (typeof msg.complete === 'boolean') {
    // IncomingMessage
    return Boolean(msg.upgrade || !socket || !socket.readable || (msg.complete && !msg.readable))
  }

  // don't know
  return undefined
}

/**
 * Attach a finished listener to the message.
 *
 * @param {object} msg
 * @param {function} callback
 * @private
 */

function attachFinishedListener(msg, callback) {
  var eeMsg;
  var eeSocket;
  var finished = false;

  function onFinish(error) {
    eeMsg.cancel();
    eeSocket.cancel();

    finished = true;
    callback(error);
  }

  // finished on first message event
  eeMsg = eeSocket = eeFirst([[msg, 'end', 'finish']], onFinish);

  function onSocket(socket) {
    // remove listener
    msg.removeListener('socket', onSocket);

    if (finished) return
    if (eeMsg !== eeSocket) return

    // finished on first socket event
    eeSocket = eeFirst([[socket, 'error', 'close']], onFinish);
  }

  if (msg.socket) {
    // socket already assigned
    onSocket(msg.socket);
    return
  }

  // wait for socket to be assigned
  msg.on('socket', onSocket);

  if (msg.socket === undefined) {
    // node.js 0.8 patch
    patchAssignSocket(msg, onSocket);
  }
}

/**
 * Attach the listener to the message.
 *
 * @param {object} msg
 * @return {function}
 * @private
 */

function attachListener(msg, listener) {
  var attached = msg.__onFinished;

  // create a private single listener with queue
  if (!attached || !attached.queue) {
    attached = msg.__onFinished = createListener(msg);
    attachFinishedListener(msg, attached);
  }

  attached.queue.push(listener);
}

/**
 * Create listener on message.
 *
 * @param {object} msg
 * @return {function}
 * @private
 */

function createListener(msg) {
  function listener(err) {
    if (msg.__onFinished === listener) msg.__onFinished = null;
    if (!listener.queue) return

    var queue = listener.queue;
    listener.queue = null;

    for (var i = 0; i < queue.length; i++) {
      queue[i](err, msg);
    }
  }

  listener.queue = [];

  return listener
}

/**
 * Patch ServerResponse.prototype.assignSocket for node.js 0.8.
 *
 * @param {ServerResponse} res
 * @param {function} callback
 * @private
 */

function patchAssignSocket(res, callback) {
  var assignSocket = res.assignSocket;

  if (typeof assignSocket !== 'function') return

  // res.on('socket', callback) is broken in 0.8
  res.assignSocket = function _assignSocket(socket) {
    assignSocket.call(this, socket);
    callback(socket);
  };
}
onFinished_1.isFinished = isFinished_1;

/*!
 * range-parser
 * Copyright(c) 2012-2014 TJ Holowaychuk
 * Copyright(c) 2015-2016 Douglas Christopher Wilson
 * MIT Licensed
 */

/**
 * Module exports.
 * @public
 */

var rangeParser_1 = rangeParser;

/**
 * Parse "Range" header `str` relative to the given file `size`.
 *
 * @param {Number} size
 * @param {String} str
 * @param {Object} [options]
 * @return {Array}
 * @public
 */

function rangeParser (size, str, options) {
  if (typeof str !== 'string') {
    throw new TypeError('argument str must be a string')
  }

  var index = str.indexOf('=');

  if (index === -1) {
    return -2
  }

  // split the range string
  var arr = str.slice(index + 1).split(',');
  var ranges = [];

  // add ranges type
  ranges.type = str.slice(0, index);

  // parse all ranges
  for (var i = 0; i < arr.length; i++) {
    var range = arr[i].split('-');
    var start = parseInt(range[0], 10);
    var end = parseInt(range[1], 10);

    // -nnn
    if (isNaN(start)) {
      start = size - end;
      end = size - 1;
    // nnn-
    } else if (isNaN(end)) {
      end = size - 1;
    }

    // limit last-byte-pos to current length
    if (end > size - 1) {
      end = size - 1;
    }

    // invalid or unsatisifiable
    if (isNaN(start) || isNaN(end) || start > end || start < 0) {
      continue
    }

    // add range
    ranges.push({
      start: start,
      end: end
    });
  }

  if (ranges.length < 1) {
    // unsatisifiable
    return -1
  }

  return options && options.combine
    ? combineRanges(ranges)
    : ranges
}

/**
 * Combine overlapping & adjacent ranges.
 * @private
 */

function combineRanges (ranges) {
  var ordered = ranges.map(mapWithIndex).sort(sortByRangeStart);

  for (var j = 0, i = 1; i < ordered.length; i++) {
    var range = ordered[i];
    var current = ordered[j];

    if (range.start > current.end + 1) {
      // next range
      ordered[++j] = range;
    } else if (range.end > current.end) {
      // extend range
      current.end = range.end;
      current.index = Math.min(current.index, range.index);
    }
  }

  // trim ordered array
  ordered.length = j + 1;

  // generate combined range
  var combined = ordered.sort(sortByRangeIndex).map(mapWithoutIndex);

  // copy ranges type
  combined.type = ranges.type;

  return combined
}

/**
 * Map function to add index value to ranges.
 * @private
 */

function mapWithIndex (range, index) {
  return {
    start: range.start,
    end: range.end,
    index: index
  }
}

/**
 * Map function to remove index value from ranges.
 * @private
 */

function mapWithoutIndex (range) {
  return {
    start: range.start,
    end: range.end
  }
}

/**
 * Sort function to sort ranges by index.
 * @private
 */

function sortByRangeIndex (a, b) {
  return a.index - b.index
}

/**
 * Sort function to sort ranges by start position.
 * @private
 */

function sortByRangeStart (a, b) {
  return a.start - b.start
}

/**
 * Module dependencies.
 * @private
 */


var debug$1 = src('send');
var deprecate = depd_1('send');










var path = require$$1__default['default'];




/**
 * Path function references.
 * @private
 */

var extname = path.extname;
var join = path.join;
var normalize = path.normalize;
var resolve = path.resolve;
var sep = path.sep;

/**
 * Regular expression for identifying a bytes Range header.
 * @private
 */

var BYTES_RANGE_REGEXP = /^ *bytes=/;

/**
 * Maximum value allowed for the max age.
 * @private
 */

var MAX_MAXAGE = 60 * 60 * 24 * 365 * 1000; // 1 year

/**
 * Regular expression to match a path with a directory up component.
 * @private
 */

var UP_PATH_REGEXP = /(?:^|[\\/])\.\.(?:[\\/]|$)/;

/**
 * Module exports.
 * @public
 */

var send_1 = send;
var mime_1$1 = mime_1;

/**
 * Return a `SendStream` for `req` and `path`.
 *
 * @param {object} req
 * @param {string} path
 * @param {object} [options]
 * @return {SendStream}
 * @public
 */

function send (req, path, options) {
  return new SendStream(req, path, options)
}

/**
 * Initialize a `SendStream` with the given `path`.
 *
 * @param {Request} req
 * @param {String} path
 * @param {object} [options]
 * @private
 */

function SendStream (req, path, options) {
  Stream__default['default'].call(this);

  var opts = options || {};

  this.options = opts;
  this.path = path;
  this.req = req;

  this._acceptRanges = opts.acceptRanges !== undefined
    ? Boolean(opts.acceptRanges)
    : true;

  this._cacheControl = opts.cacheControl !== undefined
    ? Boolean(opts.cacheControl)
    : true;

  this._etag = opts.etag !== undefined
    ? Boolean(opts.etag)
    : true;

  this._dotfiles = opts.dotfiles !== undefined
    ? opts.dotfiles
    : 'ignore';

  if (this._dotfiles !== 'ignore' && this._dotfiles !== 'allow' && this._dotfiles !== 'deny') {
    throw new TypeError('dotfiles option must be "allow", "deny", or "ignore"')
  }

  this._hidden = Boolean(opts.hidden);

  if (opts.hidden !== undefined) {
    deprecate('hidden: use dotfiles: \'' + (this._hidden ? 'allow' : 'ignore') + '\' instead');
  }

  // legacy support
  if (opts.dotfiles === undefined) {
    this._dotfiles = undefined;
  }

  this._extensions = opts.extensions !== undefined
    ? normalizeList(opts.extensions, 'extensions option')
    : [];

  this._immutable = opts.immutable !== undefined
    ? Boolean(opts.immutable)
    : false;

  this._index = opts.index !== undefined
    ? normalizeList(opts.index, 'index option')
    : ['index.html'];

  this._lastModified = opts.lastModified !== undefined
    ? Boolean(opts.lastModified)
    : true;

  this._maxage = opts.maxAge || opts.maxage;
  this._maxage = typeof this._maxage === 'string'
    ? ms$1(this._maxage)
    : Number(this._maxage);
  this._maxage = !isNaN(this._maxage)
    ? Math.min(Math.max(0, this._maxage), MAX_MAXAGE)
    : 0;

  this._root = opts.root
    ? resolve(opts.root)
    : null;

  if (!this._root && opts.from) {
    this.from(opts.from);
  }
}

/**
 * Inherits from `Stream`.
 */

util__default['default'].inherits(SendStream, Stream__default['default']);

/**
 * Enable or disable etag generation.
 *
 * @param {Boolean} val
 * @return {SendStream}
 * @api public
 */

SendStream.prototype.etag = deprecate.function(function etag (val) {
  this._etag = Boolean(val);
  debug$1('etag %s', this._etag);
  return this
}, 'send.etag: pass etag as option');

/**
 * Enable or disable "hidden" (dot) files.
 *
 * @param {Boolean} path
 * @return {SendStream}
 * @api public
 */

SendStream.prototype.hidden = deprecate.function(function hidden (val) {
  this._hidden = Boolean(val);
  this._dotfiles = undefined;
  debug$1('hidden %s', this._hidden);
  return this
}, 'send.hidden: use dotfiles option');

/**
 * Set index `paths`, set to a falsy
 * value to disable index support.
 *
 * @param {String|Boolean|Array} paths
 * @return {SendStream}
 * @api public
 */

SendStream.prototype.index = deprecate.function(function index (paths) {
  var index = !paths ? [] : normalizeList(paths, 'paths argument');
  debug$1('index %o', paths);
  this._index = index;
  return this
}, 'send.index: pass index as option');

/**
 * Set root `path`.
 *
 * @param {String} path
 * @return {SendStream}
 * @api public
 */

SendStream.prototype.root = function root (path) {
  this._root = resolve(String(path));
  debug$1('root %s', this._root);
  return this
};

SendStream.prototype.from = deprecate.function(SendStream.prototype.root,
  'send.from: pass root as option');

SendStream.prototype.root = deprecate.function(SendStream.prototype.root,
  'send.root: pass root as option');

/**
 * Set max-age to `maxAge`.
 *
 * @param {Number} maxAge
 * @return {SendStream}
 * @api public
 */

SendStream.prototype.maxage = deprecate.function(function maxage (maxAge) {
  this._maxage = typeof maxAge === 'string'
    ? ms$1(maxAge)
    : Number(maxAge);
  this._maxage = !isNaN(this._maxage)
    ? Math.min(Math.max(0, this._maxage), MAX_MAXAGE)
    : 0;
  debug$1('max-age %d', this._maxage);
  return this
}, 'send.maxage: pass maxAge as option');

/**
 * Emit error with `status`.
 *
 * @param {number} status
 * @param {Error} [err]
 * @private
 */

SendStream.prototype.error = function error (status, err) {
  // emit if listeners instead of responding
  if (hasListeners(this, 'error')) {
    return this.emit('error', httpErrors(status, err, {
      expose: false
    }))
  }

  var res = this.res;
  var msg = statuses[status] || String(status);
  var doc = createHtmlDocument('Error', escapeHtml_1(msg));

  // clear existing headers
  clearHeaders(res);

  // add error headers
  if (err && err.headers) {
    setHeaders(res, err.headers);
  }

  // send basic response
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/html; charset=UTF-8');
  res.setHeader('Content-Length', Buffer.byteLength(doc));
  res.setHeader('Content-Security-Policy', "default-src 'none'");
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(doc);
};

/**
 * Check if the pathname ends with "/".
 *
 * @return {boolean}
 * @private
 */

SendStream.prototype.hasTrailingSlash = function hasTrailingSlash () {
  return this.path[this.path.length - 1] === '/'
};

/**
 * Check if this is a conditional GET request.
 *
 * @return {Boolean}
 * @api private
 */

SendStream.prototype.isConditionalGET = function isConditionalGET () {
  return this.req.headers['if-match'] ||
    this.req.headers['if-unmodified-since'] ||
    this.req.headers['if-none-match'] ||
    this.req.headers['if-modified-since']
};

/**
 * Check if the request preconditions failed.
 *
 * @return {boolean}
 * @private
 */

SendStream.prototype.isPreconditionFailure = function isPreconditionFailure () {
  var req = this.req;
  var res = this.res;

  // if-match
  var match = req.headers['if-match'];
  if (match) {
    var etag = res.getHeader('ETag');
    return !etag || (match !== '*' && parseTokenList$1(match).every(function (match) {
      return match !== etag && match !== 'W/' + etag && 'W/' + match !== etag
    }))
  }

  // if-unmodified-since
  var unmodifiedSince = parseHttpDate$1(req.headers['if-unmodified-since']);
  if (!isNaN(unmodifiedSince)) {
    var lastModified = parseHttpDate$1(res.getHeader('Last-Modified'));
    return isNaN(lastModified) || lastModified > unmodifiedSince
  }

  return false
};

/**
 * Strip content-* header fields.
 *
 * @private
 */

SendStream.prototype.removeContentHeaderFields = function removeContentHeaderFields () {
  var res = this.res;
  var headers = getHeaderNames(res);

  for (var i = 0; i < headers.length; i++) {
    var header = headers[i];
    if (header.substr(0, 8) === 'content-' && header !== 'content-location') {
      res.removeHeader(header);
    }
  }
};

/**
 * Respond with 304 not modified.
 *
 * @api private
 */

SendStream.prototype.notModified = function notModified () {
  var res = this.res;
  debug$1('not modified');
  this.removeContentHeaderFields();
  res.statusCode = 304;
  res.end();
};

/**
 * Raise error that headers already sent.
 *
 * @api private
 */

SendStream.prototype.headersAlreadySent = function headersAlreadySent () {
  var err = new Error('Can\'t set headers after they are sent.');
  debug$1('headers already sent');
  this.error(500, err);
};

/**
 * Check if the request is cacheable, aka
 * responded with 2xx or 304 (see RFC 2616 section 14.2{5,6}).
 *
 * @return {Boolean}
 * @api private
 */

SendStream.prototype.isCachable = function isCachable () {
  var statusCode = this.res.statusCode;
  return (statusCode >= 200 && statusCode < 300) ||
    statusCode === 304
};

/**
 * Handle stat() error.
 *
 * @param {Error} error
 * @private
 */

SendStream.prototype.onStatError = function onStatError (error) {
  switch (error.code) {
    case 'ENAMETOOLONG':
    case 'ENOENT':
    case 'ENOTDIR':
      this.error(404, error);
      break
    default:
      this.error(500, error);
      break
  }
};

/**
 * Check if the cache is fresh.
 *
 * @return {Boolean}
 * @api private
 */

SendStream.prototype.isFresh = function isFresh () {
  return fresh_1(this.req.headers, {
    'etag': this.res.getHeader('ETag'),
    'last-modified': this.res.getHeader('Last-Modified')
  })
};

/**
 * Check if the range is fresh.
 *
 * @return {Boolean}
 * @api private
 */

SendStream.prototype.isRangeFresh = function isRangeFresh () {
  var ifRange = this.req.headers['if-range'];

  if (!ifRange) {
    return true
  }

  // if-range as etag
  if (ifRange.indexOf('"') !== -1) {
    var etag = this.res.getHeader('ETag');
    return Boolean(etag && ifRange.indexOf(etag) !== -1)
  }

  // if-range as modified date
  var lastModified = this.res.getHeader('Last-Modified');
  return parseHttpDate$1(lastModified) <= parseHttpDate$1(ifRange)
};

/**
 * Redirect to path.
 *
 * @param {string} path
 * @private
 */

SendStream.prototype.redirect = function redirect (path) {
  var res = this.res;

  if (hasListeners(this, 'directory')) {
    this.emit('directory', res, path);
    return
  }

  if (this.hasTrailingSlash()) {
    this.error(403);
    return
  }

  var loc = encodeurl(collapseLeadingSlashes(this.path + '/'));
  var doc = createHtmlDocument('Redirecting', 'Redirecting to <a href="' + escapeHtml_1(loc) + '">' +
    escapeHtml_1(loc) + '</a>');

  // redirect
  res.statusCode = 301;
  res.setHeader('Content-Type', 'text/html; charset=UTF-8');
  res.setHeader('Content-Length', Buffer.byteLength(doc));
  res.setHeader('Content-Security-Policy', "default-src 'none'");
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Location', loc);
  res.end(doc);
};

/**
 * Pipe to `res.
 *
 * @param {Stream} res
 * @return {Stream} res
 * @api public
 */

SendStream.prototype.pipe = function pipe (res) {
  // root path
  var root = this._root;

  // references
  this.res = res;

  // decode the path
  var path = decode(this.path);
  if (path === -1) {
    this.error(400);
    return res
  }

  // null byte(s)
  if (~path.indexOf('\0')) {
    this.error(400);
    return res
  }

  var parts;
  if (root !== null) {
    // normalize
    if (path) {
      path = normalize('.' + sep + path);
    }

    // malicious path
    if (UP_PATH_REGEXP.test(path)) {
      debug$1('malicious path "%s"', path);
      this.error(403);
      return res
    }

    // explode path parts
    parts = path.split(sep);

    // join / normalize from optional root dir
    path = normalize(join(root, path));
  } else {
    // ".." is malicious without "root"
    if (UP_PATH_REGEXP.test(path)) {
      debug$1('malicious path "%s"', path);
      this.error(403);
      return res
    }

    // explode path parts
    parts = normalize(path).split(sep);

    // resolve the path
    path = resolve(path);
  }

  // dotfile handling
  if (containsDotFile(parts)) {
    var access = this._dotfiles;

    // legacy support
    if (access === undefined) {
      access = parts[parts.length - 1][0] === '.'
        ? (this._hidden ? 'allow' : 'ignore')
        : 'allow';
    }

    debug$1('%s dotfile "%s"', access, path);
    switch (access) {
      case 'allow':
        break
      case 'deny':
        this.error(403);
        return res
      case 'ignore':
      default:
        this.error(404);
        return res
    }
  }

  // index file support
  if (this._index.length && this.hasTrailingSlash()) {
    this.sendIndex(path);
    return res
  }

  this.sendFile(path);
  return res
};

/**
 * Transfer `path`.
 *
 * @param {String} path
 * @api public
 */

SendStream.prototype.send = function send (path, stat) {
  var len = stat.size;
  var options = this.options;
  var opts = {};
  var res = this.res;
  var req = this.req;
  var ranges = req.headers.range;
  var offset = options.start || 0;

  if (headersSent(res)) {
    // impossible to send now
    this.headersAlreadySent();
    return
  }

  debug$1('pipe "%s"', path);

  // set header fields
  this.setHeader(path, stat);

  // set content-type
  this.type(path);

  // conditional GET support
  if (this.isConditionalGET()) {
    if (this.isPreconditionFailure()) {
      this.error(412);
      return
    }

    if (this.isCachable() && this.isFresh()) {
      this.notModified();
      return
    }
  }

  // adjust len to start/end options
  len = Math.max(0, len - offset);
  if (options.end !== undefined) {
    var bytes = options.end - offset + 1;
    if (len > bytes) len = bytes;
  }

  // Range support
  if (this._acceptRanges && BYTES_RANGE_REGEXP.test(ranges)) {
    // parse
    ranges = rangeParser_1(len, ranges, {
      combine: true
    });

    // If-Range support
    if (!this.isRangeFresh()) {
      debug$1('range stale');
      ranges = -2;
    }

    // unsatisfiable
    if (ranges === -1) {
      debug$1('range unsatisfiable');

      // Content-Range
      res.setHeader('Content-Range', contentRange('bytes', len));

      // 416 Requested Range Not Satisfiable
      return this.error(416, {
        headers: { 'Content-Range': res.getHeader('Content-Range') }
      })
    }

    // valid (syntactically invalid/multiple ranges are treated as a regular response)
    if (ranges !== -2 && ranges.length === 1) {
      debug$1('range %j', ranges);

      // Content-Range
      res.statusCode = 206;
      res.setHeader('Content-Range', contentRange('bytes', len, ranges[0]));

      // adjust for requested range
      offset += ranges[0].start;
      len = ranges[0].end - ranges[0].start + 1;
    }
  }

  // clone options
  for (var prop in options) {
    opts[prop] = options[prop];
  }

  // set read options
  opts.start = offset;
  opts.end = Math.max(offset, offset + len - 1);

  // content-length
  res.setHeader('Content-Length', len);

  // HEAD support
  if (req.method === 'HEAD') {
    res.end();
    return
  }

  this.stream(path, opts);
};

/**
 * Transfer file for `path`.
 *
 * @param {String} path
 * @api private
 */
SendStream.prototype.sendFile = function sendFile (path) {
  var i = 0;
  var self = this;

  debug$1('stat "%s"', path);
  fs__default['default'].stat(path, function onstat (err, stat) {
    if (err && err.code === 'ENOENT' && !extname(path) && path[path.length - 1] !== sep) {
      // not found, check extensions
      return next(err)
    }
    if (err) return self.onStatError(err)
    if (stat.isDirectory()) return self.redirect(path)
    self.emit('file', path, stat);
    self.send(path, stat);
  });

  function next (err) {
    if (self._extensions.length <= i) {
      return err
        ? self.onStatError(err)
        : self.error(404)
    }

    var p = path + '.' + self._extensions[i++];

    debug$1('stat "%s"', p);
    fs__default['default'].stat(p, function (err, stat) {
      if (err) return next(err)
      if (stat.isDirectory()) return next()
      self.emit('file', p, stat);
      self.send(p, stat);
    });
  }
};

/**
 * Transfer index for `path`.
 *
 * @param {String} path
 * @api private
 */
SendStream.prototype.sendIndex = function sendIndex (path) {
  var i = -1;
  var self = this;

  function next (err) {
    if (++i >= self._index.length) {
      if (err) return self.onStatError(err)
      return self.error(404)
    }

    var p = join(path, self._index[i]);

    debug$1('stat "%s"', p);
    fs__default['default'].stat(p, function (err, stat) {
      if (err) return next(err)
      if (stat.isDirectory()) return next()
      self.emit('file', p, stat);
      self.send(p, stat);
    });
  }

  next();
};

/**
 * Stream `path` to the response.
 *
 * @param {String} path
 * @param {Object} options
 * @api private
 */

SendStream.prototype.stream = function stream (path, options) {
  // TODO: this is all lame, refactor meeee
  var finished = false;
  var self = this;
  var res = this.res;

  // pipe
  var stream = fs__default['default'].createReadStream(path, options);
  this.emit('stream', stream);
  stream.pipe(res);

  // response finished, done with the fd
  onFinished_1(res, function onfinished () {
    finished = true;
    destroy_1(stream);
  });

  // error handling code-smell
  stream.on('error', function onerror (err) {
    // request already finished
    if (finished) return

    // clean up stream
    finished = true;
    destroy_1(stream);

    // error
    self.onStatError(err);
  });

  // end
  stream.on('end', function onend () {
    self.emit('end');
  });
};

/**
 * Set content-type based on `path`
 * if it hasn't been explicitly set.
 *
 * @param {String} path
 * @api private
 */

SendStream.prototype.type = function type (path) {
  var res = this.res;

  if (res.getHeader('Content-Type')) return

  var type = mime_1.lookup(path);

  if (!type) {
    debug$1('no content-type');
    return
  }

  var charset = mime_1.charsets.lookup(type);

  debug$1('content-type %s', type);
  res.setHeader('Content-Type', type + (charset ? '; charset=' + charset : ''));
};

/**
 * Set response header fields, most
 * fields may be pre-defined.
 *
 * @param {String} path
 * @param {Object} stat
 * @api private
 */

SendStream.prototype.setHeader = function setHeader (path, stat) {
  var res = this.res;

  this.emit('headers', res, path, stat);

  if (this._acceptRanges && !res.getHeader('Accept-Ranges')) {
    debug$1('accept ranges');
    res.setHeader('Accept-Ranges', 'bytes');
  }

  if (this._cacheControl && !res.getHeader('Cache-Control')) {
    var cacheControl = 'public, max-age=' + Math.floor(this._maxage / 1000);

    if (this._immutable) {
      cacheControl += ', immutable';
    }

    debug$1('cache-control %s', cacheControl);
    res.setHeader('Cache-Control', cacheControl);
  }

  if (this._lastModified && !res.getHeader('Last-Modified')) {
    var modified = stat.mtime.toUTCString();
    debug$1('modified %s', modified);
    res.setHeader('Last-Modified', modified);
  }

  if (this._etag && !res.getHeader('ETag')) {
    var val = etag_1(stat);
    debug$1('etag %s', val);
    res.setHeader('ETag', val);
  }
};

/**
 * Clear all headers from a response.
 *
 * @param {object} res
 * @private
 */

function clearHeaders (res) {
  var headers = getHeaderNames(res);

  for (var i = 0; i < headers.length; i++) {
    res.removeHeader(headers[i]);
  }
}

/**
 * Collapse all leading slashes into a single slash
 *
 * @param {string} str
 * @private
 */
function collapseLeadingSlashes (str) {
  for (var i = 0; i < str.length; i++) {
    if (str[i] !== '/') {
      break
    }
  }

  return i > 1
    ? '/' + str.substr(i)
    : str
}

/**
 * Determine if path parts contain a dotfile.
 *
 * @api private
 */

function containsDotFile (parts) {
  for (var i = 0; i < parts.length; i++) {
    var part = parts[i];
    if (part.length > 1 && part[0] === '.') {
      return true
    }
  }

  return false
}

/**
 * Create a Content-Range header.
 *
 * @param {string} type
 * @param {number} size
 * @param {array} [range]
 */

function contentRange (type, size, range) {
  return type + ' ' + (range ? range.start + '-' + range.end : '*') + '/' + size
}

/**
 * Create a minimal HTML document.
 *
 * @param {string} title
 * @param {string} body
 * @private
 */

function createHtmlDocument (title, body) {
  return '<!DOCTYPE html>\n' +
    '<html lang="en">\n' +
    '<head>\n' +
    '<meta charset="utf-8">\n' +
    '<title>' + title + '</title>\n' +
    '</head>\n' +
    '<body>\n' +
    '<pre>' + body + '</pre>\n' +
    '</body>\n' +
    '</html>\n'
}

/**
 * decodeURIComponent.
 *
 * Allows V8 to only deoptimize this fn instead of all
 * of send().
 *
 * @param {String} path
 * @api private
 */

function decode (path) {
  try {
    return decodeURIComponent(path)
  } catch (err) {
    return -1
  }
}

/**
 * Get the header names on a respnse.
 *
 * @param {object} res
 * @returns {array[string]}
 * @private
 */

function getHeaderNames (res) {
  return typeof res.getHeaderNames !== 'function'
    ? Object.keys(res._headers || {})
    : res.getHeaderNames()
}

/**
 * Determine if emitter has listeners of a given type.
 *
 * The way to do this check is done three different ways in Node.js >= 0.8
 * so this consolidates them into a minimal set using instance methods.
 *
 * @param {EventEmitter} emitter
 * @param {string} type
 * @returns {boolean}
 * @private
 */

function hasListeners (emitter, type) {
  var count = typeof emitter.listenerCount !== 'function'
    ? emitter.listeners(type).length
    : emitter.listenerCount(type);

  return count > 0
}

/**
 * Determine if the response headers have been sent.
 *
 * @param {object} res
 * @returns {boolean}
 * @private
 */

function headersSent (res) {
  return typeof res.headersSent !== 'boolean'
    ? Boolean(res._header)
    : res.headersSent
}

/**
 * Normalize the index option into an array.
 *
 * @param {boolean|string|array} val
 * @param {string} name
 * @private
 */

function normalizeList (val, name) {
  var list = [].concat(val || []);

  for (var i = 0; i < list.length; i++) {
    if (typeof list[i] !== 'string') {
      throw new TypeError(name + ' must be array of strings or false')
    }
  }

  return list
}

/**
 * Parse an HTTP Date into a number.
 *
 * @param {string} date
 * @private
 */

function parseHttpDate$1 (date) {
  var timestamp = date && Date.parse(date);

  return typeof timestamp === 'number'
    ? timestamp
    : NaN
}

/**
 * Parse a HTTP token list.
 *
 * @param {string} str
 * @private
 */

function parseTokenList$1 (str) {
  var end = 0;
  var list = [];
  var start = 0;

  // gather tokens
  for (var i = 0, len = str.length; i < len; i++) {
    switch (str.charCodeAt(i)) {
      case 0x20: /*   */
        if (start === end) {
          start = end = i + 1;
        }
        break
      case 0x2c: /* , */
        list.push(str.substring(start, end));
        start = end = i + 1;
        break
      default:
        end = i + 1;
        break
    }
  }

  // final token
  list.push(str.substring(start, end));

  return list
}

/**
 * Set an object of headers on a response.
 *
 * @param {object} res
 * @param {object} headers
 * @private
 */

function setHeaders (res, headers) {
  var keys = Object.keys(headers);

  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    res.setHeader(key, headers[key]);
  }
}
send_1.mime = mime_1$1;

function getContentType(extWithoutDot) {
    const { mime } = send_1;
    if ("getType" in mime) {
        // 2.0
        return mime.getType(extWithoutDot);
    }
    // 1.0
    return mime.lookup(extWithoutDot);
}
function getExtension(contentType) {
    const { mime } = send_1;
    if ("getExtension" in mime) {
        // 2.0
        return mime.getExtension(contentType);
    }
    // 1.0
    return mime.extension(contentType);
}

/**
 * Returns total length of data blocks sequence
 *
 * @param {Buffer} buffer
 * @param {number} offset
 * @returns {number}
 */
function getDataBlocksLength (buffer, offset) {
  var length = 0;

  while (buffer[offset + length]) {
    length += buffer[offset + length] + 1;
  }

  return length + 1
}

/**
 * Checks if buffer contains GIF image
 *
 * @param {Buffer} buffer
 * @returns {boolean}
 */
var isGIF = function (buffer) {
  var header = buffer.slice(0, 3).toString('ascii');
  return (header === 'GIF')
};

/**
 * Checks if buffer contains animated GIF image
 *
 * @param {Buffer} buffer
 * @returns {boolean}
 */
var isAnimated = function (buffer) {
  var hasColorTable, colorTableSize, header;
  var offset = 0;
  var imagesCount = 0;

  // Check if this is this image has valid GIF header.
  // If not return false. Chrome, FF and IE doesn't handle GIFs with invalid version.
  header = buffer.slice(0, 3).toString('ascii');

  if (header !== 'GIF') {
    return false
  }

  // Skip header, logical screen descriptor and global color table

  hasColorTable = buffer[10] & 0x80; // 0b10000000
  colorTableSize = buffer[10] & 0x07; // 0b00000111

  offset += 6; // skip header
  offset += 7; // skip logical screen descriptor
  offset += hasColorTable ? 3 * Math.pow(2, colorTableSize + 1) : 0; // skip global color table

  // Find if there is more than one image descriptor

  while (imagesCount < 2 && offset < buffer.length) {
    switch (buffer[offset]) {
      // Image descriptor block. According to specification there could be any
      // number of these blocks (even zero). When there is more than one image
      // descriptor browsers will display animation (they shouldn't when there
      // is no delays defined, but they do it anyway).
      case 0x2C:
        imagesCount += 1;

        hasColorTable = buffer[offset + 9] & 0x80; // 0b10000000
        colorTableSize = buffer[offset + 9] & 0x07; // 0b00000111

        offset += 10; // skip image descriptor
        offset += hasColorTable ? 3 * Math.pow(2, colorTableSize + 1) : 0; // skip local color table
        offset += getDataBlocksLength(buffer, offset + 1) + 1; // skip image data

        break

      // Skip all extension blocks. In theory this "plain text extension" blocks
      // could be frames of animation, but no browser renders them.
      case 0x21:
        offset += 2; // skip introducer and label
        offset += getDataBlocksLength(buffer, offset); // skip this block and following data blocks

        break

      // Stop processing on trailer block,
      // all data after this point will is ignored by decoders
      case 0x3B:
        offset = buffer.length; // fast forward to end of buffer
        break

      // Oops! This GIF seems to be invalid
      default:
        offset = buffer.length; // fast forward to end of buffer
        break
    }
  }

  return (imagesCount > 1)
};

var gif = {
	isGIF: isGIF,
	isAnimated: isAnimated
};

var isPNG = function (buffer) {
  var header = buffer.slice(0, 8).toString('hex');
  return (header === '89504e470d0a1a0a') // \211 P N G \r \n \032 'n
};

var isAnimated$1 = function (buffer) {
  var hasACTL = false;
  var hasIDAT = false;
  var hasFDAT = false;

  var previousChunkType = null;

  var offset = 8;

  while (offset < buffer.length) {
    var chunkLength = buffer.readUInt32BE(offset);
    var chunkType = buffer.slice(offset + 4, offset + 8).toString('ascii');

    switch (chunkType) {
      case 'acTL':
        hasACTL = true;
        break
      case 'IDAT':
        if (!hasACTL) {
          return false
        }

        if (previousChunkType !== 'fcTL') {
          return false
        }

        hasIDAT = true;
        break
      case 'fdAT':
        if (!hasIDAT) {
          return false
        }

        if (previousChunkType !== 'fcTL') {
          return false
        }

        hasFDAT = true;
        break
    }

    previousChunkType = chunkType;
    offset += 4 + 4 + chunkLength + 4;
  }

  return (hasACTL && hasIDAT && hasFDAT)
};

var png = {
	isPNG: isPNG,
	isAnimated: isAnimated$1
};

/**
 * @since 2019-02-27 10:20
 * @author vivaxy
 */

var isWebp = function (buffer) {
  var WEBP = [0x57, 0x45, 0x42, 0x50];
  for (var i = 0; i < WEBP.length; i++) {
    if (buffer[i + 8] !== WEBP[i]) {
      return false
    }
  }
  return true
};

var isAnimated$2 = function (buffer) {
  var ANIM = [0x41, 0x4E, 0x49, 0x4D];
  for (var i = 0; i < buffer.length; i++) {
    for (var j = 0; j < ANIM.length; j++) {
      if (buffer[i + j] !== ANIM[j]) {
        break
      }
    }
    if (j === ANIM.length) {
      return true
    }
  }
  return false
};

var webp = {
	isWebp: isWebp,
	isAnimated: isAnimated$2
};

/**
 * Checks if buffer contains animated image
 *
 * @param {Buffer} buffer
 * @returns {boolean}
 */
function isAnimated$3 (buffer) {
  if (gif.isGIF(buffer)) {
    return gif.isAnimated(buffer)
  }

  if (png.isPNG(buffer)) {
    return png.isAnimated(buffer)
  }

  if (webp.isWebp(buffer)) {
    return webp.isAnimated(buffer)
  }

  return false
}

var lib$3 = isAnimated$3;

function sendEtagResponse(req, res, etag) {
    if (etag) {
        /**
         * The server generating a 304 response MUST generate any of the
         * following header fields that would have been sent in a 200 (OK)
         * response to the same request: Cache-Control, Content-Location, Date,
         * ETag, Expires, and Vary. https://tools.ietf.org/html/rfc7232#section-4.1
         */
        res.setHeader("ETag", etag);
    }
    if (fresh_1(req.headers, { etag })) {
        res.statusCode = 304;
        res.end();
        return true;
    }
    return false;
}

const imageConfigDefault = {
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    path: "/_next/image",
    loader: "default",
    domains: []
};

const buildS3RetryStrategy = async () => {
    const { defaultRetryDecider, StandardRetryStrategy } = await Promise.resolve().then(function () { return index; });
    const retryDecider = (err) => {
        if ("code" in err &&
            (err.code === "ECONNRESET" ||
                err.code === "EPIPE" ||
                err.code === "ETIMEDOUT")) {
            return true;
        }
        else {
            return defaultRetryDecider(err);
        }
    };
    return new StandardRetryStrategy(async () => 3, {
        retryDecider
    });
};

// Based on https://github.com/tmpvar/jsdom/blob/aa85b2abf07766ff7bf5c1f6daafb3726f2f2db5/lib/jsdom/living/blob.js

// fix for "Readable" isn't a named export issue
const Readable = Stream__default['default'].Readable;

const BUFFER = Symbol('buffer');
const TYPE = Symbol('type');

class Blob {
	constructor() {
		this[TYPE] = '';

		const blobParts = arguments[0];
		const options = arguments[1];

		const buffers = [];
		let size = 0;

		if (blobParts) {
			const a = blobParts;
			const length = Number(a.length);
			for (let i = 0; i < length; i++) {
				const element = a[i];
				let buffer;
				if (element instanceof Buffer) {
					buffer = element;
				} else if (ArrayBuffer.isView(element)) {
					buffer = Buffer.from(element.buffer, element.byteOffset, element.byteLength);
				} else if (element instanceof ArrayBuffer) {
					buffer = Buffer.from(element);
				} else if (element instanceof Blob) {
					buffer = element[BUFFER];
				} else {
					buffer = Buffer.from(typeof element === 'string' ? element : String(element));
				}
				size += buffer.length;
				buffers.push(buffer);
			}
		}

		this[BUFFER] = Buffer.concat(buffers);

		let type = options && options.type !== undefined && String(options.type).toLowerCase();
		if (type && !/[^\u0020-\u007E]/.test(type)) {
			this[TYPE] = type;
		}
	}
	get size() {
		return this[BUFFER].length;
	}
	get type() {
		return this[TYPE];
	}
	text() {
		return Promise.resolve(this[BUFFER].toString());
	}
	arrayBuffer() {
		const buf = this[BUFFER];
		const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
		return Promise.resolve(ab);
	}
	stream() {
		const readable = new Readable();
		readable._read = function () {};
		readable.push(this[BUFFER]);
		readable.push(null);
		return readable;
	}
	toString() {
		return '[object Blob]';
	}
	slice() {
		const size = this.size;

		const start = arguments[0];
		const end = arguments[1];
		let relativeStart, relativeEnd;
		if (start === undefined) {
			relativeStart = 0;
		} else if (start < 0) {
			relativeStart = Math.max(size + start, 0);
		} else {
			relativeStart = Math.min(start, size);
		}
		if (end === undefined) {
			relativeEnd = size;
		} else if (end < 0) {
			relativeEnd = Math.max(size + end, 0);
		} else {
			relativeEnd = Math.min(end, size);
		}
		const span = Math.max(relativeEnd - relativeStart, 0);

		const buffer = this[BUFFER];
		const slicedBuffer = buffer.slice(relativeStart, relativeStart + span);
		const blob = new Blob([], { type: arguments[2] });
		blob[BUFFER] = slicedBuffer;
		return blob;
	}
}

Object.defineProperties(Blob.prototype, {
	size: { enumerable: true },
	type: { enumerable: true },
	slice: { enumerable: true }
});

Object.defineProperty(Blob.prototype, Symbol.toStringTag, {
	value: 'Blob',
	writable: false,
	enumerable: false,
	configurable: true
});

/**
 * fetch-error.js
 *
 * FetchError interface for operational errors
 */

/**
 * Create FetchError instance
 *
 * @param   String      message      Error message for human
 * @param   String      type         Error type for machine
 * @param   String      systemError  For Node.js system error
 * @return  FetchError
 */
function FetchError(message, type, systemError) {
  Error.call(this, message);

  this.message = message;
  this.type = type;

  // when err.type is `system`, err.code contains system error code
  if (systemError) {
    this.code = this.errno = systemError.code;
  }

  // hide custom error implementation details from end-users
  Error.captureStackTrace(this, this.constructor);
}

FetchError.prototype = Object.create(Error.prototype);
FetchError.prototype.constructor = FetchError;
FetchError.prototype.name = 'FetchError';

let convert;
try {
	convert = require('encoding').convert;
} catch (e) {}

const INTERNALS = Symbol('Body internals');

// fix an issue where "PassThrough" isn't a named export for node <10
const PassThrough = Stream__default['default'].PassThrough;

/**
 * Body mixin
 *
 * Ref: https://fetch.spec.whatwg.org/#body
 *
 * @param   Stream  body  Readable stream
 * @param   Object  opts  Response options
 * @return  Void
 */
function Body(body) {
	var _this = this;

	var _ref = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {},
	    _ref$size = _ref.size;

	let size = _ref$size === undefined ? 0 : _ref$size;
	var _ref$timeout = _ref.timeout;
	let timeout = _ref$timeout === undefined ? 0 : _ref$timeout;

	if (body == null) {
		// body is undefined or null
		body = null;
	} else if (isURLSearchParams(body)) {
		// body is a URLSearchParams
		body = Buffer.from(body.toString());
	} else if (isBlob(body)) ; else if (Buffer.isBuffer(body)) ; else if (Object.prototype.toString.call(body) === '[object ArrayBuffer]') {
		// body is ArrayBuffer
		body = Buffer.from(body);
	} else if (ArrayBuffer.isView(body)) {
		// body is ArrayBufferView
		body = Buffer.from(body.buffer, body.byteOffset, body.byteLength);
	} else if (body instanceof Stream__default['default']) ; else {
		// none of the above
		// coerce to string then buffer
		body = Buffer.from(String(body));
	}
	this[INTERNALS] = {
		body,
		disturbed: false,
		error: null
	};
	this.size = size;
	this.timeout = timeout;

	if (body instanceof Stream__default['default']) {
		body.on('error', function (err) {
			const error = err.name === 'AbortError' ? err : new FetchError(`Invalid response body while trying to fetch ${_this.url}: ${err.message}`, 'system', err);
			_this[INTERNALS].error = error;
		});
	}
}

Body.prototype = {
	get body() {
		return this[INTERNALS].body;
	},

	get bodyUsed() {
		return this[INTERNALS].disturbed;
	},

	/**
  * Decode response as ArrayBuffer
  *
  * @return  Promise
  */
	arrayBuffer() {
		return consumeBody.call(this).then(function (buf) {
			return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
		});
	},

	/**
  * Return raw response as Blob
  *
  * @return Promise
  */
	blob() {
		let ct = this.headers && this.headers.get('content-type') || '';
		return consumeBody.call(this).then(function (buf) {
			return Object.assign(
			// Prevent copying
			new Blob([], {
				type: ct.toLowerCase()
			}), {
				[BUFFER]: buf
			});
		});
	},

	/**
  * Decode response as json
  *
  * @return  Promise
  */
	json() {
		var _this2 = this;

		return consumeBody.call(this).then(function (buffer) {
			try {
				return JSON.parse(buffer.toString());
			} catch (err) {
				return Body.Promise.reject(new FetchError(`invalid json response body at ${_this2.url} reason: ${err.message}`, 'invalid-json'));
			}
		});
	},

	/**
  * Decode response as text
  *
  * @return  Promise
  */
	text() {
		return consumeBody.call(this).then(function (buffer) {
			return buffer.toString();
		});
	},

	/**
  * Decode response as buffer (non-spec api)
  *
  * @return  Promise
  */
	buffer() {
		return consumeBody.call(this);
	},

	/**
  * Decode response as text, while automatically detecting the encoding and
  * trying to decode to UTF-8 (non-spec api)
  *
  * @return  Promise
  */
	textConverted() {
		var _this3 = this;

		return consumeBody.call(this).then(function (buffer) {
			return convertBody(buffer, _this3.headers);
		});
	}
};

// In browsers, all properties are enumerable.
Object.defineProperties(Body.prototype, {
	body: { enumerable: true },
	bodyUsed: { enumerable: true },
	arrayBuffer: { enumerable: true },
	blob: { enumerable: true },
	json: { enumerable: true },
	text: { enumerable: true }
});

Body.mixIn = function (proto) {
	for (const name of Object.getOwnPropertyNames(Body.prototype)) {
		// istanbul ignore else: future proof
		if (!(name in proto)) {
			const desc = Object.getOwnPropertyDescriptor(Body.prototype, name);
			Object.defineProperty(proto, name, desc);
		}
	}
};

/**
 * Consume and convert an entire Body to a Buffer.
 *
 * Ref: https://fetch.spec.whatwg.org/#concept-body-consume-body
 *
 * @return  Promise
 */
function consumeBody() {
	var _this4 = this;

	if (this[INTERNALS].disturbed) {
		return Body.Promise.reject(new TypeError(`body used already for: ${this.url}`));
	}

	this[INTERNALS].disturbed = true;

	if (this[INTERNALS].error) {
		return Body.Promise.reject(this[INTERNALS].error);
	}

	let body = this.body;

	// body is null
	if (body === null) {
		return Body.Promise.resolve(Buffer.alloc(0));
	}

	// body is blob
	if (isBlob(body)) {
		body = body.stream();
	}

	// body is buffer
	if (Buffer.isBuffer(body)) {
		return Body.Promise.resolve(body);
	}

	// istanbul ignore if: should never happen
	if (!(body instanceof Stream__default['default'])) {
		return Body.Promise.resolve(Buffer.alloc(0));
	}

	// body is stream
	// get ready to actually consume the body
	let accum = [];
	let accumBytes = 0;
	let abort = false;

	return new Body.Promise(function (resolve, reject) {
		let resTimeout;

		// allow timeout on slow response body
		if (_this4.timeout) {
			resTimeout = setTimeout(function () {
				abort = true;
				reject(new FetchError(`Response timeout while trying to fetch ${_this4.url} (over ${_this4.timeout}ms)`, 'body-timeout'));
			}, _this4.timeout);
		}

		// handle stream errors
		body.on('error', function (err) {
			if (err.name === 'AbortError') {
				// if the request was aborted, reject with this Error
				abort = true;
				reject(err);
			} else {
				// other errors, such as incorrect content-encoding
				reject(new FetchError(`Invalid response body while trying to fetch ${_this4.url}: ${err.message}`, 'system', err));
			}
		});

		body.on('data', function (chunk) {
			if (abort || chunk === null) {
				return;
			}

			if (_this4.size && accumBytes + chunk.length > _this4.size) {
				abort = true;
				reject(new FetchError(`content size at ${_this4.url} over limit: ${_this4.size}`, 'max-size'));
				return;
			}

			accumBytes += chunk.length;
			accum.push(chunk);
		});

		body.on('end', function () {
			if (abort) {
				return;
			}

			clearTimeout(resTimeout);

			try {
				resolve(Buffer.concat(accum, accumBytes));
			} catch (err) {
				// handle streams that have accumulated too much data (issue #414)
				reject(new FetchError(`Could not create Buffer from response body for ${_this4.url}: ${err.message}`, 'system', err));
			}
		});
	});
}

/**
 * Detect buffer encoding and convert to target encoding
 * ref: http://www.w3.org/TR/2011/WD-html5-20110113/parsing.html#determining-the-character-encoding
 *
 * @param   Buffer  buffer    Incoming buffer
 * @param   String  encoding  Target encoding
 * @return  String
 */
function convertBody(buffer, headers) {
	if (typeof convert !== 'function') {
		throw new Error('The package `encoding` must be installed to use the textConverted() function');
	}

	const ct = headers.get('content-type');
	let charset = 'utf-8';
	let res, str;

	// header
	if (ct) {
		res = /charset=([^;]*)/i.exec(ct);
	}

	// no charset in content type, peek at response body for at most 1024 bytes
	str = buffer.slice(0, 1024).toString();

	// html5
	if (!res && str) {
		res = /<meta.+?charset=(['"])(.+?)\1/i.exec(str);
	}

	// html4
	if (!res && str) {
		res = /<meta[\s]+?http-equiv=(['"])content-type\1[\s]+?content=(['"])(.+?)\2/i.exec(str);
		if (!res) {
			res = /<meta[\s]+?content=(['"])(.+?)\1[\s]+?http-equiv=(['"])content-type\3/i.exec(str);
			if (res) {
				res.pop(); // drop last quote
			}
		}

		if (res) {
			res = /charset=(.*)/i.exec(res.pop());
		}
	}

	// xml
	if (!res && str) {
		res = /<\?xml.+?encoding=(['"])(.+?)\1/i.exec(str);
	}

	// found charset
	if (res) {
		charset = res.pop();

		// prevent decode issues when sites use incorrect encoding
		// ref: https://hsivonen.fi/encoding-menu/
		if (charset === 'gb2312' || charset === 'gbk') {
			charset = 'gb18030';
		}
	}

	// turn raw buffers into a single utf-8 buffer
	return convert(buffer, 'UTF-8', charset).toString();
}

/**
 * Detect a URLSearchParams object
 * ref: https://github.com/bitinn/node-fetch/issues/296#issuecomment-307598143
 *
 * @param   Object  obj     Object to detect by type or brand
 * @return  String
 */
function isURLSearchParams(obj) {
	// Duck-typing as a necessary condition.
	if (typeof obj !== 'object' || typeof obj.append !== 'function' || typeof obj.delete !== 'function' || typeof obj.get !== 'function' || typeof obj.getAll !== 'function' || typeof obj.has !== 'function' || typeof obj.set !== 'function') {
		return false;
	}

	// Brand-checking and more duck-typing as optional condition.
	return obj.constructor.name === 'URLSearchParams' || Object.prototype.toString.call(obj) === '[object URLSearchParams]' || typeof obj.sort === 'function';
}

/**
 * Check if `obj` is a W3C `Blob` object (which `File` inherits from)
 * @param  {*} obj
 * @return {boolean}
 */
function isBlob(obj) {
	return typeof obj === 'object' && typeof obj.arrayBuffer === 'function' && typeof obj.type === 'string' && typeof obj.stream === 'function' && typeof obj.constructor === 'function' && typeof obj.constructor.name === 'string' && /^(Blob|File)$/.test(obj.constructor.name) && /^(Blob|File)$/.test(obj[Symbol.toStringTag]);
}

/**
 * Clone body given Res/Req instance
 *
 * @param   Mixed  instance  Response or Request instance
 * @return  Mixed
 */
function clone$1(instance) {
	let p1, p2;
	let body = instance.body;

	// don't allow cloning a used body
	if (instance.bodyUsed) {
		throw new Error('cannot clone body after it is used');
	}

	// check that body is a stream and not form-data object
	// note: we can't clone the form-data object without having it as a dependency
	if (body instanceof Stream__default['default'] && typeof body.getBoundary !== 'function') {
		// tee instance body
		p1 = new PassThrough();
		p2 = new PassThrough();
		body.pipe(p1);
		body.pipe(p2);
		// set instance body to teed body and return the other teed body
		instance[INTERNALS].body = p1;
		body = p2;
	}

	return body;
}

/**
 * Performs the operation "extract a `Content-Type` value from |object|" as
 * specified in the specification:
 * https://fetch.spec.whatwg.org/#concept-bodyinit-extract
 *
 * This function assumes that instance.body is present.
 *
 * @param   Mixed  instance  Any options.body input
 */
function extractContentType(body) {
	if (body === null) {
		// body is null
		return null;
	} else if (typeof body === 'string') {
		// body is string
		return 'text/plain;charset=UTF-8';
	} else if (isURLSearchParams(body)) {
		// body is a URLSearchParams
		return 'application/x-www-form-urlencoded;charset=UTF-8';
	} else if (isBlob(body)) {
		// body is blob
		return body.type || null;
	} else if (Buffer.isBuffer(body)) {
		// body is buffer
		return null;
	} else if (Object.prototype.toString.call(body) === '[object ArrayBuffer]') {
		// body is ArrayBuffer
		return null;
	} else if (ArrayBuffer.isView(body)) {
		// body is ArrayBufferView
		return null;
	} else if (typeof body.getBoundary === 'function') {
		// detect form data input from form-data module
		return `multipart/form-data;boundary=${body.getBoundary()}`;
	} else if (body instanceof Stream__default['default']) {
		// body is stream
		// can't really do much about this
		return null;
	} else {
		// Body constructor defaults other things to string
		return 'text/plain;charset=UTF-8';
	}
}

/**
 * The Fetch Standard treats this as if "total bytes" is a property on the body.
 * For us, we have to explicitly get it with a function.
 *
 * ref: https://fetch.spec.whatwg.org/#concept-body-total-bytes
 *
 * @param   Body    instance   Instance of Body
 * @return  Number?            Number of bytes, or null if not possible
 */
function getTotalBytes(instance) {
	const body = instance.body;


	if (body === null) {
		// body is null
		return 0;
	} else if (isBlob(body)) {
		return body.size;
	} else if (Buffer.isBuffer(body)) {
		// body is buffer
		return body.length;
	} else if (body && typeof body.getLengthSync === 'function') {
		// detect form data input from form-data module
		if (body._lengthRetrievers && body._lengthRetrievers.length == 0 || // 1.x
		body.hasKnownLength && body.hasKnownLength()) {
			// 2.x
			return body.getLengthSync();
		}
		return null;
	} else {
		// body is stream
		return null;
	}
}

/**
 * Write a Body to a Node.js WritableStream (e.g. http.Request) object.
 *
 * @param   Body    instance   Instance of Body
 * @return  Void
 */
function writeToStream(dest, instance) {
	const body = instance.body;


	if (body === null) {
		// body is null
		dest.end();
	} else if (isBlob(body)) {
		body.stream().pipe(dest);
	} else if (Buffer.isBuffer(body)) {
		// body is buffer
		dest.write(body);
		dest.end();
	} else {
		// body is stream
		body.pipe(dest);
	}
}

// expose Promise
Body.Promise = global.Promise;

/**
 * headers.js
 *
 * Headers class offers convenient helpers
 */

const invalidTokenRegex = /[^\^_`a-zA-Z\-0-9!#$%&'*+.|~]/;
const invalidHeaderCharRegex = /[^\t\x20-\x7e\x80-\xff]/;

function validateName(name) {
	name = `${name}`;
	if (invalidTokenRegex.test(name) || name === '') {
		throw new TypeError(`${name} is not a legal HTTP header name`);
	}
}

function validateValue(value) {
	value = `${value}`;
	if (invalidHeaderCharRegex.test(value)) {
		throw new TypeError(`${value} is not a legal HTTP header value`);
	}
}

/**
 * Find the key in the map object given a header name.
 *
 * Returns undefined if not found.
 *
 * @param   String  name  Header name
 * @return  String|Undefined
 */
function find(map, name) {
	name = name.toLowerCase();
	for (const key in map) {
		if (key.toLowerCase() === name) {
			return key;
		}
	}
	return undefined;
}

const MAP = Symbol('map');
class Headers {
	/**
  * Headers class
  *
  * @param   Object  headers  Response headers
  * @return  Void
  */
	constructor() {
		let init = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : undefined;

		this[MAP] = Object.create(null);

		if (init instanceof Headers) {
			const rawHeaders = init.raw();
			const headerNames = Object.keys(rawHeaders);

			for (const headerName of headerNames) {
				for (const value of rawHeaders[headerName]) {
					this.append(headerName, value);
				}
			}

			return;
		}

		// We don't worry about converting prop to ByteString here as append()
		// will handle it.
		if (init == null) ; else if (typeof init === 'object') {
			const method = init[Symbol.iterator];
			if (method != null) {
				if (typeof method !== 'function') {
					throw new TypeError('Header pairs must be iterable');
				}

				// sequence<sequence<ByteString>>
				// Note: per spec we have to first exhaust the lists then process them
				const pairs = [];
				for (const pair of init) {
					if (typeof pair !== 'object' || typeof pair[Symbol.iterator] !== 'function') {
						throw new TypeError('Each header pair must be iterable');
					}
					pairs.push(Array.from(pair));
				}

				for (const pair of pairs) {
					if (pair.length !== 2) {
						throw new TypeError('Each header pair must be a name/value tuple');
					}
					this.append(pair[0], pair[1]);
				}
			} else {
				// record<ByteString, ByteString>
				for (const key of Object.keys(init)) {
					const value = init[key];
					this.append(key, value);
				}
			}
		} else {
			throw new TypeError('Provided initializer must be an object');
		}
	}

	/**
  * Return combined header value given name
  *
  * @param   String  name  Header name
  * @return  Mixed
  */
	get(name) {
		name = `${name}`;
		validateName(name);
		const key = find(this[MAP], name);
		if (key === undefined) {
			return null;
		}

		return this[MAP][key].join(', ');
	}

	/**
  * Iterate over all headers
  *
  * @param   Function  callback  Executed for each item with parameters (value, name, thisArg)
  * @param   Boolean   thisArg   `this` context for callback function
  * @return  Void
  */
	forEach(callback) {
		let thisArg = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : undefined;

		let pairs = getHeaders(this);
		let i = 0;
		while (i < pairs.length) {
			var _pairs$i = pairs[i];
			const name = _pairs$i[0],
			      value = _pairs$i[1];

			callback.call(thisArg, value, name, this);
			pairs = getHeaders(this);
			i++;
		}
	}

	/**
  * Overwrite header values given name
  *
  * @param   String  name   Header name
  * @param   String  value  Header value
  * @return  Void
  */
	set(name, value) {
		name = `${name}`;
		value = `${value}`;
		validateName(name);
		validateValue(value);
		const key = find(this[MAP], name);
		this[MAP][key !== undefined ? key : name] = [value];
	}

	/**
  * Append a value onto existing header
  *
  * @param   String  name   Header name
  * @param   String  value  Header value
  * @return  Void
  */
	append(name, value) {
		name = `${name}`;
		value = `${value}`;
		validateName(name);
		validateValue(value);
		const key = find(this[MAP], name);
		if (key !== undefined) {
			this[MAP][key].push(value);
		} else {
			this[MAP][name] = [value];
		}
	}

	/**
  * Check for header name existence
  *
  * @param   String   name  Header name
  * @return  Boolean
  */
	has(name) {
		name = `${name}`;
		validateName(name);
		return find(this[MAP], name) !== undefined;
	}

	/**
  * Delete all header values given name
  *
  * @param   String  name  Header name
  * @return  Void
  */
	delete(name) {
		name = `${name}`;
		validateName(name);
		const key = find(this[MAP], name);
		if (key !== undefined) {
			delete this[MAP][key];
		}
	}

	/**
  * Return raw headers (non-spec api)
  *
  * @return  Object
  */
	raw() {
		return this[MAP];
	}

	/**
  * Get an iterator on keys.
  *
  * @return  Iterator
  */
	keys() {
		return createHeadersIterator(this, 'key');
	}

	/**
  * Get an iterator on values.
  *
  * @return  Iterator
  */
	values() {
		return createHeadersIterator(this, 'value');
	}

	/**
  * Get an iterator on entries.
  *
  * This is the default iterator of the Headers object.
  *
  * @return  Iterator
  */
	[Symbol.iterator]() {
		return createHeadersIterator(this, 'key+value');
	}
}
Headers.prototype.entries = Headers.prototype[Symbol.iterator];

Object.defineProperty(Headers.prototype, Symbol.toStringTag, {
	value: 'Headers',
	writable: false,
	enumerable: false,
	configurable: true
});

Object.defineProperties(Headers.prototype, {
	get: { enumerable: true },
	forEach: { enumerable: true },
	set: { enumerable: true },
	append: { enumerable: true },
	has: { enumerable: true },
	delete: { enumerable: true },
	keys: { enumerable: true },
	values: { enumerable: true },
	entries: { enumerable: true }
});

function getHeaders(headers) {
	let kind = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'key+value';

	const keys = Object.keys(headers[MAP]).sort();
	return keys.map(kind === 'key' ? function (k) {
		return k.toLowerCase();
	} : kind === 'value' ? function (k) {
		return headers[MAP][k].join(', ');
	} : function (k) {
		return [k.toLowerCase(), headers[MAP][k].join(', ')];
	});
}

const INTERNAL = Symbol('internal');

function createHeadersIterator(target, kind) {
	const iterator = Object.create(HeadersIteratorPrototype);
	iterator[INTERNAL] = {
		target,
		kind,
		index: 0
	};
	return iterator;
}

const HeadersIteratorPrototype = Object.setPrototypeOf({
	next() {
		// istanbul ignore if
		if (!this || Object.getPrototypeOf(this) !== HeadersIteratorPrototype) {
			throw new TypeError('Value of `this` is not a HeadersIterator');
		}

		var _INTERNAL = this[INTERNAL];
		const target = _INTERNAL.target,
		      kind = _INTERNAL.kind,
		      index = _INTERNAL.index;

		const values = getHeaders(target, kind);
		const len = values.length;
		if (index >= len) {
			return {
				value: undefined,
				done: true
			};
		}

		this[INTERNAL].index = index + 1;

		return {
			value: values[index],
			done: false
		};
	}
}, Object.getPrototypeOf(Object.getPrototypeOf([][Symbol.iterator]())));

Object.defineProperty(HeadersIteratorPrototype, Symbol.toStringTag, {
	value: 'HeadersIterator',
	writable: false,
	enumerable: false,
	configurable: true
});

/**
 * Export the Headers object in a form that Node.js can consume.
 *
 * @param   Headers  headers
 * @return  Object
 */
function exportNodeCompatibleHeaders(headers) {
	const obj = Object.assign({ __proto__: null }, headers[MAP]);

	// http.request() only supports string as Host header. This hack makes
	// specifying custom Host header possible.
	const hostHeaderKey = find(headers[MAP], 'Host');
	if (hostHeaderKey !== undefined) {
		obj[hostHeaderKey] = obj[hostHeaderKey][0];
	}

	return obj;
}

/**
 * Create a Headers object from an object of headers, ignoring those that do
 * not conform to HTTP grammar productions.
 *
 * @param   Object  obj  Object of headers
 * @return  Headers
 */
function createHeadersLenient(obj) {
	const headers = new Headers();
	for (const name of Object.keys(obj)) {
		if (invalidTokenRegex.test(name)) {
			continue;
		}
		if (Array.isArray(obj[name])) {
			for (const val of obj[name]) {
				if (invalidHeaderCharRegex.test(val)) {
					continue;
				}
				if (headers[MAP][name] === undefined) {
					headers[MAP][name] = [val];
				} else {
					headers[MAP][name].push(val);
				}
			}
		} else if (!invalidHeaderCharRegex.test(obj[name])) {
			headers[MAP][name] = [obj[name]];
		}
	}
	return headers;
}

const INTERNALS$1 = Symbol('Response internals');

// fix an issue where "STATUS_CODES" aren't a named export for node <10
const STATUS_CODES = http__default['default'].STATUS_CODES;

/**
 * Response class
 *
 * @param   Stream  body  Readable stream
 * @param   Object  opts  Response options
 * @return  Void
 */
class Response {
	constructor() {
		let body = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;
		let opts = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

		Body.call(this, body, opts);

		const status = opts.status || 200;
		const headers = new Headers(opts.headers);

		if (body != null && !headers.has('Content-Type')) {
			const contentType = extractContentType(body);
			if (contentType) {
				headers.append('Content-Type', contentType);
			}
		}

		this[INTERNALS$1] = {
			url: opts.url,
			status,
			statusText: opts.statusText || STATUS_CODES[status],
			headers,
			counter: opts.counter
		};
	}

	get url() {
		return this[INTERNALS$1].url || '';
	}

	get status() {
		return this[INTERNALS$1].status;
	}

	/**
  * Convenience property representing if the request ended normally
  */
	get ok() {
		return this[INTERNALS$1].status >= 200 && this[INTERNALS$1].status < 300;
	}

	get redirected() {
		return this[INTERNALS$1].counter > 0;
	}

	get statusText() {
		return this[INTERNALS$1].statusText;
	}

	get headers() {
		return this[INTERNALS$1].headers;
	}

	/**
  * Clone this response
  *
  * @return  Response
  */
	clone() {
		return new Response(clone$1(this), {
			url: this.url,
			status: this.status,
			statusText: this.statusText,
			headers: this.headers,
			ok: this.ok,
			redirected: this.redirected
		});
	}
}

Body.mixIn(Response.prototype);

Object.defineProperties(Response.prototype, {
	url: { enumerable: true },
	status: { enumerable: true },
	ok: { enumerable: true },
	redirected: { enumerable: true },
	statusText: { enumerable: true },
	headers: { enumerable: true },
	clone: { enumerable: true }
});

Object.defineProperty(Response.prototype, Symbol.toStringTag, {
	value: 'Response',
	writable: false,
	enumerable: false,
	configurable: true
});

const INTERNALS$2 = Symbol('Request internals');

// fix an issue where "format", "parse" aren't a named export for node <10
const parse_url = Url__default['default'].parse;
const format_url = Url__default['default'].format;

const streamDestructionSupported = 'destroy' in Stream__default['default'].Readable.prototype;

/**
 * Check if a value is an instance of Request.
 *
 * @param   Mixed   input
 * @return  Boolean
 */
function isRequest(input) {
	return typeof input === 'object' && typeof input[INTERNALS$2] === 'object';
}

function isAbortSignal(signal) {
	const proto = signal && typeof signal === 'object' && Object.getPrototypeOf(signal);
	return !!(proto && proto.constructor.name === 'AbortSignal');
}

/**
 * Request class
 *
 * @param   Mixed   input  Url or Request instance
 * @param   Object  init   Custom options
 * @return  Void
 */
class Request {
	constructor(input) {
		let init = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

		let parsedURL;

		// normalize input
		if (!isRequest(input)) {
			if (input && input.href) {
				// in order to support Node.js' Url objects; though WHATWG's URL objects
				// will fall into this branch also (since their `toString()` will return
				// `href` property anyway)
				parsedURL = parse_url(input.href);
			} else {
				// coerce input to a string before attempting to parse
				parsedURL = parse_url(`${input}`);
			}
			input = {};
		} else {
			parsedURL = parse_url(input.url);
		}

		let method = init.method || input.method || 'GET';
		method = method.toUpperCase();

		if ((init.body != null || isRequest(input) && input.body !== null) && (method === 'GET' || method === 'HEAD')) {
			throw new TypeError('Request with GET/HEAD method cannot have body');
		}

		let inputBody = init.body != null ? init.body : isRequest(input) && input.body !== null ? clone$1(input) : null;

		Body.call(this, inputBody, {
			timeout: init.timeout || input.timeout || 0,
			size: init.size || input.size || 0
		});

		const headers = new Headers(init.headers || input.headers || {});

		if (inputBody != null && !headers.has('Content-Type')) {
			const contentType = extractContentType(inputBody);
			if (contentType) {
				headers.append('Content-Type', contentType);
			}
		}

		let signal = isRequest(input) ? input.signal : null;
		if ('signal' in init) signal = init.signal;

		if (signal != null && !isAbortSignal(signal)) {
			throw new TypeError('Expected signal to be an instanceof AbortSignal');
		}

		this[INTERNALS$2] = {
			method,
			redirect: init.redirect || input.redirect || 'follow',
			headers,
			parsedURL,
			signal
		};

		// node-fetch-only options
		this.follow = init.follow !== undefined ? init.follow : input.follow !== undefined ? input.follow : 20;
		this.compress = init.compress !== undefined ? init.compress : input.compress !== undefined ? input.compress : true;
		this.counter = init.counter || input.counter || 0;
		this.agent = init.agent || input.agent;
	}

	get method() {
		return this[INTERNALS$2].method;
	}

	get url() {
		return format_url(this[INTERNALS$2].parsedURL);
	}

	get headers() {
		return this[INTERNALS$2].headers;
	}

	get redirect() {
		return this[INTERNALS$2].redirect;
	}

	get signal() {
		return this[INTERNALS$2].signal;
	}

	/**
  * Clone this request
  *
  * @return  Request
  */
	clone() {
		return new Request(this);
	}
}

Body.mixIn(Request.prototype);

Object.defineProperty(Request.prototype, Symbol.toStringTag, {
	value: 'Request',
	writable: false,
	enumerable: false,
	configurable: true
});

Object.defineProperties(Request.prototype, {
	method: { enumerable: true },
	url: { enumerable: true },
	headers: { enumerable: true },
	redirect: { enumerable: true },
	clone: { enumerable: true },
	signal: { enumerable: true }
});

/**
 * Convert a Request to Node.js http request options.
 *
 * @param   Request  A Request instance
 * @return  Object   The options object to be passed to http.request
 */
function getNodeRequestOptions(request) {
	const parsedURL = request[INTERNALS$2].parsedURL;
	const headers = new Headers(request[INTERNALS$2].headers);

	// fetch step 1.3
	if (!headers.has('Accept')) {
		headers.set('Accept', '*/*');
	}

	// Basic fetch
	if (!parsedURL.protocol || !parsedURL.hostname) {
		throw new TypeError('Only absolute URLs are supported');
	}

	if (!/^https?:$/.test(parsedURL.protocol)) {
		throw new TypeError('Only HTTP(S) protocols are supported');
	}

	if (request.signal && request.body instanceof Stream__default['default'].Readable && !streamDestructionSupported) {
		throw new Error('Cancellation of streamed requests with AbortSignal is not supported in node < 8');
	}

	// HTTP-network-or-cache fetch steps 2.4-2.7
	let contentLengthValue = null;
	if (request.body == null && /^(POST|PUT)$/i.test(request.method)) {
		contentLengthValue = '0';
	}
	if (request.body != null) {
		const totalBytes = getTotalBytes(request);
		if (typeof totalBytes === 'number') {
			contentLengthValue = String(totalBytes);
		}
	}
	if (contentLengthValue) {
		headers.set('Content-Length', contentLengthValue);
	}

	// HTTP-network-or-cache fetch step 2.11
	if (!headers.has('User-Agent')) {
		headers.set('User-Agent', 'node-fetch/1.0 (+https://github.com/bitinn/node-fetch)');
	}

	// HTTP-network-or-cache fetch step 2.15
	if (request.compress && !headers.has('Accept-Encoding')) {
		headers.set('Accept-Encoding', 'gzip,deflate');
	}

	let agent = request.agent;
	if (typeof agent === 'function') {
		agent = agent(parsedURL);
	}

	if (!headers.has('Connection') && !agent) {
		headers.set('Connection', 'close');
	}

	// HTTP-network fetch step 4.2
	// chunked encoding is handled by Node.js

	return Object.assign({}, parsedURL, {
		method: request.method,
		headers: exportNodeCompatibleHeaders(headers),
		agent
	});
}

/**
 * abort-error.js
 *
 * AbortError interface for cancelled requests
 */

/**
 * Create AbortError instance
 *
 * @param   String      message      Error message for human
 * @return  AbortError
 */
function AbortError(message) {
  Error.call(this, message);

  this.type = 'aborted';
  this.message = message;

  // hide custom error implementation details from end-users
  Error.captureStackTrace(this, this.constructor);
}

AbortError.prototype = Object.create(Error.prototype);
AbortError.prototype.constructor = AbortError;
AbortError.prototype.name = 'AbortError';

// fix an issue where "PassThrough", "resolve" aren't a named export for node <10
const PassThrough$1 = Stream__default['default'].PassThrough;
const resolve_url = Url__default['default'].resolve;

/**
 * Fetch function
 *
 * @param   Mixed    url   Absolute url or Request instance
 * @param   Object   opts  Fetch options
 * @return  Promise
 */
function fetch(url, opts) {

	// allow custom promise
	if (!fetch.Promise) {
		throw new Error('native promise missing, set fetch.Promise to your favorite alternative');
	}

	Body.Promise = fetch.Promise;

	// wrap http.request into fetch
	return new fetch.Promise(function (resolve, reject) {
		// build request object
		const request = new Request(url, opts);
		const options = getNodeRequestOptions(request);

		const send = (options.protocol === 'https:' ? https__default['default'] : http__default['default']).request;
		const signal = request.signal;

		let response = null;

		const abort = function abort() {
			let error = new AbortError('The user aborted a request.');
			reject(error);
			if (request.body && request.body instanceof Stream__default['default'].Readable) {
				request.body.destroy(error);
			}
			if (!response || !response.body) return;
			response.body.emit('error', error);
		};

		if (signal && signal.aborted) {
			abort();
			return;
		}

		const abortAndFinalize = function abortAndFinalize() {
			abort();
			finalize();
		};

		// send request
		const req = send(options);
		let reqTimeout;

		if (signal) {
			signal.addEventListener('abort', abortAndFinalize);
		}

		function finalize() {
			req.abort();
			if (signal) signal.removeEventListener('abort', abortAndFinalize);
			clearTimeout(reqTimeout);
		}

		if (request.timeout) {
			req.once('socket', function (socket) {
				reqTimeout = setTimeout(function () {
					reject(new FetchError(`network timeout at: ${request.url}`, 'request-timeout'));
					finalize();
				}, request.timeout);
			});
		}

		req.on('error', function (err) {
			reject(new FetchError(`request to ${request.url} failed, reason: ${err.message}`, 'system', err));
			finalize();
		});

		req.on('response', function (res) {
			clearTimeout(reqTimeout);

			const headers = createHeadersLenient(res.headers);

			// HTTP fetch step 5
			if (fetch.isRedirect(res.statusCode)) {
				// HTTP fetch step 5.2
				const location = headers.get('Location');

				// HTTP fetch step 5.3
				const locationURL = location === null ? null : resolve_url(request.url, location);

				// HTTP fetch step 5.5
				switch (request.redirect) {
					case 'error':
						reject(new FetchError(`uri requested responds with a redirect, redirect mode is set to error: ${request.url}`, 'no-redirect'));
						finalize();
						return;
					case 'manual':
						// node-fetch-specific step: make manual redirect a bit easier to use by setting the Location header value to the resolved URL.
						if (locationURL !== null) {
							// handle corrupted header
							try {
								headers.set('Location', locationURL);
							} catch (err) {
								// istanbul ignore next: nodejs server prevent invalid response headers, we can't test this through normal request
								reject(err);
							}
						}
						break;
					case 'follow':
						// HTTP-redirect fetch step 2
						if (locationURL === null) {
							break;
						}

						// HTTP-redirect fetch step 5
						if (request.counter >= request.follow) {
							reject(new FetchError(`maximum redirect reached at: ${request.url}`, 'max-redirect'));
							finalize();
							return;
						}

						// HTTP-redirect fetch step 6 (counter increment)
						// Create a new Request object.
						const requestOpts = {
							headers: new Headers(request.headers),
							follow: request.follow,
							counter: request.counter + 1,
							agent: request.agent,
							compress: request.compress,
							method: request.method,
							body: request.body,
							signal: request.signal,
							timeout: request.timeout,
							size: request.size
						};

						// HTTP-redirect fetch step 9
						if (res.statusCode !== 303 && request.body && getTotalBytes(request) === null) {
							reject(new FetchError('Cannot follow redirect with body being a readable stream', 'unsupported-redirect'));
							finalize();
							return;
						}

						// HTTP-redirect fetch step 11
						if (res.statusCode === 303 || (res.statusCode === 301 || res.statusCode === 302) && request.method === 'POST') {
							requestOpts.method = 'GET';
							requestOpts.body = undefined;
							requestOpts.headers.delete('content-length');
						}

						// HTTP-redirect fetch step 15
						resolve(fetch(new Request(locationURL, requestOpts)));
						finalize();
						return;
				}
			}

			// prepare response
			res.once('end', function () {
				if (signal) signal.removeEventListener('abort', abortAndFinalize);
			});
			let body = res.pipe(new PassThrough$1());

			const response_options = {
				url: request.url,
				status: res.statusCode,
				statusText: res.statusMessage,
				headers: headers,
				size: request.size,
				timeout: request.timeout,
				counter: request.counter
			};

			// HTTP-network fetch step 12.1.1.3
			const codings = headers.get('Content-Encoding');

			// HTTP-network fetch step 12.1.1.4: handle content codings

			// in following scenarios we ignore compression support
			// 1. compression support is disabled
			// 2. HEAD request
			// 3. no Content-Encoding header
			// 4. no content response (204)
			// 5. content not modified response (304)
			if (!request.compress || request.method === 'HEAD' || codings === null || res.statusCode === 204 || res.statusCode === 304) {
				response = new Response(body, response_options);
				resolve(response);
				return;
			}

			// For Node v6+
			// Be less strict when decoding compressed responses, since sometimes
			// servers send slightly invalid responses that are still accepted
			// by common browsers.
			// Always using Z_SYNC_FLUSH is what cURL does.
			const zlibOptions = {
				flush: zlib__default['default'].Z_SYNC_FLUSH,
				finishFlush: zlib__default['default'].Z_SYNC_FLUSH
			};

			// for gzip
			if (codings == 'gzip' || codings == 'x-gzip') {
				body = body.pipe(zlib__default['default'].createGunzip(zlibOptions));
				response = new Response(body, response_options);
				resolve(response);
				return;
			}

			// for deflate
			if (codings == 'deflate' || codings == 'x-deflate') {
				// handle the infamous raw deflate response from old servers
				// a hack for old IIS and Apache servers
				const raw = res.pipe(new PassThrough$1());
				raw.once('data', function (chunk) {
					// see http://stackoverflow.com/questions/37519828
					if ((chunk[0] & 0x0F) === 0x08) {
						body = body.pipe(zlib__default['default'].createInflate());
					} else {
						body = body.pipe(zlib__default['default'].createInflateRaw());
					}
					response = new Response(body, response_options);
					resolve(response);
				});
				return;
			}

			// for br
			if (codings == 'br' && typeof zlib__default['default'].createBrotliDecompress === 'function') {
				body = body.pipe(zlib__default['default'].createBrotliDecompress());
				response = new Response(body, response_options);
				resolve(response);
				return;
			}

			// otherwise, use response as-is
			response = new Response(body, response_options);
			resolve(response);
		});

		writeToStream(req, request);
	});
}
/**
 * Redirect code matching
 *
 * @param   Number   code  Status code
 * @return  Boolean
 */
fetch.isRedirect = function (code) {
	return code === 301 || code === 302 || code === 303 || code === 307 || code === 308;
};

// expose Promise
fetch.Promise = global.Promise;

/**
 * This and related code are adapted from https://github.com/vercel/next.js/blob/48acc479f3befb70de800392315831ed7defa4d8/packages/next/next-server/server/image-optimizer.ts
 * The MIT License (MIT)

 Copyright (c) 2020 Vercel, Inc.

 Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
let sharp;
//const AVIF = 'image/avif'
const WEBP = "image/webp";
const PNG = "image/png";
const JPEG = "image/jpeg";
const GIF = "image/gif";
const SVG = "image/svg+xml";
const CACHE_VERSION = 2;
const MODERN_TYPES = [/* AVIF, */ WEBP];
const ANIMATABLE_TYPES = [WEBP, PNG, GIF];
const VECTOR_TYPES = [SVG];
async function imageOptimizer({ basePath, bucketName, region }, imagesManifest, req, res, parsedUrl) {
    var _a;
    const imageConfig = (_a = imagesManifest === null || imagesManifest === void 0 ? void 0 : imagesManifest.images) !== null && _a !== void 0 ? _a : imageConfigDefault;
    const { deviceSizes = [], imageSizes = [], domains = [], loader } = imageConfig;
    const sizes = [...deviceSizes, ...imageSizes];
    if (loader !== "default") {
        res.statusCode = 404;
        res.end("default loader not found");
        return { finished: true };
    }
    const { headers } = req;
    const { url, w, q } = parsedUrl.query;
    const mimeType = getSupportedMimeType(MODERN_TYPES, headers.accept);
    let href;
    if (!url) {
        res.statusCode = 400;
        res.end('"url" parameter is required');
        return { finished: true };
    }
    else if (Array.isArray(url)) {
        res.statusCode = 400;
        res.end('"url" parameter cannot be an array');
        return { finished: true };
    }
    let isAbsolute;
    if (url.startsWith("/")) {
        href = url;
        isAbsolute = false;
    }
    else {
        let hrefParsed;
        try {
            hrefParsed = new URL(url);
            href = hrefParsed.toString();
            isAbsolute = true;
        }
        catch (_error) {
            res.statusCode = 400;
            res.end('"url" parameter is invalid');
            return { finished: true };
        }
        if (!["http:", "https:"].includes(hrefParsed.protocol)) {
            res.statusCode = 400;
            res.end('"url" parameter is invalid');
            return { finished: true };
        }
        if (!domains.includes(hrefParsed.hostname)) {
            res.statusCode = 400;
            res.end('"url" parameter is not allowed');
            return { finished: true };
        }
    }
    if (!w) {
        res.statusCode = 400;
        res.end('"w" parameter (width) is required');
        return { finished: true };
    }
    else if (Array.isArray(w)) {
        res.statusCode = 400;
        res.end('"w" parameter (width) cannot be an array');
        return { finished: true };
    }
    if (!q) {
        res.statusCode = 400;
        res.end('"q" parameter (quality) is required');
        return { finished: true };
    }
    else if (Array.isArray(q)) {
        res.statusCode = 400;
        res.end('"q" parameter (quality) cannot be an array');
        return { finished: true };
    }
    const width = parseInt(w, 10);
    if (!width || isNaN(width)) {
        res.statusCode = 400;
        res.end('"w" parameter (width) must be a number greater than 0');
        return { finished: true };
    }
    if (!sizes.includes(width)) {
        res.statusCode = 400;
        res.end(`"w" parameter (width) of ${width} is not allowed`);
        return { finished: true };
    }
    const quality = parseInt(q);
    if (isNaN(quality) || quality < 1 || quality > 100) {
        res.statusCode = 400;
        res.end('"q" parameter (quality) must be a number between 1 and 100');
        return { finished: true };
    }
    const hash = getHash([CACHE_VERSION, href, width, quality, mimeType]);
    const imagesDir = require$$1.join("/tmp", "cache", "images"); // Use Lambda tmp directory
    const hashDir = require$$1.join(imagesDir, hash);
    const now = Date.now();
    if (fs.existsSync(hashDir)) {
        const files = await fs.promises.readdir(hashDir);
        for (let file of files) {
            const [prefix, etag, extension] = file.split(".");
            const expireAt = Number(prefix);
            const contentType = getContentType(extension);
            const fsPath = require$$1.join(hashDir, file);
            if (now < expireAt) {
                if (!res.getHeader("Cache-Control")) {
                    res.setHeader("Cache-Control", "public, max-age=60");
                }
                if (sendEtagResponse(req, res, etag)) {
                    return { finished: true };
                }
                if (contentType) {
                    res.setHeader("Content-Type", contentType);
                }
                fs.createReadStream(fsPath).pipe(res);
                return { finished: true };
            }
            else {
                await fs.promises.unlink(fsPath);
            }
        }
    }
    let upstreamBuffer;
    let upstreamType;
    let maxAge;
    if (isAbsolute) {
        const upstreamRes = await fetch(href);
        if (!upstreamRes.ok) {
            res.statusCode = upstreamRes.status;
            res.end('"url" parameter is valid but upstream response is invalid');
            return { finished: true };
        }
        res.statusCode = upstreamRes.status;
        upstreamBuffer = Buffer.from(await upstreamRes.arrayBuffer());
        upstreamType = upstreamRes.headers.get("Content-Type");
        maxAge = getMaxAge(upstreamRes.headers.get("Cache-Control"));
    }
    else {
        try {
            let s3Key;
            if (href.startsWith(`${basePath}/static`)) {
                s3Key = href; // static files' URL map to the S3 key directly e.g /static/ -> static
            }
            else {
                s3Key = `${basePath}/public` + href; // public file URLs map from /public.png -> public/public.png
            }
            // Remove leading slash from S3 key
            if (s3Key.startsWith("/")) {
                s3Key = s3Key.slice(1);
            }
            const s3Params = {
                Bucket: bucketName,
                Key: s3Key
            };
            const { S3Client } = await Promise.resolve().then(function () { return S3Client$1; });
            const s3 = new S3Client({
                region: region,
                maxAttempts: 3,
                retryStrategy: await buildS3RetryStrategy()
            });
            const { GetObjectCommand } = await Promise.resolve().then(function () { return GetObjectCommand$1; });
            const { Body, CacheControl, ContentType } = await s3.send(new GetObjectCommand(s3Params));
            const s3chunks = [];
            for await (let s3Chunk of Body) {
                s3chunks.push(s3Chunk);
            }
            res.statusCode = 200;
            upstreamBuffer = Buffer.concat(s3chunks);
            upstreamType = ContentType !== null && ContentType !== void 0 ? ContentType : null;
            maxAge = getMaxAge(CacheControl !== null && CacheControl !== void 0 ? CacheControl : null);
            // If S3 image provides cache control header, use that
            if (CacheControl) {
                res.setHeader("Cache-Control", CacheControl);
            }
        }
        catch (err) {
            res.statusCode = 500;
            res.end('"url" parameter is valid but upstream response is invalid');
            console.error("Error processing upstream response (S3): " + err);
            return { finished: true };
        }
    }
    if (upstreamType) {
        const vector = VECTOR_TYPES.includes(upstreamType);
        const animate = ANIMATABLE_TYPES.includes(upstreamType) && lib$3(upstreamBuffer);
        if (vector || animate) {
            sendResponse(req, res, upstreamType, upstreamBuffer);
            return { finished: true };
        }
    }
    const expireAt = maxAge * 1000 + now;
    let contentType;
    if (mimeType) {
        contentType = mimeType;
    }
    else if ((upstreamType === null || upstreamType === void 0 ? void 0 : upstreamType.startsWith("image/")) && getExtension(upstreamType)) {
        contentType = upstreamType;
    }
    else {
        contentType = JPEG;
    }
    if (!sharp) {
        try {
            sharp = require("sharp");
        }
        catch (error) {
            if (error.code === "MODULE_NOT_FOUND") {
                error.message += "\n\nLearn more: https://err.sh/next.js/install-sharp";
                console.error(error);
                sendResponse(req, res, upstreamType, upstreamBuffer);
                return { finished: true };
            }
            throw error;
        }
    }
    try {
        const transformer = sharp(upstreamBuffer);
        transformer.rotate(); // auto rotate based on EXIF data
        const { width: metaWidth } = await transformer.metadata();
        if (metaWidth && metaWidth > width) {
            transformer.resize(width);
        }
        //if (contentType === AVIF) {
        // Soon https://github.com/lovell/sharp/issues/2289
        //}
        if (contentType === WEBP) {
            transformer.webp({ quality });
        }
        else if (contentType === PNG) {
            transformer.png({ quality });
        }
        else if (contentType === JPEG) {
            transformer.jpeg({ quality });
        }
        const optimizedBuffer = await transformer.toBuffer();
        await fs.promises.mkdir(hashDir, { recursive: true });
        const extension = getExtension(contentType);
        const etag = getHash([optimizedBuffer]);
        const filename = require$$1.join(hashDir, `${expireAt}.${etag}.${extension}`);
        await fs.promises.writeFile(filename, optimizedBuffer);
        sendResponse(req, res, contentType, optimizedBuffer);
    }
    catch (error) {
        console.error("Error processing image with sharp, returning upstream image as fallback instead: " +
            error.stack);
        sendResponse(req, res, upstreamType, upstreamBuffer);
    }
    return { finished: true };
}
function sendResponse(req, res, contentType, buffer) {
    const etag = getHash([buffer]);
    if (!res.getHeader("Cache-Control")) {
        res.setHeader("Cache-Control", "public, max-age=60");
    }
    if (sendEtagResponse(req, res, etag)) {
        return;
    }
    if (contentType) {
        res.setHeader("Content-Type", contentType);
    }
    res.end(buffer);
}
function getSupportedMimeType(options, accept = "") {
    const mimeType = lib$2.mediaType(accept, options);
    return accept.includes(mimeType) ? mimeType : "";
}
function getHash(items) {
    const hash = crypto.createHash("sha256");
    for (let item of items) {
        if (typeof item === "number")
            hash.update(String(item));
        else {
            hash.update(item);
        }
    }
    // See https://en.wikipedia.org/wiki/Base64#Filenames
    return hash.digest("base64").replace(/\//g, "-");
}
function parseCacheControl(str) {
    const map = new Map();
    if (!str) {
        return map;
    }
    for (let directive of str.split(",")) {
        let [key, value] = directive.trim().split("=");
        key = key.toLowerCase();
        if (value) {
            value = value.toLowerCase();
        }
        map.set(key, value);
    }
    return map;
}
function getMaxAge(str) {
    const minimum = 60;
    const map = parseCacheControl(str);
    if (map) {
        let age = map.get("s-maxage") || map.get("max-age") || "";
        if (age.startsWith('"') && age.endsWith('"')) {
            age = age.slice(1, -1);
        }
        const n = parseInt(age, 10);
        if (!isNaN(n)) {
            return Math.max(n, minimum);
        }
    }
    return minimum;
}

/**
 * Create a redirect response with the given status code for CloudFront.
 * @param uri
 * @param querystring
 * @param statusCode
 */
function createRedirectResponse(uri, querystring, statusCode) {
    let location;
    // Properly join query strings
    if (querystring) {
        const [uriPath, uriQuery] = uri.split("?");
        location = `${uriPath}?${querystring}${uriQuery ? `&${uriQuery}` : ""}`;
    }
    else {
        location = uri;
    }
    const status = statusCode.toString();
    const statusDescription = http.STATUS_CODES[status];
    const refresh = statusCode === 308
        ? [
            // Required for IE11 compatibility
            {
                key: "Refresh",
                value: `0;url=${location}`
            }
        ]
        : [];
    return {
        status: status,
        statusDescription: statusDescription,
        headers: {
            location: [
                {
                    key: "Location",
                    value: location
                }
            ],
            refresh: refresh
        }
    };
}
/**
 * Get a domain redirect such as redirecting www to non-www domain.
 * @param request
 * @param buildManifest
 */
function getDomainRedirectPath(request, buildManifest) {
    const hostHeaders = request.headers["host"];
    if (hostHeaders && hostHeaders.length > 0) {
        const host = hostHeaders[0].value;
        const domainRedirects = buildManifest.domainRedirects;
        if (domainRedirects && domainRedirects[host]) {
            return `${domainRedirects[host]}${request.uri}`;
        }
    }
    return null;
}

function getUnauthenticatedResponse(authorizationHeader, authentication) {
    if (authentication && authentication.username && authentication.password) {
        const validAuth = "Basic " +
            Buffer.from(authentication.username + ":" + authentication.password).toString("base64");
        if (authorizationHeader !== validAuth) {
            return {
                status: "401",
                statusDescription: "Unauthorized",
                body: "Unauthorized",
                headers: {
                    "www-authenticate": [{ key: "WWW-Authenticate", value: "Basic" }]
                }
            };
        }
    }
    return null;
}

// @ts-ignore
const basePath$1 = RoutesManifestJson__default['default'].basePath;
const normaliseUri = (uri) => {
    if (uri.startsWith(basePath$1)) {
        uri = uri.slice(basePath$1.length);
    }
    return uri;
};
const isImageOptimizerRequest = (uri) => uri.startsWith("/_next/image");
const handler$1 = async (event) => {
    const request = event.Records[0].cf.request;
    const routesManifest = RoutesManifestJson__default['default'];
    const buildManifest = manifest__default['default'];
    // Handle basic auth
    const authorization = request.headers.authorization;
    const unauthResponse = getUnauthenticatedResponse(authorization ? authorization[0].value : null, manifest__default['default'].authentication);
    if (unauthResponse) {
        return unauthResponse;
    }
    // Handle domain redirects e.g www to non-www domain
    const domainRedirect = getDomainRedirectPath(request, buildManifest);
    if (domainRedirect) {
        return createRedirectResponse(domainRedirect, request.querystring, 308);
    }
    // No other redirects or rewrites supported for now as it's assumed one is accessing this directly.
    // But it can be added later.
    const uri = normaliseUri(request.uri);
    // Handle image optimizer requests
    const isImageRequest = isImageOptimizerRequest(uri);
    if (isImageRequest) {
        let imagesManifest;
        try {
            // @ts-ignore
            imagesManifest = await Promise.resolve().then(function () { return /*#__PURE__*/_interopNamespace(require('./images-manifest.json')); });
        }
        catch (error) {
            console.warn("Images manifest not found for image optimizer request. Image optimizer will fallback to defaults.");
        }
        const { req, res, responsePromise } = nextAwsCloudfront(event.Records[0].cf, {
            enableHTTPCompression: manifest__default['default'].enableHTTPCompression
        });
        const urlWithParsedQuery = Url__default['default'].parse(`${request.uri}?${request.querystring}`, true);
        const { domainName, region } = request.origin.s3;
        const bucketName = domainName.replace(`.s3.${region}.amazonaws.com`, "");
        await imageOptimizer({ basePath: basePath$1, bucketName: bucketName, region: region }, imagesManifest, req, res, urlWithParsedQuery);
        const response = await responsePromise;
        addHeadersToResponse(request.uri, response, routesManifest);
        return response;
    }
    else {
        return {
            status: "404"
        };
    }
};

/*! *****************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */
/* global Reflect, Promise */

var extendStatics = function(d, b) {
    extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return extendStatics(d, b);
};

function __extends(d, b) {
    extendStatics(d, b);
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
}

var __assign = function() {
    __assign = Object.assign || function __assign(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};

function __rest(s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
}

function __awaiter(thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
}

function __generator(thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
}

function __values(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
}

function __read(o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
}

function __spread() {
    for (var ar = [], i = 0; i < arguments.length; i++)
        ar = ar.concat(__read(arguments[i]));
    return ar;
}

function __await(v) {
    return this instanceof __await ? (this.v = v, this) : new __await(v);
}

function __asyncGenerator(thisArg, _arguments, generator) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var g = generator.apply(thisArg, _arguments || []), i, q = [];
    return i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i;
    function verb(n) { if (g[n]) i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); }; }
    function resume(n, v) { try { step(g[n](v)); } catch (e) { settle(q[0][3], e); } }
    function step(r) { r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r); }
    function fulfill(value) { resume("next", value); }
    function reject(value) { resume("throw", value); }
    function settle(f, v) { if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]); }
}

function __asyncValues(o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
}

var retryMiddleware = function (options) { return function (next) { return function (args) { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
    return [2 /*return*/, options.retryStrategy.retry(next, args)];
}); }); }; }; };
var retryMiddlewareOptions = {
    name: "retryMiddleware",
    tags: ["RETRY"],
    step: "finalizeRequest",
    priority: "high",
};
var getRetryPlugin = function (options) { return ({
    applyToStack: function (clientStack) {
        clientStack.add(retryMiddleware(options), retryMiddlewareOptions);
    },
}); };

var HttpResponse = /** @class */ (function () {
    function HttpResponse(options) {
        this.statusCode = options.statusCode;
        this.headers = options.headers || {};
        this.body = options.body;
    }
    HttpResponse.isInstance = function (response) {
        //determine if response is a valid HttpResponse
        if (!response)
            return false;
        var resp = response;
        return typeof resp.statusCode === "number" && typeof resp.headers === "object";
    };
    return HttpResponse;
}());

var HttpRequest = /** @class */ (function () {
    function HttpRequest(options) {
        this.method = options.method || "GET";
        this.hostname = options.hostname || "localhost";
        this.port = options.port;
        this.query = options.query || {};
        this.headers = options.headers || {};
        this.body = options.body;
        this.protocol = options.protocol
            ? options.protocol.substr(-1) !== ":"
                ? options.protocol + ":"
                : options.protocol
            : "https:";
        this.path = options.path ? (options.path.charAt(0) !== "/" ? "/" + options.path : options.path) : "/";
    }
    HttpRequest.isInstance = function (request) {
        //determine if request is a valid httpRequest
        if (!request)
            return false;
        var req = request;
        return ("method" in req &&
            "protocol" in req &&
            "hostname" in req &&
            "path" in req &&
            typeof req["query"] === "object" &&
            typeof req["headers"] === "object");
    };
    HttpRequest.prototype.clone = function () {
        var cloned = new HttpRequest(__assign(__assign({}, this), { headers: __assign({}, this.headers) }));
        if (cloned.query)
            cloned.query = cloneQuery(cloned.query);
        return cloned;
    };
    return HttpRequest;
}());
function cloneQuery(query) {
    return Object.keys(query).reduce(function (carry, paramName) {
        var _a;
        var param = query[paramName];
        return __assign(__assign({}, carry), (_a = {}, _a[paramName] = Array.isArray(param) ? __spread(param) : param, _a));
    }, {});
}

/**
 * Errors encountered when the client clock and server clock cannot agree on the
 * current time.
 *
 * These errors are retryable, assuming the SDK has enabled clock skew
 * correction.
 */
var CLOCK_SKEW_ERROR_CODES = [
    "AuthFailure",
    "InvalidSignatureException",
    "RequestExpired",
    "RequestInTheFuture",
    "RequestTimeTooSkewed",
    "SignatureDoesNotMatch",
];
/**
 * Errors that indicate the SDK is being throttled.
 *
 * These errors are always retryable.
 */
var THROTTLING_ERROR_CODES = [
    "Throttling",
    "ThrottlingException",
    "ThrottledException",
    "RequestThrottledException",
    "TooManyRequestsException",
    "ProvisionedThroughputExceededException",
    "TransactionInProgressException",
    "RequestLimitExceeded",
    "BandwidthLimitExceeded",
    "LimitExceededException",
    "RequestThrottled",
    "SlowDown",
    "PriorRequestNotComplete",
    "EC2ThrottledException",
];
/**
 * Error codes that indicate transient issues
 */
var TRANSIENT_ERROR_CODES = ["AbortError", "TimeoutError", "RequestTimeout", "RequestTimeoutException"];
/**
 * Error codes that indicate transient issues
 */
var TRANSIENT_ERROR_STATUS_CODES = [500, 502, 503, 504];

var isRetryableByTrait = function (error) { return error.$retryable !== undefined; };
var isClockSkewError = function (error) { return CLOCK_SKEW_ERROR_CODES.includes(error.name); };
var isThrottlingError = function (error) { var _a; return THROTTLING_ERROR_CODES.includes(error.name) || ((_a = error.$retryable) === null || _a === void 0 ? void 0 : _a.throttling) == true; };
var isTransientError = function (error) {
    var _a;
    return TRANSIENT_ERROR_CODES.includes(error.name) ||
        TRANSIENT_ERROR_STATUS_CODES.includes(((_a = error.$metadata) === null || _a === void 0 ? void 0 : _a.httpStatusCode) || 0);
};

// Unique ID creation requires a high quality random # generator.  In node.js
// this is pretty straight-forward - we use the crypto API.



var rng = function nodeRNG() {
  return crypto__default['default'].randomBytes(16);
};

/**
 * Convert array of 16 byte values to UUID string format of the form:
 * XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX
 */
var byteToHex = [];
for (var i = 0; i < 256; ++i) {
  byteToHex[i] = (i + 0x100).toString(16).substr(1);
}

function bytesToUuid(buf, offset) {
  var i = offset || 0;
  var bth = byteToHex;
  // join used to fix memory issue caused by concatenation: https://bugs.chromium.org/p/v8/issues/detail?id=3175#c4
  return ([
    bth[buf[i++]], bth[buf[i++]],
    bth[buf[i++]], bth[buf[i++]], '-',
    bth[buf[i++]], bth[buf[i++]], '-',
    bth[buf[i++]], bth[buf[i++]], '-',
    bth[buf[i++]], bth[buf[i++]], '-',
    bth[buf[i++]], bth[buf[i++]],
    bth[buf[i++]], bth[buf[i++]],
    bth[buf[i++]], bth[buf[i++]]
  ]).join('');
}

var bytesToUuid_1 = bytesToUuid;

// **`v1()` - Generate time-based UUID**
//
// Inspired by https://github.com/LiosK/UUID.js
// and http://docs.python.org/library/uuid.html

var _nodeId;
var _clockseq;

// Previous uuid creation time
var _lastMSecs = 0;
var _lastNSecs = 0;

// See https://github.com/uuidjs/uuid for API details
function v1(options, buf, offset) {
  var i = buf && offset || 0;
  var b = buf || [];

  options = options || {};
  var node = options.node || _nodeId;
  var clockseq = options.clockseq !== undefined ? options.clockseq : _clockseq;

  // node and clockseq need to be initialized to random values if they're not
  // specified.  We do this lazily to minimize issues related to insufficient
  // system entropy.  See #189
  if (node == null || clockseq == null) {
    var seedBytes = rng();
    if (node == null) {
      // Per 4.5, create and 48-bit node id, (47 random bits + multicast bit = 1)
      node = _nodeId = [
        seedBytes[0] | 0x01,
        seedBytes[1], seedBytes[2], seedBytes[3], seedBytes[4], seedBytes[5]
      ];
    }
    if (clockseq == null) {
      // Per 4.2.2, randomize (14 bit) clockseq
      clockseq = _clockseq = (seedBytes[6] << 8 | seedBytes[7]) & 0x3fff;
    }
  }

  // UUID timestamps are 100 nano-second units since the Gregorian epoch,
  // (1582-10-15 00:00).  JSNumbers aren't precise enough for this, so
  // time is handled internally as 'msecs' (integer milliseconds) and 'nsecs'
  // (100-nanoseconds offset from msecs) since unix epoch, 1970-01-01 00:00.
  var msecs = options.msecs !== undefined ? options.msecs : new Date().getTime();

  // Per 4.2.1.2, use count of uuid's generated during the current clock
  // cycle to simulate higher resolution clock
  var nsecs = options.nsecs !== undefined ? options.nsecs : _lastNSecs + 1;

  // Time since last uuid creation (in msecs)
  var dt = (msecs - _lastMSecs) + (nsecs - _lastNSecs)/10000;

  // Per 4.2.1.2, Bump clockseq on clock regression
  if (dt < 0 && options.clockseq === undefined) {
    clockseq = clockseq + 1 & 0x3fff;
  }

  // Reset nsecs if clock regresses (new clockseq) or we've moved onto a new
  // time interval
  if ((dt < 0 || msecs > _lastMSecs) && options.nsecs === undefined) {
    nsecs = 0;
  }

  // Per 4.2.1.2 Throw error if too many uuids are requested
  if (nsecs >= 10000) {
    throw new Error('uuid.v1(): Can\'t create more than 10M uuids/sec');
  }

  _lastMSecs = msecs;
  _lastNSecs = nsecs;
  _clockseq = clockseq;

  // Per 4.1.4 - Convert from unix epoch to Gregorian epoch
  msecs += 12219292800000;

  // `time_low`
  var tl = ((msecs & 0xfffffff) * 10000 + nsecs) % 0x100000000;
  b[i++] = tl >>> 24 & 0xff;
  b[i++] = tl >>> 16 & 0xff;
  b[i++] = tl >>> 8 & 0xff;
  b[i++] = tl & 0xff;

  // `time_mid`
  var tmh = (msecs / 0x100000000 * 10000) & 0xfffffff;
  b[i++] = tmh >>> 8 & 0xff;
  b[i++] = tmh & 0xff;

  // `time_high_and_version`
  b[i++] = tmh >>> 24 & 0xf | 0x10; // include version
  b[i++] = tmh >>> 16 & 0xff;

  // `clock_seq_hi_and_reserved` (Per 4.2.2 - include variant)
  b[i++] = clockseq >>> 8 | 0x80;

  // `clock_seq_low`
  b[i++] = clockseq & 0xff;

  // `node`
  for (var n = 0; n < 6; ++n) {
    b[i + n] = node[n];
  }

  return buf ? buf : bytesToUuid_1(b);
}

var v1_1 = v1;

function v4(options, buf, offset) {
  var i = buf && offset || 0;

  if (typeof(options) == 'string') {
    buf = options === 'binary' ? new Array(16) : null;
    options = null;
  }
  options = options || {};

  var rnds = options.random || (options.rng || rng)();

  // Per 4.4, set bits for version and `clock_seq_hi_and_reserved`
  rnds[6] = (rnds[6] & 0x0f) | 0x40;
  rnds[8] = (rnds[8] & 0x3f) | 0x80;

  // Copy bytes to buffer, if provided
  if (buf) {
    for (var ii = 0; ii < 16; ++ii) {
      buf[i + ii] = rnds[ii];
    }
  }

  return buf || bytesToUuid_1(rnds);
}

var v4_1 = v4;

var uuid = v4_1;
uuid.v1 = v1_1;
uuid.v4 = v4_1;

var uuid_1 = uuid;

/**
 * The base number of milliseconds to use in calculating a suitable cool-down
 * time when a retryable error is encountered.
 */
var DEFAULT_RETRY_DELAY_BASE = 100;
/**
 * The maximum amount of time (in milliseconds) that will be used as a delay
 * between retry attempts.
 */
var MAXIMUM_RETRY_DELAY = 20 * 1000;
/**
 * The retry delay base (in milliseconds) to use when a throttling error is
 * encountered.
 */
var THROTTLING_RETRY_DELAY_BASE = 500;
/**
 * Initial number of retry tokens in Retry Quota
 */
var INITIAL_RETRY_TOKENS = 500;
/**
 * The total amount of retry tokens to be decremented from retry token balance.
 */
var RETRY_COST = 5;
/**
 * The total amount of retry tokens to be decremented from retry token balance
 * when a throttling error is encountered.
 */
var TIMEOUT_RETRY_COST = 10;
/**
 * The total amount of retry token to be incremented from retry token balance
 * if an SDK operation invocation succeeds without requiring a retry request.
 */
var NO_RETRY_INCREMENT = 1;

var getDefaultRetryQuota = function (initialRetryTokens) {
    var MAX_CAPACITY = initialRetryTokens;
    var availableCapacity = initialRetryTokens;
    var getCapacityAmount = function (error) { return (error.name === "TimeoutError" ? TIMEOUT_RETRY_COST : RETRY_COST); };
    var hasRetryTokens = function (error) { return getCapacityAmount(error) <= availableCapacity; };
    var retrieveRetryTokens = function (error) {
        if (!hasRetryTokens(error)) {
            // retryStrategy should stop retrying, and return last error
            throw new Error("No retry token available");
        }
        var capacityAmount = getCapacityAmount(error);
        availableCapacity -= capacityAmount;
        return capacityAmount;
    };
    var releaseRetryTokens = function (capacityReleaseAmount) {
        availableCapacity += capacityReleaseAmount !== null && capacityReleaseAmount !== void 0 ? capacityReleaseAmount : NO_RETRY_INCREMENT;
        availableCapacity = Math.min(availableCapacity, MAX_CAPACITY);
    };
    return Object.freeze({
        hasRetryTokens: hasRetryTokens,
        retrieveRetryTokens: retrieveRetryTokens,
        releaseRetryTokens: releaseRetryTokens,
    });
};

/**
 * Calculate a capped, fully-jittered exponential backoff time.
 */
var defaultDelayDecider = function (delayBase, attempts) {
    return Math.floor(Math.min(MAXIMUM_RETRY_DELAY, Math.random() * Math.pow(2, attempts) * delayBase));
};

var defaultRetryDecider = function (error) {
    if (!error) {
        return false;
    }
    return isRetryableByTrait(error) || isClockSkewError(error) || isThrottlingError(error) || isTransientError(error);
};

/**
 * The default value for how many HTTP requests an SDK should make for a
 * single SDK operation invocation before giving up
 */
var DEFAULT_MAX_ATTEMPTS = 3;
/**
 * The default retry algorithm to use.
 */
var DEFAULT_RETRY_MODE = "standard";
var StandardRetryStrategy = /** @class */ (function () {
    function StandardRetryStrategy(maxAttemptsProvider, options) {
        var _a, _b, _c;
        this.maxAttemptsProvider = maxAttemptsProvider;
        this.retryDecider = (_a = options === null || options === void 0 ? void 0 : options.retryDecider) !== null && _a !== void 0 ? _a : defaultRetryDecider;
        this.delayDecider = (_b = options === null || options === void 0 ? void 0 : options.delayDecider) !== null && _b !== void 0 ? _b : defaultDelayDecider;
        this.retryQuota = (_c = options === null || options === void 0 ? void 0 : options.retryQuota) !== null && _c !== void 0 ? _c : getDefaultRetryQuota(INITIAL_RETRY_TOKENS);
    }
    StandardRetryStrategy.prototype.shouldRetry = function (error, attempts, maxAttempts) {
        return attempts < maxAttempts && this.retryDecider(error) && this.retryQuota.hasRetryTokens(error);
    };
    StandardRetryStrategy.prototype.getMaxAttempts = function () {
        return __awaiter(this, void 0, void 0, function () {
            var maxAttempts, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.maxAttemptsProvider()];
                    case 1:
                        maxAttempts = _a.sent();
                        return [3 /*break*/, 3];
                    case 2:
                        error_1 = _a.sent();
                        maxAttempts = DEFAULT_MAX_ATTEMPTS;
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/, maxAttempts];
                }
            });
        });
    };
    StandardRetryStrategy.prototype.retry = function (next, args) {
        return __awaiter(this, void 0, void 0, function () {
            var retryTokenAmount, attempts, totalDelay, maxAttempts, request, _loop_1, this_1, state_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        attempts = 0;
                        totalDelay = 0;
                        return [4 /*yield*/, this.getMaxAttempts()];
                    case 1:
                        maxAttempts = _a.sent();
                        request = args.request;
                        if (HttpRequest.isInstance(request)) {
                            request.headers["amz-sdk-invocation-id"] = uuid_1.v4();
                        }
                        _loop_1 = function () {
                            var _a, response, output, err_1, delay_1;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0:
                                        _b.trys.push([0, 2, , 5]);
                                        if (HttpRequest.isInstance(request)) {
                                            request.headers["amz-sdk-request"] = "attempt=" + (attempts + 1) + "; max=" + maxAttempts;
                                        }
                                        return [4 /*yield*/, next(args)];
                                    case 1:
                                        _a = _b.sent(), response = _a.response, output = _a.output;
                                        this_1.retryQuota.releaseRetryTokens(retryTokenAmount);
                                        output.$metadata.attempts = attempts + 1;
                                        output.$metadata.totalRetryDelay = totalDelay;
                                        return [2 /*return*/, { value: { response: response, output: output } }];
                                    case 2:
                                        err_1 = _b.sent();
                                        attempts++;
                                        if (!this_1.shouldRetry(err_1, attempts, maxAttempts)) return [3 /*break*/, 4];
                                        retryTokenAmount = this_1.retryQuota.retrieveRetryTokens(err_1);
                                        delay_1 = this_1.delayDecider(isThrottlingError(err_1) ? THROTTLING_RETRY_DELAY_BASE : DEFAULT_RETRY_DELAY_BASE, attempts);
                                        totalDelay += delay_1;
                                        return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, delay_1); })];
                                    case 3:
                                        _b.sent();
                                        return [2 /*return*/, "continue"];
                                    case 4:
                                        if (!err_1.$metadata) {
                                            err_1.$metadata = {};
                                        }
                                        err_1.$metadata.attempts = attempts;
                                        err_1.$metadata.totalRetryDelay = totalDelay;
                                        throw err_1;
                                    case 5: return [2 /*return*/];
                                }
                            });
                        };
                        this_1 = this;
                        _a.label = 2;
                    case 2:
                        return [5 /*yield**/, _loop_1()];
                    case 3:
                        state_1 = _a.sent();
                        if (typeof state_1 === "object")
                            return [2 /*return*/, state_1.value];
                        return [3 /*break*/, 2];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    return StandardRetryStrategy;
}());

var ENV_MAX_ATTEMPTS = "AWS_MAX_ATTEMPTS";
var CONFIG_MAX_ATTEMPTS = "max_attempts";
var NODE_MAX_ATTEMPT_CONFIG_OPTIONS = {
    environmentVariableSelector: function (env) {
        var value = env[ENV_MAX_ATTEMPTS];
        if (!value)
            return undefined;
        var maxAttempt = parseInt(value);
        if (Number.isNaN(maxAttempt)) {
            throw new Error("Environment variable " + ENV_MAX_ATTEMPTS + " mast be a number, got \"" + value + "\"");
        }
        return maxAttempt;
    },
    configFileSelector: function (profile) {
        var value = profile[CONFIG_MAX_ATTEMPTS];
        if (!value)
            return undefined;
        var maxAttempt = parseInt(value);
        if (Number.isNaN(maxAttempt)) {
            throw new Error("Shared config file entry " + CONFIG_MAX_ATTEMPTS + " mast be a number, got \"" + value + "\"");
        }
        return maxAttempt;
    },
    default: DEFAULT_MAX_ATTEMPTS,
};
var resolveRetryConfig = function (input) {
    var maxAttempts = normalizeMaxAttempts(input.maxAttempts);
    return __assign(__assign({}, input), { maxAttempts: maxAttempts, retryStrategy: input.retryStrategy || new StandardRetryStrategy(maxAttempts) });
};
var normalizeMaxAttempts = function (maxAttempts) {
    if (maxAttempts === void 0) { maxAttempts = DEFAULT_MAX_ATTEMPTS; }
    if (typeof maxAttempts === "number") {
        var promisified_1 = Promise.resolve(maxAttempts);
        return function () { return promisified_1; };
    }
    return maxAttempts;
};
var ENV_RETRY_MODE = "AWS_RETRY_MODE";
var CONFIG_RETRY_MODE = "retry_mode";
var NODE_RETRY_MODE_CONFIG_OPTIONS = {
    environmentVariableSelector: function (env) { return env[ENV_RETRY_MODE]; },
    configFileSelector: function (profile) { return profile[CONFIG_RETRY_MODE]; },
    default: DEFAULT_RETRY_MODE,
};

var index = /*#__PURE__*/Object.freeze({
  __proto__: null,
  retryMiddleware: retryMiddleware,
  retryMiddlewareOptions: retryMiddlewareOptions,
  getRetryPlugin: getRetryPlugin,
  DEFAULT_MAX_ATTEMPTS: DEFAULT_MAX_ATTEMPTS,
  DEFAULT_RETRY_MODE: DEFAULT_RETRY_MODE,
  StandardRetryStrategy: StandardRetryStrategy,
  ENV_MAX_ATTEMPTS: ENV_MAX_ATTEMPTS,
  CONFIG_MAX_ATTEMPTS: CONFIG_MAX_ATTEMPTS,
  NODE_MAX_ATTEMPT_CONFIG_OPTIONS: NODE_MAX_ATTEMPT_CONFIG_OPTIONS,
  resolveRetryConfig: resolveRetryConfig,
  ENV_RETRY_MODE: ENV_RETRY_MODE,
  CONFIG_RETRY_MODE: CONFIG_RETRY_MODE,
  NODE_RETRY_MODE_CONFIG_OPTIONS: NODE_RETRY_MODE_CONFIG_OPTIONS,
  defaultDelayDecider: defaultDelayDecider,
  defaultRetryDecider: defaultRetryDecider
});

var name = "@aws-sdk/client-s3";
var description = "AWS SDK for JavaScript S3 Client for Node.js, Browser and React Native";
var version = "1.0.0-rc.3";
var scripts = {
	clean: "npm run remove-definitions && npm run remove-dist",
	"build-documentation": "npm run clean && typedoc ./",
	prepublishOnly: "yarn build",
	pretest: "yarn build:cjs",
	"remove-definitions": "rimraf ./types",
	"remove-dist": "rimraf ./dist",
	"remove-documentation": "rimraf ./docs",
	"test:unit": "mocha **/cjs/**/*.spec.js",
	"test:e2e": "mocha **/cjs/**/*.ispec.js && karma start karma.conf.js",
	test: "yarn test:unit",
	"build:cjs": "tsc -p tsconfig.json",
	"build:es": "tsc -p tsconfig.es.json",
	build: "yarn build:cjs && yarn build:es"
};
var main = "./dist/cjs/index.js";
var types$1 = "./types/index.d.ts";
var module$1 = "./dist/es/index.js";
var browser$1 = {
	"./runtimeConfig": "./runtimeConfig.browser"
};
var sideEffects = false;
var dependencies = {
	"@aws-crypto/sha256-browser": "^1.0.0",
	"@aws-crypto/sha256-js": "^1.0.0",
	"@aws-sdk/config-resolver": "1.0.0-rc.3",
	"@aws-sdk/credential-provider-node": "1.0.0-rc.3",
	"@aws-sdk/eventstream-serde-browser": "1.0.0-rc.3",
	"@aws-sdk/eventstream-serde-config-resolver": "1.0.0-rc.3",
	"@aws-sdk/eventstream-serde-node": "1.0.0-rc.3",
	"@aws-sdk/fetch-http-handler": "1.0.0-rc.3",
	"@aws-sdk/hash-blob-browser": "1.0.0-rc.3",
	"@aws-sdk/hash-node": "1.0.0-rc.3",
	"@aws-sdk/hash-stream-node": "1.0.0-rc.3",
	"@aws-sdk/invalid-dependency": "1.0.0-rc.3",
	"@aws-sdk/md5-js": "1.0.0-rc.3",
	"@aws-sdk/middleware-apply-body-checksum": "1.0.0-rc.3",
	"@aws-sdk/middleware-bucket-endpoint": "1.0.0-rc.3",
	"@aws-sdk/middleware-content-length": "1.0.0-rc.3",
	"@aws-sdk/middleware-expect-continue": "1.0.0-rc.3",
	"@aws-sdk/middleware-host-header": "1.0.0-rc.3",
	"@aws-sdk/middleware-location-constraint": "1.0.0-rc.3",
	"@aws-sdk/middleware-logger": "1.0.0-rc.3",
	"@aws-sdk/middleware-retry": "1.0.0-rc.3",
	"@aws-sdk/middleware-sdk-s3": "1.0.0-rc.3",
	"@aws-sdk/middleware-serde": "1.0.0-rc.3",
	"@aws-sdk/middleware-signing": "1.0.0-rc.3",
	"@aws-sdk/middleware-ssec": "1.0.0-rc.3",
	"@aws-sdk/middleware-stack": "1.0.0-rc.3",
	"@aws-sdk/middleware-user-agent": "1.0.0-rc.3",
	"@aws-sdk/node-config-provider": "1.0.0-rc.3",
	"@aws-sdk/node-http-handler": "1.0.0-rc.3",
	"@aws-sdk/protocol-http": "1.0.0-rc.3",
	"@aws-sdk/smithy-client": "1.0.0-rc.3",
	"@aws-sdk/types": "1.0.0-rc.3",
	"@aws-sdk/url-parser-browser": "1.0.0-rc.3",
	"@aws-sdk/url-parser-node": "1.0.0-rc.3",
	"@aws-sdk/util-base64-browser": "1.0.0-rc.3",
	"@aws-sdk/util-base64-node": "1.0.0-rc.3",
	"@aws-sdk/util-body-length-browser": "1.0.0-rc.3",
	"@aws-sdk/util-body-length-node": "1.0.0-rc.3",
	"@aws-sdk/util-user-agent-browser": "1.0.0-rc.3",
	"@aws-sdk/util-user-agent-node": "1.0.0-rc.3",
	"@aws-sdk/util-utf8-browser": "1.0.0-rc.3",
	"@aws-sdk/util-utf8-node": "1.0.0-rc.3",
	"@aws-sdk/xml-builder": "1.0.0-rc.3",
	"fast-xml-parser": "^3.16.0",
	tslib: "^2.0.0"
};
var devDependencies = {
	"@aws-sdk/client-documentation-generator": "1.0.0-rc.3",
	"@types/chai": "^4.2.11",
	"@types/mocha": "^7.0.2",
	"@types/node": "^12.7.5",
	jest: "^26.1.0",
	rimraf: "^3.0.0",
	typedoc: "^0.17.8",
	typescript: "~4.0.2"
};
var engines = {
	node: ">=10.0.0"
};
var author = {
	name: "AWS SDK for JavaScript Team",
	url: "https://aws.amazon.com/javascript/"
};
var license = "Apache-2.0";
var homepage = "https://github.com/aws/aws-sdk-js-v3/tree/master/clients/client-s3";
var repository = {
	type: "git",
	url: "https://github.com/aws/aws-sdk-js-v3.git",
	directory: "clients/client-s3"
};
var packageInfo = {
	name: name,
	description: description,
	version: version,
	scripts: scripts,
	main: main,
	types: types$1,
	module: module$1,
	browser: browser$1,
	"react-native": {
	"./runtimeConfig": "./runtimeConfig.native"
},
	sideEffects: sideEffects,
	dependencies: dependencies,
	devDependencies: devDependencies,
	engines: engines,
	author: author,
	license: license,
	homepage: homepage,
	repository: repository
};

var resolveEndpointsConfig = function (input) {
    var _a;
    return (__assign(__assign({}, input), { tls: (_a = input.tls) !== null && _a !== void 0 ? _a : true, endpoint: input.endpoint ? normalizeEndpoint(input) : function () { return getEndPointFromRegion(input); }, isCustomEndpoint: input.endpoint ? true : false }));
};
var normalizeEndpoint = function (input) {
    var endpoint = input.endpoint, urlParser = input.urlParser;
    if (typeof endpoint === "string") {
        var promisified_1 = Promise.resolve(urlParser(endpoint));
        return function () { return promisified_1; };
    }
    else if (typeof endpoint === "object") {
        var promisified_2 = Promise.resolve(endpoint);
        return function () { return promisified_2; };
    }
    return endpoint;
};
var getEndPointFromRegion = function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, tls, region, dnsHostRegex, hostname;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _a = input.tls, tls = _a === void 0 ? true : _a;
                return [4 /*yield*/, input.region()];
            case 1:
                region = _c.sent();
                dnsHostRegex = new RegExp(/^([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9])$/);
                if (!dnsHostRegex.test(region)) {
                    throw new Error("Invalid region in client config");
                }
                return [4 /*yield*/, input.regionInfoProvider(region)];
            case 2:
                hostname = ((_b = (_c.sent())) !== null && _b !== void 0 ? _b : {}).hostname;
                if (!hostname) {
                    throw new Error("Cannot resolve hostname from client config");
                }
                return [2 /*return*/, input.urlParser((tls ? "https:" : "http:") + "//" + hostname)];
        }
    });
}); };

var REGION_ENV_NAME = "AWS_REGION";
var REGION_INI_NAME = "region";
var NODE_REGION_CONFIG_OPTIONS = {
    environmentVariableSelector: function (env) { return env[REGION_ENV_NAME]; },
    configFileSelector: function (profile) { return profile[REGION_INI_NAME]; },
    default: function () {
        throw new Error("Region is missing");
    },
};
var NODE_REGION_CONFIG_FILE_OPTIONS = {
    preferredFile: "credentials",
};
var resolveRegionConfig = function (input) {
    if (!input.region) {
        throw new Error("Region is missing");
    }
    return __assign(__assign({}, input), { region: normalizeRegion(input.region) });
};
var normalizeRegion = function (region) {
    if (typeof region === "string") {
        var promisified_1 = Promise.resolve(region);
        return function () { return promisified_1; };
    }
    return region;
};

/**
 * An error representing a failure of an individual credential provider.
 *
 * This error class has special meaning to the {@link chain} method. If a
 * provider in the chain is rejected with an error, the chain will only proceed
 * to the next provider if the value of the `tryNextLink` property on the error
 * is truthy. This allows individual providers to halt the chain and also
 * ensures the chain will stop if an entirely unexpected error is encountered.
 */
var ProviderError = /** @class */ (function (_super) {
    __extends(ProviderError, _super);
    function ProviderError(message, tryNextLink) {
        if (tryNextLink === void 0) { tryNextLink = true; }
        var _this = _super.call(this, message) || this;
        _this.tryNextLink = tryNextLink;
        return _this;
    }
    return ProviderError;
}(Error));

/**
 * Compose a single credential provider function from multiple credential
 * providers. The first provider in the argument list will always be invoked;
 * subsequent providers in the list will be invoked in the order in which the
 * were received if the preceding provider did not successfully resolve.
 *
 * If no providers were received or no provider resolves successfully, the
 * returned promise will be rejected.
 */
function chain() {
    var providers = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        providers[_i] = arguments[_i];
    }
    return function () {
        var e_1, _a;
        var promise = Promise.reject(new ProviderError("No providers in chain"));
        var _loop_1 = function (provider) {
            promise = promise.catch(function (err) {
                if (err === null || err === void 0 ? void 0 : err.tryNextLink) {
                    return provider();
                }
                throw err;
            });
        };
        try {
            for (var providers_1 = __values(providers), providers_1_1 = providers_1.next(); !providers_1_1.done; providers_1_1 = providers_1.next()) {
                var provider = providers_1_1.value;
                _loop_1(provider);
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (providers_1_1 && !providers_1_1.done && (_a = providers_1.return)) _a.call(providers_1);
            }
            finally { if (e_1) throw e_1.error; }
        }
        return promise;
    };
}

var fromStatic = function (staticValue) { return function () { return Promise.resolve(staticValue); }; };

var memoize = function (provider, isExpired, requiresRefresh) {
    var result;
    var hasResult;
    if (isExpired === undefined) {
        // This is a static memoization; no need to incorporate refreshing
        return function () {
            if (!hasResult) {
                result = provider();
                hasResult = true;
            }
            return result;
        };
    }
    var isConstant = false;
    return function () { return __awaiter(void 0, void 0, void 0, function () {
        var resolved;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!hasResult) {
                        result = provider();
                        hasResult = true;
                    }
                    if (isConstant) {
                        return [2 /*return*/, result];
                    }
                    return [4 /*yield*/, result];
                case 1:
                    resolved = _a.sent();
                    if (requiresRefresh && !requiresRefresh(resolved)) {
                        isConstant = true;
                        return [2 /*return*/, resolved];
                    }
                    if (isExpired(resolved)) {
                        return [2 /*return*/, (result = provider())];
                    }
                    return [2 /*return*/, resolved];
            }
        });
    }); };
};

var ENV_KEY = "AWS_ACCESS_KEY_ID";
var ENV_SECRET = "AWS_SECRET_ACCESS_KEY";
var ENV_SESSION = "AWS_SESSION_TOKEN";
var ENV_EXPIRATION = "AWS_CREDENTIAL_EXPIRATION";
/**
 * Source AWS credentials from known environment variables. If either the
 * `AWS_ACCESS_KEY_ID` or `AWS_SECRET_ACCESS_KEY` environment variable is not
 * set in this process, the provider will return a rejected promise.
 */
function fromEnv() {
    return function () {
        var accessKeyId = process.env[ENV_KEY];
        var secretAccessKey = process.env[ENV_SECRET];
        var expiry = process.env[ENV_EXPIRATION];
        if (accessKeyId && secretAccessKey) {
            return Promise.resolve({
                accessKeyId: accessKeyId,
                secretAccessKey: secretAccessKey,
                sessionToken: process.env[ENV_SESSION],
                expiration: expiry ? new Date(expiry) : undefined,
            });
        }
        return Promise.reject(new ProviderError("Unable to find environment variable credentials."));
    };
}

/**
 * @internal
 */
function httpRequest(options) {
    return new Promise(function (resolve, reject) {
        var req = http.request(__assign({ method: "GET" }, options));
        req.on("error", function (err) {
            reject(Object.assign(new ProviderError("Unable to connect to instance metadata service"), err));
        });
        req.on("timeout", function () {
            reject(new Error("TimeoutError"));
        });
        req.on("response", function (res) {
            var _a = res.statusCode, statusCode = _a === void 0 ? 400 : _a;
            if (statusCode < 200 || 300 <= statusCode) {
                reject(Object.assign(new ProviderError("Error response received from instance metadata service"), { statusCode: statusCode }));
            }
            var chunks = [];
            res.on("data", function (chunk) {
                chunks.push(chunk);
            });
            res.on("end", function () {
                resolve(buffer.Buffer.concat(chunks));
            });
        });
        req.end();
    });
}

var isImdsCredentials = function (arg) {
    return Boolean(arg) &&
        typeof arg === "object" &&
        typeof arg.AccessKeyId === "string" &&
        typeof arg.SecretAccessKey === "string" &&
        typeof arg.Token === "string" &&
        typeof arg.Expiration === "string";
};
var fromImdsCredentials = function (creds) { return ({
    accessKeyId: creds.AccessKeyId,
    secretAccessKey: creds.SecretAccessKey,
    sessionToken: creds.Token,
    expiration: new Date(creds.Expiration),
}); };

var DEFAULT_TIMEOUT = 1000;
// The default in AWS SDK for Python and CLI (botocore) is no retry or one attempt
// https://github.com/boto/botocore/blob/646c61a7065933e75bab545b785e6098bc94c081/botocore/utils.py#L273
var DEFAULT_MAX_RETRIES = 0;
var providerConfigFromInit = function (_a) {
    var _b = _a.maxRetries, maxRetries = _b === void 0 ? DEFAULT_MAX_RETRIES : _b, _c = _a.timeout, timeout = _c === void 0 ? DEFAULT_TIMEOUT : _c;
    return ({ maxRetries: maxRetries, timeout: timeout });
};

/**
 * @internal
 */
var retry = function (toRetry, maxRetries) {
    var promise = toRetry();
    for (var i = 0; i < maxRetries; i++) {
        promise = promise.catch(toRetry);
    }
    return promise;
};

var ENV_CMDS_FULL_URI = "AWS_CONTAINER_CREDENTIALS_FULL_URI";
var ENV_CMDS_RELATIVE_URI = "AWS_CONTAINER_CREDENTIALS_RELATIVE_URI";
var ENV_CMDS_AUTH_TOKEN = "AWS_CONTAINER_AUTHORIZATION_TOKEN";
/**
 * Creates a credential provider that will source credentials from the ECS
 * Container Metadata Service
 */
function fromContainerMetadata(init) {
    var _this = this;
    if (init === void 0) { init = {}; }
    var _a = providerConfigFromInit(init), timeout = _a.timeout, maxRetries = _a.maxRetries;
    return function () {
        return getCmdsUri().then(function (url) {
            return retry(function () { return __awaiter(_this, void 0, void 0, function () {
                var credsResponse, _a, _b;
                return __generator(this, function (_c) {
                    switch (_c.label) {
                        case 0:
                            _b = (_a = JSON).parse;
                            return [4 /*yield*/, requestFromEcsImds(timeout, url)];
                        case 1:
                            credsResponse = _b.apply(_a, [_c.sent()]);
                            if (!isImdsCredentials(credsResponse)) {
                                throw new ProviderError("Invalid response received from instance metadata service.");
                            }
                            return [2 /*return*/, fromImdsCredentials(credsResponse)];
                    }
                });
            }); }, maxRetries);
        });
    };
}
function requestFromEcsImds(timeout, options) {
    if (process.env[ENV_CMDS_AUTH_TOKEN]) {
        var _a = options.headers, headers = _a === void 0 ? {} : _a;
        headers.Authorization = process.env[ENV_CMDS_AUTH_TOKEN];
        options.headers = headers;
    }
    return httpRequest(__assign(__assign({}, options), { timeout: timeout })).then(function (buffer) { return buffer.toString(); });
}
var CMDS_IP = "169.254.170.2";
var GREENGRASS_HOSTS = {
    localhost: true,
    "127.0.0.1": true,
};
var GREENGRASS_PROTOCOLS = {
    "http:": true,
    "https:": true,
};
function getCmdsUri() {
    if (process.env[ENV_CMDS_RELATIVE_URI]) {
        return Promise.resolve({
            hostname: CMDS_IP,
            path: process.env[ENV_CMDS_RELATIVE_URI],
        });
    }
    if (process.env[ENV_CMDS_FULL_URI]) {
        var parsed = Url.parse(process.env[ENV_CMDS_FULL_URI]);
        if (!parsed.hostname || !(parsed.hostname in GREENGRASS_HOSTS)) {
            return Promise.reject(new ProviderError(parsed.hostname + " is not a valid container metadata service hostname", false));
        }
        if (!parsed.protocol || !(parsed.protocol in GREENGRASS_PROTOCOLS)) {
            return Promise.reject(new ProviderError(parsed.protocol + " is not a valid container metadata service protocol", false));
        }
        return Promise.resolve(__assign(__assign({}, parsed), { port: parsed.port ? parseInt(parsed.port, 10) : undefined }));
    }
    return Promise.reject(new ProviderError("The container metadata credential provider cannot be used unless" +
        (" the " + ENV_CMDS_RELATIVE_URI + " or " + ENV_CMDS_FULL_URI + " environment") +
        " variable is set", false));
}

var IMDS_IP = "169.254.169.254";
var IMDS_PATH = "/latest/meta-data/iam/security-credentials/";
var IMDS_TOKEN_PATH = "/latest/api/token";
/**
 * Creates a credential provider that will source credentials from the EC2
 * Instance Metadata Service
 */
var fromInstanceMetadata = function (init) {
    if (init === void 0) { init = {}; }
    // when set to true, metadata service will not fetch token
    var disableFetchToken = false;
    var _a = providerConfigFromInit(init), timeout = _a.timeout, maxRetries = _a.maxRetries;
    var getCredentials = function (maxRetries, options) { return __awaiter(void 0, void 0, void 0, function () {
        var profile;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, retry(function () { return __awaiter(void 0, void 0, void 0, function () {
                        var profile, err_1;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 2, , 3]);
                                    return [4 /*yield*/, getProfile(options)];
                                case 1:
                                    profile = _a.sent();
                                    return [3 /*break*/, 3];
                                case 2:
                                    err_1 = _a.sent();
                                    if (err_1.statusCode === 401) {
                                        disableFetchToken = false;
                                    }
                                    throw err_1;
                                case 3: return [2 /*return*/, profile];
                            }
                        });
                    }); }, maxRetries)];
                case 1:
                    profile = (_a.sent()).trim();
                    return [2 /*return*/, retry(function () { return __awaiter(void 0, void 0, void 0, function () {
                            var creds, err_2;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        _a.trys.push([0, 2, , 3]);
                                        return [4 /*yield*/, getCredentialsFromProfile(profile, options)];
                                    case 1:
                                        creds = _a.sent();
                                        return [3 /*break*/, 3];
                                    case 2:
                                        err_2 = _a.sent();
                                        if (err_2.statusCode === 401) {
                                            disableFetchToken = false;
                                        }
                                        throw err_2;
                                    case 3: return [2 /*return*/, creds];
                                }
                            });
                        }); }, maxRetries)];
            }
        });
    }); };
    return function () { return __awaiter(void 0, void 0, void 0, function () {
        var token, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!disableFetchToken) return [3 /*break*/, 1];
                    return [2 /*return*/, getCredentials(maxRetries, { timeout: timeout })];
                case 1:
                    token = void 0;
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, getMetadataToken({ timeout: timeout })];
                case 3:
                    token = (_a.sent()).toString();
                    return [3 /*break*/, 5];
                case 4:
                    error_1 = _a.sent();
                    if ((error_1 === null || error_1 === void 0 ? void 0 : error_1.statusCode) === 400) {
                        throw Object.assign(error_1, {
                            message: "EC2 Metadata token request returned error",
                        });
                    }
                    else if (error_1.message === "TimeoutError" || [403, 404, 405].includes(error_1.statusCode)) {
                        disableFetchToken = true;
                    }
                    return [2 /*return*/, getCredentials(maxRetries, { timeout: timeout })];
                case 5: return [2 /*return*/, getCredentials(maxRetries, {
                        timeout: timeout,
                        headers: {
                            "x-aws-ec2-metadata-token": token,
                        },
                    })];
            }
        });
    }); };
};
var getMetadataToken = function (options) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        return [2 /*return*/, httpRequest(__assign(__assign({}, options), { host: IMDS_IP, path: IMDS_TOKEN_PATH, method: "PUT", headers: {
                    "x-aws-ec2-metadata-token-ttl-seconds": "21600",
                } }))];
    });
}); };
var getProfile = function (options) { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
    switch (_a.label) {
        case 0: return [4 /*yield*/, httpRequest(__assign(__assign({}, options), { host: IMDS_IP, path: IMDS_PATH }))];
        case 1: return [2 /*return*/, (_a.sent()).toString()];
    }
}); }); };
var getCredentialsFromProfile = function (profile, options) { return __awaiter(void 0, void 0, void 0, function () {
    var credsResponse, _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _b = (_a = JSON).parse;
                return [4 /*yield*/, httpRequest(__assign(__assign({}, options), { host: IMDS_IP, path: IMDS_PATH + profile }))];
            case 1:
                credsResponse = _b.apply(_a, [(_c.sent()).toString()]);
                if (!isImdsCredentials(credsResponse)) {
                    throw new ProviderError("Invalid response received from instance metadata service.");
                }
                return [2 /*return*/, fromImdsCredentials(credsResponse)];
        }
    });
}); };

var ENV_CREDENTIALS_PATH = "AWS_SHARED_CREDENTIALS_FILE";
var ENV_CONFIG_PATH = "AWS_CONFIG_FILE";
var swallowError = function () { return ({}); };
function loadSharedConfigFiles(init) {
    if (init === void 0) { init = {}; }
    var _a = init.filepath, filepath = _a === void 0 ? process.env[ENV_CREDENTIALS_PATH] || require$$1.join(getHomeDir(), ".aws", "credentials") : _a, _b = init.configFilepath, configFilepath = _b === void 0 ? process.env[ENV_CONFIG_PATH] || require$$1.join(getHomeDir(), ".aws", "config") : _b;
    return Promise.all([
        slurpFile(configFilepath).then(parseIni).then(normalizeConfigFile).catch(swallowError),
        slurpFile(filepath).then(parseIni).catch(swallowError),
    ]).then(function (parsedFiles) {
        var _a = __read(parsedFiles, 2), configFile = _a[0], credentialsFile = _a[1];
        return {
            configFile: configFile,
            credentialsFile: credentialsFile,
        };
    });
}
var profileKeyRegex = /^profile\s(["'])?([^\1]+)\1$/;
function normalizeConfigFile(data) {
    var e_1, _a;
    var map = {};
    try {
        for (var _b = __values(Object.keys(data)), _c = _b.next(); !_c.done; _c = _b.next()) {
            var key = _c.value;
            var matches = void 0;
            if (key === "default") {
                map.default = data.default;
            }
            else if ((matches = profileKeyRegex.exec(key))) {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                var _d = __read(matches, 3), _1 = _d[0], _2 = _d[1], normalizedKey = _d[2];
                if (normalizedKey) {
                    map[normalizedKey] = data[key];
                }
            }
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
        }
        finally { if (e_1) throw e_1.error; }
    }
    return map;
}
function parseIni(iniData) {
    var e_2, _a;
    var map = {};
    var currentSection;
    try {
        for (var _b = __values(iniData.split(/\r?\n/)), _c = _b.next(); !_c.done; _c = _b.next()) {
            var line = _c.value;
            line = line.split(/(^|\s)[;#]/)[0]; // remove comments
            var section = line.match(/^\s*\[([^\[\]]+)]\s*$/);
            if (section) {
                currentSection = section[1];
            }
            else if (currentSection) {
                var item = line.match(/^\s*(.+?)\s*=\s*(.+?)\s*$/);
                if (item) {
                    map[currentSection] = map[currentSection] || {};
                    map[currentSection][item[1]] = item[2];
                }
            }
        }
    }
    catch (e_2_1) { e_2 = { error: e_2_1 }; }
    finally {
        try {
            if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
        }
        finally { if (e_2) throw e_2.error; }
    }
    return map;
}
function slurpFile(path) {
    return new Promise(function (resolve, reject) {
        fs.readFile(path, "utf8", function (err, data) {
            if (err) {
                reject(err);
            }
            else {
                resolve(data);
            }
        });
    });
}
function getHomeDir() {
    var _a = process.env, HOME = _a.HOME, USERPROFILE = _a.USERPROFILE, HOMEPATH = _a.HOMEPATH, _b = _a.HOMEDRIVE, HOMEDRIVE = _b === void 0 ? "C:" + require$$1.sep : _b;
    if (HOME)
        return HOME;
    if (USERPROFILE)
        return USERPROFILE;
    if (HOMEPATH)
        return "" + HOMEDRIVE + HOMEPATH;
    return os.homedir();
}

var DEFAULT_PROFILE = "default";
var ENV_PROFILE = "AWS_PROFILE";
function isStaticCredsProfile(arg) {
    return (Boolean(arg) &&
        typeof arg === "object" &&
        typeof arg.aws_access_key_id === "string" &&
        typeof arg.aws_secret_access_key === "string" &&
        ["undefined", "string"].indexOf(typeof arg.aws_session_token) > -1);
}
function isAssumeRoleProfile(arg) {
    return (Boolean(arg) &&
        typeof arg === "object" &&
        typeof arg.role_arn === "string" &&
        typeof arg.source_profile === "string" &&
        ["undefined", "string"].indexOf(typeof arg.role_session_name) > -1 &&
        ["undefined", "string"].indexOf(typeof arg.external_id) > -1 &&
        ["undefined", "string"].indexOf(typeof arg.mfa_serial) > -1);
}
/**
 * Creates a credential provider that will read from ini files and supports
 * role assumption and multi-factor authentication.
 */
function fromIni(init) {
    if (init === void 0) { init = {}; }
    return function () { return parseKnownFiles(init).then(function (profiles) { return resolveProfileData(getMasterProfileName(init), profiles, init); }); };
}
function getMasterProfileName(init) {
    return init.profile || process.env[ENV_PROFILE] || DEFAULT_PROFILE;
}
function resolveProfileData(profileName, profiles, options, visitedProfiles) {
    if (visitedProfiles === void 0) { visitedProfiles = {}; }
    return __awaiter(this, void 0, void 0, function () {
        var data, ExternalId, mfa_serial, RoleArn, _a, RoleSessionName, source_profile, sourceCreds, params, _b, _c, _d;
        var _e;
        return __generator(this, function (_f) {
            switch (_f.label) {
                case 0:
                    data = profiles[profileName];
                    // If this is not the first profile visited, static credentials should be
                    // preferred over role assumption metadata. This special treatment of
                    // second and subsequent hops is to ensure compatibility with the AWS CLI.
                    if (Object.keys(visitedProfiles).length > 0 && isStaticCredsProfile(data)) {
                        return [2 /*return*/, resolveStaticCredentials(data)];
                    }
                    if (!isAssumeRoleProfile(data)) return [3 /*break*/, 4];
                    ExternalId = data.external_id, mfa_serial = data.mfa_serial, RoleArn = data.role_arn, _a = data.role_session_name, RoleSessionName = _a === void 0 ? "aws-sdk-js-" + Date.now() : _a, source_profile = data.source_profile;
                    if (!options.roleAssumer) {
                        throw new ProviderError("Profile " + profileName + " requires a role to be assumed, but no" + " role assumption callback was provided.", false);
                    }
                    if (source_profile in visitedProfiles) {
                        throw new ProviderError("Detected a cycle attempting to resolve credentials for profile" +
                            (" " + getMasterProfileName(options) + ". Profiles visited: ") +
                            Object.keys(visitedProfiles).join(", "), false);
                    }
                    sourceCreds = resolveProfileData(source_profile, profiles, options, __assign(__assign({}, visitedProfiles), (_e = {}, _e[source_profile] = true, _e)));
                    params = { RoleArn: RoleArn, RoleSessionName: RoleSessionName, ExternalId: ExternalId };
                    if (!mfa_serial) return [3 /*break*/, 2];
                    if (!options.mfaCodeProvider) {
                        throw new ProviderError("Profile " + profileName + " requires multi-factor authentication," + " but no MFA code callback was provided.", false);
                    }
                    params.SerialNumber = mfa_serial;
                    _b = params;
                    return [4 /*yield*/, options.mfaCodeProvider(mfa_serial)];
                case 1:
                    _b.TokenCode = _f.sent();
                    _f.label = 2;
                case 2:
                    _d = (_c = options).roleAssumer;
                    return [4 /*yield*/, sourceCreds];
                case 3: return [2 /*return*/, _d.apply(_c, [_f.sent(), params])];
                case 4:
                    // If no role assumption metadata is present, attempt to load static
                    // credentials from the selected profile.
                    if (isStaticCredsProfile(data)) {
                        return [2 /*return*/, resolveStaticCredentials(data)];
                    }
                    // If the profile cannot be parsed or contains neither static credentials
                    // nor role assumption metadata, throw an error. This should be considered a
                    // terminal resolution error if a profile has been specified by the user
                    // (whether via a parameter, an environment variable, or another profile's
                    // `source_profile` key).
                    throw new ProviderError("Profile " + profileName + " could not be found or parsed in shared" + " credentials file.");
            }
        });
    });
}
function parseKnownFiles(init) {
    var _a = init.loadedConfig, loadedConfig = _a === void 0 ? loadSharedConfigFiles(init) : _a;
    return loadedConfig.then(function (parsedFiles) {
        var configFile = parsedFiles.configFile, credentialsFile = parsedFiles.credentialsFile;
        return __assign(__assign({}, configFile), credentialsFile);
    });
}
function resolveStaticCredentials(profile) {
    return Promise.resolve({
        accessKeyId: profile.aws_access_key_id,
        secretAccessKey: profile.aws_secret_access_key,
        sessionToken: profile.aws_session_token,
    });
}

/**
 * Creates a credential provider that will read from a credential_process specified
 * in ini files.
 */
function fromProcess(init) {
    if (init === void 0) { init = {}; }
    return function () {
        return parseKnownFiles(init).then(function (profiles) { return resolveProcessCredentials(getMasterProfileName(init), profiles); });
    };
}
function resolveProcessCredentials(profileName, profiles, 
// eslint-disable-next-line @typescript-eslint/no-unused-vars
options) {
    return __awaiter(this, void 0, void 0, function () {
        var profile, credentialProcess;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    profile = profiles[profileName];
                    if (!profiles[profileName]) return [3 /*break*/, 4];
                    credentialProcess = profile["credential_process"];
                    if (!(credentialProcess !== undefined)) return [3 /*break*/, 2];
                    return [4 /*yield*/, execPromise(credentialProcess)
                            .then(function (processResult) {
                            var data;
                            try {
                                data = JSON.parse(processResult);
                            }
                            catch (_a) {
                                throw Error("Profile " + profileName + " credential_process returned invalid JSON.");
                            }
                            var version = data.Version, accessKeyId = data.AccessKeyId, secretAccessKey = data.SecretAccessKey, sessionToken = data.SessionToken, expiration = data.Expiration;
                            if (version !== 1) {
                                throw Error("Profile " + profileName + " credential_process did not return Version 1.");
                            }
                            if (accessKeyId === undefined || secretAccessKey === undefined) {
                                throw Error("Profile " + profileName + " credential_process returned invalid credentials.");
                            }
                            var expirationUnix;
                            if (expiration) {
                                var currentTime = new Date();
                                var expireTime = new Date(expiration);
                                if (expireTime < currentTime) {
                                    throw Error("Profile " + profileName + " credential_process returned expired credentials.");
                                }
                                expirationUnix = Math.floor(new Date(expiration).valueOf() / 1000);
                            }
                            return {
                                accessKeyId: accessKeyId,
                                secretAccessKey: secretAccessKey,
                                sessionToken: sessionToken,
                                expirationUnix: expirationUnix,
                            };
                        })
                            .catch(function (error) {
                            throw new ProviderError(error.message);
                        })];
                case 1: return [2 /*return*/, _a.sent()];
                case 2: throw new ProviderError("Profile " + profileName + " did not contain credential_process.");
                case 3: return [3 /*break*/, 5];
                case 4: 
                // If the profile cannot be parsed or does not contain the default or
                // specified profile throw an error. This should be considered a terminal
                // resolution error if a profile has been specified by the user (whether via
                // a parameter, anenvironment variable, or another profile's `source_profile` key).
                throw new ProviderError("Profile " + profileName + " could not be found in shared credentials file.");
                case 5: return [2 /*return*/];
            }
        });
    });
}
function execPromise(command) {
    return new Promise(function (resolve, reject) {
        child_process.exec(command, function (error, stdout) {
            if (error) {
                reject(error);
                return;
            }
            resolve(stdout.trim());
        });
    });
}

var ENV_IMDS_DISABLED = "AWS_EC2_METADATA_DISABLED";
/**
 * Creates a credential provider that will attempt to find credentials from the
 * following sources (listed in order of precedence):
 *   * Environment variables exposed via `process.env`
 *   * Shared credentials and config ini files
 *   * The EC2/ECS Instance Metadata Service
 *
 * The default credential provider will invoke one provider at a time and only
 * continue to the next if no credentials have been located. For example, if
 * the process finds values defined via the `AWS_ACCESS_KEY_ID` and
 * `AWS_SECRET_ACCESS_KEY` environment variables, the files at
 * `~/.aws/credentials` and `~/.aws/config` will not be read, nor will any
 * messages be sent to the Instance Metadata Service.
 *
 * @param init                  Configuration that is passed to each individual
 *                              provider
 *
 * @see fromEnv                 The function used to source credentials from
 *                              environment variables
 * @see fromIni                 The function used to source credentials from INI
 *                              files
 * @see fromProcess             The functino used to sources credentials from
 *                              credential_process in INI files
 * @see fromInstanceMetadata    The function used to source credentials from the
 *                              EC2 Instance Metadata Service
 * @see fromContainerMetadata   The function used to source credentials from the
 *                              ECS Container Metadata Service
 */
function defaultProvider(init) {
    if (init === void 0) { init = {}; }
    var _a = init.profile, profile = _a === void 0 ? process.env[ENV_PROFILE] : _a;
    var providerChain = profile
        ? fromIni(init)
        : chain(fromEnv(), fromIni(init), fromProcess(init), remoteProvider(init));
    return memoize(providerChain, function (credentials) { return credentials.expiration !== undefined && credentials.expiration.getTime() - Date.now() < 300000; }, function (credentials) { return credentials.expiration !== undefined; });
}
function remoteProvider(init) {
    if (process.env[ENV_CMDS_RELATIVE_URI] || process.env[ENV_CMDS_FULL_URI]) {
        return fromContainerMetadata(init);
    }
    if (process.env[ENV_IMDS_DISABLED]) {
        return function () { return Promise.reject(new ProviderError("EC2 Instance Metadata Service access disabled")); };
    }
    return fromInstanceMetadata(init);
}

/*! *****************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */
/* global Reflect, Promise */

var extendStatics$1 = function(d, b) {
    extendStatics$1 = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return extendStatics$1(d, b);
};

function __extends$1(d, b) {
    extendStatics$1(d, b);
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
}

var __assign$1 = function() {
    __assign$1 = Object.assign || function __assign(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
        }
        return t;
    };
    return __assign$1.apply(this, arguments);
};

function __rest$1(s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
}

function __decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}

function __param(paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
}

function __metadata(metadataKey, metadataValue) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(metadataKey, metadataValue);
}

function __awaiter$1(thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
}

function __generator$1(thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
}

function __createBinding(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}

function __exportStar(m, exports) {
    for (var p in m) if (p !== "default" && !exports.hasOwnProperty(p)) exports[p] = m[p];
}

function __values$1(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
}

function __read$1(o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
}

function __spread$1() {
    for (var ar = [], i = 0; i < arguments.length; i++)
        ar = ar.concat(__read$1(arguments[i]));
    return ar;
}

function __spreadArrays() {
    for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
    for (var r = Array(s), k = 0, i = 0; i < il; i++)
        for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
            r[k] = a[j];
    return r;
}
function __await$1(v) {
    return this instanceof __await$1 ? (this.v = v, this) : new __await$1(v);
}

function __asyncGenerator$1(thisArg, _arguments, generator) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var g = generator.apply(thisArg, _arguments || []), i, q = [];
    return i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i;
    function verb(n) { if (g[n]) i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); }; }
    function resume(n, v) { try { step(g[n](v)); } catch (e) { settle(q[0][3], e); } }
    function step(r) { r.value instanceof __await$1 ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r); }
    function fulfill(value) { resume("next", value); }
    function reject(value) { resume("throw", value); }
    function settle(f, v) { if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]); }
}

function __asyncDelegator(o) {
    var i, p;
    return i = {}, verb("next"), verb("throw", function (e) { throw e; }), verb("return"), i[Symbol.iterator] = function () { return this; }, i;
    function verb(n, f) { i[n] = o[n] ? function (v) { return (p = !p) ? { value: __await$1(o[n](v)), done: n === "return" } : f ? f(v) : v; } : f; }
}

function __asyncValues$1(o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values$1 === "function" ? __values$1(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
}

function __makeTemplateObject(cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
}
function __importStar(mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result.default = mod;
    return result;
}

function __importDefault(mod) {
    return (mod && mod.__esModule) ? mod : { default: mod };
}

function __classPrivateFieldGet(receiver, privateMap) {
    if (!privateMap.has(receiver)) {
        throw new TypeError("attempted to get private field on non-instance");
    }
    return privateMap.get(receiver);
}

function __classPrivateFieldSet(receiver, privateMap, value) {
    if (!privateMap.has(receiver)) {
        throw new TypeError("attempted to set private field on non-instance");
    }
    privateMap.set(receiver, value);
    return value;
}

var tslib_es6 = /*#__PURE__*/Object.freeze({
  __proto__: null,
  __extends: __extends$1,
  get __assign () { return __assign$1; },
  __rest: __rest$1,
  __decorate: __decorate,
  __param: __param,
  __metadata: __metadata,
  __awaiter: __awaiter$1,
  __generator: __generator$1,
  __createBinding: __createBinding,
  __exportStar: __exportStar,
  __values: __values$1,
  __read: __read$1,
  __spread: __spread$1,
  __spreadArrays: __spreadArrays,
  __await: __await$1,
  __asyncGenerator: __asyncGenerator$1,
  __asyncDelegator: __asyncDelegator,
  __asyncValues: __asyncValues$1,
  __makeTemplateObject: __makeTemplateObject,
  __importStar: __importStar,
  __importDefault: __importDefault,
  __classPrivateFieldGet: __classPrivateFieldGet,
  __classPrivateFieldSet: __classPrivateFieldSet
});

var build = createCommonjsModule(function (module, exports) {
Object.defineProperty(exports, "__esModule", { value: true });
exports.Crc32 = exports.crc32 = void 0;

function crc32(data) {
    return new Crc32().update(data).digest();
}
exports.crc32 = crc32;
var Crc32 = /** @class */ (function () {
    function Crc32() {
        this.checksum = 0xffffffff;
    }
    Crc32.prototype.update = function (data) {
        var e_1, _a;
        try {
            for (var data_1 = tslib_es6.__values(data), data_1_1 = data_1.next(); !data_1_1.done; data_1_1 = data_1.next()) {
                var byte = data_1_1.value;
                this.checksum =
                    (this.checksum >>> 8) ^ lookupTable[(this.checksum ^ byte) & 0xff];
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (data_1_1 && !data_1_1.done && (_a = data_1.return)) _a.call(data_1);
            }
            finally { if (e_1) throw e_1.error; }
        }
        return this;
    };
    Crc32.prototype.digest = function () {
        return (this.checksum ^ 0xffffffff) >>> 0;
    };
    return Crc32;
}());
exports.Crc32 = Crc32;
// prettier-ignore
var lookupTable = Uint32Array.from([
    0x00000000, 0x77073096, 0xEE0E612C, 0x990951BA,
    0x076DC419, 0x706AF48F, 0xE963A535, 0x9E6495A3,
    0x0EDB8832, 0x79DCB8A4, 0xE0D5E91E, 0x97D2D988,
    0x09B64C2B, 0x7EB17CBD, 0xE7B82D07, 0x90BF1D91,
    0x1DB71064, 0x6AB020F2, 0xF3B97148, 0x84BE41DE,
    0x1ADAD47D, 0x6DDDE4EB, 0xF4D4B551, 0x83D385C7,
    0x136C9856, 0x646BA8C0, 0xFD62F97A, 0x8A65C9EC,
    0x14015C4F, 0x63066CD9, 0xFA0F3D63, 0x8D080DF5,
    0x3B6E20C8, 0x4C69105E, 0xD56041E4, 0xA2677172,
    0x3C03E4D1, 0x4B04D447, 0xD20D85FD, 0xA50AB56B,
    0x35B5A8FA, 0x42B2986C, 0xDBBBC9D6, 0xACBCF940,
    0x32D86CE3, 0x45DF5C75, 0xDCD60DCF, 0xABD13D59,
    0x26D930AC, 0x51DE003A, 0xC8D75180, 0xBFD06116,
    0x21B4F4B5, 0x56B3C423, 0xCFBA9599, 0xB8BDA50F,
    0x2802B89E, 0x5F058808, 0xC60CD9B2, 0xB10BE924,
    0x2F6F7C87, 0x58684C11, 0xC1611DAB, 0xB6662D3D,
    0x76DC4190, 0x01DB7106, 0x98D220BC, 0xEFD5102A,
    0x71B18589, 0x06B6B51F, 0x9FBFE4A5, 0xE8B8D433,
    0x7807C9A2, 0x0F00F934, 0x9609A88E, 0xE10E9818,
    0x7F6A0DBB, 0x086D3D2D, 0x91646C97, 0xE6635C01,
    0x6B6B51F4, 0x1C6C6162, 0x856530D8, 0xF262004E,
    0x6C0695ED, 0x1B01A57B, 0x8208F4C1, 0xF50FC457,
    0x65B0D9C6, 0x12B7E950, 0x8BBEB8EA, 0xFCB9887C,
    0x62DD1DDF, 0x15DA2D49, 0x8CD37CF3, 0xFBD44C65,
    0x4DB26158, 0x3AB551CE, 0xA3BC0074, 0xD4BB30E2,
    0x4ADFA541, 0x3DD895D7, 0xA4D1C46D, 0xD3D6F4FB,
    0x4369E96A, 0x346ED9FC, 0xAD678846, 0xDA60B8D0,
    0x44042D73, 0x33031DE5, 0xAA0A4C5F, 0xDD0D7CC9,
    0x5005713C, 0x270241AA, 0xBE0B1010, 0xC90C2086,
    0x5768B525, 0x206F85B3, 0xB966D409, 0xCE61E49F,
    0x5EDEF90E, 0x29D9C998, 0xB0D09822, 0xC7D7A8B4,
    0x59B33D17, 0x2EB40D81, 0xB7BD5C3B, 0xC0BA6CAD,
    0xEDB88320, 0x9ABFB3B6, 0x03B6E20C, 0x74B1D29A,
    0xEAD54739, 0x9DD277AF, 0x04DB2615, 0x73DC1683,
    0xE3630B12, 0x94643B84, 0x0D6D6A3E, 0x7A6A5AA8,
    0xE40ECF0B, 0x9309FF9D, 0x0A00AE27, 0x7D079EB1,
    0xF00F9344, 0x8708A3D2, 0x1E01F268, 0x6906C2FE,
    0xF762575D, 0x806567CB, 0x196C3671, 0x6E6B06E7,
    0xFED41B76, 0x89D32BE0, 0x10DA7A5A, 0x67DD4ACC,
    0xF9B9DF6F, 0x8EBEEFF9, 0x17B7BE43, 0x60B08ED5,
    0xD6D6A3E8, 0xA1D1937E, 0x38D8C2C4, 0x4FDFF252,
    0xD1BB67F1, 0xA6BC5767, 0x3FB506DD, 0x48B2364B,
    0xD80D2BDA, 0xAF0A1B4C, 0x36034AF6, 0x41047A60,
    0xDF60EFC3, 0xA867DF55, 0x316E8EEF, 0x4669BE79,
    0xCB61B38C, 0xBC66831A, 0x256FD2A0, 0x5268E236,
    0xCC0C7795, 0xBB0B4703, 0x220216B9, 0x5505262F,
    0xC5BA3BBE, 0xB2BD0B28, 0x2BB45A92, 0x5CB36A04,
    0xC2D7FFA7, 0xB5D0CF31, 0x2CD99E8B, 0x5BDEAE1D,
    0x9B64C2B0, 0xEC63F226, 0x756AA39C, 0x026D930A,
    0x9C0906A9, 0xEB0E363F, 0x72076785, 0x05005713,
    0x95BF4A82, 0xE2B87A14, 0x7BB12BAE, 0x0CB61B38,
    0x92D28E9B, 0xE5D5BE0D, 0x7CDCEFB7, 0x0BDBDF21,
    0x86D3D2D4, 0xF1D4E242, 0x68DDB3F8, 0x1FDA836E,
    0x81BE16CD, 0xF6B9265B, 0x6FB077E1, 0x18B74777,
    0x88085AE6, 0xFF0F6A70, 0x66063BCA, 0x11010B5C,
    0x8F659EFF, 0xF862AE69, 0x616BFFD3, 0x166CCF45,
    0xA00AE278, 0xD70DD2EE, 0x4E048354, 0x3903B3C2,
    0xA7672661, 0xD06016F7, 0x4969474D, 0x3E6E77DB,
    0xAED16A4A, 0xD9D65ADC, 0x40DF0B66, 0x37D83BF0,
    0xA9BCAE53, 0xDEBB9EC5, 0x47B2CF7F, 0x30B5FFE9,
    0xBDBDF21C, 0xCABAC28A, 0x53B39330, 0x24B4A3A6,
    0xBAD03605, 0xCDD70693, 0x54DE5729, 0x23D967BF,
    0xB3667A2E, 0xC4614AB8, 0x5D681B02, 0x2A6F2B94,
    0xB40BBE37, 0xC30C8EA1, 0x5A05DF1B, 0x2D02EF8D,
]);

});

var SHORT_TO_HEX = {};
var HEX_TO_SHORT = {};
for (var i$1 = 0; i$1 < 256; i$1++) {
    var encodedByte = i$1.toString(16).toLowerCase();
    if (encodedByte.length === 1) {
        encodedByte = "0" + encodedByte;
    }
    SHORT_TO_HEX[i$1] = encodedByte;
    HEX_TO_SHORT[encodedByte] = i$1;
}
/**
 * Converts a hexadecimal encoded string to a Uint8Array of bytes.
 *
 * @param encoded The hexadecimal encoded string
 */
function fromHex(encoded) {
    if (encoded.length % 2 !== 0) {
        throw new Error("Hex encoded strings must have an even number length");
    }
    var out = new Uint8Array(encoded.length / 2);
    for (var i = 0; i < encoded.length; i += 2) {
        var encodedByte = encoded.substr(i, 2).toLowerCase();
        if (encodedByte in HEX_TO_SHORT) {
            out[i / 2] = HEX_TO_SHORT[encodedByte];
        }
        else {
            throw new Error("Cannot decode unrecognized sequence " + encodedByte + " as hexadecimal");
        }
    }
    return out;
}
/**
 * Converts a Uint8Array of binary data to a hexadecimal encoded string.
 *
 * @param bytes The binary data to encode
 */
function toHex(bytes) {
    var out = "";
    for (var i = 0; i < bytes.byteLength; i++) {
        out += SHORT_TO_HEX[bytes[i]];
    }
    return out;
}

/**
 * A lossless representation of a signed, 64-bit integer. Instances of this
 * class may be used in arithmetic expressions as if they were numeric
 * primitives, but the binary representation will be preserved unchanged as the
 * `bytes` property of the object. The bytes should be encoded as big-endian,
 * two's complement integers.
 */
var Int64 = /** @class */ (function () {
    function Int64(bytes) {
        this.bytes = bytes;
        if (bytes.byteLength !== 8) {
            throw new Error("Int64 buffers must be exactly 8 bytes");
        }
    }
    Int64.fromNumber = function (number) {
        if (number > 9223372036854775807 || number < -9223372036854775808) {
            throw new Error(number + " is too large (or, if negative, too small) to represent as an Int64");
        }
        var bytes = new Uint8Array(8);
        for (var i = 7, remaining = Math.abs(Math.round(number)); i > -1 && remaining > 0; i--, remaining /= 256) {
            bytes[i] = remaining;
        }
        if (number < 0) {
            negate(bytes);
        }
        return new Int64(bytes);
    };
    /**
     * Called implicitly by infix arithmetic operators.
     */
    Int64.prototype.valueOf = function () {
        var bytes = this.bytes.slice(0);
        var negative = bytes[0] & 128;
        if (negative) {
            negate(bytes);
        }
        return parseInt(toHex(bytes), 16) * (negative ? -1 : 1);
    };
    Int64.prototype.toString = function () {
        return String(this.valueOf());
    };
    return Int64;
}());
function negate(bytes) {
    for (var i = 0; i < 8; i++) {
        bytes[i] ^= 0xff;
    }
    for (var i = 7; i > -1; i--) {
        bytes[i]++;
        if (bytes[i] !== 0)
            break;
    }
}

/**
 * @internal
 */
var HeaderMarshaller = /** @class */ (function () {
    function HeaderMarshaller(toUtf8, fromUtf8) {
        this.toUtf8 = toUtf8;
        this.fromUtf8 = fromUtf8;
    }
    HeaderMarshaller.prototype.format = function (headers) {
        var e_1, _a, e_2, _b;
        var chunks = [];
        try {
            for (var _c = __values(Object.keys(headers)), _d = _c.next(); !_d.done; _d = _c.next()) {
                var headerName = _d.value;
                var bytes = this.fromUtf8(headerName);
                chunks.push(Uint8Array.from([bytes.byteLength]), bytes, this.formatHeaderValue(headers[headerName]));
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
            }
            finally { if (e_1) throw e_1.error; }
        }
        var out = new Uint8Array(chunks.reduce(function (carry, bytes) { return carry + bytes.byteLength; }, 0));
        var position = 0;
        try {
            for (var chunks_1 = __values(chunks), chunks_1_1 = chunks_1.next(); !chunks_1_1.done; chunks_1_1 = chunks_1.next()) {
                var chunk = chunks_1_1.value;
                out.set(chunk, position);
                position += chunk.byteLength;
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (chunks_1_1 && !chunks_1_1.done && (_b = chunks_1.return)) _b.call(chunks_1);
            }
            finally { if (e_2) throw e_2.error; }
        }
        return out;
    };
    HeaderMarshaller.prototype.formatHeaderValue = function (header) {
        switch (header.type) {
            case "boolean":
                return Uint8Array.from([header.value ? 0 /* boolTrue */ : 1 /* boolFalse */]);
            case "byte":
                return Uint8Array.from([2 /* byte */, header.value]);
            case "short":
                var shortView = new DataView(new ArrayBuffer(3));
                shortView.setUint8(0, 3 /* short */);
                shortView.setInt16(1, header.value, false);
                return new Uint8Array(shortView.buffer);
            case "integer":
                var intView = new DataView(new ArrayBuffer(5));
                intView.setUint8(0, 4 /* integer */);
                intView.setInt32(1, header.value, false);
                return new Uint8Array(intView.buffer);
            case "long":
                var longBytes = new Uint8Array(9);
                longBytes[0] = 5 /* long */;
                longBytes.set(header.value.bytes, 1);
                return longBytes;
            case "binary":
                var binView = new DataView(new ArrayBuffer(3 + header.value.byteLength));
                binView.setUint8(0, 6 /* byteArray */);
                binView.setUint16(1, header.value.byteLength, false);
                var binBytes = new Uint8Array(binView.buffer);
                binBytes.set(header.value, 3);
                return binBytes;
            case "string":
                var utf8Bytes = this.fromUtf8(header.value);
                var strView = new DataView(new ArrayBuffer(3 + utf8Bytes.byteLength));
                strView.setUint8(0, 7 /* string */);
                strView.setUint16(1, utf8Bytes.byteLength, false);
                var strBytes = new Uint8Array(strView.buffer);
                strBytes.set(utf8Bytes, 3);
                return strBytes;
            case "timestamp":
                var tsBytes = new Uint8Array(9);
                tsBytes[0] = 8 /* timestamp */;
                tsBytes.set(Int64.fromNumber(header.value.valueOf()).bytes, 1);
                return tsBytes;
            case "uuid":
                if (!UUID_PATTERN.test(header.value)) {
                    throw new Error("Invalid UUID received: " + header.value);
                }
                var uuidBytes = new Uint8Array(17);
                uuidBytes[0] = 9 /* uuid */;
                uuidBytes.set(fromHex(header.value.replace(/\-/g, "")), 1);
                return uuidBytes;
        }
    };
    HeaderMarshaller.prototype.parse = function (headers) {
        var out = {};
        var position = 0;
        while (position < headers.byteLength) {
            var nameLength = headers.getUint8(position++);
            var name = this.toUtf8(new Uint8Array(headers.buffer, headers.byteOffset + position, nameLength));
            position += nameLength;
            switch (headers.getUint8(position++)) {
                case 0 /* boolTrue */:
                    out[name] = {
                        type: BOOLEAN_TAG,
                        value: true,
                    };
                    break;
                case 1 /* boolFalse */:
                    out[name] = {
                        type: BOOLEAN_TAG,
                        value: false,
                    };
                    break;
                case 2 /* byte */:
                    out[name] = {
                        type: BYTE_TAG,
                        value: headers.getInt8(position++),
                    };
                    break;
                case 3 /* short */:
                    out[name] = {
                        type: SHORT_TAG,
                        value: headers.getInt16(position, false),
                    };
                    position += 2;
                    break;
                case 4 /* integer */:
                    out[name] = {
                        type: INT_TAG,
                        value: headers.getInt32(position, false),
                    };
                    position += 4;
                    break;
                case 5 /* long */:
                    out[name] = {
                        type: LONG_TAG,
                        value: new Int64(new Uint8Array(headers.buffer, headers.byteOffset + position, 8)),
                    };
                    position += 8;
                    break;
                case 6 /* byteArray */:
                    var binaryLength = headers.getUint16(position, false);
                    position += 2;
                    out[name] = {
                        type: BINARY_TAG,
                        value: new Uint8Array(headers.buffer, headers.byteOffset + position, binaryLength),
                    };
                    position += binaryLength;
                    break;
                case 7 /* string */:
                    var stringLength = headers.getUint16(position, false);
                    position += 2;
                    out[name] = {
                        type: STRING_TAG,
                        value: this.toUtf8(new Uint8Array(headers.buffer, headers.byteOffset + position, stringLength)),
                    };
                    position += stringLength;
                    break;
                case 8 /* timestamp */:
                    out[name] = {
                        type: TIMESTAMP_TAG,
                        value: new Date(new Int64(new Uint8Array(headers.buffer, headers.byteOffset + position, 8)).valueOf()),
                    };
                    position += 8;
                    break;
                case 9 /* uuid */:
                    var uuidBytes = new Uint8Array(headers.buffer, headers.byteOffset + position, 16);
                    position += 16;
                    out[name] = {
                        type: UUID_TAG,
                        value: toHex(uuidBytes.subarray(0, 4)) + "-" + toHex(uuidBytes.subarray(4, 6)) + "-" + toHex(uuidBytes.subarray(6, 8)) + "-" + toHex(uuidBytes.subarray(8, 10)) + "-" + toHex(uuidBytes.subarray(10)),
                    };
                    break;
                default:
                    throw new Error("Unrecognized header type tag");
            }
        }
        return out;
    };
    return HeaderMarshaller;
}());
var HEADER_VALUE_TYPE;
(function (HEADER_VALUE_TYPE) {
    HEADER_VALUE_TYPE[HEADER_VALUE_TYPE["boolTrue"] = 0] = "boolTrue";
    HEADER_VALUE_TYPE[HEADER_VALUE_TYPE["boolFalse"] = 1] = "boolFalse";
    HEADER_VALUE_TYPE[HEADER_VALUE_TYPE["byte"] = 2] = "byte";
    HEADER_VALUE_TYPE[HEADER_VALUE_TYPE["short"] = 3] = "short";
    HEADER_VALUE_TYPE[HEADER_VALUE_TYPE["integer"] = 4] = "integer";
    HEADER_VALUE_TYPE[HEADER_VALUE_TYPE["long"] = 5] = "long";
    HEADER_VALUE_TYPE[HEADER_VALUE_TYPE["byteArray"] = 6] = "byteArray";
    HEADER_VALUE_TYPE[HEADER_VALUE_TYPE["string"] = 7] = "string";
    HEADER_VALUE_TYPE[HEADER_VALUE_TYPE["timestamp"] = 8] = "timestamp";
    HEADER_VALUE_TYPE[HEADER_VALUE_TYPE["uuid"] = 9] = "uuid";
})(HEADER_VALUE_TYPE || (HEADER_VALUE_TYPE = {}));
var BOOLEAN_TAG = "boolean";
var BYTE_TAG = "byte";
var SHORT_TAG = "short";
var INT_TAG = "integer";
var LONG_TAG = "long";
var BINARY_TAG = "binary";
var STRING_TAG = "string";
var TIMESTAMP_TAG = "timestamp";
var UUID_TAG = "uuid";
var UUID_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;

// All prelude components are unsigned, 32-bit integers
var PRELUDE_MEMBER_LENGTH = 4;
// The prelude consists of two components
var PRELUDE_LENGTH = PRELUDE_MEMBER_LENGTH * 2;
// Checksums are always CRC32 hashes.
var CHECKSUM_LENGTH = 4;
// Messages must include a full prelude, a prelude checksum, and a message checksum
var MINIMUM_MESSAGE_LENGTH = PRELUDE_LENGTH + CHECKSUM_LENGTH * 2;
/**
 * @internal
 */
function splitMessage(_a) {
    var byteLength = _a.byteLength, byteOffset = _a.byteOffset, buffer = _a.buffer;
    if (byteLength < MINIMUM_MESSAGE_LENGTH) {
        throw new Error("Provided message too short to accommodate event stream message overhead");
    }
    var view = new DataView(buffer, byteOffset, byteLength);
    var messageLength = view.getUint32(0, false);
    if (byteLength !== messageLength) {
        throw new Error("Reported message length does not match received message length");
    }
    var headerLength = view.getUint32(PRELUDE_MEMBER_LENGTH, false);
    var expectedPreludeChecksum = view.getUint32(PRELUDE_LENGTH, false);
    var expectedMessageChecksum = view.getUint32(byteLength - CHECKSUM_LENGTH, false);
    var checksummer = new build.Crc32().update(new Uint8Array(buffer, byteOffset, PRELUDE_LENGTH));
    if (expectedPreludeChecksum !== checksummer.digest()) {
        throw new Error("The prelude checksum specified in the message (" + expectedPreludeChecksum + ") does not match the calculated CRC32 checksum (" + checksummer.digest() + ")");
    }
    checksummer.update(new Uint8Array(buffer, byteOffset + PRELUDE_LENGTH, byteLength - (PRELUDE_LENGTH + CHECKSUM_LENGTH)));
    if (expectedMessageChecksum !== checksummer.digest()) {
        throw new Error("The message checksum (" + checksummer.digest() + ") did not match the expected value of " + expectedMessageChecksum);
    }
    return {
        headers: new DataView(buffer, byteOffset + PRELUDE_LENGTH + CHECKSUM_LENGTH, headerLength),
        body: new Uint8Array(buffer, byteOffset + PRELUDE_LENGTH + CHECKSUM_LENGTH + headerLength, messageLength - headerLength - (PRELUDE_LENGTH + CHECKSUM_LENGTH + CHECKSUM_LENGTH)),
    };
}

/**
 * A marshaller that can convert binary-packed event stream messages into
 * JavaScript objects and back again into their binary format.
 */
var EventStreamMarshaller = /** @class */ (function () {
    function EventStreamMarshaller(toUtf8, fromUtf8) {
        this.headerMarshaller = new HeaderMarshaller(toUtf8, fromUtf8);
    }
    /**
     * Convert a structured JavaScript object with tagged headers into a binary
     * event stream message.
     */
    EventStreamMarshaller.prototype.marshall = function (_a) {
        var rawHeaders = _a.headers, body = _a.body;
        var headers = this.headerMarshaller.format(rawHeaders);
        var length = headers.byteLength + body.byteLength + 16;
        var out = new Uint8Array(length);
        var view = new DataView(out.buffer, out.byteOffset, out.byteLength);
        var checksum = new build.Crc32();
        // Format message
        view.setUint32(0, length, false);
        view.setUint32(4, headers.byteLength, false);
        view.setUint32(8, checksum.update(out.subarray(0, 8)).digest(), false);
        out.set(headers, 12);
        out.set(body, headers.byteLength + 12);
        // Write trailing message checksum
        view.setUint32(length - 4, checksum.update(out.subarray(8, length - 4)).digest(), false);
        return out;
    };
    /**
     * Convert a binary event stream message into a JavaScript object with an
     * opaque, binary body and tagged, parsed headers.
     */
    EventStreamMarshaller.prototype.unmarshall = function (message) {
        var _a = splitMessage(message), headers = _a.headers, body = _a.body;
        return { headers: this.headerMarshaller.parse(headers), body: body };
    };
    /**
     * Convert a structured JavaScript object with tagged headers into a binary
     * event stream message header.
     */
    EventStreamMarshaller.prototype.formatHeaders = function (rawHeaders) {
        return this.headerMarshaller.format(rawHeaders);
    };
    return EventStreamMarshaller;
}());

function getChunkedStream(source) {
    var _a;
    var currentMessageTotalLength = 0;
    var currentMessagePendingLength = 0;
    var currentMessage = null;
    var messageLengthBuffer = null;
    var allocateMessage = function (size) {
        if (typeof size !== "number") {
            throw new Error("Attempted to allocate an event message where size was not a number: " + size);
        }
        currentMessageTotalLength = size;
        currentMessagePendingLength = 4;
        currentMessage = new Uint8Array(size);
        var currentMessageView = new DataView(currentMessage.buffer);
        currentMessageView.setUint32(0, size, false); //set big-endian Uint32 to 0~3 bytes
    };
    var iterator = function () {
        return __asyncGenerator(this, arguments, function () {
            var sourceIterator, _a, value, done, chunkLength, currentOffset, bytesRemaining, numBytesForTotal, numBytesToWrite;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        sourceIterator = source[Symbol.asyncIterator]();
                        _b.label = 1;
                    case 1:
                        return [4 /*yield*/, __await(sourceIterator.next())];
                    case 2:
                        _a = _b.sent(), value = _a.value, done = _a.done;
                        if (!done) return [3 /*break*/, 10];
                        if (!!currentMessageTotalLength) return [3 /*break*/, 4];
                        return [4 /*yield*/, __await(void 0)];
                    case 3: return [2 /*return*/, _b.sent()];
                    case 4:
                        if (!(currentMessageTotalLength === currentMessagePendingLength)) return [3 /*break*/, 7];
                        return [4 /*yield*/, __await(currentMessage)];
                    case 5: return [4 /*yield*/, _b.sent()];
                    case 6:
                        _b.sent();
                        return [3 /*break*/, 8];
                    case 7: throw new Error("Truncated event message received.");
                    case 8: return [4 /*yield*/, __await(void 0)];
                    case 9: return [2 /*return*/, _b.sent()];
                    case 10:
                        chunkLength = value.length;
                        currentOffset = 0;
                        _b.label = 11;
                    case 11:
                        if (!(currentOffset < chunkLength)) return [3 /*break*/, 15];
                        // create new message if necessary
                        if (!currentMessage) {
                            bytesRemaining = chunkLength - currentOffset;
                            // prevent edge case where total length spans 2 chunks
                            if (!messageLengthBuffer) {
                                messageLengthBuffer = new Uint8Array(4);
                            }
                            numBytesForTotal = Math.min(4 - currentMessagePendingLength, // remaining bytes to fill the messageLengthBuffer
                            bytesRemaining // bytes left in chunk
                            );
                            messageLengthBuffer.set(
                            // @ts-ignore error TS2532: Object is possibly 'undefined' for value
                            value.slice(currentOffset, currentOffset + numBytesForTotal), currentMessagePendingLength);
                            currentMessagePendingLength += numBytesForTotal;
                            currentOffset += numBytesForTotal;
                            if (currentMessagePendingLength < 4) {
                                // not enough information to create the current message
                                return [3 /*break*/, 15];
                            }
                            allocateMessage(new DataView(messageLengthBuffer.buffer).getUint32(0, false));
                            messageLengthBuffer = null;
                        }
                        numBytesToWrite = Math.min(currentMessageTotalLength - currentMessagePendingLength, // number of bytes left to complete message
                        chunkLength - currentOffset // number of bytes left in the original chunk
                        );
                        currentMessage.set(
                        // @ts-ignore error TS2532: Object is possibly 'undefined' for value
                        value.slice(currentOffset, currentOffset + numBytesToWrite), currentMessagePendingLength);
                        currentMessagePendingLength += numBytesToWrite;
                        currentOffset += numBytesToWrite;
                        if (!(currentMessageTotalLength && currentMessageTotalLength === currentMessagePendingLength)) return [3 /*break*/, 14];
                        return [4 /*yield*/, __await(currentMessage)];
                    case 12: 
                    // push out the message
                    return [4 /*yield*/, _b.sent()];
                    case 13:
                        // push out the message
                        _b.sent();
                        // cleanup
                        currentMessage = null;
                        currentMessageTotalLength = 0;
                        currentMessagePendingLength = 0;
                        _b.label = 14;
                    case 14: return [3 /*break*/, 11];
                    case 15: return [3 /*break*/, 1];
                    case 16: return [2 /*return*/];
                }
            });
        });
    };
    return _a = {},
        _a[Symbol.asyncIterator] = iterator,
        _a;
}

function getUnmarshalledStream(source, options) {
    var _a;
    return _a = {},
        _a[Symbol.asyncIterator] = function () {
            return __asyncGenerator(this, arguments, function () {
                var source_1, source_1_1, chunk, message, messageType, unmodeledError, code, exception, deserializedException, error, event, deserialized, e_1_1;
                var _a, _b;
                var e_1, _c;
                return __generator(this, function (_d) {
                    switch (_d.label) {
                        case 0:
                            _d.trys.push([0, 12, 13, 18]);
                            source_1 = __asyncValues(source);
                            _d.label = 1;
                        case 1: return [4 /*yield*/, __await(source_1.next())];
                        case 2:
                            if (!(source_1_1 = _d.sent(), !source_1_1.done)) return [3 /*break*/, 11];
                            chunk = source_1_1.value;
                            message = options.eventMarshaller.unmarshall(chunk);
                            messageType = message.headers[":message-type"].value;
                            if (!(messageType === "error")) return [3 /*break*/, 3];
                            unmodeledError = new Error(message.headers[":error-message"].value || "UnknownError");
                            unmodeledError.name = message.headers[":error-code"].value;
                            throw unmodeledError;
                        case 3:
                            if (!(messageType === "exception")) return [3 /*break*/, 5];
                            code = message.headers[":exception-type"].value;
                            exception = (_a = {}, _a[code] = message, _a);
                            return [4 /*yield*/, __await(options.deserializer(exception))];
                        case 4:
                            deserializedException = _d.sent();
                            if (deserializedException.$unknown) {
                                error = new Error(options.toUtf8(message.body));
                                error.name = code;
                                throw error;
                            }
                            throw deserializedException[code];
                        case 5:
                            if (!(messageType === "event")) return [3 /*break*/, 9];
                            event = (_b = {},
                                _b[message.headers[":event-type"].value] = message,
                                _b);
                            return [4 /*yield*/, __await(options.deserializer(event))];
                        case 6:
                            deserialized = _d.sent();
                            if (deserialized.$unknown)
                                return [3 /*break*/, 10];
                            return [4 /*yield*/, __await(deserialized)];
                        case 7: return [4 /*yield*/, _d.sent()];
                        case 8:
                            _d.sent();
                            return [3 /*break*/, 10];
                        case 9: throw Error("Unrecognizable event type: " + message.headers[":event-type"].value);
                        case 10: return [3 /*break*/, 1];
                        case 11: return [3 /*break*/, 18];
                        case 12:
                            e_1_1 = _d.sent();
                            e_1 = { error: e_1_1 };
                            return [3 /*break*/, 18];
                        case 13:
                            _d.trys.push([13, , 16, 17]);
                            if (!(source_1_1 && !source_1_1.done && (_c = source_1.return))) return [3 /*break*/, 15];
                            return [4 /*yield*/, __await(_c.call(source_1))];
                        case 14:
                            _d.sent();
                            _d.label = 15;
                        case 15: return [3 /*break*/, 17];
                        case 16:
                            if (e_1) throw e_1.error;
                            return [7 /*endfinally*/];
                        case 17: return [7 /*endfinally*/];
                        case 18: return [2 /*return*/];
                    }
                });
            });
        },
        _a;
}

var EventStreamMarshaller$1 = /** @class */ (function () {
    function EventStreamMarshaller$1(_a) {
        var utf8Encoder = _a.utf8Encoder, utf8Decoder = _a.utf8Decoder;
        this.eventMarshaller = new EventStreamMarshaller(utf8Encoder, utf8Decoder);
        this.utfEncoder = utf8Encoder;
    }
    EventStreamMarshaller$1.prototype.deserialize = function (body, deserializer) {
        var chunkedStream = getChunkedStream(body);
        var unmarshalledStream = getUnmarshalledStream(chunkedStream, {
            eventMarshaller: this.eventMarshaller,
            deserializer: deserializer,
            toUtf8: this.utfEncoder,
        });
        return unmarshalledStream;
    };
    EventStreamMarshaller$1.prototype.serialize = function (input, serializer) {
        var _a;
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        var self = this;
        var serializedIterator = function () {
            return __asyncGenerator(this, arguments, function () {
                var input_1, input_1_1, chunk, payloadBuf, e_1_1;
                var e_1, _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            _b.trys.push([0, 7, 8, 13]);
                            input_1 = __asyncValues(input);
                            _b.label = 1;
                        case 1: return [4 /*yield*/, __await(input_1.next())];
                        case 2:
                            if (!(input_1_1 = _b.sent(), !input_1_1.done)) return [3 /*break*/, 6];
                            chunk = input_1_1.value;
                            payloadBuf = self.eventMarshaller.marshall(serializer(chunk));
                            return [4 /*yield*/, __await(payloadBuf)];
                        case 3: return [4 /*yield*/, _b.sent()];
                        case 4:
                            _b.sent();
                            _b.label = 5;
                        case 5: return [3 /*break*/, 1];
                        case 6: return [3 /*break*/, 13];
                        case 7:
                            e_1_1 = _b.sent();
                            e_1 = { error: e_1_1 };
                            return [3 /*break*/, 13];
                        case 8:
                            _b.trys.push([8, , 11, 12]);
                            if (!(input_1_1 && !input_1_1.done && (_a = input_1.return))) return [3 /*break*/, 10];
                            return [4 /*yield*/, __await(_a.call(input_1))];
                        case 9:
                            _b.sent();
                            _b.label = 10;
                        case 10: return [3 /*break*/, 12];
                        case 11:
                            if (e_1) throw e_1.error;
                            return [7 /*endfinally*/];
                        case 12: return [7 /*endfinally*/];
                        case 13: return [4 /*yield*/, __await(new Uint8Array(0))];
                        case 14: 
                        // Ending frame
                        return [4 /*yield*/, _b.sent()];
                        case 15:
                            // Ending frame
                            _b.sent();
                            return [2 /*return*/];
                    }
                });
            });
        };
        return _a = {},
            _a[Symbol.asyncIterator] = serializedIterator,
            _a;
    };
    return EventStreamMarshaller$1;
}());

/**
 * Convert object stream piped in into an async iterable. This
 * daptor should be deprecated when Node stream iterator is stable.
 * Caveat: this adaptor won't have backpressure to inwards stream
 *
 * Reference: https://nodejs.org/docs/latest-v11.x/api/stream.html#stream_readable_symbol_asynciterator
 */
function readabletoIterable(readStream) {
    return __asyncGenerator(this, arguments, function readabletoIterable_1() {
        var streamEnded, generationEnded, records, value;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    streamEnded = false;
                    generationEnded = false;
                    records = new Array();
                    readStream.on("error", function (err) {
                        if (!streamEnded) {
                            streamEnded = true;
                        }
                        if (err) {
                            throw err;
                        }
                    });
                    readStream.on("data", function (data) {
                        records.push(data);
                    });
                    readStream.on("end", function () {
                        streamEnded = true;
                    });
                    _a.label = 1;
                case 1:
                    if (!!generationEnded) return [3 /*break*/, 6];
                    return [4 /*yield*/, __await(new Promise(function (resolve) { return setTimeout(function () { return resolve(records.shift()); }, 0); }))];
                case 2:
                    value = _a.sent();
                    if (!value) return [3 /*break*/, 5];
                    return [4 /*yield*/, __await(value)];
                case 3: return [4 /*yield*/, _a.sent()];
                case 4:
                    _a.sent();
                    _a.label = 5;
                case 5:
                    generationEnded = streamEnded && records.length === 0;
                    return [3 /*break*/, 1];
                case 6: return [2 /*return*/];
            }
        });
    });
}

var EventStreamMarshaller$2 = /** @class */ (function () {
    function EventStreamMarshaller$2(_a) {
        var utf8Encoder = _a.utf8Encoder, utf8Decoder = _a.utf8Decoder;
        this.eventMarshaller = new EventStreamMarshaller(utf8Encoder, utf8Decoder);
        this.universalMarshaller = new EventStreamMarshaller$1({
            utf8Decoder: utf8Decoder,
            utf8Encoder: utf8Encoder,
        });
    }
    EventStreamMarshaller$2.prototype.deserialize = function (body, deserializer) {
        //should use stream[Symbol.asyncIterable] when the api is stable
        //reference: https://nodejs.org/docs/latest-v11.x/api/stream.html#stream_readable_symbol_asynciterator
        var bodyIterable = typeof body[Symbol.asyncIterator] === "function" ? body : readabletoIterable(body);
        return this.universalMarshaller.deserialize(bodyIterable, deserializer);
    };
    EventStreamMarshaller$2.prototype.serialize = function (input, serializer) {
        var serializedIterable = this.universalMarshaller.serialize(input, serializer);
        if (typeof Stream.Readable.from === "function") {
            //reference: https://nodejs.org/dist/latest-v13.x/docs/api/stream.html#stream_new_stream_readable_options
            return Stream.Readable.from(serializedIterable);
        }
        else {
            var iterator_1 = serializedIterable[Symbol.asyncIterator]();
            var serializedStream_1 = new Stream.Readable({
                autoDestroy: true,
                objectMode: true,
                read: function () {
                    return __awaiter(this, void 0, void 0, function () {
                        var _this = this;
                        return __generator(this, function (_a) {
                            iterator_1
                                .next()
                                .then(function (_a) {
                                var done = _a.done, value = _a.value;
                                if (done) {
                                    _this.push(null);
                                }
                                else {
                                    _this.push(value);
                                }
                            })
                                .catch(function (err) {
                                _this.destroy(err);
                            });
                            return [2 /*return*/];
                        });
                    });
                },
            });
            //TODO: use 'autoDestroy' when targeting Node 11
            serializedStream_1.on("error", function () {
                serializedStream_1.destroy();
            });
            serializedStream_1.on("end", function () {
                serializedStream_1.destroy();
            });
            return serializedStream_1;
        }
    };
    return EventStreamMarshaller$2;
}());

/** NodeJS event stream utils provider */
var eventStreamSerdeProvider = function (options) { return new EventStreamMarshaller$2(options); };

var isArrayBuffer = function (arg) {
    return (typeof ArrayBuffer === "function" && arg instanceof ArrayBuffer) ||
        Object.prototype.toString.call(arg) === "[object ArrayBuffer]";
};

var fromArrayBuffer = function (input, offset, length) {
    if (offset === void 0) { offset = 0; }
    if (length === void 0) { length = input.byteLength - offset; }
    if (!isArrayBuffer(input)) {
        throw new TypeError("The \"input\" argument must be ArrayBuffer. Received type " + typeof input + " (" + input + ")");
    }
    return buffer.Buffer.from(input, offset, length);
};
var fromString = function (input, encoding) {
    if (typeof input !== "string") {
        throw new TypeError("The \"input\" argument must be of type string. Received type " + typeof input + " (" + input + ")");
    }
    return encoding ? buffer.Buffer.from(input, encoding) : buffer.Buffer.from(input);
};

var Hash = /** @class */ (function () {
    function Hash(algorithmIdentifier, secret) {
        this.hash = secret ? crypto.createHmac(algorithmIdentifier, castSourceData(secret)) : crypto.createHash(algorithmIdentifier);
    }
    Hash.prototype.update = function (toHash, encoding) {
        this.hash.update(castSourceData(toHash, encoding));
    };
    Hash.prototype.digest = function () {
        return Promise.resolve(this.hash.digest());
    };
    return Hash;
}());
function castSourceData(toCast, encoding) {
    if (buffer.Buffer.isBuffer(toCast)) {
        return toCast;
    }
    if (typeof toCast === "string") {
        return fromString(toCast, encoding);
    }
    if (ArrayBuffer.isView(toCast)) {
        return fromArrayBuffer(toCast.buffer, toCast.byteOffset, toCast.byteLength);
    }
    return fromArrayBuffer(toCast);
}

var HashCalculator = /** @class */ (function (_super) {
    __extends(HashCalculator, _super);
    function HashCalculator(hash, options) {
        var _this = _super.call(this, options) || this;
        _this.hash = hash;
        return _this;
    }
    HashCalculator.prototype._write = function (chunk, encoding, callback) {
        try {
            this.hash.update(chunk);
        }
        catch (err) {
            return callback(err);
        }
        callback();
    };
    return HashCalculator;
}(Stream.Writable));

var fileStreamHasher = function fileStreamHasher(hashCtor, fileStream) {
    return new Promise(function (resolve, reject) {
        if (!isReadStream(fileStream)) {
            reject(new Error("Unable to calculate hash for non-file streams."));
            return;
        }
        var fileStreamTee = fs.createReadStream(fileStream.path, {
            start: fileStream.start,
            end: fileStream.end,
        });
        var hash = new hashCtor();
        var hashCalculator = new HashCalculator(hash);
        fileStreamTee.pipe(hashCalculator);
        fileStreamTee.on("error", function (err) {
            // if the source errors, the destination stream needs to manually end
            hashCalculator.end();
            reject(err);
        });
        hashCalculator.on("error", reject);
        hashCalculator.on("finish", function () {
            hash.digest().then(resolve).catch(reject);
        });
    });
};
function isReadStream(stream) {
    return typeof stream.path === "string";
}

/**
 * Validate whether a string is an ARN.
 */
var validate = function (str) {
    return typeof str === "string" && str.indexOf("arn:") === 0 && str.split(":").length >= 6;
};
/**
 * Parse an ARN string into structure with partition, service, region, accountId and resource values
 */
var parse$3 = function (arn) {
    var segments = arn.split(":");
    if (segments.length < 6 || segments[0] !== "arn")
        throw new Error("Malformed ARN");
    var _a = __read(segments), 
    //Skip "arn" literal
    partition = _a[1], service = _a[2], region = _a[3], accountId = _a[4], resource = _a.slice(5);
    return {
        partition: partition,
        service: service,
        region: region,
        accountId: accountId,
        resource: resource.join(":"),
    };
};

var DOMAIN_PATTERN = /^[a-z0-9][a-z0-9\.\-]{1,61}[a-z0-9]$/;
var IP_ADDRESS_PATTERN = /(\d+\.){3}\d+/;
var DOTS_PATTERN = /\.\./;
var DOT_PATTERN = /\./;
var S3_HOSTNAME_PATTERN = /^(.+\.)?s3[.-]([a-z0-9-]+)\./;
var S3_US_EAST_1_ALTNAME_PATTERN = /^s3(-external-1)?\.amazonaws\.com$/;
var AWS_PARTITION_SUFFIX = "amazonaws.com";
var isBucketNameOptions = function (options) { return typeof options.bucketName === "string"; };
/**
 * Get pseudo region from supplied region. For example, if supplied with `fips-us-west-2`, it returns `us-west-2`.
 * @internal
 */
var getPseudoRegion = function (region) { return (isFipsRegion(region) ? region.replace(/fips-|-fips/, "") : region); };
/**
 * Determines whether a given string is DNS compliant per the rules outlined by
 * S3. Length, capitaization, and leading dot restrictions are enforced by the
 * DOMAIN_PATTERN regular expression.
 * @internal
 *
 * @see https://docs.aws.amazon.com/AmazonS3/latest/dev/BucketRestrictions.html
 */
var isDnsCompatibleBucketName = function (bucketName) {
    return DOMAIN_PATTERN.test(bucketName) && !IP_ADDRESS_PATTERN.test(bucketName) && !DOTS_PATTERN.test(bucketName);
};
var getRegionalSuffix = function (hostname) {
    var parts = hostname.match(S3_HOSTNAME_PATTERN);
    return [parts[2], hostname.replace(new RegExp("^" + parts[0]), "")];
};
var getSuffix = function (hostname) {
    return S3_US_EAST_1_ALTNAME_PATTERN.test(hostname) ? ["us-east-1", AWS_PARTITION_SUFFIX] : getRegionalSuffix(hostname);
};
/**
 * Infer region and hostname suffix from a complete hostname
 * @internal
 * @param hostname - Hostname
 * @returns [Region, Hostname suffix]
 */
var getSuffixForArnEndpoint = function (hostname) {
    return S3_US_EAST_1_ALTNAME_PATTERN.test(hostname)
        ? [hostname.replace("." + AWS_PARTITION_SUFFIX, ""), AWS_PARTITION_SUFFIX]
        : getRegionalSuffix(hostname);
};
var validateArnEndpointOptions = function (options) {
    if (options.pathStyleEndpoint) {
        throw new Error("Path-style S3 endpoint is not supported when bucket is an ARN");
    }
    if (options.accelerateEndpoint) {
        throw new Error("Accelerate endpoint is not supported when bucket is an ARN");
    }
    if (!options.tlsCompatible) {
        throw new Error("HTTPS is required when bucket is an ARN");
    }
};
var validateService = function (service) {
    if (service !== "s3" && service !== "s3-outposts") {
        throw new Error("Expect 's3' or 's3-outposts' in ARN service component");
    }
};
var validateS3Service = function (service) {
    if (service !== "s3") {
        throw new Error("Expect 's3' in Accesspoint ARN service component");
    }
};
var validateOutpostService = function (service) {
    if (service !== "s3-outposts") {
        throw new Error("Expect 's3-posts' in Outpost ARN service component");
    }
};
/**
 * Validate partition inferred from ARN is the same to `options.clientPartition`.
 * @internal
 */
var validatePartition = function (partition, options) {
    if (partition !== options.clientPartition) {
        throw new Error("Partition in ARN is incompatible, got \"" + partition + "\" but expected \"" + options.clientPartition + "\"");
    }
};
/**
 * validate region value inferred from ARN. If `options.useArnRegion` is set, it validates the region is not a FIPS
 * region. If `options.useArnRegion` is unset, it validates the region is equal to `options.clientRegion` or
 * `options.clientSigningRegion`.
 * @internal
 */
var validateRegion = function (region, options) {
    if (region === "") {
        throw new Error("ARN region is empty");
    }
    if (!options.useArnRegion &&
        !isEqualRegions(region, options.clientRegion) &&
        !isEqualRegions(region, options.clientSigningRegion)) {
        throw new Error("Region in ARN is incompatible, got " + region + " but expected " + options.clientRegion);
    }
    if (options.useArnRegion && isFipsRegion(region)) {
        throw new Error("Endpoint does not support FIPS region");
    }
};
var isFipsRegion = function (region) { return region.startsWith("fips-") || region.endsWith("-fips"); };
var isEqualRegions = function (regionA, regionB) {
    return regionA === regionB || getPseudoRegion(regionA) === regionB || regionA === getPseudoRegion(regionB);
};
/**
 * Validate an account ID
 * @internal
 */
var validateAccountId = function (accountId) {
    if (!/[0-9]{12}/.exec(accountId)) {
        throw new Error("Access point ARN accountID does not match regex '[0-9]{12}'");
    }
};
/**
 * Validate a host label according to https://tools.ietf.org/html/rfc3986#section-3.2.2
 * @internal
 */
var validateDNSHostLabel = function (label, options) {
    if (options === void 0) { options = { tlsCompatible: true }; }
    // reference: https://tools.ietf.org/html/rfc3986#section-3.2.2
    if (label.length >= 64 ||
        !/^[a-z0-9][a-z0-9.-]+[a-z0-9]$/.test(label) ||
        /(\d+\.){3}\d+/.test(label) ||
        /[.-]{2}/.test(label) ||
        ((options === null || options === void 0 ? void 0 : options.tlsCompatible) && DOT_PATTERN.test(label))) {
        throw new Error("Invalid DNS label " + label);
    }
};
/**
 * Validate and parse an Access Point ARN or Outposts ARN
 * @internal
 *
 * @param resource - The resource section of an ARN
 * @returns Access Point Name and optional Outpost ID.
 */
var getArnResources = function (resource) {
    var delimiter = resource.includes(":") ? ":" : "/";
    var _a = __read(resource.split(delimiter)), resourceType = _a[0], rest = _a.slice(1);
    if (resourceType === "accesspoint") {
        // Parse accesspoint ARN
        if (rest.length !== 1 || rest[0] === "") {
            throw new Error("Access Point ARN should have one resource accesspoint" + delimiter + "{accesspointname}");
        }
        return { accesspointName: rest[0] };
    }
    else if (resourceType === "outpost") {
        // Parse outpost ARN
        if (!rest[0] || rest[1] !== "accesspoint" || !rest[2] || rest.length !== 3) {
            throw new Error("Outpost ARN should have resource outpost" + delimiter + "{outpostId}" + delimiter + "accesspoint" + delimiter + "{accesspointName}");
        }
        var _b = __read(rest, 3), outpostId = _b[0], _ = _b[1], accesspointName = _b[2];
        return { outpostId: outpostId, accesspointName: accesspointName };
    }
    else {
        throw new Error("ARN resource should begin with 'accesspoint" + delimiter + "' or 'outpost" + delimiter + "'");
    }
};
/**
 * Throw if dual stack configuration is set to true.
 * @internal
 */
var validateNoDualstack = function (dualstackEndpoint) {
    if (dualstackEndpoint)
        throw new Error("Dualstack endpoint is not supported with Outpost");
};
/**
 * Validate region is not appended or prepended with a `fips-`
 * @internal
 */
var validateNoFIPS = function (region) {
    if (isFipsRegion(region !== null && region !== void 0 ? region : ""))
        throw new Error("FIPS region is not supported with Outpost, got " + region);
};

var bucketHostname = function (options) {
    var baseHostname = options.baseHostname;
    if (!S3_HOSTNAME_PATTERN.test(baseHostname)) {
        return {
            bucketEndpoint: false,
            hostname: baseHostname,
        };
    }
    return isBucketNameOptions(options)
        ? // Construct endpoint when bucketName is a string referring to a bucket name
            getEndpointFromBucketName(options)
        : // Construct endpoint when bucketName is an ARN referring to an S3 resource like Access Point
            getEndpointFromArn(options);
};
var getEndpointFromArn = function (options) {
    // Infer client region and hostname suffix from hostname from endpoints.json, like `s3.us-west-2.amazonaws.com`
    var _a = __read(getSuffixForArnEndpoint(options.baseHostname), 2), clientRegion = _a[0], hostnameSuffix = _a[1];
    var pathStyleEndpoint = options.pathStyleEndpoint, _b = options.dualstackEndpoint, dualstackEndpoint = _b === void 0 ? false : _b, _c = options.accelerateEndpoint, accelerateEndpoint = _c === void 0 ? false : _c, _d = options.tlsCompatible, tlsCompatible = _d === void 0 ? true : _d, useArnRegion = options.useArnRegion, bucketName = options.bucketName, _e = options.clientPartition, clientPartition = _e === void 0 ? "aws" : _e, _f = options.clientSigningRegion, clientSigningRegion = _f === void 0 ? clientRegion : _f;
    validateArnEndpointOptions({ pathStyleEndpoint: pathStyleEndpoint, accelerateEndpoint: accelerateEndpoint, tlsCompatible: tlsCompatible });
    // Validate and parse the ARN supplied as a bucket name
    var service = bucketName.service, partition = bucketName.partition, accountId = bucketName.accountId, region = bucketName.region, resource = bucketName.resource;
    validateService(service);
    validatePartition(partition, { clientPartition: clientPartition });
    validateAccountId(accountId);
    validateRegion(region, { useArnRegion: useArnRegion, clientRegion: clientRegion, clientSigningRegion: clientSigningRegion });
    var _g = getArnResources(resource), accesspointName = _g.accesspointName, outpostId = _g.outpostId;
    validateDNSHostLabel(accesspointName + "-" + accountId, { tlsCompatible: tlsCompatible });
    var endpointRegion = useArnRegion ? region : clientRegion;
    var signingRegion = useArnRegion ? region : clientSigningRegion;
    if (outpostId) {
        // if this is an Outpost ARN
        validateOutpostService(service);
        validateDNSHostLabel(outpostId, { tlsCompatible: tlsCompatible });
        validateNoDualstack(dualstackEndpoint);
        validateNoFIPS(endpointRegion);
        return {
            bucketEndpoint: true,
            hostname: accesspointName + "-" + accountId + "." + outpostId + ".s3-outposts." + endpointRegion + "." + hostnameSuffix,
            signingRegion: signingRegion,
            signingService: "s3-outposts",
        };
    }
    // construct endpoint from Accesspoint ARN
    validateS3Service(service);
    return {
        bucketEndpoint: true,
        hostname: accesspointName + "-" + accountId + ".s3-accesspoint" + (dualstackEndpoint ? ".dualstack" : "") + "." + endpointRegion + "." + hostnameSuffix,
        signingRegion: signingRegion,
    };
};
var getEndpointFromBucketName = function (_a) {
    var _b = _a.accelerateEndpoint, accelerateEndpoint = _b === void 0 ? false : _b, baseHostname = _a.baseHostname, bucketName = _a.bucketName, _c = _a.dualstackEndpoint, dualstackEndpoint = _c === void 0 ? false : _c, _d = _a.pathStyleEndpoint, pathStyleEndpoint = _d === void 0 ? false : _d, _e = _a.tlsCompatible, tlsCompatible = _e === void 0 ? true : _e;
    var _f = __read(getSuffix(baseHostname), 2), clientRegion = _f[0], hostnameSuffix = _f[1];
    if (pathStyleEndpoint || !isDnsCompatibleBucketName(bucketName) || (tlsCompatible && DOT_PATTERN.test(bucketName))) {
        return {
            bucketEndpoint: false,
            hostname: dualstackEndpoint ? "s3.dualstack." + clientRegion + "." + hostnameSuffix : baseHostname,
        };
    }
    if (accelerateEndpoint) {
        baseHostname = "s3-accelerate" + (dualstackEndpoint ? ".dualstack" : "") + "." + hostnameSuffix;
    }
    else if (dualstackEndpoint) {
        baseHostname = "s3.dualstack." + clientRegion + "." + hostnameSuffix;
    }
    return {
        bucketEndpoint: true,
        hostname: bucketName + "." + baseHostname,
    };
};

var bucketEndpointMiddleware = function (options) { return function (next, context) { return function (args) { return __awaiter(void 0, void 0, void 0, function () {
    var bucketName, replaceBucketInPath, request, bucketArn, clientRegion, _a, _b, partition, _c, signingRegion, useArnRegion, _d, hostname, bucketEndpoint, modifiedSigningRegion, signingService, _e, hostname, bucketEndpoint;
    return __generator(this, function (_f) {
        switch (_f.label) {
            case 0:
                bucketName = args.input.Bucket;
                replaceBucketInPath = options.bucketEndpoint;
                request = args.request;
                if (!HttpRequest.isInstance(request)) return [3 /*break*/, 7];
                if (!options.bucketEndpoint) return [3 /*break*/, 1];
                request.hostname = bucketName;
                return [3 /*break*/, 6];
            case 1:
                if (!validate(bucketName)) return [3 /*break*/, 5];
                bucketArn = parse$3(bucketName);
                _a = getPseudoRegion;
                return [4 /*yield*/, options.region()];
            case 2:
                clientRegion = _a.apply(void 0, [_f.sent()]);
                return [4 /*yield*/, options.regionInfoProvider(clientRegion)];
            case 3:
                _b = (_f.sent()) || {}, partition = _b.partition, _c = _b.signingRegion, signingRegion = _c === void 0 ? clientRegion : _c;
                return [4 /*yield*/, options.useArnRegion()];
            case 4:
                useArnRegion = _f.sent();
                _d = bucketHostname({
                    bucketName: bucketArn,
                    baseHostname: request.hostname,
                    accelerateEndpoint: options.useAccelerateEndpoint,
                    dualstackEndpoint: options.useDualstackEndpoint,
                    pathStyleEndpoint: options.forcePathStyle,
                    tlsCompatible: request.protocol === "https:",
                    useArnRegion: useArnRegion,
                    clientPartition: partition,
                    clientSigningRegion: signingRegion,
                }), hostname = _d.hostname, bucketEndpoint = _d.bucketEndpoint, modifiedSigningRegion = _d.signingRegion, signingService = _d.signingService;
                // If the request needs to use a region or service name inferred from ARN that different from client region, we
                // need to set them in the handler context so the signer will use them
                if (modifiedSigningRegion && modifiedSigningRegion !== signingRegion) {
                    context["signing_region"] = modifiedSigningRegion;
                }
                if (signingService && signingService !== "s3") {
                    context["signing_service"] = signingService;
                }
                request.hostname = hostname;
                replaceBucketInPath = bucketEndpoint;
                return [3 /*break*/, 6];
            case 5:
                _e = bucketHostname({
                    bucketName: bucketName,
                    baseHostname: request.hostname,
                    accelerateEndpoint: options.useAccelerateEndpoint,
                    dualstackEndpoint: options.useDualstackEndpoint,
                    pathStyleEndpoint: options.forcePathStyle,
                    tlsCompatible: request.protocol === "https:",
                }), hostname = _e.hostname, bucketEndpoint = _e.bucketEndpoint;
                request.hostname = hostname;
                replaceBucketInPath = bucketEndpoint;
                _f.label = 6;
            case 6:
                if (replaceBucketInPath) {
                    request.path = request.path.replace(/^(\/)?[^\/]+/, "");
                    if (request.path === "") {
                        request.path = "/";
                    }
                }
                _f.label = 7;
            case 7: return [2 /*return*/, next(__assign(__assign({}, args), { request: request }))];
        }
    });
}); }; }; };
var bucketEndpointMiddlewareOptions = {
    tags: ["BUCKET_ENDPOINT"],
    name: "bucketEndpointMiddleware",
    relation: "before",
    toMiddleware: "hostHeaderMiddleware",
};
var getBucketEndpointPlugin = function (options) { return ({
    applyToStack: function (clientStack) {
        clientStack.addRelativeTo(bucketEndpointMiddleware(options), bucketEndpointMiddlewareOptions);
    },
}); };

function resolveBucketEndpointConfig(input) {
    var _a = input.bucketEndpoint, bucketEndpoint = _a === void 0 ? false : _a, _b = input.forcePathStyle, forcePathStyle = _b === void 0 ? false : _b, _c = input.useAccelerateEndpoint, useAccelerateEndpoint = _c === void 0 ? false : _c, _d = input.useDualstackEndpoint, useDualstackEndpoint = _d === void 0 ? false : _d, _e = input.useArnRegion, useArnRegion = _e === void 0 ? false : _e;
    return __assign(__assign({}, input), { bucketEndpoint: bucketEndpoint,
        forcePathStyle: forcePathStyle,
        useAccelerateEndpoint: useAccelerateEndpoint,
        useDualstackEndpoint: useDualstackEndpoint, useArnRegion: typeof useArnRegion === "function" ? useArnRegion : function () { return Promise.resolve(useArnRegion); } });
}
var NODE_USE_ARN_REGION_ENV_NAME = "AWS_S3_USE_ARN_REGION";
var NODE_USE_ARN_REGION_INI_NAME = "s3_use_arn_region";
/**
 * Config to load useArnRegion from environment variables and shared INI files
 *
 * @api private
 */
var NODE_USE_ARN_REGION_CONFIG_OPTIONS = {
    environmentVariableSelector: function (env) {
        if (!Object.prototype.hasOwnProperty.call(env, NODE_USE_ARN_REGION_ENV_NAME))
            return undefined;
        if (env[NODE_USE_ARN_REGION_ENV_NAME] === "true")
            return true;
        if (env[NODE_USE_ARN_REGION_ENV_NAME] === "false")
            return false;
        throw new Error("Cannot load env " + NODE_USE_ARN_REGION_ENV_NAME + ". Expected \"true\" or \"false\", got " + env[NODE_USE_ARN_REGION_ENV_NAME] + ".");
    },
    configFileSelector: function (profile) {
        if (!Object.prototype.hasOwnProperty.call(profile, NODE_USE_ARN_REGION_INI_NAME))
            return undefined;
        if (profile[NODE_USE_ARN_REGION_INI_NAME] === "true")
            return true;
        if (profile[NODE_USE_ARN_REGION_INI_NAME] === "false")
            return false;
        throw new Error("Cannot load shared config entry " + NODE_USE_ARN_REGION_INI_NAME + ". Expected \"true\" or \"false\", got " + profile[NODE_USE_ARN_REGION_INI_NAME] + ".");
    },
    default: false,
};

/**
 * Get config value given the environment variable name or getter from
 * environment variable.
 */
var fromEnv$1 = function (envVarSelector) { return function () { return __awaiter(void 0, void 0, void 0, function () {
    var config;
    return __generator(this, function (_a) {
        try {
            config = envVarSelector(process.env);
            if (config === undefined) {
                throw new Error();
            }
            return [2 /*return*/, config];
        }
        catch (e) {
            throw new ProviderError(e.message || "Cannot load config from environment variables with getter: " + envVarSelector);
        }
        return [2 /*return*/];
    });
}); }; };

var DEFAULT_PROFILE$1 = "default";
var ENV_PROFILE$1 = "AWS_PROFILE";
/**
 * Get config value from the shared config files with inferred profile name.
 */
var fromSharedConfigFiles = function (configSelector, _a) {
    if (_a === void 0) { _a = {}; }
    var _b = _a.preferredFile, preferredFile = _b === void 0 ? "config" : _b, init = __rest(_a, ["preferredFile"]);
    return function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, loadedConfig, _b, profile, _c, configFile, credentialsFile, profileFromCredentials, profileFromConfig, mergedProfile, configValue;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    _a = init.loadedConfig, loadedConfig = _a === void 0 ? loadSharedConfigFiles(init) : _a, _b = init.profile, profile = _b === void 0 ? process.env[ENV_PROFILE$1] || DEFAULT_PROFILE$1 : _b;
                    return [4 /*yield*/, loadedConfig];
                case 1:
                    _c = _d.sent(), configFile = _c.configFile, credentialsFile = _c.credentialsFile;
                    profileFromCredentials = credentialsFile[profile] || {};
                    profileFromConfig = configFile[profile] || {};
                    mergedProfile = preferredFile === "config"
                        ? __assign(__assign({}, profileFromCredentials), profileFromConfig) : __assign(__assign({}, profileFromConfig), profileFromCredentials);
                    try {
                        configValue = configSelector(mergedProfile);
                        if (configValue === undefined) {
                            throw new Error();
                        }
                        return [2 /*return*/, configValue];
                    }
                    catch (e) {
                        throw new ProviderError(e.message || "Cannot load config for profile " + profile + " in SDK configuration files with getter: " + configSelector);
                    }
                    return [2 /*return*/];
            }
        });
    }); };
};

var isFunction = function (func) { return typeof func === "function"; };
var fromStatic$1 = function (defaultValue) {
    return isFunction(defaultValue) ? function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
        return [2 /*return*/, defaultValue()];
    }); }); } : fromStatic(defaultValue);
};

var loadConfig = function (_a, configuration) {
    var environmentVariableSelector = _a.environmentVariableSelector, configFileSelector = _a.configFileSelector, defaultValue = _a.default;
    if (configuration === void 0) { configuration = {}; }
    return memoize(chain(fromEnv$1(environmentVariableSelector), fromSharedConfigFiles(configFileSelector, configuration), fromStatic$1(defaultValue)));
};

var escapeUri = function (uri) {
    // AWS percent-encodes some extra non-standard characters in a URI
    return encodeURIComponent(uri).replace(/[!'()*]/g, hexEncode);
};
var hexEncode = function (c) { return "%" + c.charCodeAt(0).toString(16).toUpperCase(); };

function buildQueryString(query) {
    var e_1, _a;
    var parts = [];
    try {
        for (var _b = __values(Object.keys(query).sort()), _c = _b.next(); !_c.done; _c = _b.next()) {
            var key = _c.value;
            var value = query[key];
            key = escapeUri(key);
            if (Array.isArray(value)) {
                for (var i = 0, iLen = value.length; i < iLen; i++) {
                    parts.push(key + "=" + escapeUri(value[i]));
                }
            }
            else {
                var qsEntry = key;
                if (value || typeof value === "string") {
                    qsEntry += "=" + escapeUri(value);
                }
                parts.push(qsEntry);
            }
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
        }
        finally { if (e_1) throw e_1.error; }
    }
    return parts.join("&");
}

var getTransformedHeaders = function (headers) {
    var e_1, _a;
    var transformedHeaders = {};
    try {
        for (var _b = __values(Object.keys(headers)), _c = _b.next(); !_c.done; _c = _b.next()) {
            var name = _c.value;
            var headerValues = headers[name];
            transformedHeaders[name] = Array.isArray(headerValues) ? headerValues.join(",") : headerValues;
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
        }
        finally { if (e_1) throw e_1.error; }
    }
    return transformedHeaders;
};

function setConnectionTimeout(request, reject, timeoutInMs) {
    if (timeoutInMs === void 0) { timeoutInMs = 0; }
    if (!timeoutInMs) {
        return;
    }
    request.on("socket", function (socket) {
        var _this = this;
        if (socket.connecting) {
            // Throw a connecting timeout error unless a connection is made within x time
            var timeoutId_1 = setTimeout(function () {
                // abort the request to destroy it
                _this.abort();
                var timeoutError = new Error("Socket timed out without establishing a connection within " + timeoutInMs + " ms");
                timeoutError.name = "TimeoutError";
                reject(timeoutError);
            }, timeoutInMs);
            // if the connection was established, cancel the timeout
            socket.on("connect", function () {
                clearTimeout(timeoutId_1);
            });
        }
    });
}

function setSocketTimeout(request, reject, timeoutInMs) {
    if (timeoutInMs === void 0) { timeoutInMs = 0; }
    request.setTimeout(timeoutInMs, function () {
        // abort the request to destroy it
        this.abort();
        var timeoutError = new Error("Connection timed out after " + timeoutInMs + " ms");
        timeoutError.name = "TimeoutError";
        reject(timeoutError);
    });
}

function writeRequestBody(httpRequest, request) {
    var expect = request.headers["Expect"] || request.headers["expect"];
    if (expect === "100-continue") {
        httpRequest.on("continue", function () {
            writeBody(httpRequest, request.body);
        });
    }
    else {
        writeBody(httpRequest, request.body);
    }
}
function writeBody(httpRequest, body) {
    if (body instanceof Stream.Readable) {
        // pipe automatically handles end
        body.pipe(httpRequest);
    }
    else if (body) {
        httpRequest.end(Buffer.from(body));
    }
    else {
        httpRequest.end();
    }
}

var NodeHttpHandler = /** @class */ (function () {
    function NodeHttpHandler(_a) {
        var _b = _a === void 0 ? {} : _a, connectionTimeout = _b.connectionTimeout, socketTimeout = _b.socketTimeout, httpAgent = _b.httpAgent, httpsAgent = _b.httpsAgent;
        // Node http handler is hard-coded to http/1.1: https://github.com/nodejs/node/blob/ff5664b83b89c55e4ab5d5f60068fb457f1f5872/lib/_http_server.js#L286
        this.metadata = { handlerProtocol: "http/1.1" };
        this.connectionTimeout = connectionTimeout;
        this.socketTimeout = socketTimeout;
        var keepAlive = true;
        this.httpAgent = httpAgent || new http.Agent({ keepAlive: keepAlive });
        this.httpsAgent = httpsAgent || new https.Agent({ keepAlive: keepAlive });
    }
    NodeHttpHandler.prototype.destroy = function () {
        this.httpAgent.destroy();
        this.httpsAgent.destroy();
    };
    NodeHttpHandler.prototype.handle = function (request, _a) {
        var _this = this;
        var abortSignal = _a.abortSignal;
        return new Promise(function (resolve, reject) {
            // if the request was already aborted, prevent doing extra work
            if (abortSignal === null || abortSignal === void 0 ? void 0 : abortSignal.aborted) {
                var abortError = new Error("Request aborted");
                abortError.name = "AbortError";
                reject(abortError);
                return;
            }
            // determine which http(s) client to use
            var isSSL = request.protocol === "https:";
            var queryString = buildQueryString(request.query || {});
            var nodeHttpsOptions = {
                headers: request.headers,
                host: request.hostname,
                method: request.method,
                path: queryString ? request.path + "?" + queryString : request.path,
                port: request.port,
                agent: isSSL ? _this.httpsAgent : _this.httpAgent,
            };
            // create the http request
            var requestFunc = isSSL ? https.request : http.request;
            var req = requestFunc(nodeHttpsOptions, function (res) {
                var httpResponse = new HttpResponse({
                    statusCode: res.statusCode || -1,
                    headers: getTransformedHeaders(res.headers),
                    body: res,
                });
                resolve({ response: httpResponse });
            });
            req.on("error", reject);
            // wire-up any timeout logic
            setConnectionTimeout(req, reject, _this.connectionTimeout);
            setSocketTimeout(req, reject, _this.socketTimeout);
            // wire-up abort logic
            if (abortSignal) {
                abortSignal.onabort = function () {
                    // ensure request is destroyed
                    req.abort();
                    var abortError = new Error("Request aborted");
                    abortError.name = "AbortError";
                    reject(abortError);
                };
            }
            writeRequestBody(req, request);
        });
    };
    return NodeHttpHandler;
}());

var Collector = /** @class */ (function (_super) {
    __extends(Collector, _super);
    function Collector() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.bufferedBytes = [];
        return _this;
    }
    Collector.prototype._write = function (chunk, encoding, callback) {
        this.bufferedBytes.push(chunk);
        callback();
    };
    return Collector;
}(Stream.Writable));

var streamCollector = function (stream) {
    return new Promise(function (resolve, reject) {
        var collector = new Collector();
        stream.pipe(collector);
        stream.on("error", function (err) {
            // if the source errors, the destination stream needs to manually end
            collector.end();
            reject(err);
        });
        collector.on("error", reject);
        collector.on("finish", function () {
            var bytes = new Uint8Array(Buffer.concat(this.bufferedBytes));
            resolve(bytes);
        });
    });
};

function parseQueryString(querystring) {
    var e_1, _a;
    var query = {};
    querystring = querystring.replace(/^\?/, "");
    if (querystring) {
        try {
            for (var _b = __values(querystring.split("&")), _c = _b.next(); !_c.done; _c = _b.next()) {
                var pair = _c.value;
                var _d = __read(pair.split("="), 2), key = _d[0], _e = _d[1], value = _e === void 0 ? null : _e;
                key = decodeURIComponent(key);
                if (value) {
                    value = decodeURIComponent(value);
                }
                if (!(key in query)) {
                    query[key] = value;
                }
                else if (Array.isArray(query[key])) {
                    query[key].push(value);
                }
                else {
                    query[key] = [query[key], value];
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_1) throw e_1.error; }
        }
    }
    return query;
}

var parseUrl = function (url) {
    var _a = Url.parse(url), _b = _a.hostname, hostname = _b === void 0 ? "localhost" : _b, _c = _a.pathname, pathname = _c === void 0 ? "/" : _c, port = _a.port, _d = _a.protocol, protocol = _d === void 0 ? "https:" : _d, search = _a.search;
    var query;
    if (search) {
        query = parseQueryString(search);
    }
    return {
        hostname: hostname,
        port: port ? parseInt(port) : undefined,
        protocol: protocol,
        path: pathname,
        query: query,
    };
};

/**
 * Converts a base-64 encoded string to a Uint8Array of bytes using Node.JS's
 * `buffer` module.
 *
 * @param input The base-64 encoded string
 */
function fromBase64(input) {
    var buffer = fromString(input, "base64");
    return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
}
/**
 * Converts a Uint8Array of binary data to a base-64 encoded string using
 * Node.JS's `buffer` module.
 *
 * @param input The binary data to encode
 */
function toBase64(input) {
    return fromArrayBuffer(input.buffer, input.byteOffset, input.byteLength).toString("base64");
}

function calculateBodyLength(body) {
    if (!body) {
        return 0;
    }
    if (typeof body === "string") {
        return Buffer.from(body).length;
    }
    else if (typeof body.byteLength === "number") {
        // handles Uint8Array, ArrayBuffer, Buffer, and ArrayBufferView
        return body.byteLength;
    }
    else if (typeof body.size === "number") {
        return body.size;
    }
    else if (typeof body.path === "string") {
        // handles fs readable streams
        return fs.lstatSync(body.path).size;
    }
}

function defaultUserAgent(packageName, packageVersion) {
    var engine = process__default['default'].platform + "/" + process__default['default'].version;
    if (process__default['default'].env.AWS_EXECUTION_ENV) {
        engine += " exec-env/" + process__default['default'].env.AWS_EXECUTION_ENV;
    }
    return "aws-sdk-nodejs-v3-" + packageName + "/" + packageVersion + " " + engine;
}

var fromUtf8 = function (input) {
    var buf = fromString(input, "utf8");
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength / Uint8Array.BYTES_PER_ELEMENT);
};
var toUtf8 = function (input) {
    return fromArrayBuffer(input.buffer, input.byteOffset, input.byteLength).toString("utf8");
};

// Partition default templates
const AWS_TEMPLATE = "s3.{region}.amazonaws.com";
const AWS_CN_TEMPLATE = "s3.{region}.amazonaws.com.cn";
const AWS_ISO_TEMPLATE = "s3.{region}.c2s.ic.gov";
const AWS_ISO_B_TEMPLATE = "s3.{region}.sc2s.sgov.gov";
const AWS_US_GOV_TEMPLATE = "s3.{region}.amazonaws.com";
// Partition regions
const AWS_REGIONS = new Set([
    "ap-east-1",
    "ap-northeast-1",
    "ap-northeast-2",
    "ap-south-1",
    "ap-southeast-1",
    "ap-southeast-2",
    "ca-central-1",
    "eu-central-1",
    "eu-north-1",
    "eu-west-1",
    "eu-west-2",
    "eu-west-3",
    "me-south-1",
    "sa-east-1",
    "us-east-1",
    "us-east-2",
    "us-west-1",
    "us-west-2",
]);
const AWS_CN_REGIONS = new Set(["cn-north-1", "cn-northwest-1"]);
const AWS_ISO_REGIONS = new Set(["us-iso-east-1"]);
const AWS_ISO_B_REGIONS = new Set(["us-isob-east-1"]);
const AWS_US_GOV_REGIONS = new Set(["us-gov-east-1", "us-gov-west-1"]);
const defaultRegionInfoProvider = (region, options) => {
    let regionInfo = undefined;
    switch (region) {
        // First, try to match exact region names.
        case "ap-east-1":
            regionInfo = {
                hostname: "s3.ap-east-1.amazonaws.com",
                partition: "aws",
            };
            break;
        case "ap-northeast-1":
            regionInfo = {
                hostname: "s3.ap-northeast-1.amazonaws.com",
                partition: "aws",
            };
            break;
        case "ap-northeast-2":
            regionInfo = {
                hostname: "s3.ap-northeast-2.amazonaws.com",
                partition: "aws",
            };
            break;
        case "ap-south-1":
            regionInfo = {
                hostname: "s3.ap-south-1.amazonaws.com",
                partition: "aws",
            };
            break;
        case "ap-southeast-1":
            regionInfo = {
                hostname: "s3.ap-southeast-1.amazonaws.com",
                partition: "aws",
            };
            break;
        case "ap-southeast-2":
            regionInfo = {
                hostname: "s3.ap-southeast-2.amazonaws.com",
                partition: "aws",
            };
            break;
        case "ca-central-1":
            regionInfo = {
                hostname: "s3.ca-central-1.amazonaws.com",
                partition: "aws",
            };
            break;
        case "cn-north-1":
            regionInfo = {
                hostname: "s3.cn-north-1.amazonaws.com.cn",
                partition: "aws-cn",
            };
            break;
        case "cn-northwest-1":
            regionInfo = {
                hostname: "s3.cn-northwest-1.amazonaws.com.cn",
                partition: "aws-cn",
            };
            break;
        case "eu-central-1":
            regionInfo = {
                hostname: "s3.eu-central-1.amazonaws.com",
                partition: "aws",
            };
            break;
        case "eu-north-1":
            regionInfo = {
                hostname: "s3.eu-north-1.amazonaws.com",
                partition: "aws",
            };
            break;
        case "eu-west-1":
            regionInfo = {
                hostname: "s3.eu-west-1.amazonaws.com",
                partition: "aws",
            };
            break;
        case "eu-west-2":
            regionInfo = {
                hostname: "s3.eu-west-2.amazonaws.com",
                partition: "aws",
            };
            break;
        case "eu-west-3":
            regionInfo = {
                hostname: "s3.eu-west-3.amazonaws.com",
                partition: "aws",
            };
            break;
        case "fips-us-gov-west-1":
            regionInfo = {
                hostname: "s3-fips-us-gov-west-1.amazonaws.com",
                partition: "aws-us-gov",
                signingRegion: "us-gov-west-1",
            };
            break;
        case "me-south-1":
            regionInfo = {
                hostname: "s3.me-south-1.amazonaws.com",
                partition: "aws",
            };
            break;
        case "s3-external-1":
            regionInfo = {
                hostname: "s3-external-1.amazonaws.com",
                partition: "aws",
                signingRegion: "us-east-1",
            };
            break;
        case "sa-east-1":
            regionInfo = {
                hostname: "s3.sa-east-1.amazonaws.com",
                partition: "aws",
            };
            break;
        case "us-east-1":
            regionInfo = {
                hostname: "s3.amazonaws.com",
                partition: "aws",
            };
            break;
        case "us-east-2":
            regionInfo = {
                hostname: "s3.us-east-2.amazonaws.com",
                partition: "aws",
            };
            break;
        case "us-gov-east-1":
            regionInfo = {
                hostname: "s3.us-gov-east-1.amazonaws.com",
                partition: "aws-us-gov",
            };
            break;
        case "us-gov-west-1":
            regionInfo = {
                hostname: "s3.us-gov-west-1.amazonaws.com",
                partition: "aws-us-gov",
            };
            break;
        case "us-iso-east-1":
            regionInfo = {
                hostname: "s3.us-iso-east-1.c2s.ic.gov",
                partition: "aws-iso",
            };
            break;
        case "us-isob-east-1":
            regionInfo = {
                hostname: "s3.us-isob-east-1.sc2s.sgov.gov",
                partition: "aws-iso-b",
            };
            break;
        case "us-west-1":
            regionInfo = {
                hostname: "s3.us-west-1.amazonaws.com",
                partition: "aws",
            };
            break;
        case "us-west-2":
            regionInfo = {
                hostname: "s3.us-west-2.amazonaws.com",
                partition: "aws",
            };
            break;
        // Next, try to match partition endpoints.
        default:
            if (AWS_REGIONS.has(region)) {
                regionInfo = {
                    hostname: AWS_TEMPLATE.replace("{region}", region),
                    partition: "aws",
                };
            }
            if (AWS_CN_REGIONS.has(region)) {
                regionInfo = {
                    hostname: AWS_CN_TEMPLATE.replace("{region}", region),
                    partition: "aws-cn",
                };
            }
            if (AWS_ISO_REGIONS.has(region)) {
                regionInfo = {
                    hostname: AWS_ISO_TEMPLATE.replace("{region}", region),
                    partition: "aws-iso",
                };
            }
            if (AWS_ISO_B_REGIONS.has(region)) {
                regionInfo = {
                    hostname: AWS_ISO_B_TEMPLATE.replace("{region}", region),
                    partition: "aws-iso-b",
                };
            }
            if (AWS_US_GOV_REGIONS.has(region)) {
                regionInfo = {
                    hostname: AWS_US_GOV_TEMPLATE.replace("{region}", region),
                    partition: "aws-us-gov",
                };
            }
            // Finally, assume it's an AWS partition endpoint.
            if (regionInfo === undefined) {
                regionInfo = {
                    hostname: AWS_TEMPLATE.replace("{region}", region),
                    partition: "aws",
                };
            }
    }
    return Promise.resolve(regionInfo);
};

const ClientSharedValues = {
    apiVersion: "2006-03-01",
    disableHostPrefix: false,
    logger: {},
    regionInfoProvider: defaultRegionInfoProvider,
    signingEscapePath: false,
    signingName: "s3",
    useArnRegion: false,
};

const ClientDefaultValues = {
    ...ClientSharedValues,
    runtime: "node",
    base64Decoder: fromBase64,
    base64Encoder: toBase64,
    bodyLengthChecker: calculateBodyLength,
    credentialDefaultProvider: defaultProvider,
    defaultUserAgent: defaultUserAgent(packageInfo.name, packageInfo.version),
    eventStreamSerdeProvider,
    maxAttempts: loadConfig(NODE_MAX_ATTEMPT_CONFIG_OPTIONS),
    md5: Hash.bind(null, "md5"),
    region: loadConfig(NODE_REGION_CONFIG_OPTIONS, NODE_REGION_CONFIG_FILE_OPTIONS),
    requestHandler: new NodeHttpHandler(),
    sha256: Hash.bind(null, "sha256"),
    streamCollector,
    streamHasher: fileStreamHasher,
    urlParser: parseUrl,
    useArnRegion: loadConfig(NODE_USE_ARN_REGION_CONFIG_OPTIONS),
    utf8Decoder: fromUtf8,
    utf8Encoder: toUtf8,
};

var resolveEventStreamSerdeConfig = function (input) { return (__assign(__assign({}, input), { eventStreamMarshaller: input.eventStreamSerdeProvider(input) })); };

var CONTENT_LENGTH_HEADER = "content-length";
function contentLengthMiddleware(bodyLengthChecker) {
    var _this = this;
    return function (next) { return function (args) { return __awaiter(_this, void 0, void 0, function () {
        var request, body, headers, length;
        var _a;
        return __generator(this, function (_b) {
            request = args.request;
            if (HttpRequest.isInstance(request)) {
                body = request.body, headers = request.headers;
                if (body &&
                    Object.keys(headers)
                        .map(function (str) { return str.toLowerCase(); })
                        .indexOf(CONTENT_LENGTH_HEADER) === -1) {
                    length = bodyLengthChecker(body);
                    if (length !== undefined) {
                        request.headers = __assign(__assign({}, request.headers), (_a = {}, _a[CONTENT_LENGTH_HEADER] = String(length), _a));
                    }
                }
            }
            return [2 /*return*/, next(__assign(__assign({}, args), { request: request }))];
        });
    }); }; };
}
var contentLengthMiddlewareOptions = {
    step: "build",
    tags: ["SET_CONTENT_LENGTH", "CONTENT_LENGTH"],
    name: "contentLengthMiddleware",
};
var getContentLengthPlugin = function (options) { return ({
    applyToStack: function (clientStack) {
        clientStack.add(contentLengthMiddleware(options.bodyLengthChecker), contentLengthMiddlewareOptions);
    },
}); };

function addExpectContinueMiddleware(options) {
    var _this = this;
    return function (next) { return function (args) { return __awaiter(_this, void 0, void 0, function () {
        var request;
        return __generator(this, function (_a) {
            request = args.request;
            if (HttpRequest.isInstance(request) && request.body && options.runtime === "node") {
                request.headers = __assign(__assign({}, request.headers), { Expect: "100-continue" });
            }
            return [2 /*return*/, next(__assign(__assign({}, args), { request: request }))];
        });
    }); }; };
}
var addExpectContinueMiddlewareOptions = {
    step: "build",
    tags: ["SET_EXPECT_HEADER", "EXPECT_HEADER"],
    name: "addExpectContinueMiddleware",
};
var getAddExpectContinuePlugin = function (options) { return ({
    applyToStack: function (clientStack) {
        clientStack.add(addExpectContinueMiddleware(options), addExpectContinueMiddlewareOptions);
    },
}); };

function resolveHostHeaderConfig(input) {
    return input;
}
var hostHeaderMiddleware = function (options) { return function (next) { return function (args) { return __awaiter(void 0, void 0, void 0, function () {
    var request, _a, handlerProtocol;
    return __generator(this, function (_b) {
        if (!HttpRequest.isInstance(args.request))
            return [2 /*return*/, next(args)];
        request = args.request;
        _a = (options.requestHandler.metadata || {}).handlerProtocol, handlerProtocol = _a === void 0 ? "" : _a;
        //For H2 request, remove 'host' header and use ':authority' header instead
        //reference: https://nodejs.org/dist/latest-v13.x/docs/api/errors.html#ERR_HTTP2_INVALID_CONNECTION_HEADERS
        if (handlerProtocol.indexOf("h2") >= 0 && !request.headers[":authority"]) {
            delete request.headers["host"];
            request.headers[":authority"] = "";
            //non-H2 request and 'host' header is not set, set the 'host' header to request's hostname.
        }
        else if (!request.headers["host"]) {
            request.headers["host"] = request.hostname;
        }
        return [2 /*return*/, next(args)];
    });
}); }; }; };
var hostHeaderMiddlewareOptions = {
    name: "hostHeaderMiddleware",
    step: "build",
    priority: "low",
    tags: ["HOST"],
};
var getHostHeaderPlugin = function (options) { return ({
    applyToStack: function (clientStack) {
        clientStack.add(hostHeaderMiddleware(options), hostHeaderMiddlewareOptions);
    },
}); };

var loggerMiddleware = function () { return function (next, context) { return function (args) { return __awaiter(void 0, void 0, void 0, function () {
    var logger, response, $metadata;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                logger = context.logger;
                return [4 /*yield*/, next(args)];
            case 1:
                response = _a.sent();
                if (!logger) {
                    return [2 /*return*/, response];
                }
                $metadata = response.output.$metadata;
                // TODO: Populate custom metadata in https://github.com/aws/aws-sdk-js-v3/issues/1491#issuecomment-692174256
                // $metadata will be removed in https://github.com/aws/aws-sdk-js-v3/issues/1490
                if (typeof logger.info === "function") {
                    logger.info({
                        $metadata: $metadata,
                    });
                }
                return [2 /*return*/, response];
        }
    });
}); }; }; };
var loggerMiddlewareOptions = {
    name: "loggerMiddleware",
    tags: ["LOGGER"],
    step: "build",
};
// eslint-disable-next-line @typescript-eslint/no-unused-vars
var getLoggerPlugin = function (options) { return ({
    applyToStack: function (clientStack) {
        clientStack.add(loggerMiddleware(), loggerMiddlewareOptions);
    },
}); };

function validateBucketNameMiddleware() {
    var _this = this;
    return function (next) { return function (args) { return __awaiter(_this, void 0, void 0, function () {
        var Bucket, err;
        return __generator(this, function (_a) {
            Bucket = args.input.Bucket;
            if (typeof Bucket === "string" && !validate(Bucket) && Bucket.indexOf("/") >= 0) {
                err = new Error("Bucket name shouldn't contain '/', received '" + Bucket + "'");
                err.name = "InvalidBucketName";
                throw err;
            }
            return [2 /*return*/, next(__assign({}, args))];
        });
    }); }; };
}
var validateBucketNameMiddlewareOptions = {
    step: "initialize",
    tags: ["VALIDATE_BUCKET_NAME"],
    name: "validateBucketNameMiddleware",
};
// eslint-disable-next-line @typescript-eslint/no-unused-vars
var getValidateBucketNamePlugin = function (unused) { return ({
    applyToStack: function (clientStack) {
        clientStack.add(validateBucketNameMiddleware(), validateBucketNameMiddlewareOptions);
    },
}); };

var useRegionalEndpointMiddleware = function (config) { return function (next) { return function (args) { return __awaiter(void 0, void 0, void 0, function () {
    var request, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                request = args.request;
                if (!HttpRequest.isInstance(request) || config.isCustomEndpoint)
                    return [2 /*return*/, next(__assign({}, args))];
                if (!(request.hostname === "s3.amazonaws.com")) return [3 /*break*/, 1];
                request.hostname = "s3.us-east-1.amazonaws.com";
                return [3 /*break*/, 3];
            case 1:
                _a = "aws-global";
                return [4 /*yield*/, config.region()];
            case 2:
                if (_a === (_b.sent())) {
                    request.hostname = "s3.amazonaws.com";
                }
                _b.label = 3;
            case 3: return [2 /*return*/, next(__assign({}, args))];
        }
    });
}); }; }; };
var useRegionalEndpointMiddlewareOptions = {
    step: "build",
    tags: ["USE_REGIONAL_ENDPOINT", "S3"],
    name: "useRegionalEndpointMiddleware",
};
var getUseRegionalEndpointPlugin = function (config) { return ({
    applyToStack: function (clientStack) {
        clientStack.add(useRegionalEndpointMiddleware(config), useRegionalEndpointMiddlewareOptions);
    },
}); };

var ALGORITHM_QUERY_PARAM = "X-Amz-Algorithm";
var CREDENTIAL_QUERY_PARAM = "X-Amz-Credential";
var AMZ_DATE_QUERY_PARAM = "X-Amz-Date";
var SIGNED_HEADERS_QUERY_PARAM = "X-Amz-SignedHeaders";
var EXPIRES_QUERY_PARAM = "X-Amz-Expires";
var SIGNATURE_QUERY_PARAM = "X-Amz-Signature";
var TOKEN_QUERY_PARAM = "X-Amz-Security-Token";
var AUTH_HEADER = "authorization";
var AMZ_DATE_HEADER = AMZ_DATE_QUERY_PARAM.toLowerCase();
var DATE_HEADER = "date";
var GENERATED_HEADERS = [AUTH_HEADER, AMZ_DATE_HEADER, DATE_HEADER];
var SIGNATURE_HEADER = SIGNATURE_QUERY_PARAM.toLowerCase();
var SHA256_HEADER = "x-amz-content-sha256";
var TOKEN_HEADER = TOKEN_QUERY_PARAM.toLowerCase();
var ALWAYS_UNSIGNABLE_HEADERS = {
    authorization: true,
    "cache-control": true,
    connection: true,
    expect: true,
    from: true,
    "keep-alive": true,
    "max-forwards": true,
    pragma: true,
    referer: true,
    te: true,
    trailer: true,
    "transfer-encoding": true,
    upgrade: true,
    "user-agent": true,
    "x-amzn-trace-id": true,
};
var PROXY_HEADER_PATTERN = /^proxy-/;
var SEC_HEADER_PATTERN = /^sec-/;
var ALGORITHM_IDENTIFIER = "AWS4-HMAC-SHA256";
var EVENT_ALGORITHM_IDENTIFIER = "AWS4-HMAC-SHA256-PAYLOAD";
var UNSIGNED_PAYLOAD = "UNSIGNED-PAYLOAD";
var MAX_CACHE_SIZE = 50;
var KEY_TYPE_IDENTIFIER = "aws4_request";
var MAX_PRESIGNED_TTL = 60 * 60 * 24 * 7;

var signingKeyCache = {};
var cacheQueue = [];
/**
 * Create a string describing the scope of credentials used to sign a request.
 *
 * @param shortDate The current calendar date in the form YYYYMMDD.
 * @param region    The AWS region in which the service resides.
 * @param service   The service to which the signed request is being sent.
 */
function createScope(shortDate, region, service) {
    return shortDate + "/" + region + "/" + service + "/" + KEY_TYPE_IDENTIFIER;
}
/**
 * Derive a signing key from its composite parts
 *
 * @param sha256Constructor A constructor function that can instantiate SHA-256
 *                          hash objects.
 * @param credentials       The credentials with which the request will be
 *                          signed.
 * @param shortDate         The current calendar date in the form YYYYMMDD.
 * @param region            The AWS region in which the service resides.
 * @param service           The service to which the signed request is being
 *                          sent.
 */
function getSigningKey(sha256Constructor, credentials, shortDate, region, service) {
    var cacheKey = shortDate + ":" + region + ":" + service + ":" + (credentials.accessKeyId + ":" + credentials.sessionToken);
    if (cacheKey in signingKeyCache) {
        return signingKeyCache[cacheKey];
    }
    cacheQueue.push(cacheKey);
    while (cacheQueue.length > MAX_CACHE_SIZE) {
        delete signingKeyCache[cacheQueue.shift()];
    }
    return (signingKeyCache[cacheKey] = new Promise(function (resolve, reject) {
        var e_1, _a;
        var keyPromise = Promise.resolve("AWS4" + credentials.secretAccessKey);
        var _loop_1 = function (signable) {
            keyPromise = keyPromise.then(function (intermediateKey) { return hmac(sha256Constructor, intermediateKey, signable); });
            keyPromise.catch(function () { });
        };
        try {
            for (var _b = __values([shortDate, region, service, KEY_TYPE_IDENTIFIER]), _c = _b.next(); !_c.done; _c = _b.next()) {
                var signable = _c.value;
                _loop_1(signable);
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_1) throw e_1.error; }
        }
        keyPromise.then(resolve, function (reason) {
            delete signingKeyCache[cacheKey];
            reject(reason);
        });
    }));
}
function hmac(ctor, secret, data) {
    var hash = new ctor(secret);
    hash.update(data);
    return hash.digest();
}

/**
 * @internal
 */
function getCanonicalHeaders(_a, unsignableHeaders, signableHeaders) {
    var e_1, _b;
    var headers = _a.headers;
    var canonical = {};
    try {
        for (var _c = __values(Object.keys(headers).sort()), _d = _c.next(); !_d.done; _d = _c.next()) {
            var headerName = _d.value;
            var canonicalHeaderName = headerName.toLowerCase();
            if (canonicalHeaderName in ALWAYS_UNSIGNABLE_HEADERS || (unsignableHeaders === null || unsignableHeaders === void 0 ? void 0 : unsignableHeaders.has(canonicalHeaderName)) ||
                PROXY_HEADER_PATTERN.test(canonicalHeaderName) ||
                SEC_HEADER_PATTERN.test(canonicalHeaderName)) {
                if (!signableHeaders || (signableHeaders && !signableHeaders.has(canonicalHeaderName))) {
                    continue;
                }
            }
            canonical[canonicalHeaderName] = headers[headerName].trim().replace(/\s+/g, " ");
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (_d && !_d.done && (_b = _c.return)) _b.call(_c);
        }
        finally { if (e_1) throw e_1.error; }
    }
    return canonical;
}

/**
 * @internal
 */
function getCanonicalQuery(_a) {
    var e_1, _b;
    var _c = _a.query, query = _c === void 0 ? {} : _c;
    var keys = [];
    var serialized = {};
    var _loop_1 = function (key) {
        if (key.toLowerCase() === SIGNATURE_HEADER) {
            return "continue";
        }
        keys.push(key);
        var value = query[key];
        if (typeof value === "string") {
            serialized[key] = escapeUri(key) + "=" + escapeUri(value);
        }
        else if (Array.isArray(value)) {
            serialized[key] = value
                .slice(0)
                .sort()
                .reduce(function (encoded, value) { return encoded.concat([escapeUri(key) + "=" + escapeUri(value)]); }, [])
                .join("&");
        }
    };
    try {
        for (var _d = __values(Object.keys(query).sort()), _e = _d.next(); !_e.done; _e = _d.next()) {
            var key = _e.value;
            _loop_1(key);
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (_e && !_e.done && (_b = _d.return)) _b.call(_d);
        }
        finally { if (e_1) throw e_1.error; }
    }
    return keys
        .map(function (key) { return serialized[key]; })
        .filter(function (serialized) { return serialized; }) // omit any falsy values
        .join("&");
}

/**
 * @internal
 */
function getPayloadHash(_a, hashConstructor) {
    var headers = _a.headers, body = _a.body;
    return __awaiter(this, void 0, void 0, function () {
        var _b, _c, headerName, hashCtor, _d;
        var e_1, _e;
        return __generator(this, function (_f) {
            switch (_f.label) {
                case 0:
                    try {
                        for (_b = __values(Object.keys(headers)), _c = _b.next(); !_c.done; _c = _b.next()) {
                            headerName = _c.value;
                            if (headerName.toLowerCase() === SHA256_HEADER) {
                                return [2 /*return*/, headers[headerName]];
                            }
                        }
                    }
                    catch (e_1_1) { e_1 = { error: e_1_1 }; }
                    finally {
                        try {
                            if (_c && !_c.done && (_e = _b.return)) _e.call(_b);
                        }
                        finally { if (e_1) throw e_1.error; }
                    }
                    if (!(body == undefined)) return [3 /*break*/, 1];
                    return [2 /*return*/, "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"];
                case 1:
                    if (!(typeof body === "string" || ArrayBuffer.isView(body) || isArrayBuffer(body))) return [3 /*break*/, 3];
                    hashCtor = new hashConstructor();
                    hashCtor.update(body);
                    _d = toHex;
                    return [4 /*yield*/, hashCtor.digest()];
                case 2: return [2 /*return*/, _d.apply(void 0, [_f.sent()])];
                case 3: 
                // As any defined body that is not a string or binary data is a stream, this
                // body is unsignable. Attempt to send the request with an unsigned payload,
                // which may or may not be accepted by the service.
                return [2 /*return*/, UNSIGNED_PAYLOAD];
            }
        });
    });
}

function hasHeader(soughtHeader, headers) {
    var e_1, _a;
    soughtHeader = soughtHeader.toLowerCase();
    try {
        for (var _b = __values(Object.keys(headers)), _c = _b.next(); !_c.done; _c = _b.next()) {
            var headerName = _c.value;
            if (soughtHeader === headerName.toLowerCase()) {
                return true;
            }
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
        }
        finally { if (e_1) throw e_1.error; }
    }
    return false;
}

/**
 * @internal
 */
function cloneRequest(_a) {
    var headers = _a.headers, query = _a.query, rest = __rest(_a, ["headers", "query"]);
    return __assign(__assign({}, rest), { headers: __assign({}, headers), query: query ? cloneQuery$1(query) : undefined });
}
function cloneQuery$1(query) {
    return Object.keys(query).reduce(function (carry, paramName) {
        var _a;
        var param = query[paramName];
        return __assign(__assign({}, carry), (_a = {}, _a[paramName] = Array.isArray(param) ? __spread(param) : param, _a));
    }, {});
}

/**
 * @internal
 */
function moveHeadersToQuery(request) {
    var e_1, _a;
    var _b = typeof request.clone === "function" ? request.clone() : cloneRequest(request), headers = _b.headers, _c = _b.query, query = _c === void 0 ? {} : _c;
    try {
        for (var _d = __values(Object.keys(headers)), _e = _d.next(); !_e.done; _e = _d.next()) {
            var name = _e.value;
            var lname = name.toLowerCase();
            if (lname.substr(0, 6) === "x-amz-") {
                query[name] = headers[name];
                delete headers[name];
            }
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (_e && !_e.done && (_a = _d.return)) _a.call(_d);
        }
        finally { if (e_1) throw e_1.error; }
    }
    return __assign(__assign({}, request), { headers: headers,
        query: query });
}

/**
 * @internal
 */
function prepareRequest(request) {
    var e_1, _a;
    // Create a clone of the request object that does not clone the body
    request = typeof request.clone === "function" ? request.clone() : cloneRequest(request);
    try {
        for (var _b = __values(Object.keys(request.headers)), _c = _b.next(); !_c.done; _c = _b.next()) {
            var headerName = _c.value;
            if (GENERATED_HEADERS.indexOf(headerName.toLowerCase()) > -1) {
                delete request.headers[headerName];
            }
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
        }
        finally { if (e_1) throw e_1.error; }
    }
    return request;
}

function iso8601(time) {
    return toDate(time)
        .toISOString()
        .replace(/\.\d{3}Z$/, "Z");
}
function toDate(time) {
    if (typeof time === "number") {
        return new Date(time * 1000);
    }
    if (typeof time === "string") {
        if (Number(time)) {
            return new Date(Number(time) * 1000);
        }
        return new Date(time);
    }
    return time;
}

var SignatureV4 = /** @class */ (function () {
    function SignatureV4(_a) {
        var applyChecksum = _a.applyChecksum, credentials = _a.credentials, region = _a.region, service = _a.service, sha256 = _a.sha256, _b = _a.uriEscapePath, uriEscapePath = _b === void 0 ? true : _b;
        this.service = service;
        this.sha256 = sha256;
        this.uriEscapePath = uriEscapePath;
        // default to true if applyChecksum isn't set
        this.applyChecksum = typeof applyChecksum === "boolean" ? applyChecksum : true;
        this.regionProvider = normalizeRegionProvider(region);
        this.credentialProvider = normalizeCredentialsProvider(credentials);
    }
    SignatureV4.prototype.presign = function (originalRequest, options) {
        if (options === void 0) { options = {}; }
        return __awaiter(this, void 0, void 0, function () {
            var _a, signingDate, _b, expiresIn, unsignableHeaders, signableHeaders, signingRegion, signingService, credentials, region, _c, _d, longDate, shortDate, scope, request, canonicalHeaders, _e, _f, _g, _h, _j, _k;
            return __generator(this, function (_l) {
                switch (_l.label) {
                    case 0:
                        _a = options.signingDate, signingDate = _a === void 0 ? new Date() : _a, _b = options.expiresIn, expiresIn = _b === void 0 ? 3600 : _b, unsignableHeaders = options.unsignableHeaders, signableHeaders = options.signableHeaders, signingRegion = options.signingRegion, signingService = options.signingService;
                        return [4 /*yield*/, this.credentialProvider()];
                    case 1:
                        credentials = _l.sent();
                        if (!(signingRegion !== null && signingRegion !== void 0)) return [3 /*break*/, 2];
                        _c = signingRegion;
                        return [3 /*break*/, 4];
                    case 2: return [4 /*yield*/, this.regionProvider()];
                    case 3:
                        _c = (_l.sent());
                        _l.label = 4;
                    case 4:
                        region = _c;
                        _d = formatDate(signingDate), longDate = _d.longDate, shortDate = _d.shortDate;
                        if (expiresIn > MAX_PRESIGNED_TTL) {
                            return [2 /*return*/, Promise.reject("Signature version 4 presigned URLs" + " must have an expiration date less than one week in" + " the future")];
                        }
                        scope = createScope(shortDate, region, signingService !== null && signingService !== void 0 ? signingService : this.service);
                        request = moveHeadersToQuery(prepareRequest(originalRequest));
                        if (credentials.sessionToken) {
                            request.query[TOKEN_QUERY_PARAM] = credentials.sessionToken;
                        }
                        request.query[ALGORITHM_QUERY_PARAM] = ALGORITHM_IDENTIFIER;
                        request.query[CREDENTIAL_QUERY_PARAM] = credentials.accessKeyId + "/" + scope;
                        request.query[AMZ_DATE_QUERY_PARAM] = longDate;
                        request.query[EXPIRES_QUERY_PARAM] = expiresIn.toString(10);
                        canonicalHeaders = getCanonicalHeaders(request, unsignableHeaders, signableHeaders);
                        request.query[SIGNED_HEADERS_QUERY_PARAM] = getCanonicalHeaderList(canonicalHeaders);
                        _e = request.query;
                        _f = SIGNATURE_QUERY_PARAM;
                        _g = this.getSignature;
                        _h = [longDate,
                            scope,
                            this.getSigningKey(credentials, region, shortDate, signingService)];
                        _j = this.createCanonicalRequest;
                        _k = [request, canonicalHeaders];
                        return [4 /*yield*/, getPayloadHash(originalRequest, this.sha256)];
                    case 5: return [4 /*yield*/, _g.apply(this, _h.concat([_j.apply(this, _k.concat([_l.sent()]))]))];
                    case 6:
                        _e[_f] = _l.sent();
                        return [2 /*return*/, request];
                }
            });
        });
    };
    SignatureV4.prototype.sign = function (toSign, options) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                if (typeof toSign === "string") {
                    return [2 /*return*/, this.signString(toSign, options)];
                }
                else if (toSign.headers && toSign.payload) {
                    return [2 /*return*/, this.signEvent(toSign, options)];
                }
                else {
                    return [2 /*return*/, this.signRequest(toSign, options)];
                }
            });
        });
    };
    SignatureV4.prototype.signEvent = function (_a, _b) {
        var headers = _a.headers, payload = _a.payload;
        var _c = _b.signingDate, signingDate = _c === void 0 ? new Date() : _c, priorSignature = _b.priorSignature, signingRegion = _b.signingRegion, signingService = _b.signingService;
        return __awaiter(this, void 0, void 0, function () {
            var region, _d, _e, shortDate, longDate, scope, hashedPayload, hash, hashedHeaders, _f, stringToSign;
            return __generator(this, function (_g) {
                switch (_g.label) {
                    case 0:
                        if (!(signingRegion !== null && signingRegion !== void 0)) return [3 /*break*/, 1];
                        _d = signingRegion;
                        return [3 /*break*/, 3];
                    case 1: return [4 /*yield*/, this.regionProvider()];
                    case 2:
                        _d = (_g.sent());
                        _g.label = 3;
                    case 3:
                        region = _d;
                        _e = formatDate(signingDate), shortDate = _e.shortDate, longDate = _e.longDate;
                        scope = createScope(shortDate, region, signingService !== null && signingService !== void 0 ? signingService : this.service);
                        return [4 /*yield*/, getPayloadHash({ headers: {}, body: payload }, this.sha256)];
                    case 4:
                        hashedPayload = _g.sent();
                        hash = new this.sha256();
                        hash.update(headers);
                        _f = toHex;
                        return [4 /*yield*/, hash.digest()];
                    case 5:
                        hashedHeaders = _f.apply(void 0, [_g.sent()]);
                        stringToSign = [
                            EVENT_ALGORITHM_IDENTIFIER,
                            longDate,
                            scope,
                            priorSignature,
                            hashedHeaders,
                            hashedPayload,
                        ].join("\n");
                        return [2 /*return*/, this.signString(stringToSign, { signingDate: signingDate, signingRegion: region, signingService: signingService })];
                }
            });
        });
    };
    SignatureV4.prototype.signString = function (stringToSign, _a) {
        var _b = _a === void 0 ? {} : _a, _c = _b.signingDate, signingDate = _c === void 0 ? new Date() : _c, signingRegion = _b.signingRegion, signingService = _b.signingService;
        return __awaiter(this, void 0, void 0, function () {
            var credentials, region, _d, shortDate, hash, _e, _f, _g;
            return __generator(this, function (_h) {
                switch (_h.label) {
                    case 0: return [4 /*yield*/, this.credentialProvider()];
                    case 1:
                        credentials = _h.sent();
                        if (!(signingRegion !== null && signingRegion !== void 0)) return [3 /*break*/, 2];
                        _d = signingRegion;
                        return [3 /*break*/, 4];
                    case 2: return [4 /*yield*/, this.regionProvider()];
                    case 3:
                        _d = (_h.sent());
                        _h.label = 4;
                    case 4:
                        region = _d;
                        shortDate = formatDate(signingDate).shortDate;
                        _f = (_e = this.sha256).bind;
                        return [4 /*yield*/, this.getSigningKey(credentials, region, shortDate, signingService)];
                    case 5:
                        hash = new (_f.apply(_e, [void 0, _h.sent()]))();
                        hash.update(stringToSign);
                        _g = toHex;
                        return [4 /*yield*/, hash.digest()];
                    case 6: return [2 /*return*/, _g.apply(void 0, [_h.sent()])];
                }
            });
        });
    };
    SignatureV4.prototype.signRequest = function (requestToSign, _a) {
        var _b = _a === void 0 ? {} : _a, _c = _b.signingDate, signingDate = _c === void 0 ? new Date() : _c, signableHeaders = _b.signableHeaders, unsignableHeaders = _b.unsignableHeaders, signingRegion = _b.signingRegion, signingService = _b.signingService;
        return __awaiter(this, void 0, void 0, function () {
            var credentials, region, _d, request, _e, longDate, shortDate, scope, payloadHash, canonicalHeaders, signature;
            return __generator(this, function (_f) {
                switch (_f.label) {
                    case 0: return [4 /*yield*/, this.credentialProvider()];
                    case 1:
                        credentials = _f.sent();
                        if (!(signingRegion !== null && signingRegion !== void 0)) return [3 /*break*/, 2];
                        _d = signingRegion;
                        return [3 /*break*/, 4];
                    case 2: return [4 /*yield*/, this.regionProvider()];
                    case 3:
                        _d = (_f.sent());
                        _f.label = 4;
                    case 4:
                        region = _d;
                        request = prepareRequest(requestToSign);
                        _e = formatDate(signingDate), longDate = _e.longDate, shortDate = _e.shortDate;
                        scope = createScope(shortDate, region, signingService !== null && signingService !== void 0 ? signingService : this.service);
                        request.headers[AMZ_DATE_HEADER] = longDate;
                        if (credentials.sessionToken) {
                            request.headers[TOKEN_HEADER] = credentials.sessionToken;
                        }
                        return [4 /*yield*/, getPayloadHash(request, this.sha256)];
                    case 5:
                        payloadHash = _f.sent();
                        if (!hasHeader(SHA256_HEADER, request.headers) && this.applyChecksum) {
                            request.headers[SHA256_HEADER] = payloadHash;
                        }
                        canonicalHeaders = getCanonicalHeaders(request, unsignableHeaders, signableHeaders);
                        return [4 /*yield*/, this.getSignature(longDate, scope, this.getSigningKey(credentials, region, shortDate, signingService), this.createCanonicalRequest(request, canonicalHeaders, payloadHash))];
                    case 6:
                        signature = _f.sent();
                        request.headers[AUTH_HEADER] =
                            ALGORITHM_IDENTIFIER + " " +
                                ("Credential=" + credentials.accessKeyId + "/" + scope + ", ") +
                                ("SignedHeaders=" + getCanonicalHeaderList(canonicalHeaders) + ", ") +
                                ("Signature=" + signature);
                        return [2 /*return*/, request];
                }
            });
        });
    };
    SignatureV4.prototype.createCanonicalRequest = function (request, canonicalHeaders, payloadHash) {
        var sortedHeaders = Object.keys(canonicalHeaders).sort();
        return request.method + "\n" + this.getCanonicalPath(request) + "\n" + getCanonicalQuery(request) + "\n" + sortedHeaders.map(function (name) { return name + ":" + canonicalHeaders[name]; }).join("\n") + "\n\n" + sortedHeaders.join(";") + "\n" + payloadHash;
    };
    SignatureV4.prototype.createStringToSign = function (longDate, credentialScope, canonicalRequest) {
        return __awaiter(this, void 0, void 0, function () {
            var hash, hashedRequest;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        hash = new this.sha256();
                        hash.update(canonicalRequest);
                        return [4 /*yield*/, hash.digest()];
                    case 1:
                        hashedRequest = _a.sent();
                        return [2 /*return*/, ALGORITHM_IDENTIFIER + "\n" + longDate + "\n" + credentialScope + "\n" + toHex(hashedRequest)];
                }
            });
        });
    };
    SignatureV4.prototype.getCanonicalPath = function (_a) {
        var path = _a.path;
        if (this.uriEscapePath) {
            var doubleEncoded = encodeURIComponent(path.replace(/^\//, ""));
            return "/" + doubleEncoded.replace(/%2F/g, "/");
        }
        return path;
    };
    SignatureV4.prototype.getSignature = function (longDate, credentialScope, keyPromise, canonicalRequest) {
        return __awaiter(this, void 0, void 0, function () {
            var stringToSign, hash, _a, _b, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0: return [4 /*yield*/, this.createStringToSign(longDate, credentialScope, canonicalRequest)];
                    case 1:
                        stringToSign = _d.sent();
                        _b = (_a = this.sha256).bind;
                        return [4 /*yield*/, keyPromise];
                    case 2:
                        hash = new (_b.apply(_a, [void 0, _d.sent()]))();
                        hash.update(stringToSign);
                        _c = toHex;
                        return [4 /*yield*/, hash.digest()];
                    case 3: return [2 /*return*/, _c.apply(void 0, [_d.sent()])];
                }
            });
        });
    };
    SignatureV4.prototype.getSigningKey = function (credentials, region, shortDate, service) {
        return getSigningKey(this.sha256, credentials, shortDate, region, service || this.service);
    };
    return SignatureV4;
}());
var formatDate = function (now) {
    var longDate = iso8601(now).replace(/[\-:]/g, "");
    return {
        longDate: longDate,
        shortDate: longDate.substr(0, 8),
    };
};
var getCanonicalHeaderList = function (headers) { return Object.keys(headers).sort().join(";"); };
var normalizeRegionProvider = function (region) {
    if (typeof region === "string") {
        var promisified_1 = Promise.resolve(region);
        return function () { return promisified_1; };
    }
    else {
        return region;
    }
};
var normalizeCredentialsProvider = function (credentials) {
    if (typeof credentials === "object") {
        var promisified_2 = Promise.resolve(credentials);
        return function () { return promisified_2; };
    }
    else {
        return credentials;
    }
};

function resolveAwsAuthConfig(input) {
    var _this = this;
    var credentials = input.credentials || input.credentialDefaultProvider(input);
    var normalizedCreds = normalizeProvider(credentials);
    var _a = input.signingEscapePath, signingEscapePath = _a === void 0 ? true : _a, _b = input.systemClockOffset, systemClockOffset = _b === void 0 ? input.systemClockOffset || 0 : _b, sha256 = input.sha256;
    var signer;
    if (input.signer) {
        //if signer is supplied by user, normalize it to a function returning a promise for signer.
        signer = normalizeProvider(input.signer);
    }
    else {
        //construct a provider inferring signing from region.
        signer = function () {
            return normalizeProvider(input.region)()
                .then(function (region) { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, input.regionInfoProvider(region)];
                    case 1: return [2 /*return*/, [(_a.sent()) || {}, region]];
                }
            }); }); })
                .then(function (_a) {
                var _b = __read(_a, 2), regionInfo = _b[0], region = _b[1];
                var _c = regionInfo.signingRegion, signingRegion = _c === void 0 ? input.signingRegion : _c, _d = regionInfo.signingService, signingService = _d === void 0 ? input.signingName : _d;
                //update client's singing region and signing service config if they are resolved.
                //signing region resolving order: user supplied signingRegion -> endpoints.json inferred region -> client region
                input.signingRegion = input.signingRegion || signingRegion || region;
                input.signingName = input.signingName || signingService;
                return new SignatureV4({
                    credentials: normalizedCreds,
                    region: input.signingRegion,
                    service: input.signingName,
                    sha256: sha256,
                    uriEscapePath: signingEscapePath,
                });
            });
        };
    }
    return __assign(__assign({}, input), { systemClockOffset: systemClockOffset,
        signingEscapePath: signingEscapePath, credentials: normalizedCreds, signer: signer });
}
function normalizeProvider(input) {
    if (typeof input === "object") {
        var promisified_1 = Promise.resolve(input);
        return function () { return promisified_1; };
    }
    return input;
}

var isClockSkewed = function (newServerTime, systemClockOffset) {
    return Math.abs(getSkewCorrectedDate(systemClockOffset).getTime() - newServerTime) >= 300000;
};
var getSkewCorrectedDate = function (systemClockOffset) { return new Date(Date.now() + systemClockOffset); };
function awsAuthMiddleware(options) {
    return function (next, context) {
        return function (args) {
            return __awaiter(this, void 0, void 0, function () {
                var signer, _a, output, _b, _c, headers, dateHeader, serverTime;
                var _d;
                return __generator(this, function (_e) {
                    switch (_e.label) {
                        case 0:
                            if (!HttpRequest.isInstance(args.request))
                                return [2 /*return*/, next(args)];
                            if (!(typeof options.signer === "function")) return [3 /*break*/, 2];
                            return [4 /*yield*/, options.signer()];
                        case 1:
                            _a = _e.sent();
                            return [3 /*break*/, 3];
                        case 2:
                            _a = options.signer;
                            _e.label = 3;
                        case 3:
                            signer = _a;
                            _b = next;
                            _c = [__assign({}, args)];
                            _d = {};
                            return [4 /*yield*/, signer.sign(args.request, {
                                    signingDate: new Date(Date.now() + options.systemClockOffset),
                                    signingRegion: context["signing_region"],
                                    signingService: context["signing_service"],
                                })];
                        case 4: return [4 /*yield*/, _b.apply(void 0, [__assign.apply(void 0, _c.concat([(_d.request = _e.sent(), _d)]))])];
                        case 5:
                            output = _e.sent();
                            headers = output.response.headers;
                            dateHeader = headers && (headers.date || headers.Date);
                            if (dateHeader) {
                                serverTime = Date.parse(dateHeader);
                                if (isClockSkewed(serverTime, options.systemClockOffset)) {
                                    options.systemClockOffset = serverTime - Date.now();
                                }
                            }
                            return [2 /*return*/, output];
                    }
                });
            });
        };
    };
}
var awsAuthMiddlewareOptions = {
    name: "awsAuthMiddleware",
    tags: ["SIGNATURE", "AWSAUTH"],
    relation: "after",
    toMiddleware: "retryMiddleware",
};
var getAwsAuthPlugin = function (options) { return ({
    applyToStack: function (clientStack) {
        clientStack.addRelativeTo(awsAuthMiddleware(options), awsAuthMiddlewareOptions);
    },
}); };

function resolveUserAgentConfig(input) {
    return input;
}

function userAgentMiddleware(options) {
    return function (next) { return function (args) {
        var request = args.request;
        if (!HttpRequest.isInstance(request))
            return next(args);
        var headers = request.headers;
        var userAgentHeader = options.runtime === "node" ? "user-agent" : "x-amz-user-agent";
        if (!headers[userAgentHeader]) {
            headers[userAgentHeader] = "" + options.defaultUserAgent;
        }
        else {
            headers[userAgentHeader] += " " + options.defaultUserAgent;
        }
        if (options.customUserAgent) {
            headers[userAgentHeader] += " " + options.customUserAgent;
        }
        return next(__assign(__assign({}, args), { request: request }));
    }; };
}
var getUserAgentMiddlewareOptions = {
    name: "getUserAgentMiddleware",
    step: "build",
    tags: ["SET_USER_AGENT", "USER_AGENT"],
};
var getUserAgentPlugin = function (config) { return ({
    applyToStack: function (clientStack) {
        clientStack.add(userAgentMiddleware(config), getUserAgentMiddlewareOptions);
    },
}); };

var constructStack = function () {
    var absoluteEntries = [];
    var relativeEntries = [];
    var entriesNameSet = new Set();
    var sort = function (entries) {
        return entries.sort(function (a, b) {
            return stepWeights[b.step] - stepWeights[a.step] ||
                priorityWeights[b.priority || "normal"] - priorityWeights[a.priority || "normal"];
        });
    };
    var removeByName = function (toRemove) {
        var isRemoved = false;
        var filterCb = function (entry) {
            if (entry.name && entry.name === toRemove) {
                isRemoved = true;
                entriesNameSet.delete(toRemove);
                return false;
            }
            return true;
        };
        absoluteEntries = absoluteEntries.filter(filterCb);
        relativeEntries = relativeEntries.filter(filterCb);
        return isRemoved;
    };
    var removeByReference = function (toRemove) {
        var isRemoved = false;
        var filterCb = function (entry) {
            if (entry.middleware === toRemove) {
                isRemoved = true;
                if (entry.name)
                    entriesNameSet.delete(entry.name);
                return false;
            }
            return true;
        };
        absoluteEntries = absoluteEntries.filter(filterCb);
        relativeEntries = relativeEntries.filter(filterCb);
        return isRemoved;
    };
    var cloneTo = function (toStack) {
        absoluteEntries.forEach(function (entry) {
            //@ts-ignore
            toStack.add(entry.middleware, __assign({}, entry));
        });
        relativeEntries.forEach(function (entry) {
            //@ts-ignore
            toStack.addRelativeTo(entry.middleware, __assign({}, entry));
        });
        return toStack;
    };
    var expandRelativeMiddlewareList = function (from) {
        var expandedMiddlewareList = [];
        from.before.forEach(function (entry) {
            if (entry.before.length === 0 && entry.after.length === 0) {
                expandedMiddlewareList.push(entry);
            }
            else {
                expandedMiddlewareList.push.apply(expandedMiddlewareList, __spread(expandRelativeMiddlewareList(entry)));
            }
        });
        expandedMiddlewareList.push(from);
        from.after.reverse().forEach(function (entry) {
            if (entry.before.length === 0 && entry.after.length === 0) {
                expandedMiddlewareList.push(entry);
            }
            else {
                expandedMiddlewareList.push.apply(expandedMiddlewareList, __spread(expandRelativeMiddlewareList(entry)));
            }
        });
        return expandedMiddlewareList;
    };
    /**
     * Get a final list of middleware in the order of being executed in the resolved handler.
     */
    var getMiddlewareList = function () {
        var normalizedAbsoluteEntries = [];
        var normalizedRelativeEntries = [];
        var normalizedEntriesNameMap = {};
        absoluteEntries.forEach(function (entry) {
            var normalizedEntry = __assign(__assign({}, entry), { before: [], after: [] });
            if (normalizedEntry.name)
                normalizedEntriesNameMap[normalizedEntry.name] = normalizedEntry;
            normalizedAbsoluteEntries.push(normalizedEntry);
        });
        relativeEntries.forEach(function (entry) {
            var normalizedEntry = __assign(__assign({}, entry), { before: [], after: [] });
            if (normalizedEntry.name)
                normalizedEntriesNameMap[normalizedEntry.name] = normalizedEntry;
            normalizedRelativeEntries.push(normalizedEntry);
        });
        normalizedRelativeEntries.forEach(function (entry) {
            if (entry.toMiddleware) {
                var toMiddleware = normalizedEntriesNameMap[entry.toMiddleware];
                if (toMiddleware === undefined) {
                    throw new Error(entry.toMiddleware + " is not found when adding " + (entry.name || "anonymous") + " middleware " + entry.relation + " " + entry.toMiddleware);
                }
                if (entry.relation === "after") {
                    toMiddleware.after.push(entry);
                }
                if (entry.relation === "before") {
                    toMiddleware.before.push(entry);
                }
            }
        });
        var mainChain = sort(normalizedAbsoluteEntries)
            .map(expandRelativeMiddlewareList)
            .reduce(function (wholeList, expendedMiddlewareList) {
            // TODO: Replace it with Array.flat();
            wholeList.push.apply(wholeList, __spread(expendedMiddlewareList));
            return wholeList;
        }, []);
        return mainChain.map(function (entry) { return entry.middleware; });
    };
    var stack = {
        add: function (middleware, options) {
            if (options === void 0) { options = {}; }
            var name = options.name;
            var entry = __assign({ step: "initialize", priority: "normal", middleware: middleware }, options);
            if (name) {
                if (entriesNameSet.has(name)) {
                    throw new Error("Duplicate middleware name '" + name + "'");
                }
                entriesNameSet.add(name);
            }
            absoluteEntries.push(entry);
        },
        addRelativeTo: function (middleware, options) {
            var name = options.name;
            var entry = __assign({ middleware: middleware }, options);
            if (name) {
                if (entriesNameSet.has(name)) {
                    throw new Error("Duplicated middleware name '" + name + "'");
                }
                entriesNameSet.add(name);
            }
            relativeEntries.push(entry);
        },
        clone: function () { return cloneTo(constructStack()); },
        use: function (plugin) {
            plugin.applyToStack(stack);
        },
        remove: function (toRemove) {
            if (typeof toRemove === "string")
                return removeByName(toRemove);
            else
                return removeByReference(toRemove);
        },
        removeByTag: function (toRemove) {
            var isRemoved = false;
            var filterCb = function (entry) {
                var tags = entry.tags, name = entry.name;
                if (tags && tags.includes(toRemove)) {
                    if (name)
                        entriesNameSet.delete(name);
                    isRemoved = true;
                    return false;
                }
                return true;
            };
            absoluteEntries = absoluteEntries.filter(filterCb);
            relativeEntries = relativeEntries.filter(filterCb);
            return isRemoved;
        },
        concat: function (from) {
            var cloned = cloneTo(constructStack());
            cloned.use(from);
            return cloned;
        },
        applyToStack: cloneTo,
        resolve: function (handler, context) {
            var e_1, _a;
            try {
                for (var _b = __values(getMiddlewareList().reverse()), _c = _b.next(); !_c.done; _c = _b.next()) {
                    var middleware = _c.value;
                    handler = middleware(handler, context);
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                }
                finally { if (e_1) throw e_1.error; }
            }
            return handler;
        },
    };
    return stack;
};
var stepWeights = {
    initialize: 5,
    serialize: 4,
    build: 3,
    finalizeRequest: 2,
    deserialize: 1,
};
var priorityWeights = {
    high: 3,
    normal: 2,
    low: 1,
};

var Client = /** @class */ (function () {
    function Client(config) {
        this.middlewareStack = constructStack();
        this.config = config;
    }
    Client.prototype.send = function (command, optionsOrCb, cb) {
        var options = typeof optionsOrCb !== "function" ? optionsOrCb : undefined;
        var callback = typeof optionsOrCb === "function" ? optionsOrCb : cb;
        var handler = command.resolveMiddleware(this.middlewareStack, this.config, options);
        if (callback) {
            handler(command)
                .then(function (result) { return callback(null, result.output); }, function (err) { return callback(err); })
                .catch(
            // prevent any errors thrown in the callback from triggering an
            // unhandled promise rejection
            function () { });
        }
        else {
            return handler(command).then(function (result) { return result.output; });
        }
    };
    Client.prototype.destroy = function () {
        if (this.config.requestHandler.destroy)
            this.config.requestHandler.destroy();
    };
    return Client;
}());

var Command = /** @class */ (function () {
    function Command() {
        this.middlewareStack = constructStack();
    }
    return Command;
}());

/**
 * Function that wraps encodeURIComponent to encode additional characters
 * to fully adhere to RFC 3986.
 */
function extendedEncodeURIComponent(str) {
    return encodeURIComponent(str).replace(/[!'()*]/g, function (c) {
        return "%" + c.charCodeAt(0).toString(16);
    });
}

/**
 * Recursively parses object and populates value is node from
 * "#text" key if it's available
 */
var getValueFromTextNode = function (obj) {
    var textNodeName = "#text";
    for (var key in obj) {
        if (obj.hasOwnProperty(key) && obj[key][textNodeName] !== undefined) {
            obj[key] = obj[key][textNodeName];
        }
        else if (typeof obj[key] === "object" && obj[key] !== null) {
            obj[key] = getValueFromTextNode(obj[key]);
        }
    }
    return obj;
};

/**
 * Lazy String holder for JSON typed contents.
 */
/**
 * Because of https://github.com/microsoft/tslib/issues/95,
 * TS 'extends' shim doesn't support extending native types like String.
 * So here we create StringWrapper that duplicate everything from String
 * class including its prototype chain. So we can extend from here.
 */
// @ts-ignore StringWrapper implementation is not a simple constructor
var StringWrapper = function () {
    //@ts-ignore 'this' cannot be assigned to any, but Object.getPrototypeOf accepts any
    var Class = Object.getPrototypeOf(this).constructor;
    var Constructor = Function.bind.apply(String, __spread([null], arguments));
    //@ts-ignore Call wrapped String constructor directly, don't bother typing it.
    var instance = new Constructor();
    Object.setPrototypeOf(instance, Class.prototype);
    return instance;
};
StringWrapper.prototype = Object.create(String.prototype, {
    constructor: {
        value: StringWrapper,
        enumerable: false,
        writable: true,
        configurable: true,
    },
});
Object.setPrototypeOf(StringWrapper, String);
var LazyJsonString = /** @class */ (function (_super) {
    __extends(LazyJsonString, _super);
    function LazyJsonString() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    LazyJsonString.prototype.deserializeJSON = function () {
        return JSON.parse(_super.prototype.toString.call(this));
    };
    LazyJsonString.prototype.toJSON = function () {
        return _super.prototype.toString.call(this);
    };
    LazyJsonString.fromObject = function (object) {
        if (object instanceof LazyJsonString) {
            return object;
        }
        else if (object instanceof String || typeof object === "string") {
            return new LazyJsonString(object);
        }
        return new LazyJsonString(JSON.stringify(object));
    };
    return LazyJsonString;
}(StringWrapper));

/**
 * Builds a proper UTC HttpDate timestamp from a Date object
 * since not all environments will have this as the expected
 * format.
 *
 * See: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/toUTCString
 * > Prior to ECMAScript 2018, the format of the return value
 * > varied according to the platform. The most common return
 * > value was an RFC-1123 formatted date stamp, which is a
 * > slightly updated version of RFC-822 date stamps.
 */
// Build indexes outside so we allocate them once.
var days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
// prettier-ignore
var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function dateToUtcString(date) {
    var year = date.getUTCFullYear();
    var month = date.getUTCMonth();
    var dayOfWeek = date.getUTCDay();
    var dayOfMonthInt = date.getUTCDate();
    var hoursInt = date.getUTCHours();
    var minutesInt = date.getUTCMinutes();
    var secondsInt = date.getUTCSeconds();
    // Build 0 prefixed strings for contents that need to be
    // two digits and where we get an integer back.
    var dayOfMonthString = dayOfMonthInt < 10 ? "0" + dayOfMonthInt : "" + dayOfMonthInt;
    var hoursString = hoursInt < 10 ? "0" + hoursInt : "" + hoursInt;
    var minutesString = minutesInt < 10 ? "0" + minutesInt : "" + minutesInt;
    var secondsString = secondsInt < 10 ? "0" + secondsInt : "" + secondsInt;
    return days[dayOfWeek] + ", " + dayOfMonthString + " " + months[month] + " " + year + " " + hoursString + ":" + minutesString + ":" + secondsString + " GMT";
}

var SENSITIVE_STRING = "***SensitiveInformation***";

/**
 * <p></p>
 */
class S3Client extends Client {
    constructor(configuration) {
        let _config_0 = {
            ...ClientDefaultValues,
            ...configuration,
        };
        let _config_1 = resolveRegionConfig(_config_0);
        let _config_2 = resolveEndpointsConfig(_config_1);
        let _config_3 = resolveAwsAuthConfig(_config_2);
        let _config_4 = resolveRetryConfig(_config_3);
        let _config_5 = resolveUserAgentConfig(_config_4);
        let _config_6 = resolveBucketEndpointConfig(_config_5);
        let _config_7 = resolveHostHeaderConfig(_config_6);
        let _config_8 = resolveEventStreamSerdeConfig(_config_7);
        super(_config_8);
        this.config = _config_8;
        this.middlewareStack.use(getAwsAuthPlugin(this.config));
        this.middlewareStack.use(getRetryPlugin(this.config));
        this.middlewareStack.use(getUserAgentPlugin(this.config));
        this.middlewareStack.use(getContentLengthPlugin(this.config));
        this.middlewareStack.use(getValidateBucketNamePlugin(this.config));
        this.middlewareStack.use(getUseRegionalEndpointPlugin(this.config));
        this.middlewareStack.use(getAddExpectContinuePlugin(this.config));
        this.middlewareStack.use(getHostHeaderPlugin(this.config));
        this.middlewareStack.use(getLoggerPlugin(this.config));
    }
    destroy() {
        super.destroy();
    }
}

var S3Client$1 = /*#__PURE__*/Object.freeze({
  __proto__: null,
  S3Client: S3Client
});

var AbortIncompleteMultipartUpload;
(function (AbortIncompleteMultipartUpload) {
    AbortIncompleteMultipartUpload.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(AbortIncompleteMultipartUpload || (AbortIncompleteMultipartUpload = {}));
var AbortMultipartUploadOutput;
(function (AbortMultipartUploadOutput) {
    AbortMultipartUploadOutput.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(AbortMultipartUploadOutput || (AbortMultipartUploadOutput = {}));
var AbortMultipartUploadRequest;
(function (AbortMultipartUploadRequest) {
    AbortMultipartUploadRequest.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(AbortMultipartUploadRequest || (AbortMultipartUploadRequest = {}));
var NoSuchUpload;
(function (NoSuchUpload) {
    NoSuchUpload.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(NoSuchUpload || (NoSuchUpload = {}));
var AccelerateConfiguration;
(function (AccelerateConfiguration) {
    AccelerateConfiguration.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(AccelerateConfiguration || (AccelerateConfiguration = {}));
var Grantee;
(function (Grantee) {
    Grantee.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(Grantee || (Grantee = {}));
var Grant;
(function (Grant) {
    Grant.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(Grant || (Grant = {}));
var Owner;
(function (Owner) {
    Owner.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(Owner || (Owner = {}));
var AccessControlPolicy;
(function (AccessControlPolicy) {
    AccessControlPolicy.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(AccessControlPolicy || (AccessControlPolicy = {}));
var AccessControlTranslation;
(function (AccessControlTranslation) {
    AccessControlTranslation.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(AccessControlTranslation || (AccessControlTranslation = {}));
var CompleteMultipartUploadOutput;
(function (CompleteMultipartUploadOutput) {
    CompleteMultipartUploadOutput.filterSensitiveLog = (obj) => ({
        ...obj,
        ...(obj.SSEKMSKeyId && { SSEKMSKeyId: SENSITIVE_STRING }),
    });
})(CompleteMultipartUploadOutput || (CompleteMultipartUploadOutput = {}));
var CompletedPart;
(function (CompletedPart) {
    CompletedPart.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(CompletedPart || (CompletedPart = {}));
var CompletedMultipartUpload;
(function (CompletedMultipartUpload) {
    CompletedMultipartUpload.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(CompletedMultipartUpload || (CompletedMultipartUpload = {}));
var CompleteMultipartUploadRequest;
(function (CompleteMultipartUploadRequest) {
    CompleteMultipartUploadRequest.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(CompleteMultipartUploadRequest || (CompleteMultipartUploadRequest = {}));
var CopyObjectResult;
(function (CopyObjectResult) {
    CopyObjectResult.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(CopyObjectResult || (CopyObjectResult = {}));
var CopyObjectOutput;
(function (CopyObjectOutput) {
    CopyObjectOutput.filterSensitiveLog = (obj) => ({
        ...obj,
        ...(obj.SSEKMSEncryptionContext && { SSEKMSEncryptionContext: SENSITIVE_STRING }),
        ...(obj.SSEKMSKeyId && { SSEKMSKeyId: SENSITIVE_STRING }),
    });
})(CopyObjectOutput || (CopyObjectOutput = {}));
var CopyObjectRequest;
(function (CopyObjectRequest) {
    CopyObjectRequest.filterSensitiveLog = (obj) => ({
        ...obj,
        ...(obj.SSEKMSEncryptionContext && { SSEKMSEncryptionContext: SENSITIVE_STRING }),
        ...(obj.SSECustomerKey && { SSECustomerKey: SENSITIVE_STRING }),
        ...(obj.CopySourceSSECustomerKey && { CopySourceSSECustomerKey: SENSITIVE_STRING }),
        ...(obj.SSEKMSKeyId && { SSEKMSKeyId: SENSITIVE_STRING }),
    });
})(CopyObjectRequest || (CopyObjectRequest = {}));
var ObjectNotInActiveTierError;
(function (ObjectNotInActiveTierError) {
    ObjectNotInActiveTierError.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(ObjectNotInActiveTierError || (ObjectNotInActiveTierError = {}));
var BucketAlreadyExists;
(function (BucketAlreadyExists) {
    BucketAlreadyExists.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(BucketAlreadyExists || (BucketAlreadyExists = {}));
var BucketAlreadyOwnedByYou;
(function (BucketAlreadyOwnedByYou) {
    BucketAlreadyOwnedByYou.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(BucketAlreadyOwnedByYou || (BucketAlreadyOwnedByYou = {}));
var CreateBucketOutput;
(function (CreateBucketOutput) {
    CreateBucketOutput.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(CreateBucketOutput || (CreateBucketOutput = {}));
var CreateBucketConfiguration;
(function (CreateBucketConfiguration) {
    CreateBucketConfiguration.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(CreateBucketConfiguration || (CreateBucketConfiguration = {}));
var CreateBucketRequest;
(function (CreateBucketRequest) {
    CreateBucketRequest.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(CreateBucketRequest || (CreateBucketRequest = {}));
var CreateMultipartUploadOutput;
(function (CreateMultipartUploadOutput) {
    CreateMultipartUploadOutput.filterSensitiveLog = (obj) => ({
        ...obj,
        ...(obj.SSEKMSEncryptionContext && { SSEKMSEncryptionContext: SENSITIVE_STRING }),
        ...(obj.SSEKMSKeyId && { SSEKMSKeyId: SENSITIVE_STRING }),
    });
})(CreateMultipartUploadOutput || (CreateMultipartUploadOutput = {}));
var CreateMultipartUploadRequest;
(function (CreateMultipartUploadRequest) {
    CreateMultipartUploadRequest.filterSensitiveLog = (obj) => ({
        ...obj,
        ...(obj.SSEKMSKeyId && { SSEKMSKeyId: SENSITIVE_STRING }),
        ...(obj.SSEKMSEncryptionContext && { SSEKMSEncryptionContext: SENSITIVE_STRING }),
        ...(obj.SSECustomerKey && { SSECustomerKey: SENSITIVE_STRING }),
    });
})(CreateMultipartUploadRequest || (CreateMultipartUploadRequest = {}));
var DeleteBucketRequest;
(function (DeleteBucketRequest) {
    DeleteBucketRequest.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(DeleteBucketRequest || (DeleteBucketRequest = {}));
var DeleteBucketAnalyticsConfigurationRequest;
(function (DeleteBucketAnalyticsConfigurationRequest) {
    DeleteBucketAnalyticsConfigurationRequest.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(DeleteBucketAnalyticsConfigurationRequest || (DeleteBucketAnalyticsConfigurationRequest = {}));
var DeleteBucketCorsRequest;
(function (DeleteBucketCorsRequest) {
    DeleteBucketCorsRequest.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(DeleteBucketCorsRequest || (DeleteBucketCorsRequest = {}));
var DeleteBucketEncryptionRequest;
(function (DeleteBucketEncryptionRequest) {
    DeleteBucketEncryptionRequest.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(DeleteBucketEncryptionRequest || (DeleteBucketEncryptionRequest = {}));
var DeleteBucketInventoryConfigurationRequest;
(function (DeleteBucketInventoryConfigurationRequest) {
    DeleteBucketInventoryConfigurationRequest.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(DeleteBucketInventoryConfigurationRequest || (DeleteBucketInventoryConfigurationRequest = {}));
var DeleteBucketLifecycleRequest;
(function (DeleteBucketLifecycleRequest) {
    DeleteBucketLifecycleRequest.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(DeleteBucketLifecycleRequest || (DeleteBucketLifecycleRequest = {}));
var DeleteBucketMetricsConfigurationRequest;
(function (DeleteBucketMetricsConfigurationRequest) {
    DeleteBucketMetricsConfigurationRequest.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(DeleteBucketMetricsConfigurationRequest || (DeleteBucketMetricsConfigurationRequest = {}));
var DeleteBucketOwnershipControlsRequest;
(function (DeleteBucketOwnershipControlsRequest) {
    DeleteBucketOwnershipControlsRequest.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(DeleteBucketOwnershipControlsRequest || (DeleteBucketOwnershipControlsRequest = {}));
var DeleteBucketPolicyRequest;
(function (DeleteBucketPolicyRequest) {
    DeleteBucketPolicyRequest.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(DeleteBucketPolicyRequest || (DeleteBucketPolicyRequest = {}));
var DeleteBucketReplicationRequest;
(function (DeleteBucketReplicationRequest) {
    DeleteBucketReplicationRequest.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(DeleteBucketReplicationRequest || (DeleteBucketReplicationRequest = {}));
var DeleteBucketTaggingRequest;
(function (DeleteBucketTaggingRequest) {
    DeleteBucketTaggingRequest.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(DeleteBucketTaggingRequest || (DeleteBucketTaggingRequest = {}));
var DeleteBucketWebsiteRequest;
(function (DeleteBucketWebsiteRequest) {
    DeleteBucketWebsiteRequest.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(DeleteBucketWebsiteRequest || (DeleteBucketWebsiteRequest = {}));
var DeleteObjectOutput;
(function (DeleteObjectOutput) {
    DeleteObjectOutput.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(DeleteObjectOutput || (DeleteObjectOutput = {}));
var DeleteObjectRequest;
(function (DeleteObjectRequest) {
    DeleteObjectRequest.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(DeleteObjectRequest || (DeleteObjectRequest = {}));
var DeletedObject;
(function (DeletedObject) {
    DeletedObject.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(DeletedObject || (DeletedObject = {}));
var _Error;
(function (_Error) {
    _Error.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(_Error || (_Error = {}));
var DeleteObjectsOutput;
(function (DeleteObjectsOutput) {
    DeleteObjectsOutput.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(DeleteObjectsOutput || (DeleteObjectsOutput = {}));
var ObjectIdentifier;
(function (ObjectIdentifier) {
    ObjectIdentifier.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(ObjectIdentifier || (ObjectIdentifier = {}));
var Delete;
(function (Delete) {
    Delete.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(Delete || (Delete = {}));
var DeleteObjectsRequest;
(function (DeleteObjectsRequest) {
    DeleteObjectsRequest.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(DeleteObjectsRequest || (DeleteObjectsRequest = {}));
var DeleteObjectTaggingOutput;
(function (DeleteObjectTaggingOutput) {
    DeleteObjectTaggingOutput.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(DeleteObjectTaggingOutput || (DeleteObjectTaggingOutput = {}));
var DeleteObjectTaggingRequest;
(function (DeleteObjectTaggingRequest) {
    DeleteObjectTaggingRequest.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(DeleteObjectTaggingRequest || (DeleteObjectTaggingRequest = {}));
var DeletePublicAccessBlockRequest;
(function (DeletePublicAccessBlockRequest) {
    DeletePublicAccessBlockRequest.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(DeletePublicAccessBlockRequest || (DeletePublicAccessBlockRequest = {}));
var GetBucketAccelerateConfigurationOutput;
(function (GetBucketAccelerateConfigurationOutput) {
    GetBucketAccelerateConfigurationOutput.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(GetBucketAccelerateConfigurationOutput || (GetBucketAccelerateConfigurationOutput = {}));
var GetBucketAccelerateConfigurationRequest;
(function (GetBucketAccelerateConfigurationRequest) {
    GetBucketAccelerateConfigurationRequest.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(GetBucketAccelerateConfigurationRequest || (GetBucketAccelerateConfigurationRequest = {}));
var GetBucketAclOutput;
(function (GetBucketAclOutput) {
    GetBucketAclOutput.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(GetBucketAclOutput || (GetBucketAclOutput = {}));
var GetBucketAclRequest;
(function (GetBucketAclRequest) {
    GetBucketAclRequest.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(GetBucketAclRequest || (GetBucketAclRequest = {}));
var Tag;
(function (Tag) {
    Tag.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(Tag || (Tag = {}));
var AnalyticsAndOperator;
(function (AnalyticsAndOperator) {
    AnalyticsAndOperator.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(AnalyticsAndOperator || (AnalyticsAndOperator = {}));
var AnalyticsFilter;
(function (AnalyticsFilter) {
    AnalyticsFilter.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(AnalyticsFilter || (AnalyticsFilter = {}));
var AnalyticsS3BucketDestination;
(function (AnalyticsS3BucketDestination) {
    AnalyticsS3BucketDestination.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(AnalyticsS3BucketDestination || (AnalyticsS3BucketDestination = {}));
var AnalyticsExportDestination;
(function (AnalyticsExportDestination) {
    AnalyticsExportDestination.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(AnalyticsExportDestination || (AnalyticsExportDestination = {}));
var StorageClassAnalysisDataExport;
(function (StorageClassAnalysisDataExport) {
    StorageClassAnalysisDataExport.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(StorageClassAnalysisDataExport || (StorageClassAnalysisDataExport = {}));
var StorageClassAnalysis;
(function (StorageClassAnalysis) {
    StorageClassAnalysis.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(StorageClassAnalysis || (StorageClassAnalysis = {}));
var AnalyticsConfiguration;
(function (AnalyticsConfiguration) {
    AnalyticsConfiguration.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(AnalyticsConfiguration || (AnalyticsConfiguration = {}));
var GetBucketAnalyticsConfigurationOutput;
(function (GetBucketAnalyticsConfigurationOutput) {
    GetBucketAnalyticsConfigurationOutput.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(GetBucketAnalyticsConfigurationOutput || (GetBucketAnalyticsConfigurationOutput = {}));
var GetBucketAnalyticsConfigurationRequest;
(function (GetBucketAnalyticsConfigurationRequest) {
    GetBucketAnalyticsConfigurationRequest.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(GetBucketAnalyticsConfigurationRequest || (GetBucketAnalyticsConfigurationRequest = {}));
var CORSRule;
(function (CORSRule) {
    CORSRule.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(CORSRule || (CORSRule = {}));
var GetBucketCorsOutput;
(function (GetBucketCorsOutput) {
    GetBucketCorsOutput.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(GetBucketCorsOutput || (GetBucketCorsOutput = {}));
var GetBucketCorsRequest;
(function (GetBucketCorsRequest) {
    GetBucketCorsRequest.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(GetBucketCorsRequest || (GetBucketCorsRequest = {}));
var ServerSideEncryptionByDefault;
(function (ServerSideEncryptionByDefault) {
    ServerSideEncryptionByDefault.filterSensitiveLog = (obj) => ({
        ...obj,
        ...(obj.KMSMasterKeyID && { KMSMasterKeyID: SENSITIVE_STRING }),
    });
})(ServerSideEncryptionByDefault || (ServerSideEncryptionByDefault = {}));
var ServerSideEncryptionRule;
(function (ServerSideEncryptionRule) {
    ServerSideEncryptionRule.filterSensitiveLog = (obj) => ({
        ...obj,
        ...(obj.ApplyServerSideEncryptionByDefault && {
            ApplyServerSideEncryptionByDefault: ServerSideEncryptionByDefault.filterSensitiveLog(obj.ApplyServerSideEncryptionByDefault),
        }),
    });
})(ServerSideEncryptionRule || (ServerSideEncryptionRule = {}));
var ServerSideEncryptionConfiguration;
(function (ServerSideEncryptionConfiguration) {
    ServerSideEncryptionConfiguration.filterSensitiveLog = (obj) => ({
        ...obj,
        ...(obj.Rules && { Rules: obj.Rules.map((item) => ServerSideEncryptionRule.filterSensitiveLog(item)) }),
    });
})(ServerSideEncryptionConfiguration || (ServerSideEncryptionConfiguration = {}));
var GetBucketEncryptionOutput;
(function (GetBucketEncryptionOutput) {
    GetBucketEncryptionOutput.filterSensitiveLog = (obj) => ({
        ...obj,
        ...(obj.ServerSideEncryptionConfiguration && {
            ServerSideEncryptionConfiguration: ServerSideEncryptionConfiguration.filterSensitiveLog(obj.ServerSideEncryptionConfiguration),
        }),
    });
})(GetBucketEncryptionOutput || (GetBucketEncryptionOutput = {}));
var GetBucketEncryptionRequest;
(function (GetBucketEncryptionRequest) {
    GetBucketEncryptionRequest.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(GetBucketEncryptionRequest || (GetBucketEncryptionRequest = {}));
var SSEKMS;
(function (SSEKMS) {
    SSEKMS.filterSensitiveLog = (obj) => ({
        ...obj,
        ...(obj.KeyId && { KeyId: SENSITIVE_STRING }),
    });
})(SSEKMS || (SSEKMS = {}));
var SSES3;
(function (SSES3) {
    SSES3.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(SSES3 || (SSES3 = {}));
var InventoryEncryption;
(function (InventoryEncryption) {
    InventoryEncryption.filterSensitiveLog = (obj) => ({
        ...obj,
        ...(obj.SSEKMS && { SSEKMS: SSEKMS.filterSensitiveLog(obj.SSEKMS) }),
    });
})(InventoryEncryption || (InventoryEncryption = {}));
var InventoryS3BucketDestination;
(function (InventoryS3BucketDestination) {
    InventoryS3BucketDestination.filterSensitiveLog = (obj) => ({
        ...obj,
        ...(obj.Encryption && { Encryption: InventoryEncryption.filterSensitiveLog(obj.Encryption) }),
    });
})(InventoryS3BucketDestination || (InventoryS3BucketDestination = {}));
var InventoryDestination;
(function (InventoryDestination) {
    InventoryDestination.filterSensitiveLog = (obj) => ({
        ...obj,
        ...(obj.S3BucketDestination && {
            S3BucketDestination: InventoryS3BucketDestination.filterSensitiveLog(obj.S3BucketDestination),
        }),
    });
})(InventoryDestination || (InventoryDestination = {}));
var InventoryFilter;
(function (InventoryFilter) {
    InventoryFilter.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(InventoryFilter || (InventoryFilter = {}));
var InventorySchedule;
(function (InventorySchedule) {
    InventorySchedule.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(InventorySchedule || (InventorySchedule = {}));
var InventoryConfiguration;
(function (InventoryConfiguration) {
    InventoryConfiguration.filterSensitiveLog = (obj) => ({
        ...obj,
        ...(obj.Destination && { Destination: InventoryDestination.filterSensitiveLog(obj.Destination) }),
    });
})(InventoryConfiguration || (InventoryConfiguration = {}));
var GetBucketInventoryConfigurationOutput;
(function (GetBucketInventoryConfigurationOutput) {
    GetBucketInventoryConfigurationOutput.filterSensitiveLog = (obj) => ({
        ...obj,
        ...(obj.InventoryConfiguration && {
            InventoryConfiguration: InventoryConfiguration.filterSensitiveLog(obj.InventoryConfiguration),
        }),
    });
})(GetBucketInventoryConfigurationOutput || (GetBucketInventoryConfigurationOutput = {}));
var GetBucketInventoryConfigurationRequest;
(function (GetBucketInventoryConfigurationRequest) {
    GetBucketInventoryConfigurationRequest.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(GetBucketInventoryConfigurationRequest || (GetBucketInventoryConfigurationRequest = {}));
var LifecycleExpiration;
(function (LifecycleExpiration) {
    LifecycleExpiration.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(LifecycleExpiration || (LifecycleExpiration = {}));
var LifecycleRuleAndOperator;
(function (LifecycleRuleAndOperator) {
    LifecycleRuleAndOperator.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(LifecycleRuleAndOperator || (LifecycleRuleAndOperator = {}));
var LifecycleRuleFilter;
(function (LifecycleRuleFilter) {
    LifecycleRuleFilter.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(LifecycleRuleFilter || (LifecycleRuleFilter = {}));
var NoncurrentVersionExpiration;
(function (NoncurrentVersionExpiration) {
    NoncurrentVersionExpiration.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(NoncurrentVersionExpiration || (NoncurrentVersionExpiration = {}));
var NoncurrentVersionTransition;
(function (NoncurrentVersionTransition) {
    NoncurrentVersionTransition.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(NoncurrentVersionTransition || (NoncurrentVersionTransition = {}));
var Transition;
(function (Transition) {
    Transition.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(Transition || (Transition = {}));
var LifecycleRule;
(function (LifecycleRule) {
    LifecycleRule.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(LifecycleRule || (LifecycleRule = {}));
var GetBucketLifecycleConfigurationOutput;
(function (GetBucketLifecycleConfigurationOutput) {
    GetBucketLifecycleConfigurationOutput.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(GetBucketLifecycleConfigurationOutput || (GetBucketLifecycleConfigurationOutput = {}));
var GetBucketLifecycleConfigurationRequest;
(function (GetBucketLifecycleConfigurationRequest) {
    GetBucketLifecycleConfigurationRequest.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(GetBucketLifecycleConfigurationRequest || (GetBucketLifecycleConfigurationRequest = {}));
var GetBucketLocationOutput;
(function (GetBucketLocationOutput) {
    GetBucketLocationOutput.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(GetBucketLocationOutput || (GetBucketLocationOutput = {}));
var GetBucketLocationRequest;
(function (GetBucketLocationRequest) {
    GetBucketLocationRequest.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(GetBucketLocationRequest || (GetBucketLocationRequest = {}));
var TargetGrant;
(function (TargetGrant) {
    TargetGrant.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(TargetGrant || (TargetGrant = {}));
var LoggingEnabled;
(function (LoggingEnabled) {
    LoggingEnabled.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(LoggingEnabled || (LoggingEnabled = {}));
var GetBucketLoggingOutput;
(function (GetBucketLoggingOutput) {
    GetBucketLoggingOutput.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(GetBucketLoggingOutput || (GetBucketLoggingOutput = {}));
var GetBucketLoggingRequest;
(function (GetBucketLoggingRequest) {
    GetBucketLoggingRequest.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(GetBucketLoggingRequest || (GetBucketLoggingRequest = {}));
var MetricsAndOperator;
(function (MetricsAndOperator) {
    MetricsAndOperator.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(MetricsAndOperator || (MetricsAndOperator = {}));
var MetricsFilter;
(function (MetricsFilter) {
    MetricsFilter.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(MetricsFilter || (MetricsFilter = {}));
var MetricsConfiguration;
(function (MetricsConfiguration) {
    MetricsConfiguration.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(MetricsConfiguration || (MetricsConfiguration = {}));
var GetBucketMetricsConfigurationOutput;
(function (GetBucketMetricsConfigurationOutput) {
    GetBucketMetricsConfigurationOutput.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(GetBucketMetricsConfigurationOutput || (GetBucketMetricsConfigurationOutput = {}));
var GetBucketMetricsConfigurationRequest;
(function (GetBucketMetricsConfigurationRequest) {
    GetBucketMetricsConfigurationRequest.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(GetBucketMetricsConfigurationRequest || (GetBucketMetricsConfigurationRequest = {}));
var GetBucketNotificationConfigurationRequest;
(function (GetBucketNotificationConfigurationRequest) {
    GetBucketNotificationConfigurationRequest.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(GetBucketNotificationConfigurationRequest || (GetBucketNotificationConfigurationRequest = {}));
var FilterRule;
(function (FilterRule) {
    FilterRule.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(FilterRule || (FilterRule = {}));
var S3KeyFilter;
(function (S3KeyFilter) {
    S3KeyFilter.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(S3KeyFilter || (S3KeyFilter = {}));
var NotificationConfigurationFilter;
(function (NotificationConfigurationFilter) {
    NotificationConfigurationFilter.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(NotificationConfigurationFilter || (NotificationConfigurationFilter = {}));
var LambdaFunctionConfiguration;
(function (LambdaFunctionConfiguration) {
    LambdaFunctionConfiguration.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(LambdaFunctionConfiguration || (LambdaFunctionConfiguration = {}));
var QueueConfiguration;
(function (QueueConfiguration) {
    QueueConfiguration.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(QueueConfiguration || (QueueConfiguration = {}));
var TopicConfiguration;
(function (TopicConfiguration) {
    TopicConfiguration.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(TopicConfiguration || (TopicConfiguration = {}));
var NotificationConfiguration;
(function (NotificationConfiguration) {
    NotificationConfiguration.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(NotificationConfiguration || (NotificationConfiguration = {}));
var OwnershipControlsRule;
(function (OwnershipControlsRule) {
    OwnershipControlsRule.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(OwnershipControlsRule || (OwnershipControlsRule = {}));
var OwnershipControls;
(function (OwnershipControls) {
    OwnershipControls.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(OwnershipControls || (OwnershipControls = {}));
var GetBucketOwnershipControlsOutput;
(function (GetBucketOwnershipControlsOutput) {
    GetBucketOwnershipControlsOutput.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(GetBucketOwnershipControlsOutput || (GetBucketOwnershipControlsOutput = {}));
var GetBucketOwnershipControlsRequest;
(function (GetBucketOwnershipControlsRequest) {
    GetBucketOwnershipControlsRequest.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(GetBucketOwnershipControlsRequest || (GetBucketOwnershipControlsRequest = {}));
var GetBucketPolicyOutput;
(function (GetBucketPolicyOutput) {
    GetBucketPolicyOutput.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(GetBucketPolicyOutput || (GetBucketPolicyOutput = {}));
var GetBucketPolicyRequest;
(function (GetBucketPolicyRequest) {
    GetBucketPolicyRequest.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(GetBucketPolicyRequest || (GetBucketPolicyRequest = {}));
var PolicyStatus;
(function (PolicyStatus) {
    PolicyStatus.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(PolicyStatus || (PolicyStatus = {}));
var GetBucketPolicyStatusOutput;
(function (GetBucketPolicyStatusOutput) {
    GetBucketPolicyStatusOutput.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(GetBucketPolicyStatusOutput || (GetBucketPolicyStatusOutput = {}));
var GetBucketPolicyStatusRequest;
(function (GetBucketPolicyStatusRequest) {
    GetBucketPolicyStatusRequest.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(GetBucketPolicyStatusRequest || (GetBucketPolicyStatusRequest = {}));
var DeleteMarkerReplication;
(function (DeleteMarkerReplication) {
    DeleteMarkerReplication.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(DeleteMarkerReplication || (DeleteMarkerReplication = {}));
var EncryptionConfiguration;
(function (EncryptionConfiguration) {
    EncryptionConfiguration.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(EncryptionConfiguration || (EncryptionConfiguration = {}));
var ReplicationTimeValue;
(function (ReplicationTimeValue) {
    ReplicationTimeValue.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(ReplicationTimeValue || (ReplicationTimeValue = {}));
var Metrics;
(function (Metrics) {
    Metrics.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(Metrics || (Metrics = {}));
var ReplicationTime;
(function (ReplicationTime) {
    ReplicationTime.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(ReplicationTime || (ReplicationTime = {}));
var Destination;
(function (Destination) {
    Destination.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(Destination || (Destination = {}));
var ExistingObjectReplication;
(function (ExistingObjectReplication) {
    ExistingObjectReplication.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(ExistingObjectReplication || (ExistingObjectReplication = {}));
var ReplicationRuleAndOperator;
(function (ReplicationRuleAndOperator) {
    ReplicationRuleAndOperator.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(ReplicationRuleAndOperator || (ReplicationRuleAndOperator = {}));
var ReplicationRuleFilter;
(function (ReplicationRuleFilter) {
    ReplicationRuleFilter.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(ReplicationRuleFilter || (ReplicationRuleFilter = {}));
var SseKmsEncryptedObjects;
(function (SseKmsEncryptedObjects) {
    SseKmsEncryptedObjects.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(SseKmsEncryptedObjects || (SseKmsEncryptedObjects = {}));
var SourceSelectionCriteria;
(function (SourceSelectionCriteria) {
    SourceSelectionCriteria.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(SourceSelectionCriteria || (SourceSelectionCriteria = {}));
var ReplicationRule;
(function (ReplicationRule) {
    ReplicationRule.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(ReplicationRule || (ReplicationRule = {}));
var ReplicationConfiguration;
(function (ReplicationConfiguration) {
    ReplicationConfiguration.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(ReplicationConfiguration || (ReplicationConfiguration = {}));
var GetBucketReplicationOutput;
(function (GetBucketReplicationOutput) {
    GetBucketReplicationOutput.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(GetBucketReplicationOutput || (GetBucketReplicationOutput = {}));
var GetBucketReplicationRequest;
(function (GetBucketReplicationRequest) {
    GetBucketReplicationRequest.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(GetBucketReplicationRequest || (GetBucketReplicationRequest = {}));
var GetBucketRequestPaymentOutput;
(function (GetBucketRequestPaymentOutput) {
    GetBucketRequestPaymentOutput.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(GetBucketRequestPaymentOutput || (GetBucketRequestPaymentOutput = {}));
var GetBucketRequestPaymentRequest;
(function (GetBucketRequestPaymentRequest) {
    GetBucketRequestPaymentRequest.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(GetBucketRequestPaymentRequest || (GetBucketRequestPaymentRequest = {}));
var GetBucketTaggingOutput;
(function (GetBucketTaggingOutput) {
    GetBucketTaggingOutput.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(GetBucketTaggingOutput || (GetBucketTaggingOutput = {}));
var GetBucketTaggingRequest;
(function (GetBucketTaggingRequest) {
    GetBucketTaggingRequest.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(GetBucketTaggingRequest || (GetBucketTaggingRequest = {}));
var GetBucketVersioningOutput;
(function (GetBucketVersioningOutput) {
    GetBucketVersioningOutput.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(GetBucketVersioningOutput || (GetBucketVersioningOutput = {}));
var GetBucketVersioningRequest;
(function (GetBucketVersioningRequest) {
    GetBucketVersioningRequest.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(GetBucketVersioningRequest || (GetBucketVersioningRequest = {}));
var ErrorDocument;
(function (ErrorDocument) {
    ErrorDocument.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(ErrorDocument || (ErrorDocument = {}));
var IndexDocument;
(function (IndexDocument) {
    IndexDocument.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(IndexDocument || (IndexDocument = {}));
var RedirectAllRequestsTo;
(function (RedirectAllRequestsTo) {
    RedirectAllRequestsTo.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(RedirectAllRequestsTo || (RedirectAllRequestsTo = {}));
var Condition;
(function (Condition) {
    Condition.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(Condition || (Condition = {}));
var Redirect;
(function (Redirect) {
    Redirect.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(Redirect || (Redirect = {}));
var RoutingRule;
(function (RoutingRule) {
    RoutingRule.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(RoutingRule || (RoutingRule = {}));
var GetBucketWebsiteOutput;
(function (GetBucketWebsiteOutput) {
    GetBucketWebsiteOutput.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(GetBucketWebsiteOutput || (GetBucketWebsiteOutput = {}));
var GetBucketWebsiteRequest;
(function (GetBucketWebsiteRequest) {
    GetBucketWebsiteRequest.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(GetBucketWebsiteRequest || (GetBucketWebsiteRequest = {}));
var GetObjectOutput;
(function (GetObjectOutput) {
    GetObjectOutput.filterSensitiveLog = (obj) => ({
        ...obj,
        ...(obj.SSEKMSKeyId && { SSEKMSKeyId: SENSITIVE_STRING }),
    });
})(GetObjectOutput || (GetObjectOutput = {}));
var GetObjectRequest;
(function (GetObjectRequest) {
    GetObjectRequest.filterSensitiveLog = (obj) => ({
        ...obj,
        ...(obj.SSECustomerKey && { SSECustomerKey: SENSITIVE_STRING }),
    });
})(GetObjectRequest || (GetObjectRequest = {}));
var NoSuchKey;
(function (NoSuchKey) {
    NoSuchKey.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(NoSuchKey || (NoSuchKey = {}));
var GetObjectAclOutput;
(function (GetObjectAclOutput) {
    GetObjectAclOutput.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(GetObjectAclOutput || (GetObjectAclOutput = {}));
var GetObjectAclRequest;
(function (GetObjectAclRequest) {
    GetObjectAclRequest.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(GetObjectAclRequest || (GetObjectAclRequest = {}));
var ObjectLockLegalHold;
(function (ObjectLockLegalHold) {
    ObjectLockLegalHold.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(ObjectLockLegalHold || (ObjectLockLegalHold = {}));
var GetObjectLegalHoldOutput;
(function (GetObjectLegalHoldOutput) {
    GetObjectLegalHoldOutput.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(GetObjectLegalHoldOutput || (GetObjectLegalHoldOutput = {}));
var GetObjectLegalHoldRequest;
(function (GetObjectLegalHoldRequest) {
    GetObjectLegalHoldRequest.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(GetObjectLegalHoldRequest || (GetObjectLegalHoldRequest = {}));
var DefaultRetention;
(function (DefaultRetention) {
    DefaultRetention.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(DefaultRetention || (DefaultRetention = {}));
var ObjectLockRule;
(function (ObjectLockRule) {
    ObjectLockRule.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(ObjectLockRule || (ObjectLockRule = {}));
var ObjectLockConfiguration;
(function (ObjectLockConfiguration) {
    ObjectLockConfiguration.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(ObjectLockConfiguration || (ObjectLockConfiguration = {}));
var GetObjectLockConfigurationOutput;
(function (GetObjectLockConfigurationOutput) {
    GetObjectLockConfigurationOutput.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(GetObjectLockConfigurationOutput || (GetObjectLockConfigurationOutput = {}));
var GetObjectLockConfigurationRequest;
(function (GetObjectLockConfigurationRequest) {
    GetObjectLockConfigurationRequest.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(GetObjectLockConfigurationRequest || (GetObjectLockConfigurationRequest = {}));
var ObjectLockRetention;
(function (ObjectLockRetention) {
    ObjectLockRetention.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(ObjectLockRetention || (ObjectLockRetention = {}));
var GetObjectRetentionOutput;
(function (GetObjectRetentionOutput) {
    GetObjectRetentionOutput.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(GetObjectRetentionOutput || (GetObjectRetentionOutput = {}));
var GetObjectRetentionRequest;
(function (GetObjectRetentionRequest) {
    GetObjectRetentionRequest.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(GetObjectRetentionRequest || (GetObjectRetentionRequest = {}));
var GetObjectTaggingOutput;
(function (GetObjectTaggingOutput) {
    GetObjectTaggingOutput.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(GetObjectTaggingOutput || (GetObjectTaggingOutput = {}));
var GetObjectTaggingRequest;
(function (GetObjectTaggingRequest) {
    GetObjectTaggingRequest.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(GetObjectTaggingRequest || (GetObjectTaggingRequest = {}));
var GetObjectTorrentOutput;
(function (GetObjectTorrentOutput) {
    GetObjectTorrentOutput.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(GetObjectTorrentOutput || (GetObjectTorrentOutput = {}));
var GetObjectTorrentRequest;
(function (GetObjectTorrentRequest) {
    GetObjectTorrentRequest.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(GetObjectTorrentRequest || (GetObjectTorrentRequest = {}));
var PublicAccessBlockConfiguration;
(function (PublicAccessBlockConfiguration) {
    PublicAccessBlockConfiguration.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(PublicAccessBlockConfiguration || (PublicAccessBlockConfiguration = {}));
var GetPublicAccessBlockOutput;
(function (GetPublicAccessBlockOutput) {
    GetPublicAccessBlockOutput.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(GetPublicAccessBlockOutput || (GetPublicAccessBlockOutput = {}));
var GetPublicAccessBlockRequest;
(function (GetPublicAccessBlockRequest) {
    GetPublicAccessBlockRequest.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(GetPublicAccessBlockRequest || (GetPublicAccessBlockRequest = {}));
var HeadBucketRequest;
(function (HeadBucketRequest) {
    HeadBucketRequest.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(HeadBucketRequest || (HeadBucketRequest = {}));
var NoSuchBucket;
(function (NoSuchBucket) {
    NoSuchBucket.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(NoSuchBucket || (NoSuchBucket = {}));
var HeadObjectOutput;
(function (HeadObjectOutput) {
    HeadObjectOutput.filterSensitiveLog = (obj) => ({
        ...obj,
        ...(obj.SSEKMSKeyId && { SSEKMSKeyId: SENSITIVE_STRING }),
    });
})(HeadObjectOutput || (HeadObjectOutput = {}));
var HeadObjectRequest;
(function (HeadObjectRequest) {
    HeadObjectRequest.filterSensitiveLog = (obj) => ({
        ...obj,
        ...(obj.SSECustomerKey && { SSECustomerKey: SENSITIVE_STRING }),
    });
})(HeadObjectRequest || (HeadObjectRequest = {}));
var ListBucketAnalyticsConfigurationsOutput;
(function (ListBucketAnalyticsConfigurationsOutput) {
    ListBucketAnalyticsConfigurationsOutput.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(ListBucketAnalyticsConfigurationsOutput || (ListBucketAnalyticsConfigurationsOutput = {}));
var ListBucketAnalyticsConfigurationsRequest;
(function (ListBucketAnalyticsConfigurationsRequest) {
    ListBucketAnalyticsConfigurationsRequest.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(ListBucketAnalyticsConfigurationsRequest || (ListBucketAnalyticsConfigurationsRequest = {}));
var ListBucketInventoryConfigurationsOutput;
(function (ListBucketInventoryConfigurationsOutput) {
    ListBucketInventoryConfigurationsOutput.filterSensitiveLog = (obj) => ({
        ...obj,
        ...(obj.InventoryConfigurationList && {
            InventoryConfigurationList: obj.InventoryConfigurationList.map((item) => InventoryConfiguration.filterSensitiveLog(item)),
        }),
    });
})(ListBucketInventoryConfigurationsOutput || (ListBucketInventoryConfigurationsOutput = {}));
var ListBucketInventoryConfigurationsRequest;
(function (ListBucketInventoryConfigurationsRequest) {
    ListBucketInventoryConfigurationsRequest.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(ListBucketInventoryConfigurationsRequest || (ListBucketInventoryConfigurationsRequest = {}));
var ListBucketMetricsConfigurationsOutput;
(function (ListBucketMetricsConfigurationsOutput) {
    ListBucketMetricsConfigurationsOutput.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(ListBucketMetricsConfigurationsOutput || (ListBucketMetricsConfigurationsOutput = {}));
var ListBucketMetricsConfigurationsRequest;
(function (ListBucketMetricsConfigurationsRequest) {
    ListBucketMetricsConfigurationsRequest.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(ListBucketMetricsConfigurationsRequest || (ListBucketMetricsConfigurationsRequest = {}));
var Bucket;
(function (Bucket) {
    Bucket.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(Bucket || (Bucket = {}));
var ListBucketsOutput;
(function (ListBucketsOutput) {
    ListBucketsOutput.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(ListBucketsOutput || (ListBucketsOutput = {}));
var CommonPrefix;
(function (CommonPrefix) {
    CommonPrefix.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(CommonPrefix || (CommonPrefix = {}));
var Initiator;
(function (Initiator) {
    Initiator.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(Initiator || (Initiator = {}));
var MultipartUpload;
(function (MultipartUpload) {
    MultipartUpload.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(MultipartUpload || (MultipartUpload = {}));
var ListMultipartUploadsOutput;
(function (ListMultipartUploadsOutput) {
    ListMultipartUploadsOutput.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(ListMultipartUploadsOutput || (ListMultipartUploadsOutput = {}));
var ListMultipartUploadsRequest;
(function (ListMultipartUploadsRequest) {
    ListMultipartUploadsRequest.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(ListMultipartUploadsRequest || (ListMultipartUploadsRequest = {}));
var _Object;
(function (_Object) {
    _Object.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(_Object || (_Object = {}));
var ListObjectsOutput;
(function (ListObjectsOutput) {
    ListObjectsOutput.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(ListObjectsOutput || (ListObjectsOutput = {}));
var ListObjectsRequest;
(function (ListObjectsRequest) {
    ListObjectsRequest.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(ListObjectsRequest || (ListObjectsRequest = {}));
var ListObjectsV2Output;
(function (ListObjectsV2Output) {
    ListObjectsV2Output.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(ListObjectsV2Output || (ListObjectsV2Output = {}));
var ListObjectsV2Request;
(function (ListObjectsV2Request) {
    ListObjectsV2Request.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(ListObjectsV2Request || (ListObjectsV2Request = {}));
var DeleteMarkerEntry;
(function (DeleteMarkerEntry) {
    DeleteMarkerEntry.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(DeleteMarkerEntry || (DeleteMarkerEntry = {}));
var ObjectVersion;
(function (ObjectVersion) {
    ObjectVersion.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(ObjectVersion || (ObjectVersion = {}));
var ListObjectVersionsOutput;
(function (ListObjectVersionsOutput) {
    ListObjectVersionsOutput.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(ListObjectVersionsOutput || (ListObjectVersionsOutput = {}));
var ListObjectVersionsRequest;
(function (ListObjectVersionsRequest) {
    ListObjectVersionsRequest.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(ListObjectVersionsRequest || (ListObjectVersionsRequest = {}));
var Part;
(function (Part) {
    Part.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(Part || (Part = {}));
var ListPartsOutput;
(function (ListPartsOutput) {
    ListPartsOutput.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(ListPartsOutput || (ListPartsOutput = {}));
var ListPartsRequest;
(function (ListPartsRequest) {
    ListPartsRequest.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(ListPartsRequest || (ListPartsRequest = {}));
var PutBucketAccelerateConfigurationRequest;
(function (PutBucketAccelerateConfigurationRequest) {
    PutBucketAccelerateConfigurationRequest.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(PutBucketAccelerateConfigurationRequest || (PutBucketAccelerateConfigurationRequest = {}));
var PutBucketAclRequest;
(function (PutBucketAclRequest) {
    PutBucketAclRequest.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(PutBucketAclRequest || (PutBucketAclRequest = {}));
var PutBucketAnalyticsConfigurationRequest;
(function (PutBucketAnalyticsConfigurationRequest) {
    PutBucketAnalyticsConfigurationRequest.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(PutBucketAnalyticsConfigurationRequest || (PutBucketAnalyticsConfigurationRequest = {}));
var CORSConfiguration;
(function (CORSConfiguration) {
    CORSConfiguration.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(CORSConfiguration || (CORSConfiguration = {}));
var PutBucketCorsRequest;
(function (PutBucketCorsRequest) {
    PutBucketCorsRequest.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(PutBucketCorsRequest || (PutBucketCorsRequest = {}));
var PutBucketEncryptionRequest;
(function (PutBucketEncryptionRequest) {
    PutBucketEncryptionRequest.filterSensitiveLog = (obj) => ({
        ...obj,
        ...(obj.ServerSideEncryptionConfiguration && {
            ServerSideEncryptionConfiguration: ServerSideEncryptionConfiguration.filterSensitiveLog(obj.ServerSideEncryptionConfiguration),
        }),
    });
})(PutBucketEncryptionRequest || (PutBucketEncryptionRequest = {}));
var PutBucketInventoryConfigurationRequest;
(function (PutBucketInventoryConfigurationRequest) {
    PutBucketInventoryConfigurationRequest.filterSensitiveLog = (obj) => ({
        ...obj,
        ...(obj.InventoryConfiguration && {
            InventoryConfiguration: InventoryConfiguration.filterSensitiveLog(obj.InventoryConfiguration),
        }),
    });
})(PutBucketInventoryConfigurationRequest || (PutBucketInventoryConfigurationRequest = {}));
var BucketLifecycleConfiguration;
(function (BucketLifecycleConfiguration) {
    BucketLifecycleConfiguration.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(BucketLifecycleConfiguration || (BucketLifecycleConfiguration = {}));
var PutBucketLifecycleConfigurationRequest;
(function (PutBucketLifecycleConfigurationRequest) {
    PutBucketLifecycleConfigurationRequest.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(PutBucketLifecycleConfigurationRequest || (PutBucketLifecycleConfigurationRequest = {}));
var BucketLoggingStatus;
(function (BucketLoggingStatus) {
    BucketLoggingStatus.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(BucketLoggingStatus || (BucketLoggingStatus = {}));
var PutBucketLoggingRequest;
(function (PutBucketLoggingRequest) {
    PutBucketLoggingRequest.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(PutBucketLoggingRequest || (PutBucketLoggingRequest = {}));
var PutBucketMetricsConfigurationRequest;
(function (PutBucketMetricsConfigurationRequest) {
    PutBucketMetricsConfigurationRequest.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(PutBucketMetricsConfigurationRequest || (PutBucketMetricsConfigurationRequest = {}));
var PutBucketNotificationConfigurationRequest;
(function (PutBucketNotificationConfigurationRequest) {
    PutBucketNotificationConfigurationRequest.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(PutBucketNotificationConfigurationRequest || (PutBucketNotificationConfigurationRequest = {}));
var PutBucketOwnershipControlsRequest;
(function (PutBucketOwnershipControlsRequest) {
    PutBucketOwnershipControlsRequest.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(PutBucketOwnershipControlsRequest || (PutBucketOwnershipControlsRequest = {}));
var PutBucketPolicyRequest;
(function (PutBucketPolicyRequest) {
    PutBucketPolicyRequest.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(PutBucketPolicyRequest || (PutBucketPolicyRequest = {}));
var PutBucketReplicationRequest;
(function (PutBucketReplicationRequest) {
    PutBucketReplicationRequest.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(PutBucketReplicationRequest || (PutBucketReplicationRequest = {}));
var RequestPaymentConfiguration;
(function (RequestPaymentConfiguration) {
    RequestPaymentConfiguration.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(RequestPaymentConfiguration || (RequestPaymentConfiguration = {}));
var PutBucketRequestPaymentRequest;
(function (PutBucketRequestPaymentRequest) {
    PutBucketRequestPaymentRequest.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(PutBucketRequestPaymentRequest || (PutBucketRequestPaymentRequest = {}));
var Tagging;
(function (Tagging) {
    Tagging.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(Tagging || (Tagging = {}));
var PutBucketTaggingRequest;
(function (PutBucketTaggingRequest) {
    PutBucketTaggingRequest.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(PutBucketTaggingRequest || (PutBucketTaggingRequest = {}));
var VersioningConfiguration;
(function (VersioningConfiguration) {
    VersioningConfiguration.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(VersioningConfiguration || (VersioningConfiguration = {}));
var PutBucketVersioningRequest;
(function (PutBucketVersioningRequest) {
    PutBucketVersioningRequest.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(PutBucketVersioningRequest || (PutBucketVersioningRequest = {}));
var WebsiteConfiguration;
(function (WebsiteConfiguration) {
    WebsiteConfiguration.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(WebsiteConfiguration || (WebsiteConfiguration = {}));
var PutBucketWebsiteRequest;
(function (PutBucketWebsiteRequest) {
    PutBucketWebsiteRequest.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(PutBucketWebsiteRequest || (PutBucketWebsiteRequest = {}));
var PutObjectOutput;
(function (PutObjectOutput) {
    PutObjectOutput.filterSensitiveLog = (obj) => ({
        ...obj,
        ...(obj.SSEKMSEncryptionContext && { SSEKMSEncryptionContext: SENSITIVE_STRING }),
        ...(obj.SSEKMSKeyId && { SSEKMSKeyId: SENSITIVE_STRING }),
    });
})(PutObjectOutput || (PutObjectOutput = {}));
var PutObjectRequest;
(function (PutObjectRequest) {
    PutObjectRequest.filterSensitiveLog = (obj) => ({
        ...obj,
        ...(obj.SSECustomerKey && { SSECustomerKey: SENSITIVE_STRING }),
        ...(obj.SSEKMSEncryptionContext && { SSEKMSEncryptionContext: SENSITIVE_STRING }),
        ...(obj.SSEKMSKeyId && { SSEKMSKeyId: SENSITIVE_STRING }),
    });
})(PutObjectRequest || (PutObjectRequest = {}));
var PutObjectAclOutput;
(function (PutObjectAclOutput) {
    PutObjectAclOutput.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(PutObjectAclOutput || (PutObjectAclOutput = {}));
var PutObjectAclRequest;
(function (PutObjectAclRequest) {
    PutObjectAclRequest.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(PutObjectAclRequest || (PutObjectAclRequest = {}));
var PutObjectLegalHoldOutput;
(function (PutObjectLegalHoldOutput) {
    PutObjectLegalHoldOutput.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(PutObjectLegalHoldOutput || (PutObjectLegalHoldOutput = {}));
var PutObjectLegalHoldRequest;
(function (PutObjectLegalHoldRequest) {
    PutObjectLegalHoldRequest.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(PutObjectLegalHoldRequest || (PutObjectLegalHoldRequest = {}));
var PutObjectLockConfigurationOutput;
(function (PutObjectLockConfigurationOutput) {
    PutObjectLockConfigurationOutput.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(PutObjectLockConfigurationOutput || (PutObjectLockConfigurationOutput = {}));
var PutObjectLockConfigurationRequest;
(function (PutObjectLockConfigurationRequest) {
    PutObjectLockConfigurationRequest.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(PutObjectLockConfigurationRequest || (PutObjectLockConfigurationRequest = {}));
var PutObjectRetentionOutput;
(function (PutObjectRetentionOutput) {
    PutObjectRetentionOutput.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(PutObjectRetentionOutput || (PutObjectRetentionOutput = {}));
var PutObjectRetentionRequest;
(function (PutObjectRetentionRequest) {
    PutObjectRetentionRequest.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(PutObjectRetentionRequest || (PutObjectRetentionRequest = {}));
var PutObjectTaggingOutput;
(function (PutObjectTaggingOutput) {
    PutObjectTaggingOutput.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(PutObjectTaggingOutput || (PutObjectTaggingOutput = {}));
var PutObjectTaggingRequest;
(function (PutObjectTaggingRequest) {
    PutObjectTaggingRequest.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(PutObjectTaggingRequest || (PutObjectTaggingRequest = {}));
var PutPublicAccessBlockRequest;
(function (PutPublicAccessBlockRequest) {
    PutPublicAccessBlockRequest.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(PutPublicAccessBlockRequest || (PutPublicAccessBlockRequest = {}));
var ObjectAlreadyInActiveTierError;
(function (ObjectAlreadyInActiveTierError) {
    ObjectAlreadyInActiveTierError.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(ObjectAlreadyInActiveTierError || (ObjectAlreadyInActiveTierError = {}));
var RestoreObjectOutput;
(function (RestoreObjectOutput) {
    RestoreObjectOutput.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(RestoreObjectOutput || (RestoreObjectOutput = {}));
var GlacierJobParameters;
(function (GlacierJobParameters) {
    GlacierJobParameters.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(GlacierJobParameters || (GlacierJobParameters = {}));
var Encryption;
(function (Encryption) {
    Encryption.filterSensitiveLog = (obj) => ({
        ...obj,
        ...(obj.KMSKeyId && { KMSKeyId: SENSITIVE_STRING }),
    });
})(Encryption || (Encryption = {}));
var MetadataEntry;
(function (MetadataEntry) {
    MetadataEntry.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(MetadataEntry || (MetadataEntry = {}));
var S3Location;
(function (S3Location) {
    S3Location.filterSensitiveLog = (obj) => ({
        ...obj,
        ...(obj.Encryption && { Encryption: Encryption.filterSensitiveLog(obj.Encryption) }),
    });
})(S3Location || (S3Location = {}));
var OutputLocation;
(function (OutputLocation) {
    OutputLocation.filterSensitiveLog = (obj) => ({
        ...obj,
        ...(obj.S3 && { S3: S3Location.filterSensitiveLog(obj.S3) }),
    });
})(OutputLocation || (OutputLocation = {}));
var FileHeaderInfo;
(function (FileHeaderInfo) {
    FileHeaderInfo["IGNORE"] = "IGNORE";
    FileHeaderInfo["NONE"] = "NONE";
    FileHeaderInfo["USE"] = "USE";
})(FileHeaderInfo || (FileHeaderInfo = {}));
var CSVInput;
(function (CSVInput) {
    CSVInput.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(CSVInput || (CSVInput = {}));
var JSONType;
(function (JSONType) {
    JSONType["DOCUMENT"] = "DOCUMENT";
    JSONType["LINES"] = "LINES";
})(JSONType || (JSONType = {}));
var JSONInput;
(function (JSONInput) {
    JSONInput.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(JSONInput || (JSONInput = {}));
var ParquetInput;
(function (ParquetInput) {
    ParquetInput.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(ParquetInput || (ParquetInput = {}));
var InputSerialization;
(function (InputSerialization) {
    InputSerialization.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(InputSerialization || (InputSerialization = {}));
var QuoteFields;
(function (QuoteFields) {
    QuoteFields["ALWAYS"] = "ALWAYS";
    QuoteFields["ASNEEDED"] = "ASNEEDED";
})(QuoteFields || (QuoteFields = {}));
var CSVOutput;
(function (CSVOutput) {
    CSVOutput.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(CSVOutput || (CSVOutput = {}));
var JSONOutput;
(function (JSONOutput) {
    JSONOutput.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(JSONOutput || (JSONOutput = {}));
var OutputSerialization;
(function (OutputSerialization) {
    OutputSerialization.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(OutputSerialization || (OutputSerialization = {}));
var SelectParameters;
(function (SelectParameters) {
    SelectParameters.filterSensitiveLog = (obj) => ({
        ...obj,
    });
})(SelectParameters || (SelectParameters = {}));

var util = createCommonjsModule(function (module, exports) {

const nameStartChar = ':A-Za-z_\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD';
const nameChar = nameStartChar + '\\-.\\d\\u00B7\\u0300-\\u036F\\u203F-\\u2040';
const nameRegexp = '[' + nameStartChar + '][' + nameChar + ']*';
const regexName = new RegExp('^' + nameRegexp + '$');

const getAllMatches = function(string, regex) {
  const matches = [];
  let match = regex.exec(string);
  while (match) {
    const allmatches = [];
    const len = match.length;
    for (let index = 0; index < len; index++) {
      allmatches.push(match[index]);
    }
    matches.push(allmatches);
    match = regex.exec(string);
  }
  return matches;
};

const isName = function(string) {
  const match = regexName.exec(string);
  return !(match === null || typeof match === 'undefined');
};

exports.isExist = function(v) {
  return typeof v !== 'undefined';
};

exports.isEmptyObject = function(obj) {
  return Object.keys(obj).length === 0;
};

/**
 * Copy all the properties of a into b.
 * @param {*} target
 * @param {*} a
 */
exports.merge = function(target, a, arrayMode) {
  if (a) {
    const keys = Object.keys(a); // will return an array of own properties
    const len = keys.length; //don't make it inline
    for (let i = 0; i < len; i++) {
      if(arrayMode === 'strict'){
        target[keys[i]] = [ a[keys[i]] ];
      }else {
        target[keys[i]] = a[keys[i]];
      }
    }
  }
};
/* exports.merge =function (b,a){
  return Object.assign(b,a);
} */

exports.getValue = function(v) {
  if (exports.isExist(v)) {
    return v;
  } else {
    return '';
  }
};

// const fakeCall = function(a) {return a;};
// const fakeCallNoReturn = function() {};

exports.buildOptions = function(options, defaultOptions, props) {
  var newOptions = {};
  if (!options) {
    return defaultOptions; //if there are not options
  }

  for (let i = 0; i < props.length; i++) {
    if (options[props[i]] !== undefined) {
      newOptions[props[i]] = options[props[i]];
    } else {
      newOptions[props[i]] = defaultOptions[props[i]];
    }
  }
  return newOptions;
};

exports.isName = isName;
exports.getAllMatches = getAllMatches;
exports.nameRegexp = nameRegexp;
});

const convertToJson = function(node, options) {
  const jObj = {};

  //when no child node or attr is present
  if ((!node.child || util.isEmptyObject(node.child)) && (!node.attrsMap || util.isEmptyObject(node.attrsMap))) {
    return util.isExist(node.val) ? node.val : '';
  } else {
    //otherwise create a textnode if node has some text
    if (util.isExist(node.val)) {
      if (!(typeof node.val === 'string' && (node.val === '' || node.val === options.cdataPositionChar))) {
        if(options.arrayMode === "strict"){
          jObj[options.textNodeName] = [ node.val ];
        }else {
          jObj[options.textNodeName] = node.val;
        }
      }
    }
  }

  util.merge(jObj, node.attrsMap, options.arrayMode);

  const keys = Object.keys(node.child);
  for (let index = 0; index < keys.length; index++) {
    var tagname = keys[index];
    if (node.child[tagname] && node.child[tagname].length > 1) {
      jObj[tagname] = [];
      for (var tag in node.child[tagname]) {
        jObj[tagname].push(convertToJson(node.child[tagname][tag], options));
      }
    } else {
      if(options.arrayMode === true){
        const result = convertToJson(node.child[tagname][0], options);
        if(typeof result === 'object')
          jObj[tagname] = [ result ];
        else
          jObj[tagname] = result;
      }else if(options.arrayMode === "strict"){
        jObj[tagname] = [convertToJson(node.child[tagname][0], options) ];
      }else {
        jObj[tagname] = convertToJson(node.child[tagname][0], options);
      }
    }
  }

  //add value
  return jObj;
};

var convertToJson_1 = convertToJson;

var node2json = {
	convertToJson: convertToJson_1
};

var xmlNode = function(tagname, parent, val) {
  this.tagname = tagname;
  this.parent = parent;
  this.child = {}; //child tags
  this.attrsMap = {}; //attributes map
  this.val = val; //text only
  this.addChild = function(child) {
    if (Array.isArray(this.child[child.tagname])) {
      //already presents
      this.child[child.tagname].push(child);
    } else {
      this.child[child.tagname] = [child];
    }
  };
};

const buildOptions = util.buildOptions;

const regx =
  '<((!\\[CDATA\\[([\\s\\S]*?)(]]>))|((NAME:)?(NAME))([^>]*)>|((\\/)(NAME)\\s*>))([^<]*)'
  .replace(/NAME/g, util.nameRegexp);

//const tagsRegx = new RegExp("<(\\/?[\\w:\\-\._]+)([^>]*)>(\\s*"+cdataRegx+")*([^<]+)?","g");
//const tagsRegx = new RegExp("<(\\/?)((\\w*:)?([\\w:\\-\._]+))([^>]*)>([^<]*)("+cdataRegx+"([^<]*))*([^<]+)?","g");

//polyfill
if (!Number.parseInt && window.parseInt) {
  Number.parseInt = window.parseInt;
}
if (!Number.parseFloat && window.parseFloat) {
  Number.parseFloat = window.parseFloat;
}

const defaultOptions$1 = {
  attributeNamePrefix: '@_',
  attrNodeName: false,
  textNodeName: '#text',
  ignoreAttributes: true,
  ignoreNameSpace: false,
  allowBooleanAttributes: false, //a tag can have attributes without any value
  //ignoreRootElement : false,
  parseNodeValue: true,
  parseAttributeValue: false,
  arrayMode: false,
  trimValues: true, //Trim string values of tag and attributes
  cdataTagName: false,
  cdataPositionChar: '\\c',
  tagValueProcessor: function(a, tagName) {
    return a;
  },
  attrValueProcessor: function(a, attrName) {
    return a;
  },
  stopNodes: []
  //decodeStrict: false,
};

var defaultOptions_1 = defaultOptions$1;

const props = [
  'attributeNamePrefix',
  'attrNodeName',
  'textNodeName',
  'ignoreAttributes',
  'ignoreNameSpace',
  'allowBooleanAttributes',
  'parseNodeValue',
  'parseAttributeValue',
  'arrayMode',
  'trimValues',
  'cdataTagName',
  'cdataPositionChar',
  'tagValueProcessor',
  'attrValueProcessor',
  'parseTrueNumberOnly',
  'stopNodes'
];
var props_1 = props;

/**
 * Trim -> valueProcessor -> parse value
 * @param {string} tagName
 * @param {string} val
 * @param {object} options
 */
function processTagValue(tagName, val, options) {
  if (val) {
    if (options.trimValues) {
      val = val.trim();
    }
    val = options.tagValueProcessor(val, tagName);
    val = parseValue(val, options.parseNodeValue, options.parseTrueNumberOnly);
  }

  return val;
}

function resolveNameSpace(tagname, options) {
  if (options.ignoreNameSpace) {
    const tags = tagname.split(':');
    const prefix = tagname.charAt(0) === '/' ? '/' : '';
    if (tags[0] === 'xmlns') {
      return '';
    }
    if (tags.length === 2) {
      tagname = prefix + tags[1];
    }
  }
  return tagname;
}

function parseValue(val, shouldParse, parseTrueNumberOnly) {
  if (shouldParse && typeof val === 'string') {
    let parsed;
    if (val.trim() === '' || isNaN(val)) {
      parsed = val === 'true' ? true : val === 'false' ? false : val;
    } else {
      if (val.indexOf('0x') !== -1) {
        //support hexa decimal
        parsed = Number.parseInt(val, 16);
      } else if (val.indexOf('.') !== -1) {
        parsed = Number.parseFloat(val);
        val = val.replace(/\.?0+$/, "");
      } else {
        parsed = Number.parseInt(val, 10);
      }
      if (parseTrueNumberOnly) {
        parsed = String(parsed) === val ? parsed : val;
      }
    }
    return parsed;
  } else {
    if (util.isExist(val)) {
      return val;
    } else {
      return '';
    }
  }
}

//TODO: change regex to capture NS
//const attrsRegx = new RegExp("([\\w\\-\\.\\:]+)\\s*=\\s*(['\"])((.|\n)*?)\\2","gm");
const attrsRegx = new RegExp('([^\\s=]+)\\s*(=\\s*([\'"])(.*?)\\3)?', 'g');

function buildAttributesMap(attrStr, options) {
  if (!options.ignoreAttributes && typeof attrStr === 'string') {
    attrStr = attrStr.replace(/\r?\n/g, ' ');
    //attrStr = attrStr || attrStr.trim();

    const matches = util.getAllMatches(attrStr, attrsRegx);
    const len = matches.length; //don't make it inline
    const attrs = {};
    for (let i = 0; i < len; i++) {
      const attrName = resolveNameSpace(matches[i][1], options);
      if (attrName.length) {
        if (matches[i][4] !== undefined) {
          if (options.trimValues) {
            matches[i][4] = matches[i][4].trim();
          }
          matches[i][4] = options.attrValueProcessor(matches[i][4], attrName);
          attrs[options.attributeNamePrefix + attrName] = parseValue(
            matches[i][4],
            options.parseAttributeValue,
            options.parseTrueNumberOnly
          );
        } else if (options.allowBooleanAttributes) {
          attrs[options.attributeNamePrefix + attrName] = true;
        }
      }
    }
    if (!Object.keys(attrs).length) {
      return;
    }
    if (options.attrNodeName) {
      const attrCollection = {};
      attrCollection[options.attrNodeName] = attrs;
      return attrCollection;
    }
    return attrs;
  }
}

const getTraversalObj = function(xmlData, options) {
  xmlData = xmlData.replace(/(\r\n)|\n/, " ");
  options = buildOptions(options, defaultOptions$1, props);
  const xmlObj = new xmlNode('!xml');
  let currentNode = xmlObj;
  let textData = "";

//function match(xmlData){
  for(let i=0; i< xmlData.length; i++){
    const ch = xmlData[i];
    if(ch === '<'){
      if( xmlData[i+1] === '/') {//Closing Tag
        const closeIndex = findClosingIndex(xmlData, ">", i, "Closing Tag is not closed.");
        let tagName = xmlData.substring(i+2,closeIndex).trim();

        if(options.ignoreNameSpace){
          const colonIndex = tagName.indexOf(":");
          if(colonIndex !== -1){
            tagName = tagName.substr(colonIndex+1);
          }
        }

        /* if (currentNode.parent) {
          currentNode.parent.val = util.getValue(currentNode.parent.val) + '' + processTagValue2(tagName, textData , options);
        } */
        if(currentNode){
          if(currentNode.val){
            currentNode.val = util.getValue(currentNode.val) + '' + processTagValue(tagName, textData , options);
          }else {
            currentNode.val = processTagValue(tagName, textData , options);
          }
        }

        if (options.stopNodes.length && options.stopNodes.includes(currentNode.tagname)) {
          currentNode.child = [];
          if (currentNode.attrsMap == undefined) { currentNode.attrsMap = {};}
          currentNode.val = xmlData.substr(currentNode.startIndex + 1, i - currentNode.startIndex - 1);
        }
        currentNode = currentNode.parent;
        textData = "";
        i = closeIndex;
      } else if( xmlData[i+1] === '?') {
        i = findClosingIndex(xmlData, "?>", i, "Pi Tag is not closed.");
      } else if(xmlData.substr(i + 1, 3) === '!--') {
        i = findClosingIndex(xmlData, "-->", i, "Comment is not closed.");
      } else if( xmlData.substr(i + 1, 2) === '!D') {
        const closeIndex = findClosingIndex(xmlData, ">", i, "DOCTYPE is not closed.");
        const tagExp = xmlData.substring(i, closeIndex);
        if(tagExp.indexOf("[") >= 0){
          i = xmlData.indexOf("]>", i) + 1;
        }else {
          i = closeIndex;
        }
      }else if(xmlData.substr(i + 1, 2) === '![') {
        const closeIndex = findClosingIndex(xmlData, "]]>", i, "CDATA is not closed.") - 2;
        const tagExp = xmlData.substring(i + 9,closeIndex);

        //considerations
        //1. CDATA will always have parent node
        //2. A tag with CDATA is not a leaf node so it's value would be string type.
        if(textData){
          currentNode.val = util.getValue(currentNode.val) + '' + processTagValue(currentNode.tagname, textData , options);
          textData = "";
        }

        if (options.cdataTagName) {
          //add cdata node
          const childNode = new xmlNode(options.cdataTagName, currentNode, tagExp);
          currentNode.addChild(childNode);
          //for backtracking
          currentNode.val = util.getValue(currentNode.val) + options.cdataPositionChar;
          //add rest value to parent node
          if (tagExp) {
            childNode.val = tagExp;
          }
        } else {
          currentNode.val = (currentNode.val || '') + (tagExp || '');
        }

        i = closeIndex + 2;
      }else {//Opening tag
        const result = closingIndexForOpeningTag(xmlData, i+1);
        let tagExp = result.data;
        const closeIndex = result.index;
        const separatorIndex = tagExp.indexOf(" ");
        let tagName = tagExp;
        if(separatorIndex !== -1){
          tagName = tagExp.substr(0, separatorIndex).trimRight();
          tagExp = tagExp.substr(separatorIndex + 1);
        }

        if(options.ignoreNameSpace){
          const colonIndex = tagName.indexOf(":");
          if(colonIndex !== -1){
            tagName = tagName.substr(colonIndex+1);
          }
        }

        //save text to parent node
        if (currentNode && textData) {
          if(currentNode.tagname !== '!xml'){
            currentNode.val = util.getValue(currentNode.val) + '' + processTagValue( currentNode.tagname, textData, options);
          }
        }

        if(tagExp.length > 0 && tagExp.lastIndexOf("/") === tagExp.length - 1){//selfClosing tag

          if(tagName[tagName.length - 1] === "/"){ //remove trailing '/'
            tagName = tagName.substr(0, tagName.length - 1);
            tagExp = tagName;
          }else {
            tagExp = tagExp.substr(0, tagExp.length - 1);
          }

          const childNode = new xmlNode(tagName, currentNode, '');
          if(tagName !== tagExp){
            childNode.attrsMap = buildAttributesMap(tagExp, options);
          }
          currentNode.addChild(childNode);
        }else {//opening tag

          const childNode = new xmlNode( tagName, currentNode );
          if (options.stopNodes.length && options.stopNodes.includes(childNode.tagname)) {
            childNode.startIndex=closeIndex;
          }
          if(tagName !== tagExp){
            childNode.attrsMap = buildAttributesMap(tagExp, options);
          }
          currentNode.addChild(childNode);
          currentNode = childNode;
        }
        textData = "";
        i = closeIndex;
      }
    }else {
      textData += xmlData[i];
    }
  }
  return xmlObj;
};

function closingIndexForOpeningTag(data, i){
  let attrBoundary;
  let tagExp = "";
  for (let index = i; index < data.length; index++) {
    let ch = data[index];
    if (attrBoundary) {
        if (ch === attrBoundary) attrBoundary = "";//reset
    } else if (ch === '"' || ch === "'") {
        attrBoundary = ch;
    } else if (ch === '>') {
        return {
          data: tagExp,
          index: index
        }
    } else if (ch === '\t') {
      ch = " ";
    }
    tagExp += ch;
  }
}

function findClosingIndex(xmlData, str, i, errMsg){
  const closingIndex = xmlData.indexOf(str, i);
  if(closingIndex === -1){
    throw new Error(errMsg)
  }else {
    return closingIndex + str.length - 1;
  }
}

var getTraversalObj_1 = getTraversalObj;

var xmlstr2xmlnode = {
	defaultOptions: defaultOptions_1,
	props: props_1,
	getTraversalObj: getTraversalObj_1
};

const defaultOptions$2 = {
  allowBooleanAttributes: false, //A tag can have attributes without any value
};

const props$1 = ['allowBooleanAttributes'];

//const tagsPattern = new RegExp("<\\/?([\\w:\\-_\.]+)\\s*\/?>","g");
var validate$1 = function (xmlData, options) {
  options = util.buildOptions(options, defaultOptions$2, props$1);

  //xmlData = xmlData.replace(/(\r\n|\n|\r)/gm,"");//make it single line
  //xmlData = xmlData.replace(/(^\s*<\?xml.*?\?>)/g,"");//Remove XML starting tag
  //xmlData = xmlData.replace(/(<!DOCTYPE[\s\w\"\.\/\-\:]+(\[.*\])*\s*>)/g,"");//Remove DOCTYPE
  const tags = [];
  let tagFound = false;

  //indicates that the root tag has been closed (aka. depth 0 has been reached)
  let reachedRoot = false;

  if (xmlData[0] === '\ufeff') {
    // check for byte order mark (BOM)
    xmlData = xmlData.substr(1);
  }

  for (let i = 0; i < xmlData.length; i++) {
    if (xmlData[i] === '<') {
      //starting of tag
      //read until you reach to '>' avoiding any '>' in attribute value

      i++;
      if (xmlData[i] === '?') {
        i = readPI(xmlData, ++i);
        if (i.err) {
          return i;
        }
      } else if (xmlData[i] === '!') {
        i = readCommentAndCDATA(xmlData, i);
        continue;
      } else {
        let closingTag = false;
        if (xmlData[i] === '/') {
          //closing tag
          closingTag = true;
          i++;
        }
        //read tagname
        let tagName = '';
        for (; i < xmlData.length &&
          xmlData[i] !== '>' &&
          xmlData[i] !== ' ' &&
          xmlData[i] !== '\t' &&
          xmlData[i] !== '\n' &&
          xmlData[i] !== '\r'; i++
        ) {
          tagName += xmlData[i];
        }
        tagName = tagName.trim();
        //console.log(tagName);

        if (tagName[tagName.length - 1] === '/') {
          //self closing tag without attributes
          tagName = tagName.substring(0, tagName.length - 1);
          //continue;
          i--;
        }
        if (!validateTagName(tagName)) {
          let msg;
          if (tagName.trim().length === 0) {
            msg = "There is an unnecessary space between tag name and backward slash '</ ..'.";
          } else {
            msg = "Tag '"+tagName+"' is an invalid name.";
          }
          return getErrorObject('InvalidTag', msg, getLineNumberForPosition(xmlData, i));
        }

        const result = readAttributeStr(xmlData, i);
        if (result === false) {
          return getErrorObject('InvalidAttr', "Attributes for '"+tagName+"' have open quote.", getLineNumberForPosition(xmlData, i));
        }
        let attrStr = result.value;
        i = result.index;

        if (attrStr[attrStr.length - 1] === '/') {
          //self closing tag
          attrStr = attrStr.substring(0, attrStr.length - 1);
          const isValid = validateAttributeString(attrStr, options);
          if (isValid === true) {
            tagFound = true;
            //continue; //text may presents after self closing tag
          } else {
            //the result from the nested function returns the position of the error within the attribute
            //in order to get the 'true' error line, we need to calculate the position where the attribute begins (i - attrStr.length) and then add the position within the attribute
            //this gives us the absolute index in the entire xml, which we can use to find the line at last
            return getErrorObject(isValid.err.code, isValid.err.msg, getLineNumberForPosition(xmlData, i - attrStr.length + isValid.err.line));
          }
        } else if (closingTag) {
          if (!result.tagClosed) {
            return getErrorObject('InvalidTag', "Closing tag '"+tagName+"' doesn't have proper closing.", getLineNumberForPosition(xmlData, i));
          } else if (attrStr.trim().length > 0) {
            return getErrorObject('InvalidTag', "Closing tag '"+tagName+"' can't have attributes or invalid starting.", getLineNumberForPosition(xmlData, i));
          } else {
            const otg = tags.pop();
            if (tagName !== otg) {
              return getErrorObject('InvalidTag', "Closing tag '"+otg+"' is expected inplace of '"+tagName+"'.", getLineNumberForPosition(xmlData, i));
            }

            //when there are no more tags, we reached the root level.
            if (tags.length == 0) {
              reachedRoot = true;
            }
          }
        } else {
          const isValid = validateAttributeString(attrStr, options);
          if (isValid !== true) {
            //the result from the nested function returns the position of the error within the attribute
            //in order to get the 'true' error line, we need to calculate the position where the attribute begins (i - attrStr.length) and then add the position within the attribute
            //this gives us the absolute index in the entire xml, which we can use to find the line at last
            return getErrorObject(isValid.err.code, isValid.err.msg, getLineNumberForPosition(xmlData, i - attrStr.length + isValid.err.line));
          }

          //if the root level has been reached before ...
          if (reachedRoot === true) {
            return getErrorObject('InvalidXml', 'Multiple possible root nodes found.', getLineNumberForPosition(xmlData, i));
          } else {
            tags.push(tagName);
          }
          tagFound = true;
        }

        //skip tag text value
        //It may include comments and CDATA value
        for (i++; i < xmlData.length; i++) {
          if (xmlData[i] === '<') {
            if (xmlData[i + 1] === '!') {
              //comment or CADATA
              i++;
              i = readCommentAndCDATA(xmlData, i);
              continue;
            } else {
              break;
            }
          } else if (xmlData[i] === '&') {
            const afterAmp = validateAmpersand(xmlData, i);
            if (afterAmp == -1)
              return getErrorObject('InvalidChar', "char '&' is not expected.", getLineNumberForPosition(xmlData, i));
            i = afterAmp;
          }
        } //end of reading tag text value
        if (xmlData[i] === '<') {
          i--;
        }
      }
    } else {
      if (xmlData[i] === ' ' || xmlData[i] === '\t' || xmlData[i] === '\n' || xmlData[i] === '\r') {
        continue;
      }
      return getErrorObject('InvalidChar', "char '"+xmlData[i]+"' is not expected.", getLineNumberForPosition(xmlData, i));
    }
  }

  if (!tagFound) {
    return getErrorObject('InvalidXml', 'Start tag expected.', 1);
  } else if (tags.length > 0) {
    return getErrorObject('InvalidXml', "Invalid '"+JSON.stringify(tags, null, 4).replace(/\r?\n/g, '')+"' found.", 1);
  }

  return true;
};

/**
 * Read Processing insstructions and skip
 * @param {*} xmlData
 * @param {*} i
 */
function readPI(xmlData, i) {
  var start = i;
  for (; i < xmlData.length; i++) {
    if (xmlData[i] == '?' || xmlData[i] == ' ') {
      //tagname
      var tagname = xmlData.substr(start, i - start);
      if (i > 5 && tagname === 'xml') {
        return getErrorObject('InvalidXml', 'XML declaration allowed only at the start of the document.', getLineNumberForPosition(xmlData, i));
      } else if (xmlData[i] == '?' && xmlData[i + 1] == '>') {
        //check if valid attribut string
        i++;
        break;
      } else {
        continue;
      }
    }
  }
  return i;
}

function readCommentAndCDATA(xmlData, i) {
  if (xmlData.length > i + 5 && xmlData[i + 1] === '-' && xmlData[i + 2] === '-') {
    //comment
    for (i += 3; i < xmlData.length; i++) {
      if (xmlData[i] === '-' && xmlData[i + 1] === '-' && xmlData[i + 2] === '>') {
        i += 2;
        break;
      }
    }
  } else if (
    xmlData.length > i + 8 &&
    xmlData[i + 1] === 'D' &&
    xmlData[i + 2] === 'O' &&
    xmlData[i + 3] === 'C' &&
    xmlData[i + 4] === 'T' &&
    xmlData[i + 5] === 'Y' &&
    xmlData[i + 6] === 'P' &&
    xmlData[i + 7] === 'E'
  ) {
    let angleBracketsCount = 1;
    for (i += 8; i < xmlData.length; i++) {
      if (xmlData[i] === '<') {
        angleBracketsCount++;
      } else if (xmlData[i] === '>') {
        angleBracketsCount--;
        if (angleBracketsCount === 0) {
          break;
        }
      }
    }
  } else if (
    xmlData.length > i + 9 &&
    xmlData[i + 1] === '[' &&
    xmlData[i + 2] === 'C' &&
    xmlData[i + 3] === 'D' &&
    xmlData[i + 4] === 'A' &&
    xmlData[i + 5] === 'T' &&
    xmlData[i + 6] === 'A' &&
    xmlData[i + 7] === '['
  ) {
    for (i += 8; i < xmlData.length; i++) {
      if (xmlData[i] === ']' && xmlData[i + 1] === ']' && xmlData[i + 2] === '>') {
        i += 2;
        break;
      }
    }
  }

  return i;
}

var doubleQuote = '"';
var singleQuote = "'";

/**
 * Keep reading xmlData until '<' is found outside the attribute value.
 * @param {string} xmlData
 * @param {number} i
 */
function readAttributeStr(xmlData, i) {
  let attrStr = '';
  let startChar = '';
  let tagClosed = false;
  for (; i < xmlData.length; i++) {
    if (xmlData[i] === doubleQuote || xmlData[i] === singleQuote) {
      if (startChar === '') {
        startChar = xmlData[i];
      } else if (startChar !== xmlData[i]) {
        //if vaue is enclosed with double quote then single quotes are allowed inside the value and vice versa
        continue;
      } else {
        startChar = '';
      }
    } else if (xmlData[i] === '>') {
      if (startChar === '') {
        tagClosed = true;
        break;
      }
    }
    attrStr += xmlData[i];
  }
  if (startChar !== '') {
    return false;
  }

  return {
    value: attrStr,
    index: i,
    tagClosed: tagClosed
  };
}

/**
 * Select all the attributes whether valid or invalid.
 */
const validAttrStrRegxp = new RegExp('(\\s*)([^\\s=]+)(\\s*=)?(\\s*([\'"])(([\\s\\S])*?)\\5)?', 'g');

//attr, ="sd", a="amit's", a="sd"b="saf", ab  cd=""

function validateAttributeString(attrStr, options) {
  //console.log("start:"+attrStr+":end");

  //if(attrStr.trim().length === 0) return true; //empty string

  const matches = util.getAllMatches(attrStr, validAttrStrRegxp);
  const attrNames = {};

  for (let i = 0; i < matches.length; i++) {
    if (matches[i][1].length === 0) {
      //nospace before attribute name: a="sd"b="saf"
      return getErrorObject('InvalidAttr', "Attribute '"+matches[i][2]+"' has no space in starting.", getPositionFromMatch(attrStr, matches[i][0]))
    } else if (matches[i][3] === undefined && !options.allowBooleanAttributes) {
      //independent attribute: ab
      return getErrorObject('InvalidAttr', "boolean attribute '"+matches[i][2]+"' is not allowed.", getPositionFromMatch(attrStr, matches[i][0]));
    }
    /* else if(matches[i][6] === undefined){//attribute without value: ab=
                    return { err: { code:"InvalidAttr",msg:"attribute " + matches[i][2] + " has no value assigned."}};
                } */
    const attrName = matches[i][2];
    if (!validateAttrName(attrName)) {
      return getErrorObject('InvalidAttr', "Attribute '"+attrName+"' is an invalid name.", getPositionFromMatch(attrStr, matches[i][0]));
    }
    if (!attrNames.hasOwnProperty(attrName)) {
      //check for duplicate attribute.
      attrNames[attrName] = 1;
    } else {
      return getErrorObject('InvalidAttr', "Attribute '"+attrName+"' is repeated.", getPositionFromMatch(attrStr, matches[i][0]));
    }
  }

  return true;
}

function validateNumberAmpersand(xmlData, i) {
  let re = /\d/;
  if (xmlData[i] === 'x') {
    i++;
    re = /[\da-fA-F]/;
  }
  for (; i < xmlData.length; i++) {
    if (xmlData[i] === ';')
      return i;
    if (!xmlData[i].match(re))
      break;
  }
  return -1;
}

function validateAmpersand(xmlData, i) {
  // https://www.w3.org/TR/xml/#dt-charref
  i++;
  if (xmlData[i] === ';')
    return -1;
  if (xmlData[i] === '#') {
    i++;
    return validateNumberAmpersand(xmlData, i);
  }
  let count = 0;
  for (; i < xmlData.length; i++, count++) {
    if (xmlData[i].match(/\w/) && count < 20)
      continue;
    if (xmlData[i] === ';')
      break;
    return -1;
  }
  return i;
}

function getErrorObject(code, message, lineNumber) {
  return {
    err: {
      code: code,
      msg: message,
      line: lineNumber,
    },
  };
}

function validateAttrName(attrName) {
  return util.isName(attrName);
}

// const startsWithXML = /^xml/i;

function validateTagName(tagname) {
  return util.isName(tagname) /* && !tagname.match(startsWithXML) */;
}

//this function returns the line number for the character at the given index
function getLineNumberForPosition(xmlData, index) {
  var lines = xmlData.substring(0, index).split(/\r?\n/);
  return lines.length;
}

//this function returns the position of the last character of match within attrStr
function getPositionFromMatch(attrStr, match) {
  return attrStr.indexOf(match) + match.length;
}

var validator = {
	validate: validate$1
};

const char = function(a) {
  return String.fromCharCode(a);
};

const chars = {
  nilChar: char(176),
  missingChar: char(201),
  nilPremitive: char(175),
  missingPremitive: char(200),

  emptyChar: char(178),
  emptyValue: char(177), //empty Premitive

  boundryChar: char(179),

  objStart: char(198),
  arrStart: char(204),
  arrayEnd: char(185),
};

const charsArr = [
  chars.nilChar,
  chars.nilPremitive,
  chars.missingChar,
  chars.missingPremitive,
  chars.boundryChar,
  chars.emptyChar,
  chars.emptyValue,
  chars.arrayEnd,
  chars.objStart,
  chars.arrStart,
];

const _e = function(node, e_schema, options) {
  if (typeof e_schema === 'string') {
    //premitive
    if (node && node[0] && node[0].val !== undefined) {
      return getValue(node[0].val);
    } else {
      return getValue(node);
    }
  } else {
    const hasValidData = hasData(node);
    if (hasValidData === true) {
      let str = '';
      if (Array.isArray(e_schema)) {
        //attributes can't be repeated. hence check in children tags only
        str += chars.arrStart;
        const itemSchema = e_schema[0];
        //var itemSchemaType = itemSchema;
        const arr_len = node.length;

        if (typeof itemSchema === 'string') {
          for (let arr_i = 0; arr_i < arr_len; arr_i++) {
            const r = getValue(node[arr_i].val);
            str = processValue(str, r);
          }
        } else {
          for (let arr_i = 0; arr_i < arr_len; arr_i++) {
            const r = _e(node[arr_i], itemSchema, options);
            str = processValue(str, r);
          }
        }
        str += chars.arrayEnd; //indicates that next item is not array item
      } else {
        //object
        str += chars.objStart;
        const keys = Object.keys(e_schema);
        if (Array.isArray(node)) {
          node = node[0];
        }
        for (let i in keys) {
          const key = keys[i];
          //a property defined in schema can be present either in attrsMap or children tags
          //options.textNodeName will not present in both maps, take it's value from val
          //options.attrNodeName will be present in attrsMap
          let r;
          if (!options.ignoreAttributes && node.attrsMap && node.attrsMap[key]) {
            r = _e(node.attrsMap[key], e_schema[key], options);
          } else if (key === options.textNodeName) {
            r = _e(node.val, e_schema[key], options);
          } else {
            r = _e(node.child[key], e_schema[key], options);
          }
          str = processValue(str, r);
        }
      }
      return str;
    } else {
      return hasValidData;
    }
  }
};

const getValue = function(a /*, type*/) {
  switch (a) {
    case undefined:
      return chars.missingPremitive;
    case null:
      return chars.nilPremitive;
    case '':
      return chars.emptyValue;
    default:
      return a;
  }
};

const processValue = function(str, r) {
  if (!isAppChar(r[0]) && !isAppChar(str[str.length - 1])) {
    str += chars.boundryChar;
  }
  return str + r;
};

const isAppChar = function(ch) {
  return charsArr.indexOf(ch) !== -1;
};

function hasData(jObj) {
  if (jObj === undefined) {
    return chars.missingChar;
  } else if (jObj === null) {
    return chars.nilChar;
  } else if (
    jObj.child &&
    Object.keys(jObj.child).length === 0 &&
    (!jObj.attrsMap || Object.keys(jObj.attrsMap).length === 0)
  ) {
    return chars.emptyChar;
  } else {
    return true;
  }
}


const buildOptions$1 = util.buildOptions;

const convert2nimn = function(node, e_schema, options) {
  options = buildOptions$1(options, xmlstr2xmlnode.defaultOptions, xmlstr2xmlnode.props);
  return _e(node, e_schema, options);
};

var convert2nimn_1 = convert2nimn;

var nimndata = {
	convert2nimn: convert2nimn_1
};

const buildOptions$2 = util.buildOptions;


//TODO: do it later
const convertToJsonString = function(node, options) {
  options = buildOptions$2(options, xmlstr2xmlnode.defaultOptions, xmlstr2xmlnode.props);

  options.indentBy = options.indentBy || '';
  return _cToJsonStr(node, options);
};

const _cToJsonStr = function(node, options, level) {
  let jObj = '{';

  //traver through all the children
  const keys = Object.keys(node.child);

  for (let index = 0; index < keys.length; index++) {
    var tagname = keys[index];
    if (node.child[tagname] && node.child[tagname].length > 1) {
      jObj += '"' + tagname + '" : [ ';
      for (var tag in node.child[tagname]) {
        jObj += _cToJsonStr(node.child[tagname][tag], options) + ' , ';
      }
      jObj = jObj.substr(0, jObj.length - 1) + ' ] '; //remove extra comma in last
    } else {
      jObj += '"' + tagname + '" : ' + _cToJsonStr(node.child[tagname][0], options) + ' ,';
    }
  }
  util.merge(jObj, node.attrsMap);
  //add attrsMap as new children
  if (util.isEmptyObject(jObj)) {
    return util.isExist(node.val) ? node.val : '';
  } else {
    if (util.isExist(node.val)) {
      if (!(typeof node.val === 'string' && (node.val === '' || node.val === options.cdataPositionChar))) {
        jObj += '"' + options.textNodeName + '" : ' + stringval(node.val);
      }
    }
  }
  //add value
  if (jObj[jObj.length - 1] === ',') {
    jObj = jObj.substr(0, jObj.length - 2);
  }
  return jObj + '}';
};

function stringval(v) {
  if (v === true || v === false || !isNaN(v)) {
    return v;
  } else {
    return '"' + v + '"';
  }
}

var convertToJsonString_1 = convertToJsonString;

var node2json_str = {
	convertToJsonString: convertToJsonString_1
};

//parse Empty Node as self closing node
const buildOptions$3 = util.buildOptions;

const defaultOptions$3 = {
  attributeNamePrefix: '@_',
  attrNodeName: false,
  textNodeName: '#text',
  ignoreAttributes: true,
  cdataTagName: false,
  cdataPositionChar: '\\c',
  format: false,
  indentBy: '  ',
  supressEmptyNode: false,
  tagValueProcessor: function(a) {
    return a;
  },
  attrValueProcessor: function(a) {
    return a;
  },
};

const props$2 = [
  'attributeNamePrefix',
  'attrNodeName',
  'textNodeName',
  'ignoreAttributes',
  'cdataTagName',
  'cdataPositionChar',
  'format',
  'indentBy',
  'supressEmptyNode',
  'tagValueProcessor',
  'attrValueProcessor',
];

function Parser(options) {
  this.options = buildOptions$3(options, defaultOptions$3, props$2);
  if (this.options.ignoreAttributes || this.options.attrNodeName) {
    this.isAttribute = function(/*a*/) {
      return false;
    };
  } else {
    this.attrPrefixLen = this.options.attributeNamePrefix.length;
    this.isAttribute = isAttribute;
  }
  if (this.options.cdataTagName) {
    this.isCDATA = isCDATA;
  } else {
    this.isCDATA = function(/*a*/) {
      return false;
    };
  }
  this.replaceCDATAstr = replaceCDATAstr;
  this.replaceCDATAarr = replaceCDATAarr;

  if (this.options.format) {
    this.indentate = indentate;
    this.tagEndChar = '>\n';
    this.newLine = '\n';
  } else {
    this.indentate = function() {
      return '';
    };
    this.tagEndChar = '>';
    this.newLine = '';
  }

  if (this.options.supressEmptyNode) {
    this.buildTextNode = buildEmptyTextNode;
    this.buildObjNode = buildEmptyObjNode;
  } else {
    this.buildTextNode = buildTextValNode;
    this.buildObjNode = buildObjectNode;
  }

  this.buildTextValNode = buildTextValNode;
  this.buildObjectNode = buildObjectNode;
}

Parser.prototype.parse = function(jObj) {
  return this.j2x(jObj, 0).val;
};

Parser.prototype.j2x = function(jObj, level) {
  let attrStr = '';
  let val = '';
  const keys = Object.keys(jObj);
  const len = keys.length;
  for (let i = 0; i < len; i++) {
    const key = keys[i];
    if (typeof jObj[key] === 'undefined') ; else if (jObj[key] === null) {
      val += this.indentate(level) + '<' + key + '/' + this.tagEndChar;
    } else if (jObj[key] instanceof Date) {
      val += this.buildTextNode(jObj[key], key, '', level);
    } else if (typeof jObj[key] !== 'object') {
      //premitive type
      const attr = this.isAttribute(key);
      if (attr) {
        attrStr += ' ' + attr + '="' + this.options.attrValueProcessor('' + jObj[key]) + '"';
      } else if (this.isCDATA(key)) {
        if (jObj[this.options.textNodeName]) {
          val += this.replaceCDATAstr(jObj[this.options.textNodeName], jObj[key]);
        } else {
          val += this.replaceCDATAstr('', jObj[key]);
        }
      } else {
        //tag value
        if (key === this.options.textNodeName) {
          if (jObj[this.options.cdataTagName]) ; else {
            val += this.options.tagValueProcessor('' + jObj[key]);
          }
        } else {
          val += this.buildTextNode(jObj[key], key, '', level);
        }
      }
    } else if (Array.isArray(jObj[key])) {
      //repeated nodes
      if (this.isCDATA(key)) {
        val += this.indentate(level);
        if (jObj[this.options.textNodeName]) {
          val += this.replaceCDATAarr(jObj[this.options.textNodeName], jObj[key]);
        } else {
          val += this.replaceCDATAarr('', jObj[key]);
        }
      } else {
        //nested nodes
        const arrLen = jObj[key].length;
        for (let j = 0; j < arrLen; j++) {
          const item = jObj[key][j];
          if (typeof item === 'undefined') ; else if (item === null) {
            val += this.indentate(level) + '<' + key + '/' + this.tagEndChar;
          } else if (typeof item === 'object') {
            const result = this.j2x(item, level + 1);
            val += this.buildObjNode(result.val, key, result.attrStr, level);
          } else {
            val += this.buildTextNode(item, key, '', level);
          }
        }
      }
    } else {
      //nested node
      if (this.options.attrNodeName && key === this.options.attrNodeName) {
        const Ks = Object.keys(jObj[key]);
        const L = Ks.length;
        for (let j = 0; j < L; j++) {
          attrStr += ' ' + Ks[j] + '="' + this.options.attrValueProcessor('' + jObj[key][Ks[j]]) + '"';
        }
      } else {
        const result = this.j2x(jObj[key], level + 1);
        val += this.buildObjNode(result.val, key, result.attrStr, level);
      }
    }
  }
  return {attrStr: attrStr, val: val};
};

function replaceCDATAstr(str, cdata) {
  str = this.options.tagValueProcessor('' + str);
  if (this.options.cdataPositionChar === '' || str === '') {
    return str + '<![CDATA[' + cdata + ']]' + this.tagEndChar;
  } else {
    return str.replace(this.options.cdataPositionChar, '<![CDATA[' + cdata + ']]' + this.tagEndChar);
  }
}

function replaceCDATAarr(str, cdata) {
  str = this.options.tagValueProcessor('' + str);
  if (this.options.cdataPositionChar === '' || str === '') {
    return str + '<![CDATA[' + cdata.join(']]><![CDATA[') + ']]' + this.tagEndChar;
  } else {
    for (let v in cdata) {
      str = str.replace(this.options.cdataPositionChar, '<![CDATA[' + cdata[v] + ']]>');
    }
    return str + this.newLine;
  }
}

function buildObjectNode(val, key, attrStr, level) {
  if (attrStr && !val.includes('<')) {
    return (
      this.indentate(level) +
      '<' +
      key +
      attrStr +
      '>' +
      val +
      //+ this.newLine
      // + this.indentate(level)
      '</' +
      key +
      this.tagEndChar
    );
  } else {
    return (
      this.indentate(level) +
      '<' +
      key +
      attrStr +
      this.tagEndChar +
      val +
      //+ this.newLine
      this.indentate(level) +
      '</' +
      key +
      this.tagEndChar
    );
  }
}

function buildEmptyObjNode(val, key, attrStr, level) {
  if (val !== '') {
    return this.buildObjectNode(val, key, attrStr, level);
  } else {
    return this.indentate(level) + '<' + key + attrStr + '/' + this.tagEndChar;
    //+ this.newLine
  }
}

function buildTextValNode(val, key, attrStr, level) {
  return (
    this.indentate(level) +
    '<' +
    key +
    attrStr +
    '>' +
    this.options.tagValueProcessor(val) +
    '</' +
    key +
    this.tagEndChar
  );
}

function buildEmptyTextNode(val, key, attrStr, level) {
  if (val !== '') {
    return this.buildTextValNode(val, key, attrStr, level);
  } else {
    return this.indentate(level) + '<' + key + attrStr + '/' + this.tagEndChar;
  }
}

function indentate(level) {
  return this.options.indentBy.repeat(level);
}

function isAttribute(name /*, options*/) {
  if (name.startsWith(this.options.attributeNamePrefix)) {
    return name.substr(this.attrPrefixLen);
  } else {
    return false;
  }
}

function isCDATA(name) {
  return name === this.options.cdataTagName;
}

//formatting
//indentation
//\n after each closing or self closing tag

var json2xml = Parser;

var parser = createCommonjsModule(function (module, exports) {



const x2xmlnode = xmlstr2xmlnode;
const buildOptions = util.buildOptions;


exports.parse = function(xmlData, options, validationOption) {
  if( validationOption){
    if(validationOption === true) validationOption = {};
    
    const result = validator.validate(xmlData, validationOption);
    if (result !== true) {
      throw Error( result.err.msg)
    }
  }
  options = buildOptions(options, x2xmlnode.defaultOptions, x2xmlnode.props);
  const traversableObj = xmlstr2xmlnode.getTraversalObj(xmlData, options);
  //print(traversableObj, "  ");
  return node2json.convertToJson(traversableObj, options);
};
exports.convertTonimn = nimndata.convert2nimn;
exports.getTraversalObj = xmlstr2xmlnode.getTraversalObj;
exports.convertToJson = node2json.convertToJson;
exports.convertToJsonString = node2json_str.convertToJsonString;
exports.validate = validator.validate;
exports.j2xParser = json2xml;
exports.parseToNimn = function(xmlData, schema, options) {
  return exports.convertTonimn(exports.getTraversalObj(xmlData, options), schema, options);
};
});

const serializeAws_restXmlGetObjectCommand = async (input, context) => {
    const headers = {
        "Content-Type": "",
        ...(isSerializableHeaderValue(input.SSECustomerKey) && {
            "x-amz-server-side-encryption-customer-key": input.SSECustomerKey,
        }),
        ...(isSerializableHeaderValue(input.SSECustomerAlgorithm) && {
            "x-amz-server-side-encryption-customer-algorithm": input.SSECustomerAlgorithm,
        }),
        ...(isSerializableHeaderValue(input.SSECustomerKeyMD5) && {
            "x-amz-server-side-encryption-customer-key-MD5": input.SSECustomerKeyMD5,
        }),
        ...(isSerializableHeaderValue(input.RequestPayer) && { "x-amz-request-payer": input.RequestPayer }),
        ...(isSerializableHeaderValue(input.ExpectedBucketOwner) && {
            "x-amz-expected-bucket-owner": input.ExpectedBucketOwner,
        }),
        ...(isSerializableHeaderValue(input.IfUnmodifiedSince) && {
            "If-Unmodified-Since": dateToUtcString(input.IfUnmodifiedSince).toString(),
        }),
        ...(isSerializableHeaderValue(input.IfModifiedSince) && {
            "If-Modified-Since": dateToUtcString(input.IfModifiedSince).toString(),
        }),
        ...(isSerializableHeaderValue(input.IfNoneMatch) && { "If-None-Match": input.IfNoneMatch }),
        ...(isSerializableHeaderValue(input.IfMatch) && { "If-Match": input.IfMatch }),
        ...(isSerializableHeaderValue(input.Range) && { Range: input.Range }),
    };
    let resolvedPath = "/{Bucket}/{Key+}";
    if (input.Bucket !== undefined) {
        const labelValue = input.Bucket;
        if (labelValue.length <= 0) {
            throw new Error("Empty value provided for input HTTP label: Bucket.");
        }
        resolvedPath = resolvedPath.replace("{Bucket}", extendedEncodeURIComponent(labelValue));
    }
    else {
        throw new Error("No value provided for input HTTP label: Bucket.");
    }
    if (input.Key !== undefined) {
        const labelValue = input.Key;
        if (labelValue.length <= 0) {
            throw new Error("Empty value provided for input HTTP label: Key.");
        }
        resolvedPath = resolvedPath.replace("{Key+}", labelValue
            .split("/")
            .map((segment) => extendedEncodeURIComponent(segment))
            .join("/"));
    }
    else {
        throw new Error("No value provided for input HTTP label: Key.");
    }
    const query = {
        "x-id": "GetObject",
        ...(input.ResponseContentEncoding !== undefined && { "response-content-encoding": input.ResponseContentEncoding }),
        ...(input.ResponseCacheControl !== undefined && { "response-cache-control": input.ResponseCacheControl }),
        ...(input.ResponseContentLanguage !== undefined && { "response-content-language": input.ResponseContentLanguage }),
        ...(input.ResponseContentDisposition !== undefined && {
            "response-content-disposition": input.ResponseContentDisposition,
        }),
        ...(input.PartNumber !== undefined && { partNumber: input.PartNumber.toString() }),
        ...(input.VersionId !== undefined && { versionId: input.VersionId }),
        ...(input.ResponseExpires !== undefined && {
            "response-expires": (input.ResponseExpires.toISOString().split(".")[0] + "Z").toString(),
        }),
        ...(input.ResponseContentType !== undefined && { "response-content-type": input.ResponseContentType }),
    };
    let body;
    const { hostname, protocol = "https", port } = await context.endpoint();
    return new HttpRequest({
        protocol,
        hostname,
        port,
        method: "GET",
        headers,
        path: resolvedPath,
        query,
        body,
    });
};
const deserializeAws_restXmlGetObjectCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return deserializeAws_restXmlGetObjectCommandError(output, context);
    }
    const contents = {
        $metadata: deserializeMetadata(output),
        AcceptRanges: undefined,
        Body: undefined,
        CacheControl: undefined,
        ContentDisposition: undefined,
        ContentEncoding: undefined,
        ContentLanguage: undefined,
        ContentLength: undefined,
        ContentRange: undefined,
        ContentType: undefined,
        DeleteMarker: undefined,
        ETag: undefined,
        Expiration: undefined,
        Expires: undefined,
        LastModified: undefined,
        Metadata: undefined,
        MissingMeta: undefined,
        ObjectLockLegalHoldStatus: undefined,
        ObjectLockMode: undefined,
        ObjectLockRetainUntilDate: undefined,
        PartsCount: undefined,
        ReplicationStatus: undefined,
        RequestCharged: undefined,
        Restore: undefined,
        SSECustomerAlgorithm: undefined,
        SSECustomerKeyMD5: undefined,
        SSEKMSKeyId: undefined,
        ServerSideEncryption: undefined,
        StorageClass: undefined,
        TagCount: undefined,
        VersionId: undefined,
        WebsiteRedirectLocation: undefined,
    };
    if (output.headers["x-amz-object-lock-mode"] !== undefined) {
        contents.ObjectLockMode = output.headers["x-amz-object-lock-mode"];
    }
    if (output.headers["content-language"] !== undefined) {
        contents.ContentLanguage = output.headers["content-language"];
    }
    if (output.headers["content-disposition"] !== undefined) {
        contents.ContentDisposition = output.headers["content-disposition"];
    }
    if (output.headers["cache-control"] !== undefined) {
        contents.CacheControl = output.headers["cache-control"];
    }
    if (output.headers["content-type"] !== undefined) {
        contents.ContentType = output.headers["content-type"];
    }
    if (output.headers["content-range"] !== undefined) {
        contents.ContentRange = output.headers["content-range"];
    }
    if (output.headers["x-amz-server-side-encryption-aws-kms-key-id"] !== undefined) {
        contents.SSEKMSKeyId = output.headers["x-amz-server-side-encryption-aws-kms-key-id"];
    }
    if (output.headers["content-length"] !== undefined) {
        contents.ContentLength = parseInt(output.headers["content-length"], 10);
    }
    if (output.headers["x-amz-object-lock-retain-until-date"] !== undefined) {
        contents.ObjectLockRetainUntilDate = new Date(output.headers["x-amz-object-lock-retain-until-date"]);
    }
    if (output.headers["x-amz-object-lock-legal-hold"] !== undefined) {
        contents.ObjectLockLegalHoldStatus = output.headers["x-amz-object-lock-legal-hold"];
    }
    if (output.headers["x-amz-delete-marker"] !== undefined) {
        contents.DeleteMarker = output.headers["x-amz-delete-marker"] === "true";
    }
    if (output.headers["x-amz-storage-class"] !== undefined) {
        contents.StorageClass = output.headers["x-amz-storage-class"];
    }
    if (output.headers["content-encoding"] !== undefined) {
        contents.ContentEncoding = output.headers["content-encoding"];
    }
    if (output.headers["x-amz-restore"] !== undefined) {
        contents.Restore = output.headers["x-amz-restore"];
    }
    if (output.headers["x-amz-website-redirect-location"] !== undefined) {
        contents.WebsiteRedirectLocation = output.headers["x-amz-website-redirect-location"];
    }
    if (output.headers["x-amz-server-side-encryption"] !== undefined) {
        contents.ServerSideEncryption = output.headers["x-amz-server-side-encryption"];
    }
    if (output.headers["x-amz-mp-parts-count"] !== undefined) {
        contents.PartsCount = parseInt(output.headers["x-amz-mp-parts-count"], 10);
    }
    if (output.headers["x-amz-server-side-encryption-customer-algorithm"] !== undefined) {
        contents.SSECustomerAlgorithm = output.headers["x-amz-server-side-encryption-customer-algorithm"];
    }
    if (output.headers["accept-ranges"] !== undefined) {
        contents.AcceptRanges = output.headers["accept-ranges"];
    }
    if (output.headers["x-amz-version-id"] !== undefined) {
        contents.VersionId = output.headers["x-amz-version-id"];
    }
    if (output.headers["expires"] !== undefined) {
        contents.Expires = new Date(output.headers["expires"]);
    }
    if (output.headers["x-amz-expiration"] !== undefined) {
        contents.Expiration = output.headers["x-amz-expiration"];
    }
    if (output.headers["x-amz-missing-meta"] !== undefined) {
        contents.MissingMeta = parseInt(output.headers["x-amz-missing-meta"], 10);
    }
    if (output.headers["x-amz-replication-status"] !== undefined) {
        contents.ReplicationStatus = output.headers["x-amz-replication-status"];
    }
    if (output.headers["x-amz-tagging-count"] !== undefined) {
        contents.TagCount = parseInt(output.headers["x-amz-tagging-count"], 10);
    }
    if (output.headers["x-amz-server-side-encryption-customer-key-md5"] !== undefined) {
        contents.SSECustomerKeyMD5 = output.headers["x-amz-server-side-encryption-customer-key-md5"];
    }
    if (output.headers["last-modified"] !== undefined) {
        contents.LastModified = new Date(output.headers["last-modified"]);
    }
    if (output.headers["etag"] !== undefined) {
        contents.ETag = output.headers["etag"];
    }
    if (output.headers["x-amz-request-charged"] !== undefined) {
        contents.RequestCharged = output.headers["x-amz-request-charged"];
    }
    Object.keys(output.headers).forEach((header) => {
        if (contents.Metadata === undefined) {
            contents.Metadata = {};
        }
        if (header.startsWith("x-amz-meta-")) {
            contents.Metadata[header.substring(11)] = output.headers[header];
        }
    });
    const data = output.body;
    contents.Body = data;
    return Promise.resolve(contents);
};
const deserializeAws_restXmlGetObjectCommandError = async (output, context) => {
    const parsedOutput = {
        ...output,
        body: await parseBody(output.body, context),
    };
    let response;
    let errorCode = "UnknownError";
    errorCode = loadRestXmlErrorCode(output, parsedOutput.body);
    switch (errorCode) {
        case "NoSuchKey":
        case "com.amazonaws.s3#NoSuchKey":
            response = {
                ...(await deserializeAws_restXmlNoSuchKeyResponse(parsedOutput)),
                name: errorCode,
                $metadata: deserializeMetadata(output),
            };
            break;
        default:
            const parsedBody = parsedOutput.body;
            errorCode = parsedBody.code || parsedBody.Code || errorCode;
            response = {
                ...parsedBody,
                name: `${errorCode}`,
                message: parsedBody.message || parsedBody.Message || errorCode,
                $fault: "client",
                $metadata: deserializeMetadata(output),
            };
    }
    const message = response.message || response.Message || errorCode;
    response.message = message;
    delete response.Message;
    return Promise.reject(Object.assign(new Error(message), response));
};
const deserializeAws_restXmlNoSuchKeyResponse = async (parsedOutput, context) => {
    const contents = {
        name: "NoSuchKey",
        $fault: "client",
        $metadata: deserializeMetadata(parsedOutput),
    };
    const data = parsedOutput.body;
    return contents;
};
const deserializeMetadata = (output) => ({
    httpStatusCode: output.statusCode,
    httpHeaders: output.headers,
    requestId: output.headers["x-amzn-requestid"],
});
// Collect low-level response body stream to Uint8Array.
const collectBody = (streamBody = new Uint8Array(), context) => {
    if (streamBody instanceof Uint8Array) {
        return Promise.resolve(streamBody);
    }
    return context.streamCollector(streamBody) || Promise.resolve(new Uint8Array());
};
// Encode Uint8Array data into string with utf-8.
const collectBodyString = (streamBody, context) => collectBody(streamBody, context).then((body) => context.utf8Encoder(body));
const isSerializableHeaderValue = (value) => value !== undefined &&
    value !== "" &&
    (!Object.getOwnPropertyNames(value).includes("length") || value.length != 0) &&
    (!Object.getOwnPropertyNames(value).includes("size") || value.size != 0);
const decodeEscapedXML = (str) => str
    .replace(/&amp;/g, "&")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<");
const parseBody = (streamBody, context) => collectBodyString(streamBody, context).then((encoded) => {
    if (encoded.length) {
        const parsedObj = parser.parse(encoded, {
            attributeNamePrefix: "",
            ignoreAttributes: false,
            parseNodeValue: false,
            tagValueProcessor: (val, tagName) => decodeEscapedXML(val),
        });
        const textNodeName = "#text";
        const key = Object.keys(parsedObj)[0];
        const parsedObjToReturn = parsedObj[key];
        if (parsedObjToReturn[textNodeName]) {
            parsedObjToReturn[key] = parsedObjToReturn[textNodeName];
            delete parsedObjToReturn[textNodeName];
        }
        return getValueFromTextNode(parsedObjToReturn);
    }
    return {};
});
const loadRestXmlErrorCode = (output, data) => {
    if (data.Code !== undefined) {
        return data.Code;
    }
    if (output.statusCode == 404) {
        return "NotFound";
    }
    return "";
};

var deserializerMiddleware = function (options, deserializer) { return function (next, context) { return function (args) { return __awaiter(void 0, void 0, void 0, function () {
    var logger, outputFilterSensitiveLog, response, parsed, $metadata, outputWithoutMetadata;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                logger = context.logger, outputFilterSensitiveLog = context.outputFilterSensitiveLog;
                return [4 /*yield*/, next(args)];
            case 1:
                response = (_a.sent()).response;
                if (typeof (logger === null || logger === void 0 ? void 0 : logger.debug) === "function") {
                    logger.debug({
                        httpResponse: response,
                    });
                }
                return [4 /*yield*/, deserializer(response, options)];
            case 2:
                parsed = _a.sent();
                $metadata = parsed.$metadata, outputWithoutMetadata = __rest(parsed, ["$metadata"]);
                if (typeof (logger === null || logger === void 0 ? void 0 : logger.info) === "function") {
                    logger.info({
                        output: outputFilterSensitiveLog(outputWithoutMetadata),
                    });
                }
                return [2 /*return*/, {
                        response: response,
                        output: parsed,
                    }];
        }
    });
}); }; }; };

var serializerMiddleware = function (options, serializer) { return function (next, context) { return function (args) { return __awaiter(void 0, void 0, void 0, function () {
    var logger, inputFilterSensitiveLog, request;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                logger = context.logger, inputFilterSensitiveLog = context.inputFilterSensitiveLog;
                if (typeof (logger === null || logger === void 0 ? void 0 : logger.info) === "function") {
                    logger.info({
                        input: inputFilterSensitiveLog(args.input),
                    });
                }
                return [4 /*yield*/, serializer(args.input, options)];
            case 1:
                request = _a.sent();
                if (typeof (logger === null || logger === void 0 ? void 0 : logger.debug) === "function") {
                    logger.debug({
                        httpRequest: request,
                    });
                }
                return [2 /*return*/, next(__assign(__assign({}, args), { request: request }))];
        }
    });
}); }; }; };

var deserializerMiddlewareOption = {
    name: "deserializerMiddleware",
    step: "deserialize",
    tags: ["DESERIALIZER"],
};
var serializerMiddlewareOption = {
    name: "serializerMiddleware",
    step: "serialize",
    tags: ["SERIALIZER"],
};
function getSerdePlugin(config, serializer, deserializer) {
    return {
        applyToStack: function (commandStack) {
            commandStack.add(deserializerMiddleware(config, deserializer), deserializerMiddlewareOption);
            commandStack.add(serializerMiddleware(config, serializer), serializerMiddlewareOption);
        },
    };
}

function ssecMiddleware(options) {
    var _this = this;
    return function (next) { return function (args) { return __awaiter(_this, void 0, void 0, function () {
        var input, properties, properties_1, properties_1_1, prop, value, valueView, encoded, hash, _a, _b, _c, _d, e_1_1;
        var e_1, _e, _f;
        return __generator(this, function (_g) {
            switch (_g.label) {
                case 0:
                    input = __assign({}, args.input);
                    properties = [
                        {
                            target: "SSECustomerKey",
                            hash: "SSECustomerKeyMD5",
                        },
                        {
                            target: "CopySourceSSECustomerKey",
                            hash: "CopySourceSSECustomerKeyMD5",
                        },
                    ];
                    _g.label = 1;
                case 1:
                    _g.trys.push([1, 6, 7, 8]);
                    properties_1 = __values(properties), properties_1_1 = properties_1.next();
                    _g.label = 2;
                case 2:
                    if (!!properties_1_1.done) return [3 /*break*/, 5];
                    prop = properties_1_1.value;
                    value = input[prop.target];
                    if (!value) return [3 /*break*/, 4];
                    valueView = ArrayBuffer.isView(value)
                        ? new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
                        : typeof value === "string"
                            ? options.utf8Decoder(value)
                            : new Uint8Array(value);
                    encoded = options.base64Encoder(valueView);
                    hash = new options.md5();
                    hash.update(valueView);
                    _a = [__assign({}, input)];
                    _f = {}, _f[prop.target] = encoded;
                    _b = prop.hash;
                    _d = (_c = options).base64Encoder;
                    return [4 /*yield*/, hash.digest()];
                case 3:
                    input = __assign.apply(void 0, _a.concat([(_f[_b] = _d.apply(_c, [_g.sent()]), _f)]));
                    _g.label = 4;
                case 4:
                    properties_1_1 = properties_1.next();
                    return [3 /*break*/, 2];
                case 5: return [3 /*break*/, 8];
                case 6:
                    e_1_1 = _g.sent();
                    e_1 = { error: e_1_1 };
                    return [3 /*break*/, 8];
                case 7:
                    try {
                        if (properties_1_1 && !properties_1_1.done && (_e = properties_1.return)) _e.call(properties_1);
                    }
                    finally { if (e_1) throw e_1.error; }
                    return [7 /*endfinally*/];
                case 8: return [2 /*return*/, next(__assign(__assign({}, args), { input: input }))];
            }
        });
    }); }; };
}
var ssecMiddlewareOptions = {
    name: "ssecMiddleware",
    step: "initialize",
    tags: ["SSE"],
};
var getSsecPlugin = function (config) { return ({
    applyToStack: function (clientStack) {
        clientStack.add(ssecMiddleware(config), ssecMiddlewareOptions);
    },
}); };

class GetObjectCommand extends Command {
    // Start section: command_properties
    // End section: command_properties
    constructor(input) {
        // Start section: command_constructor
        super();
        this.input = input;
        // End section: command_constructor
    }
    resolveMiddleware(clientStack, configuration, options) {
        this.middlewareStack.use(getSerdePlugin(configuration, this.serialize, this.deserialize));
        this.middlewareStack.use(getSsecPlugin(configuration));
        this.middlewareStack.use(getBucketEndpointPlugin(configuration));
        const stack = clientStack.concat(this.middlewareStack);
        const { logger } = configuration;
        const handlerExecutionContext = {
            logger,
            clientName: "S3Client",
            commandName: "GetObjectCommand",
            inputFilterSensitiveLog: GetObjectRequest.filterSensitiveLog,
            outputFilterSensitiveLog: GetObjectOutput.filterSensitiveLog,
        };
        const { requestHandler } = configuration;
        return stack.resolve((request) => requestHandler.handle(request.request, options || {}), handlerExecutionContext);
    }
    serialize(input, context) {
        return serializeAws_restXmlGetObjectCommand(input, context);
    }
    deserialize(output, context) {
        return deserializeAws_restXmlGetObjectCommand(output, context);
    }
}

var GetObjectCommand$1 = /*#__PURE__*/Object.freeze({
  __proto__: null,
  GetObjectCommand: GetObjectCommand
});

exports.handler = handler$1;
