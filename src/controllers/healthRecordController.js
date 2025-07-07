const toolsUtil = require('../utils/toolsUtil')
const web3Util = require('../utils/web3Util')

const fs = require('fs-extra')
const aesUtil = require('../utils/aesUtil')
const axios = require('axios')
const FormData = require('form-data')
const crypto = require('crypto')
const path = require('path')

const TemporaryPMRModel = require('../models/TemporaryPMRModel')
const catchAsync = require('../utils/catchAsync')
const AppError = require('../utils/appError')
const { v4: uuidv4 } = require('uuid');

/**
 * Fungsi: Mengirimkan ulang verifikasi catatan kesehatan
 */
exports.postHealthRecordVerification = catchAsync(async (req, res, next) => {
    // Validasi data yang dikirimkan
    if (!toolsUtil.checkValidation(req)) {
        return next(new AppError('Data yang dikirim tidak valid.', 400))
    }

    const recordId = req.params.recordId;

    const tempRecord = await TemporaryPMRModel.findOne({
        where: {
            id: recordId,
            creator_address: req.authData.address,
        }
    });
    if(!tempRecord){
        return next(new AppError('Data transaksi tidak ditemukan.', 404))
    }
   
    // Data ABI untuk Public Transaction
    const dataVerification = {
        id: tempRecord.id, 
        ownerAddress: tempRecord.owner_address,
        txHash: tempRecord.tx_hash,
    }

    const publicNode = web3Util.getPublic();
    const tx = publicNode.contract.methods.addVerification(
        ...Object.values(dataVerification)
    )
    
    toolsUtil.success(res, 'Berhasil membuat data transaksi untuk melakukan verifikasi catatan kesehatan.', {
        transactionData: tx.encodeABI(),
        recordId: tempRecord.id,
    })
});

/**
 * Fungsi: Menambahkan catatan kesehatan
 */
exports.postHealthRecord = catchAsync(async (req, res, next) => {
    // Validasi data yang dikirimkan
    if (!toolsUtil.checkValidation(req)) {
        return next(new AppError('Data yang dikirim tidak valid.', 400))
    }
    // Validasi apakah terdapat file yang dikirimkan
    if (!req.file) {
        return next(new AppError('Data yang dikirim tidak valid.', 400))
    }

    let nodeBest = web3Util.getBestPrivate();
    const currentUser = await nodeBest.contract.methods.getUser(req.body.patientAddress).call();
    nodeBest.done();
    if(!currentUser){
        return next(new AppError('Data pasien tidak tersedia.', 400))
    }

    if(currentUser.role != "Patient"){
        return next(new AppError('Pengguna ini bukan merupakan pasien.', 400))
    }

    // Upload File
    //aesKey yang digunakan adalah milik pasien, bukan dokter
    console.log("Start encrypting file");
    //Dokter mengambil aesKey pasien dengan cara Mengambil data pasien menggunakan getUser(patientAddress)
    //Menggunakan currentUser.aesKey (milik pasien) untuk mengenkripsi file
    //bertanggung jawab untuk enkripsi file dengan AES-256 sebelum upload ke IPFS
    await aesUtil.encryptFile(req.body.patientAddress, currentUser.aesKey, req.file)
    console.log("Finished encrypting file");


    console.log("Start upload file to IPFS");
    const pathFile = `./public/files/uploads/${req.body.patientAddress}-data.txt`
    const form = new FormData()
    form.append('path', fs.createReadStream(pathFile))
    const response = await axios.post(`${process.env.IPFS_URL_ADD}/add`, form, {
        headers: {
            ...form.getHeaders(),
        },
    })
    if (response.status !== 200) {
        return next(new AppError('Gagal menambahkan data ke IPFS.', 400))
    }
    console.log("Finished upload file to IPFS");

    // Data ABI untuk Private Transaction
    const dataPMR = {
        senderAddress: req.authData.address,
        patientAddress: req.body.patientAddress,
        newRecordId: uuidv4(),
        description: req.body.description,
        cid: response.data.Hash,
        recordType: req.body.recordType,
        createdAt: new Date().toISOString(),
    }

    nodeBest = web3Util.getBestPrivate();
    const privateTX = nodeBest.contract.methods.createHealthRecord(
        ...Object.values(dataPMR)
    )
    const result = await web3Util.privateSendTransaction(privateTX.encodeABI());
    nodeBest.done();

    if(!result){
        return next(new AppError('Gagal melakukan transaksi pada blockchain.', 400))
    }
    console.log("Finished private transaction");

    // simpan ke tmp
    try {
        TemporaryPMRModel.create({
            id: dataPMR.newRecordId,
            creator_address: req.authData.address,
            owner_address: req.body.patientAddress,
            tx_hash: result.join(','),
        })
    } catch (error) {
        console.log("postHealthRecord: ", error);
    }
    console.log("Finished saving to temporary model");

    // Data ABI untuk Public Transaction
    const dataVerification = {
        id: dataPMR.newRecordId, 
        owner: req.body.patientAddress,
        txHash: result.join(','),
    }

    const publicNode = web3Util.getPublic();
    const tx = publicNode.contract.methods.addVerification(
        ...Object.values(dataVerification)
    )
    
    toolsUtil.success(res, 'Berhasil membuat data transaksi untuk membuat catatan kesehatan.', {
        transactionData: tx.encodeABI(),
        recordId: dataPMR.newRecordId,
    })
});

