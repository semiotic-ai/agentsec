/**
 * Fallback version stamped at release time by `scripts/bump-version.ts`.
 *
 * Vercel builds `apps/landing/` in isolation, so we can't import a JSON file
 * from `packages/cli/` — the path escapes the project root. Keep this literal
 * in sync via the version-stamps pipeline (see scripts/version-stamps.ts).
 */
const FALLBACK_VERSION = "0.3.3";

const NPM_REGISTRY_URL = "https://registry.npmjs.org/agentsec/latest";
const REVALIDATE_SECONDS = 3600;

type NpmRegistryResponse = { version?: string };

export async function getAgentsecVersion(): Promise<string> {
  try {
    const res = await fetch(NPM_REGISTRY_URL, {
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!res.ok) return FALLBACK_VERSION;
    const data = (await res.json()) as NpmRegistryResponse;
    return data.version ?? FALLBACK_VERSION;
  } catch {
    return FALLBACK_VERSION;
  }
}
