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
    window.location.reload()
    return
  }

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`${res.status}: ${text}`)
  }

  if (res.status === 204) return null
  return res.json()
}

export const api = {
  login: (password) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ password }) }),

  chat: (app, message, extraContext = null) =>
    request('/chat/', { method: 'POST', body: JSON.stringify({ app, message, extra_context: extraContext }) }),

  getChatHistory: (app) =>
    request(`/chat/history/${app}`),

  deleteChatMessage: (id) =>
    request(`/chat/message/${id}`, { method: 'DELETE' }),

  getContext: (app) =>
    request(`/chat/context/${app}`),
  updateContext: (app, data) =>
    request(`/chat/context/${app}`, { method: 'PATCH', body: JSON.stringify(data) }),

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

  // Docs
  getDocProjects: () =>
    request('/docs/projects'),
  createDocProject: (name) =>
    request('/docs/projects', { method: 'POST', body: JSON.stringify({ name }) }),
  deleteDocProject: (project) =>
    request(`/docs/projects/${project}`, { method: 'DELETE' }),
  getDocFiles: (project) =>
    request(`/docs/projects/${project}/files`),
  readDocFile: (project, path) =>
    request(`/docs/projects/${encodeURIComponent(project)}/files/${path}`),
  writeDocFile: (project, path, content) =>
    request(`/docs/projects/${encodeURIComponent(project)}/files/${path}`, { method: 'PUT', body: JSON.stringify({ content }) }),
  deleteDocFile: (project, path) =>
    request(`/docs/projects/${encodeURIComponent(project)}/files/${path}`, { method: 'DELETE' }),
  compileDoc: (project) =>
    request(`/docs/projects/${encodeURIComponent(project)}/compile`, { method: 'POST' }),
  getDocPdf: async (project) => {
    const res = await fetch(`/api/docs/projects/${encodeURIComponent(project)}/pdf`, {
      headers: { 'Authorization': getAuthHeader() },
    })
    if (!res.ok) throw new Error('PDF nicht gefunden')
    const blob = await res.blob()
    return URL.createObjectURL(blob)
  },

  // Fitness
  getWorkouts: () => request('/fitness/workouts'),
  getWorkoutsToday: (day) => request(`/fitness/workouts/today${day != null ? `?day=${day}` : ''}`),
  createWorkout: (data) => request('/fitness/workouts', { method: 'POST', body: JSON.stringify(data) }),
  updateWorkout: (id, data) => request(`/fitness/workouts/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteWorkout: (id) => request(`/fitness/workouts/${id}`, { method: 'DELETE' }),
  addWorkoutExercise: (workoutId, data) => request(`/fitness/workouts/${workoutId}/exercises`, { method: 'POST', body: JSON.stringify(data) }),
  updateWorkoutExercise: (exId, data) => request(`/fitness/exercises/${exId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteWorkoutExercise: (exId) => request(`/fitness/exercises/${exId}`, { method: 'DELETE' }),

  // Calories
  getFoodLogs: (date) =>
    request(`/calories/logs?date=${date}`),
  createFoodLog: (data) =>
    request('/calories/logs', { method: 'POST', body: JSON.stringify(data) }),
  deleteFoodLog: (id) =>
    request(`/calories/logs/${id}`, { method: 'DELETE' }),
  scanBarcode: (barcode) =>
    request(`/calories/scan/${barcode}`),
  searchFood: (q) =>
    request(`/calories/search?q=${encodeURIComponent(q)}`),

  // Stocks
  getStocks: () =>
    request('/stocks/'),
  searchStockSymbols: (q) =>
    request(`/stocks/search?q=${encodeURIComponent(q)}`),
  addStock: (symbol, name = '') =>
    request('/stocks/', { method: 'POST', body: JSON.stringify({ symbol, name }) }),
  deleteStock: (symbol) =>
    request(`/stocks/${symbol}`, { method: 'DELETE' }),
  refreshStock: (symbol) =>
    request(`/stocks/${symbol}/refresh`, { method: 'POST' }),

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
