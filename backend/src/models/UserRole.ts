import { DataTypes, ModelDefined } from 'sequelize';
import { sequelize } from '../services/db.js';

export interface UserRoleAttributes {
  user_id: string;
  role_id: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export const UserRole: ModelDefined<UserRoleAttributes, UserRoleAttributes> = sequelize.define(
  'UserRole',
  {
    user_id: { type: DataTypes.UUID, allowNull: false, primaryKey: true, comment: '用户ID' },
    role_id: { type: DataTypes.UUID, allowNull: false, primaryKey: true, comment: '角色ID' },
  },
  { tableName: 'user_roles', timestamps: true },
);
