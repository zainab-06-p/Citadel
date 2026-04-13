#!/usr/bin/env python3
"""
Check which of the user's 24 words are in Algorand's mnemonic wordlist.
Also generate a fresh testnet account to use for deployment.
"""
from algosdk.wordlist import word_list_raw
from algosdk import account, mnemonic

USER_WORDS = "joy own flavor ready lemon lizard axis accuse transfer sniff crowd slice search law raise act near similar easily pattern crew similar buddy history".split()

wl = set(w.strip() for w in word_list_raw().split("\n") if w.strip())

print("=== Wordlist check ===")
in_list = []
not_in_list = []
for w in USER_WORDS:
    if w in wl:
        in_list.append(w)
        print(f"  {w:15s} IN Algorand wordlist")
    else:
        not_in_list.append(w)
        print(f"  {w:15s} NOT in Algorand wordlist")

print(f"\n  IN: {len(in_list)}/24   NOT IN: {len(not_in_list)}/24")

print("\n=== Generating a fresh Algorand TestNet account ===")
pk, addr = account.generate_account()
mn = mnemonic.from_private_key(pk)
print(f"  New Address : {addr}")
print(f"  Mnemonic    : {mn}")
print(f"\nFund it at: https://bank.testnet.algorand.network/?account={addr}")
print("Then add to .env as: DEPLOYER_MNEMONIC=" + mn)
