/**
 * Client dataset loader. Resolves the dataset base the same way everywhere:
 * document-anchored "public/data/v1" first (production: the dataset is
 * copied beside the built app), then the vite-dev mount, then bare
 * "data/v1". A candidate only wins if its manifest actually parses as the
 * vault manifest — an HTML fallback page served with status 200 (as dev
 * servers and SPA hosts do) is rejected.
 *
 * The Daily Grand Vault is computed here from today's UTC date, so it
 * rotates every day with no server or workflow; daily/latest.json is only
 * a fallback if computation is impossible.
 */
import type { ArtifactCard, ChamberSpec, DailyVault, DataManifest, Entity, WingSpec } from "@lumen-vault/shared-types";
import { dailyVaultFor, utcDateString } from "@lumen-vault/vault-engine";

export interface Dataset {
  manifest: DataManifest;
  entities: Entity[];
  byId: Map<string, Entity>;
  chambers: ChamberSpec[];
  chamberById: Map<string, ChamberSpec>;
  wings: WingSpec[];
  wingOf: Map<string, WingSpec>;
  artifacts: ArtifactCard[];
  artifactByChamber: Map<string, ArtifactCard>;
  daily: DailyVault;
}

function isManifest(x: unknown): x is DataManifest {
  return !!x && typeof x === "object" && typeof (x as DataManifest).entityCount === "number" && typeof (x as DataManifest).files === "object";
}

async function tryJson(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  const type = res.headers?.get?.("content-type") ?? "";
  if (type.includes("text/html")) throw new Error(`${url} returned HTML`);
  return res.json();
}

async function resolveBase(): Promise<{ base: string; manifest: DataManifest }> {
  const candidates: string[] = [];
  if (typeof document !== "undefined" && document.baseURI) {
    try {
      candidates.push(new URL("public/data/v1", document.baseURI).href.replace(/\/$/, ""));
    } catch {
      /* about:blank and friends */
    }
  }
  candidates.push("/__data/data/v1", "data/v1", "./data/v1");
  for (const base of candidates) {
    try {
      const manifest = await tryJson(`${base}/manifest.json`);
      if (isManifest(manifest)) return { base, manifest };
    } catch {
      /* try the next candidate */
    }
  }
  throw new Error("The vault's dataset could not be found (manifest.json unreachable).");
}

async function getJson<T>(base: string, rel: string): Promise<T> {
  try {
    return (await tryJson(`${base}/${rel}`)) as T;
  } catch (err) {
    throw new Error(`Dataset fetch failed: ${rel} (${err instanceof Error ? err.message : String(err)})`);
  }
}

export function todaysDaily(chambers: ChamberSpec[], fallback: DailyVault | null, now = new Date()): DailyVault {
  try {
    return dailyVaultFor(utcDateString(now), chambers);
  } catch {
    if (fallback) return fallback;
    throw new Error("No daily vault could be computed.");
  }
}

export async function loadDataset(): Promise<Dataset> {
  const { base, manifest } = await resolveBase();
  const [entities, chambers, wings, artifacts] = await Promise.all([
    getJson<Entity[]>(base, "entities.json"),
    getJson<ChamberSpec[]>(base, "chambers.json"),
    getJson<WingSpec[]>(base, "wings.json"),
    getJson<ArtifactCard[]>(base, "artifacts.json"),
  ]);
  const fallback = await getJson<DailyVault>(base, "daily/latest.json").catch(() => null);
  const wingOf = new Map<string, WingSpec>();
  for (const w of wings) for (const id of w.chambers) wingOf.set(id, w);
  return {
    manifest,
    entities,
    byId: new Map(entities.map((e) => [e.entity_id, e])),
    chambers,
    chamberById: new Map(chambers.map((c) => [c.id, c])),
    wings,
    wingOf,
    artifacts,
    artifactByChamber: new Map(artifacts.map((a) => [a.chamberId, a])),
    daily: todaysDaily(chambers, fallback),
  };
}
