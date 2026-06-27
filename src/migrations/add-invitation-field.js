// Migration : ajouter invitation_token et invitation_en_attente sur Users
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Users', 'invitation_token', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('Users', 'invitation_en_attente', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
  },
  down: async (queryInterface) => {
    await queryInterface.removeColumn('Users', 'invitation_token');
    await queryInterface.removeColumn('Users', 'invitation_en_attente');
  }
};