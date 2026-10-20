# app-completer（スコア・effect）— itonami（dapp）上の分散型設計

状態: 第 1 スライス実装（2026-10-20）。正本はこの文書。
追跡: Linear JUN-128（親 JUN-116）。app-completer の第 2 スライス。

## このスライス: スコア・effect 判定コア

| 層 | 実体 | 状態 |
|---|---|---|
| 判定コア guest | `aiueos/completer_score.cljk` — deduction-of（**critical -25 / high -15 / medium -5 / low -2**、info 等は 0）/ score-after（**下限 0** — 負のスコアは無い）/ effect-code（**critical → deny / high・medium → allow-with-obligations / 無ければ allow**） | **実装済み・実測** |
| 記述子 | `aiueos/completer-score.edn` | **実装済み** |
| parity | `kotoba/test/completer/score_parity_test.cljk` — 正本（AGENTS.md の Score Calculation）の減点式・下限・effect と一致 | **実装済み・実測** |

実測: `amu test aiueos/completer_score.cljk` → **15/15**（jvm-kir / js / wasm）。
parity → 7 assertions / 0 failures。

## 正本の正確な規則（guest はこれに追従 —— AGENTS.md「5. Score Calculation」）

- **減点式**: critical: -25, high: -15, medium: -5, low: -2（**min 0**）。
- **effect**: deny（critical）/ allow-with-obligations（high/medium）/ allow。
  critical は最優先（同居する high/medium より強い）。
- 正本は registry.ts ではなく **AGENTS.md の Evaluation Flow**（実装は評価
  actor 側 / LLM フロー）—— search の Runbook-as-SSoT と同じ形。

## 未実装境界

- 減点の適用（何件の finding を数えるか — open のみか全 finding か）は
  評価フロー側。guest は減点表と effect の判定のみ。
- coverage 集計（coverage.ts 的なもの）と rule matching の判定。
- mon（DNA）化、aiueos session 載せ（fleet 共通）。
