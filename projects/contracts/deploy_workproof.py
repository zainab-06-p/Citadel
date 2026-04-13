#!/usr/bin/env python3
"""
Deploy WorkProof contract to Algorand TestNet.
Uses the pre-compiled TEAL from artifacts.
Deployer: 4ESLGM2JUKHDVGDGTJHWKMNWKVSQC3TSEBGFWFNVUH7EU7AVHOMEOQB7T4
"""
import base64
import json
import os
import sys
import time
from pathlib import Path

from algosdk import account, mnemonic, transaction
from algosdk.v2client import algod

# ── Config ────────────────────────────────────────────────────────────────────
DEPLOYER_MNEMONIC = (
    "boy accident place clarify dog cycle carpet buffalo believe run spin cake "
    "avoid phrase real toe antenna define age can merge desert tourist absent present"
)
ALGOD_SERVER = "https://testnet-api.algonode.cloud"
ALGOD_TOKEN  = ""
ALGOD_PORT   = 443

ARTIFACTS = Path(__file__).parent / "smart_contracts" / "artifacts" / "workproof"
APPROVAL_TEAL = ARTIFACTS / "WorkProof.approval.teal"
CLEAR_TEAL    = ARTIFACTS / "WorkProof.clear.teal"
ARC56_JSON    = ARTIFACTS / "WorkProof.arc56.json"

# ── Helpers ───────────────────────────────────────────────────────────────────

def get_private_key(mn: str) -> str:
    return mnemonic.to_private_key(mn)


def compile_teal(client: algod.AlgodClient, teal_src: str) -> bytes:
    result = client.compile(teal_src)
    return base64.b64decode(result["result"])


def wait_for_confirmation(client: algod.AlgodClient, txid: str, timeout: int = 20) -> dict:
    last_round = client.status()["last-round"]
    while timeout > 0:
        try:
            pending = client.pending_transaction_info(txid)
            if pending.get("confirmed-round", 0) > 0:
                return pending
            if pending.get("pool-error"):
                raise RuntimeError(f"Transaction rejected: {pending['pool-error']}")
        except Exception as e:
            if "not found" not in str(e).lower():
                raise
        client.status_after_block(last_round)
        last_round += 1
        timeout -= 1
    raise TimeoutError(f"Transaction {txid} not confirmed after waiting")


def deploy_via_teal(client: algod.AlgodClient, private_key: str) -> int:
    """Compile TEAL and deploy as ApplicationCreateTxn."""
    sender = account.address_from_private_key(private_key)
    print(f"Deployer address : {sender}")

    # Check balance
    info = client.account_info(sender)
    bal  = info["amount"]
    print(f"Balance          : {bal} microALGO ({bal/1e6:.4f} ALGO)")
    if bal < 500_000:
        raise RuntimeError("Insufficient balance (need at least 0.5 ALGO)")

    # Compile programs
    print("Compiling approval program …")
    approval_bytes = compile_teal(client, APPROVAL_TEAL.read_text())
    print("Compiling clear program …")
    clear_bytes    = compile_teal(client, CLEAR_TEAL.read_text())
    print(f"Approval size: {len(approval_bytes)} bytes  |  Clear size: {len(clear_bytes)} bytes")

    # Schema from ARC-56
    arc56 = json.loads(ARC56_JSON.read_text())
    schema = arc56["state"]["schema"]
    global_ints  = schema["global"]["ints"]
    global_bytes = schema["global"]["bytes"]
    local_ints   = schema["local"]["ints"]
    local_bytes  = schema["local"]["bytes"]
    print(f"Schema: global={global_ints}i/{global_bytes}b  local={local_ints}i/{local_bytes}b")

    sp = client.suggested_params()

    txn = transaction.ApplicationCreateTxn(
        sender       = sender,
        sp           = sp,
        on_complete   = transaction.OnComplete.NoOpOC,
        approval_program = approval_bytes,
        clear_program    = clear_bytes,
        global_schema    = transaction.StateSchema(global_ints, global_bytes),
        local_schema     = transaction.StateSchema(local_ints,  local_bytes),
        extra_pages      = 0,
    )

    signed = txn.sign(private_key)
    print("Submitting create-application transaction …")
    txid = client.send_transaction(signed)
    print(f"TxID: {txid}")

    result = wait_for_confirmation(client, txid)
    app_id = result["application-index"]
    app_addr = transaction.logic.get_application_address(app_id)

    print()
    print("=" * 60)
    print(f"  CONTRACT DEPLOYED SUCCESSFULLY")
    print(f"  App ID      : {app_id}")
    print(f"  App Address : {app_addr}")
    print(f"  Tx ID       : {txid}")
    print(f"  Explorer    : https://testnet.explorer.perawallet.app/application/{app_id}/")
    print("=" * 60)
    return app_id


def deploy_via_algokit(deployer_pk: str) -> int:
    """Approach 2 — use algokit_utils typed factory."""
    from dotenv import load_dotenv
    load_dotenv()

    import algokit_utils
    from smart_contracts.artifacts.workproof.work_proof_client import WorkProofFactory

    algorand = algokit_utils.AlgorandClient.from_environment()
    signer   = algokit_utils.SigningAccount(
        private_key = deployer_pk,
        address     = account.address_from_private_key(deployer_pk),
    )
    factory = algorand.client.get_typed_app_factory(
        WorkProofFactory,
        default_sender = signer.address,
        default_signer = signer.signer,
    )
    app_client, result = factory.deploy(
        on_update      = algokit_utils.OnUpdate.AppendApp,
        on_schema_break= algokit_utils.OnSchemaBreak.AppendApp,
    )
    app_id   = app_client.app_id
    app_addr = app_client.app_address
    print()
    print("=" * 60)
    print(f"  CONTRACT DEPLOYED (algokit_utils)")
    print(f"  App ID      : {app_id}")
    print(f"  App Address : {app_addr}")
    print(f"  Explorer    : https://testnet.explorer.perawallet.app/application/{app_id}/")
    print("=" * 60)
    return app_id


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    private_key = get_private_key(DEPLOYER_MNEMONIC)
    client      = algod.AlgodClient(ALGOD_TOKEN, ALGOD_SERVER)

    # Verify node connectivity
    status = client.status()
    print(f"Connected to TestNet  |  last round: {status['last-round']}")
    print()

    app_id = None

    # Approach 1: direct algosdk TEAL deploy (most reliable)
    print("=== Approach 1: Direct algosdk TEAL deploy ===")
    try:
        app_id = deploy_via_teal(client, private_key)
    except Exception as e:
        print(f"Approach 1 failed: {e}")

    if not app_id:
        # Approach 2: algokit_utils typed factory
        print("\n=== Approach 2: algokit_utils factory deploy ===")
        try:
            app_id = deploy_via_algokit(private_key)
        except Exception as e:
            print(f"Approach 2 failed: {e}")

    if not app_id:
        print("\nAll deployment approaches failed.")
        sys.exit(1)

    # Write app ID to a result file for the backend to pick up
    result_file = Path(__file__).parent / "deployed_app_id.txt"
    result_file.write_text(str(app_id))
    print(f"\nApp ID written to: {result_file}")


if __name__ == "__main__":
    main()
