import { DataTypes, ModelDefined } from 'sequelize';
import { sequelize } from '../services/db.js';

export interface RolePermissionAttributes {
  role_id: string;
  permission_id: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export const RolePermission: ModelDefined<
  RolePermissionAttributes,
  RolePermissionAttributes
> = sequelize.define(
  'RolePermission',
  {
    role_id: { type: DataTypes.UUID, allowNull: false, primaryKey: true, comment: '角色ID' },
    permission_id: { type: DataTypes.UUID, allowNull: false, primaryKey: true, comment: '权限ID' },
  },
  { tableName: 'role_permissions', timestamps: true },
);
