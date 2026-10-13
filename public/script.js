
const form = document.querySelector('#project-form');
const nameInput = document.querySelector('#name');
const statusInput = document.querySelector('#status');
const projectList = document.querySelector('#project-list');
const emptyState = document.querySelector('#empty-state');
const saveButton = document.querySelector('#save-button');
const cancelButton = document.querySelector('#cancel-button');
const message = document.querySelector('#message');

const STORAGE_KEY = 'workshop-projects-v1';
const VALID_STATUSES = ['Planned', 'In Progress', 'Completed'];

let projects = [];
let editingId = null;

// Show a message without inserting user-provided HTML.
function showMessage(text, isError = false) {
  if (!message) return;

  message.textContent = text;
  message.style.color = isError ? '#b91c1c' : '#166534';
}

// Check that stored data has the expected structure.
function isValidProjectArray(value) {
  if (!Array.isArray(value)) return false;

  const ids = new Set();

  for (const project of value) {
    if (
      project === null ||
      typeof project !== 'object' ||
      typeof project.id !== 'string' ||
      project.id.trim() === '' ||
      typeof project.name !== 'string' ||
      project.name.trim() === '' ||
      project.name.length > 80 ||
      typeof project.status !== 'string' ||
      !VALID_STATUSES.includes(project.status) ||
      ids.has(project.id)
    ) {
      return false;
    }

    ids.add(project.id);
  }

  return true;
}

// Load projects without overwriting malformed stored data.
function loadProjects() {
  let storedText;

  try {
    storedText = localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    showMessage(
      'Projects could not be loaded because browser storage is unavailable.',
      true
    );
    return;
  }

  if (storedText === null) {
    projects = [];
    return;
  }

  let storedProjects;

  try {
    storedProjects = JSON.parse(storedText);
  } catch (error) {
    showMessage(
      'Saved project data is malformed. It has not been overwritten. Check or remove the stored data before saving changes.',
      true
    );
    return;
  }

  if (!isValidProjectArray(storedProjects)) {
    showMessage(
      'Saved project data has an invalid format. It has not been overwritten. Check or remove the stored data before saving changes.',
      true
    );
    return;
  }

  projects = storedProjects;
}

// Save a collection. Return false if saving fails.
function saveProjects() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
    showMessage('Projects saved.');
    return true;
  } catch (error) {
    showMessage(
      'Changes could not be saved to browser storage. Your current changes may be lost if you refresh.',
      true
    );
    return false;
  }
}

// Generate a unique ID for each new project.
function generateProjectId() {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// Return the form to Add mode.
function resetFormToAddMode() {
  editingId = null;
  form.reset();
  nameInput.setCustomValidity('');
  saveButton.textContent = 'Save Project';
  cancelButton.hidden = true;
}

// Display all projects and their action buttons.
function renderProjects() {
  projectList.replaceChildren();

  projects.forEach(project => {
    const listItem = document.createElement('li');

    const nameElement = document.createElement('span');
    nameElement.textContent = project.name;

    const statusElement = document.createElement('span');
    statusElement.textContent = ` — ${project.status} `;

    const editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.textContent = 'Edit';

    editButton.addEventListener('click', () => {
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

    deleteButton.addEventListener('click', () => {
      const confirmed = window.confirm(
        `Delete project "${project.name}"?`
      );

      if (!confirmed) return;

      const projectIndex = projects.findIndex(
        item => item.id === project.id
      );

      if (projectIndex === -1) return;

      const deletedProject = projects[projectIndex];

      projects.splice(projectIndex, 1);

      if (editingId === deletedProject.id) {
        resetFormToAddMode();
      }

      renderProjects();
      saveProjects();
    });

    listItem.append(
      nameElement,
      statusElement,
      editButton,
      deleteButton
    );

    projectList.appendChild(listItem);
  });

  if (emptyState) {
    emptyState.hidden = projects.length > 0;
  }
}

// Handle adding and editing with one submit listener.
form.addEventListener('submit', event => {
  event.preventDefault();

  const name = nameInput.value.trim();
  const status = statusInput.value;

  if (name === '') {
    nameInput.setCustomValidity('Please enter a project name.');
    nameInput.reportValidity();
    return;
  }

  if (!VALID_STATUSES.includes(status)) {
    showMessage('Please select a valid project status.', true);
    return;
  }

  nameInput.setCustomValidity('');

  // Do not overwrite malformed data discovered during startup.
  // Also prevent further writes if storage cannot be read.
  if (storageUnavailable) {
    showMessage(
      'Changes cannot be saved because stored data could not be loaded safely.',
      true
    );
    return;
  }

  if (editingId !== null) {
    const project = projects.find(item => item.id === editingId);

    if (!project) {
      resetFormToAddMode();
      renderProjects();
      showMessage('The project being edited could not be found.', true);
      return;
    }

    const previousName = project.name;
    const previousStatus = project.status;

    project.name = name;
    project.status = status;

    if (!saveProjects()) {
      project.name = previousName;
      project.status = previousStatus;
      renderProjects();
      return;
    }
  } else {
    const project = {
      id: generateProjectId(),
      name: name,
      status: status
    };

    projects.push(project);

    if (!saveProjects()) {
      projects.pop();
      renderProjects();
      return;
    }
  }

  renderProjects();
  resetFormToAddMode();
});

// Cancel editing without changing stored projects.
cancelButton.addEventListener('click', () => {
  resetFormToAddMode();
  showMessage('Editing cancelled.');
});

// Clear custom validation when the name changes.
nameInput.addEventListener('input', () => {
  nameInput.setCustomValidity('');
});

// Prevent saving if loading failed or stored data is malformed.
let storageUnavailable = false;

try {
  const storedText = localStorage.getItem(STORAGE_KEY);

  if (storedText !== null) {
    let storedProjects;

    try {
      storedProjects = JSON.parse(storedText);
    } catch (error) {
      storageUnavailable = true;
      showMessage(
        'Saved project data is malformed. It has not been overwritten. Check or remove the stored data before saving changes.',
        true
      );
    }

    if (
      !storageUnavailable &&
      !isValidProjectArray(storedProjects)
    ) {
      storageUnavailable = true;
      showMessage(
        'Saved project data has an invalid format. It has not been overwritten. Check or remove the stored data before saving changes.',
        true
      );
    }

    if (!storageUnavailable) {
      projects = storedProjects;
    }
  }
} catch (error) {
  storageUnavailable = true;
  showMessage(
    'Projects could not be loaded because browser storage is unavailable.',
    true
  );
}

renderProjects();
