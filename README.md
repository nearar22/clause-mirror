# ClauseMirror

ClauseMirror is a GenLayer application for auditing whether a translated agreement preserves the material meaning of its source. It freezes two public HTTPS documents, uses validator consensus to compare obligations and exceptions, and stores every finding with exact source and target quotations plus SHA-256 receipts.

## Lifecycle

1. A publisher opens a dossier with distinct source and translation URLs and appoints an independent reviewer.
2. Anyone may trigger the validator audit while the dossier is `READY`.
3. The contract derives `ALIGNED`, `REVIEW`, or `BLOCKED` from quote-bound findings; it never trusts a model-supplied overall score.
4. The reviewer may request a revision. Only the publisher can replace the translation, and only with a new URL.
5. Validators reassess the replacement. Only the independent reviewer can seal the final receipt.

## Why consensus matters

Literal string matching cannot establish that duties, deadlines, exceptions, amounts, and remedies mean the same thing in two languages. Validators independently fetch the complete documents and reject proposals that omit material clauses, soften duties, change numbers, invent quotes, or preserve only the same top-level label.

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
- Contract: [`0x2f9A...46C0`](https://explorer-studio-dev.genlayer.com/address/0x2f9AF7E3F799ed01173f4914f5bFcaDe713846C0)
- Deployment: [`0xc253...5bff`](https://explorer-studio-dev.genlayer.com/tx/0xc2539e8df04ba29120ddf079a72c328d6db8cccb4d8f78ae66f31eccd9d05bff)
- Live dossier creation: [`0x4a1e...6784`](https://explorer-studio-dev.genlayer.com/tx/0x4a1eed6e03c585be811c1e2137a9b929035ed6c4a31801a0119dd5aadacf6784)
- Validator assessment: [`0xf1a2...45ce`](https://explorer-studio-dev.genlayer.com/tx/0xf1a240f31edb3f248fa352a787799f54991583c99acdb4119d85bb381e5f45ce), finalized as `ASSESSED / ALIGNED`
- Deployed and repository source SHA-256: `19f0c07389444d04702a90be32fb1e2cfdc1f3bc508970e80a88f8ab017ef476`

The complete machine-readable record is in `deployment.json`.
