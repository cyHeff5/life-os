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

  // Calendar
  getCalendarEvents: (start, end) =>
    request(`/calendar/events?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`),
  createCalendarEvent: (data) =>
    request('/calendar/events', { method: 'POST', body: JSON.stringify(data) }),
  updateCalendarEvent: (id, data) =>
    request(`/calendar/events/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteCalendarEvent: (id) =>
    request(`/calendar/events/${id}`, { method: 'DELETE' }),

  // Calendar sidebar work packages (from projects)
  getWorkPackages: () =>
    request('/calendar/work-packages'),

  // Projects
  getProjects: () =>
    request('/projects/'),
  createProject: (data) =>
    request('/projects/', { method: 'POST', body: JSON.stringify(data) }),
  deleteProject: (id) =>
    request(`/projects/${id}`, { method: 'DELETE' }),

  // Work Areas
  getAreas: (projectId) =>
    request(`/projects/${projectId}/areas`),
  createArea: (projectId, data) =>
    request(`/projects/${projectId}/areas`, { method: 'POST', body: JSON.stringify(data) }),
  deleteArea: (areaId) =>
    request(`/projects/areas/${areaId}`, { method: 'DELETE' }),

  // Work Packages (project)
  createPackage: (areaId, data) =>
    request(`/projects/areas/${areaId}/packages`, { method: 'POST', body: JSON.stringify(data) }),
  updatePackage: (wpId, data) =>
    request(`/projects/packages/${wpId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deletePackage: (wpId) =>
    request(`/projects/packages/${wpId}`, { method: 'DELETE' }),
}
