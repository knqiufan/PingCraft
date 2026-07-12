import { describe, it, expect } from 'vitest'
import {
  enrichWorkItem,
  resolvePriorityId,
  resolveStateId,
  resolveStateLabel,
  resolveTypeId,
  priorityIdToText,
  toTextPriority,
} from '../workItemFields'
import type { WorkItem, WorkItemPriorityMeta, WorkItemStateMeta, WorkItemTypeMeta } from '@/api/types'

const priorities: WorkItemPriorityMeta[] = [
  { id: 'uuid-high', project_id: 'p1', name: '高' },
  { id: 'uuid-mid', project_id: 'p1', name: '中' },
  { id: 'uuid-low', project_id: 'p1', name: '低' },
]

const types: WorkItemTypeMeta[] = [
  { id: 'uuid-story', project_id: 'p1', name: '用户故事' },
  { id: 'uuid-task', project_id: 'p1', name: '任务' },
]

const states: WorkItemStateMeta[] = [
  { id: 'uuid-todo', project_id: 'p1', work_item_type_id: 'uuid-task', name: '待办', type: 'pending' },
  { id: 'uuid-doing', project_id: 'p1', work_item_type_id: 'uuid-task', name: '进行中', type: 'doing' },
  { id: 'uuid-story-todo', project_id: 'p1', work_item_type_id: 'uuid-story', name: '新建', type: 'pending' },
]

describe('workItemFields', () => {
  it('toTextPriority maps Chinese and English', () => {
    expect(toTextPriority('High')).toBe('High')
    expect(toTextPriority('中')).toBe('Medium')
    expect(toTextPriority('低')).toBe('Low')
  })

  it('resolvePriorityId maps Medium text to meta UUID', () => {
    expect(resolvePriorityId(undefined, 'Medium', priorities)).toBe('uuid-mid')
    expect(resolvePriorityId(undefined, 'High', priorities)).toBe('uuid-high')
  })

  it('resolvePriorityId falls back to High/Medium/Low without meta', () => {
    expect(resolvePriorityId(undefined, 'High', [])).toBe('High')
  })

  it('priorityIdToText reverses UUID to enum', () => {
    expect(priorityIdToText('uuid-high', priorities)).toBe('High')
    expect(priorityIdToText('Medium', priorities)).toBe('Medium')
  })

  it('resolveTypeId maps story to 用户故事 UUID', () => {
    expect(resolveTypeId('story', types)).toBe('uuid-story')
    expect(resolveTypeId('task', types)).toBe('uuid-task')
  })

  it('resolveStateId defaults to pending/todo for type', () => {
    expect(resolveStateId(undefined, 'uuid-task', states)).toBe('uuid-todo')
    expect(resolveStateId(undefined, undefined, [])).toBe('new')
  })

  it('resolveStateId does not pick other type UUID when type unmatched', () => {
    // type 仍是枚举 story，而元数据 type_id 都是 UUID → 应回退 new，而非误选 task 状态
    expect(resolveStateId(undefined, 'story', states)).toBe('new')
  })

  it('resolveStateId matches LLM state name', () => {
    expect(resolveStateId(undefined, 'uuid-task', states, '进行中')).toBe('uuid-doing')
    expect(resolveStateId(undefined, 'uuid-story', states, '新建')).toBe('uuid-story-todo')
  })

  it('resolveStateLabel never returns raw ObjectId', () => {
    expect(resolveStateLabel('6a5216871c459b168513ae86', null, [])).toBe('待办')
    expect(resolveStateLabel('uuid-todo', null, states)).toBe('待办')
    expect(resolveStateLabel('uuid-doing', '进行中', states)).toBe('进行中')
  })

  it('enrichWorkItem fills priority_id/state_id/state from Agent output', () => {
    const item: WorkItem = {
      project_name: 'demo',
      title: 't',
      priority: 'Medium',
      estimated_hours: 8,
      start_at: '2026-01-01',
      type_id: 'task',
      assignee_name: null,
      state: null,
    }
    const enriched = enrichWorkItem(item, { types, priorities, states })
    expect(enriched.type_id).toBe('uuid-task')
    expect(enriched.priority_id).toBe('uuid-mid')
    expect(enriched.priority).toBe('Medium')
    expect(enriched.state_id).toBe('uuid-todo')
    expect(enriched.state).toBe('待办')
  })
})
