import { DataTypes } from 'sequelize';
import { sequelize } from '../services/db.js';

export const WorkItemProperty = sequelize.define('WorkItemProperty', {
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
    comment: 'select / text / ...',
  },
  options: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: '选项列表',
  },
}, {
  tableName: 'work_item_properties',
  timestamps: true,
});
