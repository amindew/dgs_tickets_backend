const { Notification, User } = require('../models');

// Ids des admins a notifier en plus du createur/assigne (RG : visibilite
// globale des admins sur toute l'activite des tickets), en excluant ceux
// deja notifies pour ne pas doubler une notification.
async function idsAdmins(idsAExclure = []) {
  const exclusion = new Set(idsAExclure.filter(Boolean).map(String));
  const admins = await User.findAll({
    where: { role: 'admin', actif: true },
    attributes: ['id'],
  });

  return admins.map(a => a.id).filter(id => !exclusion.has(String(id)));
}

// Calcule les destinataires d'une notification liee a un ticket : le
// createur du ticket (qui fait aussi office de "responsable ayant assigne"
// - creation et assignation sont traitees comme une seule et meme
// responsabilite), le technicien assigne, et les admins actifs.
// L'auteur de l'action est toujours exclu (pas d'auto-notification), et
// chaque personne n'est renvoyee qu'une seule fois meme si elle cumule
// plusieurs roles sur le ticket.
async function destinatairesTicket(ticket, acteurId, idsSupplementairesAExclure = []) {
  const exclusion = new Set(
    [acteurId, ...idsSupplementairesAExclure].filter(Boolean).map(String)
  );

  const ids = new Set();
  if (ticket.cree_par && !exclusion.has(String(ticket.cree_par))) {
    ids.add(String(ticket.cree_par));
  }
  if (ticket.assigne_id && !exclusion.has(String(ticket.assigne_id))) {
    ids.add(String(ticket.assigne_id));
  }

  const admins = await idsAdmins([...exclusion, ...ids]);
  admins.forEach(id => ids.add(String(id)));

  return [...ids];
}

// Sauvegarde une notification en base puis l'emet en temps reel a
// l'utilisateur concerne, si son socket est connecte.
async function notifier(io, { userId, ticketId, type, titre, message, extra = {} }) {
  if (!userId) return null;

  const notif = await Notification.create({
    user_id:   userId,
    ticket_id: ticketId,
    type,
    titre,
    message,
    lue: false,
  });

  if (io) {
    io.to(`user_${userId}`).emit('notification', {
      id:        notif.id,
      ticket_id: ticketId,
      message,
      date:      new Date().toISOString(),
      ...extra,
    });
  }

  return notif;
}

module.exports = { idsAdmins, notifier, destinatairesTicket };
