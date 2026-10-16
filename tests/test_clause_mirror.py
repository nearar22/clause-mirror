import json, sys

CONTRACT = "contracts/clause_mirror.py"
SOURCE_URL = "https://example.org/contracts/master-agreement-en"
TARGET_URL = "https://example.org/contracts/master-agreement-fr"
REVISED_URL = "https://example.org/contracts/master-agreement-fr-v2"
SOURCE = "The Supplier must notify the Buyer within five business days after discovering a security incident. The Buyer may terminate this Agreement if the Supplier fails to cure a material breach within thirty days. Liability is capped at EUR 50,000 except in cases of fraud."
TARGET = "Le Fournisseur doit notifier l'Acheteur dans les cinq jours ouvrables suivant la découverte d'un incident de sécurité. L'Acheteur peut résilier le présent Accord si le Fournisseur ne remédie pas à un manquement grave dans les trente jours. La responsabilité est plafonnée à 50 000 EUR, sauf en cas de fraude."
REVIEWER = "0x2222222222222222222222222222222222222222"
ARTIFACT = "a" * 64


def findings(kind="ALIGNED", complete=True):
    rows = [
        {"index": 0, "classification": kind, "source_quote": "The Supplier must notify the Buyer within five business days", "target_quote": "" if kind == "OMISSION" else "Le Fournisseur doit notifier l'Acheteur dans les cinq jours ouvrables", "explanation": "The notification duty and five-business-day deadline are compared."},
        {"index": 1, "classification": "ALIGNED", "source_quote": "The Buyer may terminate this Agreement if the Supplier fails to cure a material breach within thirty days", "target_quote": "L'Acheteur peut résilier le présent Accord si le Fournisseur ne remédie pas à un manquement grave dans les trente jours", "explanation": "The termination right and cure deadline are preserved."},
        {"index": 2, "classification": "ALIGNED", "source_quote": "Liability is capped at EUR 50,000 except in cases of fraud", "target_quote": "La responsabilité est plafonnée à 50 000 EUR, sauf en cas de fraude", "explanation": "The cap amount and fraud exception are preserved."},
    ]
    return {"coverage_complete": complete, "material_clause_count": len(rows), "findings": rows}


def create(contract):
    return contract.create_dossier("supply-terms-2030", "Supply agreement mirror", "Check whether the French translation preserves the material commercial duties before independent review.", "English", "French", SOURCE_URL, TARGET_URL, REVIEWER)


def enable_consensus(contract, monkeypatch, validator=None):
    module = sys.modules[contract.__class__.__module__]
    monkeypatch.setattr(module.gl.eq_principle, "strict_eq", lambda fn: fn())
    monkeypatch.setattr(module.gl.eq_principle, "prompt_comparative", validator or (lambda fn, *_args, **_kwargs: fn()))


def web_mocks(vm, target_url=TARGET_URL, target=TARGET, source=SOURCE):
    vm.mock_web(SOURCE_URL, {"method": "GET", "status": 200, "body": source})
    vm.mock_web(target_url, {"method": "GET", "status": 200, "body": target})


def llm_mock(vm, result=None):
    vm.mock_llm("CLAUSEMIRROR_PRODUCER", json.dumps(json.dumps(result or findings())))


def freeze(contract, vm, dossier_id, target_url=TARGET_URL, target=TARGET, source=SOURCE):
    web_mocks(vm, target_url, target, source)
    result = contract.freeze_evidence(dossier_id)
    vm.clear_mocks()
    return result


def assess(contract, vm, dossier_id, result=None):
    llm_mock(vm, result)
    value = contract.assess(dossier_id)
    vm.clear_mocks()
    return value


def test_contract_loads(direct_deploy):
    assert direct_deploy(CONTRACT) is not None


def test_rejects_unsafe_duplicate_and_same_party(direct_vm, direct_deploy):
    contract = direct_deploy(CONTRACT)
    with direct_vm.expect_revert("distinct valid address"):
        contract.create_dossier("bad-reviewer", "Bad reviewer", "This purpose is sufficiently descriptive for validation.", "English", "French", SOURCE_URL, TARGET_URL, str(direct_vm.sender))
    with direct_vm.expect_revert("public HTTPS"):
        contract.create_dossier("bad-source", "Bad source", "This purpose is sufficiently descriptive for validation.", "English", "French", "http://localhost/a", TARGET_URL, REVIEWER)
    create(contract)
    with direct_vm.expect_revert("already exists"):
        create(contract)


def test_freeze_stores_complete_immutable_bodies_and_receipts(direct_vm, direct_deploy, monkeypatch):
    contract = direct_deploy(CONTRACT); enable_consensus(contract, monkeypatch); dossier_id = create(contract)
    receipt = freeze(contract, direct_vm, dossier_id)
    dossier = contract.get_dossier(dossier_id); snapshot = dossier["snapshots"][0]
    assert receipt["status"] == "FROZEN" and snapshot["complete"] is True
    assert [row["content"] for row in snapshot["documents"]] == [SOURCE, TARGET]
    assert all(row["content_length"] > 80 and len(row["sha256"]) == 64 for row in receipt["document_receipts"])
    assert len(snapshot["snapshot_digest"]) == 64


