import { elements } from './dom.js';
import { formatCurrency, calculatePriceAfterTax } from './utils.js';
import { OSRS_WIKI_IMG_BASE_URL } from './config.js';
import { getState } from './state.js';
import { getCachedImage, updateImageCache } from './imageCache.js';

let filteredItems = [];
let selectedIndex = -1;

// --- Loading Indicators ---
export function showTableLoading() {
    elements.tableLoadingOverlay.classList.add('show');
}

export function hideTableLoading() {
    elements.tableLoadingOverlay.classList.remove('show');
}

// --- Error Display ---
export function displayError(message, isEdit = false) {
    const errorEl = isEdit ? elements.editErrorMessage : elements.errorMessageP;
    errorEl.textContent = message;
    if (message) {
        errorEl.classList.add('active');
    } else {
        errorEl.classList.remove('active');
    }
}

// --- Rendering ---
export function renderItems(items, pricesData) {
    const { isReadOnlyMode } = getState();
    elements.itemListBody.innerHTML = '';

    if (!items.length) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.textContent = 'No items tracked yet. Add some!';
        td.colSpan = 8;
        td.classList.add('no-items-cell');
        tr.appendChild(td);
        elements.itemListBody.appendChild(tr);
        return;
    }

    items.forEach(item => {
        const tr = document.createElement('tr');
        tr.dataset.itemId = item.uniqueId;

        const currentPrice = getCurrentPrice(item.id, pricesData);
        const priceAfterTax = calculatePriceAfterTax(currentPrice);
        const iconSrc = getCachedImage(item.icon) || `${OSRS_WIKI_IMG_BASE_URL}${item.icon.replace(/ /g, '_')}`;

        tr.innerHTML = `
            <td data-label="Item">
                <div class="item-cell">
                    <div class="item-info">
                        <img src="${iconSrc}" alt="${item.name}" class="item-icon">
                        <span class="item-name">${item.name}</span>
                        <div class="item-actions">
                            <a href="https://prices.runescape.wiki/osrs/item/${item.id}" target="_blank" rel="noopener noreferrer" class="item-action-btn" title="View price data for ${item.name}">Price</a>
                            <a href="https://oldschool.runescape.wiki/w/Special:Lookup?type=item&id=${item.id}" target="_blank" rel="noopener noreferrer" class="item-action-btn" title="View ${item.name} on OSRS Wiki">Wiki</a>
                        </div>
                    </div>
                </div>
            </td>
            <td data-label="Purchase Price"><span class="currency">${formatCurrency(item.purchasePrice)}</span></td>
            <td data-label="Qty"><span class="currency">${item.quantity.toLocaleString()}</span></td>
            <td data-label="Investment"><span class="currency">${formatCurrency(item.purchasePrice * item.quantity)}</span></td>
            <td data-label="Price">${currentPrice !== null ? `<span class="currency">${formatCurrency(currentPrice)}</span>` : '<span class="text-muted">N/A</span>'}</td>
            <td data-label="Price - Tax">${priceAfterTax !== null ? `<span class="currency">${formatCurrency(priceAfterTax)}</span>` : '<span class="text-muted">N/A</span>'}</td>
            ${generateProfitLossCells(item, currentPrice)}
        `;

        if (!isReadOnlyMode) {
            tr.addEventListener('click', (event) => {
                if (event.target.closest('a.item-action-btn')) return;
                const openEditModalEvent = new CustomEvent('openEditModal', { detail: { itemId: item.uniqueId } });
                document.dispatchEvent(openEditModalEvent);
            });
        }
        elements.itemListBody.appendChild(tr);
    });

    // Trigger background caching for any images that weren't in the cache
    updateImageCache(items);
}

