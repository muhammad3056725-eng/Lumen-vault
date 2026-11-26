import type { AstrolabeChamberSpec, ChamberSpec, ChronoChamberSpec, ForgeChamberSpec, VennChamberSpec } from "@lumen-vault/shared-types";
import type { ChamberRenderer } from "./common.js";
import { renderVenn } from "./venn.js";
import { renderChrono } from "./chrono.js";
import { renderForge } from "./forge.js";
import { renderAstrolabe } from "./astrolabe.js";

export type { ChamberHost, SolveDetail } from "./common.js";

export const CHAMBER_RENDERERS: Record<ChamberSpec["kind"], ChamberRenderer> = {
  venn: (root, spec, data, host) => renderVenn(root, spec as VennChamberSpec, data, host),
  chrono: (root, spec, data, host) => renderChrono(root, spec as ChronoChamberSpec, data, host),
  forge: (root, spec, data, host) => renderForge(root, spec as ForgeChamberSpec, data, host),
  astrolabe: (root, spec, data, host) => renderAstrolabe(root, spec as AstrolabeChamberSpec, data, host),
};

export const KIND_LABEL: Record<ChamberSpec["kind"], string> = {
  venn: "Venn Lock",
  chrono: "Chrono Gearbox",
  forge: "Resonance Forge",
  astrolabe: "Deduction Astrolabe",
};
