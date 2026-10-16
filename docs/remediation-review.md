# ClauseMirror remediation review

Reviewer request: mutable and incomplete evidence snapshots, plus limited trustless consequences.

| Review boundary | Enforced behavior | Verification |
| --- | --- | --- |
| Complete evidence | Both normalized document bodies are stored in revision 0. Later revisions preserve the original source and store the full replacement target. Documents over 16,000 characters fail closed; no slicing or silent truncation occurs. | `test_freeze_stores_complete_immutable_bodies_and_receipts`, `test_oversized_document_fails_instead_of_truncating` |
| Immutable binding | Every snapshot has a deterministic SHA-256 digest over both stored documents. Assessment reads only the latest stored snapshot and records the snapshot digest in its result. | `test_assessment_uses_frozen_snapshot_and_requires_complete_inventory` |
| Complete clause inventory | Consensus output must declare coverage, match its material-clause count, use unique source quotes, and bind every quote to the frozen content. | `test_missing_or_duplicate_clause_coverage_fails_closed`, `test_forged_target_quote_fails_closed` |
| Revision audit trail | A replacement creates a new snapshot while all earlier evidence remains stored and queryable. | `test_non_aligned_result_enforces_release_block_and_preserves_revision_history` |
| Trustless consequence | Only complete aligned evidence can be authorized by the appointed reviewer. Only the owner can commit a released artifact digest. All other outcomes keep the release gate closed. | `test_only_complete_aligned_review_can_authorize_and_commit_release` |
| Public app | The UI exposes freeze, audit, revision, reviewer authorization, artifact commitment, immutable snapshot digest, and released artifact digest. | Frontend model tests and production build |
