#!/usr/bin/env python3
"""
Custom WorkProof deploy script for BIP39 24-word mnemonic wallets.

Standard algokit_utils expects Algorand's 25-word format.
This script derives the Algorand ED25519 private key from a BIP39 mnemonic
using SLIP-0010 (hardened ED25519) with Algorand's derivation path: m/44'/283'/0'/0'/0'
"""

import hashlib
import hmac
import struct
import logging
import sys

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

# ─── BIP39 mnemonic (24 words) ───────────────────────────────────────────────
MNEMONIC_PHRASE = (
    "joy own flavor ready lemon lizard axis accuse transfer sniff crowd slice "
    "search law raise act near similar easily pattern crew similar buddy history"
)

# Expected wallet address for verification
EXPECTED_ADDRESS = "5GBN4T455FKIL34N5CQKDID3TCB7QVJ37RWLPHQMYNQOMO5EJEY2FPV2YQ"

# Algorand TestNet
ALGOD_SERVER = "https://testnet-api.algonode.cloud"
ALGOD_TOKEN = ""

# ─── SLIP-0010 ED25519 key derivation ────────────────────────────────────────

SLIP10_MASTER_KEY = b"ed25519 seed"


def _hmac_sha512(key: bytes, data: bytes) -> bytes:
    return hmac.new(key, data, hashlib.sha512).digest()


def _derive_slip10_ed25519(seed: bytes, path: str = "m/44'/283'/0'/0'/0'") -> bytes:
    """
    Derives an ED25519 private key from seed using SLIP-0010.
    For ED25519, ALL components MUST be hardened (index >= 0x80000000).
    Algorand standard path: m/44'/283'/0'/0'/0'
    """
    I = _hmac_sha512(SLIP10_MASTER_KEY, seed)
    key, chain_code = I[:32], I[32:]

    components = path.split("/")[1:]  # skip leading 'm'
    for component in components:
        hardened = component.endswith("'")
        index = int(component.rstrip("'"))
        if hardened:
            index += 0x80000000
        else:
            # ED25519 SLIP-0010 requires hardened derivation at every level
            index += 0x80000000
            logger.warning(f"Forcing hardened derivation for component {component}")

        data = b"\x00" + key + struct.pack(">I", index)
        I = _hmac_sha512(chain_code, data)
        key, chain_code = I[:32], I[32:]

    return key  # 32-byte ED25519 private key scalar


# ─── Main Deploy Logic ────────────────────────────────────────────────────────


