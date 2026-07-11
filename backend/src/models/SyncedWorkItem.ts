import { DataTypes, ModelDefined } from 'sequelize';
import { sequelize } from '../services/db.js';

export interface SyncedWorkItemAttributes {
  id: string;
  user_id: string;
  project_id: string;
  title: string;
  description?: string | null;
  identifier?: string | null;
  /** PingCode 侧最后更新时间戳，用于增量同步判断是否需要更新本地缓存 */
  remote_updated_at?: string | null;
  /** 本地缓存是否已软删除（PingCode 侧已删除/归档） */
  is_archived?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export const SyncedWorkItem: ModelDefined<
  SyncedWorkItemAttributes,
  SyncedWorkItemAttributes
> = sequelize.define(
  'SyncedWorkItem',
  {
    id: { type: DataTypes.STRING, allowNull: false, primaryKey: true, comment: 'PingCode 工作项 ID' },
    user_id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
    project_id: { type: DataTypes.STRING, allowNull: false },
    title: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true, comment: '工作项描述（用于列表展示与查重明细）' },
    identifier: { type: DataTypes.STRING, allowNull: true, comment: '工作项编号' },
    remote_updated_at: { type: DataTypes.STRING, allowNull: true, comment: 'PingCode 工作项最后更新时间（ISO 字符串或时间戳）' },
    is_archived: { type: DataTypes.BOOLEAN, defaultValue: false, comment: 'PingCode 侧已删除/归档时标记为 true' },
  },
  { tableName: 'synced_work_items', timestamps: true },
);