function generateProfitLossCells(item, currentPrice) {
    const totalInvestmentForItem = item.purchasePrice * item.quantity;
    if (currentPrice === null || totalInvestmentForItem === null) {
        return `<td data-label="Profit"><span class="neutral">N/A</span></td><td data-label="%"><span class="neutral">N/A</span></td>`;
    }

    const priceAfterTaxValue = calculatePriceAfterTax(currentPrice);
    if (priceAfterTaxValue === null) {
        return `<td data-label="Profit"><span class="neutral">N/A</span></td><td data-label="%"><span class="neutral">N/A</span></td>`;
    }

    const potentialSaleAfterTax = priceAfterTaxValue * item.quantity;
    const profitLoss = potentialSaleAfterTax - totalInvestmentForItem;
    const profitClass = profitLoss > 0 ? 'profit' : (profitLoss < 0 ? 'loss' : 'neutral');
    const profitLossCell = `<td data-label="Profit"><span class="${profitClass} currency">${formatCurrency(profitLoss)}</span></td>`;

    let profitPercentCell;
    if (totalInvestmentForItem !== 0) {
        const profitPercent = (profitLoss / totalInvestmentForItem) * 100;
        const percentClass = profitPercent > 0 ? 'profit' : (profitPercent < 0 ? 'loss' : 'neutral');
        let profitPercentDisplay = `${profitPercent >= 0 ? '+' : ''}${formatCurrency(profitPercent)}%`;
        if (profitPercent > 30) profitPercentDisplay += ' 🔥';
        else if (profitPercent <= -30) profitPercentDisplay += ' 💩';
        profitPercentCell = `<td data-label="%"><span class="${percentClass}">${profitPercentDisplay}</span></td>`;
    } else if (potentialSaleAfterTax > 0) {
        profitPercentCell = `<td data-label="%"><span class="profit">+∞% 🔥</span></td>`;
    } else {
        profitPercentCell = `<td data-label="%"><span class="neutral">N/A</span></td>`;
    }

    return profitLossCell + profitPercentCell;
}


export function updateStatistics(items, pricesData) {
    let totalInvestment = 0;
    let totalCurrentValue = 0;
    let totalProfitLoss = 0;

    items.forEach(item => {
        const investment = item.purchasePrice * item.quantity;
        totalInvestment += investment;
        const itemCurrentPrice = getCurrentPrice(item.id, pricesData);
        if (itemCurrentPrice !== null) {
            totalCurrentValue += itemCurrentPrice * item.quantity;
            const priceAfterTax = calculatePriceAfterTax(itemCurrentPrice);
            if (priceAfterTax !== null) {
                totalProfitLoss += (priceAfterTax * item.quantity) - investment;
            }
        } else {
            totalCurrentValue += investment;
        }
    });

    const profitPercent = totalInvestment !== 0 ? (totalProfitLoss / totalInvestment) * 100 : 0;
    let profitDisplay = formatCurrency(totalProfitLoss);
    if (profitPercent > 30) profitDisplay += ' 🔥';
    else if (profitPercent <= -30) profitDisplay += ' 💩';

    elements.totalItemsEl.textContent = items.length.toLocaleString();
    elements.totalInvestmentEl.textContent = formatCurrency(totalInvestment);
    elements.currentValueEl.textContent = formatCurrency(totalCurrentValue);
    elements.totalProfitLossEl.textContent = profitDisplay;

    elements.totalProfitLossContainer.className = 'stat-value';
    if (totalProfitLoss > 0) elements.totalProfitLossContainer.classList.add('profit');
    else if (totalProfitLoss < 0) elements.totalProfitLossContainer.classList.add('loss');

    if (totalInvestment !== 0) {
        let percentDisplay = `(${profitPercent >= 0 ? '+' : ''}${formatCurrency(profitPercent)}%)`;
        elements.totalProfitLossPercentEl.textContent = percentDisplay;
        elements.totalProfitLossPercentEl.className = 'profit-loss-percent-stat';
        if (profitPercent > 0) elements.totalProfitLossPercentEl.classList.add('profit');
        else if (profitPercent < 0) elements.totalProfitLossPercentEl.classList.add('loss');
    } else {
        elements.totalProfitLossPercentEl.textContent = '';
        elements.totalProfitLossPercentEl.className = 'profit-loss-percent-stat';
    }

    elements.summaryItemsEl.textContent = items.length.toLocaleString();
    elements.summaryPlEl.textContent = profitDisplay;
    elements.summaryPlEl.className = 'summary-pl';
    if (totalProfitLoss > 0) elements.summaryPlEl.classList.add('profit');
    else if (totalProfitLoss < 0) elements.summaryPlEl.classList.add('loss');
}


