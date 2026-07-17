module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('Notifications', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onDelete: 'CASCADE',
      },
      ticket_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'Tickets', key: 'id' },
        onDelete: 'SET NULL',
      },
      type: {
        type: Sequelize.ENUM('statut_change', 'assignation', 'commentaire'),
        allowNull: false,
      },
      titre:      { type: Sequelize.STRING,  allowNull: false },
      message:    { type: Sequelize.TEXT,    allowNull: false },
      lue:        { type: Sequelize.BOOLEAN, defaultValue: false },
      date_envoi: { type: Sequelize.DATE,    defaultValue: Sequelize.NOW },
      createdAt:  Sequelize.DATE,
      updatedAt:  Sequelize.DATE,
    });
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('Notifications');
  }
};