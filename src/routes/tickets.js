const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { Ticket, User, HistoriqueStatut, Commentaire } = require('../models');
const { verifierToken, autoriserRoles } = require('../middlewares/auth');
const { genererReference } = require('../utils/reference');
const {
  transitionAutorisee,
  messageErreurTransition
} = require('../services/ticketService');

// GET /tickets — Lister tickets (filtre selon le role - RG-08)
router.get('/', verifierToken, async (req, res) => {
  try {
    const { agent, client, priorite, statut, date_debut, date_fin } = req.query;
    let whereClause = {};

    // RG-08 : technicien voit uniquement ses tickets
    if (req.user.role === 'technicien') {
      const commentaires = await Commentaire.findAll({
        where: { auteur_id: req.user.id },
        attributes: ['ticket_id'],
      });
      const ticketsCommentes = commentaires.map(c => c.ticket_id);
      whereClause = {
        [Op.or]: [
          { assigne_id: req.user.id },
          { id: ticketsCommentes },
        ]
      };
    }

    // Filtre par agent (technicien assigne)
    if (agent) {
      whereClause.assigne_id = agent;
    }

    // Filtre par client (recherche partielle insensible a la casse)
    if (client) {
      whereClause.client_nom = { [Op.iLike]: `%${client}%` };
    }

    // Filtre par priorite
    if (priorite) {
      whereClause.priorite = priorite;
    }

    // Filtre par statut
    if (statut) {
      whereClause.statut = statut;
    }

    // Filtre par plage de dates
    if (date_debut || date_fin) {
      whereClause.ouvert_le = {};
      if (date_debut) whereClause.ouvert_le[Op.gte] = new Date(date_debut);
      if (date_fin) whereClause.ouvert_le[Op.lte] = new Date(date_fin);
    }

    const tickets = await Ticket.findAll({
      where: whereClause,
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
        cree_par: req.user.id,
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

// GET /tickets/:id — Detail d'un ticket (RG-08)
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

    // RG-08 : verifier l'acces si technicien
    if (req.user.role === 'technicien') {
      const estAssigne = ticket.assigne_id === req.user.id;
      const aCommente = await Commentaire.findOne({
        where: { ticket_id: ticket.id, auteur_id: req.user.id }
      });
      if (!estAssigne && !aCommente) {
        return res.status(403).json({
          status: 'error',
          message: 'Acces refuse : ce ticket ne vous concerne pas',
        });
      }
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

    if (!transitionAutorisee(ticket.statut, nouveau_statut)) {
      return res.status(400).json({
        status: 'error',
        message: messageErreurTransition(ticket.statut, nouveau_statut),
      });
    }

    const statutAvant = ticket.statut;

    if (nouveau_statut === 'resolu') {
      ticket.resolu_le = new Date();
      const diffMs = ticket.resolu_le - ticket.ouvert_le;
      ticket.duree_resolution_min = Math.round(diffMs / 60000);
    }

    if (ticket.statut === 'resolu' && nouveau_statut === 'en_cours') {
      ticket.resolu_le = null;
      ticket.duree_resolution_min = null;
    }

    ticket.statut = nouveau_statut;
    await ticket.save();

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

// GET /tickets/:id/historique
router.get('/:id/historique', verifierToken, async (req, res) => {
  try {
    const historique = await HistoriqueStatut.findAll({
      where: { ticket_id: req.params.id },
      include: [{
        model: User,
        as: 'modificateur',
        attributes: ['id', 'nom', 'role'],
      }],
      order: [['modifie_le', 'ASC']],
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

// POST /tickets/:id/commentaires
router.post('/:id/commentaires', verifierToken, async (req, res) => {
  try {
    const { contenu } = req.body;
    const ticket = await Ticket.findByPk(req.params.id);

    if (!ticket) {
      return res.status(404).json({
        status: 'error', message: 'Ticket non trouve'
      });
    }

    if (!contenu || contenu.trim() === '') {
      return res.status(400).json({
        status: 'error', message: 'Le contenu ne peut pas etre vide'
      });
    }

    const commentaire = await Commentaire.create({
      ticket_id: ticket.id,
      auteur_id: req.user.id,
      contenu: contenu.trim(),
    });

    const commentaireComplet = await Commentaire.findByPk(commentaire.id, {
      include: [{ model: User, as: 'auteur', attributes: ['id', 'nom', 'role'] }]
    });

    res.status(201).json({
      status: 'success',
      message: 'Commentaire ajoute',
      data: commentaireComplet
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// GET /tickets/:id/commentaires
router.get('/:id/commentaires', verifierToken, async (req, res) => {
  try {
    const commentaires = await Commentaire.findAll({
      where: { ticket_id: req.params.id },
      include: [{
        model: User, as: 'auteur', attributes: ['id', 'nom', 'role']
      }],
      order: [['cree_le', 'ASC']],
    });
    res.json({ status: 'success', data: commentaires });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

module.exports = router;