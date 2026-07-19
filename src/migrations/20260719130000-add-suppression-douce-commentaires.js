'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Commentaires', 'supprime', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await queryInterface.addColumn('Commentaires', 'supprime_par', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'Users', key: 'id' },
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('Commentaires', 'supprime_par');
    await queryInterface.removeColumn('Commentaires', 'supprime');
  },
};
