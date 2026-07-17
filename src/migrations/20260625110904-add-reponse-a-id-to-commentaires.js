module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Commentaires', 'reponse_a_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'Commentaires', key: 'id' },
      onDelete: 'SET NULL',
    });
  },
  down: async (queryInterface) => {
    await queryInterface.removeColumn('Commentaires', 'reponse_a_id');
  }
};