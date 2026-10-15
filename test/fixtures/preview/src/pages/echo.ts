import type { APIRoute } from "astro";

export const prerender = false;

export const POST: APIRoute = async ({ request }) =>
  Response.json({ received: await request.text() });
