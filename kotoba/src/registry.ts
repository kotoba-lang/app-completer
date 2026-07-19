/**
 * completer kotoba — audit + finding registries + compliance-score rollup +
 * coverage. AT PDS records (no RW). Findings FK-reference an existing audit and
 * denormalize its subjectDid. Governance metadata only.
 */

import type { Etzhayyim } from "@etzhayyim/sdk";
import {
  AUDIT_COLLECTION,
  FINDING_COLLECTION,
  SEVERITIES,
  auditDidFor,
  auditRkey,
  findingDidFor,
  findingRkey,
  isScore,
  type AddFindingInput,
  type AddFindingOutput,
  type AuditRecord,
  type AuditView,
  type CompleteAuditInput,
  type CompleteAuditOutput,
  type CoverageInput,
  type CoverageOutput,
  type FindingRecord,
  type FindingView,
  type GetAuditInput,
  type GetAuditOutput,
  type GetComplianceScoreInput,
  type GetComplianceScoreOutput,
  type ListAuditsInput,
  type ListAuditsOutput,
  type ListFindingsInput,
  type ListFindingsOutput,
  type ResolveFindingInput,
  type ResolveFindingOutput,
  type Severity,
  type StartAuditInput,
  type StartAuditOutput,
} from "./types.js";

const PAGE_LIMIT = 100;
const DEFAULT_MAX_SCAN = 10_000;

// ─── Audit ──────────────────────────────────────────────────────────

export async function startAudit(e: Etzhayyim, input: StartAuditInput): Promise<StartAuditOutput> {
  if (!input.auditId || !input.subjectDid || !input.startedAt) return { status: "rejected", error: "missingRequiredFields" };
  if (!input.subjectDid.startsWith("did:")) return { status: "rejected", error: "invalidSubjectDid" };
  const rkey = auditRkey(input.auditId);
  const existing = await e.read<AuditRecord>({ collection: AUDIT_COLLECTION, rkey }).catch(() => ({ records: [] }));
  if (existing.records[0]?.value) {
    return { status: "alreadyExists", auditUri: existing.records[0].uri, did: existing.records[0].value.did, auditId: input.auditId };
  }
  const did = auditDidFor(input.auditId);
  const record: AuditRecord = {
    did,
    auditId: input.auditId,
    subjectDid: input.subjectDid,
    jurisdiction: input.jurisdiction,
    status: "running",
    startedAt: input.startedAt,
    createdAt: new Date().toISOString(),
  };
  const receipt = await e.write({ collection: AUDIT_COLLECTION, record: record as unknown as Record<string, unknown>, rkey });
  return { status: "started", auditUri: receipt.uri, did, auditId: input.auditId };
}

export async function completeAudit(e: Etzhayyim, input: CompleteAuditInput): Promise<CompleteAuditOutput> {
  if (!input.auditId || !input.finishedAt) return { status: "rejected", error: "missingRequiredFields" };
  if (!isScore(input.score)) return { status: "rejected", error: "scoreMustBeInt0to100" };
  const rkey = auditRkey(input.auditId);
  const resp = await e.read<AuditRecord>({ collection: AUDIT_COLLECTION, rkey }).catch(() => ({ records: [] }));
  const audit = resp.records[0]?.value;
  if (!audit) return { status: "notFound", error: "auditNotFound" };
  if (audit.status === "completed") return { status: "rejected", error: "alreadyCompleted" };
  await e.write({
    collection: AUDIT_COLLECTION,
    record: { ...audit, status: "completed", finishedAt: input.finishedAt, score: input.score } as unknown as Record<string, unknown>,
    rkey,
  });
  return { status: "completed", auditId: input.auditId, score: input.score };
}

