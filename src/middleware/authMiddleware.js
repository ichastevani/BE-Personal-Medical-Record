const toolsUtil = require('../utils/toolsUtil');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

exports.parseBearerToken = function (req, res, next) {
    // Ambil informasi authorization dari header
    const bearerHeader = req.headers['authorization'];
    // periksa apakah bearear token undefined
    if (typeof bearerHeader !== 'undefined') {
        // pisahkan informasi header dengan bearer token
        const bearer = bearerHeader.split(' ');
        // jika panjang array kecil dua berarti tidak ada bearer token
        if (bearer.length < 2) req.token = null;
        else req.token = bearer[1];
    } else {
        // Token tidak tersedia
        req.token = null;
    }
    next();
};

exports.validateUser = catchAsync(async function (req, res, next) {
    // Periksa data token
    const resultDataToken = await toolsUtil.checkToken(req.token);

    if (!resultDataToken.status || !resultDataToken.data) {
        return next(new AppError(resultDataToken.message, 400));
    }

    req.authData = resultDataToken.data;
    next();
});

// exports.restrictTo = (...roles) => {
//     return (req, res, next) => {
//         if (!roles.includes(req.user.role)) {
//             return next(
//                 new AppError(
//                     'Anda tidak memiliki izin untuk melakukan tindakan ini.',
//                     403
//                 )
//             );
//         }

//         next();
//     };
// };
