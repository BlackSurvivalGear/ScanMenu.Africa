const cuisineInput = document.getElementById('cuisine');
const searchInput = document.getElementById('cuisine-search');
const selectedContainer = document.getElementById('cuisine-selected');
const customInput = document.getElementById('custom-cuisine');
const customButton = document.getElementById('add-custom-cuisine');
const emptyMessage = document.getElementById('cuisine-empty');

const selected = new Set();
let userHasInteracted = false;

function normalise(value) {
    return value.trim().replace(/\s+/g, ' ');
}

function findSelected(value) {
    const target = value.toLocaleLowerCase();
    return [...selected].find(item => item.toLocaleLowerCase() === target);
}

function syncHiddenInput() {
    cuisineInput.value = [...selected].join(', ');
}

function renderSelected() {
    selectedContainer.innerHTML = '';
    selectedContainer.classList.toggle('hidden', selected.size === 0);

    selected.forEach(value => {
        const pill = document.createElement('button');
        pill.type = 'button';
        pill.className = 'cuisine-selected-pill';
        pill.setAttribute('aria-label', `Remove ${value}`);
        pill.textContent = `${value} ×`;
        pill.addEventListener('click', () => {
            userHasInteracted = true;
            selected.delete(value);
            syncHiddenInput();
            render();
        });
        selectedContainer.appendChild(pill);
    });
}

function updateOptionStates() {
    document.querySelectorAll('.cuisine-pill[data-cuisine]').forEach(pill => {
        const isSelected = Boolean(findSelected(pill.dataset.cuisine));
        pill.classList.toggle('selected', isSelected);
        pill.setAttribute('aria-pressed', String(isSelected));
    });
}

function render() {
    renderSelected();
    updateOptionStates();
}

function toggleCuisine(value) {
    const clean = normalise(value);
    if (!clean) return;
    userHasInteracted = true;
    const existing = findSelected(clean);
    if (existing) selected.delete(existing);
    else selected.add(clean);
    syncHiddenInput();
    render();
}

function loadCommaSeparated(value) {
    selected.clear();
    String(value || '').split(',').map(normalise).filter(Boolean).forEach(item => selected.add(item));
    render();
}

document.querySelectorAll('.cuisine-pill[data-cuisine]').forEach(pill => {
    pill.addEventListener('click', () => toggleCuisine(pill.dataset.cuisine));
});

searchInput.addEventListener('input', () => {
    const query = searchInput.value.trim().toLocaleLowerCase();
    let visibleCount = 0;

    document.querySelectorAll('.cuisine-pill[data-cuisine]').forEach(pill => {
        const matches = !query || pill.dataset.cuisine.toLocaleLowerCase().includes(query);
        pill.hidden = !matches;
        if (matches) visibleCount += 1;
    });

    document.querySelectorAll('.cuisine-region').forEach(region => {
        const hasMatch = [...region.querySelectorAll('.cuisine-pill[data-cuisine]')].some(pill => !pill.hidden);
        region.hidden = !hasMatch;
        if (query && hasMatch) region.open = true;
        if (!query) region.open = false;
    });

    emptyMessage.classList.toggle('hidden', visibleCount !== 0 || !query);
});

function addCustomCuisine() {
    const value = normalise(customInput.value);
    if (!value) return;
    if (!findSelected(value)) selected.add(value);
    userHasInteracted = true;
    customInput.value = '';
    syncHiddenInput();
    render();
}

customButton.addEventListener('click', addCustomCuisine);
customInput.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
        event.preventDefault();
        addCustomCuisine();
    }
});

// restaurant.js loads an existing comma-separated cuisine value asynchronously.
// Mirror it into the selector until the member starts changing the selection.
let lastExternalValue = cuisineInput.value;
loadCommaSeparated(lastExternalValue);
const existingValueWatcher = window.setInterval(() => {
    if (userHasInteracted) {
        window.clearInterval(existingValueWatcher);
        return;
    }
    if (cuisineInput.value !== lastExternalValue) {
        lastExternalValue = cuisineInput.value;
        loadCommaSeparated(lastExternalValue);
    }
}, 100);
window.setTimeout(() => window.clearInterval(existingValueWatcher), 5000);
