import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../services/db.js';

export interface WorkItemPriorityAttributes {
  id: string;
  project_id: string;
  user_id: string;
  name: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export class WorkItemPriority extends Model<WorkItemPriorityAttributes, WorkItemPriorityAttributes> {
  declare id: string;
  declare project_id: string;
  declare user_id: string;
  declare name: string;
  declare createdAt?: Date;
  declare updatedAt?: Date;
}

WorkItemPriority.init(
  {
    id: { type: DataTypes.STRING, allowNull: false, primaryKey: true },
    project_id: { type: DataTypes.STRING, allowNull: false, primaryKey: true },
    user_id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
  },
  { sequelize, tableName: 'work_item_priorities', timestamps: true },
);
