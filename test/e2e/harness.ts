import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const CACHE = join(ROOT, ".cache", "e2e");
const FIXTURES = join(ROOT, "test", "fixtures");
const PACKAGE = JSON.parse(
  readFileSync(join(ROOT, "package.json"), "utf-8")
) as {
  name: string;
  dependencies: Record<string, string>;
};

export const GREETING = "from-binding";

// Spawning node directly avoids shells, which on Windows quote arguments differently and leave orphaned processes.
function runNode(script: string, args: string[], cwd: string): void {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd,
    stdio: "inherit",
    env: childEnv(),
  });
  if (result.status !== 0) {
    throw new Error(`\`${script} ${args.join(" ")}\` failed in ${cwd}`);
  }
}

function npmCli(): string {
  const cli = process.env.npm_execpath;
  if (!cli)
    throw new Error("Run the e2e tests through npm (npm run test:e2e).");
  return cli;
}

function binPath(
  projectDir: string,
  packageName: string,
  binName: string
): string {
  const packageDir = join(projectDir, "node_modules", packageName);
  const { bin } = JSON.parse(
    readFileSync(join(packageDir, "package.json"), "utf-8")
  ) as {
    bin: string | Record<string, string>;
  };
  return join(packageDir, typeof bin === "string" ? bin : bin[binName]!);
}

/** Extracts an npm tarball (ustar, every entry under `package/`) without relying on a platform `tar`. */
function extractTarball(tarball: string, target: string): void {
  const data = gunzipSync(readFileSync(tarball));
  let offset = 0;
  while (offset + 512 <= data.length) {
    const header = data.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    const field = (start: number, length: number) =>
      header
        .subarray(start, start + length)
        .toString("utf-8")
        .replace(/\0.*$/s, "");
    const prefix = field(345, 155);
    const name = prefix ? `${prefix}/${field(0, 100)}` : field(0, 100);
    const size = Number.parseInt(field(124, 12).trim() || "0", 8);
    const type = field(156, 1);
    const body = data.subarray(offset + 512, offset + 512 + size);
    const relativePath = name.replace(/^package\//, "");
    if ((type === "0" || type === "") && relativePath) {
      const file = join(target, relativePath);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, body);
    }
    offset += 512 + Math.ceil(size / 512) * 512;
  }
}

/** Packs the built package exactly as `npm publish` would, so tests exercise the published files. */
export function packAdapter(): string {
  mkdirSync(CACHE, { recursive: true });
  for (const file of readdirSync(CACHE)) {
    if (file.endsWith(".tgz")) rmSync(join(CACHE, file));
  }
  runNode(npmCli(), ["pack", "--pack-destination", CACHE, "--silent"], ROOT);
  const tarball = readdirSync(CACHE).find((file) => file.endsWith(".tgz"));
  if (!tarball) throw new Error("npm pack produced no tarball");
  return join(CACHE, tarball);
}

/**
 * Creates (or reuses) an isolated project for one Astro major, installs the packed adapter into it, and copies the fixture in.
 *
 * Each major gets its own node_modules, so Astro 6 and 7 never share a resolution of `astro`.
 */