/**
 * Fungsi: mengambil data catatan kesehatan dengan recordId
 */
// eslint-disable-next-line no-unused-vars
exports.getHealthRecord = catchAsync(async (req, res, next) => {

    const data = {
        senderAddress: req.authData.address,
        patientAddress: req.params.address, 
        recordId: req.params.recordId,
    }

    let bestNode = web3Util.getBestPrivate();
    const healthRecord = await bestNode.contract.methods.getHealthRecord(
        ...Object.values(data)
    ).call();
    bestNode.done();

    const filteredHR = toolsUtil.filterObjectByKeys(healthRecord, [
        "id", "creatorAddress", "description", "cid", "recordType", "createdAt",
        "isActive", "version", "previousId"
    ]);

    try {
        // Ambil data creator
        bestNode = web3Util.getBestPrivate();
        const creator = await bestNode.contract.methods.getUser(filteredHR.creatorAddress).call();
        bestNode.done();

        const filteredUser = toolsUtil.filterObjectByKeys(creator, [
            "name", "birthDate", "homeAddress", "role"
        ]);
        filteredUser.address = filteredHR.creatorAddress;
        filteredHR.creator = filteredUser;
        

        const publicNode = web3Util.getPublic();
        filteredHR.isVerified = await publicNode.contract.methods.checkIsVerification(
            req.params.recordId,
            filteredHR.creatorAddress,
        ).call();
    } catch (error) {
        console.log("getHealthRecord", error);
        filteredHR.isVerified = false;
    }
    
    toolsUtil.success(res, 'Berhasil mengambil data.', {
        healthRecord: filteredHR
    })
});

/*
 * Fungsi: mengambil data catatan kesehatan dengan address
 */
// eslint-disable-next-line no-unused-vars
exports.getHealthRecordByAddress = catchAsync(async (req, res, next) => {
    const data = {
        senderAddress: req.authData.address,
        patientAddress: req.params.address, 
    }

    let bestNode = web3Util.getBestPrivate();
    const healthRecords = await bestNode.contract.methods.getHealthRecordsByAddress(
        ...Object.values(data)
    ).call();
    bestNode.done();

    let permission = {};
    if(req.params.address == req.authData.address){
        permission = {
            canCreate: true,
            canRead: true,
            canUpdate: true,
            canDelete: true
        }
    }else{
        try {
            bestNode = web3Util.getBestPrivate();
            const rawPermission = await bestNode.contract.methods.getDoctorPermission(
                req.authData.address,
                req.params.address,
            ).call();
            bestNode.done();

            permission = toolsUtil.filterObjectByKeys(rawPermission, [
                "canCreate", "canRead", "canUpdate", "canDelete"
            ])
        } catch(error) {
            console.log(error);
            permission = {
                canCreate: false,
                canRead: false,
                canUpdate: false,
                canDelete: false
            }
        }
    }

    // Health Records
    const filteredHealthRecords = await Promise.all(
        healthRecords.map(async hr => {
            if (hr.isActive) {
                bestNode = web3Util.getBestPrivate();
                const creator = await bestNode.contract.methods.getUser(hr.creatorAddress).call();
                bestNode.done();

                const filteredUser = toolsUtil.filterObjectByKeys(creator, [
                    "name", "birthDate", "homeAddress", "role"
                ]);
                filteredUser.address = hr.creatorAddress;
                hr.creator = filteredUser;

                if (
                    !permission.canRead && 
                    req.authData.address && hr.creatorAddress &&
                    req.authData.address.toLowerCase() != hr.creatorAddress.toLowerCase() && 
                    req.authData.address.toLowerCase() != req.params.address.toLowerCase()
                ) {
                    return null; // Filter out records if the user does not have permission to read
                }

                return toolsUtil.filterObjectByKeys(hr, [
                    "id", "creator", "description", "cid", "recordType", "createdAt", "isActive",
                    "version", "previousId"
                ]);
            } else {
                return null; // Return null for inactive records
            }
        })
    );

    // Filter out null values from the result
    const filteredHealthRecordsCleaned = filteredHealthRecords.filter(hr => hr !== null);

    // ambil status isVerified
    await Promise.all(
        filteredHealthRecordsCleaned.map(async hr => {
            try {
                const publicNode = web3Util.getPublic();
                hr.isVerified = await publicNode.contract.methods.checkIsVerification(
                    hr.id,
                    hr.creator.address,
                ).call();
            } catch (error) {
                console.log("getHealthRecordByAddress", error);
                hr.isVerified = false;
            }
        })
    );

    const reversedHealthRecords = filteredHealthRecordsCleaned.reverse();
    toolsUtil.success(res, 'Berhasil mengambil data.', {
        healthRecords: reversedHealthRecords
    })
});

