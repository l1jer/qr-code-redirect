/**
 * Environment variable reader with optional prefix.
 * Set ENV_PREFIX (e.g. "TSA") so that env("AUTH_SECRET") reads
 * TSA_AUTH_SECRET first, falling back to AUTH_SECRET.
 */

const ENV_PREFIX = (process.env.ENV_PREFIX ?? "").trim();

export function env(name: string): string {
  if (ENV_PREFIX) {
    const value = process.env[`${ENV_PREFIX}_${name}`];
    if (value?.trim()) return value.trim();
  }
  return (process.env[name] ?? "").trim();
}
