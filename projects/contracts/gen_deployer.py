#!/usr/bin/env python3
"""
Generate a fresh Algorand TestNet deployer account and write it to a file.
"""
from algosdk import account, mnemonic
import os

pk, addr = account.generate_account()
mn = mnemonic.from_private_key(pk)

out_path = os.path.join(os.path.dirname(__file__), "deployer_account.txt")
with open(out_path, "w") as f:
    f.write(f"Address : {addr}\n")
    f.write(f"Mnemonic: {mn}\n")
    f.write(f"Dispenser URL: https://bank.testnet.algorand.network/?account={addr}\n")

print(f"Written to {out_path}")
print(f"Address : {addr}")
print(f"Mnemonic: {mn}")
