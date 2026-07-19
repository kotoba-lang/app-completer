import { describe, it, expect, beforeEach } from "vitest";
import { MockEtzhayyim } from "@etzhayyim/sdk-mock";
import {
  startAudit,
  completeAudit,
  getAudit,
  listAudits,
  addFinding,
  resolveFinding,
  listFindings,
  getComplianceScore,
  coverage,
} from "../src/index.js";

const SUBJECT = "did:web:some-actor.etzhayyim.com";

describe("completer kotoba", () => {
  let e: any;
  beforeEach(() => {
    e = new MockEtzhayyim({ did: "did:web:completer.etzhayyim.com" });
  });

  describe("audit lifecycle", () => {
    it("starts, completes with score, rejects bad DID/score/double-complete", async () => {
      expect((await startAudit(e, { auditId: "A-1", subjectDid: SUBJECT, jurisdiction: "JP", startedAt: "2026-06-01T00:00:00Z" })).status).toBe("started");
      expect((await startAudit(e, { auditId: "A-X", subjectDid: "nope", startedAt: "x" })).status).toBe("rejected");
      expect((await completeAudit(e, { auditId: "A-1", finishedAt: "2026-06-01T01:00:00Z", score: 87 })).score).toBe(87);
      expect((await completeAudit(e, { auditId: "A-1", finishedAt: "x", score: 90 })).status).toBe("rejected"); // already completed
      expect((await completeAudit(e, { auditId: "A-2", finishedAt: "x", score: 150 })).status).toBe("rejected"); // bad score (and not found order: score validated first)
      expect((await getAudit(e, { auditId: "A-1" })).audit?.status).toBe("completed");
      expect((await listAudits(e, { subjectDid: SUBJECT, status: "completed" })).total).toBe(1);
    });
  });

  describe("findings + score rollup", () => {
    beforeEach(async () => {
      await startAudit(e, { auditId: "A-1", subjectDid: SUBJECT, startedAt: "2026-06-01T00:00:00Z" });
    });
    it("adds findings (FK→audit, denorm subject), rejects bad audit/severity, resolves", async () => {
      expect((await addFinding(e, { findingId: "F-1", auditId: "A-1", rule: "did-doc-present", severity: "high" })).status).toBe("added");
      expect((await listFindings(e, { subjectDid: SUBJECT })).total).toBe(1); // subjectDid denormalized
      expect((await addFinding(e, { findingId: "F-X", auditId: "GHOST", rule: "x", severity: "low" })).status).toBe("auditNotFound");
      expect((await addFinding(e, { findingId: "F-Y", auditId: "A-1", rule: "x", severity: "fatal" as any })).status).toBe("rejected");
      expect((await resolveFinding(e, { findingId: "F-1", resolution: "remediated", recommendation: "added doc" })).newStatus).toBe("remediated");
      expect((await resolveFinding(e, { findingId: "F-1", resolution: "accepted" })).status).toBe("rejected"); // not open
      expect((await listFindings(e, { status: "open" })).total).toBe(0);
    });
    it("getComplianceScore returns latest audit score + open findings; coverage rolls up", async () => {
      await completeAudit(e, { auditId: "A-1", finishedAt: "2026-06-01T01:00:00Z", score: 70 });
      await addFinding(e, { findingId: "F-1", auditId: "A-1", rule: "r1", severity: "critical" });
      await addFinding(e, { findingId: "F-2", auditId: "A-1", rule: "r2", severity: "low" });
      await resolveFinding(e, { findingId: "F-2", resolution: "accepted" });
      const score = await getComplianceScore(e, { subjectDid: SUBJECT });
      expect(score.latestScore).toBe(70);
      expect(score.openFindings).toBe(1);
      expect(score.findingsBySeverity?.critical).toBe(1);
      const cov = await coverage(e);
      expect(cov.auditCount).toBe(1);
      expect(cov.findingCount).toBe(2);
      expect(cov.openFindings).toBe(1);
      expect(cov.auditsByStatus?.completed).toBe(1);
    });
  });
});
