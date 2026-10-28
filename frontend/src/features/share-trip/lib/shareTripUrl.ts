import { TripShareState } from "../model/types";

export function encodeTripState(state: TripShareState): string {
  const json = JSON.stringify(state);
  let base64 = "";
  if (typeof Buffer !== "undefined") {
    base64 = Buffer.from(json, "utf-8").toString("base64");
  } else if (typeof btoa !== "undefined") {
    base64 = btoa(unescape(encodeURIComponent(json)));
  } else {
    base64 = "";
  }
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeTripState(token: string): TripShareState | null {
  if (!token || typeof token !== "string") return null;
  try {
    let base64 = token.trim().replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4 !== 0) {
      base64 += "=";
    }
    let json = "";
    if (typeof Buffer !== "undefined") {
      json = Buffer.from(base64, "base64").toString("utf-8");
    } else if (typeof atob !== "undefined") {
      json = decodeURIComponent(escape(atob(base64)));
    } else {
      return null;
    }
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as TripShareState;
  } catch {
    return null;
  }
}

export function extractTripToken(search?: string, hash?: string): string | null {
  if (hash) {
    const cleanHash = hash.startsWith("#") ? hash.slice(1) : hash;
    const fromHash = new URLSearchParams(cleanHash).get("trip");
    if (fromHash) return fromHash;
  }
  if (search) {
    const cleanSearch = search.startsWith("?") ? search.slice(1) : search;
    const fromSearch = new URLSearchParams(cleanSearch).get("trip");
    if (fromSearch) return fromSearch;
  }
  return null;
}

export function buildShareTripUrl(state: TripShareState, origin?: string): string {
  const token = encodeTripState(state);
  let base = origin;
  if (!base) {
    if (typeof window !== "undefined" && window.location) {
      base = `${window.location.origin}${window.location.pathname}`;
    } else {
      base = "/";
    }
  }
  const cleanBase = base.split("#")[0];
  return `${cleanBase}#trip=${token}`;
}
