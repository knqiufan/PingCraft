import { DataTypes, ModelDefined } from 'sequelize';
import { sequelize } from '../services/db.js';

export interface WorkItemStateAttributes {
  id: string;
  project_id: string;
  work_item_type_id: string;
  user_id: string;
  name: string;
  type?: string | null;
  color?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export const WorkItemState: ModelDefined<
  WorkItemStateAttributes,
  WorkItemStateAttributes
> = sequelize.define(
  'WorkItemState',
  {
    id: { type: DataTypes.STRING, allowNull: false, primaryKey: true },
    project_id: { type: DataTypes.STRING, allowNull: false, primaryKey: true },
    work_item_type_id: { type: DataTypes.STRING, allowNull: false, primaryKey: true },
    user_id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    type: { type: DataTypes.STRING, allowNull: true, comment: 'pending / doing / done' },
    color: { type: DataTypes.STRING, allowNull: true },
  },
  { tableName: 'work_item_states', timestamps: true },
);
