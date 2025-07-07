const express = require('express');
const authController = require('../controllers/authController');
// const authMiddleware = require('../middleware/authMiddleware');
const { body } = require('express-validator');

const router = express.Router();

router.post(
    '/register',
    [
        [
            body('address').notEmpty(),
            body('name').notEmpty(),
            body('birthDate').notEmpty(),
            body('homeAddress').notEmpty(),
            body('password').notEmpty(),
            body('role').notEmpty(),
        ],
    ],
    authController.postRegister
);

router.post(
    '/login',
    [
        [
            body('address').notEmpty(),
            body('password').notEmpty(),
        ],
    ],
    authController.postLogin
);

module.exports = router;