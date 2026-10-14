const form = document.querySelector('#project-form');
const nameInput = document.querySelector('#name');
const statusInput = document.querySelector('#status');
const projectList = document.querySelector('#project-list');
const emptyState = document.querySelector('#empty-state');
const saveButton = document.querySelector('#save-button');
const cancelButton = document.querySelector('#cancel-button');
const message = document.querySelector('#message');

const VALID_STATUSES = ['Planned', 'In Progress', 'Completed'];

let projects = [];
let editingId = null;
let hasLoadedProjects = false;
let isLoading = false;
let isSaving = false;

// These elements are present in the HTML you pasted.
if (
  !form ||
  !nameInput ||
  !statusInput ||
  !projectList ||
  !emptyState ||
  !saveButton ||
  !cancelButton ||
  !message
) {
  throw new Error('A required project form or list element is missing.');
}

function showMessage(text, isError = false) {
  message.textContent = text;
  message.style.color = isError ? '#b91c1c' : '#166534';
}

function requestsInProgress() {
  return isLoading || isSaving;
}

function updateMutationControls() {
  const disabled = requestsInProgress();

  saveButton.disabled = disabled;
  cancelButton.disabled = disabled;

  projectList
    .querySelectorAll('button')
    .forEach(button => {
      button.disabled = disabled;
    });
}

async function getApiErrorMessage(response) {
  let responseText = '';

  try {
    responseText = await response.text();
  } catch {
    // Use the status as a fallback if the response body cannot be read.
  }

  if (responseText) {
    try {
      const body = JSON.parse(responseText);

      if (typeof body.error === 'string' && body.error.trim()) {
        return body.error;
      }
    } catch {
      // The API may return non-JSON for an error; use the status fallback.
    }
  }

  return `The request failed (${response.status} ${response.statusText}).`;
}

async function requestJson(url, options = {}) {
  let response;

  try {
    response = await fetch(url, options);
  } catch {
    throw new Error(
      'Could not reach the server. Check that it is running and try again.'
    );
  }

  if (!response.ok) {
    throw new Error(await getApiErrorMessage(response));
  }

  try {
    return await response.json();
  } catch {
    throw new Error('The server returned an unreadable response.');
  }
}

function validateProjectList(value) {
  if (!Array.isArray(value)) {
    throw new Error('The server did not return a project list.');
  }

  const ids = new Set();

  for (const project of value) {
    if (
      !project ||
      typeof project !== 'object' ||
      !Number.isSafeInteger(project.id) ||
      project.id < 1 ||
      ids.has(project.id) ||
      typeof project.name !== 'string' ||
      typeof project.status !== 'string' ||
      !VALID_STATUSES.includes(project.status)
    ) {
      throw new Error('The server returned an invalid project list.');
    }

    ids.add(project.id);
  }

  return value;
}

function resetFormToAddMode() {
  editingId = null;
  form.reset();
  nameInput.setCustomValidity('');
  saveButton.textContent = 'Save Project';
  cancelButton.hidden = true;
}

function renderProjects() {
  projectList.replaceChildren();

  for (const project of projects) {
    const listItem = document.createElement('li');

    const nameElement = document.createElement('span');
    nameElement.textContent = project.name;

    const statusElement = document.createElement('span');
    statusElement.textContent = ` — ${project.status} `;

    const editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.textContent = 'Edit';
    editButton.disabled = requestsInProgress();
    editButton.addEventListener('click', () => {
      if (requestsInProgress()) return;

      editingId = project.id;
      nameInput.value = project.name;
      statusInput.value = project.status;
      nameInput.setCustomValidity('');

      saveButton.textContent = 'Save changes';
      cancelButton.hidden = false;
      nameInput.focus();
    });

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.textContent = 'Delete';
    deleteButton.disabled = requestsInProgress();
    deleteButton.addEventListener('click', async () => {
      if (requestsInProgress()) return;

      const confirmed = window.confirm(`Delete project "${project.name}"?`);
      if (!confirmed) return;

      await deleteProject(project.id, project.name);
    });

    listItem.append(
      nameElement,
      statusElement,
      editButton,
      deleteButton
    );

    projectList.appendChild(listItem);
  }

  emptyState.hidden = !hasLoadedProjects || projects.length > 0;
}

async function loadProjects(successMessage = '') {
  isLoading = true;
  emptyState.hidden = !hasLoadedProjects || projects.length > 0;
  updateMutationControls();
  showMessage('Loading projects…');

  try {
    const result = await requestJson('/api/projects');
    projects = validateProjectList(result);
    hasLoadedProjects = true;
    renderProjects();

    if (successMessage) {
      showMessage(successMessage);
    } else if (projects.length === 0) {
      showMessage('No projects yet.');
    } else {
      showMessage('Projects loaded.');
    }

    return null;
  } catch (error) {
    // Keep the empty state hidden when the initial load fails.
    renderProjects();
    showMessage(error.message, true);
    return error;
  } finally {
    isLoading = false;
    updateMutationControls();
  }
}

async function refreshAfterMutation(successMessage) {
  const loadError = await loadProjects(successMessage);

  if (loadError) {
    showMessage(
      `${successMessage} The list could not be refreshed: ${loadError.message}`,
      true
    );
  }
}

async function deleteProject(projectId, projectName) {
  isSaving = true;
  updateMutationControls();
  showMessage('Deleting project…');

  try {
    await requestJson(`/api/projects/${encodeURIComponent(projectId)}`, {
      method: 'DELETE'
    });

    if (editingId === projectId) {
      resetFormToAddMode();
    }

    const successMessage =
      projects.length === 1
        ? `Deleted "${projectName}".`
        : `Deleted "${projectName}".`;

    await refreshAfterMutation(successMessage);
  } catch (error) {
    showMessage(error.message, true);
  } finally {
    isSaving = false;
    updateMutationControls();
  }
}

// Keep one submit listener for both create and edit.
form.addEventListener('submit', async event => {
  event.preventDefault();

  if (requestsInProgress()) return;

  const name = nameInput.value.trim();
  const status = statusInput.value;

  if (name === '') {
    nameInput.setCustomValidity('Please enter a project name.');
    nameInput.reportValidity();
    return;
  }

  if (name.length > 80) {
    showMessage('Project names must be 80 characters or fewer.', true);
    return;
  }

  if (!VALID_STATUSES.includes(status)) {
    showMessage('Please select a valid project status.', true);
    return;
  }

  nameInput.setCustomValidity('');

  const isEditing = editingId !== null;
  const projectId = editingId;
  const url = isEditing
    ? `/api/projects/${encodeURIComponent(projectId)}`
    : '/api/projects';
  const method = isEditing ? 'PUT' : 'POST';

  isSaving = true;
  updateMutationControls();
  showMessage(isEditing ? 'Saving changes…' : 'Saving project…');

  try {
    await requestJson(url, {
      method,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name, status })
    });

    resetFormToAddMode();

    await refreshAfterMutation(
      isEditing ? 'Project updated.' : 'Project created.'
    );
  } catch (error) {
    // Keep the form values and edit mode so the user can retry.
    showMessage(error.message, true);
  } finally {
    isSaving = false;
    updateMutationControls();
  }
});

cancelButton.addEventListener('click', () => {
  if (requestsInProgress()) return;

  resetFormToAddMode();
  showMessage('Editing cancelled.');
});

nameInput.addEventListener('input', () => {
  nameInput.setCustomValidity('');
});

// Load the server collection when the page opens.
loadProjects();