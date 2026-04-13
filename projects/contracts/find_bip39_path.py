#!/usr/bin/env python3
"""
Brute-force derivation finder — tries ALL known ways an Algorand wallet
could derive a key from a 24-word BIP39 mnemonic and prints the resulting addresses.
"""

import hashlib
import hmac
import struct
import base64

from mnemonic import Mnemonic
from nacl.signing import SigningKey as NaClSigningKey
from algosdk import account as algo_account

MNEMONIC_PHRASE = (
    "joy own flavor ready lemon lizard axis accuse transfer sniff crowd slice "
    "search law raise act near similar easily pattern crew similar buddy history"
)
EXPECTED = "5GBN4T455FKIL34N5CQKDID3TCB7QVJ37RWLPHQMYNQOMO5EJEY2FPV2YQ"

SLIP10_KEY = b"ed25519 seed"


def hmac512(key, data):
    return hmac.new(key, data, hashlib.sha512).digest()


def slip10_derive(seed: bytes, path: str) -> bytes:
    I = hmac512(SLIP10_KEY, seed)
    key, chain = I[:32], I[32:]
    for part in path.split("/")[1:]:
        h = part.endswith("'")
        idx = int(part.rstrip("'")) + (0x80000000 if h else 0)
        # For ED25519, always use hardened child even if not marked
        idx |= 0x80000000
        I = hmac512(chain, b"\x00" + key + struct.pack(">I", idx))
        key, chain = I[:32], I[32:]
    return key


def key_to_address(raw32: bytes) -> tuple[str, str]:
    nacl_key = NaClSigningKey(raw32)
    full = raw32 + bytes(nacl_key.verify_key)
    b64 = base64.b64encode(full).decode()
    addr = algo_account.address_from_private_key(b64)
    return addr, b64


def check(label: str, raw32: bytes) -> bool:
    addr, b64 = key_to_address(raw32)
    match = "✅ MATCH" if addr == EXPECTED else "  "
    print(f"{match}  {label:55s}  →  {addr}")
    if addr == EXPECTED:
        print(f"\n  Private key (b64): {b64}\n")
        return True
    return False


mnemo = Mnemonic("english")
words = MNEMONIC_PHRASE.strip()

# ── Approach 1: BIP39 seed (with empty passphrase) ───────────────────────────
seed = mnemo.to_seed(words, passphrase="")
raw_entropy = mnemo.to_entropy(words)

paths = [
    "m/44'/283'/0'/0'/0'",
    "m/44'/283'/0'/0'/1'",
    "m/44'/283'/0'/0'/0",
    "m/44'/283'/0'/0/0",
    "m/44'/283'/0'",
    "m/44'/283'",
    "m/44'/60'/0'/0'/0'",   # Ethereum-style sometimes used
]

print(f"\nExpected: {EXPECTED}\n")
print("=" * 80)
print("Approach A: BIP39 seed → SLIP-0010 paths")
print("=" * 80)
found_key = None
for path in paths:
    raw = slip10_derive(seed, path)
    if check(f"BIP39-seed SLIP10 {path}", raw):
        found_key = raw
        break

if not found_key:
    print("\n" + "=" * 80)
    print("Approach B: Raw entropy bytes as key seed → SLIP-0010")
    print("=" * 80)
    for path in paths:
        raw = slip10_derive(raw_entropy, path)
        if check(f"raw-entropy SLIP10 {path}", raw):
            found_key = raw
            break

if not found_key:
    print("\n" + "=" * 80)
    print("Approach C: Direct - first 32 bytes of BIP39 seed as private key")
    print("=" * 80)
    check("first 32 bytes of BIP39 seed", seed[:32])
    check("bytes 32-64 of BIP39 seed", seed[32:64])

    print("\n" + "=" * 80)
    print("Approach D: sha512 of entropy / seed slices")
    print("=" * 80)
    check("sha512(entropy)[:32]", hashlib.sha512(raw_entropy).digest()[:32])
    check("sha256(entropy)", hashlib.sha256(raw_entropy).digest())
    check("sha512(seed)[:32]", hashlib.sha512(seed).digest()[:32])
    check("sha256(seed)", hashlib.sha256(seed).digest())

if not found_key:
    print("\n❌ No derivation matched. The wallet likely encrypts the key differently.")
    print("   → Best option: open your wallet app (e.g., Pera/Defly/MyAlgo) and")
    print("     export the 25-word Algorand mnemonic (NOT the 24-word seed phrase).")
else:
    print("\n✅ Key found! Run deploy_testnet_bip39.py — it will now succeed.")
