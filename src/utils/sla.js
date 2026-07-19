// Seuils SLA selon la priorite (en minutes)
const SEUILS_SLA = {
  critique: 60,   // 1 heure
  moyenne:  240,  // 4 heures
  basse:    1440, // 24 heures
};

function calculerSla(ticket) {
  const maintenant = new Date();
  const ouverture  = new Date(ticket.ouvert_le);
  const fermeture  = ticket.resolu_le ? new Date(ticket.resolu_le) : maintenant;
  const dureeMin   = Math.round((fermeture - ouverture) / 60000);
  const seuil      = SEUILS_SLA[ticket.priorite] || SEUILS_SLA.moyenne;

  return {
    dureeMin,
    seuil,
    depasse: dureeMin > seuil,
  };
}

module.exports = { SEUILS_SLA, calculerSla };
