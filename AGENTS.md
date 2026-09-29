# etzhayyim-project-completer — DID Compliance Actor

## App Identity

| Key | Value |
|---|---|
| **nanoid** | `ktugb754` |
| **domain** | `completer.etzhayyim.com` |
| **performer_id** | `ktugb754` |
| **AT bot DID** | `did:web:completer-ktugb754.etzhayyim.com` |
| **World** | `etzhayyim-actor-agent` (LLM agent for compliance reasoning) |

## Purpose

repo 内の DID manifest と actor governance metadata の compliance 準拠状態を自律的に評価する actor。**評価専門 — ingest は行わない。**

- **分散 Ingest Architecture (Follow-Based)**: Authority/Rule/Scope ノードの生成は各 authority app (states/treaty/religious/customary/tradition/ethics/industry-standard) が自律的に行う。completer は全 authority app を Follow し、graph query で Rule を横断取得して評価する。中央 ingest agent は存在しない
- `kotodama:compliance@1.0.0` WIT contract を用いて jurisdiction-aware な評価を実行
- murakumo LLM で compliance gap の自然言語分析・remediation 推奨を生成
- 評価結果を AT record として publish し、app owner channel に通知
- `90-docs/260323-authority-chain-compliance-design.md` が authoritative design doc

## Architecture

### Command Path (AT Record → Firehose)

| Lexicon | Method | Description |
|---|---|---|
| `com.etzhayyim.command.completer.evaluate` | `audit.evaluate` | 単一 DID / actor manifest の compliance 評価を実行 |
| `com.etzhayyim.command.completer.evaluate_repo_dids` | `audit.evaluate_repo_dids` | repo 内 DID manifest 群の一括評価 |
| `com.etzhayyim.command.completer.remediate` | `remediation.recommend` | 特定 finding に対する remediation 推奨生成 |

### Query Path (XRPC)

| Service | Method | Description |
|---|---|---|
| `CompleterQueryService` | `GetAuditReport` | app 別の最新 compliance レポート取得 |
| `CompleterQueryService` | `ListFindings` | finding 一覧 (severity/jurisdiction filter) |
| `CompleterQueryService` | `ListAudits` | 監査履歴一覧 |
| `CompleterQueryService` | `GetComplianceScore` | app 別の compliance スコア (0-100) |

### AT Firehose Subscription

| Collection | Purpose |
|---|---|
| `com.etzhayyim.app.service` | 新規 app 登録の検出 → 自動 profile 作成 |
| `com.etzhayyim.command.completer` | Command dispatch |

### AT Record Output

| Lexicon | Description |
|---|---|
| `com.etzhayyim.completer.audit` | 監査実行結果 (`actorId`, score, effect, jurisdictions, evaluated_at) |
| `com.etzhayyim.completer.finding` | 個別指摘 (rule_ref, risk_level, obligation, remediation_hint) |
| `com.etzhayyim.completer.remediation` | 改善推奨 (finding_id, action_plan, priority, estimated_effort) |

### AT Channels

| Channel | Purpose |
|---|---|
| `at://team-ktugb754` | Daily evolution team critique |
| `at://evo-ktugb754` | Evolution proposals |
| `at://audit-ktugb754` | Audit result publication |

## Data Model (W Protocol Event Stream)

Write: `WRecord(kind, payload)` → PDS → yata SQL direct (SHA-256 content CID)
Read (SQL): `G("Kind").Match(Eq{...}).Return("prop").Query()` (SQL)
Read (Graph): `G("Label").Match(Eq{...}).Return("prop").Query()` (SQL)

### `compliance-audit` (WRecord kind)

| Column | Type | Description |
|---|---|---|
| `audit_id` | string | Primary key (nanoid) |
| `actor_id` | string | 評価対象 actor の stable ID |
| `actor_name` | string | Actor canonical name |
| `actor_display_name` | string | Actor display name |
| `score` | int32 | Compliance score (0-100) |
| `effect` | string | `allow` / `allow-with-obligations` / `deny` / `review-required` |
| `total_findings` | int32 | Finding 総数 |
| `critical_findings` | int32 | Critical finding 数 |
| `high_findings` | int32 | High finding 数 |
| `evaluated_jurisdictions` | string | JSON array of jurisdiction codes |
| `rule_bundle_ids` | string | JSON array of evaluated rule bundle IDs |
| `summary` | string | LLM 生成の評価サマリー |
| `evaluated_at` | string | RFC 3339 |
| `org_id` | string | RLS (default `'anon'`) |
| `user_id` | string | RLS (default `'anon'`) |
| `actor_id` | string | RLS (default `''`) |

