import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../services/db.js';

export interface RolePermissionAttributes {
  role_id: string;
  permission_id: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export class RolePermission extends Model<RolePermissionAttributes, RolePermissionAttributes> {
  declare role_id: string;
  declare permission_id: string;
  declare createdAt?: Date;
  declare updatedAt?: Date;
}

RolePermission.init(
  {
    role_id: { type: DataTypes.UUID, allowNull: false, primaryKey: true, comment: '角色ID' },
    permission_id: { type: DataTypes.UUID, allowNull: false, primaryKey: true, comment: '权限ID' },
  },
  { sequelize, tableName: 'role_permissions', timestamps: true },
);
