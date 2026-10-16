# ClauseMirror

ClauseMirror is a GenLayer application for auditing whether a translated agreement preserves the material meaning of its source. It freezes the complete normalized bodies of two public HTTPS documents, uses validator consensus to compare obligations and exceptions, and stores every finding with exact source and target quotations plus SHA-256 receipts.

## Lifecycle

1. A publisher opens a dossier with distinct source and translation URLs and appoints an independent reviewer.
2. Anyone freezes a complete evidence snapshot while the dossier is `EVIDENCE_PENDING`. Oversized or incomplete documents fail instead of being silently truncated.
3. The `FROZEN` snapshot is assessed without another web fetch. The contract derives `ALIGNED`, `REVIEW`, or `BLOCKED` from quote-bound findings; it never trusts a model-supplied overall score.
4. Non-aligned results become `REVISION_REQUIRED`. The reviewer records the correction request, only the publisher can replace the translation, and every earlier snapshot remains queryable.
5. Only a complete `ALIGNED` result becomes `AWAITING_SIGNOFF`. The independent reviewer can authorize release, producing a receipt bound to the snapshot and findings digests.
6. Only the publisher can register the SHA-256 digest of the released artifact. Until then the release gate remains closed; after registration the dossier is `RELEASED`.

## Why consensus matters

Literal string matching cannot establish that duties, deadlines, exceptions, amounts, and remedies mean the same thing in two languages. Validators independently fetch the complete documents and reject proposals that omit material clauses, soften duties, change numbers, invent quotes, or preserve only the same top-level label.

The trustless consequence is explicit: an incomplete, ambiguous, contradictory, or omitted clause can never authorize a release. The `get_release_gate` view exposes the decision and its bound artifact digest to downstream systems.

## Safety boundary

ClauseMirror records a semantic evidence audit. It does not certify a translator, determine governing law, establish enforceability, or replace professional legal review. A caller-supplied URL is evidence to inspect, not an automatically authoritative source.

The two files under `docs/demo-agreement-*.txt` are operator-created smoke-test fixtures, not independent or authoritative legal documents.

## Run locally

```bash
python -m pytest tests -q
genvm-lint lint contracts/clause_mirror.py --json
cd frontend
npm ci
npm test
npm run build
```

The frontend targets GenLayer Studio Next, chain `61997`. Copy `frontend/.env.example` to `frontend/.env` and set `VITE_CONTRACT_ADDRESS` after deployment.

## Verified Studio Next deployment

- App: [clause-mirror.pages.dev](https://clause-mirror.pages.dev)
- Contract: [`0x504a...7829`](https://explorer-studio-dev.genlayer.com/address/0x504a4Bb7E7b10D22A9FDf4027d18A2edCc187829)
- Deployment: [`0x1488...1b89`](https://explorer-studio-dev.genlayer.com/tx/0x148850d20c491f5d7b6179614c3e6f8778bc055429b7b927bf7b756934001b89)
- Complete snapshot: [`0xf78f...6d52`](https://explorer-studio-dev.genlayer.com/tx/0xf78f6bb3670eac8b5f48f74d376efa194d2791720d0ade74b0db7505b8366d52)
- Validator assessment: [`0x120e...31c6`](https://explorer-studio-dev.genlayer.com/tx/0x120ecd3d1e95d9296b812ad02699463860bc7dc9e348c495222e53e5b3c931c6), finalized as `AWAITING_SIGNOFF / ALIGNED`
- Independent authorization: [`0x8f51...eb9b4`](https://explorer-studio-dev.genlayer.com/tx/0x8f517b2cdfef1048a75e6a6f6204f7a008c172ac81a1486d884c08afb63eb9b4)
- Artifact release: [`0x33c3...a6cb`](https://explorer-studio-dev.genlayer.com/tx/0x33c3cc863906e47c0603fb95f57d450adbad25a1611048898fc6211ba4aaa6cb), final state `RELEASED`
- Deployed and repository source SHA-256: `1e18c8a523a527b6e5955647d942fca2ec8534eb895432c920ba7bc5a8294cb6`

The complete machine-readable record is in `deployment.json`.
