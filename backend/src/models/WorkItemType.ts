import { DataTypes, ModelDefined } from 'sequelize';
import { sequelize } from '../services/db.js';

/** WorkItemType 行属性（timestamps: true 自动追加 createdAt/updatedAt） */
export interface WorkItemTypeAttributes {
  id: string;
  project_id: string;
  user_id: string;
  name: string;
  group?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export const WorkItemType: ModelDefined<
  WorkItemTypeAttributes,
  WorkItemTypeAttributes
> = sequelize.define(
  'WorkItemType',
  {
    id: {
      type: DataTypes.STRING,
      allowNull: false,
      primaryKey: true,
      comment: 'PingCode 类型 ID，如 epic, story, task',
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
    group: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'requirement / task / bug',
    },
  },
  {
    tableName: 'work_item_types',
    timestamps: true,
  },
);
