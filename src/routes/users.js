const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { User } = require('../models');
const { verifierToken, autoriserRoles } = require('../middlewares/auth');

// GET /users — Lister utilisateurs (admin) ou filtrer par role (admin + responsable)
router.get('/', verifierToken, autoriserRoles('admin', 'responsable'), async (req, res) => {
  try {
    const { role } = req.query;
    const whereClause = role ? { role } : {};

    const users = await User.findAll({
      where: whereClause,
      attributes: ['id', 'nom', 'email', 'role', 'actif'],
    });
    res.json({ status: 'success', data: users });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// POST /users — Creer un utilisateur (admin seulement)
router.post('/', verifierToken, autoriserRoles('admin'), async (req, res) => {
  try {
    const { nom, email, mot_de_passe, role } = req.body;

    if (!nom || !email || !mot_de_passe || !role) {
      return res.status(400).json({
        status: 'error',
        message: 'nom, email, mot_de_passe et role sont obligatoires'
      });
    }

    if (!['admin', 'responsable', 'technicien'].includes(role)) {
      return res.status(400).json({ status: 'error', message: 'Role invalide' });
    }

    const hash = await bcrypt.hash(mot_de_passe, 10);
    const user = await User.create({ nom, email, mot_de_passe: hash, role });

    res.status(201).json({
      status: 'success',
      message: 'Utilisateur cree avec succes',
      data: { id: user.id, nom: user.nom, email: user.email, role: user.role, actif: user.actif }
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// PATCH /users/:id/role — Changer le role d'un utilisateur (admin seulement)
router.patch('/:id/role', verifierToken, autoriserRoles('admin'), async (req, res) => {
  try {
    const { role } = req.body;

    if (!['admin', 'responsable', 'technicien'].includes(role)) {
      return res.status(400).json({ status: 'error', message: 'Role invalide' });
    }

    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ status: 'error', message: 'Utilisateur non trouve' });
    }

    user.role = role;
    await user.save();

    res.json({
      status: 'success',
      message: `Role mis a jour : ${role}`,
      data: { id: user.id, nom: user.nom, email: user.email, role: user.role, actif: user.actif }
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// PATCH /users/:id/actif — Activer ou desactiver un utilisateur (admin seulement)
router.patch('/:id/actif', verifierToken, autoriserRoles('admin'), async (req, res) => {
  try {
    const { actif } = req.body;

    if (typeof actif !== 'boolean') {
      return res.status(400).json({ status: 'error', message: 'Le champ actif doit etre true ou false' });
    }

    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ status: 'error', message: 'Utilisateur non trouve' });
    }

    user.actif = actif;
    await user.save();

    res.json({
      status: 'success',
      message: actif ? 'Utilisateur reactive' : 'Utilisateur desactive',
      data: { id: user.id, nom: user.nom, email: user.email, role: user.role, actif: user.actif }
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

module.exports = router;