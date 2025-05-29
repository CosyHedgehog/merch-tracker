document.addEventListener('DOMContentLoaded', () => {
    const itemNameInput = document.getElementById('item-name');
    const itemDropdown = document.getElementById('item-dropdown');
    const purchasePriceInput = document.getElementById('purchase-price');
    const quantityInput = document.getElementById('quantity');
    const addItemBtn = document.getElementById('add-item-btn');
    const itemListBody = document.getElementById('item-list-body');
    const refreshPricesBtn = document.getElementById('refresh-prices-btn');
    const errorMessageP = document.getElementById('error-message');

    // Modal elements
    const addItemModal = document.getElementById('add-item-modal');
    const editItemModal = document.getElementById('edit-item-modal');
    const showAddItemModalBtn = document.getElementById('show-add-item-modal-btn');
    const addCloseModalBtn = addItemModal.querySelector('.close-btn');
    const editCloseModalBtn = editItemModal.querySelector('.close-btn');
    const exportBtn = document.getElementById('export-btn');
    const saveItemBtn = document.getElementById('save-item-btn');
    const deleteItemBtn = document.getElementById('delete-item-btn');

    // Statistics elements
    const totalItemsEl = document.getElementById('total-items');
    const totalInvestmentEl = document.getElementById('total-investment');
    const currentValueEl = document.getElementById('current-value');
    const totalProfitLossEl = document.getElementById('total-profit-loss');
    const totalProfitLossPercentEl = document.getElementById('total-profit-loss-percent');
    const tableLoadingOverlay = document.getElementById('table-loading-overlay');
    
    // Stats toggle elements
    const statsToggle = document.getElementById('stats-toggle');
    const statsContainer = document.getElementById('stats-container');
    const summaryItemsEl = document.getElementById('summary-items');
    const summaryPlEl = document.getElementById('summary-pl');
    
    // Portfolio search elements
    const portfolioSearchInput = document.getElementById('portfolio-search');
    const clearSearchBtn = document.getElementById('clear-search');

    // Import elements
    const importBtn = document.getElementById('import-btn');
    const importFileInput = document.getElementById('import-file-input');

    // Delete All element
    const deleteAllBtn = document.getElementById('delete-all-btn');

    // Actions Dropdown elements
    const actionsDropdownBtn = document.getElementById('actions-dropdown-btn');
    const actionsDropdownContent = document.getElementById('actions-dropdown-content');

    // Shareable Link element
    const shareBtn = document.getElementById('share-btn');

    const OSRS_API_BASE_URL = 'https://prices.runescape.wiki/api/v1/osrs';
    const OSRS_WIKI_IMG_BASE_URL = 'https://oldschool.runescape.wiki/images/';
    const USER_AGENT = 'merch_tracker_app - YOUR_DISCORD_OR_EMAIL'; // PLEASE REPLACE WITH ACTUAL CONTACT

    // Helper function to format currency
    function formatCurrency(value) {
        if (typeof value !== 'number' || isNaN(value)) return '0'; // Return '0' or 'N/A' for non-numbers
        // Use toLocaleString for consistent number formatting
        return value.toLocaleString('en-US', { 
            minimumFractionDigits: 0, 
            maximumFractionDigits: 0 
        });
    }

    let trackedItems = JSON.parse(localStorage.getItem('osrsMerchItems')) || [];
    let itemMapping = null;
    let editingItemId = null;
    let currentSort = { column: null, direction: 'asc' };
    let searchQuery = '';
    let cachedLatestPrices = null; // Added to cache API responses
    let searchDebounceTimer = null; // For debouncing search statistics update
    let isReadOnlyMode = false; // Flag for read-only mode from shared link

    // Helper function to calculate price after tax with a cap
    function calculatePriceAfterTax(currentPrice) {
        if (currentPrice === null || typeof currentPrice !== 'number' || isNaN(currentPrice)) {
            return null;
        }
        const taxAmount = currentPrice * 0.02;
        const cappedTaxAmount = Math.min(taxAmount, 5000000);
        return Math.round(currentPrice - cappedTaxAmount);
    }

    async function fetchAPI(endpoint) {
        try {
            const response = await fetch(`${OSRS_API_BASE_URL}/${endpoint}`,
            {
                headers: {
                    'User-Agent': USER_AGENT
                }
            });
            if (!response.ok) {
                throw new Error(`API request failed: ${response.status} ${response.statusText}`);
            }
            return await response.json();
        } catch (error) {
            console.error('Error fetching from API:', error);
            errorMessageP.textContent = `Failed to fetch data: ${error.message}. Please check console.`;
            return null;
        }
    }

    function displayError(message) {
        errorMessageP.textContent = message;
        if (message) {
            errorMessageP.classList.add('active');
        } else {
            errorMessageP.classList.remove('active');
        }
    }

    function showTableLoading() {
        tableLoadingOverlay.classList.add('show');
    }

    function hideTableLoading() {
        tableLoadingOverlay.classList.remove('show');
    }

    function sortItems(column, direction = 'asc') {
        trackedItems.sort((a, b) => {
            let aValue, bValue;
            
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
                case 'currentPrice':
                    aValue = 0;
                    bValue = 0;
                    break;
                case 'priceAfterTax':
                    aValue = 0;
                    bValue = 0;
                    break;
                case 'profitLoss':
                    aValue = 0;
                    bValue = 0;
                    break;
                case 'profitLossPercent':
                    aValue = 0;
                    bValue = 0;
                    break;
                default:
                    return 0;
            }
            
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

    async function sortItemsWithPriceData(column, direction = 'asc', pricesData = null) {
        if (column !== 'currentPrice' && column !== 'profitLoss' && column !== 'profitLossPercent' && column !== 'priceAfterTax') {
            sortItems(column, direction);
            return;
        }

        // Use provided data, then cached data, then fetch as a last resort
        let dataToUse = pricesData;
        if (!dataToUse) {
            dataToUse = cachedLatestPrices;
        }
        if (!dataToUse) {
            dataToUse = await fetchAPI('latest');
            if (dataToUse) cachedLatestPrices = dataToUse; // Cache if fetched
        }
        
        const latestPricesData = dataToUse;
        
        trackedItems.sort((a, b) => {
            let aValue = 0, bValue = 0;
            
            if (latestPricesData && latestPricesData.data) {
                if (column === 'currentPrice') {
                    aValue = getCurrentPrice(a.id, latestPricesData.data) || 0;
                    bValue = getCurrentPrice(b.id, latestPricesData.data) || 0;
                } else if (column === 'priceAfterTax') {
                    const aCurrentPrice = getCurrentPrice(a.id, latestPricesData.data);
                    const bCurrentPrice = getCurrentPrice(b.id, latestPricesData.data);
                    aValue = calculatePriceAfterTax(aCurrentPrice) !== null ? calculatePriceAfterTax(aCurrentPrice) : 0;
                    bValue = calculatePriceAfterTax(bCurrentPrice) !== null ? calculatePriceAfterTax(bCurrentPrice) : 0;
                } else if (column === 'profitLoss') {
                    const aCurrentPrice = getCurrentPrice(a.id, latestPricesData.data);
                    const bCurrentPrice = getCurrentPrice(b.id, latestPricesData.data);
                    
                    if (aCurrentPrice !== null) {
                        const aPriceAfterTax = calculatePriceAfterTax(aCurrentPrice);
                        if (aPriceAfterTax !== null) {
                            const aInvestment = a.purchasePrice * a.quantity;
                            const aCurrentValueAfterTax = aPriceAfterTax * a.quantity;
                            aValue = aCurrentValueAfterTax - aInvestment;
                        }
                    }
                    
                    if (bCurrentPrice !== null) {
                        const bPriceAfterTax = calculatePriceAfterTax(bCurrentPrice);
                        if (bPriceAfterTax !== null) {
                            const bInvestment = b.purchasePrice * b.quantity;
                            const bCurrentValueAfterTax = bPriceAfterTax * b.quantity;
                            bValue = bCurrentValueAfterTax - bInvestment;
                        }
                    }
                } else if (column === 'profitLossPercent') {
                    const aCurrentPrice = getCurrentPrice(a.id, latestPricesData.data);
                    const bCurrentPrice = getCurrentPrice(b.id, latestPricesData.data);

                    if (aCurrentPrice !== null) {
                        const aPriceAfterTax = calculatePriceAfterTax(aCurrentPrice);
                        if (aPriceAfterTax !== null) {
                            const aInvestment = a.purchasePrice * a.quantity;
                            if (aInvestment !== 0) {
                                const aCurrentValueAfterTax = aPriceAfterTax * a.quantity;
                                aValue = ((aCurrentValueAfterTax - aInvestment) / aInvestment) * 100;
                            } else {
                                aValue = 0; // Or handle as needed for zero investment
                            }
                        }
                    }

                    if (bCurrentPrice !== null) {
                        const bPriceAfterTax = calculatePriceAfterTax(bCurrentPrice);
                        if (bPriceAfterTax !== null) {
                            const bInvestment = b.purchasePrice * b.quantity;
                            if (bInvestment !== 0) {
                                const bCurrentValueAfterTax = bPriceAfterTax * b.quantity;
                                bValue = ((bCurrentValueAfterTax - bInvestment) / bInvestment) * 100;
                            } else {
                                bValue = 0; // Or handle as needed for zero investment
                            }
                        }
                    }
                }
            }
            
            return direction === 'asc' ? aValue - bValue : bValue - aValue;
        });

        if (latestPricesData && !cachedLatestPrices) { // Only cache if not already cached or provided
            // This condition might be tricky. updateStatistics can be called with fresh or old data.
            // Let's assume for now renderItems is the primary source for caching.
        }
    }

    function getCurrentPrice(itemId, pricesData) {
        if (!pricesData[itemId]) return null;
        
        const priceInfo = pricesData[itemId];
        const currentPriceHigh = priceInfo.high;
        const currentPriceLow = priceInfo.low;

        if (currentPriceHigh !== null && currentPriceLow !== null) {
            return Math.round((currentPriceHigh + currentPriceLow) / 2);
        } else if (currentPriceHigh !== null) {
            return currentPriceHigh;
        } else if (currentPriceLow !== null) {
            return currentPriceLow;
        }
        
        return null;
    }

    function updateSortIndicators(column, direction) {
        // Remove existing sort classes
        document.querySelectorAll('.sortable').forEach(th => {
            th.classList.remove('sort-asc', 'sort-desc');
        });
        
        // Add sort class to current column
        const currentTh = document.querySelector(`[data-sort="${column}"]`);
        if (currentTh) {
            currentTh.classList.add(direction === 'asc' ? 'sort-asc' : 'sort-desc');
        }
    }

    function getFilteredItems() {
        if (!searchQuery.trim()) {
            return trackedItems;
        }
        
        const query = searchQuery.toLowerCase().trim();
        return trackedItems.filter(item => 
            item.name.toLowerCase().includes(query)
        );
    }

    function filterTableRowsVisual() {
        const filteredItems = getFilteredItems();
        const tbody = itemListBody;
        const allRows = Array.from(tbody.querySelectorAll('tr[data-item-id]'));
        
        // Show/hide rows based on search
        allRows.forEach(row => {
            const uniqueId = row.dataset.itemId;
            const shouldShow = filteredItems.some(item => item.uniqueId === uniqueId);
            row.style.display = shouldShow ? '' : 'none';
        });
        
        // Update "no items" message for search results
        const visibleRows = allRows.filter(row => row.style.display !== 'none');
        const noItemsRow = tbody.querySelector('.no-items-cell');
        
        if (visibleRows.length === 0 && !noItemsRow) {
            // Create "no results" message
            const tr = document.createElement('tr');
            tr.classList.add('search-no-results');
            const td = document.createElement('td');
            td.textContent = searchQuery.trim() ? `No items found matching "${searchQuery.trim()}"` : 'No items tracked yet. Add some!';
            td.colSpan = 8;
            td.classList.add('no-items-cell');
            tr.appendChild(td);
            tbody.appendChild(tr);
        } else if (visibleRows.length > 0) {
            // Remove "no results" message if items are visible
            const noResultsRow = tbody.querySelector('.search-no-results');
            if (noResultsRow) {
                noResultsRow.remove();
            }
        }
    }

    function updateSearchStatistics(itemsToStat) {
        if (searchQuery.trim()) {
            updateStatisticsForItems(itemsToStat); // Use the provided (filtered) items
        } else {
            updateStatistics(); // Update with all trackedItems (search is clear)
        }
    }

    function updateStatisticsForItems(items) {
        if (!items.length) {
            totalItemsEl.textContent = '0';
            totalInvestmentEl.textContent = '0';
            currentValueEl.textContent = '0';
            totalProfitLossEl.textContent = '0';
            totalProfitLossPercentEl.textContent = '';
            
            summaryItemsEl.textContent = '0';
            summaryPlEl.textContent = '0';
            summaryPlEl.className = 'summary-pl';

            // Ensure container class is also reset for 0 items
            const profitLossContainer = document.getElementById('total-profit-loss-container');
            if (profitLossContainer) {
                profitLossContainer.className = 'stat-value';
            }
            return;
        }

        let totalInvestment = 0;
        let totalCurrentValue = 0;
        let totalProfitLoss = 0;

        // Get current prices for calculation - this might be slightly delayed if API is hit
        // Consider if this needs to be more immediate or if cachedLatestPrices should be preferred.
        // For debounced search, fetching here is okay.
        fetchAPI('latest').then(latestPricesData => {
            for (const item of items) {
                const investment = item.purchasePrice * item.quantity;
                totalInvestment += investment;

                let itemCurrentPrice = 0;
                if (latestPricesData && latestPricesData.data && latestPricesData.data[item.id]) {
                    itemCurrentPrice = getCurrentPrice(item.id, latestPricesData.data);
                    if (itemCurrentPrice !== null) {
                        totalCurrentValue += itemCurrentPrice * item.quantity;
                        const priceAfterTax = calculatePriceAfterTax(itemCurrentPrice);
                        if (priceAfterTax !== null) {
                            totalProfitLoss += (priceAfterTax * item.quantity) - investment;
                        }
                    } else {
                        // If current price is not available, use purchase price for current value (neutral P&L for this item)
                        totalCurrentValue += investment; 
                        // Profit remains unchanged (0 for this item)
                    }
                } else {
                    // If item not in price data, use purchase price for current value
                    totalCurrentValue += investment;
                    // Profit remains unchanged (0 for this item)
                }
            }

            let profitPercent = 0;
            if (totalInvestment !== 0) {
                profitPercent = (totalProfitLoss / totalInvestment) * 100;
            }

            totalItemsEl.textContent = items.length.toString();
            totalInvestmentEl.textContent = formatCurrency(totalInvestment);
            currentValueEl.textContent = formatCurrency(totalCurrentValue);
            
            // Create profitDisplay and add emoji if needed
            let profitDisplay = formatCurrency(totalProfitLoss);
            if (profitPercent > 30) {
                profitDisplay += ' 🔥';
            }
            totalProfitLossEl.textContent = profitDisplay; // Use profitDisplay here
            totalProfitLossEl.className = ''; // Clear any direct classes on the span

            const profitLossContainer = document.getElementById('total-profit-loss-container');
            if (profitLossContainer) {
                profitLossContainer.className = 'stat-value'; // Reset to base class
                if (totalProfitLoss > 0) {
                    profitLossContainer.classList.add('profit');
                } else if (totalProfitLoss < 0) {
                    profitLossContainer.classList.add('loss');
                }
            }
            
            // Update percentage display
            if (totalInvestment !== 0) {
                let percentDisplay = `(${profitPercent >= 0 ? '+' : ''}${formatCurrency(profitPercent)}%)`;
                if (profitPercent > 30) {
                    percentDisplay += ' 🔥';
                }
                totalProfitLossPercentEl.textContent = percentDisplay;
                totalProfitLossPercentEl.className = 'profit-loss-percent-stat'; // Reset base class
                if (profitPercent > 0) {
                    totalProfitLossPercentEl.classList.add('profit');
                } else if (profitPercent < 0) {
                    totalProfitLossPercentEl.classList.add('loss');
                }
            } else {
                totalProfitLossPercentEl.textContent = '';
                totalProfitLossPercentEl.className = 'profit-loss-percent-stat'; // Reset to base
            }

            summaryItemsEl.textContent = items.length.toString();
            summaryPlEl.textContent = profitDisplay; // Use profitDisplay here as well
            summaryPlEl.className = 'summary-pl'; // Reset base class
            if (totalProfitLoss > 0) {
                summaryPlEl.classList.add('profit');
            } else if (totalProfitLoss < 0) {
                summaryPlEl.classList.add('loss');
            }
        }).catch(error => {
            console.error("Error updating stats for items:", error);
            // Potentially display a muted error or rely on N/A values in table
        });
    }

    let filteredItems = [];
    let selectedIndex = -1;

    async function loadItemMapping() {
        if (itemMapping) return itemMapping; // Avoid refetching if already loaded
        const mappingData = await fetchAPI('mapping');
        if (mappingData) {
            itemMapping = {};
            mappingData.forEach(item => {
                itemMapping[item.name.toLowerCase()] = item; 
            });
        }
        return itemMapping;
    }

    function filterItems(query) {
        if (!itemMapping || !query) {
            filteredItems = [];
            return [];
        }
        
        const lowerQuery = query.toLowerCase();
        filteredItems = Object.values(itemMapping)
            .filter(item => item.name.toLowerCase().includes(lowerQuery))
            .slice(0, 10); // Limit to 10 results for performance
        
        return filteredItems;
    }

    function showDropdown(items) {
        itemDropdown.innerHTML = '';
        
        if (items.length === 0) {
            itemDropdown.classList.remove('show');
            return;
        }

        items.forEach((item, index) => {
            const div = document.createElement('div');
            div.classList.add('dropdown-item');
            // div.textContent = item.name; // We will set text content after adding the icon

            if (item.icon) {
                const iconImg = document.createElement('img');
                iconImg.src = `${OSRS_WIKI_IMG_BASE_URL}${item.icon.replace(/ /g, '_')}`;
                iconImg.alt = item.name; // Alt text is good practice
                iconImg.classList.add('dropdown-item-icon');
                div.appendChild(iconImg);
            }

            const itemNameSpan = document.createElement('span');
            itemNameSpan.textContent = item.name;
            div.appendChild(itemNameSpan);

            div.addEventListener('click', async () => await selectItem(item));
            itemDropdown.appendChild(div);
        });

        itemDropdown.classList.add('show');
        selectedIndex = -1;
    }

    function hideDropdown() {
        itemDropdown.classList.remove('show');
        selectedIndex = -1;
    }

    async function selectItem(item) {
        itemNameInput.value = item.name;
        hideDropdown();

        const originalPlaceholder = purchasePriceInput.placeholder;
        purchasePriceInput.placeholder = 'Fetching price...';
        purchasePriceInput.value = ''; // Clear previous value visually for loading indication
        purchasePriceInput.disabled = true;

        let priceFetchedSuccessfully = false;

        try {
            let itemPriceSourceData = null;
            // Check cache first
            if (cachedLatestPrices && cachedLatestPrices.data && cachedLatestPrices.data[item.id]) {
                itemPriceSourceData = cachedLatestPrices.data;
            } else {
                // Fetch latest prices if not in cache or cache is empty
                const latestPrices = await fetchAPI('latest');
                if (latestPrices && latestPrices.data) {
                    cachedLatestPrices = latestPrices; // Update cache
                    itemPriceSourceData = latestPrices.data;
                }
            }

            if (itemPriceSourceData) {
                const currentAvgPrice = getCurrentPrice(item.id, itemPriceSourceData);
                purchasePriceInput.value = formatCurrency(currentAvgPrice);
                priceFetchedSuccessfully = true; // Consider it successful even if price is 0 (from null)
            } else {
                // If no price source data at all (e.g., API fetch failed and cache was empty)
                purchasePriceInput.value = '0'; // Default to 0 if data source fails
                priceFetchedSuccessfully = true; // Still mark as handled to prevent override in finally
            }
        } catch (error) {
            console.error(`Error fetching price for ${item.name}:`, error);
            purchasePriceInput.value = '0'; // Default to 0 on error
            priceFetchedSuccessfully = true; // Mark as handled
        } finally {
            // The value is now set directly within try/catch if successful or to '0' on failure.
            // If for some reason it was not handled (e.g. an unexpected path not setting priceFetchedSuccessfully)
            // this could be a fallback, but current logic should cover it.
            if (!priceFetchedSuccessfully) {
                 purchasePriceInput.value = '0'; // Fallback, though should be covered above.
            }
            purchasePriceInput.placeholder = originalPlaceholder;
            purchasePriceInput.disabled = false;
            purchasePriceInput.focus();
        }
    }

    function highlightItem(index) {
        const items = itemDropdown.querySelectorAll('.dropdown-item');
        items.forEach((item, i) => {
            item.classList.toggle('highlighted', i === index);
        });
    }

    function saveItems() {
        if (isReadOnlyMode) return; // Don't save if in read-only mode
        localStorage.setItem('osrsMerchItems', JSON.stringify(trackedItems));
    }

    async function updateStatistics() {
        if (!trackedItems || !totalItemsEl || !totalInvestmentEl || !currentValueEl || !totalProfitLossEl || !summaryItemsEl || !summaryPlEl || !totalProfitLossPercentEl) {
            console.error("DOM elements for statistics not found or trackedItems missing.");
            return;
        }

        let totalInvestment = 0;
        let currentValue = 0;
        let totalProfitLossValue = 0;
        const itemsCount = trackedItems.length;

        for (const item of trackedItems) {
            const investment = parseFloat(item.purchasePrice) * parseInt(item.quantity);
            totalInvestment += investment;
            const price = parseFloat(item.currentPrice);
            if (typeof price === 'number' && !isNaN(price)) {
                currentValue += price * parseInt(item.quantity);
                const priceAfterTax = calculatePriceAfterTax(price);
                if (priceAfterTax !== null) {
                    totalProfitLossValue += (priceAfterTax * parseInt(item.quantity)) - investment;
                }
            } else {
                 // If current price N/A, profit for this item is 0, currentValue uses investment.
            }
        }

        let profitPercent = 0;
        if (totalInvestment !== 0) {
            profitPercent = (totalProfitLossValue / totalInvestment) * 100;
        }

        totalItemsEl.textContent = itemsCount.toLocaleString();
        totalInvestmentEl.textContent = formatCurrency(totalInvestment);
        currentValueEl.textContent = formatCurrency(currentValue);
        totalProfitLossEl.textContent = formatCurrency(totalProfitLossValue);
        
        // Update class on parent container for color based on profit/loss
        const profitLossContainer = document.getElementById('total-profit-loss-container');
        if(profitLossContainer) {
            profitLossContainer.className = 'stat-value'; // Reset base class
            if (totalProfitLossValue > 0) {
                profitLossContainer.classList.add('profit');
            } else if (totalProfitLossValue < 0) {
                profitLossContainer.classList.add('loss');
            }
        }
        
        // Update percentage display
        if (totalInvestment !== 0) {
            let percentDisplay = `(${profitPercent >= 0 ? '+' : ''}${formatCurrency(profitPercent)}%)`;
            if (profitPercent > 30) {
                percentDisplay += ' 🔥';
            }
            totalProfitLossPercentEl.textContent = percentDisplay;
            totalProfitLossPercentEl.className = 'profit-loss-percent-stat'; // Reset base class
            if (profitPercent > 0) {
                totalProfitLossPercentEl.classList.add('profit');
            } else if (profitPercent < 0) {
                totalProfitLossPercentEl.classList.add('loss');
            }
        } else {
            totalProfitLossPercentEl.textContent = '';
            totalProfitLossPercentEl.className = 'profit-loss-percent-stat'; // Reset to base
        }
        
        summaryItemsEl.textContent = itemsCount.toLocaleString();
        summaryPlEl.textContent = formatCurrency(totalProfitLossValue);
        summaryPlEl.classList.remove('profit', 'loss');
        if (totalProfitLossValue > 0) {
            summaryPlEl.classList.add('profit');
        } else if (totalProfitLossValue < 0) {
            summaryPlEl.classList.add('loss');
        }
    }

    async function renderItems(showLoading = true) {
        const startTime = Date.now();
        
        if (showLoading) {
            showTableLoading();
        }
        
        itemListBody.innerHTML = ''; 
        const latestPricesData = await fetchAPI('latest');

        if (latestPricesData && latestPricesData.data) {
            cachedLatestPrices = latestPricesData; // Cache the fetched data
            // Update currentPrice on each item in trackedItems
            trackedItems.forEach(item => {
                if (latestPricesData.data[item.id]) {
                    const priceInfo = latestPricesData.data[item.id];
                    const high = priceInfo.high;
                    const low = priceInfo.low;
                    if (high !== null && low !== null) {
                        item.currentPrice = Math.round((high + low) / 2);
                    } else if (high !== null) {
                        item.currentPrice = high;
                    } else if (low !== null) {
                        item.currentPrice = low;
                    } else {
                        item.currentPrice = null; 
                    }
                } else {
                    item.currentPrice = null; // Item not found in current price data
                }
            });
            if (errorMessageP.textContent === 'Could not fetch latest prices. Displaying stored data.') {
                displayError(''); // Clear previous error if prices are now fetched
            }
        } else {
            // If fetching prices failed, set all currentPrices to null
            trackedItems.forEach(item => {
                item.currentPrice = null;
            });
            if (!errorMessageP.classList.contains('active')) {
                //displayError('Could not fetch latest prices. P&L and Current Value might be inaccurate.');
                // Decided to keep this less intrusive or rely on N/A display in table
            }
        }

        if (!trackedItems.length) {
            if (showLoading) {
                const elapsed = Date.now() - startTime;
                const remaining = Math.max(0, 500 - elapsed);
                await new Promise(resolve => setTimeout(resolve, remaining));
                hideTableLoading();
            }
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.textContent = 'No items tracked yet. Add some!';
            td.colSpan = 8;
            td.classList.add('no-items-cell');
            tr.appendChild(td);
            itemListBody.appendChild(tr);
            await updateStatistics(); // updateStatistics uses item.currentPrice from trackedItems
            return;
        }

        // Now that item.currentPrice is set on each item, the loop below will use it.
        for (const item of trackedItems) {
            const tr = document.createElement('tr');
            tr.dataset.itemId = item.uniqueId;

            function createCell(content, dataLabel) {
                const td = document.createElement('td');
                td.setAttribute('data-label', dataLabel);
                if (typeof content === 'string' || typeof content === 'number' || typeof content === 'boolean') {
                    td.textContent = content.toString();
                } else if (content instanceof Node) {
                    td.appendChild(content);
                }
                return td;
            }

            const itemCell = createCell('', 'Item');
            const itemContainer = document.createElement('div');
            itemContainer.classList.add('item-cell');
            
            const iconImg = document.createElement('img');
            if (item.icon) {
                iconImg.src = `${OSRS_WIKI_IMG_BASE_URL}${item.icon.replace(/ /g, '_')}`;
                iconImg.alt = item.name;
                iconImg.classList.add('item-icon');
            } else {
                iconImg.alt = 'No icon';
                iconImg.classList.add('item-icon');
            }
            
            const itemNameSpan = document.createElement('span');
            itemNameSpan.classList.add('item-name');
            itemNameSpan.textContent = item.name;

            const wikiLinkIcon = document.createElement('a');
            wikiLinkIcon.classList.add('wiki-link-icon');
            wikiLinkIcon.href = `https://prices.runescape.wiki/osrs/item/${item.id}`;
            wikiLinkIcon.target = '_blank';
            wikiLinkIcon.rel = 'noopener noreferrer';
            wikiLinkIcon.innerHTML = '🔗'; // Link icon
            wikiLinkIcon.title = `View ${item.name} on OSRS Wiki`;
            // Basic inline styles, can be enhanced in CSS file
            wikiLinkIcon.style.marginLeft = '8px'; 
            wikiLinkIcon.style.textDecoration = 'none';
            
            itemContainer.appendChild(iconImg);
            itemContainer.appendChild(itemNameSpan); // Add item name span
            itemContainer.appendChild(wikiLinkIcon); // Add wiki link icon
            itemCell.appendChild(itemContainer);
            tr.appendChild(itemCell);

            const purchasePriceCell = createCell('', 'Purchase Price');
            purchasePriceCell.innerHTML = `<span class="currency">${formatCurrency(item.purchasePrice)}</span>`;
            tr.appendChild(purchasePriceCell);

            const quantityCell = createCell('', 'Qty');
            quantityCell.innerHTML = `<span class="currency">${item.quantity.toLocaleString()}</span>`;
            tr.appendChild(quantityCell);
            
            const totalInvestmentForItem = item.purchasePrice * item.quantity;
            const investmentCell = createCell('', 'Investment');
            investmentCell.innerHTML = `<span class="currency">${formatCurrency(totalInvestmentForItem)}</span>`;
            tr.appendChild(investmentCell);

            // Current Price Cell - uses item.currentPrice directly now
            const currentPriceCell = createCell('', 'Price');
            if (item.currentPrice !== null && typeof item.currentPrice === 'number') {
                currentPriceCell.innerHTML = `<span class="currency">${formatCurrency(item.currentPrice)}</span>`;
            } else {
                currentPriceCell.innerHTML = '<span class="text-muted">N/A</span>';
            }
            tr.appendChild(currentPriceCell);

            // Price After Tax Cell - New Cell
            const priceAfterTaxCell = createCell('', 'Price - Tax');
            if (item.currentPrice !== null && typeof item.currentPrice === 'number') {
                const priceAfterTaxValue = calculatePriceAfterTax(item.currentPrice);
                if (priceAfterTaxValue !== null) {
                    priceAfterTaxCell.innerHTML = `<span class="currency">${formatCurrency(priceAfterTaxValue)}</span>`;
                } else {
                    priceAfterTaxCell.innerHTML = '<span class="text-muted">N/A</span>';
                }
            } else {
                priceAfterTaxCell.innerHTML = '<span class="text-muted">N/A</span>';
            }
            tr.appendChild(priceAfterTaxCell);

            // Profit/Loss Cell - uses item.currentPrice directly now
            const profitLossCell = createCell('', 'Profit');
            if (item.currentPrice !== null && typeof item.currentPrice === 'number') {
                const priceAfterTaxValue = calculatePriceAfterTax(item.currentPrice);
                if (priceAfterTaxValue !== null) {
                    const potentialSaleAfterTax = priceAfterTaxValue * item.quantity;
                    const profitLoss = potentialSaleAfterTax - totalInvestmentForItem;
                    const profitClass = profitLoss > 0 ? 'profit' : (profitLoss < 0 ? 'loss' : 'neutral');
                    profitLossCell.innerHTML = `<span class="${profitClass} currency">${formatCurrency(profitLoss)}</span>`;
                } else {
                    profitLossCell.innerHTML = '<span class="neutral">N/A</span>';
                }
            } else {
                profitLossCell.innerHTML = '<span class="neutral">N/A</span>';
            }
            tr.appendChild(profitLossCell);

            // Profit Percentage Cell
            const profitPercentCell = createCell('', '%');
            if (item.currentPrice !== null && typeof item.currentPrice === 'number' && totalInvestmentForItem !== 0) {
                const priceAfterTaxValue = calculatePriceAfterTax(item.currentPrice);
                if (priceAfterTaxValue !== null) {
                    const potentialSaleAfterTax = priceAfterTaxValue * item.quantity;
                    const profitLoss = potentialSaleAfterTax - totalInvestmentForItem;
                    const profitPercent = (profitLoss / totalInvestmentForItem) * 100;
                    const percentClass = profitPercent > 0 ? 'profit' : (profitPercent < 0 ? 'loss' : 'neutral');
                    let profitPercentDisplay = `${profitPercent >= 0 ? '+' : ''}${formatCurrency(profitPercent)}%`;
                    if (profitPercent > 30) {
                        profitPercentDisplay += ' 🔥';
                    }
                    profitPercentCell.innerHTML = `<span class="${percentClass}">${profitPercentDisplay}</span>`;
                } else if (totalInvestmentForItem === 0 && item.currentPrice !== null && typeof item.currentPrice === 'number' ){
                    const priceAfterTaxValue = calculatePriceAfterTax(item.currentPrice);
                    if (priceAfterTaxValue !== null && priceAfterTaxValue * item.quantity > 0) {
                        profitPercentCell.innerHTML = '<span class="profit">+∞% 🔥</span>'; // Infinite profit if investment is 0 and current value is positive
                    } else {
                        profitPercentCell.innerHTML = '<span class="neutral">N/A</span>';
                    }
                }
                else {
                    profitPercentCell.innerHTML = '<span class="neutral">N/A</span>';
                }
            } else if (totalInvestmentForItem === 0 && item.currentPrice !== null && typeof item.currentPrice === 'number' ){
                const priceAfterTaxValue = calculatePriceAfterTax(item.currentPrice);
                if (priceAfterTaxValue !== null && priceAfterTaxValue * item.quantity > 0) {
                    profitPercentCell.innerHTML = '<span class="profit">+∞% 🔥</span>'; // Infinite profit if investment is 0 and current value is positive
                } else {
                    profitPercentCell.innerHTML = '<span class="neutral">N/A</span>';
                }
            }
            else {
                profitPercentCell.innerHTML = '<span class="neutral">N/A</span>';
            }
            tr.appendChild(profitPercentCell);

            if (!isReadOnlyMode) { // Only add click listener if not in read-only mode
                tr.addEventListener('click', (event) => {
                    // Prevent opening edit modal if the click was on the wiki link icon
                    if (event.target.closest('a.wiki-link-icon')) {
                        return;
                    }
                    openEditModal(item.uniqueId);
                });
            }
            itemListBody.appendChild(tr);
        }
        
        await updateStatistics(); // updateStatistics uses item.currentPrice from trackedItems, which is now fresh
        
        if (showLoading) {
            const elapsed = Date.now() - startTime;
            const remaining = Math.max(0, 1000 - elapsed);
            await new Promise(resolve => setTimeout(resolve, remaining));
            hideTableLoading();
        }

        // After rendering all items, update statistics based on current search state
        if (searchQuery.trim()) {
            updateSearchStatistics(getFilteredItems());
        } else {
            await updateStatistics(); // This uses item.currentPrice from trackedItems, which is now fresh
        }

        if (searchQuery.trim()) {
            filterTableRowsVisual();
        }
    }

    async function addItem() {
        displayError('');
        const name = itemNameInput.value.trim();
        const purchasePriceString = purchasePriceInput.value.replace(/,/g, ''); // Remove commas
        const quantityString = quantityInput.value.replace(/,/g, ''); // Remove commas

        const purchasePrice = parseFloat(purchasePriceString);
        const quantity = parseInt(quantityString, 10);

        if (!name || isNaN(purchasePrice) || purchasePrice <= 0 || isNaN(quantity) || quantity <= 0) {
            displayError('Please enter a valid item name, purchase price, and quantity.');
            return;
        }

        await loadItemMapping(); // Ensure mapping is loaded
        if (!itemMapping) {
            displayError('Failed to load item mapping. Cannot add item. Refresh page or check console.');
            return;
        }

        const itemDetails = itemMapping[name.toLowerCase()];
        if (!itemDetails) {
            displayError(`Item "${name}" not found in OSRS database. Check spelling or try again later.`);
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

        trackedItems.push(newItem);
        saveItems();
        
        // Re-apply current sort if any
        if (currentSort.column) {
            await sortItemsWithPriceData(currentSort.column, currentSort.direction);
            updateSortIndicators(currentSort.column, currentSort.direction);
        }
        
        await renderItems(false);

        itemNameInput.value = '';
        purchasePriceInput.value = '';
        quantityInput.value = '1';
        itemNameInput.focus();
    }

    async function removeItemWithConfirmation(uniqueIdToRemove) {
        const itemToRemove = trackedItems.find(item => item.uniqueId === uniqueIdToRemove);
        if (!itemToRemove) return;

        if (confirm(`Are you sure you want to remove "${itemToRemove.name}"?`)) {
            await removeItem(uniqueIdToRemove);
        }
    }

    async function removeItem(uniqueIdToRemove) {
        trackedItems = trackedItems.filter(item => item.uniqueId !== uniqueIdToRemove);
        saveItems();
        
        // Re-apply current sort if any
        if (currentSort.column) {
            await sortItemsWithPriceData(currentSort.column, currentSort.direction);
            updateSortIndicators(currentSort.column, currentSort.direction);
        }
        
        renderItems(false);
    }

    // Modal open/close functions
    function openModal() {
        displayError('');
        addItemModal.style.display = 'flex';
        itemNameInput.focus();
        purchasePriceInput.value = '';
        quantityInput.value = '1';
        displayError('');
    }

    function closeModal() {
        addItemModal.style.display = 'none';
        itemNameInput.value = '';
        purchasePriceInput.value = '';
        quantityInput.value = '1';
        displayError('');
        hideDropdown();
    }

    function openEditModal(uniqueId) {
        const item = trackedItems.find(item => item.uniqueId === uniqueId);
        if (!item) return;

        editingItemId = uniqueId;

        // Display item icon in Edit Item Modal
        const editModalIconContainer = document.getElementById('edit-modal-item-icon-container');
        editModalIconContainer.innerHTML = ''; // Clear previous icon
        if (item.icon) {
            const iconImg = document.createElement('img');
            iconImg.src = `${OSRS_WIKI_IMG_BASE_URL}${item.icon.replace(/ /g, '_')}`;
            iconImg.alt = item.name;
            iconImg.classList.add('modal-item-icon');
            editModalIconContainer.appendChild(iconImg);
        }

        document.getElementById('edit-modal-item-name-display').textContent = item.name;
        document.getElementById('edit-purchase-price').value = formatCurrency(item.purchasePrice); // Format with commas
        document.getElementById('edit-quantity').value = formatCurrency(item.quantity); // Format with commas
        
        displayEditError('');
        editItemModal.style.display = 'flex';
        document.getElementById('edit-purchase-price').focus();
    }

    function closeEditModal() {
        editItemModal.style.display = 'none';
        editingItemId = null;
        document.getElementById('edit-modal-item-icon-container').innerHTML = ''; // Clear icon
        displayEditError('');
    }

    function displayEditError(message) {
        const errorEl = document.getElementById('edit-error-message');
        errorEl.textContent = message;
        if (message) {
            errorEl.classList.add('active');
        } else {
            errorEl.classList.remove('active');
        }
    }

    function exportData() {
        if (!trackedItems.length) {
            alert('No items to export!');
            return;
        }

        const csvContent = [
            ['Item Name', 'Purchase Price', 'Quantity', 'Total Investment'],
            ...trackedItems.map(item => [
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

    // Event listeners for modals
    showAddItemModalBtn.addEventListener('click', openModal);
    addCloseModalBtn.addEventListener('click', closeModal);
    editCloseModalBtn.addEventListener('click', closeEditModal);
    exportBtn.addEventListener('click', exportData);

    // Stats toggle functionality
    statsToggle.addEventListener('click', () => {
        const isExpanded = statsContainer.classList.contains('expanded');
        if (isExpanded) {
            statsContainer.classList.remove('expanded');
            statsToggle.classList.remove('expanded');
        } else {
            statsContainer.classList.add('expanded');
            statsToggle.classList.add('expanded');
        }
    });
    
    // Close modals when clicking backdrop
    window.addEventListener('click', (event) => {
        if (event.target === addItemModal || (event.target.classList.contains('modal-backdrop') && addItemModal.style.display === 'flex')) {
            closeModal();
        }
        if (event.target === editItemModal || (event.target.classList.contains('modal-backdrop') && editItemModal.style.display === 'flex')) {
            closeEditModal();
        }
    });

    addItemBtn.addEventListener('click', async () => {
        await addItem(); 
        if (!errorMessageP.classList.contains('active')) { 
            closeModal();
        }
    });

    saveItemBtn.addEventListener('click', async () => {
        if (!editingItemId) return;

        const purchasePriceString = document.getElementById('edit-purchase-price').value.replace(/,/g, ''); // Remove commas
        const quantityString = document.getElementById('edit-quantity').value.replace(/,/g, ''); // Remove commas

        const purchasePrice = parseFloat(purchasePriceString);
        const quantity = parseInt(quantityString, 10);

        if (isNaN(purchasePrice) || purchasePrice <= 0 || isNaN(quantity)) {
            displayEditError('Please enter valid purchase price and quantity.');
            return;
        }

        const itemIndex = trackedItems.findIndex(item => item.uniqueId === editingItemId);
        if (itemIndex >= 0) {
            trackedItems[itemIndex].purchasePrice = purchasePrice;
            trackedItems[itemIndex].quantity = quantity;
            saveItems();
            
            // Re-apply current sort if any
            if (currentSort.column) {
                await sortItemsWithPriceData(currentSort.column, currentSort.direction);
                updateSortIndicators(currentSort.column, currentSort.direction);
            }
            
            await renderItems(false);
            closeEditModal();

            // Re-apply search filter if a search query exists
            if (searchQuery.trim()) {
                filterTableRowsVisual();
            }
        }
    });

    deleteItemBtn.addEventListener('click', async () => {
        if (!editingItemId) return;
        
        const item = trackedItems.find(item => item.uniqueId === editingItemId);
        if (item && confirm(`Are you sure you want to delete "${item.name}"?`)) {
            await removeItem(editingItemId);
            closeEditModal();
        } else if (isReadOnlyMode) {
            alert("This is a read-only view. Deleting items is disabled.");
        }
    });

    refreshPricesBtn.addEventListener('click', async () => {
        displayError('');
        refreshPricesBtn.disabled = true;
        refreshPricesBtn.innerHTML = '<span class="btn-icon">⏳</span>'; // Changed this line
        refreshPricesBtn.classList.add('loading');
        
        try {
            cachedLatestPrices = null; // Invalidate cache before fetching new data
            await renderItems();
        } finally {
            refreshPricesBtn.disabled = false;
            refreshPricesBtn.innerHTML = '<span class="btn-icon">🔄</span>'; // Changed this line
            refreshPricesBtn.classList.remove('loading');
        }
    });

    // Add event listeners for custom dropdown
    itemNameInput.addEventListener('input', (e) => {
        const query = e.target.value;
        if (query.length > 0) {
            const items = filterItems(query);
            showDropdown(items);
        } else {
            hideDropdown();
        }
    });

    itemNameInput.addEventListener('keydown', async (e) => { 
        const items = itemDropdown.querySelectorAll('.dropdown-item');
        
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
                highlightItem(selectedIndex);
                break;
            case 'ArrowUp':
                e.preventDefault();
                selectedIndex = Math.max(selectedIndex - 1, -1);
                highlightItem(selectedIndex);
                break;
            case 'Enter':
                console.log('itemNameInput Enter: Handling dropdown selection.');
                e.preventDefault(); 
                e.stopPropagation(); 
                e.dropdownHandled = true; // Set a flag on the event object
                
                if (selectedIndex >= 0 && filteredItems[selectedIndex]) {
                    await selectItem(filteredItems[selectedIndex]);
                    console.log('itemNameInput Enter: selectItem finished.');
                    return; 
                }
                console.log('itemNameInput Enter: No item selected in dropdown.');
                break;
            case 'Escape':
                e.preventDefault(); // Also good to prevent default for Escape
                e.stopPropagation(); // And stop propagation
                hideDropdown();
                break;
        }
    });

    itemNameInput.addEventListener('blur', (e) => {
        // Delay hiding to allow clicks on dropdown items
        setTimeout(() => {
            if (!itemDropdown.contains(document.activeElement)) {
                hideDropdown();
            }
        }, 150);
    });

    // Hide dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.custom-dropdown')) {
            hideDropdown();
        }
        // Close actions dropdown if clicked outside
        if (actionsDropdownBtn && actionsDropdownContent && !actionsDropdownBtn.contains(e.target) && !actionsDropdownContent.contains(e.target)) {
            if (actionsDropdownContent.classList.contains('show')) {
                actionsDropdownContent.classList.remove('show');
                actionsDropdownBtn.classList.remove('open');
            }
        }
    });

    // Function to reorder table rows without full re-render
    function reorderTableRows() {
        const tbody = itemListBody;
        const rows = Array.from(tbody.querySelectorAll('tr[data-item-id]'));
        
        // Create a map of uniqueId to row element
        const rowMap = new Map();
        rows.forEach(row => {
            const itemId = row.dataset.itemId;
            if (itemId) {
                rowMap.set(itemId, row);
            }
        });
        
        // Reorder rows without clearing the table
        trackedItems.forEach((item, index) => {
            const row = rowMap.get(item.uniqueId);
            if (row) {
                // Get the current position of this row
                const currentIndex = Array.from(tbody.children).indexOf(row);
                
                // If the row is not in the correct position, move it
                if (currentIndex !== index) {
                    // Remove the row from its current position
                    row.remove();
                    
                    // Insert it at the correct position
                    if (index >= tbody.children.length) {
                        tbody.appendChild(row);
                    } else {
                        tbody.insertBefore(row, tbody.children[index]);
                    }
                }
            }
        });
        
        // If no items, show the "no items" message
        if (trackedItems.length === 0) {
            tbody.innerHTML = '';
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.textContent = 'No items tracked yet. Add some!';
            td.colSpan = 8;
            td.classList.add('no-items-cell');
            tr.appendChild(td);
            tbody.appendChild(tr);
        }
    }

    // Function to update price-dependent cells without full re-render
    async function updatePriceDependentCells() {
        let dataToUse = cachedLatestPrices;
        if (!dataToUse) {
            dataToUse = await fetchAPI('latest');
            if (dataToUse) {
                cachedLatestPrices = dataToUse; // Cache if fetched
            }
        }

        const latestPricesData = dataToUse;
        if (!latestPricesData || !latestPricesData.data) {
            return latestPricesData; // Return whatever we have, even if null/error
        }

        const rows = Array.from(itemListBody.querySelectorAll('tr[data-item-id]'));
        
        rows.forEach(row => {
            const uniqueId = row.dataset.itemId;
            const item = trackedItems.find(item => item.uniqueId === uniqueId);
            if (!item) return;

            const cells = row.querySelectorAll('td');
            const currentPriceCell = cells[4]; // Price column (0-indexed)
            const priceAfterTaxCell = cells[5]; // Price - Tax column
            const profitLossCell = cells[6]; // P&L column
            const profitPercentCell = cells[7]; // Profit % column

            // Update Current Price Cell (now just 'Price')
            let currentPrice = null;
            let priceAfterTax = null; // CORRECT: Declare priceAfterTax here for the scope of this forEach iteration

            if (latestPricesData.data[item.id]) {
                const priceInfo = latestPricesData.data[item.id];
                const currentPriceHigh = priceInfo.high;
                const currentPriceLow = priceInfo.low;

                if (currentPriceHigh !== null && currentPriceLow !== null) {
                    currentPrice = Math.round((currentPriceHigh + currentPriceLow) / 2);
                    currentPriceCell.innerHTML = `<span class="currency">${formatCurrency(currentPrice)}</span>`;
                } else if (currentPriceHigh !== null) {
                    currentPrice = currentPriceHigh;
                    currentPriceCell.innerHTML = `<span class="currency">${formatCurrency(currentPrice)}</span>`;
                } else if (currentPriceLow !== null) {
                    currentPrice = currentPriceLow;
                    currentPriceCell.innerHTML = `<span class="currency">${formatCurrency(currentPrice)}</span>`;
                } else {
                    currentPriceCell.innerHTML = '<span class="text-muted">N/A</span>';
                }
            } else {
                currentPriceCell.innerHTML = '<span class="text-muted">N/A</span>';
            }

            // Update Price After Tax Cell (New)
            if (currentPrice !== null) {
                priceAfterTax = calculatePriceAfterTax(currentPrice);
                if (priceAfterTax !== null) {
                    priceAfterTaxCell.innerHTML = `<span class="currency">${formatCurrency(priceAfterTax)}</span>`;
                } else {
                    priceAfterTaxCell.innerHTML = '<span class="text-muted">N/A</span>';
                }
            } else {
                priceAfterTaxCell.innerHTML = '<span class="text-muted">N/A</span>';
            }

            // Update P&L Cell
            if (priceAfterTax !== null) { // CORRECT: Check higher-scoped priceAfterTax directly
                const totalInvestment = item.purchasePrice * item.quantity;
                const potentialSaleAfterTax = priceAfterTax * item.quantity;
                const profitLoss = potentialSaleAfterTax - totalInvestment;
                const profitClass = profitLoss > 0 ? 'profit' : (profitLoss < 0 ? 'loss' : 'neutral');
                profitLossCell.innerHTML = `<span class="${profitClass} currency">${formatCurrency(profitLoss)}</span>`;
            } else {
                profitLossCell.innerHTML = '<span class="neutral">N/A</span>';
            }

            // Update Profit Percentage Cell (Added)
            if (priceAfterTax !== null) { // CORRECT: Check higher-scoped priceAfterTax directly
                const totalInvestment = item.purchasePrice * item.quantity;
                if (totalInvestment !== 0) {
                    const potentialSaleAfterTax = priceAfterTax * item.quantity;
                    const profitLoss = potentialSaleAfterTax - totalInvestment;
                    const profitPercent = (profitLoss / totalInvestment) * 100;
                    const percentClass = profitPercent > 0 ? 'profit' : (profitPercent < 0 ? 'loss' : 'neutral');
                    let profitPercentDisplay = `${profitPercent >= 0 ? '+' : ''}${formatCurrency(profitPercent)}%`;
                    if (profitPercent > 30) {
                        profitPercentDisplay += ' 🔥';
                    }
                    profitPercentCell.innerHTML = `<span class="${percentClass}">${profitPercentDisplay}</span>`;
                } else if (totalInvestment === 0 && priceAfterTax * item.quantity > 0) { // check priceAfterTax directly
                     profitPercentCell.innerHTML = '<span class="profit">+∞% 🔥</span>';
                }
                else {
                    profitPercentCell.innerHTML = '<span class="neutral">N/A</span>';
                }
            } else {
                profitPercentCell.innerHTML = '<span class="neutral">N/A</span>';
            }
        });

        return latestPricesData;
    }

    // Portfolio search event listeners
    portfolioSearchInput.addEventListener('input', async () => {
        searchQuery = portfolioSearchInput.value;
        filterTableRowsVisual(); // Instant visual update of table rows
        clearSearchBtn.style.display = searchQuery ? 'block' : 'none';

        // Debounce the statistics update
        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(async () => {
            updateSearchStatistics(getFilteredItems());
        }, 500); // Adjust delay as needed (e.g., 500ms)
    });

    clearSearchBtn.addEventListener('click', async () => {
        clearTimeout(searchDebounceTimer); // Clear any pending debounced update
        portfolioSearchInput.value = '';
        searchQuery = ''; // Explicitly clear searchQuery global
        filterTableRowsVisual(); // Show all items visually
        // Immediately update statistics for the unfiltered view
        updateSearchStatistics(getFilteredItems()); // This will call updateStatistics() because searchQuery is empty
        clearSearchBtn.style.display = 'none';
        portfolioSearchInput.focus(); // Optional: return focus to search bar
    });

    // Table sorting event listeners
    document.querySelectorAll('.sortable').forEach(th => {
        th.addEventListener('click', async () => {
            const column = th.dataset.sort;
            
            // Determine sort direction
            let direction = 'asc';
            if (currentSort.column === column) {
                direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
            }
            
            // Update current sort state
            currentSort = { column, direction };
            
            // Show loading if sorting by current price or P&L
            const needsApiData = column === 'currentPrice' || column === 'priceAfterTax' || column === 'profitLoss' || column === 'profitLossPercent';
            if (needsApiData) {
                showTableLoading();
            }
            
            try {
                // For price-dependent sorting, update cells first to avoid flicker
                let latestPricesDataForSort = cachedLatestPrices; // Try to use cache first
                if (needsApiData) {
                    // updatePriceDependentCells will try to use cache or fetch if needed
                    const priceUpdateResult = await updatePriceDependentCells();
                    // Ensure latestPricesDataForSort is the result from updatePriceDependentCells
                    // which would be the cached or newly fetched data.
                    latestPricesDataForSort = priceUpdateResult || cachedLatestPrices; 
                }
                
                // Sort the items (now with fresh price data if needed)
                await sortItemsWithPriceData(column, direction, latestPricesDataForSort); 
                
                // Update visual indicators
                updateSortIndicators(column, direction);
                
                // Reorder existing table rows instead of full re-render
                if (trackedItems.length > 0 && itemListBody.children.length > 0) {
                    reorderTableRows();
                    
                    // Update statistics with current data (prefer data used for sort)
                    await updateStatistics();
                } else {
                    // Full re-render only if table is empty or needs to be built
                    // renderItems will fetch if cache is null, or use cache
                    await renderItems(false); 
                }
            } finally {
                if (needsApiData) {
                    hideTableLoading();
                }
            }
        });
    });

    // Add Enter key submission for Add Item Modal
    [itemNameInput, purchasePriceInput, quantityInput].forEach(input => {
        input.addEventListener('keydown', async (e) => {
            if (e.key === 'Enter') {
                // If the event was already handled by the dropdown logic, do nothing further.
                if (e.dropdownHandled) {
                    console.log('General Enter: Event already handled by dropdown. Ignoring.');
                    return;
                }

                console.log('General Enter listener fired. Active element:', document.activeElement.id, 'Dropdown open:', itemDropdown.classList.contains('show'));

                // Only submit if the active element is the purchase price or quantity input
                if (document.activeElement === purchasePriceInput || document.activeElement === quantityInput) {
                    console.log('General Enter: Submitting from price/quantity.');
                    e.preventDefault(); // Ensure default is prevented here too
                    if (!isReadOnlyMode) {
                        addItemBtn.click();
                    }
                } 
                else if (document.activeElement === itemNameInput) {
                    // This case should ideally not be hit for submitting if dropdownHandled works,
                    // but as a fallback, prevent default.
                    console.log('General Enter: Active on itemNameInput (event not dropdownHandled). Preventing default.');
                    e.preventDefault(); 
                }
            }
        });
    });

    // Add Enter key submission for Edit Item Modal
    const editPurchasePriceInput = document.getElementById('edit-purchase-price');
    const editQuantityInput = document.getElementById('edit-quantity');

    [editPurchasePriceInput, editQuantityInput].forEach(input => {
        input.addEventListener('keydown', async (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (!isReadOnlyMode) saveItemBtn.click();
            }
        });
    });

    // --- IMPORT FUNCTIONALITY ---
    importBtn.addEventListener('click', () => {
        if (isReadOnlyMode) {
            alert("This is a read-only view. Importing data is disabled.");
            return;
        }
        importFileInput.click(); // Trigger hidden file input
    });

    importFileInput.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (!file) {
            return;
        }

        if (file.type !== "text/csv") {
            displayError("Please select a valid CSV file.");
            return;
        }

        const reader = new FileReader();
        reader.onload = async (e) => {
            const csvContent = e.target.result;
            try {
                const parsedCsvData = parseCSV(csvContent); // Returns array of objects matching CSV columns
                let newItemsCount = 0;
                let skippedCount = 0;

                await loadItemMapping(); // Ensure itemMapping is loaded
                if (!itemMapping) {
                    displayError("Failed to load item mapping. Cannot import items. Refresh page or check console.");
                    importFileInput.value = ''; 
                    return;
                }

                for (const csvRow of parsedCsvData) {
                    const itemNameFromCsv = csvRow['Item Name'];
                    const purchasePriceFromCsv = csvRow['Purchase Price'];
                    const quantityFromCsv = csvRow['Quantity'];

                    const itemDetails = itemMapping[itemNameFromCsv.toLowerCase()];

                    if (!itemDetails) {
                        console.warn(`Skipping item "${itemNameFromCsv}" from CSV: Not found in item mapping.`);
                        skippedCount++;
                        continue;
                    }

                    const importedItem = {
                        uniqueId: Date.now().toString() + Math.random().toString(36).substr(2, 5), // More unique ID
                        id: itemDetails.id,
                        name: itemDetails.name, // Use mapped name for consistency
                        purchasePrice: purchasePriceFromCsv,
                        quantity: quantityFromCsv,
                        icon: itemDetails.icon
                    };
                    
                    if (!isValidImportedItem(importedItem)) { // isValidImportedItem will check types after parsing
                        console.warn("Skipping invalid item data from CSV (after mapping):", importedItem);
                        skippedCount++;
                        continue;
                    }

                    const existingItem = trackedItems.find(item => item.id === importedItem.id && item.purchasePrice === parseFloat(importedItem.purchasePrice)); // Check by OSRS ID and price to avoid simple re-imports of same investment.
                    if (existingItem) {
                        // Optionally, update existing items here, for now we skip
                        console.log(`Skipping already tracked item (same ID and purchase price): ${importedItem.name}`);
                        skippedCount++;
                        continue;
                    }
                    
                    const newItem = {
                        ...importedItem,
                        purchasePrice: parseFloat(importedItem.purchasePrice.toString().replace(/,/g, '')),
                        quantity: parseInt(importedItem.quantity.toString().replace(/,/g, ''), 10),
                        id: parseInt(importedItem.id, 10), // Already an int from itemDetails
                        currentPrice: null
                    };

                    trackedItems.push(newItem);
                    newItemsCount++;
                }

                if (newItemsCount > 0) {
                    saveItems();
                    showTableLoading();
                    await renderItems(); // renderItems will now fetch prices, update item.currentPrice, and then update stats
                    hideTableLoading();
                    displayError(`Successfully imported ${newItemsCount} new item(s). ${skippedCount} item(s) skipped (not found, invalid, or already exists with same price).`);
                } else if (skippedCount > 0 && newItemsCount === 0) {
                    displayError(`No new items imported. ${skippedCount} item(s) skipped (not found, invalid, or already exists with same price).`);
                } else {
                    displayError("No new items found in the CSV to import or all items already exist.");
                }
            } catch (error) {
                console.error("Error processing CSV file:", error);
                displayError(`Error importing data: ${error.message}`);
            }
            importFileInput.value = ''; 
        };

        reader.onerror = () => {
            displayError("Error reading the file.");
            importFileInput.value = '';
        };

        reader.readAsText(file);
    });

    function parseCSV(csvString) {
        const lines = csvString.trim().split('\n');
        if (lines.length < 2) return []; // Expect header + at least one data row

        const header = lines[0].split(',').map(h => h.trim());
        // Match the headers from the exportData function
        const expectedHeaders = ['Item Name', 'Purchase Price', 'Quantity', 'Total Investment'];
        
        // Check if all expected headers are present
        if (!expectedHeaders.every(eh => header.includes(eh))) {
            console.error("CSV header received:", header);
            console.error("CSV header expected:", expectedHeaders);
            throw new Error("CSV header does not match expected export format (Item Name, Purchase Price, Quantity, Total Investment).");
        }

        const items = [];
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',');
            const item = {};
            // Map values to an object using the actual header names from the CSV
            header.forEach((colName, index) => {
                // Only map if the column is one of the expected ones we care about for direct import
                if (['Item Name', 'Purchase Price', 'Quantity'].includes(colName)){
                    item[colName] = values[index] ? values[index].trim() : '';
                }
            });
            // Ensure all necessary fields are present before adding
            if (item['Item Name'] && item['Purchase Price'] && item['Quantity']) {
                items.push(item);
            } else {
                console.warn("Skipping row due to missing critical data (Item Name, Purchase Price, or Quantity):", values.join(','));
            }
        }
        return items;
    }

    function isValidImportedItem(item) {
        // Validate after attempting to map to OSRS item details and generating uniqueId
        return item.uniqueId && 
               item.id && !isNaN(parseInt(item.id, 10)) && 
               item.name && 
               item.purchasePrice && !isNaN(parseFloat(item.purchasePrice.toString().replace(/,/g, ''))) && 
               item.quantity && !isNaN(parseInt(item.quantity.toString().replace(/,/g, ''), 10)) && parseInt(item.quantity.toString().replace(/,/g, ''), 10) > 0;
    }

    // --- END IMPORT FUNCTIONALITY ---

    // --- DELETE ALL FUNCTIONALITY ---
    deleteAllBtn.addEventListener('click', async () => {
        if (isReadOnlyMode) {
            alert("This is a read-only view. Deleting all items is disabled.");
            return;
        }
        const confirmation = window.confirm("Are you sure you want to delete all items from your portfolio? This action cannot be undone.");
        if (confirmation) {
            trackedItems = [];
            saveItems(); // Save empty array to localStorage
            searchQuery = ''; // Reset search query
            portfolioSearchInput.value = ''; // Clear search input
            clearSearchBtn.style.display = 'none'; // Hide clear search button
            showTableLoading();
            await renderItems(); // Re-render the table (will be empty)
                               // renderItems calls updateStatistics internally
            hideTableLoading();
            displayError("All items have been deleted."); // Provide feedback
        }
    });
    // --- END DELETE ALL FUNCTIONALITY ---

    // --- ACTIONS DROPDOWN FUNCTIONALITY ---
    if (actionsDropdownBtn && actionsDropdownContent) {
        actionsDropdownBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent the document click listener from immediately closing it
            const isShown = actionsDropdownContent.classList.toggle('show');
            actionsDropdownBtn.classList.toggle('open', isShown);
        });

        // Close dropdown if an item inside is clicked
        actionsDropdownContent.addEventListener('click', (e) => {
            if (e.target.closest('.dropdown-item-btn')) {
                actionsDropdownContent.classList.remove('show');
                actionsDropdownBtn.classList.remove('open');
            }
        });
    }
    // --- END ACTIONS DROPDOWN FUNCTIONALITY ---

    // --- SHAREABLE LINK FUNCTIONALITY ---
    function generateShareableLink() {
        if (!trackedItems.length) {
            alert("Your portfolio is empty. Add some items to share!");
            return;
        }

        // Create a simplified version of items for the link to keep it shorter
        const itemsToShare = trackedItems.map(item => ({
            i: item.id,         // item ID
            p: item.purchasePrice, // purchase price
            q: item.quantity    // quantity
        }));

        const data = JSON.stringify(itemsToShare);
        const encodedData = btoa(data); // Base64 encode
        const shareLink = `${window.location.origin}${window.location.pathname}?shared=${encodedData}`;

        navigator.clipboard.writeText(shareLink).then(() => {
            alert("Shareable link copied to clipboard!");
        }).catch(err => {
            console.error('Failed to copy link: ', err);
            alert("Failed to copy link. You can manually copy it from the console or try again.");
            prompt("Copy this link:", shareLink); // Fallback for browsers that don't support clipboard API well or in non-secure contexts
        });
    }

    // Helper function to apply default sort and update UI
    async function applyDefaultSortAndIndicators() {
        if (trackedItems.length > 0) {
            currentSort = { column: 'profitLoss', direction: 'desc' };
            // Assuming cachedLatestPrices is populated by a preceding renderItems call.
            // sortItemsWithPriceData will fetch if cachedLatestPrices is null and pricesData arg is null.
            await sortItemsWithPriceData(currentSort.column, currentSort.direction, cachedLatestPrices);
            reorderTableRows();
            updateSortIndicators(currentSort.column, currentSort.direction);
        }
    }

    async function loadFromShareableLink(encodedData) {
        try {
            const decodedData = atob(encodedData); // Base64 decode
            const sharedItemsData = JSON.parse(decodedData);

            if (!Array.isArray(sharedItemsData)) {
                throw new Error("Invalid shared data format.");
            }

            await loadItemMapping(); // Ensure itemMapping is loaded
            if (!itemMapping) {
                displayError("Failed to load item mapping. Cannot display shared portfolio.");
                return;
            }
            
            const itemsFromLink = [];
            for (const sharedItem of sharedItemsData) {
                // Find the full item details from our itemMapping using the ID
                const fullItemDetails = Object.values(itemMapping).find(mapItem => mapItem.id === sharedItem.i);
                if (fullItemDetails) {
                    itemsFromLink.push({
                        uniqueId: `shared-${fullItemDetails.id}-${Math.random().toString(36).substr(2, 5)}`, // Generate a unique ID for rendering
                        id: fullItemDetails.id,
                        name: fullItemDetails.name,
                        purchasePrice: sharedItem.p,
                        quantity: sharedItem.q,
                        icon: fullItemDetails.icon,
                        currentPrice: null // Will be fetched by renderItems
                    });
                } else {
                    console.warn(`Item ID ${sharedItem.i} from shared link not found in mapping.`);
                }
            }
            trackedItems = itemsFromLink;
            isReadOnlyMode = true;
            enterReadOnlyMode();
            await renderItems(true); // Render the shared items
            await applyDefaultSortAndIndicators(); // Apply default sort after rendering

        } catch (error) {
            console.error("Error loading from shareable link:", error);
            alert("Could not load the shared portfolio. The link might be corrupted or invalid.");
            // Fallback to normal loading if shared link is bad
            trackedItems = JSON.parse(localStorage.getItem('osrsMerchItems')) || [];
            await renderItems(true);
            await applyDefaultSortAndIndicators(); // Apply default sort to fallback
        }
    }

    function enterReadOnlyMode() {
        // Hide or disable interactive elements
        if (showAddItemModalBtn) showAddItemModalBtn.style.display = 'none';
        if (actionsDropdownBtn) {
             // Hide specific dropdown items instead of the whole button for clarity
            if (importBtn) importBtn.style.display = 'none';
            if (deleteAllBtn) deleteAllBtn.style.display = 'none';
            if (shareBtn) shareBtn.style.display = 'none'; // Can't re-share a shared view
        }
        
        // Disable portfolio search input if it makes sense for read-only
        // if (portfolioSearchInput) portfolioSearchInput.disabled = true;

        // Add a banner or indicator
        const readOnlyBanner = document.createElement('div');
        readOnlyBanner.style.textAlign = 'center';
        readOnlyBanner.style.padding = 'var(--spacing-sm)';
        readOnlyBanner.style.background = 'var(--accent-primary)';
        readOnlyBanner.style.color = 'white';
        readOnlyBanner.style.fontWeight = 'bold';
        readOnlyBanner.style.borderRadius = 'var(--radius-md)';
        readOnlyBanner.style.margin = 'var(--spacing-md) 0';
        
        const bannerText = document.createElement('span');
        bannerText.textContent = 'Viewing a shared portfolio (Read-Only). ';
        
        const portfolioLink = document.createElement('a');
        portfolioLink.href = window.location.origin + window.location.pathname;
        portfolioLink.textContent = 'View your portfolio';
        portfolioLink.style.color = 'white'; // Ensure link is visible on banner background
        portfolioLink.style.textDecoration = 'underline';

        readOnlyBanner.appendChild(bannerText);
        readOnlyBanner.appendChild(portfolioLink);
        
        const mainContainer = document.querySelector('.app-main');
        if (mainContainer && mainContainer.firstChild) {
            mainContainer.insertBefore(readOnlyBanner, mainContainer.firstChild);
        } else if (mainContainer) {
            mainContainer.appendChild(readOnlyBanner);
        }

        // Adjust .items-section max-height to account for the banner
        if (readOnlyBanner.offsetHeight > 0) {
            const itemsSection = document.querySelector('.items-section');
            if (itemsSection) {
                const bannerHeight = readOnlyBanner.offsetHeight;
                const bannerComputedStyle = getComputedStyle(readOnlyBanner);
                const bannerMarginTop = parseFloat(bannerComputedStyle.marginTop);
                const bannerMarginBottom = parseFloat(bannerComputedStyle.marginBottom);
                const totalBannerSpace = bannerHeight + bannerMarginTop + bannerMarginBottom;
                
                document.documentElement.style.setProperty('--banner-height-adjustment', `${totalBannerSpace}px`);
                document.body.classList.add('read-only-active');
            }
        }

        // Prevent modals from opening (though buttons are hidden, good for safety)
        // AddItemModal will not open because its button is hidden.
        // EditItemModal is triggered by row click, that needs to be disabled too.
        // This is handled in renderItems by not adding the event listener.
    }

    if (shareBtn) {
        shareBtn.addEventListener('click', generateShareableLink);
    }
    // --- END SHAREABLE LINK FUNCTIONALITY ---

    // Helper function to format input value with commas on blur
    function formatInputWithCommasOnBlur(inputElement) {
        inputElement.addEventListener('blur', () => {
            let valueToSet = inputElement.value; // Start with current value
            const valueString = inputElement.value.replace(/,/g, '');
            const numberValue = parseFloat(valueString);

            if (!isNaN(numberValue)) {
                if (inputElement.id === 'quantity' || inputElement.id === 'edit-quantity') {
                    if (Number.isInteger(parseFloat(valueString))) {
                        valueToSet = formatCurrency(parseInt(numberValue, 10));
                    } else {
                        // If user entered decimals for quantity, validation should catch it.
                        // We format what they entered or default to 0 if it becomes NaN after specific parsing.
                        const intVal = parseInt(numberValue, 10);
                        valueToSet = formatCurrency(isNaN(intVal) ? 0 : intVal); 
                    }
                } else { // For purchase price
                    valueToSet = formatCurrency(numberValue);
                }
            } else if (inputElement.value.trim() !== '') {
                // If it's not a valid number but was not empty, set to '0'
                valueToSet = '0';
            } // If it was empty or just whitespace, do nothing (let placeholder show or be empty)
            
            inputElement.value = valueToSet;
        });
    }

    // Apply auto-formatting to relevant input fields
    formatInputWithCommasOnBlur(purchasePriceInput);
    formatInputWithCommasOnBlur(quantityInput);
    formatInputWithCommasOnBlur(document.getElementById('edit-purchase-price'));
    formatInputWithCommasOnBlur(document.getElementById('edit-quantity'));

    // Initial load
    loadItemMapping().then(async () => {
        const urlParams = new URLSearchParams(window.location.search);
        const sharedData = urlParams.get('shared');

        if (sharedData) {
            await loadFromShareableLink(sharedData);
        } else {
            trackedItems = JSON.parse(localStorage.getItem('osrsMerchItems')) || [];
            await renderItems(true); // Pass true for initial load to show spinner
            await applyDefaultSortAndIndicators(); // Apply default sort after rendering from localStorage
        }
    }).catch(error => {
        console.error("Error during initial load:", error);
        displayError("Failed to initialize item data. Please refresh the page.");
    });
});