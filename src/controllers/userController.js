const toolsUtil = require('../utils/toolsUtil')
const web3Util = require('../utils/web3Util')

const catchAsync = require('../utils/catchAsync')
const AppError = require('../utils/appError')

/**
 * Fungsi: mengecek apakah pengguna dengan address tersebut sudah terdaftar
 */
// eslint-disable-next-line no-unused-vars
exports.getExistUser = catchAsync(async (req, res, next) => {
    const bestNode = web3Util.getBestPrivate();
    const currentUser = await bestNode.contract.methods.checkIsUserRegistered(req.params.address).call();
    bestNode.done();
    toolsUtil.success(res, 'Berhasil mengambil data.', {
        isRegistered: currentUser,
    });
});

/**
 * Fungsi: mengambil data pengguna yang login saat ini
 */
// eslint-disable-next-line no-unused-vars
exports.getMe = catchAsync(async (req, res, next) => {
    let bestNode = web3Util.getBestPrivate();
    const currentUser = await bestNode.contract.methods.getUser(req.authData.address).call();
    bestNode.done();

    const filteredUser = toolsUtil.filterObjectByKeys(currentUser, [
        "name", "birthDate", "homeAddress", "role"
    ]);
    filteredUser.address = req.authData.address;

    toolsUtil.success(res, 'Berhasil mengambil data pengguna.', {
        user: filteredUser,
    })
});

/**
 * Fungsi: mengambil data pengguna yang login saat ini
 */
// eslint-disable-next-line no-unused-vars
exports.getUserByAddress = catchAsync(async (req, res, next) => {
    let permission = {};

    let bestNode = web3Util.getBestPrivate();
    const currentUser = await bestNode.contract.methods.getUser(req.params.addressPatient).call();
    bestNode.done();

    const filteredUser = toolsUtil.filterObjectByKeys(currentUser, [
        "name", "birthDate", "homeAddress", "role"
    ]);
    filteredUser.address =  req.params.addressPatient;

    if(req.params.addressPatient.toLowerCase() == req.authData.address.toLowerCase()){
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
                req.params.addressPatient,
            ).call({
                from: req.authData.address
            });
            bestNode.done();
            permission = toolsUtil.filterObjectByKeys(rawPermission, [
                "canCreate", "canRead", "canUpdate", "canDelete"
            ])
        } catch {
            permission = {
                canCreate: false,
                canRead: false,
                canUpdate: false,
                canDelete: false
            }
        }
    }

    toolsUtil.success(res, 'Berhasil mengambil data pengguna.', {
        user: filteredUser,
        permission
    })
});

/**
 * Fungsi: Mengambil izin yang diberikan oleh pasien kepada dokter
 */
exports.getDoctorPermissions = catchAsync(async (req, res, next) => {
    // Validasi data yang dikirimkan
    if (!toolsUtil.checkValidation(req)) {
        return next(new AppError('Data yang dikirim tidak valid.', 400))
    }

    let permission = {};
    if(
        req.params.addressDoctor.toLowerCase() == req.params.addressPatient.toLowerCase() && 
        req.params.addressPatient.toLowerCase() == req.authData.address.toLowerCase()
    ){
        permission = {
            canCreate: true,
            canRead: true,
            canUpdate: true,
            canDelete: true
        }
    }else{
        try {
            let bestNode = web3Util.getBestPrivate();
            const rawPermission = await bestNode.contract.methods.getDoctorPermission(
                req.params.addressDoctor,
                req.params.addressPatient,
            ).call({
                from: req.authData.address
            });
            bestNode.done();

            permission = toolsUtil.filterObjectByKeys(rawPermission, [
                "canCreate", "canRead", "canUpdate", "canDelete"
            ])
        } catch {
            permission = {
                canCreate: false,
                canRead: false,
                canUpdate: false,
                canDelete: false
            }
        }
    }
    
    
    toolsUtil.success(res, 'Berhasil mengambil data.', {
        permission
    })
});

/**
 * Fungsi: mengambil semua dokter dari pasien
 */
