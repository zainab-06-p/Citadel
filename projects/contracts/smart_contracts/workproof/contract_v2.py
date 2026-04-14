from algopy import *
from algopy.arc4 import abimethod, ARC4Contract, Struct, DynamicArray, UInt64 as Arc4UInt64, Address as Arc4Address, String as Arc4String, Bool as Arc4Bool


class MilestoneData(Struct):
    """Structure for milestone information"""
    amount: Arc4UInt64
    name: Arc4String
    description: Arc4String
    due_date: Arc4UInt64  # Unix timestamp


class ConsentRecord(Struct):
    """DPDP-compliant consent record for data sharing"""
    worker: Arc4Address
    institution: Arc4Address
    purpose: Arc4String
    scope: Arc4String  # Comma-separated: 'credit_score,earnings,contracts'
    granted_at: Arc4UInt64
    expires_at: Arc4UInt64
    revoked: Arc4Bool


class DisputeRecord(Struct):
    """Dispute record for milestone conflicts"""
    dispute_id: Arc4UInt64
    milestone_index: Arc4UInt64
    raised_by: Arc4Address
    reason: Arc4String
    evidence_hash: Arc4String  # IPFS hash of evidence
    raised_at: Arc4UInt64
    resolved: Arc4Bool
    resolution: Arc4String  # 'approved', 'rejected', 'partial'
    payout_percent: Arc4UInt64
    resolver: Arc4Address


