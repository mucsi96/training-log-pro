// Hide webdriver property (primary reCAPTCHA signal)
Object.defineProperty(navigator, 'webdriver', { get: () => undefined });

// Mock Chrome runtime object
window.chrome = {
  runtime: {},
  loadTimes: function () {},
  csi: function () {},
  app: {},
};

// Mock navigator.plugins
Object.defineProperty(navigator, 'plugins', {
  get: () => {
    const plugins = [
      {
        name: 'Chrome PDF Plugin',
        filename: 'internal-pdf-viewer',
        description: 'Portable Document Format',
      },
      {
        name: 'Chrome PDF Viewer',
        filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai',
        description: '',
      },
      {
        name: 'Native Client',
        filename: 'internal-nacl-plugin',
        description: '',
      },
    ];
    plugins.length = 3;
    return plugins;
  },
});

// Mock navigator.languages
Object.defineProperty(navigator, 'languages', {
  get: () => ['en-US', 'en'],
});

// Fix permissions API
const originalQuery = window.navigator.permissions.query;
window.navigator.permissions.query = (parameters) =>
  parameters.name === 'notifications'
    ? Promise.resolve({ state: Notification.permission })
    : originalQuery(parameters);

// Override WebGL vendor and renderer
const getParameterProxyHandler = {
  apply: function (target, thisArg, args) {
    const param = args[0];
    const debugInfo = thisArg.getExtension('WEBGL_debug_renderer_info');
    if (debugInfo) {
      if (param === debugInfo.UNMASKED_VENDOR_WEBGL) return 'Intel Inc.';
      if (param === debugInfo.UNMASKED_RENDERER_WEBGL)
        return 'Intel Iris OpenGL Engine';
    }
    return Reflect.apply(target, thisArg, args);
  },
};

try {
  const getParameter = WebGLRenderingContext.prototype.getParameter;
  WebGLRenderingContext.prototype.getParameter = new Proxy(
    getParameter,
    getParameterProxyHandler
  );
} catch (e) {}

try {
  const getParameter2 = WebGL2RenderingContext.prototype.getParameter;
  WebGL2RenderingContext.prototype.getParameter = new Proxy(
    getParameter2,
    getParameterProxyHandler
  );
} catch (e) {}
