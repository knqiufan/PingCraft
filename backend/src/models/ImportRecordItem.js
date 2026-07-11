import { DataTypes } from 'sequelize';
import { sequelize } from '../services/db.js';

export const ImportRecordItem = sequelize.define('ImportRecordItem', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  record_id: {
    type: DataTypes.UUID,
    allowNull: false,
    comment: '关联的导入记录ID',
  },
  title: {
    type: DataTypes.STRING(500),
    allowNull: false,
    comment: '工作项标题',
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '工作项描述',
  },
  project_name: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: '原始项目名称（AI识别）',
  },
  type_id: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: '工作项类型ID',
  },
  priority_id: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: '优先级ID',
  },
  /** 优先级文本（High/Medium/Low），恢复时还原，不再硬编码 Medium */
  priority: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: '优先级文本（High/Medium/Low）',
  },
  /** 预估工时（小时），恢复时还原 */
  estimated_hours: {
    type: DataTypes.FLOAT,
    allowNull: true,
    comment: '预估工时（小时）',
  },
  /** 计划开始时间（ISO 8601），恢复时还原 */
  start_at: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: '计划开始时间（ISO 8601）',
  },
  /** 计划结束时间（ISO 8601） */
  end_at: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: '计划结束时间（ISO 8601）',
  },
  /** 负责人姓名（从需求文档识别） */
  assignee_name: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: '负责人姓名（AI识别）',
  },
  /** 负责人 ID（解析自成员列表或用户指定） */
  assignee_id: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: '负责人 ID（PingCode 用户 ID）',
  },
  /** 解决方案建议（AI 核心输出之一，导入时拼入 description） */
  solution_suggestion: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'AI 生成的解决方案建议',
  },
  pingcode_id: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: '导入后的 PingCode 工作项ID',
  },
  pingcode_identifier: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: '导入后的 PingCode 工作项标识符（如 WI-123）',
  },
  status: {
    type: DataTypes.ENUM('pending', 'success', 'failed', 'skipped'),
    defaultValue: 'pending',
    comment: '导入状态：pending-待导入, success-成功, failed-失败, skipped-跳过',
  },
  error_message: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '导入失败的错误信息',
  },
}, {
  tableName: 'import_record_items',
  timestamps: true,
  indexes: [
    {
      fields: ['record_id'],
    },
    {
      fields: ['status'],
    },
  ],
});
