import { DataTypes } from 'sequelize';
import { sequelize } from '../services/db.js';

export const SyncedWorkItem = sequelize.define('SyncedWorkItem', {
  id: {
    type: DataTypes.STRING,
    allowNull: false,
    primaryKey: true,
    comment: 'PingCode 工作项 ID',
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    primaryKey: true,
  },
  project_id: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  identifier: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: '工作项编号',
  },
}, {
  tableName: 'synced_work_items',
  timestamps: true,
});
