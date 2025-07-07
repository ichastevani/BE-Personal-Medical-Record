const express = require('express');
const healthRecordController = require('../controllers/healthRecordController');
const authMiddleware = require('../middleware/authMiddleware');
const fileMiddleware = require('../middleware/fileMiddleware');
const { body } = require('express-validator');

const router = express.Router();
router.use(authMiddleware.validateUser);

router.post(
    '/',
    [
        fileMiddleware.uploadFileIPFS,
        body('patientAddress').notEmpty(),
        body('description').notEmpty(),
        body('recordType').notEmpty(),
    ],
    healthRecordController.postHealthRecord
);

router.post(
    '/:recordId/verification',
    healthRecordController.postHealthRecordVerification
);

router.get(
    '/:address',
    healthRecordController.getHealthRecordByAddress
);

router.get(
    '/:addressPatient/ipfs/:cid',
    healthRecordController.getDownloadFileByCID
);

router.get(
    '/:address/:recordId',
    healthRecordController.getHealthRecord
);

router.put(
    '/:address/:recordId',
    [
        fileMiddleware.uploadFileIPFS,
        body('description').notEmpty(),
        body('recordType').notEmpty(),
    ],
    healthRecordController.putHealthRecord
);

router.put(
    '/:address/:recordId/no-file',
    [
        body('description').notEmpty(),
        body('recordType').notEmpty(),
    ],
    healthRecordController.putHealthRecordNoFile
);

router.delete(
    '/:address/:recordId',
    healthRecordController.deleteHealthRecord
);

router.put(
    '/:address/:recordId/revert',
    healthRecordController.putRevertHealthRecord
);

module.exports = router;
