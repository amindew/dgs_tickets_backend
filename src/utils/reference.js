const { Ticket } = require('../models');
const { Op } = require('sequelize');

async function genererReference() {
  const tickets = await Ticket.findAll({
    attributes: ['reference'],
    where: {
      reference: {
        [Op.like]: 'INC-%'
      }
    }
  });

  let max = 0;

  for (const ticket of tickets) {
    const n = parseInt(ticket.reference.replace('INC-', ''), 10);

    if (!isNaN(n) && n > max) {
      max = n;
    }
  }

  return `INC-${String(max + 1).padStart(6, '0')}`;
}

module.exports = { genererReference };