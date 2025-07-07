const express = require('express');
const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const healthRecordRoutes = require('./healthRecordRoutes');
const accessRoutes = require('./accessRoutes');
const openRoutes = require('./openRoutes');

const router = express.Router();

// Routers List
router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/health-records", healthRecordRoutes);
router.use("/access", accessRoutes);
router.use("/open", openRoutes);

module.exports = router;

