module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('PiecesJointes', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      url: { type: Sequelize.STRING, allowNull: false },
      nom_fichier: { type: Sequelize.STRING, allowNull: false },
      taille_ko: { type: Sequelize.INTEGER },
      ticket_id: {
        type: Sequelize.UUID,
        references: { model: 'Tickets', key: 'id' },
        onDelete: 'CASCADE',
      },
      createdAt: Sequelize.DATE,
      updatedAt: Sequelize.DATE,
    });
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('PiecesJointes');
  }
};