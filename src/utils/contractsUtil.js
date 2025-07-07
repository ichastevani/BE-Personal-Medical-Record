require('dotenv').config()
const { Web3 } = require('web3')

const UserContractModel = require('../models/UserContractModel')
const fs = require('fs-extra')
const UserTransactionModel = require('../models/UserTransactionModel')
const toolsUtil = require('./toolsUtil')
const web3 = new Web3(process.env.ETH_VERIFICATION_INFURA_URL)

exports.getContractBlock = async (user_id) => {
    const contracts = await UserContractModel.findAll({
        where: {
            user_id,
        },
        order: [['created_at', 'desc']],
        raw: true,
    })

    let userContractModel = null
    await Promise.all(
        contracts.map(async contract => {
            const code = await web3.eth.getCode(contract.contract_address)
            // '0x' berarti tidak ada kontrak pada alamat tersebut
            if (code && code !== '0x') {
                await UserContractModel.update({
                    is_available: true,
                }, {
                    where: {
                        user_id,
                        contract_address: contract.contract_address,
                    },
                })
                contract.is_available = true
                userContractModel = contract
            }
        }),
    )

    return userContractModel
}

exports.createContractBlock = async (user_id, ETH_STORAGE_KEY) => {
    // Inisialisasi Web3 ambil account
    const account = web3.eth.accounts.privateKeyToAccount(ETH_STORAGE_KEY)
    web3.eth.accounts.wallet.add(account)
    web3.eth.defaultAccount = account.address

    try {
        // Baca file kontrak secara async
        const source = JSON.parse(await fs.readFile(process.env.ETH_CONTRACT_PATH, 'utf8'))

        if (!source.abi || !source.bytecode) {
            return {
                'status': false,
                'message': 'Data ABI atau Bytcode tidak tersedia di file kontrak',
            }
        }

        const { abi, bytecode } = source

        // Deploy kontrak
        const contract = new web3.eth.Contract(abi) // Buat objek kontrak dulu
        const contractInstance = await contract
            .deploy({ data: bytecode })
            .send({
                from: account.address,
            })

        const contract_address = contractInstance.options.address

        const newUserContract = await UserContractModel.create({
            user_id,
            contract_address,
            is_available: true,
        })

        return {
            status: true,
            message: 'Berhasil membuat block kontrak',
            data: {
                user_contract: newUserContract,
            },
        }
    } catch (error) {
        return {
            'status': false,
            'message': 'Gagal membuat block kontrak: ' + error.message,
        }
    }
}

exports.addTransaction = async ({ data, contract_address, user_id, user_address, ETH_STORAGE_KEY }) => {
    const code = await web3.eth.getCode(contract_address)
    if (!code || code === '0x') {  // '0x' berarti tidak ada kontrak pada alamat tersebut
        return {
            status: false,
            message: 'Kontrak block yang digunakan tidak tersedia',
        }
    }

    try {
        // Inisialisasi Web3 ambil account
        const source = JSON.parse(fs.readFileSync(process.env.ETH_CONTRACT_PATH, 'utf8'))
        const abi = source.abi
        const contract = new web3.eth.Contract(abi, contract_address)

        const tx = contract.methods.addData(data)
        const gasPrice = await web3.eth.getGasPrice()

        const txData = {
            from: user_address,
            to: contract_address,
            gasPrice: gasPrice,
            data: tx.encodeABI(),
        }

        const signedTx = await web3.eth.accounts.signTransaction(txData, ETH_STORAGE_KEY)
        const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction)

        const newTransaction = await UserTransactionModel.create({
            user_id,
            contract_address: contract_address,
            tx_hash: receipt.transactionHash,
        })

        return {
            status: true,
            message: 'Berhasil melakukan transaksi',
            data: {
                transaction: newTransaction,
            },
        }
    } catch (error) {
        return {
            status: false,
            message: 'Gagal melakukan transaksi: ' + error.message,
        }
    }
}

exports.getTransactionsData = async (user_id) => {
    const contracts = await UserContractModel.findAll({
        where: {
            user_id,
        },
        order: [['created_at', 'desc']],
        raw: true,
    })

    const source = JSON.parse(fs.readFileSync(process.env.ETH_CONTRACT_PATH, 'utf8'))
    const abi = source.abi

    const user_contracts = []
    await Promise.all(
        contracts.map(async contract => {
            const code = await web3.eth.getCode(contract.contract_address)

            // '0x' berarti tidak ada kontrak pada alamat tersebut
            if (code && code !== '0x') {
                await UserContractModel.update({
                    is_available: true,
                }, {
                    where: {
                        user_id: user_id,
                        contract_address: contract.contract_address,
                    },
                })

                const eth_contract = new web3.eth.Contract(abi, contract.contract_address)
                const eth_contract_block_code = await web3.eth.getCode(contract.contract_address)

                // '0x' berarti tidak ada kontrak pada alamat tersebut
                if (eth_contract_block_code && eth_contract_block_code !== '0x') {
                    // Estimasi gas
                    const eth_data = await eth_contract.methods.getAllData().call()
                    eth_data.map(entry => {
                        user_contracts.push({
                            id: entry.id.toString(),
                            data: toolsUtil.safeParseJSON(entry.data.toString()),
                        })
                        return entry
                    })

                }
            } else {
                await UserContractModel.update({
                    is_available: false,
                }, {
                    where: {
                        user_id: user_id,
                        contract_address: contract.contract_address,
                    },
                })
            }
        }),
    )

    return user_contracts
}