// --- Modals ---
export function openAddItemModal() {
    displayError('');
    elements.addItemModal.style.display = 'flex';
    elements.itemNameInput.value = '';
    elements.purchasePriceInput.value = '';
    elements.quantityInput.value = '1';
    elements.itemNameInput.focus();
}

export function closeAddItemModal() {
    elements.addItemModal.style.display = 'none';
}

export function openEditModal(item) {
    elements.editModalItemNameDisplay.textContent = item.name;
    elements.editPurchasePriceInput.value = formatCurrency(item.purchasePrice);
    elements.editQuantityInput.value = formatCurrency(item.quantity);
    
    elements.editModalIconContainer.innerHTML = '';
    if (item.icon) {
        const iconImg = document.createElement('img');
        const iconSrc = getCachedImage(item.icon) || `${OSRS_WIKI_IMG_BASE_URL}${item.icon.replace(/ /g, '_')}`;
        iconImg.src = iconSrc;
        iconImg.alt = item.name;
        iconImg.classList.add('modal-item-icon');
        elements.editModalIconContainer.appendChild(iconImg);
        // Trigger caching for this single item
        updateImageCache([item]);
    }
    
    displayError('', true);
    elements.editItemModal.style.display = 'flex';
    elements.editPurchasePriceInput.focus();
}

export function closeEditModal() {
    elements.editItemModal.style.display = 'none';
}

// --- Dropdown ---
export function showDropdown(items) {
    filteredItems = items;
    elements.itemDropdown.innerHTML = '';
    if (items.length === 0) {
        elements.itemDropdown.classList.remove('show');
        return;
    }
    items.forEach(item => {
        const div = document.createElement('div');
        div.classList.add('dropdown-item');
        const iconSrc = getCachedImage(item.icon) || `${OSRS_WIKI_IMG_BASE_URL}${item.icon.replace(/ /g, '_')}`;
        div.innerHTML = `
            ${item.icon ? `<img src="${iconSrc}" alt="${item.name}" class="dropdown-item-icon">` : ''}
            <span>${item.name}</span>
        `;
        div.addEventListener('click', () => {
            const event = new CustomEvent('dropdownItemSelected', { detail: { item } });
            document.dispatchEvent(event);
        });
        elements.itemDropdown.appendChild(div);
    });
    elements.itemDropdown.classList.add('show');
    selectedIndex = -1;

    // Trigger background caching for dropdown items
    updateImageCache(items);
}

export function hideDropdown() {
    elements.itemDropdown.classList.remove('show');
    selectedIndex = -1;
}

export function highlightDropdownItem(index) {
    const items = elements.itemDropdown.querySelectorAll('.dropdown-item');
    items.forEach((item, i) => {
        item.classList.toggle('highlighted', i === index);
    });
}

export function handleDropdownKeyDown(key) {
    const items = elements.itemDropdown.querySelectorAll('.dropdown-item');
    switch (key) {
        case 'ArrowDown':
            selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
            highlightDropdownItem(selectedIndex);
            return null;
        case 'ArrowUp':
            selectedIndex = Math.max(selectedIndex - 1, -1);
            highlightDropdownItem(selectedIndex);
            return null;
        case 'Enter':
            if (selectedIndex >= 0 && filteredItems[selectedIndex]) {
                const item = filteredItems[selectedIndex];
                const event = new CustomEvent('dropdownItemSelected', { detail: { item } });
                document.dispatchEvent(event);
                return item;
            }
            return null;
        case 'Escape':
            hideDropdown();
            return null;
        default:
            return null;
    }
}

