const fs = require('fs-extra');
const path = require('path');
const Web3 = require('web3');
const solc = require('solc');

async function compileContract(contractFileName) {
  // Baca source file
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
  
  return {
    abi: contractData.abi,
    bytecode: contractData.evm.bytecode.object,
  };
}

compileContract("DataStorage.sol")
  .then(() => console.log('compileContract selesai.'))
  .catch((err) => console.error('Error during deployment:', err));
