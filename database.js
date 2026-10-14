let projects = [];
let nextId = 1;
export const db = {
  async list() { return projects; },
  async create(project) { const row = { id: nextId++, ...project }; projects.push(row); return row; },
  async update(id, project) { const index = projects.findIndex(p => p.id === id); if (index < 0) return null; projects[index] = { id, ...project }; return projects[index]; },
  async remove(id) { const found = projects.some(p => p.id === id); projects = projects.filter(p => p.id !== id); return found; }
};