export async function getAudit(e: Etzhayyim, input: GetAuditInput): Promise<GetAuditOutput> {
  if (!input.auditId) return { error: "invalidAuditId" };
  const resp = await e.read<AuditRecord>({ collection: AUDIT_COLLECTION, rkey: auditRkey(input.auditId) }).catch(() => ({ records: [] }));
  const r = resp.records[0];
  if (!r) return { error: "notFound" };
  return { audit: { ...r.value, auditUri: r.uri } };
}

export async function listAudits(e: Etzhayyim, input: ListAuditsInput = {}): Promise<ListAuditsOutput> {
  const limit = Math.min(input.limit ?? 50, 200);
  const resp = await e.read<AuditRecord>({ collection: AUDIT_COLLECTION, cursor: input.cursor, limit });
  const items: AuditView[] = resp.records
    .filter((r) => {
      const v = r.value;
      if (input.subjectDid && v.subjectDid !== input.subjectDid) return false;
      if (input.status && v.status !== input.status) return false;
      if (input.jurisdiction && v.jurisdiction !== input.jurisdiction) return false;
      return true;
    })
    .map((r) => ({ ...r.value, auditUri: r.uri }));
  return { items, cursor: resp.cursor, total: items.length };
}

// ─── Finding ────────────────────────────────────────────────────────

export async function addFinding(e: Etzhayyim, input: AddFindingInput): Promise<AddFindingOutput> {
  if (!input.findingId || !input.auditId || !input.rule) return { status: "rejected", error: "missingRequiredFields" };
  if (!SEVERITIES.has(input.severity)) return { status: "rejected", error: "invalidSeverity" };
  const auditResp = await e.read<AuditRecord>({ collection: AUDIT_COLLECTION, rkey: auditRkey(input.auditId) }).catch(() => ({ records: [] }));
  const audit = auditResp.records[0]?.value;
  if (!audit) return { status: "auditNotFound", error: `auditNotFound:${input.auditId}` };
  const rkey = findingRkey(input.findingId);
  const existing = await e.read<FindingRecord>({ collection: FINDING_COLLECTION, rkey }).catch(() => ({ records: [] }));
  if (existing.records[0]?.value) {
    return { status: "alreadyExists", findingUri: existing.records[0].uri, did: existing.records[0].value.did, findingId: input.findingId };
  }
  const did = findingDidFor(input.findingId);
  const record: FindingRecord = {
    did,
    findingId: input.findingId,
    auditId: input.auditId,
    subjectDid: audit.subjectDid,
    rule: input.rule,
    severity: input.severity,
    status: "open",
    recommendation: input.recommendation,
    createdAt: new Date().toISOString(),
  };
  const receipt = await e.write({ collection: FINDING_COLLECTION, record: record as unknown as Record<string, unknown>, rkey });
  return { status: "added", findingUri: receipt.uri, did, findingId: input.findingId };
}

export async function resolveFinding(e: Etzhayyim, input: ResolveFindingInput): Promise<ResolveFindingOutput> {
  if (!input.findingId) return { status: "rejected", error: "invalidFindingId" };
  if (!["remediated", "accepted", "wontfix"].includes(input.resolution)) return { status: "rejected", error: "invalidResolution" };
  const rkey = findingRkey(input.findingId);
  const resp = await e.read<FindingRecord>({ collection: FINDING_COLLECTION, rkey }).catch(() => ({ records: [] }));
  const finding = resp.records[0]?.value;
  if (!finding) return { status: "notFound", error: "findingNotFound" };
  if (finding.status !== "open") return { status: "rejected", error: `findingNotOpen:${finding.status}` };
  await e.write({
    collection: FINDING_COLLECTION,
    record: { ...finding, status: input.resolution, recommendation: input.recommendation ?? finding.recommendation } as unknown as Record<string, unknown>,
    rkey,
  });
  return { status: "resolved", findingId: input.findingId, newStatus: input.resolution };
}

