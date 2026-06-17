require('dotenv').config();
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken'); 
const { User } = require('../models');
const { verifierToken, autoriserRoles } = require('../middlewares/auth');
// POST /auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, mot_de_passe } = req.body;
    // 1. Vérifier que l'utilisateur existe
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: 'Email ou mot de passe incorrect'
      });
    }
    // 2. Vérifier le mot de passe
    const valide = await bcrypt.compare(mot_de_passe, user.mot_de_passe);
    if (!valide) {
      return res.status(401).json({
        status: 'error',
        message: 'Email ou mot de passe incorrect'
      });
    }
    // 2bis. Vérifier que le compte est actif
if (!user.actif) {
  return res.status(403).json({
    status: 'error',
    message: 'Compte desactive, contactez votre administrateur'
  });
}

    console.log('SECRET dans auth.js:', JSON.stringify(process.env.JWT_SECRET));
    console.log("JWT_SECRET =", process.env.JWT_SECRET);
    // 3. Générer le token JWT
    const token = jwt.sign(
      { id: user.id, role: user.role, nom: user.nom },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );
    // 4. Retourner le token
    res.json({
      status: 'success',
      message: 'Connexion reussie',
      data: { token, role: user.role, nom: user.nom }
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});
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