/**
 * completer kotoba — barrel.
 *
 * Per ADR-2606011400. DID compliance-audit registry on the etzhayyim substrate
 * (AT PDS records; no RW).
 *
 *   audit   : startAudit / completeAudit (score) / getAudit / listAudits
 *   finding : addFinding (FK→audit) / resolveFinding / listFindings
 *   getComplianceScore (rollup per subject DID)
 *   coverage
 *
 * Governance metadata only; no PII / settlement / liability.
 */

export * from "./types.js";
export {
  startAudit,
  completeAudit,
  getAudit,
  listAudits,
  addFinding,
  resolveFinding,
  listFindings,
  getComplianceScore,
  coverage,
} from "./registry.js";
