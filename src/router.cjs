/**
 * Simple Express-like Router for Tools
 */

class Router {
  constructor() {
    this.routes = { POST: {}, GET: {} };
  }

  post(path, handler) {
    this.routes.POST[path] = handler;
  }

  get(path, handler) {
    this.routes.GET[path] = handler;
  }

  async handle(method, path, req, res) {
    const handler = this.routes[method]?.[path];
    if (handler) {
      try {
        await handler(req, res);
        return true;
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
        return true;
      }
    }
    return false;
  }
}

module.exports = Router;
