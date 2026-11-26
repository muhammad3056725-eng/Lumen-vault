import { describe, test, expect, vi, beforeAll } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..", "..");
const dataRoot = join(repoRoot, "public");

function stubFetch(): void {
  vi.stubGlobal(
    "fetch",
    async (url: string) => {
      const marker = "/data/v1/";
      const idx = String(url).indexOf(marker);
      if (idx === -1) return { ok: false, status: 404 };
      const rel = String(url).slice(idx + marker.length);
      const path = join(dataRoot, "data", "v1", rel);
      if (!existsSync(path)) return { ok: false, status: 404 };
      const buf = readFileSync(path);
      return {
        ok: true,
        status: 200,
        json: async () => JSON.parse(buf.toString("utf8")),
        arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
      };
    }
  );
}

beforeAll(async () => {
  const html = readFileSync(join(here, "..", "index.html"), "utf8");
  const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/)![1].replace(/<script[\s\S]*?<\/script>/g, "");
  document.body.innerHTML = body;
  localStorage.clear();
  stubFetch();
  await import("../src/main");
  await vi.waitFor(
    () => {
      expect(document.querySelector(".hero h1")?.textContent).toContain("LUMEN VAULT");
    },
    { timeout: 8000 }
  );
});

describe("LUMEN VAULT web app (jsdom smoke)", () => {
  test("boots into the vault door with all three modes", () => {
    expect(document.querySelector("#enter-daily")).not.toBeNull();
    expect(document.querySelector("#enter-zen")).not.toBeNull();
    expect(document.querySelectorAll("[data-wing]").length).toBe(4);
    expect(document.body.dataset.palette).toBe("midnight");
  });

  test("daily map renders five nodes in the generated vault's order", async () => {
    (document.querySelector("#enter-daily") as HTMLButtonElement).click();
    await vi.waitFor(() => expect(document.querySelectorAll(".node").length).toBe(5));
    const labels = [...document.querySelectorAll(".node-label")].map((n) => n.textContent);
    // Expected order comes from the shipped daily file itself (the
    // Python generator is canonical), resolved through chambers.json.
    const dataRoot2 = join(repoRoot, "public", "data", "v1");
    const daily = JSON.parse(readFileSync(join(dataRoot2, "daily", "latest.json"), "utf8")) as { chambers: string[] };
    const chambers = JSON.parse(readFileSync(join(dataRoot2, "chambers.json"), "utf8")) as { id: string; title: string }[];
    const expected = daily.chambers.map((id) => chambers.find((c) => c.id === id)!.title);
    expect(labels).toEqual(expected);
  });

  test("first chamber opens: venn board, tray tiles and seal button", async () => {
    const dataRoot2 = join(repoRoot, "public", "data", "v1");
    const daily = JSON.parse(readFileSync(join(dataRoot2, "daily", "latest.json"), "utf8")) as { chambers: string[] };
    const chambers = JSON.parse(readFileSync(join(dataRoot2, "chambers.json"), "utf8")) as {
      id: string;
      kind: string;
      tiles?: string[];
      rings?: unknown[];
    }[];
    const first = chambers.find((c) => c.id === daily.chambers[0])!;
    expect(first.kind).toBe("venn");
    const firstNode = document.querySelector<SVGGElement>(".node.clickable")!;
    firstNode.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await vi.waitFor(() => expect(document.querySelector(".venn-board")).not.toBeNull());
    expect(document.querySelectorAll(".tile").length).toBe(first.tiles!.length);
    expect(document.querySelectorAll(".socket").length).toBe(2 ** first.rings!.length);
    expect(document.querySelector(".seal-btn")).not.toBeNull();
  });
});