export async function listFindings(e: Etzhayyim, input: ListFindingsInput = {}): Promise<ListFindingsOutput> {
  const limit = Math.min(input.limit ?? 50, 200);
  const resp = await e.read<FindingRecord>({ collection: FINDING_COLLECTION, cursor: input.cursor, limit });
  const items: FindingView[] = resp.records
    .filter((r) => {
      const v = r.value;
      if (input.auditId && v.auditId !== input.auditId) return false;
      if (input.subjectDid && v.subjectDid !== input.subjectDid) return false;
      if (input.severity && v.severity !== input.severity) return false;
      if (input.status && v.status !== input.status) return false;
      return true;
    })
    .map((r) => ({ ...r.value, findingUri: r.uri }));
  return { items, cursor: resp.cursor, total: items.length };
}

// ─── Compliance score (rollup) ──────────────────────────────────────

async function scanAll<T>(e: Etzhayyim, collection: string, maxScan: number, onRow: (v: T) => void): Promise<number> {
  let cursor: string | undefined;
  let scanned = 0;
  while (scanned < maxScan) {
    const page = await e.read<T>({ collection, cursor, limit: PAGE_LIMIT });
    for (const r of page.records) {
      if (scanned >= maxScan) break;
      onRow(r.value);
      scanned += 1;
    }
    if (scanned >= maxScan || !page.cursor || page.records.length < PAGE_LIMIT) break;
    cursor = page.cursor;
  }
  return scanned;
}

export async function getComplianceScore(e: Etzhayyim, input: GetComplianceScoreInput): Promise<GetComplianceScoreOutput> {
  if (!input.subjectDid) return { error: "invalidSubjectDid" };
  const maxScan = Math.min(input.maxScan ?? DEFAULT_MAX_SCAN, DEFAULT_MAX_SCAN);
  let latestScore: number | undefined;
  let latestFinishedAt: string | undefined;
  const auditScanned = await scanAll<AuditRecord>(e, AUDIT_COLLECTION, maxScan, (v) => {
    if (v.subjectDid !== input.subjectDid) return;
    if (v.status === "completed" && v.score !== undefined) {
      if (!latestFinishedAt || (v.finishedAt ?? "") > latestFinishedAt) {
        latestFinishedAt = v.finishedAt;
        latestScore = v.score;
      }
    }
  });
  const findingsBySeverity: Record<string, number> = {};
  let openFindings = 0;
  const findingScanned = await scanAll<FindingRecord>(e, FINDING_COLLECTION, maxScan, (v) => {
    if (v.subjectDid !== input.subjectDid) return;
    if (v.status === "open") {
      openFindings += 1;
      findingsBySeverity[v.severity] = (findingsBySeverity[v.severity] ?? 0) + 1;
    }
  });
  return {
    subjectDid: input.subjectDid,
    latestScore,
    openFindings,
    findingsBySeverity,
    truncated: auditScanned >= maxScan || findingScanned >= maxScan,
  };
}

// ─── Coverage ───────────────────────────────────────────────────────

export async function coverage(e: Etzhayyim, input: CoverageInput = {}): Promise<CoverageOutput> {
  const maxScan = Math.min(input.maxScan ?? DEFAULT_MAX_SCAN, DEFAULT_MAX_SCAN);
  const auditsByStatus: Record<string, number> = {};
  const auditCount = await scanAll<AuditRecord>(e, AUDIT_COLLECTION, maxScan, (v) => {
    auditsByStatus[v.status] = (auditsByStatus[v.status] ?? 0) + 1;
  });
  const findingsBySeverity: Record<string, number> = {};
  let openFindings = 0;
  const findingCount = await scanAll<FindingRecord>(e, FINDING_COLLECTION, maxScan, (v) => {
    findingsBySeverity[v.severity] = (findingsBySeverity[v.severity] ?? 0) + 1;
    if (v.status === "open") openFindings += 1;
  });
  return {
    auditCount,
    findingCount,
    auditsByStatus,
    findingsBySeverity,
    openFindings,
    truncated: auditCount >= maxScan || findingCount >= maxScan,
  };
}
