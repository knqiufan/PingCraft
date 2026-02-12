import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { login as loginApi } from '@/api/auth'
import { getConfig } from '@/api/config'

function getStoredRoles(): string[] {
  try {
    const raw = localStorage.getItem('roles')
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export const useUserStore = defineStore('user', () => {
  /* ---- state ---- */
  const token = ref(localStorage.getItem('local_token') || '')
  const username = ref(localStorage.getItem('username') || '')
  const isAdmin = ref(localStorage.getItem('isAdmin') === 'true')
  const roles = ref<string[]>(getStoredRoles())
  const isConnected = ref(false)

  /* ---- getters ---- */
  const isLoggedIn = computed(() => !!token.value)

  /* ---- actions ---- */

  /** 本地登录 */
  async function login(data: { username: string; password: string }) {
    const res = await loginApi(data)
    token.value = res.token
    username.value = res.user.username
    isAdmin.value = res.user.isAdmin || false
    roles.value = res.user.roles || []
    localStorage.setItem('local_token', res.token)
    localStorage.setItem('username', res.user.username)
    localStorage.setItem('isAdmin', String(res.user.isAdmin || false))
    localStorage.setItem('roles', JSON.stringify(res.user.roles || []))
  }

  /** 退出登录 */
  function logout() {
    token.value = ''
    username.value = ''
    isAdmin.value = false
    roles.value = []
    isConnected.value = false
    localStorage.removeItem('local_token')
    localStorage.removeItem('username')
    localStorage.removeItem('isAdmin')
    localStorage.removeItem('roles')
  }

  /** 从 localStorage 恢复用户信息 */
  function restoreUserInfo() {
    const savedIsAdmin = localStorage.getItem('isAdmin')
    const savedRoles = localStorage.getItem('roles')
    if (savedIsAdmin) {
      isAdmin.value = savedIsAdmin === 'true'
    }
    if (savedRoles) {
      try {
        roles.value = JSON.parse(savedRoles)
      } catch {
        roles.value = []
      }
    }
  }

  /** 检查 PingCode 连接状态 */
  async function checkConnection() {
    try {
      const res = await getConfig()
      isConnected.value = res.is_connected
    } catch {
      isConnected.value = false
    }
  }

  /** OAuth 回调后标记已连接 */
  function markConnected() {
    isConnected.value = true
  }

  return {
    token,
    username,
    isAdmin,
    roles,
    isConnected,
    isLoggedIn,
    login,
    logout,
    restoreUserInfo,
    checkConnection,
    markConnected,
  }
})
