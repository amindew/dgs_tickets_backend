// Matrice des transitions autorisees (RG-02)
const TRANSITIONS = {
a_faire: ['en_cours'],
en_cours: ['bloque', 'resolu'],
bloque: ['en_cours'],
resolu: ['en_cours'], // reouverture (RG-09)
};
function transitionAutorisee(statutActuel, nouveauStatut) {
const autorisees = TRANSITIONS[statutActuel] || [];
return autorisees.includes(nouveauStatut);
}
module.exports = { transitionAutorisee, TRANSITIONS };