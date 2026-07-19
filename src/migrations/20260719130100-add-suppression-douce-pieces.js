'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('PiecesJointes', 'supprime', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await queryInterface.addColumn('PiecesJointes', 'supprime_par', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'Users', key: 'id' },
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('PiecesJointes', 'supprime_par');
    await queryInterface.removeColumn('PiecesJointes', 'supprime');
  },
};