def test_oversized_document_fails_instead_of_truncating(direct_vm, direct_deploy, monkeypatch):
    contract = direct_deploy(CONTRACT); enable_consensus(contract, monkeypatch); dossier_id = create(contract)
    web_mocks(direct_vm, source="A" * 16001)
    with direct_vm.expect_revert("complete snapshot limit"):
        contract.freeze_evidence(dossier_id)


def test_assessment_uses_frozen_snapshot_and_requires_complete_inventory(direct_vm, direct_deploy, monkeypatch):
    contract = direct_deploy(CONTRACT); enable_consensus(contract, monkeypatch); dossier_id = create(contract); freeze(contract, direct_vm, dossier_id)
    # No web mock exists here. Assessment can only use the immutable stored bodies.
    result = assess(contract, direct_vm, dossier_id)
    dossier = contract.get_dossier(dossier_id)
    assert result["overall"] == "ALIGNED" and result["coverage_complete"] is True
    assert result["snapshot_digest"] == dossier["snapshots"][0]["snapshot_digest"]
    assert dossier["status"] == "AWAITING_SIGNOFF"


def test_missing_or_duplicate_clause_coverage_fails_closed(direct_vm, direct_deploy, monkeypatch):
    contract = direct_deploy(CONTRACT); enable_consensus(contract, monkeypatch); dossier_id = create(contract); freeze(contract, direct_vm, dossier_id)
    malformed = findings(); malformed["material_clause_count"] = 2
    llm_mock(direct_vm, malformed)
    with direct_vm.expect_revert("Material clause count"):
        contract.assess(dossier_id)


def test_forged_target_quote_fails_closed(direct_vm, direct_deploy, monkeypatch):
    contract = direct_deploy(CONTRACT); enable_consensus(contract, monkeypatch); dossier_id = create(contract); freeze(contract, direct_vm, dossier_id)
    forged = findings(); forged["findings"][0]["target_quote"] = "Le contrat est automatiquement approuvé"
    llm_mock(direct_vm, forged)
    with direct_vm.expect_revert("Target quote"):
        contract.assess(dossier_id)


def test_non_aligned_result_enforces_release_block_and_preserves_revision_history(direct_vm, direct_deploy, direct_alice, monkeypatch):
    contract = direct_deploy(CONTRACT); enable_consensus(contract, monkeypatch); direct_vm.sender = direct_alice; dossier_id = create(contract); first = freeze(contract, direct_vm, dossier_id)
    blocked = assess(contract, direct_vm, dossier_id, findings("OMISSION"))
    assert blocked["overall"] == "BLOCKED" and contract.get_release_gate(dossier_id)["authorized"] is False
    with direct_vm.expect_revert("Release is blocked"):
        contract.commit_release(dossier_id, ARTIFACT)
    with direct_vm.expect_revert("independent reviewer"):
        contract.request_revision(dossier_id, "Restore the omitted notification duty before publication.")
    direct_vm.sender = REVIEWER
    contract.request_revision(dossier_id, "Restore the omitted notification duty before publication.")
    direct_vm.sender = direct_alice
    replaced = contract.replace_translation(dossier_id, REVISED_URL)
    assert replaced["preserved_snapshot_count"] == 1 and replaced["status"] == "EVIDENCE_PENDING"
    second = freeze(contract, direct_vm, dossier_id, REVISED_URL)
    dossier = contract.get_dossier(dossier_id)
    assert len(dossier["snapshots"]) == 2
    assert dossier["snapshots"][0]["snapshot_digest"] == first["snapshot_digest"]
    assert dossier["snapshots"][1]["documents"][0]["sha256"] == dossier["snapshots"][0]["documents"][0]["sha256"]
    assert second["snapshot_digest"] != first["snapshot_digest"]


def test_only_complete_aligned_review_can_authorize_and_commit_release(direct_vm, direct_deploy, direct_alice, monkeypatch):
    contract = direct_deploy(CONTRACT); enable_consensus(contract, monkeypatch); direct_vm.sender = direct_alice; dossier_id = create(contract); freeze(contract, direct_vm, dossier_id); assess(contract, direct_vm, dossier_id)
    with direct_vm.expect_revert("independent reviewer"):
        contract.finalize(dossier_id)
    direct_vm.sender = REVIEWER
    final = contract.finalize(dossier_id)
    assert final["status"] == "RELEASE_AUTHORIZED" and final["final_receipt"]["release_authorized"] is True
    with direct_vm.expect_revert("dossier owner"):
        contract.commit_release(dossier_id, ARTIFACT)
    direct_vm.sender = direct_alice
    released = contract.commit_release(dossier_id, ARTIFACT)
    gate = contract.get_release_gate(dossier_id)
    assert released["status"] == "RELEASED" and gate["authorized"] is True and gate["artifact_sha256"] == ARTIFACT
    with direct_vm.expect_revert("Release is blocked"):
        contract.commit_release(dossier_id, ARTIFACT)
