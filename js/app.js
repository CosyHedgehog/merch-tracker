import { elements } from './dom.js';
import * as api from './api.js';
import * as state from './state.js';
import * as ui from './ui.js';
import { formatCurrency, calculatePriceAfterTax, parseCSV, isValidImportedItem } from './utils.js';

let searchDebounceTimer = null;

async function refreshTable(showLoading = true, forceFetch = false) {
    if (showLoading) ui.showTableLoading();
    
    if (forceFetch || !state.getState().cachedLatestPrices) {
        try {
            const prices = await api.getLatestPrices();
            state.setCachedPrices(prices);
        } catch (error) {
            ui.displayError('Could not fetch latest prices. Data may be inaccurate.');
            state.setCachedPrices(null); // Clear stale prices
        }
    }

    state.sortTrackedItems(); // Sort before rendering

    const { trackedItems, cachedLatestPrices } = state.getState();
    ui.renderItems(trackedItems, cachedLatestPrices);
    
    // Re-apply visual search filter after table is rendered
    const filteredItems = state.getFilteredItems();
    ui.filterTableRowsVisual(filteredItems);
    ui.updateStatistics(filteredItems, cachedLatestPrices);
    
    if (showLoading) {
        ui.animateStatistics();
        await new Promise(resolve => setTimeout(resolve, 500)); // Prevent loading flicker
        ui.hideTableLoading();
    }
}

async function sortAndRerender(column) {
    const { currentSort } = state.getState();
    let direction = 'asc';
    if (currentSort.column === column) {
        direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
    }
    state.setSort(column, direction);
    
    state.sortTrackedItems();
    
    const { trackedItems, cachedLatestPrices } = state.getState();
    ui.renderItems(trackedItems, cachedLatestPrices);
    ui.updateSortIndicators(column, direction);

    // Re-apply search filter after sorting to maintain view
    const filteredItems = state.getFilteredItems();
    ui.filterTableRowsVisual(filteredItems);
    ui.updateStatistics(filteredItems, cachedLatestPrices);
}

function handleAddItem() {
    ui.displayError('');
    const name = elements.itemNameInput.value.trim();
    const purchasePrice = parseFloat(elements.purchasePriceInput.value.replace(/,/g, ''));
    const quantity = parseInt(elements.quantityInput.value.replace(/,/g, ''), 10);

    if (!name || isNaN(purchasePrice) || purchasePrice <= 0 || isNaN(quantity) || quantity <= 0) {
        ui.displayError('Please enter a valid item name, purchase price, and quantity.');
        return;
    }

    const itemDetails = state.findItemInMapping(name);
    if (!itemDetails) {
        ui.displayError(`Item "${name}" not found. Check spelling.`);
        return;
    }

    const newItem = {
        uniqueId: Date.now().toString(),
        id: itemDetails.id,
        name: itemDetails.name,
        purchasePrice: purchasePrice,
        quantity: quantity,
        icon: itemDetails.icon
    };

    state.addItem(newItem);
    refreshTable(false);
    ui.closeAddItemModal();
}

function handleSaveItem() {
    const { editingItemId } = state.getState();
    if (!editingItemId) return;

    const purchasePrice = parseFloat(elements.editPurchasePriceInput.value.replace(/,/g, ''));
    const quantity = parseInt(elements.editQuantityInput.value.replace(/,/g, ''), 10);

    if (isNaN(purchasePrice) || purchasePrice <= 0 || isNaN(quantity) || quantity <= 0) {
        ui.displayError('Please enter valid purchase price and quantity.', true);
        return;
    }

    state.updateItem(editingItemId, purchasePrice, quantity);
    refreshTable(false);
    ui.closeEditModal();
}

function handleSearch() {
    state.setSearchQuery(elements.portfolioSearchInput.value);
    const filtered = state.getFilteredItems();
    ui.filterTableRowsVisual(filtered);
    elements.clearSearchBtn.style.display = state.getState().searchQuery ? 'block' : 'none';

    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
        ui.updateStatistics(filtered, state.getState().cachedLatestPrices);
    }, 300);
}

function clearSearch() {
    elements.portfolioSearchInput.value = '';
    handleSearch();
    elements.portfolioSearchInput.focus();
}

