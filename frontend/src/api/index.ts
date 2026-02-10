import axios, { type AxiosError } from 'axios'
import { ElMessage } from 'element-plus'
import { config } from '@/config'

const request = axios.create({
  baseURL: config.apiBaseUrl,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

request.interceptors.request.use(
  (reqConfig) => {
    const token = localStorage.getItem('local_token')
    if (token) {
      reqConfig.headers.Authorization = `Bearer ${token}`
    }
    if (config.isDev) {
      console.log('[Request]', reqConfig.method?.toUpperCase(), reqConfig.url)
    }
    return reqConfig
  },
  (error) => Promise.reject(error)
)

request.interceptors.response.use(
  (response) => {
    if (config.isDev) {
      console.log('[Response]', response.config.url, response.status)
    }
    return response.data
  },
  (error: AxiosError<{ error?: string }>) => {
    const status = error.response?.status
    const message = error.response?.data?.error || error.message || '请求失败'

    if (status === 401) {
      localStorage.removeItem('local_token')
      localStorage.removeItem('username')
      window.location.href = '/#/login'
    } else {
      ElMessage.error(message)
    }

    return Promise.reject(error)
  }
)

export default request