export function prepareProject(
  astroMajor: number,
  fixture: string,
  tarball: string,
  /** Local runtime tools installed next to the adapter. Wrangler by default; the Miniflare fixture installs only Miniflare. */
  tools: Record<string, string> = { wrangler: "^4" }
): string {
  const dir = join(CACHE, `astro-${astroMajor}-${fixture}`);
  mkdirSync(dir, { recursive: true });

  const manifest = {
    name: `e2e-astro-${astroMajor}-${fixture}`,
    private: true,
    type: "module",
    dependencies: {
      ...PACKAGE.dependencies,
      astro: `^${astroMajor}`,
      ...tools,
    },
    allowScripts: { esbuild: true, workerd: true, sharp: true },
  };
  const manifestJson = `${JSON.stringify(manifest, null, 2)}\n`;
  const stamp = createHash("sha256").update(manifestJson).digest("hex");
  const stampFile = join(dir, ".install-stamp");
  if (!existsSync(stampFile) || readFileSync(stampFile, "utf-8") !== stamp) {
    writeFileSync(join(dir, "package.json"), manifestJson);
    runNode(
      npmCli(),
      ["install", "--no-audit", "--no-fund", "--no-package-lock"],
      dir
    );
    writeFileSync(stampFile, stamp);
  }

  // Extract by hand: npm caches file: dependencies by version, which would keep a stale build of the adapter.
  const target = join(dir, "node_modules", PACKAGE.name);
  rmSync(target, { recursive: true, force: true });
  extractTarball(tarball, target);

  for (const entry of ["src", "public", "dist", ".astro"]) {
    rmSync(join(dir, entry), { recursive: true, force: true });
  }
  cpSync(join(FIXTURES, fixture), dir, {
    recursive: true,
    filter: (source) =>
      !/[\\/](node_modules|dist|\.astro|\.wrangler)([\\/]|$)/.test(source),
  });
  return dir;
}

export function buildProject(dir: string): void {
  runNode(binPath(dir, "astro", "astro"), ["build"], dir);
}

export interface PagesServer {
  url: string;
  stop(): void;
}

function stopTree(child: ChildProcess): void {
  if (child.pid === undefined || child.exitCode !== null) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
    });
  } else {
    process.kill(-child.pid, "SIGTERM");
  }
}

// Vitest sets NODE_ENV=test and VITEST* variables, which change how a nested Astro or Vite process behaves.
function childEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    WRANGLER_SEND_METRICS: "false",
  };
  for (const key of Object.keys(env)) {
    if (key === "NODE_ENV" || key.startsWith("VITEST") || key === "TEST")
      delete env[key];
  }
  return env;
}

async function startServer(
  args: string[],
  dir: string,
  port: number,
  readyPath: string
): Promise<PagesServer> {
  const child = spawn(process.execPath, args, {
    cwd: dir,
    detached: process.platform !== "win32",
    stdio: ["ignore", "pipe", "pipe"],
    env: childEnv(),
  });
  let output = "";
  child.stdout?.on("data", (chunk: Buffer) => (output += chunk.toString()));
  child.stderr?.on("data", (chunk: Buffer) => (output += chunk.toString()));

  const url = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`\`${args.join(" ")}\` exited early:\n${output}`);
    }
    try {
      const response = await fetch(`${url}${readyPath}`, {
        signal: AbortSignal.timeout(5_000),
      });
      // A dev server can serve public files before routes are ready, so wait for a successful page.
      if (response.ok) return { url, stop: () => stopTree(child) };
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  stopTree(child);
  throw new Error(
    `\`${args.join(" ")}\` did not start within 90 seconds:\n${output}`
  );
}

/** Runs `astro dev`, which emulates bindings from wrangler.jsonc through the adapter's platform proxy. */
export function startAstroDev(dir: string, port: number): Promise<PagesServer> {
  return startServer(
    [
      binPath(dir, "astro", "astro"),
      "dev",
      "--port",
      String(port),
      "--host",
      "127.0.0.1",
    ],
    dir,
    port,
    "/"
  );
}

/** Serves the build with `wrangler pages dev`, the same runtime Pages uses, with a KV namespace for sessions. */
export function startPagesDev(dir: string, port: number): Promise<PagesServer> {
  return startServer(
    [
      binPath(dir, "wrangler", "wrangler"),
      "pages",
      "dev",
      "dist",
      "--port",
      String(port),
      "--ip",
      "127.0.0.1",
      "--compatibility-date",
      "2026-10-01",
      "--kv",
      "SESSION",
      "--binding",
      `GREETING=${GREETING}`,
      "--show-interactive-dev-session=false",
    ],
    dir,
    port,
    "/robots.txt"
  );
}

/** Astro majors to test, from ASTRO_MAJORS (for example "6,7"). */
export function astroMajors(): number[] {
  return (process.env.ASTRO_MAJORS ?? "6,7")
    .split(",")
    .map((value) => Number.parseInt(value.trim(), 10))
    .filter((value) => Number.isInteger(value));
}
