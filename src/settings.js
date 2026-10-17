// Player settings, stored separately from game progress so "reset progress"
// keeps them. graphics: "auto" (switches to light if the game runs slowly),
// "high" or "low".
const KEY = "hop_settings";
const DEFAULTS = { music: true, sfx: true, vibrate: true, graphics: "auto" };

export const settings = { ...DEFAULTS };
try { Object.assign(settings, JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) {}

export function saveSettings() {
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch (e) {}
}
