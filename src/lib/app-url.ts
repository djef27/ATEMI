function getDeploymentOrigin(): string | null {
  const deploymentUrl = process.env.VERCEL_URL?.trim();
  if (!deploymentUrl) return null;

  return normalizeOrigin(deploymentUrl);
}

function normalizeOrigin(value: string): string {
  const url = new URL(value.includes('://') ? value : `https://${value}`);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('[APP URL] NEXT_PUBLIC_APP_URL must use HTTP or HTTPS.');
  }
  return url.origin;
}

function isLoopbackUrl(value: string): boolean {
  try {
    const hostname = new URL(value).hostname;
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
  } catch {
    return false;
  }
}

export function getAppUrl(): string {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const deploymentOrigin = getDeploymentOrigin();
  const vercelEnvironment = process.env.VERCEL_ENV;

  if (vercelEnvironment === 'preview') {
    if (deploymentOrigin) return deploymentOrigin;
    if (!configuredUrl || isLoopbackUrl(configuredUrl)) {
      throw new Error('[APP URL] VERCEL_URL is required for a Preview deployment.');
    }
  }

  if (configuredUrl && !(vercelEnvironment && isLoopbackUrl(configuredUrl))) {
    return normalizeOrigin(configuredUrl);
  }

  if (deploymentOrigin) return deploymentOrigin;

  if (vercelEnvironment === 'production') {
    throw new Error('[APP URL] Configure NEXT_PUBLIC_APP_URL for the production deployment.');
  }

  return configuredUrl ? normalizeOrigin(configuredUrl) : 'http://localhost:3000';
}
