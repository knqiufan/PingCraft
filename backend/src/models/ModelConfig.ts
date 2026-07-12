import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../services/db.js';
import { encrypt, decrypt } from '../utils/crypto.js';

export type ModelProvider = 'openai' | 'anthropic';

export interface ModelConfigAttributes {
  id: string;
  user_id: string;
  name: string;
  provider: ModelProvider;
  api_key: string;
  base_url?: string | null;
  model: string;
  temperature?: number | null;
  max_tokens?: number | null;
  is_default?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export class ModelConfig extends Model<ModelConfigAttributes, ModelConfigAttributes> {
  declare id: string;
  declare user_id: string;
  declare name: string;
  declare provider: ModelProvider;
  declare api_key: string;
  declare base_url?: string | null;
  declare model: string;
  declare temperature?: number | null;
  declare max_tokens?: number | null;
  declare is_default?: boolean;
  declare createdAt?: Date;
  declare updatedAt?: Date;
}

/** 需要透明加解密的敏感字段 */
const SENSITIVE_FIELDS = ['api_key'];

ModelConfig.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    user_id: { type: DataTypes.UUID, allowNull: false },
    name: { type: DataTypes.STRING, allowNull: false, comment: '配置名称，如 "DeepSeek Chat", "GPT-4"' },
    provider: { type: DataTypes.ENUM('openai', 'anthropic'), allowNull: false, comment: 'API 提供商' },
    api_key: { type: DataTypes.TEXT, allowNull: false, comment: 'API 密钥' },
    base_url: { type: DataTypes.STRING, allowNull: true, comment: 'API 基础 URL' },
    model: { type: DataTypes.STRING, allowNull: false, comment: '模型名称，如 "deepseek-chat", "gpt-4"' },
    temperature: { type: DataTypes.FLOAT, allowNull: true, defaultValue: 0.7, comment: '温度参数，控制随机性' },
    max_tokens: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 272000, comment: '最大生成 tokens 数' },
    is_default: { type: DataTypes.BOOLEAN, defaultValue: false, comment: '是否为默认配置' },
  },
  {
    sequelize,
    tableName: 'model_configs',
    timestamps: true,
    indexes: [{ unique: true, fields: ['user_id', 'name'] }],
    hooks: {
      beforeSave: (instance: any) => {
        // 仅加密本次被修改（或新创建）的敏感字段
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
