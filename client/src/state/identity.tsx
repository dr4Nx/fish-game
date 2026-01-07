export function getPlayerKey(): string {
  let key = localStorage.getItem("fish.playerKey");
  if (!key) {
    key = crypto.randomUUID();
    localStorage.setItem("fish.playerKey", key);
  }
  return key;
}

export function getDisplayName(): string {
  return localStorage.getItem("fish.displayName") ?? "";
}

export function setDisplayName(name: string) {
  localStorage.setItem("fish.displayName", name);
}