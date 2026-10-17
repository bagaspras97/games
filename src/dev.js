// Developer URL helpers (?start, ?hazard, ?finish, ?moment, ?debug) only work when
// the game runs locally. On a real portal they are ignored, so players can't use
// them to skip levels or farm stars.
export const DEV = ["localhost", "127.0.0.1", ""].includes(location.hostname);
const params = new URLSearchParams(location.search);

export function devParam(name) {
  return DEV ? params.get(name) : null;
}

export function devFlag(name) {
  return DEV && params.has(name);
}
