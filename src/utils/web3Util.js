const { Web3 } = require('web3')
const fs = require('fs-extra')


// PUBLIC ETHEREUM NETWORK
// Membaca file kontrak dari path yang ditentukan di environment variable
const sourcePublic = JSON.parse(fs.readFileSync(process.env.ETH_VERIFICATION_CONTRACT_PATH, 'utf8'))
const abiPublic = sourcePublic.abi // Mengambil ABI (Application Binary Interface) dari kontrak
// Membuat instance Web3 yang terhubung ke Infura (URL dari env var)
const web3Public = new Web3(process.env.ETH_VERIFICATION_INFURA_URL);
// Mengambil alamat kontrak dari env var
const contractAddressPublic = process.env.ETH_VERIFICATION_CONTRACT_ADDRESS;
// Membuat instance kontrak Ethereum
const contractPublic = new web3Public.eth.Contract(abiPublic, contractAddressPublic)


// PRIVATE ETHEREUM NETWORK
const sourcePrivate = JSON.parse(fs.readFileSync(process.env.ETH_STORAGE_CONTRACT_PATH, 'utf8'))
const abiPrivate = sourcePrivate.abi

// PRIVATE ETHEREUM NETWORK 1
const web3Private1 = new Web3(process.env.ETH_STORAGE_INFURA_URL_1);
const contractAddressPrivate1 = process.env.ETH_STORAGE_CONTRACT_ADDRESS_1;
const contractPrivate1 = new web3Private1.eth.Contract(abiPrivate, contractAddressPrivate1)

// PRIVATE ETHEREUM NETWORK 2
const web3Private2 = new Web3(process.env.ETH_STORAGE_INFURA_URL_2);
const contractAddressPrivate2 = process.env.ETH_STORAGE_CONTRACT_ADDRESS_2;
const contractPrivate2 = new web3Private2.eth.Contract(abiPrivate, contractAddressPrivate2)

// PRIVATE ETHEREUM NETWORK 3
const web3Private3 = new Web3(process.env.ETH_STORAGE_INFURA_URL_3);
const contractAddressPrivate3 = process.env.ETH_STORAGE_CONTRACT_ADDRESS_3;
const contractPrivate3 = new web3Private3.eth.Contract(abiPrivate, contractAddressPrivate3)

//Deklarasi Node Private
// Simpan node dalam array dengan counter antrian
const privateNodes = [
    { position: 1, web3: web3Private1, contractAddress: contractAddressPrivate1, contract: contractPrivate1, privateKey: process.env.ETH_STORAGE_KEY_1, queue: 0 },
    { position: 2, web3: web3Private2, contractAddress: contractAddressPrivate2, contract: contractPrivate2, privateKey: process.env.ETH_STORAGE_KEY_2, queue: 0 },
    { position: 3, web3: web3Private3, contractAddress: contractAddressPrivate3, contract: contractPrivate3, privateKey: process.env.ETH_STORAGE_KEY_3, queue: 0 },
  ];

const publicNode = {
    web3: web3Public,
    contractAddress: contractAddressPublic,
    contract: contractPublic,
}
  
//Fungsi Round Robin (getBestPrivate())
exports.getBestPrivate = function() {
    // Pilih node dengan antrian terkecil
    let bestIndex = 0;
    let minQueue = privateNodes[0].queue;
  
    for (let i = 1; i < privateNodes.length; i++) {
      if (privateNodes[i].queue < minQueue) {
        minQueue = privateNodes[i].queue;
        bestIndex = i;
      }
    }
  
    // Tambah antrian saat node dipilih
    privateNodes[bestIndex].queue++;
  
    // Kembalikan node terbaik + fungsi untuk decrement queue setelah request selesai
    return {
        web3: privateNodes[bestIndex].web3,
        contract: privateNodes[bestIndex].contract,
        contractAddress: privateNodes[bestIndex].contractAddress,
        privateKey: privateNodes[bestIndex].privateKey,
        position: privateNodes[bestIndex].position,
        queue: privateNodes[bestIndex].queue,
        done: () => { privateNodes[bestIndex].queue = Math.max(0, privateNodes[bestIndex].queue - 1); }
    };
};

exports.getPublic = function() {
    return publicNode;
}



exports.privateGetEthAddress = function(nodePrivate){
    try {
        const account = nodePrivate.web3.eth.accounts.privateKeyToAccount(nodePrivate.privateKey);
        return account.address;
    }catch(e){
        console.log(e);
        return "";
    }
}
//Pengiriman Transaksi
exports.privateSendTransaction = async function(data){
    const txHashes = [];
    let isValid = true;

    for (const node of privateNodes) {
        try {
            node.queue++;
            const account = node.web3.eth.accounts.privateKeyToAccount(node.privateKey);
            const ethAddress = account.address;

            const deployOptions = {
                data: data
            };
            //Estimasi GAS LIMIT
            const estimatedGas = await node.contract.deploy(deployOptions).estimateGas({ from: ethAddress });
            const adjustEstimatedGas = Math.floor(Number(estimatedGas) * 1.2); // +20% to avoid underpriced tx
            //Hitung biaya gas (gasPrice dan gasEstimate).
            const gasPrice = await node.web3.eth.getGasPrice();
            const adjustedGasPrice = Math.floor(Number(gasPrice) * 1.2); // +20% to avoid underpriced tx

            // const nonce = await node.web3.eth.getTransactionCount(ethAddress, 'pending');
            // console.log("Nonce:", nonce);

            const txData = {
                from: ethAddress,
                to: node.contractAddress,
                gas: adjustEstimatedGas,
                gasPrice: adjustedGasPrice,
                data: data,
                value: '0x0',
                // nonce: nonce
            };

            //Tandatangani transaksi dengan private key admin
            const signedTx = await node.web3.eth.accounts.signTransaction(txData, node.privateKey);
            // Kirim transaksi ke jaringan bockchain
            const receipt = await node.web3.eth.sendSignedTransaction(signedTx.rawTransaction);
            node.queue = Math.max(0, node.queue - 1);
            
            txHashes.push(receipt.transactionHash);
        } catch (e) {
            console.log(`Error on node ${node.web3.currentProvider.host}:`, e);
            node.queue = Math.max(0, node.queue - 1);
            isValid = false;;
        }
    }

    if(!isValid) {
        return false;
    }
    return txHashes;
} 

exports.publicSendTransaction = async function(web3Public, privateKey, data){
    try {
        const account = web3Public.eth.accounts.privateKeyToAccount(privateKey);
        const ethAddress = account.address;

        // 1. Dapatkan GAS PRICE dari jaringan
        const gasPrice = await web3Public.eth.getGasPrice()
        const txData = {
            from: ethAddress,
            to: process.env.ETH_VERIFICATION_CONTRACT_ADDRESS,
            gasPrice: gasPrice,
            data,
        }

        // Tanda tangani transaksi
        const signedTx = await web3Public.eth.accounts.signTransaction(txData, privateKey);
        // Kirim transaksi ke jaringan Ethereum
        const receipt = await web3Public.eth.sendSignedTransaction(signedTx.rawTransaction);
        console.log(receipt);
        return true;
    } catch (e) {
        console.log(e);
        return false;
    }
} 


