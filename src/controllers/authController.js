const toolsUtil = require('../utils/toolsUtil');
const web3Util = require('../utils/web3Util');

const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const LoginTokenModel = require('../models/LoginTokenModel');
const jwt = require('jsonwebtoken');


/**
 * Fungsi: melakukan pendaftaran .
 */
exports.postRegister = catchAsync(async (req, res, next) => {
    // Validasi data yang
    if (!toolsUtil.checkValidation(req)) {
        return next(new AppError('Data yang dikirim tidak valid.', 400))
    }

    try{
        // Melakukan pengecekan apakah address rth valid
        let nodeBest = web3Util.getBestPrivate();
        nodeBest.web3.utils.toChecksumAddress(req.body.address);
        nodeBest.done();
    }catch(e){
        console.log("authContoller", e);
        return next(new AppError('Eth Address yang digunakan tidak valid.', 400))
    }

    const dataRegister = {
        senderAddress: req.body.address,
        name: req.body.name,
        birthDate: req.body.birthDate,
        homeAddress: req.body.homeAddress,
        aesKey: toolsUtil.generateAESKey(),
        passKey: req.body.password,
        role: req.body.role
    }

    // Data ABI untuk Private Transaction
    let nodeBest = web3Util.getBestPrivate();
    const privateTX = nodeBest.contract.methods.registerUser(
        ...Object.values(dataRegister)
    )
    const result = await web3Util.privateSendTransaction(privateTX.encodeABI());
    nodeBest.done();

    if(!result){
        return next(new AppError('Gagal melakukan pendaftaran.', 400))
    }

    toolsUtil.success(res, 'Berhasil membuat data pendaftaran.', {
        transactionResult: result
    })
})

/**
 * Fungsi: melakukan login .
 */
exports.postLogin = catchAsync(async (req, res, next) => {
    // Validasi data yang
    if (!toolsUtil.checkValidation(req)) {
        return next(new AppError('Data yang dikirim tidak valid.', 400))
    }

    // Periksa address ETH
    try{
        let nodeBest = web3Util.getBestPrivate();
        nodeBest.web3.utils.toChecksumAddress(req.body.address)
        nodeBest.done();
    }catch(e){
        console.log("authController", e)
        return next(new AppError('Address ETH yang digunakan tidak valid.', 400))
    }

    // Ambil data dari blockchain private
    let nodeBest = web3Util.getBestPrivate();
    let currentUser = await nodeBest.contract.methods.getUser(req.body.address).call();
    nodeBest.done();
    
    if(!currentUser){
        return next(new AppError('Data pengguna tidak tersedia.', 400))
    }

    if(currentUser.passKey != req.body.password){
        return next(new AppError('Kredensial akun tidak valid.', 401));
    }

    const authData = {
        address: req.body.address,
    };

    jwt.sign(authData, process.env.AUTH_SECRET, async (err, token) => {
        if (err) {
            return next(new AppError('Gagal membuat akses token!.', 401));
        } else {

            // Tambahkan token
            await LoginTokenModel.destroy({
                where: {
                    address: authData.address,
                }
            });

            await LoginTokenModel.create({
                address: authData.address,
                token: token,
            });

            const filteredUser = toolsUtil.filterObjectByKeys(currentUser, [
                "name", "birthDate", "homeAddress", "role"
            ]);
            filteredUser.address =  req.body.address;

            // success
            toolsUtil.success(res, 'Berhasil login.', {
                token: token,
                user: filteredUser,
            });
        }
    });
})
