import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useUserStore } from '../user'

vi.mock('@/api/auth', () => ({
  login: vi.fn(),
}))

vi.mock('@/api/config', () => ({
  getConfig: vi.fn(),
}))

describe('useUserStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.clearAllMocks()
  })

  describe('login()', () => {
    it('should save token, username, roles, isAdmin to state and localStorage', async () => {
      const { login: loginApi } = await import('@/api/auth')
      ;(loginApi as any).mockResolvedValue({
        token: 'test-token',
        user: {
          username: 'testuser',
          roles: ['admin', 'user'],
          isAdmin: true,
        },
      })

      const store = useUserStore()
      await store.login({ username: 'testuser', password: 'pass' })

      expect(store.token).toBe('test-token')
      expect(store.username).toBe('testuser')
      expect(store.roles).toEqual(['admin', 'user'])
      expect(store.isAdmin).toBe(true)
      expect(localStorage.getItem('local_token')).toBe('test-token')
      expect(localStorage.getItem('username')).toBe('testuser')
      expect(localStorage.getItem('isAdmin')).toBe('true')
      expect(localStorage.getItem('roles')).toBe(JSON.stringify(['admin', 'user']))
    })
  })

  describe('logout()', () => {
    it('should clear all state and localStorage', () => {
      const store = useUserStore()
      store.token = 'token'
      store.username = 'user'
      store.isAdmin = true
      store.roles = ['admin']
      localStorage.setItem('local_token', 'token')
      localStorage.setItem('username', 'user')

      store.logout()

      expect(store.token).toBe('')
      expect(store.username).toBe('')
      expect(store.isAdmin).toBe(false)
      expect(store.roles).toEqual([])
      expect(store.isConnected).toBe(false)
      expect(localStorage.getItem('local_token')).toBeNull()
      expect(localStorage.getItem('username')).toBeNull()
      expect(localStorage.getItem('isAdmin')).toBeNull()
      expect(localStorage.getItem('roles')).toBeNull()
    })
  })

  describe('restoreUserInfo()', () => {
    it('should restore isAdmin and roles from localStorage', () => {
      localStorage.setItem('isAdmin', 'true')
      localStorage.setItem('roles', JSON.stringify(['admin']))

      const store = useUserStore()
      store.restoreUserInfo()

      expect(store.isAdmin).toBe(true)
      expect(store.roles).toEqual(['admin'])
    })
  })

  describe('isLoggedIn', () => {
    it('should be true when token exists', () => {
      const store = useUserStore()
      store.token = 'some-token'
      expect(store.isLoggedIn).toBe(true)
    })

    it('should be false when token is empty', () => {
      const store = useUserStore()
      store.token = ''
      expect(store.isLoggedIn).toBe(false)
    })
  })
})
