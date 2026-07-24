// utils/username.js
import crypto from "crypto";
import { UserModel as User } from "../../models/index.js";

const USERNAME_RE = /[a-z0-9._-]/;

export const normalizeUsername = (raw = "") => {
  const lower = String(raw).toLowerCase().trim();
  // keep only allowed chars; collapse consecutive dots/underscores/hyphens
  let cleaned = Array.from(lower).filter((ch) => USERNAME_RE.test(ch)).join("");
  cleaned = cleaned.replace(/[._-]{2,}/g, (m) => m[0]); // collapse repeats
  cleaned = cleaned.replace(/^([._-])+|([._-])+$/g, ""); // trim edge symbols
  return cleaned.slice(0, 32); // max length guard
}

// Build base candidates from profile data
export const baseUsernameSeeds = ({ fullName, email, birthday }) => {
  const seeds = new Set();

  const local = String(email || "").split("@")[0] || "";
  const name = String(fullName || "").toLowerCase().trim();
  const nameParts = name.split(/\s+/).filter(Boolean);

  const initials =
    nameParts.length >= 2
      ? nameParts.map((p) => p[0]).join("")
      : nameParts[0] || "";

  const y = birthday ? new Date(birthday).getFullYear() : "";
  const mmdd = birthday
    ? String(new Date(birthday).getMonth() + 1).padStart(2, "0") +
      String(new Date(birthday).getDate()).padStart(2, "0")
    : "";

  const push = (s) => {
    const n = normalizeUsername(s);
    if (n && n.length >= 3) seeds.add(n);
  };

  if (name) {
    push(name.replace(/\s+/g, ""));               // johndoe
    push(name.replace(/\s+/g, "."));              // john.doe
    push(`${nameParts[0] || ""}.${nameParts[1] || ""}`); // john.doe
    push(`${initials}${nameParts.at(-1) || ""}`); // jdow / jdoe
    if (y) push(`${nameParts[0] || ""}${y}`);     // john1990
    if (mmdd) push(`${nameParts[0] || ""}${mmdd}`); // john0512
  }
  if (local) {
    push(local);
    if (y) push(`${local}${y}`);
    if (mmdd) push(`${local}${mmdd}`);
  }

  // some generic fallbacks
  push(`${initials}`);
  push(`${(nameParts[0] || local || "user")}-${crypto.randomInt(10, 99)}`);

  return Array.from(seeds).slice(0, 12);
}

export const  findAvailableUsernames = async (seeds, count = 5) => {
  const taken = new Set(
    (
      await User.find(
        { username: { $in: seeds } },
        { username: 1, _id: 0 }
      ).lean()
    ).map((u) => u.username)
  );

  const out = [];
  for (const s of seeds) {
    if (out.length >= count) break;
    if (!taken.has(s)) out.push(s);
  }

  // Still short? add numeric suffixes to the earliest seed
  let i = 1;
  while (out.length < count && seeds.length) {
    const base = seeds[0];
    const candidate = normalizeUsername(`${base}${i}`);
    // re-check DB availability in batches
    const exists = await User.exists({ username: candidate });
    if (!exists) out.push(candidate);
    i++;
    if (i > 9999) break; // sanity guard
  }

  return out.slice(0, count);
}

export const allocateUniqueUsername = async (
  desired,
  profile = {}
) => {
  if (desired) {
    const want = normalizeUsername(desired);
    if (want.length < 3) throw new Error("Username too short.");
    const exists = await User.exists({ username: want });
    if (!exists) return want;
  }
  const seeds = baseUsernameSeeds(profile);
  const options = await findAvailableUsernames(seeds, 1);
  if (!options.length) {
    // brute fallback
    for (let i = 0; i < 10000; i++) {
      const rand = normalizeUsername(
        `${(profile.fullName || "user").split(/\s+/)[0] || "user"}${crypto.randomInt(1000, 9999)}`
      );
      const exists = await User.exists({ username: rand });
      if (!exists) return rand;
    }
    throw new Error("Could not allocate a unique username.");
  }
  return options[0];
}
