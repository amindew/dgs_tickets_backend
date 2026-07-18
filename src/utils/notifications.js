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

module.exports = { idsAdmins, notifier };
