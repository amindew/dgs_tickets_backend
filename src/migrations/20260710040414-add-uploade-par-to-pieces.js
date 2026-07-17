'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('PiecesJointes', 'uploade_par', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'Users', key: 'id' },
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('PiecesJointes', 'uploade_par');
  },
};