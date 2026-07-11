import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../services/db.js';

export type ImportRecordStatus =
  | 'analyzed'
  | 'importing'
  | 'success'
  | 'partial_success'
  | 'failed';

export interface ImportRecordAttributes {
  id: string;
  user_id: string;
  file_name: string;
  original_file_path?: string | null;
  requirements_count: number;
  projects_count?: number;
  target_project_id?: string | null;
  target_project_name?: string | null;
  imported_count?: number;
  failed_count?: number;
  status?: ImportRecordStatus;
  error_message?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export class ImportRecord extends Model<ImportRecordAttributes, ImportRecordAttributes> {
  declare id: string;
  declare user_id: string;
  declare file_name: string;
  declare original_file_path?: string | null;
  declare requirements_count: number;
  declare projects_count?: number;
  declare target_project_id?: string | null;
  declare target_project_name?: string | null;
  declare imported_count?: number;
  declare failed_count?: number;
  declare status?: ImportRecordStatus;
  declare error_message?: string | null;
  declare createdAt?: Date;
  declare updatedAt?: Date;
}

ImportRecord.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    user_id: { type: DataTypes.UUID, allowNull: false },
    file_name: { type: DataTypes.STRING, allowNull: false, comment: '原始文件名' },
    original_file_path: { type: DataTypes.STRING, allowNull: true, comment: '原需求文档保存路径（如 uploads/demand/xxx-1234567890.txt）' },
    requirements_count: { type: DataTypes.INTEGER, allowNull: false, comment: '解析出的需求数量' },
    projects_count: { type: DataTypes.INTEGER, defaultValue: 0, comment: '涉及的项目数量' },
    target_project_id: { type: DataTypes.STRING, allowNull: true, comment: '目标项目ID' },
    target_project_name: { type: DataTypes.STRING, allowNull: true, comment: '目标项目名称' },
    imported_count: { type: DataTypes.INTEGER, defaultValue: 0, comment: '实际导入的工作项数量' },
    failed_count: { type: DataTypes.INTEGER, defaultValue: 0, comment: '导入失败的工作项数量' },
    status: {
      type: DataTypes.ENUM('analyzed', 'importing', 'success', 'partial_success', 'failed'),
      defaultValue: 'analyzed',
      comment: '导入状态',
    },
    error_message: { type: DataTypes.TEXT, allowNull: true, comment: '错误信息' },
  },
  { sequelize, tableName: 'import_records', timestamps: true },
);
