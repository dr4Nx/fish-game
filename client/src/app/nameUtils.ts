const MAX_NAME_LENGTH = 20;
const ADJECTIVES = ["Blue", "Swift", "Bright", "Happy", "Lucky", "Mighty", "Quiet", "Brave", "Clever", "Sunny"];
const NOUNS = ["Unicorn", "Falcon", "Otter", "Tiger", "Comet", "Dolphin", "Panda", "Fox", "Lion", "Whale"];

export const getRandomName = () =>
  `${ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]}${NOUNS[Math.floor(Math.random() * NOUNS.length)]}${Math.floor(
    Math.random() * 10
  )}`;

export const sanitizeDisplayName = (name: string) => {
  const cleaned = name.replace(/[^A-Za-z0-9.-]/g, "");
  return cleaned.slice(0, MAX_NAME_LENGTH);
};

export const formatDisplayName = (name?: string | null) => {
  const cleaned = sanitizeDisplayName((name ?? "").trim());
  const base = cleaned.length > 0 ? cleaned : "Player";
  return base.length > MAX_NAME_LENGTH ? base.slice(0, MAX_NAME_LENGTH) : base;
};