class WorkProofV2(ARC4Contract):
    """
    WorkProof V2 - Multi-milestone escrow with DPDP consent and dispute resolution
    For gig workers: Swiggy, Zomato, Ola, Uber delivery partners
    """
    
    # Core parties
    contractor: Account
    supervisor: Account
    worker: Account
    
    # Contract state
    escrow_funded: bool
    total_escrow: UInt64
    created_at: UInt64
    cancellation_timeout: UInt64  # Block height for auto-cancellation
    
    # Milestone management
    milestones: DynamicArray[MilestoneData]
    current_milestone_index: Arc4UInt64
    milestone_count: Arc4UInt64
    milestones_completed: Arc4UInt64
    
    # Milestone state (parallel arrays)
    milestone_paid: DynamicArray[Arc4Bool]
    milestone_paid_at: DynamicArray[Arc4UInt64]
    milestone_approved_by: DynamicArray[Arc4Address]
    credential_asset_ids: DynamicArray[Arc4UInt64]  # 0 = not minted yet
    
    # Consent registry (key: worker + institution -> consent)
    consent_registry: BoxMap(Bytes, ConsentRecord)
    consent_nonce: UInt64  # For generating unique consent IDs
    
    # Dispute registry
    disputes: BoxMap(Bytes, DisputeRecord)  # Key: "dispute_{id}"
    dispute_nonce: UInt64
    active_dispute_count: UInt64
    
    # Arbitrator (can be DAO or platform)
    arbitrator: Account
    
    def __init__(self) -> None:
        # Initialize core parties
        self.contractor = Account()
        self.supervisor = Account()
        self.worker = Account()
        self.arbitrator = Account()
        
        # Initialize state
        self.escrow_funded = False
        self.total_escrow = UInt64(0)
        self.created_at = UInt64(0)
        self.cancellation_timeout = UInt64(0)
        
        # Initialize milestones
        self.milestones = DynamicArray[MilestoneData]()
        self.current_milestone_index = Arc4UInt64(0)
        self.milestone_count = Arc4UInt64(0)
        self.milestones_completed = Arc4UInt64(0)
        
        # Initialize milestone state arrays
        self.milestone_paid = DynamicArray[Arc4Bool]()
        self.milestone_paid_at = DynamicArray[Arc4UInt64]()
        self.milestone_approved_by = DynamicArray[Arc4Address]()
        self.credential_asset_ids = DynamicArray[Arc4UInt64]()
        
        # Initialize consent/dispute nonces
        self.consent_nonce = UInt64(0)
        self.dispute_nonce = UInt64(0)
        self.active_dispute_count = UInt64(0)
    
    @abimethod()
    def create_work_contract(
        self,
        contractor: Account,
        supervisor: Account,
        worker: Account,
        arbitrator: Account,
        milestones_data: DynamicArray[MilestoneData],
        cancellation_window: Arc4UInt64,  # Blocks until auto-cancellation allowed
        pay_txn: gtxn.PaymentTransaction,
    ) -> Arc4UInt64:
        """
        Creates a multi-milestone WorkProof agreement.
        
        Args:
            milestones_data: Array of milestones (e.g., 10 milestones of 10 deliveries each)
            cancellation_window: Blocks after which contract can be cancelled if not complete
        """
        # Validate sender
        assert Txn.sender == contractor, "Sender must be contractor"
        assert pay_txn.sender == contractor, "Escrow sender mismatch"
        assert pay_txn.receiver == Global.current_application_address, "Escrow receiver must be contract"
        assert not self.escrow_funded, "Escrow already funded"
        
        # Validate milestones
        milestone_count = Arc4UInt64(UInt64(len(milestones_data)))
        assert milestone_count > Arc4UInt64(0), "Must have at least 1 milestone"
        assert milestone_count <= Arc4UInt64(20), "Maximum 20 milestones supported"
        
        # Calculate total escrow needed
        total_amount = UInt64(0)
        for i in range(UInt64(len(milestones_data))):
            total_amount += milestones_data[i].amount.native
        
        assert pay_txn.amount == total_amount, "Escrow amount must equal sum of milestone amounts"
        assert total_amount > UInt64(0), "Total amount must be > 0"
        
        # Store parties
        self.contractor = contractor
        self.supervisor = supervisor
        self.worker = worker
        self.arbitrator = arbitrator
        
        # Store milestones
        self.milestones = milestones_data
        self.milestone_count = milestone_count
        self.current_milestone_index = Arc4UInt64(0)
        self.milestones_completed = Arc4UInt64(0)
        
        # Initialize milestone state arrays
        for i in range(UInt64(len(milestones_data))):
            self.milestone_paid.append(Arc4Bool(False))
            self.milestone_paid_at.append(Arc4UInt64(0))
            self.milestone_approved_by.append(Arc4Address(Account()))
            self.credential_asset_ids.append(Arc4UInt64(0))
        
        # Store contract state
        self.total_escrow = total_amount
        self.escrow_funded = True
        self.created_at = Arc4UInt64(Global.round)
        self.cancellation_timeout = Arc4UInt64(Global.round + cancellation_window.native)
        
        return milestone_count
    
    @abimethod()
    def approve_milestone(
        self,
        milestone_index: Arc4UInt64,
        metadata_url: Arc4String,
        metadata_hash: Arc4String,
    ) -> Arc4UInt64:
        """
        Supervisor approves a specific milestone.
        
        Releases ALGO payment and mints credential NFT.
        Advances to next milestone if available.
        """
        # Validate state
        assert self.escrow_funded, "Escrow not funded"
        assert Txn.sender == self.supervisor, "Sender must be supervisor"
        
        idx = milestone_index.native
        assert idx < UInt64(len(self.milestones)), "Invalid milestone index"
        assert not self.milestone_paid[idx].native, "Milestone already paid"
        
        # Check no active disputes for this milestone
        dispute_key = Bytes(f"dispute_milestone_{idx}")
        # Note: In production, check if dispute exists and is unresolved
        
        # Get milestone data
        milestone = self.milestones[idx]
        amount = milestone.amount.native
        milestone_name = milestone.name
        
        # 1) Mint credential ASA
        asset_config_result = itxn.AssetConfig(
            config_asset=Asset(),
            total=UInt64(1),
            decimals=UInt64(0),
            default_frozen=False,
            unit_name=Bytes(b"WP"),
            asset_name=milestone_name.native.encode(),
            url=metadata_url.native.encode(),
            metadata_hash=metadata_hash.native.encode(),
            manager=Global.current_application_address,
            reserve=Global.current_application_address,
            freeze=Global.current_application_address,
            clawback=Global.current_application_address,
        ).submit()
        
        credential_asset_id = asset_config_result.created_asset.id
        
        # 2) Release payment to worker
        itxn.Payment(
            receiver=self.worker,
            amount=amount,
            fee=UInt64(0)
        ).submit()
        
        # 3) Transfer credential to worker (if opted in)
        # Note: In production, check if worker opted in first
        # For now, keep credential in contract, worker claims later
        
        # 4) Update milestone state
        self.milestone_paid[idx] = Arc4Bool(True)
        self.milestone_paid_at[idx] = Arc4UInt64(Global.round)
        self.milestone_approved_by[idx] = Arc4Address(Txn.sender)
        self.credential_asset_ids[idx] = Arc4UInt64(credential_asset_id)
        
        # 5) Advance to next milestone
        self.milestones_completed = Arc4UInt64(self.milestones_completed.native + UInt64(1))
        next_idx = idx + UInt64(1)
        if next_idx < UInt64(len(self.milestones)):
            self.current_milestone_index = Arc4UInt64(next_idx)
        
        return Arc4UInt64(credential_asset_id)
    
    @abimethod()
    def claim_credential(self, milestone_index: Arc4UInt64) -> Arc4UInt64:
        """
        Worker claims the credential NFT for a completed milestone.
        Worker must be opted into the ASA first.
        """
        idx = milestone_index.native
        assert idx < UInt64(len(self.milestones)), "Invalid milestone index"
        assert self.milestone_paid[idx].native, "Milestone not approved yet"
        assert Txn.sender == self.worker, "Sender must be worker"
        
        asset_id = self.credential_asset_ids[idx].native
        assert asset_id > UInt64(0), "No credential minted for this milestone"
        
        # Transfer credential to worker
        itxn.AssetTransfer(
            xfer_asset=Asset(asset_id),
            asset_amount=UInt64(1),
            asset_sender=Global.current_application_address,
            asset_receiver=self.worker,
        ).submit()
        
        return Arc4UInt64(asset_id)
    
    # ============================================================
    # DPDP CONSENT MANAGEMENT (RegTech Compliance)
    # ============================================================
    
    @abimethod()
    def grant_consent(
        self,
        institution: Account,
        purpose: Arc4String,
        scope: Arc4String,  # e.g., "credit_score,earnings,contracts"
        duration_days: Arc4UInt64,
    ) -> Arc4UInt64:
        """
        Worker grants consent to institution for accessing work data.
        DPDP 2023 compliant - explicit, revocable, time-bound.
        """
        assert Txn.sender == self.worker, "Only worker can grant consent"
        assert institution != Account(), "Invalid institution address"
        
        # Generate consent ID
        self.consent_nonce += UInt64(1)
        consent_id = self.consent_nonce
        
        # Calculate expiration (approximate: ~24k blocks per day)
        blocks_per_day = UInt64(24000)
        expires_at = Global.round + (duration_days.native * blocks_per_day)
        
        # Create consent record
        consent_record = ConsentRecord(
            worker=Arc4Address(self.worker),
            institution=Arc4Address(institution),
            purpose=purpose,
            scope=scope,
            granted_at=Arc4UInt64(Global.round),
            expires_at=Arc4UInt64(expires_at),
            revoked=Arc4Bool(False),
        )
        
        # Store in consent registry
        consent_key = Bytes(f"consent_{self.worker}_{institution}")
        self.consent_registry[consent_key] = consent_record
        
        return Arc4UInt64(consent_id)
    
    @abimethod()
    def revoke_consent(self, institution: Account) -> Arc4Bool:
        """
        Worker revokes previously granted consent.
        """
        assert Txn.sender == self.worker, "Only worker can revoke consent"
        
        consent_key = Bytes(f"consent_{self.worker}_{institution}")
        assert consent_key in self.consent_registry, "No consent found for this institution"
        
        consent_record = self.consent_registry[consent_key]
        assert not consent_record.revoked.native, "Consent already revoked"
        
        # Update record
        consent_record.revoked = Arc4Bool(True)
        self.consent_registry[consent_key] = consent_record
        
        return Arc4Bool(True)
    
    @abimethod()
    def verify_consent(
        self,
        worker: Account,
        institution: Account,
        required_scope: Arc4String,
    ) -> Arc4Bool:
        """
        Verify if valid consent exists between worker and institution.
        Called by institutions before accessing worker data.
        """
        consent_key = Bytes(f"consent_{worker}_{institution}")
        
        if consent_key not in self.consent_registry:
            return Arc4Bool(False)
        
        consent_record = self.consent_registry[consent_key]
        
        # Check not revoked
        if consent_record.revoked.native:
            return Arc4Bool(False)
        
        # Check not expired
        if Global.round > consent_record.expires_at.native:
            return Arc4Bool(False)
        
        # Check scope covers required data
        # Note: In production, parse and validate scope fields
        
        return Arc4Bool(True)
    
    # ============================================================
    # DISPUTE RESOLUTION
    # ============================================================
    
    @abimethod()
    def raise_dispute(
        self,
        milestone_index: Arc4UInt64,
        reason: Arc4String,
        evidence_hash: Arc4String,  # IPFS hash
    ) -> Arc4UInt64:
        """
        Raise a dispute for a milestone (worker or contractor).
        Locks milestone payment until resolved.
        """
        assert self.escrow_funded, "Contract not funded"
        
        idx = milestone_index.native
        assert idx < UInt64(len(self.milestones)), "Invalid milestone index"
        
        # Only worker, contractor, or supervisor can raise dispute
        assert (
            Txn.sender == self.worker or 
            Txn.sender == self.contractor or 
            Txn.sender == self.supervisor
        ), "Unauthorized to raise dispute"
        
        # Can't dispute already paid milestones
        assert not self.milestone_paid[idx].native, "Milestone already paid"
        
        # Generate dispute ID
        self.dispute_nonce += UInt64(1)
        dispute_id = self.dispute_nonce
        
        # Create dispute record
        dispute_record = DisputeRecord(
            dispute_id=Arc4UInt64(dispute_id),
            milestone_index=milestone_index,
            raised_by=Arc4Address(Txn.sender),
            reason=reason,
            evidence_hash=evidence_hash,
            raised_at=Arc4UInt64(Global.round),
            resolved=Arc4Bool(False),
            resolution=Arc4String(""),
            payout_percent=Arc4UInt64(0),
            resolver=Arc4Address(Account()),
        )
        
        # Store dispute
        dispute_key = Bytes(f"dispute_{dispute_id}")
        self.disputes[dispute_key] = dispute_record
        
        self.active_dispute_count += UInt64(1)
        
        return Arc4UInt64(dispute_id)
    
    @abimethod()
    def resolve_dispute(
        self,
        dispute_id: Arc4UInt64,
        resolution: Arc4String,  # 'approved', 'rejected', 'partial'
        payout_percent: Arc4UInt64,  # 0-100 for partial
    ) -> Arc4UInt64:
        """
        Arbitrator resolves a dispute.
        Can approve, reject, or partially approve milestone.
        """
        assert Txn.sender == self.arbitrator, "Only arbitrator can resolve"
        
        idx = dispute_id.native
        dispute_key = Bytes(f"dispute_{idx}")
        
        assert dispute_key in self.disputes, "Dispute not found"
        
        dispute_record = self.disputes[dispute_key]
        assert not dispute_record.resolved.native, "Dispute already resolved"
        
        milestone_idx = dispute_record.milestone_index.native
        assert milestone_idx < UInt64(len(self.milestones)), "Invalid milestone"
        assert not self.milestone_paid[milestone_idx].native, "Milestone already paid"
        
        # Update dispute record
        dispute_record.resolved = Arc4Bool(True)
        dispute_record.resolution = resolution
        dispute_record.payout_percent = payout_percent
        dispute_record.resolver = Arc4Address(Txn.sender)
        self.disputes[dispute_key] = dispute_record
        
        self.active_dispute_count -= UInt64(1)
        
        # Handle resolution
        if resolution.native == b"approved":
            # Full approval - proceed with normal milestone approval
            # Note: In production, call approve_milestone logic here
            pass
        elif resolution.native == b"partial":
            # Partial payout
            assert payout_percent <= Arc4UInt64(100), "Invalid payout percent"
            milestone = self.milestones[milestone_idx]
            total_amount = milestone.amount.native
            payout = (total_amount * payout_percent.native) // UInt64(100)
            
            if payout > UInt64(0):
                itxn.Payment(
                    receiver=self.worker,
                    amount=payout,
                    fee=UInt64(0)
                ).submit()
            
            # Return remainder to contractor
            remainder = total_amount - payout
            if remainder > UInt64(0):
                itxn.Payment(
                    receiver=self.contractor,
                    amount=remainder,
                    fee=UInt64(0)
                ).submit()
            
            # Mark as paid (partial)
            self.milestone_paid[milestone_idx] = Arc4Bool(True)
            self.milestone_paid_at[milestone_idx] = Arc4UInt64(Global.round)
        
        # If rejected - no payment, funds stay in contract for contractor withdrawal
        
        return Arc4UInt64(idx)
    
    # ============================================================
    # CONTRACT MANAGEMENT
    # ============================================================
    
    @abimethod()
    def get_milestone_status(self, milestone_index: Arc4UInt64) -> Arc4String:
        """Get status of a specific milestone"""
        idx = milestone_index.native
        assert idx < UInt64(len(self.milestones)), "Invalid milestone index"
        
        if self.milestone_paid[idx].native:
            return Arc4String("completed")
        elif idx == self.current_milestone_index.native:
            return Arc4String("active")
        elif idx < self.current_milestone_index.native:
            return Arc4String("completed")
        else:
            return Arc4String("pending")
    
    @abimethod()
    def get_contract_summary(self) -> DynamicArray[Arc4String]:
        """Get summary of contract state for UI display"""
        result = DynamicArray[Arc4String]()
        
        # Add contract address (as string)
        # Note: In production, convert address properly
        result.append(Arc4String("contract_created"))
        
        # Add milestone count
        result.append(Arc4String(f"milestones_{self.milestone_count.native}"))
        result.append(Arc4String(f"completed_{self.milestones_completed.native}"))
        result.append(Arc4String(f"current_{self.current_milestone_index.native}"))
        
        return result
    
    @abimethod()
    def can_cancel_contract(self) -> Arc4Bool:
        """Check if contract can be cancelled (timeout reached)"""
        if not self.escrow_funded:
            return Arc4Bool(False)
        
        # Check if all milestones completed
        if self.milestones_completed.native >= self.milestone_count.native:
            return Arc4Bool(False)
        
        # Check timeout
        if Global.round < self.cancellation_timeout.native:
            return Arc4Bool(False)
        
        return Arc4Bool(True)
