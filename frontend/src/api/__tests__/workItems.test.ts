import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../index', () => ({
  default: {
    post: vi.fn(),
  },
}))

import request from '../index'
import { syncData, matchProject, checkDuplicates, importItems } from '../workItems'

describe('workItems API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('syncData should POST /api/sync-data', async () => {
    ;(request.post as any).mockResolvedValue({ success: true })
    await syncData()
    expect(request.post).toHaveBeenCalledWith('/api/sync-data', {})
  })

  it('matchProject should POST with requirements', async () => {
    ;(request.post as any).mockResolvedValue({ success: true })
    const reqs = [{ project_name: 'Test' }] as any
    await matchProject(reqs)
    expect(request.post).toHaveBeenCalledWith('/api/match-project', { requirements: reqs })
  })

  it('checkDuplicates should POST with items and projectId', async () => {
    ;(request.post as any).mockResolvedValue({ success: true })
    const items = [{ title: 'Item' }] as any
    await checkDuplicates(items, 'proj-1')
    expect(request.post).toHaveBeenCalledWith('/api/check-duplicates', {
      items,
      projectId: 'proj-1',
    })
  })

  it('importItems should POST with record_id', async () => {
    ;(request.post as any).mockResolvedValue({ success: true })
    const items = [{ title: 'Item' }] as any
    await importItems(items, 'proj-1', 'rec-1')
    expect(request.post).toHaveBeenCalledWith('/api/import', {
      items,
      projectId: 'proj-1',
      record_id: 'rec-1',
    })
  })
})
