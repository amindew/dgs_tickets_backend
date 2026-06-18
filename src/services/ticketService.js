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

function messageErreurTransition(actuel, tente) {
  const possibles = transitionsPossibles(actuel);
  return `Transition interdite : ${actuel} vers ${tente}. ` +
    `Transitions possibles : ${possibles.join(', ')}`;
}

module.exports = {
  transitionAutorisee,
  transitionsPossibles,
  messageErreurTransition,
  TRANSITIONS,
};