def main() -> None:
    # 1) BIP39 mnemonic → seed
    try:
        from mnemonic import Mnemonic
    except ImportError:
        logger.error("mnemonic package not found. Run: .venv\\Scripts\\pip install mnemonic")
        sys.exit(1)

    try:
        import algosdk
        from algosdk import mnemonic as algo_mnemonic, account as algo_account
        import algokit_utils
    except ImportError as e:
        logger.error(f"Missing dependency: {e}")
        sys.exit(1)

    logger.info("Generating BIP39 seed from mnemonic...")
    mnemo = Mnemonic("english")
    words = MNEMONIC_PHRASE.strip().split()
    logger.info(f"Word count: {len(words)}")

    if not mnemo.check(MNEMONIC_PHRASE.strip()):
        logger.warning("BIP39 checksum validation failed — proceeding anyway (some wallets use non-standard entropy).")

    # BIP39 seed (512-bit; passphrase = "" for standard wallets)
    seed_bytes = mnemo.to_seed(MNEMONIC_PHRASE.strip(), passphrase="")
    logger.info(f"Seed generated ({len(seed_bytes)} bytes)")

    # 2) SLIP-0010 → 32-byte ED25519 private key
    logger.info("Deriving Algorand ED25519 key via SLIP-0010 path m/44'/283'/0'/0'/0' ...")
    private_key_bytes = _derive_slip10_ed25519(seed_bytes, "m/44'/283'/0'/0'/0'")

    # 3) Build Algorand signing account from raw private key
    from nacl.signing import SigningKey as NaClSigningKey

    nacl_key = NaClSigningKey(private_key_bytes)
    # algosdk expects: private_key = base64(private_key_bytes + public_key_bytes)  (64 bytes)
    import base64
    full_key = private_key_bytes + bytes(nacl_key.verify_key)
    private_key_b64 = base64.b64encode(full_key).decode()
    derived_address = algo_account.address_from_private_key(private_key_b64)

    logger.info(f"Derived address : {derived_address}")
    logger.info(f"Expected address: {EXPECTED_ADDRESS}")

    if derived_address == EXPECTED_ADDRESS:
        logger.info("✅ Address MATCH — derived key is correct!")
    else:
        logger.warning("⚠️  Address MISMATCH — trying alternative derivation paths...")
        # Try alternative: no passphrase, different path (some wallets use non-hardened final index)
        found = False
        for path_variant in [
            "m/44'/283'/0'/0'/0'",
            "m/44'/283'/0'/0/0",
            "m/44'/283'/0'/0'/1'",
        ]:
            pk = _derive_slip10_ed25519(seed_bytes, path_variant)
            nacl_k = NaClSigningKey(pk)
            full = pk + bytes(nacl_k.verify_key)
            b64 = base64.b64encode(full).decode()
            addr = algo_account.address_from_private_key(b64)
            logger.info(f"  path {path_variant:30s} → {addr}")
            if addr == EXPECTED_ADDRESS:
                logger.info(f"✅ MATCH on path {path_variant}!")
                private_key_b64 = b64
                derived_address = addr
                found = True
                break

        if not found:
            logger.error(
                "❌ No path matched the expected address. "
                "The wallet may use a non-standard derivation (e.g., MyAlgo or Defly). "
                "Deployment aborted."
            )
            logger.error(
                "Tip: Export your account's private key or 25-word Algorand mnemonic "
                "from your wallet app and use DEPLOYER_MNEMONIC in .env instead."
            )
            sys.exit(1)

    # 4) Check balance
    import urllib.request, json
    try:
        url = f"{ALGOD_SERVER}/v2/accounts/{derived_address}"
        req = urllib.request.Request(url, headers={"X-Algo-API-Token": ALGOD_TOKEN or "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            acc_data = json.loads(resp.read())
        balance_algo = acc_data.get("amount", 0) / 1_000_000
        logger.info(f"Deployer balance: {balance_algo:.6f} ALGO")
        if balance_algo < 0.2:
            logger.warning("⚠️  Low balance. Fund the deployer at: https://bank.testnet.algorand.network/")
    except Exception as e:
        logger.warning(f"Could not fetch balance: {e}")

    # 5) Deploy
    logger.info("Connecting to Algorand TestNet...")
    from algokit_utils import AlgorandClient, SigningAccount
    from smart_contracts.artifacts.workproof.work_proof_client import WorkProofFactory

    algorand = AlgorandClient.from_params(
        algod_server=ALGOD_SERVER,
        algod_token=ALGOD_TOKEN,
        algod_port=None,
    )

    deployer = SigningAccount(private_key=private_key_b64, address=derived_address)
    logger.info(f"Deployer address: {deployer.address}")

    factory = algorand.client.get_typed_app_factory(
        WorkProofFactory,
        default_sender=deployer.address,
        default_signer=deployer.signer,
    )

    logger.info("Deploying WorkProof contract to TestNet (this creates a new app instance)...")
    app_client, result = factory.deploy(
        on_update=algokit_utils.OnUpdate.AppendApp,
        on_schema_break=algokit_utils.OnSchemaBreak.AppendApp,
    )

    logger.info("=" * 60)
    logger.info(f"✅  WorkProof deployed successfully!")
    logger.info(f"    App ID      : {app_client.app_id}")
    logger.info(f"    App Address : {app_client.app_address}")
    logger.info(f"    Operation   : {result.operation_performed}")
    logger.info("=" * 60)
    logger.info(f"View on explorer: https://testnet.explorer.perawallet.app/application/{app_client.app_id}")
    logger.info(f"Fund the app address (for MBR): https://bank.testnet.algorand.network/")
    logger.info(f"App Address to fund: {app_client.app_address}")


if __name__ == "__main__":
    main()
