#!/usr/bin/env python3
"""
Try all 2048 words as 25th, print how many combos produce valid keys and what addresses they map to.
"""
from algosdk import mnemonic as m, account as a
from algosdk.wordlist import word_list_raw

base = "joy own flavor ready lemon lizard axis accuse transfer sniff crowd slice search law raise act near similar easily pattern crew similar buddy history"
EXPECTED = "5GBN4T455FKIL34N5CQKDID3TCB7QVJ37RWLPHQMYNQOMO5EJEY2FPV2YQ"

wl = [w.strip() for w in word_list_raw().split("\n") if w.strip()]
print(f"Wordlist size: {len(wl)}")

results = []
for word in wl:
    phrase = base + " " + word
    try:
        pk = m.to_private_key(phrase)
        addr = a.address_from_private_key(pk)
        results.append((word, addr))
    except Exception:
        pass

print(f"Valid combos: {len(results)}")
for word, addr in results[:5]:
    match = " <-- MATCH!" if addr == EXPECTED else ""
    print(f"  word={word:15s}  addr={addr}{match}")

any_match = any(addr == EXPECTED for _, addr in results)
if any_match:
    for word, addr in results:
        if addr == EXPECTED:
            print(f"\nFOUND! 25th word = {word}")
            print(f"Full mnemonic = {base} {word}")
else:
    print(f"\nNo match found for {EXPECTED}")
    if results:
        print("First valid address (for any word):", results[0][1])
