const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { Ticket, User, HistoriqueStatut, Commentaire } = require('../models');
const { verifierToken, autoriserRoles } = require('../middlewares/auth');
const { genererReference } = require('../utils/reference');
const { notifier, destinatairesTicket } = require('../utils/notifications');
const { calculerSla, SEUILS_SLA } = require('../utils/sla');
const {
  transitionAutorisee,
  messageErreurTransition
} = require('../services/ticketService');
const fs = require('fs');
const path = require('path');

// Notifie le technicien qu'un ticket lui a ete assigne (a la creation ou via
// une reassignation), puis le createur/responsable-assigneur et les admins
// pour leur visibilite globale (RG : les admins voient toute l'activite des
// tickets, meme sans lien direct avec le ticket). L'acteur de l'action n'est
// jamais notifie de sa propre action.
async function notifierAssignation(io, ticket, technicien, acteur) {
  if (String(technicien.id) !== String(acteur.id)) {
    await notifier(io, {
      userId:   technicien.id,
      ticketId: ticket.id,
      type:     'assignation',
      titre:    `Ticket ${ticket.reference} assigné`,
      message:  `Le ticket ${ticket.reference} vous a été assigné`,
      auteurNom: acteur.nom,
      extra: {
        type:        'assignation',
        reference:   ticket.reference,
        titre:       ticket.titre,
        assigne_par: acteur.nom,
      },
    });
  }

  const messageAutres = `Le ticket ${ticket.reference} a été assigné à ${technicien.nom}`;
  const destinataires = await destinatairesTicket(ticket, acteur.id, [technicien.id]);

  for (const userId of destinataires) {
    await notifier(io, {
      userId,
      ticketId: ticket.id,
      type:     'assignation',
      titre:    `Ticket ${ticket.reference} assigné`,
      message:  messageAutres,
      auteurNom: acteur.nom,
      extra: {
        type:        'assignation',
        reference:   ticket.reference,
        titre:       ticket.titre,
        assigne_par: acteur.nom,
      },
    });
  }
}

