#!/usr/bin/env python3
import hashlib, hmac, struct, base64, sys
from mnemonic import Mnemonic
from nacl.signing import SigningKey
from algosdk import account as algo_account

PHRASE = "joy own flavor ready lemon lizard axis accuse transfer sniff crowd slice search law raise act near similar easily pattern crew similar buddy history"
EXPECTED = "5GBN4T455FKIL34N5CQKDID3TCB7QVJ37RWLPHQMYNQOMO5EJEY2FPV2YQ"
SLIP10 = b"ed25519 seed"

def h512(k, d):
    return hmac.new(k, d, hashlib.sha512).digest()

def derive(seed, path):
    I = h512(SLIP10, seed)
    key, chain = I[:32], I[32:]
    for part in path.split("/")[1:]:
        idx = int(part.rstrip("'")) | 0x80000000
        I = h512(chain, b"\x00" + key + struct.pack(">I", idx))
        key, chain = I[:32], I[32:]
    return key

def to_addr(raw32):
    sk = SigningKey(raw32)
    full = raw32 + bytes(sk.verify_key)
    b64 = base64.b64encode(full).decode()
    return algo_account.address_from_private_key(b64), b64

mnemo = Mnemonic("english")
valid = mnemo.check(PHRASE)
print(f"BIP39 valid: {valid}")

seed = mnemo.to_seed(PHRASE, passphrase="")
ent  = mnemo.to_entropy(PHRASE)

all_paths = [
    "m/44'/283'/0'/0'/0'",
    "m/44'/283'/0'/0'/1'",
    "m/44'/283'/0'",
    "m/44'/283'",
    "m/44'/60'/0'/0'/0'",
]

found = False
for src_label, src in [("BIP39_seed", seed), ("entropy", ent)]:
    for path in all_paths:
        raw = derive(src, path)
        a, b64 = to_addr(raw)
        match = "MATCH!" if a == EXPECTED else ""
        print(f"{src_label:12s} {path:25s} => {a} {match}")
        if a == EXPECTED:
            print(f"  >>> b64 key: {b64}")
            found = True

# Direct raw attempts
for label, raw in [
    ("seed[:32]", seed[:32]),
    ("seed[32:]", seed[32:64]),
    ("sha256_seed", hashlib.sha256(seed).digest()),
    ("sha256_ent",  hashlib.sha256(ent).digest()),
    ("sha512_seed[:32]", hashlib.sha512(seed).digest()[:32]),
    ("sha512_seed[32:]", hashlib.sha512(seed).digest()[32:64]),
]:
    a, b64 = to_addr(raw)
    match = "MATCH!" if a == EXPECTED else ""
    print(f"direct {label:20s} => {a} {match}")
    if a == EXPECTED:
        print(f"  >>> b64 key: {b64}")
        found = True

if not found:
    print("\nNO MATCH found. The 24-word phrase cannot be derived to the expected address.")
    print("This wallet does NOT use standard BIP39->SLIP10->Algorand derivation.")
    sys.exit(1)
