const express = require('express');
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();
router.use(authMiddleware.validateUser);

router.get(
    '/me',
    userController.getMe
);

router.get(
    '/address/:addressPatient',
    userController.getUserByAddress
);

router.get(
    '/doctor-permission/:addressDoctor/:addressPatient',
    userController.getDoctorPermissions
);

router.get(
    '/patient-doctors',
    userController.getPatientDoctors
);

router.get(
    '/doctor-patients',
    userController.getDoctorPatients
);

module.exports = router;
