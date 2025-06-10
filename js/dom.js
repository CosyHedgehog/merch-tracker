export const elements = {
    // App container
    appMain: document.querySelector('.app-main'),

    // Modals
    addItemModal: document.getElementById('add-item-modal'),
    editItemModal: document.getElementById('edit-item-modal'),

    // Buttons
    showAddItemModalBtn: document.getElementById('show-add-item-modal-btn'),
    addCloseModalBtn: document.getElementById('add-item-modal').querySelector('.close-btn'),
    editCloseModalBtn: document.getElementById('edit-item-modal').querySelector('.close-btn'),
    addItemBtn: document.getElementById('add-item-btn'),
    saveItemBtn: document.getElementById('save-item-btn'),
    deleteItemBtn: document.getElementById('delete-item-btn'),
    refreshPricesBtn: document.getElementById('refresh-prices-btn'),
    exportBtn: document.getElementById('export-btn'),
    importBtn: document.getElementById('import-btn'),
    deleteAllBtn: document.getElementById('delete-all-btn'),
    clearSearchBtn: document.getElementById('clear-search'),
    shareBtn: document.getElementById('share-btn'),

    // Inputs
    itemNameInput: document.getElementById('item-name'),
    purchasePriceInput: document.getElementById('purchase-price'),
    quantityInput: document.getElementById('quantity'),
    portfolioSearchInput: document.getElementById('portfolio-search'),
    importFileInput: document.getElementById('import-file-input'),
    editPurchasePriceInput: document.getElementById('edit-purchase-price'),
    editQuantityInput: document.getElementById('edit-quantity'),

    // Display areas
    itemListBody: document.getElementById('item-list-body'),
    itemDropdown: document.getElementById('item-dropdown'),
    errorMessageP: document.getElementById('error-message'),
    editErrorMessage: document.getElementById('edit-error-message'),
    tableLoadingOverlay: document.getElementById('table-loading-overlay'),
    
    // Statistics elements
    totalItemsEl: document.getElementById('total-items'),
    totalInvestmentEl: document.getElementById('total-investment'),
    currentValueEl: document.getElementById('current-value'),
    totalProfitLossEl: document.getElementById('total-profit-loss'),
    totalProfitLossPercentEl: document.getElementById('total-profit-loss-percent'),
    totalProfitLossContainer: document.getElementById('total-profit-loss-container'),

    // Summary stats
    statsToggle: document.getElementById('stats-toggle'),
    statsContainer: document.getElementById('stats-container'),
    summaryItemsEl: document.getElementById('summary-items'),
    summaryPlEl: document.getElementById('summary-pl'),

    // Edit modal display
    editModalItemNameDisplay: document.getElementById('edit-modal-item-name-display'),
    editModalIconContainer: document.getElementById('edit-modal-item-icon-container'),

    // Actions Dropdown
    actionsDropdownBtn: document.getElementById('actions-dropdown-btn'),
    actionsDropdownContent: document.getElementById('actions-dropdown-content'),
    
    // Table headers for sorting
    sortableHeaders: document.querySelectorAll('.sortable'),
}; 