"""
WorkProof Contract Unit Tests — using algopy_testing (no network required).

Sender is set via:
    with context.txn.create_group(active_txn_overrides={"sender": account}):
        contract.some_method(...)

This is the correct API for algopy_testing >= 0.4.x where set_sender() does not exist.
"""
from collections.abc import Iterator

import algosdk.logic
import pytest
from algopy_testing import AlgopyTestContext, algopy_testing_context
from algopy import Account, Bytes, UInt64

from smart_contracts.workproof.contract import WorkProof


@pytest.fixture()
def context() -> Iterator[AlgopyTestContext]:
    with algopy_testing_context() as ctx:
        yield ctx


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _app_address(context: AlgopyTestContext) -> Account:
    """Return the mock application address from the test context."""
    # The ledger exposes app data; the app address can be derived from the
    # current application created in the context.  For algopy_testing the
    # simplest approach is to use the default_sender as receiver so the
    # payment txn passes the receiver == Global.current_application_address
    # check.  We create the contract first so the app address is registered.
    raise NotImplementedError  # replaced per-test; see _make_contract()


def _make_contract(context: AlgopyTestContext) -> tuple[WorkProof, Account]:
    """Instantiate WorkProof and return (contract, app_address).

    The app address is derived using algosdk — the same formula algopy_testing
    uses internally for Global.current_application_address.
    """
    contract = WorkProof()
    # contract.__app_id__ is the integer app ID registered by the testing framework
    raw_addr = algosdk.logic.get_application_address(contract.__app_id__)
    app_addr = Account(raw_addr)
    return contract, app_addr


def _funded_contract(
    context: AlgopyTestContext,
) -> tuple[WorkProof, Account, Account, Account, UInt64, Account]:
    """
    Helper: create + fund the contract.

    Returns (contract, contractor, supervisor, worker, milestone_amount, app_addr).
    """
    contract, app_addr = _make_contract(context)
    contractor = context.any.account()
    supervisor = context.any.account()
    worker = context.any.account()
    milestone_amount = UInt64(1_000_000)
    milestone_name = Bytes(b"Foundation Work")

    pay_txn = context.any.txn.payment(
        sender=contractor,
        receiver=app_addr,
        amount=milestone_amount,
    )

    with context.txn.create_group(active_txn_overrides={"sender": contractor}):
        contract.create_work_contract(
            contractor=contractor,
            supervisor=supervisor,
            worker=worker,
            milestone_amount=milestone_amount,
            milestone_name=milestone_name,
            pay_txn=pay_txn,
        )

    return contract, contractor, supervisor, worker, milestone_amount, app_addr


# ---------------------------------------------------------------------------
# Initialization
# ---------------------------------------------------------------------------


def test_contract_initialization(context: AlgopyTestContext) -> None:
    """Contract initialises with correct default values."""
    contract, _ = _make_contract(context)

    assert contract.milestone_paid == False
    assert contract.escrow_funded == False
    assert contract.milestone_amount == UInt64(0)
    assert contract.credential_claimed == False
    print("✓ Contract initialization test passed")


# ---------------------------------------------------------------------------
# create_work_contract
# ---------------------------------------------------------------------------


def test_create_work_contract(context: AlgopyTestContext) -> None:
    """create_work_contract stores roles and funds the escrow."""
    contract, contractor, supervisor, worker, milestone_amount, _ = _funded_contract(context)

    assert contract.contractor == contractor
    assert contract.supervisor == supervisor
    assert contract.worker == worker
    assert contract.milestone_amount == milestone_amount
    assert contract.milestone_name == Bytes(b"Foundation Work")
    assert contract.escrow_funded == True
    assert contract.milestone_paid == False
    print("✓ Create work contract test passed")


def test_create_work_contract_rejects_wrong_sender(context: AlgopyTestContext) -> None:
    """create_work_contract rejects if Txn.sender ≠ contractor."""
    contract, app_addr = _make_contract(context)
    contractor = context.any.account()
    supervisor = context.any.account()
    worker = context.any.account()
    imposter = context.any.account()
    milestone_amount = UInt64(1_000_000)

    pay_txn = context.any.txn.payment(
        sender=contractor,
        receiver=app_addr,
        amount=milestone_amount,
    )

    with pytest.raises(AssertionError, match="Sender must be contractor"):
        with context.txn.create_group(active_txn_overrides={"sender": imposter}):
            contract.create_work_contract(
                contractor=contractor,
                supervisor=supervisor,
                worker=worker,
                milestone_amount=milestone_amount,
                milestone_name=Bytes(b"Test"),
                pay_txn=pay_txn,
            )
    print("✓ Wrong sender rejection test passed")


