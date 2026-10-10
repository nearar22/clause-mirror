import json, sys

CONTRACT = "contracts/clause_mirror.py"
SOURCE_URL = "https://example.org/contracts/master-agreement-en"
TARGET_URL = "https://example.org/contracts/master-agreement-fr"
REVISED_URL = "https://example.org/contracts/master-agreement-fr-v2"
SOURCE = "The Supplier must notify the Buyer within five business days after discovering a security incident. The Buyer may terminate this Agreement if the Supplier fails to cure a material breach within thirty days. Liability is capped at EUR 50,000 except in cases of fraud."
TARGET = "Le Fournisseur doit notifier l'Acheteur dans les cinq jours ouvrables suivant la découverte d'un incident de sécurité. L'Acheteur peut résilier le présent Accord si le Fournisseur ne remédie pas à un manquement grave dans les trente jours. La responsabilité est plafonnée à 50 000 EUR, sauf en cas de fraude."
REVIEWER = "0x2222222222222222222222222222222222222222"


def findings(kind="ALIGNED"):
    rows = [{"index": 0, "classification": kind, "source_quote": "The Supplier must notify the Buyer within five business days", "target_quote": "" if kind == "OMISSION" else "Le Fournisseur doit notifier l'Acheteur dans les cinq jours ouvrables", "explanation": "The notification duty and five-business-day deadline are preserved."}]
    return {"findings": rows}


def create(contract):
    return contract.create_dossier("supply-terms-2030", "Supply agreement mirror", "Check whether the French translation preserves the material commercial duties before independent review.", "English", "French", SOURCE_URL, TARGET_URL, REVIEWER)


def enable_consensus(contract, monkeypatch, validator=None):
    module = sys.modules[contract.__class__.__module__]
    monkeypatch.setattr(module.gl.eq_principle, "strict_eq", lambda fn: fn())
    monkeypatch.setattr(module.gl.eq_principle, "prompt_comparative", validator or (lambda fn, *_args, **_kwargs: fn()))


def mocks(vm, result=None, target=TARGET):
    vm.mock_web(SOURCE_URL, {"method": "GET", "status": 200, "body": SOURCE})
    vm.mock_web(TARGET_URL, {"method": "GET", "status": 200, "body": target})
    vm.mock_llm("CLAUSEMIRROR_PRODUCER", json.dumps(json.dumps(result or findings())))


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


def test_assessment_binds_exact_quotes_and_document_receipts(direct_vm, direct_deploy, monkeypatch):
    contract = direct_deploy(CONTRACT); enable_consensus(contract, monkeypatch); dossier_id = create(contract); mocks(direct_vm)
    assessment = contract.assess(dossier_id); direct_vm.clear_mocks()
    assert assessment["overall"] == "ALIGNED"
    assert len(assessment["document_receipts"]) == 2
    assert all(len(row["sha256"]) == 64 for row in assessment["document_receipts"])
    assert contract.get_dossier(dossier_id)["status"] == "ASSESSED"


def test_omission_deterministically_blocks(direct_vm, direct_deploy, monkeypatch):
    contract = direct_deploy(CONTRACT); enable_consensus(contract, monkeypatch); dossier_id = create(contract); mocks(direct_vm, findings("OMISSION"))
    assert contract.assess(dossier_id)["overall"] == "BLOCKED"


def test_forged_target_quote_fails_closed(direct_vm, direct_deploy, monkeypatch):
    contract = direct_deploy(CONTRACT); enable_consensus(contract, monkeypatch); dossier_id = create(contract)
    forged = findings(); forged["findings"][0]["target_quote"] = "Le contrat est automatiquement approuvé"
    mocks(direct_vm, forged)
    with direct_vm.expect_revert("Target quote"):
        contract.assess(dossier_id)


def test_comparator_cannot_replace_evidence_schema(direct_vm, direct_deploy, monkeypatch):
    contract = direct_deploy(CONTRACT)
    def altered(fn, *_args, **_kwargs):
        fn(); return json.dumps({"overall": "ALIGNED", "summary": "looks fine"})
    enable_consensus(contract, monkeypatch, altered); dossier_id = create(contract); mocks(direct_vm)
    with direct_vm.expect_revert("One to twelve findings"):
        contract.assess(dossier_id)


def test_revision_and_finalization_enforce_separate_roles(direct_vm, direct_deploy, direct_alice, monkeypatch):
    contract = direct_deploy(CONTRACT); enable_consensus(contract, monkeypatch); direct_vm.sender = direct_alice; dossier_id = create(contract); mocks(direct_vm, findings("OMISSION")); contract.assess(dossier_id); direct_vm.clear_mocks()
    with direct_vm.expect_revert("independent reviewer"):
        contract.request_revision(dossier_id, "Restore the missing notification deadline in the translation.")
    direct_vm.sender = REVIEWER
    requested = contract.request_revision(dossier_id, "Restore the missing notification deadline in the translation.")
    assert requested["status"] == "REVISION_REQUESTED"
    with direct_vm.expect_revert("dossier owner"):
        contract.replace_translation(dossier_id, REVISED_URL)
    direct_vm.sender = direct_alice
    replaced = contract.replace_translation(dossier_id, REVISED_URL)
    assert replaced == {"dossier_id": dossier_id, "status": "READY", "revision": 1}
    direct_vm.mock_web(SOURCE_URL, {"method": "GET", "status": 200, "body": SOURCE})
    direct_vm.mock_web(REVISED_URL, {"method": "GET", "status": 200, "body": TARGET})
    direct_vm.mock_llm("CLAUSEMIRROR_PRODUCER", json.dumps(json.dumps(findings())))
    assert contract.assess(dossier_id)["overall"] == "ALIGNED"; direct_vm.clear_mocks()
    with direct_vm.expect_revert("independent reviewer"):
        contract.finalize(dossier_id)
    direct_vm.sender = REVIEWER
    final = contract.finalize(dossier_id)
    assert final["status"] == "FINAL" and final["final_receipt"]["revision"] == 1
    with direct_vm.expect_revert("Only an assessed dossier"):
        contract.finalize(dossier_id)
