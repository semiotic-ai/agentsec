import cliPackageJson from "../../../packages/cli/package.json";

const NPM_REGISTRY_URL = "https://registry.npmjs.org/agentsec/latest";
const REVALIDATE_SECONDS = 3600;
const FALLBACK_VERSION = cliPackageJson.version;

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
