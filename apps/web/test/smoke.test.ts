import { describe, test, expect, vi, beforeAll } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..", "..");
const dataDir = join(repoRoot, "public", "data", "v1");
const readData = <T,>(f: string) => JSON.parse(readFileSync(join(dataDir, f), "utf8")) as T;

function stubFetch(): void {
  vi.stubGlobal("fetch", async (url: string) => {
    const marker = "/data/v1/";
    const idx = String(url).indexOf(marker);
    if (idx === -1) return { ok: false, status: 404, headers: new Headers() };
    const path = join(dataDir, String(url).slice(idx + marker.length));
    if (!existsSync(path)) return { ok: false, status: 404, headers: new Headers() };
    const buf = readFileSync(path);
    return {
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => JSON.parse(buf.toString("utf8")),
    };
  });
}

const settle = () => new Promise((r) => setTimeout(r, 30));

beforeAll(async () => {
  const html = readFileSync(join(here, "..", "index.html"), "utf8");
  document.body.innerHTML = html.match(/<body[^>]*>([\s\S]*)<\/body>/)![1].replace(/<script[\s\S]*?<\/script>/g, "");
  localStorage.clear();
  stubFetch();
  vi.stubGlobal("scrollTo", () => {});
  HTMLCanvasElement.prototype.getContext = (() => null) as unknown as HTMLCanvasElement["getContext"];
  Element.prototype.scrollIntoView = () => {};
  await import("../src/main");
  await vi.waitFor(() => expect(document.querySelector(".hero h1")?.textContent).toContain("LUMEN VAULT"), { timeout: 8000 });
});

describe("LUMEN VAULT web app (jsdom smoke)", () => {
  test("boots into the vault door with every wing", () => {
    const wings = readData<unknown[]>("wings.json");
    expect(document.querySelectorAll(".wing-card").length).toBe(wings.length);
    expect(document.body.dataset.palette).toBe("midnight");
    expect(document.querySelector("#lv-defs")).not.toBeNull();
  });

  test("daily map renders today's five computed chambers via hash routing", async () => {
    location.hash = "#/daily";
    await vi.waitFor(() => expect(document.querySelectorAll(".node").length).toBe(5));
    const chambers = readData<{ id: string; kind: string }[]>("chambers.json");
    const ids = [...document.querySelectorAll<HTMLElement>(".node")].map((n) => n.dataset.chamber!);
    const kinds = ids.map((id) => chambers.find((c) => c.id === id)!.kind);
    expect(kinds).toEqual(["venn", "chrono", "forge", "venn", "astrolabe"]);
    // Only the first node is open on a fresh day.
    expect(document.querySelectorAll(".node.open").length).toBe(1);
  });

  test("a venn chamber: tiles are focusable buttons; tap-to-select then tap-to-place works", async () => {
    const first = document.querySelector<HTMLElement>(".node.open")!;
    first.click();
    await vi.waitFor(() => expect(document.querySelector(".venn-board")).not.toBeNull());
    const tiles = [...document.querySelectorAll<HTMLButtonElement>(".tray .tile")];
    expect(tiles.length).toBeGreaterThanOrEqual(4);
    expect(tiles[0].tagName).toBe("BUTTON");
    tiles[0].click(); // select
    expect(tiles[0].classList.contains("selected")).toBe(true);
    const row = document.querySelector<HTMLElement>(".ledger-row")!;
    row.click(); // place
    await settle();
    expect(row.querySelector(".tile")).not.toBeNull();
    // The tray is a target too: take it back.
    row.querySelector<HTMLElement>(".tile")!.click();
    document.querySelector<HTMLElement>(".tray")!.click();
    await settle();
    expect(row.querySelector(".tile")).toBeNull();
  });

  test("sealing with tiles left on the tray nudges kindly instead of failing", () => {
    document.querySelector<HTMLElement>(".seal-btn")!.click();
    expect(document.querySelector("#chamber-msg")!.textContent).toMatch(/tray/);
  });

  test("zen mode opens every brainstorm chamber at once; visiting spends no prisms", async () => {
    const before = document.querySelector("#stat-prisms")!.textContent;
    location.hash = "#/zen";
    await vi.waitFor(() => expect(document.querySelectorAll(".node").length).toBeGreaterThanOrEqual(15));
    expect(document.querySelectorAll(".node.locked").length).toBe(0);
    expect(document.querySelector("#stat-prisms")!.textContent).toBe(before);
  });

  test("the cabinet lists every artifact, sealed ones as silhouettes", async () => {
    location.hash = "#/cabinet";
    const artifacts = readData<unknown[]>("artifacts.json");
    await vi.waitFor(() => expect(document.querySelectorAll(".artifact-card").length).toBe(artifacts.length));
    expect(document.querySelectorAll(".artifact-card.silhouette").length).toBe(artifacts.length);
  });
});
