// node helper/contracts/createBlockContract.js

require('dotenv').config();
const { Web3 } = require('web3');
const fs = require('fs-extra');

const web3 = new Web3(process.env.ETH_VERIFICATION_INFURA_URL);

// Fungsi untuk meminta input dari terminal
const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
});

// Minta input private key dari user
readline.question('Masukkan Ethereum Private Key: ', async (ethPrivateKey) => {
    try {
        if (!ethPrivateKey.startsWith('0x')) {
            ethPrivateKey = '0x' + ethPrivateKey;
        }

        // Inisialisasi akun dengan private key
        const account = web3.eth.accounts.privateKeyToAccount(ethPrivateKey);
        web3.eth.accounts.wallet.add(account);
        web3.eth.defaultAccount = account.address;

        console.log('Akun Ethereum:', account.address);

        // Baca file kontrak secara async
        const source = JSON.parse(fs.readFileSync(process.env.ETH_VERIFICATION_CONTRACT_PATH, 'utf8'));

        if (!source.abi || !source.bytecode) {
            throw new Error('Data ABI atau Bytecode tidak tersedia di file kontrak.');
        }

        const { abi, bytecode } = source;

        // Deploy kontrak
        console.log('Mendeploy kontrak verification...');
        const contract = new web3.eth.Contract(abi);
        const contractInstance = await contract
            .deploy({ data: bytecode })
            .send({
                from: account.address,
                gasPrice: 0, // Atur gas sesuai kebutuhan

                // publik
                // gas: estimatedGas.toString(),
                // gasPrice: gasPrice.toString(),
            });

        const contractAddress = contractInstance.options.address;
        console.log('Kontrak berhasil dideploy di:', contractAddress);

        // Simpan alamat kontrak ke file address.txt
        const saveLocation = "./helper/contracts/VERIFICATION_CONTRACT_ADDRESS.txt";
        fs.writeFileSync(saveLocation, contractAddress);
        console.log(`Alamat kontrak disimpan ke: ${saveLocation}`);
    } catch (error) {
        console.error('Terjadi kesalahan:', error.message);
    } finally {
        readline.close();
    }
});
