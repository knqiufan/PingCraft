import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../services/db.js';

export interface RoleAttributes {
  id: string;
  name: string;
  display_name: string;
  description?: string | null;
  is_system?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Role extends Model<RoleAttributes, RoleAttributes> {
  declare id: string;
  declare name: string;
  declare display_name: string;
  declare description?: string | null;
  declare is_system?: boolean;
  declare createdAt?: Date;
  declare updatedAt?: Date;
}

Role.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false, unique: true, comment: '角色名称，如 admin, user' },
    display_name: { type: DataTypes.STRING, allowNull: false, comment: '角色显示名称' },
    description: { type: DataTypes.TEXT, allowNull: true, comment: '角色描述' },
    is_system: { type: DataTypes.BOOLEAN, defaultValue: false, comment: '是否为系统角色（不可删除）' },
  },
  { sequelize, tableName: 'roles', timestamps: true },
);
