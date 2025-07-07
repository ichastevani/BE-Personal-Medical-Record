const toolsUtil = require('../utils/toolsUtil')
const web3Util = require('../utils/web3Util')

const catchAsync = require('../utils/catchAsync')
const AppError = require('../utils/appError')

/**
 * Fungsi: mengecek node terbaik yang digunakan
 */
// eslint-disable-next-line no-unused-vars
exports.getBestPrivasteNode = catchAsync(async (req, res, next) => {
    const nodeBest = web3Util.getBestPrivate()
    nodeBest.done();
    toolsUtil.success(res, 'Berhasil mengambil node terbaik.', {
        node_position: nodeBest.position,
        total_queue: nodeBest.queue,
        contract_address: nodeBest.contractAddress,
    });
});


//Fungsi: Pasien memberikan izin kepada dokter
//memanggil fungsi di kontrak
exports.putPermissionPatientGrantDoctor = catchAsync(async (req, res, next) => {
    // Validasi data yang dikirimkan
    if (!toolsUtil.checkValidation(req)) {
        return next(new AppError('Data yang dikirim tidak valid.', 400))
    }

    let nodeBest = web3Util.getBestPrivate()
    const currentUser = await nodeBest.contract.methods.getUser(req.body.addressDoctor).call();
    nodeBest.done();
    if(!currentUser){
        return next(new AppError('Data pengguna tidak tersedia.', 404))
    }

    if(currentUser.role != "Doctor"){
        return next(new AppError('Pengguna ini bukan merupakan dokter.', 400))
    }

    const dataPermission = {
        senderAddress: req.authData.address,
        doctorAddress: req.body.addressDoctor, 
        canCreate: req.body.canCreate,
        canRead: req.body.canRead,
        canUpdate: req.body.canUpdate,
        canDelete: req.body.canDelete,
    }

    // Data ABI untuk Private Transaction
    nodeBest = web3Util.getBestPrivate();
    const privateTX = nodeBest.contract.methods.permissionPatientGrantDoctor(
        ...Object.values(dataPermission)
    )
    const result = await web3Util.privateSendTransaction(privateTX.encodeABI())
    nodeBest.done();
    if(!result){
        return next(new AppError('Gagal melakukan transaksi pada blockchain private.', 400))
    }

    toolsUtil.success(res, 'Berhasil membuat data transaksi untuk memberikan izin kepada dokter.', {
        transactionResult: result.join(', ')
    })
});

/**
 * Fungsi: Pasien menolak memberikan izin kepada dokter
 */
exports.putPermissionPatientRevokeDoctor = catchAsync(async (req, res, next) => {
    // Validasi data yang dikirimkan
    if (!toolsUtil.checkValidation(req)) {
        return next(new AppError('Data yang dikirim tidak valid.', 400))
    }

    let nodeBest = web3Util.getBestPrivate();
    const currentUser = await nodeBest.contract.methods.getUser(req.body.addressDoctor).call();
    nodeBest.done();
    if(!currentUser){
        return next(new AppError('Data pengguna tidak tersedia.', 404))
    }

    if(currentUser.role != "Doctor"){
        return next(new AppError('Pengguna ini bukan merupakan dokter.', 400))
    }

    // Data ABI untuk Private Transaction
    nodeBest = web3Util.getBestPrivate();
    const privateTX = nodeBest.contract.methods.permissionPatientRevokeDoctor(
        req.authData.address,
        req.body.addressDoctor
    )
    const result = await web3Util.privateSendTransaction(privateTX.encodeABI());
    nodeBest.done();

    if(!result){
        return next(new AppError('Gagal melakukan transaksi pada blockchain private.', 400))
    }

    toolsUtil.success(res, 'Berhasil membuat data transaksi untuk mencabut izin dokter.', {
        transactionResult: result.join(', ')
    })
});

/**
 * Fungsi: Dokter melakukan request untuk meminta izin kepada Pasien
 */
exports.putRequestAccessDoctor = catchAsync(async (req, res, next) => {
    // Validasi data yang dikirimkan
    if (!toolsUtil.checkValidation(req)) {
        return next(new AppError('Data yang dikirim tidak valid.', 400))
    }

    let nodeBest = web3Util.getBestPrivate();
    const currentUser = await nodeBest.contract.methods.getUser(req.body.addressPatient).call();
    nodeBest.done();
    if(!currentUser){
        return next(new AppError('Data pengguna tidak tersedia.', 404))
    }

    if(currentUser.role != "Patient"){
        return next(new AppError('Pengguna ini bukan merupakan pasien.', 400))
    }

    // Data ABI untuk Private Transaction
    nodeBest = web3Util.getBestPrivate();
    const privateTX = nodeBest.contract.methods.requestAccessDoctor(
        req.authData.address,
        req.body.addressPatient,
        req.body.canCreate,
        req.body.canRead,
        req.body.canUpdate,
        req.body.canDelete,
    )
    const result = await web3Util.privateSendTransaction(privateTX.encodeABI());
    nodeBest.done();
    if(!result){
        return next(new AppError('Gagal melakukan transaksi pada blockchain private.', 400))
    }

    toolsUtil.success(res, 'Berhasil membuat data transaksi untuk meminta izin kepada pasien.', {
        transactionResult: result.join(', ')
    });
});

/**
 * Fungsi: Pasien menolak atau mengizinkan memberikan akses
 */
exports.putRequestAccessApproving = catchAsync(async (req, res, next) => {
    // Validasi data yang dikirimkan
    if (!toolsUtil.checkValidation(req)) {
        return next(new AppError('Data yang dikirim tidak valid.', 400))
    }

    let nodeBest = web3Util.getBestPrivate();
    const currentUser = await nodeBest.contract.methods.getUser(req.body.addressDoctor).call();
    nodeBest.done();
    if(!currentUser){
        return next(new AppError('Data pengguna tidak tersedia.', 404))
    }

    if(currentUser.role != "Doctor"){
        return next(new AppError('Pengguna ini bukan merupakan dokter.', 400))
    }

    let tx = null;
    if(req.body.isApproved){
        // Data ABI untuk Private Transaction
        nodeBest = web3Util.getBestPrivate();
        const privateTX = nodeBest.contract.methods.requestAccessApproved(
            req.authData.address,
            req.body.addressDoctor,
        )
        const result = await web3Util.privateSendTransaction(privateTX.encodeABI());
        nodeBest.done();

        if(!result){
            return next(new AppError('Gagal melakukan transaksi pada blockchain private.', 400))
        }

        tx = result
    }else{
        // Data ABI untuk Private Transaction
        nodeBest = web3Util.getBestPrivate();
        const privateTX = nodeBest.contract.methods.requestAccessDenied(
            req.authData.address,
            req.body.addressDoctor,
        )
        const result = await web3Util.privateSendTransaction(privateTX.encodeABI());
        nodeBest.done();

        if(!result){
            return next(new AppError('Gagal melakukan transaksi pada blockchain private.', 400))
        }

        tx = result
    }
    
    toolsUtil.success(res, 'Berhasil membuat data transaksi untuk memberikan respon terkait request akses yang diminta oleh dokter.', {
        transactionResult: tx.join(', ')
    })
});
