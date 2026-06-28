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
    const { agent, agents, client, priorite, statut, date_debut, date_fin } = req.query;

    let agentsFiltre = [];

if (req.query['agents[]']) {
  agentsFiltre = Array.isArray(req.query['agents[]'])
    ? req.query['agents[]']
    : [req.query['agents[]']];
}
else if (req.query.agents) {
  agentsFiltre = Array.isArray(req.query.agents)
    ? req.query.agents
    : [req.query.agents];
}
else if (req.query.agent) {
  agentsFiltre = Array.isArray(req.query.agent)
    ? req.query.agent
    : [req.query.agent];
}

agentsFiltre = agentsFiltre.filter(Boolean);

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

  if (agentsFiltre.length > 0) {
  whereClause.assigne_id = {
    [Op.in]: agentsFiltre
  };
}
    if (client) {
      whereClause.client_nom = { [Op.iLike]: `%${client}%` };
    }

    if (priorite) {
      whereClause.priorite = priorite;
    }

    if (statut) {
      whereClause.statut = statut;
    }

    if (date_debut || date_fin) {
      whereClause.ouvert_le = {};
      if (date_debut) {
        whereClause.ouvert_le[Op.gte] = new Date(date_debut + 'T00:00:00');
      }
      if (date_fin) {
        whereClause.ouvert_le[Op.lte] = new Date(date_fin + 'T23:59:59');
      }
    }

    console.log('======================');
console.log('QUERY =', req.query);
console.log('AGENTS FILTRE =', agentsFiltre);
console.log('WHERE CLAUSE =', whereClause);

const tickets = await Ticket.findAll({
  where: whereClause,
  include: [
    { model: User, as: 'assigne', attributes: ['id', 'nom', 'email'] },
    { model: User, as: 'createur', attributes: ['id', 'nom', 'email'] },
  ],
  order: [['ouvert_le', 'DESC']],
});

console.log(
  'TICKETS TROUVES =',
  tickets.map(t => ({
    id: t.id,
    titre: t.titre,
    assigne_id: t.assigne_id
  }))
);