/**
 * Fungsi: Mengubah catatan kesehatan
 */
exports.putHealthRecord = catchAsync(async (req, res, next) => {
    // Validasi data yang dikirimkan
    if (!toolsUtil.checkValidation(req)) {
        return next(new AppError('Data yang dikirim tidak valid.', 400))
    }
    // Validasi apakah terdapat file yang dikirimkan
    if (!req.file) {
        return next(new AppError('Data yang dikirim tidak valid.', 400))
    }

    let bestNode = web3Util.getBestPrivate();
    const currentUser = await bestNode.contract.methods.getUser(req.params.address).call();
    bestNode.done();

    if(!currentUser){
        return next(new AppError('Data pasien tidak tersedia.', 404))
    }

    if(currentUser.role != "Patient"){
        return next(new AppError('Pengguna ini bukan merupakan pasien.', 400))
    }

    bestNode = web3Util.getBestPrivate();
    const healthRecord = await bestNode.contract.methods.getHealthRecord(
        req.authData.address,
        req.params.address, 
        req.params.recordId
    ).call();
    bestNode.done();

    if(!healthRecord){
        return next(new AppError('Data catatan kesehatan tidak tersedia.', 404))
    }

    // Upload File
    await aesUtil.encryptFile(req.body.patientAddress, currentUser.aesKey, req.file)

    const pathFile = `./public/files/uploads/${req.body.patientAddress}-data.txt`
    const form = new FormData()
    form.append('path', fs.createReadStream(pathFile))
    const response = await axios.post(`${process.env.IPFS_URL_ADD}/add`, form, {
        headers: {
            ...form.getHeaders(),
        },
    })
    if (response.status !== 200) {
        return next(new AppError('Gagal menambahkan data ke IPFS.', 400))
    }

    // Data ABI untuk Private Transaction
    const dataPMR = {
        senderAddress: req.authData.address,
        patientAddress: req.params.address, 
        newRecordId: uuidv4(),
        recordId: req.params.recordId, 
        description: req.body.description, 
        cid: response.data.cid,
        recordType: req.body.recordType,
        createdAt: new Date().toISOString(),
    }

    bestNode = web3Util.getBestPrivate();
    const privateTX = bestNode.contract.methods.updateHealthRecord(
        ...Object.values(dataPMR)
    )
    const result = await web3Util.privateSendTransaction(privateTX.encodeABI());
    bestNode.done();

    if(!result){
        return next(new AppError('Gagal melakukan transaksi pada blockchain private.', 400))
    }

    // simpan ke tmp
    try {
        TemporaryPMRModel.create({
            id: dataPMR.newRecordId,
            creator_address: req.authData.address,
            owner_address: req.params.address,
            tx_hash: result.join(','),
        })
    } catch (error) {
        console.log("putHealthRecord: ", error);
    }

    // Data ABI untuk Public Transaction
    const dataVerification = {
        id: dataPMR.newRecordId, 
        ownerAddress: req.params.address,
        txHash: result.join(','),
    }

    const publicNode = web3Util.getPublic();
    const tx = publicNode.contract.methods.addVerification(
        ...Object.values(dataVerification)
    )
    
    toolsUtil.success(res, 'Berhasil membuat data transaksi untuk mengubah catatan kesehatan.', {
        transactionData: tx.encodeABI(),
        recordId: dataPMR.newRecordId,
    })
});

