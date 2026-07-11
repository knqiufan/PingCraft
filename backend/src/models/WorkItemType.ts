import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../services/db.js';

export interface WorkItemTypeAttributes {
  id: string;
  project_id: string;
  user_id: string;
  name: string;
  group?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export class WorkItemType extends Model<WorkItemTypeAttributes, WorkItemTypeAttributes> {
  declare id: string;
  declare project_id: string;
  declare user_id: string;
  declare name: string;
  declare group?: string | null;
  declare createdAt?: Date;
  declare updatedAt?: Date;
}

WorkItemType.init(
  {
    id: { type: DataTypes.STRING, allowNull: false, primaryKey: true, comment: 'PingCode 类型 ID，如 epic, story, task' },
    project_id: { type: DataTypes.STRING, allowNull: false, primaryKey: true },
    user_id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    group: { type: DataTypes.STRING, allowNull: true, comment: 'requirement / task / bug' },
  },
  { sequelize, tableName: 'work_item_types', timestamps: true },
);
