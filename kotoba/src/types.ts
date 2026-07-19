/**
 * completer kotoba — DID compliance-audit record types.
 *
 * Per ADR-2606011400. completer is a DID compliance actor: it evaluates actor /
 * DID manifests + governance metadata and produces audits + findings +
 * compliance scores. Registry on AT PDS records (replaces RW). ADR-2605172000
 * kotoba.
 *
 * AXIS NOTE (ADR-2605172400): axis-clean — it operates over public/internal
 * GOVERNANCE METADATA (manifests, DIDs), not user PII. No settlement, no external
 * fulfillment liability (advisory evaluation). The LLM remediation-reasoning
 * compute is separate; these records hold the audit/finding/score data.
 *
 * AT-Lexicon: no float. Compliance scores are integers 0..100 (percent).
 *
 * Identity hierarchy:
 *   did:web:completer.etzhayyim.com                         — controller
 *   did:web:completer.etzhayyim.com:audit:{auditId}         — an audit
 *   did:web:completer.etzhayyim.com:finding:{findingId}     — a finding
 */

export const COMPLETER_DID_PREFIX = "did:web:completer.etzhayyim.com:" as const;

export const AUDIT_COLLECTION = "com.etzhayyim.apps.completer.audit";
export const FINDING_COLLECTION = "com.etzhayyim.apps.completer.finding";

// ─── Audit ──────────────────────────────────────────────────────────

export type AuditStatus = "running" | "completed";

export interface AuditRecord {
  did: string;
  auditId: string;
  /** DID being evaluated. */
  subjectDid: string;
  jurisdiction?: string;
  status: AuditStatus;
  startedAt: string;
  finishedAt?: string;
  /** Compliance score 0..100 (set on completion). */
  score?: number;
  createdAt: string;
}
export interface AuditView extends AuditRecord {
  auditUri: string;
}
export interface StartAuditInput {
  auditId: string;
  subjectDid: string;
  jurisdiction?: string;
  startedAt: string;
}
export interface StartAuditOutput {
  status: "started" | "alreadyExists" | "rejected";
  auditUri?: string;
  did?: string;
  auditId?: string;
  error?: string;
}
export interface CompleteAuditInput {
  auditId: string;
  finishedAt: string;
  score: number;
}
export interface CompleteAuditOutput {
  status: "completed" | "notFound" | "rejected";
  auditId?: string;
  score?: number;
  error?: string;
}
export interface GetAuditInput {
  auditId: string;
}
export interface GetAuditOutput {
  audit?: AuditView;
  error?: string;
}
export interface ListAuditsInput {
  subjectDid?: string;
  status?: AuditStatus;
  jurisdiction?: string;
  limit?: number;
  cursor?: string;
}
export interface ListAuditsOutput {
  items: AuditView[];
  cursor?: string;
  total: number;
}

// ─── Finding ────────────────────────────────────────────────────────

export type Severity = "info" | "low" | "medium" | "high" | "critical";
export type FindingStatus = "open" | "remediated" | "accepted" | "wontfix";

export interface FindingRecord {
  did: string;
  findingId: string;
  /** FK → audit auditId. */
  auditId: string;
  /** DID the finding concerns (denormalized from the audit). */
  subjectDid: string;
  /** Compliance rule identifier. */
  rule: string;
  severity: Severity;
  status: FindingStatus;
  /** LLM-generated remediation recommendation (set on remediate). */
  recommendation?: string;
  createdAt: string;
}
export interface FindingView extends FindingRecord {
  findingUri: string;
}
export interface AddFindingInput {
  findingId: string;
  auditId: string;
  rule: string;
  severity: Severity;
  recommendation?: string;
}
export interface AddFindingOutput {
  status: "added" | "alreadyExists" | "rejected" | "auditNotFound";
  findingUri?: string;
  did?: string;
  findingId?: string;
  error?: string;
}
export interface ResolveFindingInput {
  findingId: string;
  resolution: "remediated" | "accepted" | "wontfix";
  recommendation?: string;
}
export interface ResolveFindingOutput {
  status: "resolved" | "notFound" | "rejected";
  findingId?: string;
  newStatus?: FindingStatus;
  error?: string;
}
export interface ListFindingsInput {
  auditId?: string;
  subjectDid?: string;
  severity?: Severity;
  status?: FindingStatus;
  limit?: number;
  cursor?: string;
}
export interface ListFindingsOutput {
  items: FindingView[];
  cursor?: string;
  total: number;
}

// ─── Compliance score (rollup) ──────────────────────────────────────

export interface GetComplianceScoreInput {
  subjectDid: string;
  maxScan?: number;
}
export interface GetComplianceScoreOutput {
  subjectDid?: string;
  /** Latest completed audit score for the subject, if any. */
  latestScore?: number;
  openFindings?: number;
  findingsBySeverity?: Record<string, number>;
  truncated?: boolean;
  error?: string;
}

// ─── Coverage ───────────────────────────────────────────────────────

export interface CoverageInput {
  maxScan?: number;
}
export interface CoverageOutput {
  auditCount?: number;
  findingCount?: number;
  auditsByStatus?: Record<string, number>;
  findingsBySeverity?: Record<string, number>;
  openFindings?: number;
  truncated?: boolean;
  error?: string;
}

// ─── Validation + helpers ───────────────────────────────────────────

export const SEVERITIES: ReadonlySet<string> = new Set(["info", "low", "medium", "high", "critical"]);

export function isScore(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 100;
}

export function auditDidFor(id: string): string {
  return `${COMPLETER_DID_PREFIX}audit:${id.toLowerCase()}`;
}
export function auditRkey(id: string): string {
  return `audit-${id.toLowerCase()}`;
}
export function findingDidFor(id: string): string {
  return `${COMPLETER_DID_PREFIX}finding:${id.toLowerCase()}`;
}
export function findingRkey(id: string): string {
  return `finding-${id.toLowerCase()}`;
}
