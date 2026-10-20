# app-completer（finding 解決・score）— itonami（dapp）上の分散型設計

状態: 第 1 スライス実装（2026-10-20）。正本はこの文書。
追跡: Linear JUN-128（親 JUN-116）。

## 位置づけ

app-completer は **DID コンプライアンス actor** —— repo の DID manifest と
actor governance metadata の準拠状態を評価する。**評価専門（ingest しない）**。
Authority/Rule/Scope の生成は各 authority app が自律的に行い、completer は
Follow して横断評価（`kotodama:compliance@1.0.0`）。

## このスライス: finding 解決・score 判定コア

| 層 | 実体 | 状態 |
|---|---|---|
| 判定コア guest | `aiueos/completer_resolve.cljk` — resolve-judgment（**open のみ解決可** → remediated/accepted/wontfix。再解決は拒否）/ resolution-admissible（閉じた 3 つ）/ score-ok（0..100 整数）/ score-take（**completed audit の最新 finishedAt のみ採用**） | **実装済み・実測** |
| 記述子 | `aiueos/completer-resolve.edn` | **実装済み** |
| parity | `kotoba/test/completer/resolve_parity_test.cljk` — 正本（registry.ts / types.ts）の状態遷移・score 範囲・集計規則と一致 | **実装済み・実測** |

実測: `amu test aiueos/completer_resolve.cljk` → **18/18**（jvm-kir / js / wasm）。
parity → 10 assertions / 0 failures。

## 正本の正確な規則（guest はこれに追従）

- **finding の状態遷移**: `open → {remediated, accepted, wontfix}` の 1 方向。
  解決済みの再解決は `findingNotOpen:{現状態}` で拒否。resolution に
  open は指定できない（invalidResolution）。
- 拒否の順序: findingId → resolution → 見つからない → open でない
  （guest の resolve-judgment もこの順でコードを返す）。
- **score は 0..100 の整数**（isScore: Number.isInteger && 0..100）。
- **スコア集計は completed audit の最新 finishedAt** —— running 中の score は
  数えない（評価の途中結果を確定値として扱わない）。

## 未実装境界

- audit のカバレッジ集計（Coverage）と finding の severity 集計。
- jurisdiction-aware 評価そのもの（Rule 横断取得 = graph query）。
- startAudit の subjectDid 形判定（did: 始まり）は同族の規則 —— 次スライス候補。
- mon（DNA）化、aiueos session 載せ（fleet 共通）。