// GET /tickets — Lister tickets (filtre selon le role - RG-08)
router.get('/', verifierToken, async (req, res) => {
  try {
    const { agent, agents, client, priorite, statut, date_debut, date_fin, sla_depasse, supprime, non_assigne } = req.query;

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

    // Un responsable ne voit que les tickets qu'il a lui-meme crees ;
    // seul l'admin a une visibilite totale sur tous les tickets.
    if (req.user.role === 'responsable') {
      whereClause.cree_par = req.user.id;
    }

  if (agentsFiltre.length > 0) {
  whereClause.assigne_id = {
    [Op.in]: agentsFiltre
  };
} else if (non_assigne === 'true') {
  whereClause.assigne_id = null;
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

    // Par defaut les tickets supprimes (suppression douce) sont exclus des
    // vues normales ; supprime=true permet au contraire de ne lister que
    // les tickets supprimes (utilise par le drill-down "tickets supprimes"
    // du dashboard).
    whereClause.supprime = supprime === 'true' ? true : { [Op.not]: true };

    console.log('======================');
console.log('QUERY =', req.query);
console.log('AGENTS FILTRE =', agentsFiltre);
console.log('WHERE CLAUSE =', whereClause);

const tickets = await Ticket.findAll({
  where: whereClause,
  include: [
    { model: User, as: 'assigne',  attributes: ['id', 'nom', 'email', 'photo_url'], required: false },
    { model: User, as: 'createur', attributes: ['id', 'nom', 'email', 'photo_url'], required: false },
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

    // Filtre SLA depasse (calcule, pas stocke en base) : un ticket deja
    // resolu n'est plus "en depassement" en cours.
    const ticketsFiltres = sla_depasse === 'true'
      ? tickets.filter(t => t.statut !== 'resolu' && calculerSla(t).depasse)
      : tickets;

    // Echeance SLA calculee automatiquement a partir de la priorite et de
    // la date d'ouverture (RG-04). La date limite saisie manuellement a la
    // creation, si elle existe, reste prioritaire (elle peut resserrer ou
    // desserrer le delai par rapport au calcul automatique).
    const ticketsAvecEcheance = ticketsFiltres.map(t => {
      const seuil = SEUILS_SLA[t.priorite] || SEUILS_SLA.moyenne;
      const echeanceCalculee = new Date(new Date(t.ouvert_le).getTime() + seuil * 60000);

      return {
        ...t.toJSON(),
        sla_echeance: t.date_limite_resolution || echeanceCalculee,
      };
    });

    const groupes = {
      a_faire:  ticketsAvecEcheance.filter(t => t.statut === 'a_faire'),
      en_cours: ticketsAvecEcheance.filter(t => t.statut === 'en_cours'),
      bloque:   ticketsAvecEcheance.filter(t => t.statut === 'bloque'),
      resolu:   ticketsAvecEcheance.filter(t => t.statut === 'resolu'),
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

      // Notifier le technicien si le ticket est assigne des sa creation
      if (ticket.assigne_id) {
        const io = req.app.get('io');
        const technicien = await User.findByPk(ticket.assigne_id, {
          attributes: ['id', 'nom'],
        });

        if (technicien) {
          await notifierAssignation(io, ticket, technicien, req.user);
        }
      }

      res.status(201).json({
        status: 'success',
        message: 'Ticket cree avec succes',
        data: ticket,
      });
    } catch (error) {
  console.error("ERREUR CREATION TICKET");
  console.error(error);

  res.status(500).json({
    status: "error",
    message: error.message
  });
}
  }
);

// GET /tickets/:id — Detail d'un ticket (RG-08)

  router.get('/:id', verifierToken, async (req, res) => {
    console.log('📨 GET /tickets reçu');
  console.log('🔍 User depuis token:', req.user);
  try {
    
    const ticket = await Ticket.findByPk(req.params.id, {
      include: [
        { model: User, as: 'assigne',  attributes: ['id', 'nom', 'email', 'photo_url'] },
        { model: User, as: 'createur', attributes: ['id', 'nom', 'email', 'photo_url'] },
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

    // Un responsable ne peut acceder qu'aux tickets qu'il a lui-meme crees
    if (req.user.role === 'responsable' && String(ticket.cree_par) !== String(req.user.id)) {
      return res.status(403).json({
        status: 'error',
        message: 'Acces refuse : ce ticket ne vous concerne pas',
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

    const notifierStatutChange = (userId) => notifier(io, {
      userId,
      ticketId: ticket.id,
      type:     'statut_change',
      titre:    `Ticket ${ticket.reference} mis à jour`,
      message:  `Le statut du ticket "${ticket.titre}" est passé de ` +
                `"${statutAvant}" à "${nouveau_statut}"`,
      auteurNom: req.user.nom,
      extra: {
        type:           'statut_change',
        reference:      ticket.reference,
        titre:          ticket.titre,
        ancien_statut:  statutAvant,
        nouveau_statut: nouveau_statut,
        modifie_par:    req.user.nom,
        message:        `Statut mis à jour : ${statutAvant} → ${nouveau_statut}`,
      },
    });

    // Createur/responsable-assigneur + technicien assigne + admins, sans
    // doublon et sans notifier l'auteur de l'action lui-meme
    for (const userId of await destinatairesTicket(ticket, req.user.id)) {
      await notifierStatutChange(userId);
    }

    // 🔥 TEMPS RÉEL — mise à jour du board pour tous
    if (io) {
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
        attributes: ['id', 'nom', 'role', 'photo_url'],
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

      // Toute (re)assignation remet le ticket a "a faire" et redemarre le
      // delai SLA a zero (nouvelle ouvert_le) : le travail recommence avec
      // le nouveau technicien.
      const statutAvant = ticket.statut;
      ticket.assigne_id = assigne_id;
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

      const io = req.app.get('io');
      await notifierAssignation(io, ticket, technicien, req.user);

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
        { model: User, as: 'auteur', attributes: ['id', 'nom', 'role', 'photo_url'] },
        {
          model: Commentaire,
          as: 'reponse_a',
          attributes: ['id', 'contenu'],
          include: [{ model: User, as: 'auteur', attributes: ['id', 'nom', 'photo_url'] }]
        }
      ]
    });

    const io = req.app.get('io');

    if (io) {
      const extrait = commentaire.contenu.length > 60
        ? commentaire.contenu.slice(0, 60) + '...'
        : commentaire.contenu;

      const messageNotif = `Nouveau commentaire sur ${ticket.reference} : "${extrait}"`;

      const notifierCommentaire = (userId) => notifier(io, {
        userId,
        ticketId: ticket.id,
        type:     'commentaire',
        titre:    `Nouveau commentaire sur ${ticket.reference}`,
        message:  messageNotif,
        auteurNom: req.user.nom,
        extra: {
          type:      'nouveau_commentaire',
          reference: ticket.reference,
          titre:     ticket.titre,
          contenu:   commentaire.contenu,
          auteur:    req.user.nom,
        },
      });

      // 🔔 createur/responsable-assigneur + technicien assigne + admins,
      // sans doublon et sans notifier l'auteur du commentaire lui-meme
      for (const userId of await destinatairesTicket(ticket, req.user.id)) {
        await notifierCommentaire(userId);
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
        { model: User, as: 'auteur', attributes: ['id', 'nom', 'role', 'photo_url'] },
        { model: User, as: 'suppresseur', attributes: ['id', 'nom'] },
        {
          model: Commentaire,
          as: 'reponse_a',
          attributes: ['id', 'contenu'],
          include: [{ model: User, as: 'auteur', attributes: ['id', 'nom', 'photo_url'] }]
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
      include: [{ model: User, as: 'auteur', attributes: ['id', 'nom', 'role', 'photo_url'] }]
    });

    if (!commentaire) {
      return res.status(404).json({ status: 'error', message: 'Commentaire non trouvé' });
    }
// APRÈS — forcer string pour éviter les problèmes de type
   if (String(commentaire.auteur_id) !== String(req.user.id) && req.user.role !== 'admin') {
      return res.status(403).json({ status: 'error', message: 'Non autorisé à supprimer ce commentaire' });
    }
    // Suppression douce : le contenu original est conserve en base mais
    // remplace a l'affichage par "Commentaire supprime par X".
    commentaire.supprime     = true;
    commentaire.supprime_par = req.user.id;
    await commentaire.save();

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
  uploade_par: req.user.id,
});

const io = req.app.get('io');

if (io) {
  const messageNotif = `Fichier "${piece.nom_fichier}" ajouté sur le ticket ${ticket.reference}`;

  const notifierPiece = (userId) => notifier(io, {
    userId,
    ticketId: ticket.id,
    type:     'piece_jointe',
    titre:    `Nouvelle pièce jointe sur ${ticket.reference}`,
    message:  messageNotif,
    auteurNom: req.user.nom,
    extra: {
      type:        'nouvelle_piece_jointe',
      reference:   ticket.reference,
      titre:       ticket.titre,
      nom_fichier: piece.nom_fichier,
      auteur:      req.user.nom,
    },
  });

  // Createur/responsable-assigneur + technicien assigne + admins, sans
  // doublon et sans notifier l'auteur de l'ajout lui-meme
  for (const userId of await destinatairesTicket(ticket, req.user.id)) {
    await notifierPiece(userId);
  }

  // Signal temps reel pour les vues de ticket deja ouvertes
  if (ticket.cree_par) {
    io.to(`user_${ticket.cree_par}`).emit('piece_jointe_ajoutee', {
      ticket_id: ticket.id,
      piece: {
        ...piece.toJSON(),
        uploadeur: { id: req.user.id, nom: req.user.nom },
      },
    });
  }
  if (ticket.assigne_id && ticket.assigne_id !== ticket.cree_par) {
    io.to(`user_${ticket.assigne_id}`).emit('piece_jointe_ajoutee', {
      ticket_id: ticket.id,
      piece: {
        ...piece.toJSON(),
        uploadeur: { id: req.user.id, nom: req.user.nom },
      },
    });
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
      include: [
        { model: User, as: 'uploadeur', attributes: ['id', 'nom'] },
        { model: User, as: 'suppresseur', attributes: ['id', 'nom'] },
      ],
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

    const { dureeMin, seuil, depasse } = calculerSla(ticket);
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

// DELETE /tickets/:id/pieces/:pieceId — Supprimer une piece jointe (uploadeur uniquement)
router.delete('/:id/pieces/:pieceId', verifierToken, async (req, res) => {
  try {
    const piece = await PieceJointe.findByPk(req.params.pieceId);

    if (!piece) {
      return res.status(404).json({ status: 'error', message: 'Piece jointe non trouvee' });
    }

    if (String(piece.uploade_par) !== String(req.user.id)) {
      return res.status(403).json({
        status: 'error',
        message: 'Vous ne pouvez supprimer que vos propres pieces jointes',
      });
    }

    const cheminFichier = path.join(__dirname, '../../uploads', path.basename(piece.url));
    fs.unlink(cheminFichier, (err) => {
      if (err) console.error('Erreur suppression fichier:', err.message);
    });

    // Suppression douce : le fichier physique est retire du disque mais la
    // ligne est conservee, affichee comme "Piece jointe supprimee par X".
    piece.supprime     = true;
    piece.supprime_par = req.user.id;
    await piece.save();

    res.json({ status: 'success', message: 'Piece jointe supprimee' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// DELETE /tickets/:id — Supprimer un ticket (admin ou responsable)
// Suppression douce : le ticket et son historique (commentaires, pieces
// jointes) sont conserves pour le decompte "tickets supprimes" du
// dashboard, simplement retires des vues normales (Kanban, listes).
router.delete('/:id', verifierToken, autoriserRoles('admin', 'responsable'), async (req, res) => {
  try {
    const ticket = await Ticket.findByPk(req.params.id);

    if (!ticket) {
      return res.status(404).json({ status: 'error', message: 'Ticket non trouve' });
    }

    ticket.supprime     = true;
    ticket.supprime_par = req.user.id;
    ticket.supprime_le  = new Date();
    await ticket.save();

    res.json({ status: 'success', message: 'Ticket supprime avec succes' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

module.exports = router;