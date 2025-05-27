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
    const tableLoadingOverlay = document.getElementById('table-loading-overlay');
    
    // Stats toggle elements
    const statsToggle = document.getElementById('stats-toggle');
    const statsContainer = document.getElementById('stats-container');
    const summaryItemsEl = document.getElementById('summary-items');
    const summaryPlEl = document.getElementById('summary-pl');
    
    // Portfolio search elements
    const portfolioSearchInput = document.getElementById('portfolio-search');
    const clearSearchBtn = document.getElementById('clear-search');

    const OSRS_API_BASE_URL = 'https://prices.runescape.wiki/api/v1/osrs';
    const OSRS_WIKI_IMG_BASE_URL = 'https://oldschool.runescape.wiki/images/';
    const USER_AGENT = 'merch_tracker_app - YOUR_DISCORD_OR_EMAIL'; // PLEASE REPLACE WITH ACTUAL CONTACT

    let trackedItems = JSON.parse(localStorage.getItem('osrsMerchItems')) || [];
    let itemMapping = null;
    let editingItemId = null;
    let currentSort = { column: null, direction: 'asc' };
    let searchQuery = '';

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
                    // This will be handled with current price data
                    aValue = 0;
                    bValue = 0;
                    break;
                case 'profitLoss':
                    // This will be handled with current price data
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

    async function sortItemsWithPriceData(column, direction = 'asc') {
        if (column !== 'currentPrice' && column !== 'profitLoss') {
            sortItems(column, direction);
            return;
        }

        // For current price and profit/loss, we need current price data
        const latestPricesData = await fetchAPI('latest');
        
        trackedItems.sort((a, b) => {
            let aValue = 0, bValue = 0;
            
            if (latestPricesData && latestPricesData.data) {
                if (column === 'currentPrice') {
                    aValue = getCurrentPrice(a.id, latestPricesData.data) || 0;
                    bValue = getCurrentPrice(b.id, latestPricesData.data) || 0;
                } else if (column === 'profitLoss') {
                    const aCurrentPrice = getCurrentPrice(a.id, latestPricesData.data);
                    const bCurrentPrice = getCurrentPrice(b.id, latestPricesData.data);
                    
                    if (aCurrentPrice) {
                        const aInvestment = a.purchasePrice * a.quantity;
                        const aCurrentValue = aCurrentPrice * a.quantity;
                        aValue = aCurrentValue - aInvestment;
                    }
                    
                    if (bCurrentPrice) {
                        const bInvestment = b.purchasePrice * b.quantity;
                        const bCurrentValue = bCurrentPrice * b.quantity;
                        bValue = bCurrentValue - bInvestment;
                    }
                }
            }
            
            return direction === 'asc' ? aValue - bValue : bValue - aValue;
        });
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

    function showSearchResults() {
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
            td.colSpan = 6;
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
        
        // Update search statistics
        updateSearchStatistics(filteredItems);
    }

    function updateSearchStatistics(filteredItems) {
        // Only update statistics for visible/filtered items
        if (searchQuery.trim()) {
            // For search results, we need to calculate statistics from visible items only
            updateStatisticsForItems(filteredItems);
        } else {
            // For all items, use the standard update
            updateStatistics();
        }
    }

    function updateStatisticsForItems(items) {
        if (!items.length) {
            totalItemsEl.textContent = '0';
            totalInvestmentEl.textContent = '0';
            currentValueEl.textContent = '0';
            totalProfitLossEl.textContent = '0';
            totalProfitLossEl.className = 'stat-value';
            
            summaryItemsEl.textContent = '0';
            summaryPlEl.textContent = '0';
            summaryPlEl.className = 'summary-pl';
            return;
        }

        let totalInvestment = 0;
        let totalCurrentValue = 0;

        // Get current prices for calculation
        fetchAPI('latest').then(latestPricesData => {
            for (const item of items) {
                const investment = item.purchasePrice * item.quantity;
                totalInvestment += investment;

                if (latestPricesData && latestPricesData.data && latestPricesData.data[item.id]) {
                    const currentPrice = getCurrentPrice(item.id, latestPricesData.data);
                    if (currentPrice !== null) {
                        totalCurrentValue += currentPrice * item.quantity;
                    } else {
                        totalCurrentValue += investment;
                    }
                } else {
                    totalCurrentValue += investment;
                }
            }

            const totalProfitLoss = totalCurrentValue - totalInvestment;

            totalItemsEl.textContent = items.length.toString();
            totalInvestmentEl.textContent = totalInvestment.toLocaleString();
            currentValueEl.textContent = totalCurrentValue.toLocaleString();
            
            totalProfitLossEl.textContent = totalProfitLoss.toLocaleString();
            totalProfitLossEl.className = totalProfitLoss > 0 ? 'stat-value profit' : 
                                          totalProfitLoss < 0 ? 'stat-value loss' : 'stat-value';

            summaryItemsEl.textContent = items.length.toString();
            summaryPlEl.textContent = totalProfitLoss.toLocaleString();
            summaryPlEl.className = totalProfitLoss > 0 ? 'summary-pl profit' : 
                                   totalProfitLoss < 0 ? 'summary-pl loss' : 'summary-pl';
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
            div.textContent = item.name;
            div.addEventListener('click', () => selectItem(item));
            itemDropdown.appendChild(div);
        });

        itemDropdown.classList.add('show');
        selectedIndex = -1;
    }

    function hideDropdown() {
        itemDropdown.classList.remove('show');
        selectedIndex = -1;
    }

    function selectItem(item) {
        itemNameInput.value = item.name;
        hideDropdown();
        purchasePriceInput.focus();
    }

    function highlightItem(index) {
        const items = itemDropdown.querySelectorAll('.dropdown-item');
        items.forEach((item, i) => {
            item.classList.toggle('highlighted', i === index);
        });
    }

    function saveItems() {
        localStorage.setItem('osrsMerchItems', JSON.stringify(trackedItems));
    }

    function updateStatistics(latestPricesData) {
        if (!trackedItems.length) {
            totalItemsEl.textContent = '0';
            totalInvestmentEl.textContent = '0';
            currentValueEl.textContent = '0';
            totalProfitLossEl.textContent = '0';
            totalProfitLossEl.className = 'stat-value';
            
            // Update summary for mobile toggle
            summaryItemsEl.textContent = '0';
            summaryPlEl.textContent = '0';
            summaryPlEl.className = 'summary-pl';
            return;
        }

        let totalInvestment = 0;
        let totalCurrentValue = 0;

        for (const item of trackedItems) {
            const investment = item.purchasePrice * item.quantity;
            totalInvestment += investment;

            if (latestPricesData && latestPricesData.data && latestPricesData.data[item.id]) {
                const priceInfo = latestPricesData.data[item.id];
                let currentPrice = null;

                if (priceInfo.high !== null && priceInfo.low !== null) {
                    currentPrice = Math.round((priceInfo.high + priceInfo.low) / 2);
                } else if (priceInfo.high !== null) {
                    currentPrice = priceInfo.high;
                } else if (priceInfo.low !== null) {
                    currentPrice = priceInfo.low;
                }

                if (currentPrice !== null) {
                    totalCurrentValue += currentPrice * item.quantity;
                } else {
                    totalCurrentValue += investment; // Fallback to investment if no price data
                }
            } else {
                totalCurrentValue += investment; // Fallback to investment if no price data
            }
        }

        const totalProfitLoss = totalCurrentValue - totalInvestment;

        totalItemsEl.textContent = trackedItems.length.toString();
        totalInvestmentEl.textContent = totalInvestment.toLocaleString();
        currentValueEl.textContent = totalCurrentValue.toLocaleString();
        
        totalProfitLossEl.textContent = totalProfitLoss.toLocaleString();
        totalProfitLossEl.className = totalProfitLoss > 0 ? 'stat-value profit' : 
                                      totalProfitLoss < 0 ? 'stat-value loss' : 'stat-value';

        // Update summary for mobile toggle
        summaryItemsEl.textContent = trackedItems.length.toString();
        summaryPlEl.textContent = totalProfitLoss.toLocaleString();
        summaryPlEl.className = totalProfitLoss > 0 ? 'summary-pl profit' : 
                               totalProfitLoss < 0 ? 'summary-pl loss' : 'summary-pl';
    }

    async function renderItems(showLoading = true) {
        const startTime = Date.now();
        
        if (showLoading) {
            showTableLoading();
        }
        
        itemListBody.innerHTML = ''; 
        if (!trackedItems.length) {
            if (showLoading) {
                // Ensure minimum 1 second loading time
                const elapsed = Date.now() - startTime;
                const remaining = Math.max(0, 500 - elapsed);
                await new Promise(resolve => setTimeout(resolve, remaining));
                hideTableLoading();
            }
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.textContent = 'No items tracked yet. Add some!';
            td.colSpan = 6; // Updated colspan for new table structure (removed Actions column)
            td.classList.add('no-items-cell');
            tr.appendChild(td);
            itemListBody.appendChild(tr);
            updateStatistics(null);
            return;
        }

        const latestPricesData = await fetchAPI('latest');
        if (!latestPricesData || !latestPricesData.data) {
            if (!errorMessageP.classList.contains('active')) {
                displayError('Could not fetch latest prices. Displaying stored data.');
            }
        } else {
            if (errorMessageP.textContent === 'Could not fetch latest prices. Displaying stored data.') {
                displayError('');
            }
        }

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

            // Item Cell (Icon + Name)
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
            
            const itemName = document.createElement('span');
            itemName.classList.add('item-name');
            itemName.textContent = item.name;
            
            itemContainer.appendChild(iconImg);
            itemContainer.appendChild(itemName);
            itemCell.appendChild(itemContainer);
            tr.appendChild(itemCell);

            // Purchase Price Cell
            const purchasePriceCell = createCell('', 'Purchase Price');
            purchasePriceCell.innerHTML = `<span class="currency">${item.purchasePrice.toLocaleString()}</span>`;
            tr.appendChild(purchasePriceCell);

            // Quantity Cell
            tr.appendChild(createCell(item.quantity.toLocaleString(), 'Qty'));
            
            // Investment Cell
            const totalInvestment = item.purchasePrice * item.quantity;
            const investmentCell = createCell('', 'Investment');
            investmentCell.innerHTML = `<span class="currency">${totalInvestment.toLocaleString()}</span>`;
            tr.appendChild(investmentCell);

            // Current Price Cell
            let currentPrice = null;
            const currentPriceCell = createCell('', 'Current Price');

            if (latestPricesData && latestPricesData.data && latestPricesData.data[item.id]) {
                const priceInfo = latestPricesData.data[item.id];
                const currentPriceHigh = priceInfo.high;
                const currentPriceLow = priceInfo.low;

                if (currentPriceHigh !== null && currentPriceLow !== null) {
                    currentPrice = Math.round((currentPriceHigh + currentPriceLow) / 2);
                    currentPriceCell.innerHTML = `<span class="currency">${currentPrice.toLocaleString()}</span>`;
                } else if (currentPriceHigh !== null) {
                    currentPrice = currentPriceHigh;
                    currentPriceCell.innerHTML = `<span class="currency">${currentPrice.toLocaleString()}</span>`;
                } else if (currentPriceLow !== null) {
                    currentPrice = currentPriceLow;
                    currentPriceCell.innerHTML = `<span class="currency">${currentPrice.toLocaleString()}</span>`;
                } else {
                    currentPriceCell.innerHTML = '<span class="text-muted">N/A</span>';
                }
            } else {
                currentPriceCell.innerHTML = '<span class="text-muted">N/A</span>';
            }
            tr.appendChild(currentPriceCell);

            // Profit/Loss Cell
            const profitLossCell = createCell('', 'P&L');
            if (currentPrice !== null) {
                const potentialSale = currentPrice * item.quantity;
                const profitLoss = potentialSale - totalInvestment;
                const profitClass = profitLoss > 0 ? 'profit' : (profitLoss < 0 ? 'loss' : 'neutral');
                profitLossCell.innerHTML = `<span class="${profitClass} currency">${profitLoss.toLocaleString()}</span>`;
            } else {
                profitLossCell.innerHTML = '<span class="neutral">N/A</span>';
            }
            tr.appendChild(profitLossCell);

            // Add click handler for row editing
            tr.addEventListener('click', () => openEditModal(item.uniqueId));

            itemListBody.appendChild(tr);
        }
        
        // Update statistics after rendering items
        updateStatistics(latestPricesData);
        
        if (showLoading) {
            // Ensure minimum 1 second loading time
            const elapsed = Date.now() - startTime;
            const remaining = Math.max(0, 1000 - elapsed);
            await new Promise(resolve => setTimeout(resolve, remaining));
            hideTableLoading();
        }
    }

    async function addItem() {
        displayError('');
        const name = itemNameInput.value.trim();
        const purchasePrice = parseInt(purchasePriceInput.value);
        const quantity = parseInt(quantityInput.value);

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
        addItemModal.style.display = 'block';
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
        document.getElementById('edit-item-name').value = item.name;
        document.getElementById('edit-purchase-price').value = item.purchasePrice;
        document.getElementById('edit-quantity').value = item.quantity;
        
        displayEditError('');
        editItemModal.style.display = 'block';
        document.getElementById('edit-purchase-price').focus();
    }

    function closeEditModal() {
        editItemModal.style.display = 'none';
        editingItemId = null;
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
        if (event.target === addItemModal || (event.target.classList.contains('modal-backdrop') && addItemModal.style.display === 'block')) {
            closeModal();
        }
        if (event.target === editItemModal || (event.target.classList.contains('modal-backdrop') && editItemModal.style.display === 'block')) {
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

        const purchasePrice = parseInt(document.getElementById('edit-purchase-price').value);
        const quantity = parseInt(document.getElementById('edit-quantity').value);

        if (isNaN(purchasePrice) || purchasePrice <= 0 || isNaN(quantity) || quantity <= 0) {
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
        }
    });

    deleteItemBtn.addEventListener('click', async () => {
        if (!editingItemId) return;
        
        const item = trackedItems.find(item => item.uniqueId === editingItemId);
        if (item && confirm(`Are you sure you want to delete "${item.name}"?`)) {
            await removeItem(editingItemId);
            closeEditModal();
        }
    });

    refreshPricesBtn.addEventListener('click', async () => {
        displayError('');
        refreshPricesBtn.disabled = true;
        refreshPricesBtn.innerHTML = '<span class="btn-icon">⏳</span>Refreshing...';
        refreshPricesBtn.classList.add('loading');
        
        try {
            await renderItems();
        } finally {
            refreshPricesBtn.disabled = false;
            refreshPricesBtn.innerHTML = '<span class="btn-icon">🔄</span>Refresh';
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

    itemNameInput.addEventListener('keydown', (e) => {
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
                e.preventDefault();
                if (selectedIndex >= 0 && filteredItems[selectedIndex]) {
                    selectItem(filteredItems[selectedIndex]);
                }
                break;
            case 'Escape':
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
            td.colSpan = 6;
            td.classList.add('no-items-cell');
            tr.appendChild(td);
            tbody.appendChild(tr);
        }
    }

    // Function to update price-dependent cells without full re-render
    async function updatePriceDependentCells() {
        const latestPricesData = await fetchAPI('latest');
        if (!latestPricesData || !latestPricesData.data) {
            return latestPricesData;
        }

        const rows = Array.from(itemListBody.querySelectorAll('tr[data-item-id]'));
        
        rows.forEach(row => {
            const uniqueId = row.dataset.itemId;
            const item = trackedItems.find(item => item.uniqueId === uniqueId);
            if (!item) return;

            const cells = row.querySelectorAll('td');
            const currentPriceCell = cells[4]; // Current Price column (0-indexed)
            const profitLossCell = cells[5]; // P&L column

            // Update Current Price Cell
            let currentPrice = null;
            if (latestPricesData.data[item.id]) {
                const priceInfo = latestPricesData.data[item.id];
                const currentPriceHigh = priceInfo.high;
                const currentPriceLow = priceInfo.low;

                if (currentPriceHigh !== null && currentPriceLow !== null) {
                    currentPrice = Math.round((currentPriceHigh + currentPriceLow) / 2);
                    currentPriceCell.innerHTML = `<span class="currency">${currentPrice.toLocaleString()}</span>`;
                } else if (currentPriceHigh !== null) {
                    currentPrice = currentPriceHigh;
                    currentPriceCell.innerHTML = `<span class="currency">${currentPrice.toLocaleString()}</span>`;
                } else if (currentPriceLow !== null) {
                    currentPrice = currentPriceLow;
                    currentPriceCell.innerHTML = `<span class="currency">${currentPrice.toLocaleString()}</span>`;
                } else {
                    currentPriceCell.innerHTML = '<span class="text-muted">N/A</span>';
                }
            } else {
                currentPriceCell.innerHTML = '<span class="text-muted">N/A</span>';
            }

            // Update P&L Cell
            if (currentPrice !== null) {
                const totalInvestment = item.purchasePrice * item.quantity;
                const potentialSale = currentPrice * item.quantity;
                const profitLoss = potentialSale - totalInvestment;
                const profitClass = profitLoss > 0 ? 'profit' : (profitLoss < 0 ? 'loss' : 'neutral');
                profitLossCell.innerHTML = `<span class="${profitClass} currency">${profitLoss.toLocaleString()}</span>`;
            } else {
                profitLossCell.innerHTML = '<span class="neutral">N/A</span>';
            }
        });

        return latestPricesData;
    }

    // Portfolio search event listeners
    portfolioSearchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        showSearchResults();
        
        // Show/hide clear button
        if (searchQuery.trim()) {
            clearSearchBtn.style.display = 'flex';
            portfolioSearchInput.style.paddingRight = '2.5rem';
        } else {
            clearSearchBtn.style.display = 'none';
            portfolioSearchInput.style.paddingRight = '2.5rem';
        }
    });

    clearSearchBtn.addEventListener('click', () => {
        searchQuery = '';
        portfolioSearchInput.value = '';
        clearSearchBtn.style.display = 'none';
        portfolioSearchInput.style.paddingRight = '2.5rem';
        showSearchResults();
        portfolioSearchInput.focus();
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
            const needsApiData = column === 'currentPrice' || column === 'profitLoss';
            if (needsApiData) {
                showTableLoading();
            }
            
            try {
                // For price-dependent sorting, update cells first to avoid flicker
                let latestPricesData = null;
                if (needsApiData) {
                    latestPricesData = await updatePriceDependentCells();
                }
                
                // Sort the items (now with fresh price data if needed)
                await sortItemsWithPriceData(column, direction);
                
                // Update visual indicators
                updateSortIndicators(column, direction);
                
                // Reorder existing table rows instead of full re-render
                if (trackedItems.length > 0 && itemListBody.children.length > 0) {
                    reorderTableRows();
                    
                    // Update statistics with current data
                    if (!latestPricesData) {
                        latestPricesData = await fetchAPI('latest');
                    }
                    updateStatistics(latestPricesData);
                } else {
                    // Full re-render only if table is empty or needs to be built
                    await renderItems(false);
                }
            } finally {
                if (needsApiData) {
                    hideTableLoading();
                }
            }
        });
    });

    // Initial load
    loadItemMapping().then(() => {
        renderItems(false);
    }).catch(error => {
        console.error("Error during initial load:", error);
        displayError("Failed to initialize item data. Please refresh the page.");
    });
});