import { DataTypes, ModelDefined } from 'sequelize';
import { sequelize } from '../services/db.js';

export interface SyncedProjectAttributes {
  id: string;
  user_id: string;
  name: string;
  description?: string | null;
  /** PingCode 侧最后更新时间，用于增量同步判断是否需要更新本地缓存 */
  remote_updated_at?: string | null;
  /** 本地缓存是否已软删除（PingCode 侧已删除/归档） */
  is_archived?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export const SyncedProject: ModelDefined<
  SyncedProjectAttributes,
  SyncedProjectAttributes
> = sequelize.define(
  'SyncedProject',
  {
    id: { type: DataTypes.STRING, allowNull: false, primaryKey: true, comment: 'PingCode 项目 ID' },
    user_id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    remote_updated_at: { type: DataTypes.STRING, allowNull: true, comment: 'PingCode 项目最后更新时间（ISO 字符串或时间戳）' },
    is_archived: { type: DataTypes.BOOLEAN, defaultValue: false, comment: 'PingCode 侧已删除/归档时标记为 true' },
  },
  { tableName: 'synced_projects', timestamps: true },
);
