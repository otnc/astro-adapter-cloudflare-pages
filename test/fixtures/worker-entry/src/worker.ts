import handler from "astro-adapter-cloudflare-pages/handler";

type Fetch = (
  request: Request,
  env: unknown,
  context: unknown
) => Promise<Response>;

// A custom Worker entry: answers one path itself and adds a header to everything Astro renders.
export default {
  async fetch(request: Request, env: unknown, context: unknown) {
    if (new URL(request.url).pathname === "/__ping") {
      return new Response("pong from the custom entry");
    }
    const response = await (handler.fetch as unknown as Fetch)(
      request,
      env,
      context
    );
    const result = new Response(response.body, response);
    result.headers.set("x-custom-entry", "yes");
    return result;
  },
};