console.log('======================');

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
     const {
    titre,
    description,
    priorite,
    client_nom,
    client_email,
    client_telephone,
    assigne_id,
    date_limite_resolution
   } = req.body;

      if (!titre || !priorite || !client_nom || !client_telephone) {
        return res.status(400).json({
          status: 'error',
          message: 'titre, priorite, client_nom et client_telephone sont obligatoires',
        });
      }
      if (date_limite_resolution && !assigne_id) {
  return res.status(400).json({
    status: 'error',
    message:
      'Vous devez assigner un technicien avant de définir une date limite de résolution.',
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
  date_limite_resolution: date_limite_resolution || null,
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
        { model: User, as: 'assigne',  attributes: ['id', 'nom', 'email'] },
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
      const aCommente  = await Commentaire.findOne({
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
        status: 'error',
        message: 'Ticket non trouve',
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

    // ✅ SOCKET PROPRE
    const io = req.app.get('io');

    if (io) {
      console.log("🔥 IO =", io);
      const labelsStatut = {
        a_faire: 'À faire', en_cours: 'En cours', bloque: 'Bloqué', resolu: 'Résolu'
      };
      const messageCreateur = `Le ticket ${ticket.reference} "${ticket.titre}" est passé de "${labelsStatut[statutAvant] || statutAvant}" à "${labelsStatut[nouveau_statut] || nouveau_statut}" par ${req.user.nom}`;
      const messageAssigne  = `Statut du ticket ${ticket.reference} que vous gérez : "${labelsStatut[statutAvant] || statutAvant}" → "${labelsStatut[nouveau_statut] || nouveau_statut}"`;

      const notification = {
        type: 'statut_change',
        ticket_id: ticket.id,
        reference: ticket.reference,
        titre: ticket.titre,
        ancien_statut: statutAvant,
        nouveau_statut: nouveau_statut,
        modifie_par: req.user.nom,
        message: messageCreateur,
        date: new Date().toISOString(),
      };

      console.log("📢 Envoi notif statut à :", ticket.cree_par, ticket.assigne_id);

      if (ticket.cree_par) {
        io.to(`user_${ticket.cree_par}`).emit('notification', notification);
      }

      if (ticket.assigne_id && ticket.assigne_id !== ticket.cree_par) {
        io.to(`user_${ticket.assigne_id}`).emit('notification', notification);
      }

      // 🔥 TEMPS RÉEL
      io.emit('ticket_mis_a_jour', {
        ticket_id: ticket.id,
        statut: nouveau_statut,
      });
    }

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
        as:    'modificateur',
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
  console.log('AUTEUR DU COMMENTAIRE =', req.user);
  try {
    const { contenu } = req.body;
    const ticket = await Ticket.findByPk(req.params.id);

    if (!ticket) {
      return res.status(404).json({
        status: 'error',
        message: 'Ticket non trouve'
      });
    }

    if (!contenu || contenu.trim() === '') {
      return res.status(400).json({
        status: 'error',
        message: 'Le contenu ne peut pas etre vide'
      });
    }

    const { reponse_a_id } = req.body;

    console.log('========================');
console.log('UTILISATEUR CONNECTÉ');
console.log(req.user.id);
console.log(req.user.nom);
console.log(req.user.role);
console.log('========================');

    const commentaire = await Commentaire.create({
      ticket_id: ticket.id,
      auteur_id: req.user.id,
      contenu: contenu.trim(),
      reponse_a_id: reponse_a_id || null,
    });

    const commentaireComplet = await Commentaire.findByPk(commentaire.id, {
      include: [
        { model: User, as: 'auteur', attributes: ['id', 'nom', 'role'] },
        {
          model: Commentaire,
          as: 'reponse_a',
          attributes: ['id', 'contenu'],
          include: [{ model: User, as: 'auteur', attributes: ['id', 'nom'] }]
        }
      ]
    });

    const io = req.app.get('io');

    if (io) {
      const extrait = commentaire.contenu.length > 60
        ? commentaire.contenu.slice(0, 60) + '...'
        : commentaire.contenu;

      const notification = {
        type: 'nouveau_commentaire',
        ticket_id: ticket.id,
        reference: ticket.reference,
        titre: ticket.titre,
        contenu: commentaire.contenu,
        auteur: req.user.nom,
        message: `${req.user.nom} a commenté sur ${ticket.reference} : "${extrait}"`,
        date: new Date().toISOString(),
      };

      // 🔔 notif
      if (ticket.cree_par) {
        io.to(`user_${ticket.cree_par}`).emit('notification', notification);
      }

      if (ticket.assigne_id && ticket.assigne_id !== ticket.cree_par) {
        io.to(`user_${ticket.assigne_id}`).emit('notification', notification);
      }

      // ⚡ temps réel (affichage direct)
      if (ticket.cree_par) {
        io.to(`user_${ticket.cree_par}`).emit('commentaire_ajoute', {
          ticket_id: ticket.id,
          commentaire: commentaireComplet
        });
      }

      if (ticket.assigne_id && ticket.assigne_id !== ticket.cree_par) {
        io.to(`user_${ticket.assigne_id}`).emit('commentaire_ajoute', {
          ticket_id: ticket.id,
          commentaire: commentaireComplet
        });
      }
    }

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
      include: [
        { model: User, as: 'auteur', attributes: ['id', 'nom', 'role'] },
        {
          model: Commentaire,
          as: 'reponse_a',
          attributes: ['id', 'contenu'],
          include: [{ model: User, as: 'auteur', attributes: ['id', 'nom'] }]
        }
      ],
      order: [['cree_le', 'ASC']],
    });
    res.json({ status: 'success', data: commentaires });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// DELETE /tickets/:id/commentaires/:commentaireId
router.delete('/:id/commentaires/:commentaireId', verifierToken, async (req, res) => {
  try {
    const commentaire = await Commentaire.findByPk(req.params.commentaireId, {
      include: [{ model: User, as: 'auteur', attributes: ['id', 'nom', 'role'] }]
    });

    if (!commentaire) {
      return res.status(404).json({ status: 'error', message: 'Commentaire non trouvé' });
    }
// APRÈS — forcer string pour éviter les problèmes de type
   if (String(commentaire.auteur_id) !== String(req.user.id) && req.user.role !== 'admin') {
      return res.status(403).json({ status: 'error', message: 'Non autorisé à supprimer ce commentaire' });
    }
    const contenuSupprime = commentaire.contenu;
    await commentaire.destroy();

    res.json({ status: 'success', message: 'Commentaire supprimé' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// POST /tickets/:id/pieces
const upload      = require('../config/multer');
const { PieceJointe } = require('../models');

router.post('/:id/pieces', verifierToken,
  upload.single('fichier'),
  async (req, res) => {
    try {
      const ticket = await Ticket.findByPk(req.params.id);
      if (!ticket) {
        return res.status(404).json({
          status: 'error', message: 'Ticket non trouve'
        });
      }
      if (!req.file) {
        return res.status(400).json({
          status: 'error', message: 'Aucun fichier recu'
        });
      }
      const piece = await PieceJointe.create({
        ticket_id:   ticket.id,
        url:         `/uploads/${req.file.filename}`,
        nom_fichier: req.file.originalname,
        taille_ko:   Math.round(req.file.size / 1024),
      });

const io = req.app.get('io');

if (io) {
  const notification = {
    type: 'nouvelle_piece_jointe',
    ticket_id: ticket.id,
    reference: ticket.reference,
    titre: ticket.titre,
    nom_fichier: piece.nom_fichier,
    auteur: req.user.nom,
    message: `${req.user.nom} a joint le fichier "${piece.nom_fichier}" sur le ticket ${ticket.reference}`,
    date: new Date().toISOString(),
  };

  const envoyer = (userId) => {
    io.to(`user_${userId}`).emit('notification', notification);
    io.to(`user_${userId}`).emit('piece_jointe_ajoutee', {
      ticket_id: ticket.id,
      piece: piece
    });
  };

  if (ticket.cree_par) envoyer(ticket.cree_par);
  if (ticket.assigne_id && ticket.assigne_id !== ticket.cree_par) {
    envoyer(ticket.assigne_id);
  }
}
      res.status(201).json({
        status: 'success',
        message: 'Fichier ajoute',
        data: piece
      });
    } catch (error) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  }
);

// Gestion des erreurs Multer
router.use((error, req, res, next) => {
  if (error.message === 'Format de fichier non autorise') {
    return res.status(400).json({
      status: 'error',
      message: 'Format non autorise (PDF, DOCX, PNG, JPG uniquement)'
    });
  }
  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      status: 'error',
      message: 'Fichier trop volumineux (max 10 Mo)'
    });
  }
  next(error);
});

// GET /tickets/:id/pieces
router.get('/:id/pieces', verifierToken, async (req, res) => {
  try {
    const pieces = await PieceJointe.findAll({
      where: { ticket_id: req.params.id },
    });
    res.json({ status: 'success', data: pieces });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// GET /tickets/:id/sla — Indicateur SLA d'un ticket (RG-04) <- C
router.get('/:id/sla', verifierToken, async (req, res) => {
  try {
    const ticket = await Ticket.findByPk(req.params.id);
    if (!ticket) {
      return res.status(404).json({
        status: 'error', message: 'Ticket non trouve'
      });
    }

    const maintenant = new Date();
    const ouverture  = new Date(ticket.ouvert_le);
    const fermeture  = ticket.resolu_le ? new Date(ticket.resolu_le) : maintenant;
    const dureeMin   = Math.round((fermeture - ouverture) / 60000);

    // Seuils SLA selon la priorite (en minutes)
    const SEUILS = {
      critique: 60,   // 1 heure
      moyenne:  240,  // 4 heures
      basse:    1440, // 24 heures
    };

    const seuil   = SEUILS[ticket.priorite] || 240;
    const depasse = dureeMin > seuil;
    const estResolu = ticket.statut === 'resolu';

    res.json({
      status: 'success',
      data: {
        duree_actuelle_min:    dureeMin,
        duree_resolution_min:  ticket.duree_resolution_min,
        seuil_min:             seuil,
        depasse,
        est_resolu:            estResolu,
        pourcentage:           Math.min(Math.round((dureeMin / seuil) * 100), 100),
      }
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

module.exports = router;