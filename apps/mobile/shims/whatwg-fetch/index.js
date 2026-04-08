/* global module */
const globalScope = typeof globalThis !== 'undefined' ? globalThis : {};

const fetchApi =
  typeof globalScope.fetch === 'function'
    ? globalScope.fetch.bind(globalScope)
    : undefined;

const shim = {
  fetch: fetchApi,
  Headers: globalScope.Headers,
  Request: globalScope.Request,
  Response: globalScope.Response,
};

module.exports = shim;
module.exports.default = shim;
