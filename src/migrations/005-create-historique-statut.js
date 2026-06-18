module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('HistoriqueStatuts', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      ticket_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Tickets', key: 'id' },
        onDelete: 'CASCADE',
      },
      ancien_statut: {
        type: Sequelize.ENUM('a_faire','en_cours','bloque','resolu'),
        allowNull: false,
      },
      nouveau_statut: {
        type: Sequelize.ENUM('a_faire','en_cours','bloque','resolu'),
        allowNull: false,
      },
      modifie_par: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
      },
      modifie_le: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      createdAt: Sequelize.DATE,
      updatedAt: Sequelize.DATE,
    });
  },
 down: async (queryInterface) => {
    await queryInterface.dropTable('HistoriqueStatuts');
  }
};