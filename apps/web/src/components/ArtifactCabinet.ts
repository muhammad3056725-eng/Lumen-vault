/**
 * The Artifact Cabinet: a gallery of Wonder Artifact Cards grouped by
 * wing, with filter chips. Collected cards tilt in 2.5D with a moving
 * holographic sheen and specular glint; tapping one opens it large in a
 * <dialog>. Uncollected cards are quiet silhouettes naming their chamber.
 */
import type { ArtifactCard, ChamberSpec, WingSpec } from "@lumen-vault/shared-types";
import { motifSvg } from "../gfx/defs.js";
import { esc, prefersReducedMotion } from "../util.js";

export function artifactCardHtml(card: ArtifactCard, extra = ""): string {
  return `
    <article class="artifact-card ${extra}" data-artifact="${card.id}">
      <div class="card-inner">
        <div class="artifact-motif">${motifSvg(card.motif)}</div>
        <h3>${esc(card.name)}</h3>
        <p class="artifact-lore">${esc(card.lore)}</p>
        <p class="artifact-from">Wonder Artifact · ${card.id}</p>
      </div>
      <div class="holo" aria-hidden="true"></div>
      <div class="glint" aria-hidden="true"></div>
    </article>`;
}

/** 2.5D tilt with holographic sheen and specular glint (±10°). */
export function attachTilt(el: HTMLElement, maxDeg = 10) {
  if (prefersReducedMotion()) return;
  let raf = 0;
  el.addEventListener("pointermove", (ev) => {
    if (ev.pointerType === "touch" && ev.buttons === 0) return;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const r = el.getBoundingClientRect();
      const px = Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width));
      const py = Math.min(1, Math.max(0, (ev.clientY - r.top) / r.height));
      el.style.setProperty("--rx", `${((0.5 - py) * 2 * maxDeg).toFixed(2)}deg`);
      el.style.setProperty("--ry", `${((px - 0.5) * 2 * maxDeg).toFixed(2)}deg`);
      el.style.setProperty("--px", `${(px * 100).toFixed(1)}%`);
      el.style.setProperty("--py", `${(py * 100).toFixed(1)}%`);
      el.classList.add("tilting");
    });
  });
  el.addEventListener("pointerleave", () => {
    cancelAnimationFrame(raf);
    el.classList.remove("tilting");
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
  });
}

export function renderArtifactCabinet(
  root: HTMLElement,
  artifacts: readonly ArtifactCard[],
  wings: readonly WingSpec[],
  chamberById: Map<string, ChamberSpec>,
  collected: ReadonlySet<string>,
  openId?: string
) {
  const byChamber = new Map(artifacts.map((a) => [a.chamberId, a]));
  const chipsHtml = [`<button type="button" class="chip on" data-filter="all">All</button>`, ...wings.map((w) => `<button type="button" class="chip" data-filter="${w.id}">${esc(w.title)}</button>`)].join("");
  const groups = wings
    .map((w) => {
      const cards = w.chambers
        .map((cid) => {
          const card = byChamber.get(cid);
          if (!card) return "";
          if (collected.has(card.id)) return `<button type="button" class="card-btn" data-open="${card.id}" aria-label="Open ${esc(card.name)}">${artifactCardHtml(card)}</button>`;
          const chamber = chamberById.get(cid);
          return `
            <article class="artifact-card silhouette" aria-label="Uncollected artifact">
              <div class="card-inner">
                <div class="artifact-motif">${motifSvg(card.motif)}</div>
                <h3>Sealed</h3>
                <p class="artifact-lore">Waiting inside <strong>${esc(chamber?.title ?? "a chamber")}</strong>. Unseal it to pour the light.</p>
                <p class="artifact-from">Wonder Artifact · ${card.id}</p>
              </div>
            </article>`;
        })
        .join("");
      const got = w.chambers.filter((cid) => byChamber.get(cid) && collected.has(byChamber.get(cid)!.id)).length;
      return `<section class="cabinet-group" data-wing="${w.id}">
        <h3 class="group-title">${esc(w.title)} <span>${got}/${w.chambers.length}</span></h3>
        <div class="cabinet-grid">${cards}</div>
      </section>`;
    })
    .join("");

  root.innerHTML = `
    <section class="cabinet panel">
      <header class="map-head">
        <h2>The Artifact Cabinet</h2>
        <p class="map-sub">${collected.size} of ${artifacts.length} Wonder Artifacts gleam on the vellum.</p>
        <div class="meter" role="progressbar" aria-valuemin="0" aria-valuemax="${artifacts.length}" aria-valuenow="${collected.size}"><span style="width:${(collected.size / Math.max(1, artifacts.length)) * 100}%"></span></div>
      </header>
      <div class="chips" role="group" aria-label="Filter by wing">${chipsHtml}</div>
      ${groups}
    </section>
    <dialog class="card-dialog" aria-label="Wonder Artifact"><div class="dialog-body"></div><button type="button" class="btn ghost close-dialog">Close</button></dialog>`;

  root.querySelectorAll<HTMLElement>(".card-btn .artifact-card").forEach((el) => attachTilt(el, 8));
  root.querySelectorAll<HTMLElement>(".chip").forEach((chip) =>
    chip.addEventListener("click", () => {
      root.querySelectorAll(".chip").forEach((c) => c.classList.toggle("on", c === chip));
      const f = chip.dataset.filter!;
      root.querySelectorAll<HTMLElement>(".cabinet-group").forEach((g) => (g.hidden = f !== "all" && g.dataset.wing !== f));
    })
  );
  const dialog = root.querySelector<HTMLDialogElement>(".card-dialog")!;
  const body = dialog.querySelector<HTMLElement>(".dialog-body")!;
  const open = (id: string) => {
    const card = artifacts.find((a) => a.id === id);
    if (!card || !collected.has(id)) return;
    body.innerHTML = artifactCardHtml(card, "large");
    attachTilt(body.querySelector<HTMLElement>(".artifact-card")!, 12);
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  };
  root.querySelectorAll<HTMLElement>("[data-open]").forEach((b) => b.addEventListener("click", () => open(b.dataset.open!)));
  dialog.querySelector(".close-dialog")!.addEventListener("click", () => (typeof dialog.close === "function" ? dialog.close() : dialog.removeAttribute("open")));
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog && typeof dialog.close === "function") dialog.close();
  });
  if (openId) open(openId);
}
