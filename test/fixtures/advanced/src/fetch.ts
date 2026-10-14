import { FetchState, astro } from "astro/fetch";

// Advanced Routing: a custom top-level handler that answers one path itself and hands everything else to Astro.
export default {
  async fetch(request: Request): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname === "/custom") {
      return new Response("handled by src/fetch.ts", {
        headers: { "x-custom-fetch": "yes" },
      });
    }
    return astro(new FetchState(request));
  },
};
