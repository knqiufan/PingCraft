import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { login as loginApi } from '@/api/auth'
import { getConfig } from '@/api/config'

export const useUserStore = defineStore('user', () => {
  /* ---- state ---- */
  const token = ref(localStorage.getItem('local_token') || '')
  const username = ref(localStorage.getItem('username') || '')
  const isConnected = ref(false)

  /* ---- getters ---- */
  const isLoggedIn = computed(() => !!token.value)

  /* ---- actions ---- */

  /** 本地登录 */
  async function login(data: { username: string; password: string }) {
    const res = await loginApi(data)
    token.value = res.token
    username.value = res.user.username
    localStorage.setItem('local_token', res.token)
    localStorage.setItem('username', res.user.username)
  }

  /** 退出登录 */
  function logout() {
    token.value = ''
    username.value = ''
    isConnected.value = false
    localStorage.removeItem('local_token')
    localStorage.removeItem('username')
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
    isConnected,
    isLoggedIn,
    login,
    logout,
    checkConnection,
    markConnected,
  }
})
