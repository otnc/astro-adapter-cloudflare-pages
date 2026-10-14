import { defineAction } from "astro:actions";
import { z } from "astro/zod";

export const server = {
  greet: defineAction({
    input: z.object({ name: z.string() }),
    handler: async ({ name }, context) => {
      const runtime = (
        context.locals as { runtime?: { env: Record<string, unknown> } }
      ).runtime;
      return { message: `Hello ${name}`, greeting: runtime?.env.GREETING };
    },
  }),
};
