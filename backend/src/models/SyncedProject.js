import { DataTypes } from 'sequelize';
import { sequelize } from '../services/db.js';

export const SyncedProject = sequelize.define('SyncedProject', {
  id: {
    type: DataTypes.STRING,
    allowNull: false,
    primaryKey: true,
    comment: 'PingCode 项目 ID',
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
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'synced_projects',
  timestamps: true,
});