// --- Sorting ---
export function updateSortIndicators(column, direction) {
    elements.sortableHeaders.forEach(th => {
        th.classList.remove('sort-asc', 'sort-desc');
    });
    const currentTh = document.querySelector(`[data-sort="${column}"]`);
    if (currentTh) {
        currentTh.classList.add(direction === 'asc' ? 'sort-asc' : 'sort-desc');
    }
}

// --- Read-only Mode ---
export function enterReadOnlyMode() {
    elements.appMain.classList.add('read-only-active');
    if (elements.showAddItemModalBtn) elements.showAddItemModalBtn.style.display = 'none';
    if (elements.importBtn) elements.importBtn.style.display = 'none';
    if (elements.deleteAllBtn) elements.deleteAllBtn.style.display = 'none';
    if (elements.shareBtn) elements.shareBtn.style.display = 'none';

    const readOnlyBanner = document.createElement('div');
    readOnlyBanner.style.cssText = `
        text-align: center; 
        padding: var(--spacing-sm); 
        background: var(--accent-primary); 
        color: white; 
        font-weight: bold; 
        border-radius: var(--radius-md); 
        margin: var(--spacing-md) 0;`;
    
    readOnlyBanner.innerHTML = `
        <span>Viewing a shared portfolio (Read-Only). </span>
        <a href="${window.location.origin + window.location.pathname}" style="color: white; text-decoration: underline;">View your portfolio</a>`;
    
    elements.appMain.insertBefore(readOnlyBanner, elements.appMain.firstChild);

    const bannerStyle = getComputedStyle(readOnlyBanner);
    const bannerHeight = readOnlyBanner.offsetHeight + parseInt(bannerStyle.marginTop) + parseInt(bannerStyle.marginBottom);
    elements.appMain.style.setProperty('--banner-height-adjustment', `${bannerHeight}px`);
}

// --- Helpers ---
function getCurrentPrice(itemId, pricesData) {
    if (!pricesData || !pricesData[itemId]) return null;
    const { high, low } = pricesData[itemId];
    if (high !== null && low !== null) return Math.round((high + low) / 2);
    return high !== null ? high : low;
}

export function filterTableRowsVisual(items) {
    const allRows = Array.from(elements.itemListBody.querySelectorAll('tr[data-item-id]'));
    
    allRows.forEach(row => {
        const uniqueId = row.dataset.itemId;
        const shouldShow = items.some(item => item.uniqueId === uniqueId);
        row.style.display = shouldShow ? '' : 'none';
    });

    const visibleRows = allRows.filter(row => row.style.display !== 'none');
    const noResultsRow = elements.itemListBody.querySelector('.search-no-results');
    if (noResultsRow) noResultsRow.remove();

    if (visibleRows.length === 0) {
        const { searchQuery } = getState();
        const tr = document.createElement('tr');
        tr.className = 'search-no-results';
        tr.innerHTML = `<td colspan="8" class="no-items-cell">${searchQuery.trim() ? `No items found matching "${searchQuery.trim()}"` : 'No items tracked yet. Add some!'}</td>`;
        elements.itemListBody.appendChild(tr);
    }
}

export async function handleSelectItem(item) {
    elements.itemNameInput.value = item.name;
    hideDropdown();

    const originalPlaceholder = elements.purchasePriceInput.placeholder;
    elements.purchasePriceInput.placeholder = 'Fetching price...';
    elements.purchasePriceInput.value = '';
    elements.purchasePriceInput.disabled = true;

    try {
        const { cachedLatestPrices } = getState();
        const price = getCurrentPrice(item.id, cachedLatestPrices);
        elements.purchasePriceInput.value = formatCurrency(price);
    } catch (error) {
        elements.purchasePriceInput.value = '0';
    } finally {
        elements.purchasePriceInput.placeholder = originalPlaceholder;
        elements.purchasePriceInput.disabled = false;
        elements.purchasePriceInput.focus();
    }
} 