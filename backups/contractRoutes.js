const express = require('express');
const contractController = require('../controllers/contractController');
const { body } = require('express-validator');
const authMiddleware = require('../middleware/authMiddleware')

const router = express.Router();

router.use(authMiddleware.validateUser);

router.post(
    '/',
    contractController.postUser
);

module.exports = router;
