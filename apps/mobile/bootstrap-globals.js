const directAssignmentGlobals = [
  'window',
  'self',
  'process',
  'performance',
  'navigator',
  'alert',
  'REACT_NAVIGATION_DEVTOOLS',
  '__fetchSegment',
  '__loadBundleAsync',
  '__expo_dev_resetErrors',
  '__EXPO_ROUTER_PREFETCH__',
  '__EXPO_REFETCH_RSC__',
  '__EXPO_REFETCH_ROUTE__',
  '__EXPO_REFETCH_ROUTE_NO_CACHE__',
  '__EXPO_RSC_CACHE__',
  '__expo_platform_header',
  '__webpack_chunk_load__',
  '__webpack_require__',
];

const metroPrefix =
  typeof globalThis.__METRO_GLOBAL_PREFIX__ === 'string'
    ? globalThis.__METRO_GLOBAL_PREFIX__
    : '';

if (metroPrefix) {
  directAssignmentGlobals.push(`${metroPrefix}__ReactRefresh`);
}

for (const globalName of directAssignmentGlobals) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, globalName);

  if (!descriptor) {
    continue;
  }

  const hasAccessor =
    typeof descriptor.get === 'function' || typeof descriptor.set === 'function';
  const isWritableDataProperty = descriptor.writable !== false;

  if (!hasAccessor && isWritableDataProperty) {
    continue;
  }

  if (!descriptor.configurable) {
    console.warn(
      `[bootstrap] Global "${globalName}" is not configurable and may break React Native startup.`
    );
    continue;
  }

  try {
    Object.defineProperty(globalThis, globalName, {
      value: globalThis[globalName],
      enumerable: descriptor.enumerable !== false,
      configurable: true,
      writable: true,
    });
  } catch (error) {
    console.warn(
      `[bootstrap] Failed to normalize global "${globalName}":`,
      error
    );
  }
}

if (globalThis.process && typeof globalThis.process === 'object') {
  const envDescriptor = Object.getOwnPropertyDescriptor(globalThis.process, 'env');

  if (
    envDescriptor &&
    envDescriptor.configurable &&
    envDescriptor.writable === false
  ) {
    try {
      Object.defineProperty(globalThis.process, 'env', {
        value: globalThis.process.env,
        enumerable: envDescriptor.enumerable !== false,
        configurable: true,
        writable: true,
      });
    } catch (error) {
      console.warn('[bootstrap] Failed to normalize process.env:', error);
    }
  }
}
