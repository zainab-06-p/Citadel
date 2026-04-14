#!/usr/bin/env python3
"""
Brute-force the missing 25th Algorand mnemonic word (checksum word).
Tries all words in the algosdk wordlist until the resulting address matches.
"""
import sys
from algosdk import mnemonic as algo_mnemonic, account as algo_account
from algosdk.wordlist import word_list_raw

WORDS_24 = "joy own flavor ready lemon lizard axis accuse transfer sniff crowd slice search law raise act near similar easily pattern crew similar buddy history"
EXPECTED = "5GBN4T455FKIL34N5CQKDID3TCB7QVJ37RWLPHQMYNQOMO5EJEY2FPV2YQ"

wordlist = word_list_raw().split("\n")
wordlist = [w.strip() for w in wordlist if w.strip()]

print(f"Trying {len(wordlist)} candidate words for the 25th position...")
print(f"Target: {EXPECTED}")
print()

found_word = None
found_key  = None
found_addr = None

for w in wordlist:
    phrase = WORDS_24 + " " + w
    try:
        pk = algo_mnemonic.to_private_key(phrase)
        addr = algo_account.address_from_private_key(pk)
        if addr == EXPECTED:
            found_word = w
            found_key  = pk
            found_addr = addr
            break
    except Exception:
        pass

if found_word:
    print(f"SUCCESS! 25th word: {found_word}")
    print(f"Full mnemonic: {WORDS_24} {found_word}")
    print(f"Address: {found_addr}")
    print(f"Private key (b64): {found_key}")
else:
    print("FAILED: No word matched the expected address.")
    print("The 24 words may not be an Algorand mnemonic (wrong word order or different wallet).")
    sys.exit(1)