def test_create_work_contract_rejects_zero_amount(context: AlgopyTestContext) -> None:
    """create_work_contract rejects a zero milestone amount.

    Note: args must be positional (not keyword) because algopy_testing's
    get_ordered_args uses `kwargs.get(name) or next(iter)`, which fails for
    falsy values like UInt64(0). Positional args bypass this via app_args.
    """
    contract, app_addr = _make_contract(context)
    contractor = context.any.account()
    supervisor = context.any.account()
    worker = context.any.account()

    pay_txn = context.any.txn.payment(
        sender=contractor,
        receiver=app_addr,
        amount=UInt64(0),
    )

    with pytest.raises(AssertionError, match="Milestone amount must be > 0"):
        with context.txn.create_group(active_txn_overrides={"sender": contractor}):
            # Pass all args positionally — UInt64(0) is falsy so keyword-arg
            # passing triggers a StopIteration bug in algopy_testing's decorator.
            contract.create_work_contract(
                contractor, supervisor, worker, UInt64(0), Bytes(b"Test"), pay_txn
            )
    print("✓ Zero amount rejection test passed")



# ---------------------------------------------------------------------------
# approve_milestone
# ---------------------------------------------------------------------------


def test_approve_milestone(context: AlgopyTestContext) -> None:
    """Supervisor can approve the milestone; state updates correctly."""
    contract, _, supervisor, worker, milestone_amount, _ = _funded_contract(context)

    with context.txn.create_group(active_txn_overrides={"sender": supervisor}):
        asset_id = contract.approve_milestone(
            metadata_url=Bytes(b"https://example.com/meta.json"),
            metadata_hash=Bytes(b"a" * 32),
        )

    assert contract.milestone_paid == True
    assert contract.credential_claimed == False
    assert asset_id > UInt64(0)
    print("✓ Approve milestone test passed")


def test_approve_milestone_rejects_wrong_sender(context: AlgopyTestContext) -> None:
    """Only the supervisor may call approve_milestone."""
    contract, contractor, supervisor, worker, _, _ = _funded_contract(context)

    with pytest.raises(AssertionError, match="Sender must be supervisor"):
        with context.txn.create_group(active_txn_overrides={"sender": contractor}):
            contract.approve_milestone(
                metadata_url=Bytes(b"https://example.com/meta.json"),
                metadata_hash=Bytes(b"a" * 32),
            )
    print("✓ Approve milestone wrong sender rejection passed")


def test_approve_milestone_rejects_unfunded(context: AlgopyTestContext) -> None:
    """approve_milestone fails if escrow is not funded."""
    contract, _ = _make_contract(context)
    supervisor = context.any.account()

    with pytest.raises(AssertionError, match="Escrow not funded"):
        with context.txn.create_group(active_txn_overrides={"sender": supervisor}):
            contract.approve_milestone(
                metadata_url=Bytes(b"https://example.com/meta.json"),
                metadata_hash=Bytes(b"a" * 32),
            )
    print("✓ Approve milestone unfunded rejection passed")


# ---------------------------------------------------------------------------
# claim_credential
# ---------------------------------------------------------------------------


def _approved_contract(
    context: AlgopyTestContext,
) -> tuple[WorkProof, Account, Account, Account]:
    """Helper: funded + approved contract. Returns (contract, contractor, supervisor, worker)."""
    contract, contractor, supervisor, worker, _, _ = _funded_contract(context)

    with context.txn.create_group(active_txn_overrides={"sender": supervisor}):
        contract.approve_milestone(
            metadata_url=Bytes(b"https://example.com/meta.json"),
            metadata_hash=Bytes(b"a" * 32),
        )

    return contract, contractor, supervisor, worker


def test_claim_credential(context: AlgopyTestContext) -> None:
    """Worker can claim the credential after approval."""
    contract, _, supervisor, worker = _approved_contract(context)

    with context.txn.create_group(active_txn_overrides={"sender": worker}):
        asset_id = contract.claim_credential()

    assert contract.credential_claimed == True
    assert asset_id > UInt64(0)
    print("✓ Claim credential test passed")


def test_claim_credential_rejects_wrong_sender(context: AlgopyTestContext) -> None:
    """Only the worker may call claim_credential."""
    contract, contractor, supervisor, worker = _approved_contract(context)

    with pytest.raises(AssertionError, match="Sender must be worker"):
        with context.txn.create_group(active_txn_overrides={"sender": contractor}):
            contract.claim_credential()
    print("✓ Claim credential wrong sender rejection passed")


def test_claim_credential_rejects_double_claim(context: AlgopyTestContext) -> None:
    """The credential cannot be claimed twice."""
    contract, _, supervisor, worker = _approved_contract(context)

    with context.txn.create_group(active_txn_overrides={"sender": worker}):
        contract.claim_credential()  # first claim — OK

    with pytest.raises(AssertionError, match="Credential already claimed"):
        with context.txn.create_group(active_txn_overrides={"sender": worker}):
            contract.claim_credential()  # second claim — must fail
    print("✓ Double-claim rejection passed")


def test_claim_credential_rejects_before_approval(context: AlgopyTestContext) -> None:
    """Worker cannot claim before the supervisor approves."""
    contract, _, supervisor, worker, _, _ = _funded_contract(context)

    with pytest.raises(AssertionError, match="Milestone not approved yet"):
        with context.txn.create_group(active_txn_overrides={"sender": worker}):
            contract.claim_credential()
    print("✓ Claim before approval rejection passed")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