/**
 * Fungsi: Mengubah file catatan kesehatan
 */
exports.putHealthRecordNoFile = catchAsync(async (req, res, next) => {
    // Validasi data yang dikirimkan
    if (!toolsUtil.checkValidation(req)) {
        return next(new AppError('Data yang dikirim tidak valid.', 400))
    }
  
    let bestNode = web3Util.getBestPrivate();
    const currentUser = await bestNode.contract.methods.getUser(req.params.address).call();
    bestNode.done();
    if(!currentUser){
        return next(new AppError('Data pasien tidak tersedia.', 404))
    }

    if(currentUser.role != "Patient"){
        return next(new AppError('Pengguna ini bukan merupakan pasien.', 400))
    }

    bestNode = web3Util.getBestPrivate();
    const healthRecord = await bestNode.contract.methods.getHealthRecord(
        req.authData.address,
        req.params.address, 
        req.params.recordId
    ).call();
    bestNode.done();

    if(!healthRecord){
        return next(new AppError('Data catatan kesehatan tidak tersedia.', 404))
    }

    if(!healthRecord.isActive){
        return next(new AppError('Data catatan kesehatan sudah tidak aktif.', 400))
    }

    // Data ABI untuk Private Transaction
    const dataPMR = {
        senderAddress: req.authData.address,
        patientAddress: req.params.address, 
        newRecordId: uuidv4(),
        recordId: req.params.recordId, 
        description: req.body.description, 
        cid: healthRecord.cid,
        recordType: req.body.recordType,
        createdAt: new Date().toISOString(),
    }
    bestNode = web3Util.getBestPrivate();
    const privateTX = bestNode.contract.methods.updateHealthRecord(
        ...Object.values(dataPMR)
    )
    const result = await web3Util.privateSendTransaction(privateTX.encodeABI());
    bestNode.done();

    if(!result){
        return next(new AppError('Gagal melakukan transaksi pada blockchain private.', 400))
    }

    // simpan ke tmp
    try {
        TemporaryPMRModel.create({
            id: dataPMR.newRecordId,
            creator_address: req.authData.address,
            owner_address: req.params.address,
            tx_hash: result.join(','),
        })
    } catch (error) {
        console.log("putHealthRecordNoFile: ", error);
    }

    // Data ABI untuk Public Transaction
    const dataVerification = {
        id: dataPMR.newRecordId, 
        ownerAddress: req.params.address,
        txHash: result.join(','),
    }

    const publicNode = web3Util.getPublic();
    const tx = publicNode.contract.methods.addVerification(
        ...Object.values(dataVerification)
    )

    toolsUtil.success(res, 'Berhasil membuat data transaksi untuk mengubah catatan kesehatan.', {
        transactionData: tx.encodeABI(),
        recordId: dataPMR.newRecordId,
    });
});

/**
 * Fungsi: Menghapus catatan kesehatan
 */
exports.deleteHealthRecord = catchAsync(async (req, res, next) => {
    // Validasi data yang dikirimkan
    if (!toolsUtil.checkValidation(req)) {
        return next(new AppError('Data yang dikirim tidak valid.', 400))
    }

    let bestNode = web3Util.getBestPrivate();
    const currentUser = await bestNode.contract.methods.getUser(req.params.address).call();
    bestNode.done();

    if(!currentUser){
        return next(new AppError('Data pasien tidak tersedia.', 404))
    }

    if(currentUser.role != "Patient"){
        return next(new AppError('Pengguna ini bukan merupakan pasien.', 400))
    }

    bestNode = web3Util.getBestPrivate();
    const healthRecord = await bestNode.contract.methods.getHealthRecord(
        req.authData.address,
        req.params.address, 
        req.params.recordId
    ).call();
    bestNode.done();

    if(!healthRecord){
        return next(new AppError('Data catatan kesehatan tidak tersedia.', 404))
    }

    // Data ABI untuk Private Transaction
    bestNode = web3Util.getBestPrivate();
    const privateTX = bestNode.contract.methods.deleteHealthRecord(
        req.authData.address,
        req.params.address, 
        req.params.recordId,
    )
    const result = await web3Util.privateSendTransaction(privateTX.encodeABI());
    bestNode.done();

    if(!result){
        return next(new AppError('Gagal melakukan transaksi pada blockchain private.', 400))
    }
    
    toolsUtil.success(res, 'Berhasil melakukan transaksi untuk menghapus catatan kesehatan.', {
        transactionResult: result
    })
});

