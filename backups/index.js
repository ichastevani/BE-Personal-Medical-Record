const express = require('express');
const { Web3 } = require('web3');
const { User, UserSmartContracts } = require('./models');
const path = require('path');
const solc = require('solc');
const fs = require('fs-extra');

const app = express();
app.use(express.json());

// Inisialisasi Web3 ke node Ethereum lokal (misalnya Ganache)
const web3 = new Web3(process.env.INFURA_URL || 'http://127.0.0.1:7545');

/**
 * Endpoint: POST /register
 * Body JSON: { "name": "Nama User", "email": "email@example.com" }
 * Fungsi: Mendaftarkan user, membuat akun Ethereum, dan menyimpan data ke database.
 */
app.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validasi input
    if (!name || !email) {
      return res.status(400).json({ error: 'Name dan email harus diisi.' });
    }

    // Buat akun Ethereum baru
    const newAccount = web3.eth.accounts.create();

    // Simpan data user ke database menggunakan Sequelize
    const user = await User.create({
      name,
      email,
      password,
      address: newAccount.address,
      privateKey: newAccount.privateKey, // Pastikan simpan dengan aman
    });

    res.json({
      message: 'User berhasil didaftarkan.',
      user,
    });
  } catch (error) {
    res.status(500).json({ error: error.toString() });
  }
});

/**
 * Endpoint: GET /users
 * Fungsi: Menampilkan semua user yang terdaftar.
 */
app.get('/users', async (req, res) => {
  try {
    const users = await User.findAll();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.toString() });
  }
});

/**
 * Endpoint: POST /smart-contracts
 * Fungsi: Membuat smart contract user
 */
app.post('/smart-contracts', async (req, res) => {
    try {
        const { email, password } = req.body;

        const dataUser = await User.findOne({
            where: {
                email,
                password,
            },
            raw: true,
        });

        if(!dataUser){
            throw new Error("Data user tidak ditemukan!");
        }

        // Inisialisasi Web3
        const account = web3.eth.accounts.privateKeyToAccount(dataUser.privateKey);
        web3.eth.accounts.wallet.add(account);
        web3.eth.defaultAccount = account.address;

        // Baca file bytecode & ABI dari build smart contract
        const contractFileName = "DataStorage.sol";
        const contractPath = path.resolve(__dirname, contractFileName);
        const source = fs.readFileSync(contractPath, 'utf8');
        
        // Persiapkan input untuk kompilasi solc (menggunakan standar JSON input)
        const input = {
          language: 'Solidity',
          sources: {
            [contractFileName]: {
              content: source,
            },
          },
          settings: {
            outputSelection: {
              '*': {
                '*': ['abi', 'evm.bytecode'],
              },
            },
          },
        };
      
        // Kompilasi
        const output = JSON.parse(solc.compile(JSON.stringify(input)));
        
        if (output.errors) {
          // Tampilkan error, jika ada error fatal maka hentikan proses
          output.errors.forEach((err) => {
            console.error(err.formattedMessage);
          });
          // Jika ada error fatal (bukan peringatan), lempar error
          if (output.errors.some((err) => err.severity === 'error')) {
            throw new Error('Compilation errors encountered');
          }
        }
          
        // Misalnya contract kita bernama DataStorage (sesuaikan jika berbeda)
        const contractName = 'DataStorage';
        const contractData = output.contracts[contractFileName][contractName];

        const bytecode = contractData.evm.bytecode.object;
        const abi = contractData.abi;

      const contractInstance = new web3.eth.Contract(abi);
      
      const deployedContract = await contractInstance.deploy({ data: bytecode }).send({
        from: account.address,
        gas: 3000000,
      });

      await UserSmartContracts.create({
        user_id: dataUser.id,
        bytecode,
        abi
      });
  
      res.json({
        message: 'Contract berhasil dideploy!',
        contractAddress: deployedContract.options.address,
      });
    } catch (error) {
      res.status(500).json({ error: error.toString() });
    }
  });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server berjalan di port ${PORT}`));
