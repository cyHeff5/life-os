const BASE_URL = '/api'

function getAuthHeader() {
  const token = localStorage.getItem('token') || ''
  return `Bearer ${token}`
}

async function request(path, options = {}) {
  const res = await fetch(BASE_URL + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': getAuthHeader(),
      ...options.headers,
    },
  })

  if (res.status === 401) {
    localStorage.removeItem('token')
    window.location.href = '/'
    return
  }

  if (!res.ok) {
    const text = await res.text()
    throw new Error(text)
  }

  if (res.status === 204) return null
  return res.json()
}

export const api = {
  login: (password) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ password }) }),

  chat: (app, message) =>
    request('/chat/', { method: 'POST', body: JSON.stringify({ app, message }) }),

  getChatHistory: (app) =>
    request(`/chat/history/${app}`),

  deleteChatMessage: (id) =>
    request(`/chat/message/${id}`, { method: 'DELETE' }),
}
