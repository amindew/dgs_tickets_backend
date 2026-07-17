module.exports = {
  up: async (queryInterface) => {
    await queryInterface.renameColumn('Tickets', 'email_client', 'client_email');
    await queryInterface.renameColumn('Tickets', 'telephone_client', 'client_telephone');
  },
  down: async (queryInterface) => {
    await queryInterface.renameColumn('Tickets', 'client_email', 'email_client');
    await queryInterface.renameColumn('Tickets', 'client_telephone', 'telephone_client');
  },
};
