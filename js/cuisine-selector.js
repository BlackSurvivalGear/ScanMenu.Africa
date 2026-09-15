document.addEventListener('DOMContentLoaded', () => {
    const picker = document.getElementById('cuisine-picker');
    const search = document.getElementById('cuisine-search');
    const hidden = document.getElementById('cuisine');
    const custom = document.getElementById('custom-cuisine');
    if (!picker || !search || !hidden || !custom) return;

    const CUSTOM = 'Other / Custom Cuisine';

    function sync() {
        const selected = Array.from(picker.selectedOptions).map(option => option.value);
        const wantsCustom = selected.includes(CUSTOM);
        custom.classList.toggle('hidden', !wantsCustom);
        const values = selected.filter(value => value !== CUSTOM);
        if (wantsCustom && custom.value.trim()) values.push(custom.value.trim());
        hidden.value = values.join(', ');
    }

    function restore() {
        if (!hidden.value) return;
        const saved = hidden.value.split(',').map(value => value.trim()).filter(Boolean);
        const options = Array.from(picker.options);
        const customValues = [];
        saved.forEach(value => {
            const match = options.find(option => option.value.toLowerCase() === value.toLowerCase());
            if (match) match.selected = true;
            else customValues.push(value);
        });
        if (customValues.length) {
            const customOption = options.find(option => option.value === CUSTOM);
            if (customOption) customOption.selected = true;
            custom.value = customValues.join(', ');
        }
        sync();
    }

    picker.addEventListener('change', sync);
    custom.addEventListener('input', sync);

    search.addEventListener('input', () => {
        const query = search.value.trim().toLowerCase();
        Array.from(picker.options).forEach(option => {
            option.hidden = Boolean(query) && !option.textContent.toLowerCase().includes(query);
        });
    });

    const observer = new MutationObserver(() => {
        if (hidden.value) {
            restore();
            observer.disconnect();
        }
    });
    observer.observe(hidden, { attributes: true, attributeFilter: ['value'] });

    // Existing edit-mode code assigns cuisine through the hidden input's value property.
    // Restore once after profile data has had time to populate.
    setTimeout(restore, 800);
});
