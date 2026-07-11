import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../services/db.js';

export interface PermissionAttributes {
  id: string;
  name: string;
  display_name: string;
  description?: string | null;
  resource: string;
  action: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Permission extends Model<PermissionAttributes, PermissionAttributes> {
  declare id: string;
  declare name: string;
  declare display_name: string;
  declare description?: string | null;
  declare resource: string;
  declare action: string;
  declare createdAt?: Date;
  declare updatedAt?: Date;
}

Permission.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false, unique: true, comment: '权限名称，如 users.manage, projects.view' },
    display_name: { type: DataTypes.STRING, allowNull: false, comment: '权限显示名称' },
    description: { type: DataTypes.TEXT, allowNull: true, comment: '权限描述' },
    resource: { type: DataTypes.STRING, allowNull: false, comment: '资源类型，如 users, projects, work_items' },
    action: { type: DataTypes.STRING, allowNull: false, comment: '操作类型，如 view, create, update, delete, manage' },
  },
  { sequelize, tableName: 'permissions', timestamps: true },
);
