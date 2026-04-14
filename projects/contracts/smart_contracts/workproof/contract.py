from algopy import *
from algopy.arc4 import abimethod


class WorkProof(ARC4Contract):
    contractor: Account
    supervisor: Account
    worker: Account

    milestone_amount: UInt64
    milestone_name: Bytes
    milestone_paid: bool

    escrow_funded: bool
    credential_asset_id: Asset
    credential_claimed: bool

    def __init__(self) -> None:
        # Initialize contract storages on deployment
        self.contractor = Account()
        self.supervisor = Account()
        self.worker = Account()

        self.milestone_amount = UInt64(0)
        self.milestone_name = Bytes(b"")

        self.milestone_paid = False
        self.escrow_funded = False
        self.credential_asset_id = Asset(0)
        self.credential_claimed = False

    @abimethod()
    def create_work_contract(
        self,
        contractor: Account,
        supervisor: Account,
        worker: Account,
        milestone_amount: UInt64,
        milestone_name: Bytes,
        pay_txn: gtxn.PaymentTransaction,
    ) -> UInt64:
        """
        Creates a single-milestone WorkProof agreement.

        This method expects a grouped payment from `contractor` to the app address as escrow.
        """
        assert Txn.sender == contractor, "Sender must be contractor"
        assert pay_txn.sender == contractor, "Escrow sender mismatch"
        assert pay_txn.receiver == Global.current_application_address, "Escrow receiver must be the contract"
        assert pay_txn.amount == milestone_amount, "Escrow amount must equal milestone amount"
        assert milestone_amount > UInt64(0), "Milestone amount must be > 0"
        assert not self.escrow_funded, "Escrow already funded"

        self.contractor = contractor
        self.supervisor = supervisor
        self.worker = worker

        self.milestone_amount = milestone_amount
        self.milestone_name = milestone_name

        self.milestone_paid = False
        self.escrow_funded = True
        self.credential_asset_id = Asset(0)

        return self.milestone_amount

    @abimethod()
    def approve_milestone(
        self,
        metadata_url: Bytes,
        metadata_hash: Bytes,
    ) -> UInt64:
        """
        Supervisor approves the milestone.

        Releases ALGO from the app escrow to `worker` and mints/transfers a 1-of-1 credential ASA.
        """
        assert self.escrow_funded, "Escrow not funded"
        assert not self.milestone_paid, "Milestone already paid"
        assert Txn.sender == self.supervisor, "Sender must be supervisor"

        # 1) Mint the credential ASA.
        # Note: We mint to the app account; later `claim_credential()` transfers it to the worker.
        # This avoids transfer failures when the worker has not opted into the ASA yet.
        asset_config_result = itxn.AssetConfig(
            total=UInt64(1),
            decimals=UInt64(0),
            default_frozen=False,
            unit_name=Bytes(b"WP"),
            asset_name=self.milestone_name,
            url=metadata_url,
            metadata_hash=metadata_hash,
            manager=Global.current_application_address,
            reserve=Global.current_application_address,
            freeze=Global.current_application_address,
            clawback=Global.current_application_address,
        ).submit()

        credential_asset_id = asset_config_result.created_asset

        # 2) Release the milestone ALGO to the worker.
        itxn.Payment(receiver=self.worker, amount=self.milestone_amount, fee=UInt64(0)).submit()

        # 3) Persist completion state for certificate verification.
        self.milestone_paid = True
        self.credential_asset_id = credential_asset_id
        self.credential_claimed = False

        return self.credential_asset_id.id

    @abimethod()
    def claim_credential(self) -> UInt64:
        """
        Worker claims the minted credential ASA.

        The worker must be opted in to the ASA before this call.
        """
        assert self.milestone_paid, "Milestone not approved yet"
        assert not self.credential_claimed, "Credential already claimed"
        assert self.credential_asset_id != Asset(0), "Missing credential asset id"
        assert Txn.sender == self.worker, "Sender must be worker"

        itxn.AssetTransfer(
            xfer_asset=self.credential_asset_id,
            asset_amount=UInt64(1),
            asset_sender=Global.current_application_address,
            asset_receiver=self.worker,
        ).submit()

        self.credential_claimed = True
        return self.credential_asset_id.id

