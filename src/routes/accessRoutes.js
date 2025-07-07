const express = require('express');
const accessController = require('../controllers/accessController');
const authMiddleware = require('../middleware/authMiddleware');
const { body } = require('express-validator');

const router = express.Router();
router.use(authMiddleware.validateUser);

router.put(
    '/permissions/patient-grant-doctor',
    [
        body('addressDoctor').notEmpty(),
        body('canCreate').notEmpty(),
        body('canRead').notEmpty(),
        body('canUpdate').notEmpty(),
        body('canDelete').notEmpty(),
    ],
    accessController.putPermissionPatientGrantDoctor
);

router.put(
    '/permissions/patient-revoke-doctor',
    [
        body('addressDoctor').notEmpty(),
    ],
    accessController.putPermissionPatientRevokeDoctor
);

router.put(
    '/request-access/doctor',
    [
        body('addressPatient').notEmpty(),
        body('canCreate').notEmpty(),
        body('canRead').notEmpty(),
        body('canUpdate').notEmpty(),
        body('canDelete').notEmpty(),
    ],
    accessController.putRequestAccessDoctor
);

router.put(
    '/request-access/approving',
    [
        body('addressDoctor').notEmpty(),
        body('isApproved').notEmpty(),
    ],
    accessController.putRequestAccessApproving
);

module.exports = router;