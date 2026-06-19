const express = require('express');
const router = express.Router();
const { Ticket, User, HistoriqueStatut } = require('../models');
const { verifierToken, autoriserRoles } = require('../middlewares/auth');
const { genererReference } = require('../utils/reference');
const {
  transitionAutorisee,
  messageErreurTransition
} = require('../services/ticketService');

// GET /tickets — Lister tous les tickets groupes par statut
router.get('/', verifierToken, async (req, res) => {
  try {
    const tickets = await Ticket.findAll({
      include: [
        { model: User, as: 'assigne', attributes: ['id', 'nom', 'email'] },
        { model: User, as: 'createur', attributes: ['id', 'nom', 'email'] },
      ],
      order: [['ouvert_le', 'DESC']],
    });
    const groupes = {
      a_faire: tickets.filter(t => t.statut === 'a_faire'),
      en_cours: tickets.filter(t => t.statut === 'en_cours'),
      bloque: tickets.filter(t => t.statut === 'bloque'),
      resolu: tickets.filter(t => t.statut === 'resolu'),
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
      const {
        titre,
        description,
        priorite,
        client_nom,
        client_email,
        client_telephone,
        assigne_id
      } = req.body;

      // Validation des champs obligatoires (titre, priorite, client_nom,
      // client_email et client_telephone sont tous requis)
      if (!titre || !priorite || !client_nom || !client_email || !client_telephone) {
        return res.status(400).json({
          status: 'error',
          message: 'titre, priorite, client_nom, client_email et client_telephone sont obligatoires',
        });
      }

      const reference = await genererReference();
      const ticket = await Ticket.create({
        titre,
        description,
        priorite,
        client_nom,
        client_email,
        client_telephone,
        assigne_id: assigne_id || null,
        cree_par: req.user.id, // ID de l'utilisateur connecte
        reference,
      });
      res.status(201).json({
        status: 'success',
        message: 'Ticket cree avec succes',
        data: ticket,
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
        { model: User, as: 'assigne', attributes: ['id', 'nom', 'email'] },
        { model: User, as: 'createur', attributes: ['id', 'nom', 'email'] },
      ],
    });
    if (!ticket) {
      return res.status(404).json({
        status: 'error', message: 'Ticket non trouve',
      });
    }
    res.json({ status: 'success', data: ticket });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// PATCH /tickets/:id/statut — Changer le statut (RG-02, RG-03, RG-04, RG-09)
router.patch('/:id/statut', verifierToken, async (req, res) => {
  try {
    const { nouveau_statut } = req.body;
    const ticket = await Ticket.findByPk(req.params.id);
    if (!ticket) {
      return res.status(404).json({
        status: 'error', message: 'Ticket non trouve',
      });
    }

    // Verifier que la transition est autorisee (RG-02)
    if (!transitionAutorisee(ticket.statut, nouveau_statut)) {
      return res.status(400).json({
        status: 'error',
        message: messageErreurTransition(ticket.statut, nouveau_statut),
      });
    }

    // Sauvegarder l'ancien statut AVANT toute modification (necessaire pour l'historique)
    const statutAvant = ticket.statut;

    // Si passage a 'resolu' : horodater resolu_le et calculer duree (RG-03, RG-04)
    if (nouveau_statut === 'resolu') {
      ticket.resolu_le = new Date();
      const diffMs = ticket.resolu_le - ticket.ouvert_le;
      ticket.duree_resolution_min = Math.round(diffMs / 60000);
    }

    // Si reouverture depuis 'resolu' : reinitialiser resolu_le (RG-09)
    if (ticket.statut === 'resolu' && nouveau_statut === 'en_cours') {
      ticket.resolu_le = null;
      ticket.duree_resolution_min = null;
    }

    ticket.statut = nouveau_statut;
    await ticket.save();

    // Enregistrer la transition dans l'historique
    await HistoriqueStatut.create({
      ticket_id: ticket.id,
      ancien_statut: statutAvant,
      nouveau_statut: nouveau_statut,
      modifie_par: req.user.id,
      modifie_le: new Date(),
    });

    res.json({
      status: 'success',
      message: `Statut mis a jour : ${nouveau_statut}`,
      data: ticket,
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// GET /tickets/:id/historique — Historique des changements de statut
router.get('/:id/historique', verifierToken, async (req, res) => {
  try {
    const historique = await HistoriqueStatut.findAll({
      where: { ticket_id: req.params.id },
      include: [{
        model: User,
        as: 'modificateur',
        attributes: ['id', 'nom', 'role'],
      }],
      order: [['modifie_le', 'ASC']], // Du plus ancien au plus recent
    });
    res.json({ status: 'success', data: historique });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// PATCH /tickets/:id/assignation
router.patch('/:id/assignation', verifierToken,
  autoriserRoles('admin', 'responsable'),
  async (req, res) => {
    try {
      const { assigne_id } = req.body;
      const ticket = await Ticket.findByPk(req.params.id);
      if (!ticket) {
        return res.status(404).json({
          status: 'error', message: 'Ticket non trouve',
        });
      }

      // Verifier que le technicien existe
      const technicien = await User.findByPk(assigne_id);
      if (!technicien || technicien.role !== 'technicien') {
        return res.status(400).json({
          status: 'error', message: 'Technicien invalide',
        });
      }

      ticket.assigne_id = assigne_id;
      await ticket.save();
      res.json({ status: 'success', message: 'Ticket assigne', data: ticket });
    } catch (error) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  }
);

module.exports = router;