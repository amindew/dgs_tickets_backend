module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('Tickets', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      reference: { type: Sequelize.STRING,unique: true,allowNull: false,
                    validate: {
                        is: /^INC-\d{6}$/}
        },
      titre: { type: Sequelize.STRING, allowNull: false },
      description: { type: Sequelize.TEXT },
      priorite: {
        type: Sequelize.ENUM('basse', 'moyenne', 'critique'),
        allowNull: false,
      },
      statut: {
        type: Sequelize.ENUM('a_faire', 'en_cours', 'bloque', 'resolu'),
        defaultValue: 'a_faire',
      },
      client_nom: { type: Sequelize.STRING, allowNull: false },
        email_client: { 
        type: Sequelize.STRING, 
        unique: true, 
        allowNull: true
      },
      telephone_client: { 
        type: Sequelize.STRING, 
        allowNull: false, 
      },
      assigne_id: {
        type: Sequelize.UUID,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      cree_par: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
      },
      ouvert_le: { type: Sequelize.DATE, allowNull: false },
      resolu_le: { type: Sequelize.DATE },
      duree_resolution_min: { type: Sequelize.INTEGER },
      createdAt: Sequelize.DATE,
      updatedAt: Sequelize.DATE,
    });
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('Tickets');
  }
};