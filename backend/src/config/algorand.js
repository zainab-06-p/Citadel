const algosdk = require('algosdk');

// Algod client (for sending transactions)
const algodClient = new algosdk.Algodv2(
  process.env.ALGORAND_TOKEN || '',
  process.env.ALGORAND_SERVER || 'https://testnet-api.algonode.cloud',
  process.env.ALGORAND_PORT || 443
);

// Indexer client (for querying blockchain)
const indexerClient = new algosdk.Indexer(
  process.env.INDEXER_TOKEN || '',
  process.env.INDEXER_SERVER || 'https://testnet-idx.algonode.cloud',
  process.env.INDEXER_PORT || 443
);

module.exports = {
  algodClient,
  indexerClient,
  algosdk
};
