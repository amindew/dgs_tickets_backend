module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('Commentaires', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      contenu: { type: Sequelize.TEXT, allowNull: false },
      ticket_id: {
        type: Sequelize.UUID,
        references: { model: 'Tickets', key: 'id' },
        onDelete: 'CASCADE',
      },
      auteur_id: {
        type: Sequelize.UUID,
        references: { model: 'Users', key: 'id' },
      },
      cree_le: { type: Sequelize.DATE, allowNull: false },
      createdAt: Sequelize.DATE,
      updatedAt: Sequelize.DATE,
    });
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('Commentaires');
  }
};