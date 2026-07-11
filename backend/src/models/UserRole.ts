import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../services/db.js';

export interface UserRoleAttributes {
  user_id: string;
  role_id: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export class UserRole extends Model<UserRoleAttributes, UserRoleAttributes> {
  declare user_id: string;
  declare role_id: string;
  declare createdAt?: Date;
  declare updatedAt?: Date;
}

UserRole.init(
  {
    user_id: { type: DataTypes.UUID, allowNull: false, primaryKey: true, comment: '用户ID' },
    role_id: { type: DataTypes.UUID, allowNull: false, primaryKey: true, comment: '角色ID' },
  },
  { sequelize, tableName: 'user_roles', timestamps: true },
);
