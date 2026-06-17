const express = require('express');
const router = express.Router();
const { User } = require('../models');
const { verifierToken, autoriserRoles } = require('../middlewares/auth');

// GET /users — Lister tous les utilisateurs (admin seulement)
router.get('/', verifierToken, autoriserRoles('admin'), async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: ['id', 'nom', 'email', 'role'],
    });
    res.json({ status: 'success', data: users });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

module.exports = router;