/**
 * Fungsi: Mengembalikan catatan kesehatan yang terhapus
 */
exports.putRevertHealthRecord = catchAsync(async (req, res, next) => {
    // Validasi data yang dikirimkan
    if (!toolsUtil.checkValidation(req)) {
        return next(new AppError('Data yang dikirim tidak valid.', 400))
    }

    let bestNode = web3Util.getBestPrivate();
    const currentUser = await bestNode.contract.methods.getUser(req.params.address).call();
    bestNode.done();

    if(!currentUser){
        return next(new AppError('Data pasien tidak tersedia.', 404))
    }

    if(currentUser.role != "Patient"){
        return next(new AppError('Pengguna ini bukan merupakan pasien.', 400))
    }

    bestNode = web3Util.getBestPrivate();
    const healthRecord = await bestNode.contract.methods.getHealthRecord(
        req.authData.address,
        req.params.address, 
        req.params.recordId
    ).call();
    bestNode.done();

    if(!healthRecord){
        return next(new AppError('Data catatan kesehatan tidak tersedia.', 404))
    }

    // Data ABI untuk Private Transaction
    bestNode = web3Util.getBestPrivate();
    const privateTX = bestNode.contract.methods.revertDeleteHealthRecord(
        req.authData.address,
        req.params.address, 
        req.params.recordId,
    )
    const result = await web3Util.privateSendTransaction(privateTX.encodeABI());
    bestNode.done();

    if(!result){
        return next(new AppError('Gagal melakukan transaksi pada blockchain private.', 400))
    }
    
    toolsUtil.success(res, 'Berhasil melakukan transaksi untuk mengembalikan catatan kesehatan yang terhapus.', {
        transactionResult: result
    })
});

/**
 * Fungsi: mengunduh file dengan CID IPFS
 */

//decrypt file dengan AES-256
exports.getDownloadFileByCID = catchAsync(async (req, res, next) => {

    let bestNode = web3Util.getBestPrivate();
    //currentUser mengacu pada pasien, karena Parameter yang digunakan adalah req.params.patientAddress (alamat pasien)
    //Dokter mengambil data pasien untuk mendapatkan aesKey pasien
    const currentUser = await bestNode.contract.methods.getUser(req.params.addressPatient).call();
    bestNode.done();
    if(!currentUser){
        return next(new AppError('Data pasien tidak tersedia.', 404))
    }

    if(currentUser.role != "Patient"){
        return next(new AppError('Pengguna ini bukan merupakan pasien.', 400))
    }
    
    const cid = req.params.cid

    axios.get(`${process.env.IPFS_URL_GET}/ipfs/${cid}`)
        .then((response) => {

            const encryptedHex = response.data
            //Dekripsi File (Langsung di getDownloadFileByCID)
            const algorithm = process.env.AES_ALGORITHM 
            const key = Buffer.from(currentUser.aesKey, 'hex') // Kunci 256-bit
            const iv = Buffer.from(process.env.AES_IV, 'hex')  // IV 16-byte

            // 1. Dekripsi AES ke string (mengandung metadata)
            const decipher = crypto.createDecipheriv(algorithm, key, iv)
            let decryptedString = decipher.update(encryptedHex, 'hex', 'utf8')
            decryptedString += decipher.final('utf8')

            // 2. Pisahkan metadata (nama & ekstensi) dari hex file
            const [fileName, fileHex] = decryptedString.split('::')

            if (!fileName || !fileHex) {
                return next(new AppError('Format data terenkripsi tidak valid.', 400))
            }

            // 3. Konversi hex ke buffer
            const fileBuffer = Buffer.from(fileHex, 'hex')

            // 4. Buat folder jika belum ada
            const folderPath = `./public/tmp/${req.params.addressPatient}`
            if (!fs.existsSync(folderPath)) {
                fs.mkdirSync(folderPath, { recursive: true })
            }

            // 5. Simpan & kirim file
            const outputPath = path.join(folderPath, fileName)
            fs.writeFileSync(outputPath, fileBuffer)

            res.download(outputPath, fileName, (err) => {
                if (err) return next(new AppError('Gagal mengunduh file.', 500))
                try {
                    fs.unlinkSync(outputPath) // Hapus setelah dikirim
                // eslint-disable-next-line no-unused-vars
                } catch (e) {
                    // console.log("healthRecordController", e)
                }
            })
        })
        .catch((error) => {
            console.log(error)
            return next(new AppError('Data CID tidak tersedia pada IPFS.', 400))
        })
})
