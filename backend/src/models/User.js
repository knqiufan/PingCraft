import { DataTypes } from 'sequelize';
import { sequelize } from '../services/db.js';

export const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  password_hash: {
    type: DataTypes.STRING,
    allowNull: false
  },
  // PingCode Config
  pingcode_client_id: {
    type: DataTypes.STRING,
    allowNull: true
  },
  pingcode_client_secret: {
    type: DataTypes.STRING,
    allowNull: true
  },
  /** OAuth2 grant: authorization_code（用户授权）| client_credentials（企业令牌） */
  pingcode_grant_type: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'authorization_code'
  },
  // PingCode Tokens
  pingcode_uid: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true
  },
  access_token: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  refresh_token: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  expires_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  domain: {
    type: DataTypes.STRING,
    allowNull: true
  },
  // PingCode 用户信息（来自 GET /v1/myself）
  pingcode_user_id: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'PingCode 用户 ID，用于 assignee_id'
  },
  pingcode_user_name: {
    type: DataTypes.STRING,
    allowNull: true
  },
  pingcode_display_name: {
    type: DataTypes.STRING,
    allowNull: true
  },
  pingcode_email: {
    type: DataTypes.STRING,
    allowNull: true
  },
  pingcode_avatar: {
    type: DataTypes.STRING,
    allowNull: true
  }
}, {
  tableName: 'user_auth',
  timestamps: true,
  // Force sync to update schema since we changed PK
  // In prod, use migrations. Here, sequelize.sync({ alter: true }) in db.js handles it.
});
