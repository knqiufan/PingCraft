import { DataTypes, ModelDefined } from 'sequelize';
import { sequelize } from '../services/db.js';
import { encrypt, decrypt } from '../utils/crypto.js';

export interface UserAttributes {
  id: string;
  username: string;
  password_hash: string;
  pingcode_client_id?: string | null;
  pingcode_client_secret?: string | null;
  /** OAuth2 grant: authorization_code（用户授权）| client_credentials（企业令牌） */
  pingcode_grant_type?: string;
  pingcode_uid?: string | null;
  access_token?: string | null;
  refresh_token?: string | null;
  expires_at?: Date | null;
  domain?: string | null;
  pingcode_user_id?: string | null;
  pingcode_user_name?: string | null;
  pingcode_display_name?: string | null;
  pingcode_email?: string | null;
  pingcode_avatar?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

/** 需要透明加解密的敏感字段 */
const SENSITIVE_FIELDS = ['pingcode_client_secret', 'access_token', 'refresh_token'];

export const User: ModelDefined<UserAttributes, UserAttributes> = sequelize.define(
  'User',
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    username: { type: DataTypes.STRING, allowNull: false, unique: true },
    password_hash: { type: DataTypes.STRING, allowNull: false },
    pingcode_client_id: { type: DataTypes.STRING, allowNull: true },
    pingcode_client_secret: { type: DataTypes.STRING, allowNull: true },
    pingcode_grant_type: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'authorization_code',
    },
    pingcode_uid: {
      type: DataTypes.STRING,
      allowNull: true,
      // 不设 unique: true —— 允许同一个 PingCode 账号关联多个本地用户，
      // 避免多用户绑定同一 PingCode 账号时唯一约束冲突。
    },
    access_token: { type: DataTypes.TEXT, allowNull: true },
    refresh_token: { type: DataTypes.TEXT, allowNull: true },
    expires_at: { type: DataTypes.DATE, allowNull: true },
    domain: { type: DataTypes.STRING, allowNull: true },
    pingcode_user_id: { type: DataTypes.STRING, allowNull: true, comment: 'PingCode 用户 ID，用于 assignee_id' },
    pingcode_user_name: { type: DataTypes.STRING, allowNull: true },
    pingcode_display_name: { type: DataTypes.STRING, allowNull: true },
    pingcode_email: { type: DataTypes.STRING, allowNull: true },
    pingcode_avatar: { type: DataTypes.STRING, allowNull: true },
  },
  {
    tableName: 'user_auth',
    timestamps: true,
    // Force sync to update schema since we changed PK
    // In prod, use migrations. Here, sequelize.sync({ alter: true }) in db.js handles it.
    hooks: {
      beforeSave: (instance: any) => {
        // 仅加密本次被修改（或新创建）的敏感字段，避免每次 update 都重写全部密文列（防竞态）
        for (const field of SENSITIVE_FIELDS) {
          if (instance.changed(field)) {
            const val = instance.getDataValue(field);
            if (val !== null && val !== undefined && val !== '') {
              instance.setDataValue(field, encrypt(val));
            }
          }
        }
      },
      afterSave: (instance: any) => {
        for (const field of SENSITIVE_FIELDS) {
          const val = instance.getDataValue(field);
          instance.setDataValue(field, decrypt(val));
        }
      },
      afterFind: (instances: any) => {
        const list = Array.isArray(instances) ? instances : (instances ? [instances] : []);
        for (const instance of list) {
          for (const field of SENSITIVE_FIELDS) {
            const val = instance.getDataValue(field);
            instance.setDataValue(field, decrypt(val));
          }
        }
      },
    },
  },
);
