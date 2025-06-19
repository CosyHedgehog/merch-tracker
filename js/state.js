import { calculatePriceAfterTax } from './utils.js';

let state = {
    trackedItems: [],
    itemMapping: null,
    editingItemId: null,
    currentSort: { column: 'profitLoss', direction: 'desc' },
    searchQuery: '',
    cachedLatestPrices: null,
    isReadOnlyMode: false,
};

export function getState() {
    return state;
}

export function setItemMapping(mapping) {
    state.itemMapping = mapping;
}

export function setTrackedItems(items) {
    state.trackedItems = items;
    saveItems();
}

export function setReadOnlyMode(isReadOnly) {
    state.isReadOnlyMode = isReadOnly;
}

export function setEditingItemId(id) {
    state.editingItemId = id;
}

export function setSearchQuery(query) {
    state.searchQuery = query;
}

export function setSort(column, direction) {
    state.currentSort = { column, direction };
}

export function setCachedPrices(prices) {
    state.cachedLatestPrices = prices;
}

export function loadItems() {
    state.trackedItems = JSON.parse(localStorage.getItem('osrsMerchItems')) || [];
}

export function saveItems() {
    if (state.isReadOnlyMode) return;
    localStorage.setItem('osrsMerchItems', JSON.stringify(state.trackedItems));
}

export function addItem(item) {
    state.trackedItems.push(item);
    saveItems();
}

export function removeItem(uniqueId) {
    state.trackedItems = state.trackedItems.filter(item => item.uniqueId !== uniqueId);
    saveItems();
}

export function updateItem(uniqueId, purchasePrice, quantity) {
    const itemIndex = state.trackedItems.findIndex(item => item.uniqueId === uniqueId);
    if (itemIndex > -1) {
        state.trackedItems[itemIndex].purchasePrice = purchasePrice;
        state.trackedItems[itemIndex].quantity = quantity;
        saveItems();
    }
}

export function clearAllItems() {
    state.trackedItems = [];
    saveItems();
}

export function getItem(uniqueId) {
    return state.trackedItems.find(item => item.uniqueId === uniqueId);
}

export function getFilteredItems() {
    if (!state.searchQuery.trim()) {
        return state.trackedItems;
    }
    const query = state.searchQuery.toLowerCase().trim();
    return state.trackedItems.filter(item =>
        item.name.toLowerCase().includes(query)
    );
}

export function findItemInMapping(name) {
    if (!state.itemMapping) return null;
    return state.itemMapping[name.toLowerCase()];
}

function getCurrentPrice(itemId, pricesData) {
    if (!pricesData || !pricesData[itemId]) return null;
    const { high, low } = pricesData[itemId];
    if (high !== null && low !== null) return Math.round((high + low) / 2);
    return high !== null ? high : low;
}

export function sortTrackedItems() {
    const { trackedItems, currentSort, cachedLatestPrices } = getState();
    const { column, direction } = currentSort;

    trackedItems.sort((a, b) => {
        let aValue, bValue;

        if (['currentPrice', 'priceAfterTax', 'profitLoss', 'profitLossPercent'].includes(column)) {
            const aCurrentPrice = getCurrentPrice(a.id, cachedLatestPrices);
            const bCurrentPrice = getCurrentPrice(b.id, cachedLatestPrices);

            switch (column) {
                case 'currentPrice':
                    aValue = aCurrentPrice ?? -1;
                    bValue = bCurrentPrice ?? -1;
                    break;
                case 'priceAfterTax':
                    aValue = calculatePriceAfterTax(aCurrentPrice) ?? -1;
                    bValue = calculatePriceAfterTax(bCurrentPrice) ?? -1;
                    break;
                case 'profitLoss':
                    const aProfit = aCurrentPrice !== null ? (calculatePriceAfterTax(aCurrentPrice) * a.quantity) - (a.purchasePrice * a.quantity) : -Infinity;
                    const bProfit = bCurrentPrice !== null ? (calculatePriceAfterTax(bCurrentPrice) * b.quantity) - (b.purchasePrice * b.quantity) : -Infinity;
                    aValue = aProfit;
                    bValue = bProfit;
                    break;
                case 'profitLossPercent':
                    const aInvestment = a.purchasePrice * a.quantity;
                    const bInvestment = b.purchasePrice * b.quantity;
                    const aProfitPercent = aInvestment !== 0 && aCurrentPrice !== null ? ((calculatePriceAfterTax(aCurrentPrice) * a.quantity) - aInvestment) / aInvestment : -Infinity;
                    const bProfitPercent = bInvestment !== 0 && bCurrentPrice !== null ? ((calculatePriceAfterTax(bCurrentPrice) * b.quantity) - bInvestment) / bInvestment : -Infinity;
                    aValue = aProfitPercent;
                    bValue = bProfitPercent;
                    break;
            }
        } else {
            switch (column) {
                case 'name':
                    aValue = a.name.toLowerCase();
                    bValue = b.name.toLowerCase();
                    break;
                case 'purchasePrice':
                    aValue = a.purchasePrice;
                    bValue = b.purchasePrice;
                    break;
                case 'quantity':
                    aValue = a.quantity;
                    bValue = b.quantity;
                    break;
                case 'investment':
                    aValue = a.purchasePrice * a.quantity;
                    bValue = b.purchasePrice * b.quantity;
                    break;
                default:
                    return 0;
            }
        }

        if (aValue === bValue) return 0;

        if (typeof aValue === 'string') {
            return direction === 'asc'
                ? aValue.localeCompare(bValue)
                : bValue.localeCompare(aValue);
        } else {
            return direction === 'asc'
                ? aValue - bValue
                : bValue - aValue;
        }
    });
} 