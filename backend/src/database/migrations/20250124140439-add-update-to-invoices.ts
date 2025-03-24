import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.changeColumn("Invoices", "companyId", {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'Companies', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE', // Alterado de SET NULL para CASCADE
    });
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.removeColumn("Invoices", "companyId");
  }
};
