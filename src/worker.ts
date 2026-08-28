import { handleApiRequest, Env as FunctionEnv } from '../functions/api/[[route]]';

export interface Env extends FunctionEnv {
  ASSETS: {
    fetch: (request: Request) => Promise<Response>;
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      return handleApiRequest(request, env);
    }
    return env.ASSETS.fetch(request);
  },
};
