const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { Op } = require('sequelize');
const { User, Ticket, HistoriqueStatut } = require('../models');
const { verifierToken, autoriserRoles } = require('../middlewares/auth');
const upload = require('../config/multer');

// GET /users — Lister utilisateurs (admin) ou filtrer par role (admin + responsable)
router.get('/', verifierToken, autoriserRoles('admin', 'responsable'), async (req, res) => {
  try {
    const { role } = req.query;
    const whereClause = role ? { role } : {};

    const users = await User.findAll({
  where: whereClause,
  attributes: ['id', 'nom', 'email', 'role', 'actif', 'photo_url'],
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

    // Desactivation d'un technicien : ses tickets en cours (tout sauf les
    // resolus) lui sont retires, repartent a "a faire" et repartent avec
    // un delai SLA remis a zero, pour qu'ils soient rapidement reassignes.
    if (!actif) {
      const ticketsARelibere = await Ticket.findAll({
        where: {
          assigne_id: user.id,
          statut: { [Op.ne]: 'resolu' },
          supprime: { [Op.not]: true },
        },
      });

      for (const ticket of ticketsARelibere) {
        const statutAvant = ticket.statut;
        ticket.assigne_id = null;
        ticket.statut     = 'a_faire';
        ticket.ouvert_le  = new Date();
        ticket.resolu_le  = null;
        ticket.duree_resolution_min = null;
        await ticket.save();

        if (statutAvant !== 'a_faire') {
          await HistoriqueStatut.create({
            ticket_id:      ticket.id,
            ancien_statut:  statutAvant,
            nouveau_statut: 'a_faire',
            modifie_par:    req.user.id,
            modifie_le:     new Date(),
          });
        }
      }
    }

    res.json({
      status: 'success',
      message: actif ? 'Utilisateur reactive' : 'Utilisateur desactive',
      data: { id: user.id, nom: user.nom, email: user.email, role: user.role, actif: user.actif }
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// POST /users/photo — Upload de sa propre photo de profil
router.post('/photo', verifierToken, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ status: 'error', message: 'Aucun fichier reçu' });
    }

    const user = await User.findByPk(req.user.id);
    user.photo_url = `/uploads/${req.file.filename}`;
    await user.save();

    res.json({
      status: 'success',
      message: 'Photo de profil mise à jour',
      data: { photo_url: user.photo_url },
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// DELETE /users/photo — Supprimer sa propre photo de profil
router.delete('/photo', verifierToken, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    user.photo_url = null;
    await user.save();

    res.json({ status: 'success', message: 'Photo de profil supprimée' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

module.exports = router;