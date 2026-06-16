const express = require('express');
const router = express.Router();
const { Ticket, User } = require('../models');
const { verifierToken, autoriserRoles } = require('../middlewares/auth');
const { genererReference } = require('../utils/reference');
// GET /tickets — Lister tous les tickets groupes par statut
router.get('/', verifierToken, async (req, res) => {
  try {
    const tickets = await Ticket.findAll({
      include: [
        { model: User, as: 'assigne', attributes: ['id','nom','email'] },
        { model: User, as: 'createur', attributes: ['id','nom','email'] },
      ],
      order: [['ouvert_le', 'DESC']],
    });
    // Grouper par statut pour le Kanban
    const groupes = {
      a_faire:  tickets.filter(t => t.statut === 'a_faire'),
      en_cours: tickets.filter(t => t.statut === 'en_cours'),
      bloque:   tickets.filter(t => t.statut === 'bloque'),
      resolu:   tickets.filter(t => t.statut === 'resolu'),
    };
    res.json({ status: 'success', data: groupes });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});
// POST /tickets — Creer un ticket (admin ou responsable seulement)
router.post('/', verifierToken,
  autoriserRoles('admin', 'responsable'),
  async (req, res) => {
    try {
      const { titre, description, priorite, client_nom, assigne_id } = req.body;
      // Valider les champs obligatoires
      if (!titre || !priorite) {
        return res.status(400).json({
          status: 'error',
          message: 'titre et priorite sont obligatoires'
        });
      }
      // Generer la reference unique (RG-01)
      const reference = await genererReference();
    const ticket = await Ticket.create({
        titre,
        description,
        priorite,
        client_nom,
        assigne_id: assigne_id || null,
        cree_par: req.user.id,  // ID de l'utilisateur connecte
        reference,
        // ouvert_le est auto (defaultValue: NOW)
      });
      res.status(201).json({
        status: 'success',
        message: 'Ticket cree avec succes',
        data: ticket
      });
    } catch (error) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  }
);
// GET /tickets/:id — Detail d'un ticket
router.get('/:id', verifierToken, async (req, res) => {
  try {
    const ticket = await Ticket.findByPk(req.params.id, {
      include: [
        { model: User, as: 'assigne',  attributes: ['id','nom','email'] },
        { model: User, as: 'createur', attributes: ['id','nom','email'] },
      ],
    });
    if (!ticket) {
      return res.status(404).json({
        status: 'error', message: 'Ticket non trouve'
      });
    }
    res.json({ status: 'success', data: ticket });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});
module.exports = router;