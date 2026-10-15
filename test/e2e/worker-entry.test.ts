import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  astroMajors,
  buildProject,
  packAdapter,
  prepareProject,
  GREETING,
  startPagesDev,
  textOf,
  type PagesServer,
} from "./harness.js";

const tarball = packAdapter();

describe.each(astroMajors())(
  "Astro %i: workerEntryPoint (worker-entry fixture)",
  (major) => {
    let server: PagesServer;

    beforeAll(async () => {
      const dir = prepareProject(major, "worker-entry", tarball);
      buildProject(dir);
      server = await startPagesDev(dir, 8890 + major);
    });

    afterAll(() => {
      server?.stop();
    });

    it("lets the custom entry answer a path itself", async () => {
      const response = await fetch(`${server.url}/__ping`);
      expect(await response.text()).toBe("pong from the custom entry");
    });

    it("passes other requests to the adapter's handler", async () => {
      const response = await fetch(`${server.url}/ssr`);
      expect(response.headers.get("x-custom-entry")).toBe("yes");
      expect(textOf(await response.text(), "greeting")).toBe(GREETING);
    });
  }
);
