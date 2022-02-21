const express = require('express');
const app = express();
const fs = require("fs");
const path = require("path");
const homedir = require("os").homedir();
const port = 3000;
app.get('/create-transaction', (req, res) => {
	var amt=req.query.amt;
	const nearAPI = require('near-api-js');
const sha256 = require('js-sha256');
//this is required if using a local .env file for private key
require('dotenv').config();

// configure accounts, network, and amount of NEAR to send
// the amount is converted into yoctoNEAR (10^-24) using a near-api-js utility
const sender = req.query.sender;
//const receiver = 'saurabhksinha900.testnet';
const receiver = req.query.receiver;
const networkId = 'testnet';
const amount = nearAPI.utils.format.parseNearAmount(amt);

// sets up a NEAR API/RPC provider to interact with the blockchain
const provider = new nearAPI.providers
  .JsonRpcProvider(`https://rpc.${networkId}.near.org`);
 

// creates keyPair used to sign transaction
const privateKey = 'ed25519:2BVyornaHEqb1uUD5jzeny9whfzJ8bWETYT3eR3RE2o3uGxrKfR8WDVAoNrsmmKuXXrrzPHrGTUgQzCyoMnfYaZf';
const keyPair = nearAPI.utils.key_pair.KeyPairEd25519.fromString(privateKey);

async function main() {
  console.log('Processing transaction...');

  // gets sender's public key
  const publicKey = keyPair.getPublicKey();

  // gets sender's public key information from NEAR blockchain 
  const accessKey = await provider.query(
    `access_key/${sender}/${publicKey.toString()}`, ''
  );

  // checks to make sure provided key is a full access key
  if(accessKey.permission !== 'FullAccess') {
    return console.log(
      `Account [ ${sender} ] does not have permission to send tokens using key: [ ${publicKey} ]`
    );
  }

  // each transaction requires a unique number or nonce
  // this is created by taking the current nonce and incrementing it
  const nonce = ++accessKey.nonce;
 const WHITELIST_ACCOUNT_ID = "whitelisted-account.saurabhksinha90.testnet";
 const newArgs = {"num_confirmations": 2};
 const WASM_PATH = "utils/wasm-files/staking_pool_factory.wasm";
  // constructs actions that will be passed to the createTransaction method below
  //const actions = [nearAPI.transactions.functionCall("new", Buffer.from(JSON.stringify(newArgs)), 10000000000000, "1000")];
	const actions = [nearAPI.transactions.transfer(amount)];
	
  // converts a recent block hash into an array of bytes 
  // this hash was retrieved earlier when creating the accessKey (Line 26)
  // this is required to prove the tx was recently constructed (within 24hrs)
  const recentBlockHash = nearAPI.utils.serialize.base_decode(accessKey.block_hash);
 
  // create transaction
  const transaction = nearAPI.transactions.createTransaction(
    sender, 
    publicKey, 
    receiver, 
    nonce, 
    actions, 
    recentBlockHash
  );

  // before we can sign the transaction we must perform three steps...
  // 1) serialize the transaction in Borsh
  const serializedTx = nearAPI.utils.serialize.serialize(
    nearAPI.transactions.SCHEMA, 
    transaction
  );
  // 2) hash the serialized transaction using sha256
  const serializedTxHash = new Uint8Array(sha256.sha256.array(serializedTx));
  // 3) create a signature using the hashed transaction
  const signature = keyPair.sign(serializedTxHash);

  // now we can sign the transaction :)
  const signedTransaction = new nearAPI.transactions.SignedTransaction({
    transaction,
    signature: new nearAPI.transactions.Signature({ 
      keyType: transaction.publicKey.keyType, 
      data: signature.signature 
    })
  });

  // send the transaction!
  try {
    // encodes signed transaction to serialized Borsh (required for all transactions)
    const signedSerializedTx = signedTransaction.encode();
    // sends transaction to NEAR blockchain via JSON RPC call and records the result
    const result = await provider.sendJsonRpc(
      'broadcast_tx_commit', 
      [Buffer.from(signedSerializedTx).toString('base64')]
    );
    // console results :)
    res.send(result.transaction);
	console.log('Transaction Results: ', result.transaction);
    console.log('--------------------------------------------------------------------------------------------');
    console.log('OPEN LINK BELOW to see transaction in NEAR Explorer!');
    console.log(`$https://explorer.${networkId}.near.org/transactions/${result.transaction.hash}`);
    console.log('--------------------------------------------------------------------------------------------');
  } catch(error) {
    console.log(error);
  }
}

// run the function
main();
			
    //res.send('Hello World, from express');
});
app.listen(port, () => console.log(`Hello world app listening on port ${port}!`))