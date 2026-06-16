const { Ticket } = require('../models');
async function genererReference() {
  // Compter le nombre total de tickets existants
  const count = await Ticket.count();
  // Incrémenter et formater sur 6 chiffres
  const numero = count + 1;
  const reference = `INC-${String(numero).padStart(6, '0')}`;
  return reference; // ex: INC-000001, INC-000045
}
module.exports = { genererReference };