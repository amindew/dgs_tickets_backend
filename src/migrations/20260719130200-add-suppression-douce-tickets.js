'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Tickets', 'supprime', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await queryInterface.addColumn('Tickets', 'supprime_par', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'Users', key: 'id' },
    });
    await queryInterface.addColumn('Tickets', 'supprime_le', {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('Tickets', 'supprime_le');
    await queryInterface.removeColumn('Tickets', 'supprime_par');
    await queryInterface.removeColumn('Tickets', 'supprime');
  },
};
