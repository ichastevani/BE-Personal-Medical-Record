const catchAsync = require('../utils/catchAsync');
const toolsUtil = require('../utils/toolsUtil');
const AppError = require('../utils/appError');
const path = require('path');
const fs = require('fs-extra');
const solc = require('solc');
const { Web3 } = require('web3');

const UserModel = require('../models/UserModel');
const UserContractModel = require('../models/UserContractModel');

const web3 = new Web3(process.env.ETH_VERIFICATION_INFURA_URL);

/**
 * Fungsi: membuat contract user
 */
exports.postUser = catchAsync(async (req, res, next) => {
    // Inisialisasi Web3 ambil account
    const account = web3.eth.accounts.privateKeyToAccount(req.user.ETH_STORAGE_KEY);
    web3.eth.accounts.wallet.add(account);
    web3.eth.defaultAccount = account.address;

    const dataUserContract = await UserContractModel.findOne({
        where: {
            user_id: req.user.id,
            is_full: false,
        }
    });
    if(dataUserContract){
        return next(new AppError('Data kontrak telah tersedia.', 409))
    }

    async function deployContract() {
        try {
            // Baca file kontrak secara async
            const source = JSON.parse(await fs.readFile(process.env.CONTRACT_PATH, 'utf8'));

            if (!source.abi || !source.bytecode) {
                return next(new AppError("Data ABI atau Bytcode tidak tersedia", 400))
            }

            const { abi, bytecode } = source;

            // Deploy kontrak
            const contractInstance = await new web3.eth.Contract(abi)
                .deploy({ data: bytecode })
                .send({
                    from: account.address,
                    gas: 0,
                    gasPrice: web3.utils.toWei('0', 'gwei')
                });

            console.log("✅ Kontrak berhasil dideploy di:", contractInstance.options.address);
            return { status: true, data: contractInstance.options.address };

        } catch (error) {
            console.error("❌ Error deploying contract:", error.message || error);
            return { status: false, data: error.toString() };
        }
    }

    const result = await deployContract();
    if(! result.status){
        return next(new AppError("Error deploying contract: " + result.data, 400))
    }

    const newUserContract = await UserContractModel.create({
        user_id: req.user.id,
        contract_address: result.data,
        is_full: false,
    });

    toolsUtil.success(res, 'Berhasil membuat data kontrak pengguna.', {
        "user_contract_id": newUserContract.id
    });
});
