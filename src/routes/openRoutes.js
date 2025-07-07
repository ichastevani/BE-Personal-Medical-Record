const express = require('express');
const userController = require('../controllers/userController');
const accessController = require('../controllers/accessController');

const router = express.Router();

router.get(
    '/users/:address/check',
    userController.getExistUser
);

router.get(
    '/best-node',
    accessController.getBestPrivasteNode
);

module.exports = router;