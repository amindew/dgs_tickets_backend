// Matrice des transitions autorisees (RG-02)
const TRANSITIONS = {
  a_faire: ['en_cours'],
  en_cours: ['bloque', 'resolu'],
  bloque: ['en_cours'],
  resolu: ['en_cours'], // reouverture (RG-09)
};

function transitionAutorisee(actuel, nouveau) {
  return (TRANSITIONS[actuel] || []).includes(nouveau);
}

function transitionsPossibles(statut) {
  return TRANSITIONS[statut] || [];
}

const LABELS_STATUT = {
  a_faire:  'À faire',
  en_cours: 'En cours',
  bloque:   'Bloqué',
  resolu:   'Résolu',
};

function messageErreurTransition(actuel, tente) {
  const possibles = transitionsPossibles(actuel).map(s => LABELS_STATUT[s] || s);
  const labelActuel = LABELS_STATUT[actuel] || actuel;
  const labelTente   = LABELS_STATUT[tente]  || tente;

  return `Ce ticket est actuellement "${labelActuel}" et ne peut pas passer à ` +
    `"${labelTente}". Les statuts autorisés depuis "${labelActuel}" sont : ${possibles.join(', ')}.`;
}

module.exports = {
  transitionAutorisee,
  transitionsPossibles,
  messageErreurTransition,
  TRANSITIONS,
};