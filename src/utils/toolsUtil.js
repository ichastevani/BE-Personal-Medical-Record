const { validationResult } = require('express-validator');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const toolsUtil = require("./toolsUtil");
const crypto = require('crypto');

const LoginTokenModel = require('../models/LoginTokenModel');

exports.checkValidation = function(req) {
    const validation = validationResult(req);
    console.log(validation.errors);
    return validation.isEmpty();
};

exports.validateETHAddresses = function(address) {
    return (/^(0x){1}[0-9a-fA-F]{40}$/i.test(address));
}

exports.generateAESKey = () => crypto.randomBytes(32).toString('hex');

exports.checkToken = async function(token) {
    return new Promise((resolve, reject) => {
        jwt.verify(token, process.env.AUTH_SECRET, async (err, authData) => {
            if (err) {
                resolve({
                    status: false,
                    data: null,
                    message: 'Format token tidak valid.'
                });
            } else {
                if (!authData.address) {
                    resolve({
                        status: false,
                        data: null,
                        message: 'Format token tidak valid.'
                    });
                } else {

                    const loginToken = await LoginTokenModel.findOne({
                        where: {
                            address: authData.address,
                            token
                        },
                        raw: true
                    });

                    if(!loginToken){
                        resolve({
                            status: false,
                            data: null,
                            message: 'Token tidak tersedia.'
                        });
                    }else{
                        resolve({
                            status: true,
                            data: authData
                        });
                    }
                }
            }
        });
    });
};

exports.hashPassword = function(plaintextPassword) {
    return new Promise((resolve) => {
        let result;
        bcrypt.hash(plaintextPassword, 10, function(err, hash) {
            if (err) {
                result = null;
            } else {
                result = hash;
            }
            resolve(result);
        });
    });
};

exports.comparePassword = function(plaintextPassword, hash) {
    return new Promise((resolve) => {
        let result_status;
        bcrypt.compare(plaintextPassword, hash, function(err, result) {
            if (err) {
                result_status = false;
            } else {
                result_status = result;
            }

            resolve(result_status);
        });
    });
};

exports.responseData = function(res, code, status, message, data = null) {
    if (data != null) {
        return res.status(code)
            .json({
                status: status,
                message: message,
                data: data
            });
    } else {
        return res.status(code)
            .json({
                status: status,
                message: message
            });
    }
};

exports.success = function (res, message = 'Success', data = null) {
    return toolsUtil.responseData(res, 200, 'success', message, data);
};

exports.safeParseJSON = function(str) {
    try {
        return JSON.parse(str);
    } catch (e) {
        return {};
    }
}

exports.filterObjectByKeys = function(data, keys) {
    return keys.reduce((acc, key) => {
        if (data.hasOwnProperty(key)) {
            acc[key] = data[key];
        }
        return acc;
    }, {});
}