exports.getPatientDoctors = catchAsync(async (req, res, next) => {
    // Validasi data yang dikirimkan
    if (!toolsUtil.checkValidation(req)) {
        return next(new AppError('Data yang dikirim tidak valid.', 400))
    }

    let bestNode = web3Util.getBestPrivate();
    const access = await bestNode.contract.methods.getPatientDoctors(req.authData.address).call({
        from: req.authData.address
    });
    bestNode.done();

    access.permissions = access["0"];
    access.requestAccess = access["1"];
    const filteredAccess = toolsUtil.filterObjectByKeys(access, [
        "permissions", "requestAccess"
    ]);

    const dataDoctorPermissions = [];
    if(filteredAccess.permissions){
        await Promise.all(
            // Request Access
            filteredAccess.permissions.map(async doctor => {
                let bestNode = web3Util.getBestPrivate();
                const user = await bestNode.contract.methods.getUser(doctor.userAddress).call({
                    from: req.authData.address
                });
                bestNode.done();

                const data = {};
                data.user = toolsUtil.filterObjectByKeys(user, [
                    "name", "birthDate", "homeAddress", "role"
                ]);
                data.user.address = doctor.userAddress,

                data.access = toolsUtil.filterObjectByKeys(doctor, [
                    "canCreate", "canRead", "canUpdate", "canDelete"
                ]);
                dataDoctorPermissions.push(data);
            })
        )
    }

    const dataDoctorRequestAccess = [];
    if(filteredAccess.requestAccess){
        await Promise.all(
            // Request Access
            filteredAccess.requestAccess.map(async doctor => {
                let bestNode = web3Util.getBestPrivate();
                const user = await bestNode.contract.methods.getUser(doctor.userAddress).call({
                    from: req.authData.address
                });
                bestNode.done();

                const data = {};
                data.user = toolsUtil.filterObjectByKeys(user, [
                    "name", "birthDate", "homeAddress", "role"
                ]);
                data.user.address = doctor.userAddress,

                data.access = toolsUtil.filterObjectByKeys(doctor, [
                    "canCreate", "canRead", "canUpdate", "canDelete"
                ]);
                dataDoctorRequestAccess.push(data);
            })
        )
    }
    
    toolsUtil.success(res, 'Berhasil mengambil data.', {
        permissions: dataDoctorPermissions,
        requestAccess: dataDoctorRequestAccess,
    })
});

/**
 * Fungsi: mengambil semua pasien dari dokter
 */
exports.getDoctorPatients = catchAsync(async (req, res, next) => {
    // Validasi data yang dikirimkan
    if (!toolsUtil.checkValidation(req)) {
        return next(new AppError('Data yang dikirim tidak valid.', 400))
    }

    let bestNode = web3Util.getBestPrivate();
    const access = await bestNode.contract.methods.getDoctorPatients(req.authData.address).call({
        from: req.authData.address
    });
    bestNode.done();

    access.permissions = access["0"];
    access.requestAccess = access["1"];
    const filteredAccess = toolsUtil.filterObjectByKeys(access, [
        "permissions", "requestAccess"
    ]);

    const dataPatientPermissions = [];
    await Promise.all(
        // Request Access
        filteredAccess.permissions.map(async doctor => {
            let bestNode = web3Util.getBestPrivate();
            const user = await bestNode.contract.methods.getUser(doctor.userAddress).call({
                from: req.authData.address
            });
            bestNode.done();

            const data = {};
            data.user = toolsUtil.filterObjectByKeys(user, [
                "name", "birthDate", "homeAddress", "role"
            ]);
            data.user.address = doctor.userAddress,

            data.access = toolsUtil.filterObjectByKeys(doctor, [
                "canCreate", "canRead", "canUpdate", "canDelete"
            ]);
            dataPatientPermissions.push(data);
        })
    )

    const dataPatientRequestAccess = [];
    await Promise.all(
        // Request Access
        filteredAccess.requestAccess.map(async doctor => {
            let bestNode = web3Util.getBestPrivate();
            const user = await bestNode.contract.methods.getUser(doctor.userAddress).call({
                from: req.authData.address
            });
            bestNode.done();
            
            const data = {};
            data.user = toolsUtil.filterObjectByKeys(user, [
                "name", "birthDate", "homeAddress", "role"
            ]);
            data.user.address = doctor.userAddress,

            data.access = toolsUtil.filterObjectByKeys(doctor, [
                "canCreate", "canRead", "canUpdate", "canDelete"
            ]);
            dataPatientRequestAccess.push(data);
        })
    )
    
    toolsUtil.success(res, 'Berhasil mengambil data.', {
        permissions: dataPatientPermissions,
        requestAccess: dataPatientRequestAccess,
    })
});
