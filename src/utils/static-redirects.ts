export interface StaticRedirect {
  status: number;
  location: string;
}

/**
 * Parses the static rules of a Pages `_redirects` file (`/from /to 301`) into a map keyed by the source path. Rules with placeholders or splats are left out, because the adapter writes none of them; Pages applies those itself.
 */
export function parseStaticRedirects(
  content: string
): Map<string, StaticRedirect> {
  const redirects = new Map<string, StaticRedirect>();
  for (const line of content.split(/\r?\n/)) {
    const [from, to, status] = line.trim().split(/\s+/);
    if (!from || !to || from.startsWith("#")) continue;
    if (/[:*]/.test(from)) continue;
    redirects.set(from, { location: to, status: Number(status) || 301 });
  }
  return redirects;
}