### `compliance-finding` (WRecord kind)

| Column | Type | Description |
|---|---|---|
| `finding_id` | string | Primary key (nanoid) |
| `audit_id` | string | FK → completer_audits |
| `actor_id` | string | 評価対象 actor |
| `rule_id` | string | Matched rule ID |
| `rule_title` | string | Rule display title |
| `jurisdiction` | string | Applicable jurisdiction (e.g. `JP`, `US`) |
| `risk_level` | string | `low` / `medium` / `high` / `critical` |
| `obligation_kind` | string | Required obligation type |
| `summary` | string | Finding description |
| `remediation_hint` | string | LLM 生成の改善ヒント |
| `status` | string | `open` / `acknowledged` / `resolved` / `accepted_risk` |
| `resolved_at` | string | RFC 3339 (nullable) |
| `org_id` | string | RLS |
| `user_id` | string | RLS |
| `actor_id` | string | RLS |

### `app-profile` (WRecord kind)

| Column | Type | Description |
|---|---|---|
| `actor_id` | string | Primary key (actor stable ID) |
| `actor_name` | string | Actor canonical name |
| `actor_display_name` | string | Actor display name |
| `app_did` | string | AT bot DID |
| `home_jurisdiction` | string | Primary jurisdiction |
| `operating_jurisdictions` | string | JSON array |
| `sector_codes` | string | JSON array (ISIC/APQC) |
| `data_categories` | string | JSON array |
| `rule_bundle_ids` | string | JSON array of applicable bundles |
| `last_audit_id` | string | FK → completer_audits |
| `last_audit_score` | int32 | Latest score |
| `last_audit_at` | string | RFC 3339 |
| `org_id` | string | RLS |
| `user_id` | string | RLS |
| `actor_id` | string | RLS |

## Cross-actor Integration (Authority-Chain graph query)

completer は全 authority app を Follow し、graph query で Rule を直接取得する。

| Direction | Method | Description |
|---|---|---|
| completer → graph | `scan-rules(jurisdiction, sector)` | Authority-Chain SQL graph から jurisdiction/sector 適用 Rule を横断検索 |
| authority apps → completer | Follow (ATPost) | 各 authority app の新規 Rule 生成 ATPost を ComAtprotoSyncSubscribeRepos で受信 → 影響 app を再評価 |

## Evaluation Flow

```
1. App Registration
   → Register in app_profiles (manual or AT Firehose discovery)

2. Rule Discovery (graph query — 分散 ingest 後)
   → 各 authority app (states/treaty/religious/customary/tradition/ethics/industry-standard) が自律的に Rule 生成済み
   → completer が Authority-Chain graph を直接 query:
     MATCH (app:App {nanoid: $nanoid})-[:OPERATES_IN]->(s:Scope)
     MATCH (r:Rule)-[:APPLIES_TO]->(s)
     RETURN r
   → jurisdiction + sector_codes でフィルタ

3. Rule Matching
   → app_profiles.operating_jurisdictions × sector_codes で Rule 検索
   → Rule.obligation vs app capabilities で適合性判定

4. LLM Compliance Evaluation (murakumo)
   → 各ルールに対して app capabilities を評価
   → non-compliant → finding 生成

5. Score Calculation
   → critical: -25, high: -15, medium: -5, low: -2 (min 0)
   → effect: deny (critical), allow-with-obligations (high/medium), allow

6. Result Publication
   → audits + findings テーブル永続化
   → WSend → compliance-audits/alerts/remediations チャンネル
```

## Daily Evolution

ISCO 5-agent team evaluates completer's own effectiveness:

- **BM (1211)**: Audit coverage KPI, false positive rate, app onboarding velocity
- **PO (1120)**: App owner satisfaction, remediation actionability
- **MK (2433)**: Compliance score trend across platform, regulatory update velocity
- **ENG (2512)**: Evaluation latency, rule bundle coverage, LLM prompt efficiency
- **QA (2519)**: Audit accuracy, edge case coverage, regression in rule matching
