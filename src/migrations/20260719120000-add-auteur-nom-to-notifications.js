'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Notifications', 'auteur_nom', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('Notifications', 'auteur_nom');
  },
};
