/**
 * Client dataset loader (Blueprint §5 static CDN layout, §7 edge
 * architecture). Resolves the dataset base the same way everywhere:
 * document-anchored "public/data/v1" first (production: the dataset
 * is copied beside the built app), then the vite-dev mount, then a
 * bare "data/v1". Mount-agnostic — no build-time configuration.
 */
import type {
  ArtifactCard,
  ChamberSpec,
  DailyVault,
  DataManifest,
  Entity,
  WingSpec,
} from "@lumen-vault/shared-types";

export interface Dataset {
  base: string;
  manifest: DataManifest;
  entities: Entity[];
  byId: Map<string, Entity>;
  chambers: ChamberSpec[];
  chamberById: Map<string, ChamberSpec>;
  wings: WingSpec[];
  artifacts: ArtifactCard[];
  artifactByChamber: Map<string, ArtifactCard>;
  daily: DailyVault;
}

async function resolveBase(): Promise<string> {
  const candidates: string[] = [];
  if (typeof document !== "undefined" && document.baseURI) {
    try {
      candidates.push(new URL("public/data/v1", document.baseURI).href.replace(/\/$/, ""));
    } catch {
      /* fall through */
    }
  }
  candidates.push("/__data/data/v1", "data/v1", "./data/v1");
  for (const base of candidates) {
    try {
      const res = await fetch(`${base}/manifest.json`);
      if (res.ok) return base;
    } catch {
      /* try the next candidate */
    }
  }
  throw new Error("LUMEN VAULT dataset not found (manifest.json unreachable)");
}

async function getJson<T>(base: string, rel: string): Promise<T> {
  const res = await fetch(`${base}/${rel}`);
  if (!res.ok) throw new Error(`Dataset fetch failed: ${rel} (${res.status})`);
  return (await res.json()) as T;
}

export async function loadDataset(): Promise<Dataset> {
  const base = await resolveBase();
  const [manifest, entities, chambers, wings, artifacts, daily] = await Promise.all([
    getJson<DataManifest>(base, "manifest.json"),
    getJson<Entity[]>(base, "entities.json"),
    getJson<ChamberSpec[]>(base, "chambers.json"),
    getJson<WingSpec[]>(base, "wings.json"),
    getJson<ArtifactCard[]>(base, "artifacts.json"),
    getJson<DailyVault>(base, "daily/latest.json"),
  ]);
  return {
    base,
    manifest,
    entities,
    byId: new Map(entities.map((e) => [e.entity_id, e])),
    chambers,
    chamberById: new Map(chambers.map((c) => [c.id, c])),
    wings,
    artifacts,
    artifactByChamber: new Map(artifacts.map((a) => [a.chamberId, a])),
    daily,
  };
}
