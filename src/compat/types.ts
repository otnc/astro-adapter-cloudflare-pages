import type { AstroConfig } from "astro";

type SessionConfig = Exclude<AstroConfig["session"], false>;

/** Behavior that differs between Astro majors. Keep it small: everything else lives in the shared hooks. */
export interface AstroCompat {
  readonly major: number;
  /** Session config that stores sessions in the given KV binding, keeping the user's cookie and TTL settings. */
  createKVSessionConfig(
    bindingName: string,
    userSession: SessionConfig | undefined
  ): SessionConfig;
}
