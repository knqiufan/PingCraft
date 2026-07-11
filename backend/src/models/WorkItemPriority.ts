import { DataTypes, ModelDefined } from 'sequelize';
import { sequelize } from '../services/db.js';

export interface WorkItemPriorityAttributes {
  id: string;
  project_id: string;
  user_id: string;
  name: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export const WorkItemPriority: ModelDefined<
  WorkItemPriorityAttributes,
  WorkItemPriorityAttributes
> = sequelize.define(
  'WorkItemPriority',
  {
    id: { type: DataTypes.STRING, allowNull: false, primaryKey: true },
    project_id: { type: DataTypes.STRING, allowNull: false, primaryKey: true },
    user_id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
  },
  { tableName: 'work_item_priorities', timestamps: true },
);
