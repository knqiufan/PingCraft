import { DataTypes } from 'sequelize';
import { sequelize } from '../services/db.js';

export const WorkItemPriority = sequelize.define('WorkItemPriority', {
  id: {
    type: DataTypes.STRING,
    allowNull: false,
    primaryKey: true,
  },
  project_id: {
    type: DataTypes.STRING,
    allowNull: false,
    primaryKey: true,
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
}, {
  tableName: 'work_item_priorities',
  timestamps: true,
});
