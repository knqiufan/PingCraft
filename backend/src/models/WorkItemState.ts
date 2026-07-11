import { DataTypes, Model } from 'sequelize';
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

export class WorkItemState extends Model<WorkItemStateAttributes, WorkItemStateAttributes> {
  declare id: string;
  declare project_id: string;
  declare work_item_type_id: string;
  declare user_id: string;
  declare name: string;
  declare type?: string | null;
  declare color?: string | null;
  declare createdAt?: Date;
  declare updatedAt?: Date;
}

WorkItemState.init(
  {
    id: { type: DataTypes.STRING, allowNull: false, primaryKey: true },
    project_id: { type: DataTypes.STRING, allowNull: false, primaryKey: true },
    work_item_type_id: { type: DataTypes.STRING, allowNull: false, primaryKey: true },
    user_id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    type: { type: DataTypes.STRING, allowNull: true, comment: 'pending / doing / done' },
    color: { type: DataTypes.STRING, allowNull: true },
  },
  { sequelize, tableName: 'work_item_states', timestamps: true },
);
