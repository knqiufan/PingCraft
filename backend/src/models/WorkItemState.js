import { DataTypes } from 'sequelize';
import { sequelize } from '../services/db.js';

export const WorkItemState = sequelize.define('WorkItemState', {
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
  work_item_type_id: {
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
  type: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'pending / doing / done',
  },
  color: {
    type: DataTypes.STRING,
    allowNull: true,
  },
}, {
  tableName: 'work_item_states',
  timestamps: true,
});
