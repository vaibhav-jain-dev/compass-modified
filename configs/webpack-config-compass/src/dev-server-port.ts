// Fork-specific: upstream Compass hardcodes 4242. This fork defaults to a
// different port so it can run next to an upstream checkout (or anything
// else on 4242) without a conflict, and lets the port be overridden.
export const DEFAULT_DEV_SERVER_PORT = 4747;

export function getDevServerPort(): number {
  const fromEnv = Number(process.env.COMPASS_DEV_SERVER_PORT);
  return Number.isInteger(fromEnv) && fromEnv > 0
    ? fromEnv
    : DEFAULT_DEV_SERVER_PORT;
}
