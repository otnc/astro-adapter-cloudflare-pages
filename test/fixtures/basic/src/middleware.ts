import { defineMiddleware } from "astro:middleware";

export const onRequest = defineMiddleware(async (context, next) => {
  context.locals.fromMiddleware = "set by middleware";
  const response = await next();
  response.headers.set("x-middleware", "yes");
  return response;
});