function handleExport() {
    const items = state.getState().trackedItems;
    if (!items.length) {
        alert('No items to export!');
        return;
    }

    const csvContent = [
        ['Item Name', 'Purchase Price', 'Quantity', 'Total Investment'],
        ...items.map(item => [
            item.name,
            item.purchasePrice,
            item.quantity,
            item.purchasePrice * item.quantity
        ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `osrs-portfolio-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}

function handleDeleteAll() {
    if (confirm("Are you sure you want to delete all items? This action cannot be undone.")) {
        state.clearAllItems();
        refreshTable(false);
        ui.displayError("All items have been deleted.");
    }
}

function handleShare() {
    const items = state.getState().trackedItems;
    if (!items.length) {
        alert("Your portfolio is empty. Add some items to share!");
        return;
    }

    const itemsToShare = items.map(item => ({
        i: item.id,
        p: item.purchasePrice,
        q: item.quantity
    }));

    const data = JSON.stringify(itemsToShare);
    const encodedData = btoa(data);
    const shareLink = `${window.location.origin}${window.location.pathname}?shared=${encodedData}`;

    navigator.clipboard.writeText(shareLink).then(() => {
        alert("Shareable link copied to clipboard!");
    }).catch(err => {
        console.error('Failed to copy link: ', err);
        prompt("Could not copy link. Manually copy this:", shareLink);
    });
}

async function handleFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (file.type !== "text/csv") {
        ui.displayError("Please select a valid CSV file.");
        return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
        const csvContent = e.target.result;
        try {
            const parsedData = parseCSV(csvContent);
            let newItemsCount = 0;
            let skippedCount = 0;

            for (const csvRow of parsedData) {
                if (!isValidImportedItem(csvRow)) {
                    skippedCount++;
                    continue;
                }
                
                const itemDetails = state.findItemInMapping(csvRow['Item Name']);
                if (!itemDetails) {
                    skippedCount++;
                    continue;
                }

                const newItem = {
                    uniqueId: Date.now().toString() + Math.random(),
                    id: itemDetails.id,
                    name: itemDetails.name,
                    purchasePrice: parseFloat(csvRow['Purchase Price'].replace(/,/g, '')),
                    quantity: parseInt(csvRow['Quantity'].replace(/,/g, ''), 10),
                    icon: itemDetails.icon
                };

                const existingItem = state.getState().trackedItems.find(i => i.id === newItem.id && i.purchasePrice === newItem.purchasePrice);
                if (existingItem) {
                    skippedCount++;
                    continue;
                }
                
                state.addItem(newItem);
                newItemsCount++;
            }
            
            await refreshTable(false);

            if (newItemsCount > 0) {
                ui.displayError(`Successfully imported ${newItemsCount} new item(s). ${skippedCount} skipped.`);
            } else {
                ui.displayError(`No new items imported. ${skippedCount} skipped.`);
            }

        } catch (error) {
            ui.displayError(`Error importing data: ${error.message}`);
        } finally {
            event.target.value = ''; // Reset file input
        }
    };
    reader.onerror = () => {
        ui.displayError("Error reading the file.");
        event.target.value = '';
    };
    reader.readAsText(file);
}

function setupEventListeners() {
    elements.showAddItemModalBtn.addEventListener('click', ui.openAddItemModal);
    elements.addCloseModalBtn.addEventListener('click', ui.closeAddItemModal);
    elements.editCloseModalBtn.addEventListener('click', ui.closeEditModal);
    elements.addItemBtn.addEventListener('click', handleAddItem);
    elements.saveItemBtn.addEventListener('click', handleSaveItem);
    elements.refreshPricesBtn.addEventListener('click', () => refreshTable(true, true));
    elements.portfolioSearchInput.addEventListener('input', handleSearch);
    elements.clearSearchBtn.addEventListener('click', clearSearch);
    elements.exportBtn.addEventListener('click', handleExport);
    elements.deleteAllBtn.addEventListener('click', handleDeleteAll);
    elements.shareBtn.addEventListener('click', handleShare);
    elements.importBtn.addEventListener('click', () => elements.importFileInput.click());
    elements.importFileInput.addEventListener('change', handleFileImport);

    elements.itemListBody.addEventListener('click', e => {
        if (e.target.classList.contains('delete-btn')) {
            const { itemId, itemName } = e.target.dataset;
            if (confirm(`Are you sure you want to delete "${itemName}"?`)) {
                state.removeItem(itemId);
                refreshTable(false);
            }
        }
    });

    elements.itemNameInput.addEventListener('input', e => {
        const query = e.target.value.toLowerCase();
        if (query.length > 0) {
            const { itemMapping } = state.getState();
            const filtered = Object.values(itemMapping)
                .filter(item => item.name.toLowerCase().includes(query))
                .slice(0, 10);
            ui.showDropdown(filtered);
        } else {
            ui.hideDropdown();
        }
    });
    
    elements.itemNameInput.addEventListener('keydown', e => {
        const selectedItem = ui.handleDropdownKeyDown(e.key);
        if (e.key === 'Enter') {
            if (selectedItem) {
                // If an item is selected from dropdown, prevent form submission
                e.preventDefault();
            } else {
                // Otherwise, treat as form submission
                e.preventDefault();
                handleAddItem();
            }
        }
    });

    // Listen for Enter on other inputs in the Add Item modal
    [elements.purchasePriceInput, elements.quantityInput].forEach(input => {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleAddItem();
            }
        });
    });

    elements.sortableHeaders.forEach(th => {
        th.addEventListener('click', () => sortAndRerender(th.dataset.sort));
    });
    
    // Custom event listeners
    document.addEventListener('openEditModal', e => {
        const { itemId } = e.detail;
        const item = state.getItem(itemId);
        if (item) {
            state.setEditingItemId(itemId);
            ui.openEditModal(item);
        }
    });

    document.addEventListener('dropdownItemSelected', e => {
        ui.handleSelectItem(e.detail.item);
    });

    // Close dropdowns on outside click
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.custom-dropdown')) {
            ui.hideDropdown();
        }
    });

    // Submit on Enter in Edit Item modal
    [elements.editPurchasePriceInput, elements.editQuantityInput].forEach(input => {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleSaveItem();
            }
        });
    });
}

async function loadFromShareableLink(encodedData) {
    try {
        const decodedData = atob(encodedData);
        const sharedItemsData = JSON.parse(decodedData);

        if (!Array.isArray(sharedItemsData)) throw new Error("Invalid data format.");

        const { itemMapping } = state.getState();
        if (!itemMapping) {
            ui.displayError("Failed to load item mapping for shared portfolio.");
            return;
        }

        const itemsFromLink = sharedItemsData.map(sharedItem => {
            const fullItemDetails = Object.values(itemMapping).find(mapItem => mapItem.id === sharedItem.i);
            if (!fullItemDetails) return null;
            return {
                uniqueId: `shared-${fullItemDetails.id}-${Math.random()}`,
                id: fullItemDetails.id,
                name: fullItemDetails.name,
                purchasePrice: sharedItem.p,
                quantity: sharedItem.q,
                icon: fullItemDetails.icon,
            };
        }).filter(Boolean); // Filter out any nulls if item not found

        state.setReadOnlyMode(true);
        state.setTrackedItems(itemsFromLink);
        ui.enterReadOnlyMode();

    } catch (error) {
        console.error("Error loading from shareable link:", error);
        alert("Could not load the shared portfolio. The link may be invalid.");
        state.loadItems(); // Fallback to local data
    }
}

async function init() {
    ui.showTableLoading();
    try {
        const mapping = await api.getItemMapping();
        state.setItemMapping(mapping);
    } catch (error) {
        ui.displayError('Failed to load item data. Please refresh the page.');
        ui.hideTableLoading();
        return;
    }
    
    const urlParams = new URLSearchParams(window.location.search);
    const sharedData = urlParams.get('shared');

    if (sharedData) {
        await loadFromShareableLink(sharedData);
    } else {
        state.loadItems();
    }

    await refreshTable(true, true);
    ui.updateSortIndicators(state.getState().currentSort.column, state.getState().currentSort.direction);
    setupEventListeners();
}

document.addEventListener('DOMContentLoaded', init); 