import { User } from './User.js';
import { WorkItemType } from './WorkItemType.js';
import { WorkItemState } from './WorkItemState.js';
import { WorkItemProperty } from './WorkItemProperty.js';
import { WorkItemPriority } from './WorkItemPriority.js';
import { SyncedProject } from './SyncedProject.js';
import { SyncedWorkItem } from './SyncedWorkItem.js';
import { ModelConfig } from './ModelConfig.js';
import { ImportRecord } from './ImportRecord.js';
import { ImportRecordItem } from './ImportRecordItem.js';
import { Role } from './Role.js';
import { Permission } from './Permission.js';
import { RolePermission } from './RolePermission.js';
import { UserRole } from './UserRole.js';

// ========== 定义模型关联关系 ==========

// User <-> Role 多对多关系（通过 UserRole）
User.belongsToMany(Role, {
  through: UserRole,
  foreignKey: 'user_id',
  otherKey: 'role_id',
  as: 'roles',
});
Role.belongsToMany(User, {
  through: UserRole,
  foreignKey: 'role_id',
  otherKey: 'user_id',
  as: 'users',
});

// UserRole -> Role 关联（用于 include 查询）
UserRole.belongsTo(Role, { foreignKey: 'role_id' });
Role.hasMany(UserRole, { foreignKey: 'role_id' });

// UserRole -> User 关联
UserRole.belongsTo(User, { foreignKey: 'user_id' });
User.hasMany(UserRole, { foreignKey: 'user_id' });

// Role <-> Permission 多对多关系（通过 RolePermission）
Role.belongsToMany(Permission, {
  through: RolePermission,
  foreignKey: 'role_id',
  otherKey: 'permission_id',
  as: 'permissions',
});
Permission.belongsToMany(Role, {
  through: RolePermission,
  foreignKey: 'permission_id',
  otherKey: 'role_id',
  as: 'roles',
});

// RolePermission -> Role/Permission 关联
RolePermission.belongsTo(Role, { foreignKey: 'role_id' });
RolePermission.belongsTo(Permission, { foreignKey: 'permission_id' });
Role.hasMany(RolePermission, { foreignKey: 'role_id' });
Permission.hasMany(RolePermission, { foreignKey: 'permission_id' });

// ImportRecord <-> ImportRecordItem 一对多关系
ImportRecord.hasMany(ImportRecordItem, {
  foreignKey: 'record_id',
  as: 'items',
  onDelete: 'CASCADE',
});
ImportRecordItem.belongsTo(ImportRecord, {
  foreignKey: 'record_id',
  as: 'record',
});

// ========== 导出所有模型 ==========

export {
  User,
  WorkItemType,
  WorkItemState,
  WorkItemProperty,
  WorkItemPriority,
  SyncedProject,
  SyncedWorkItem,
  ModelConfig,
  ImportRecord,
  ImportRecordItem,
  Role,
  Permission,
  RolePermission,
  UserRole,
};
