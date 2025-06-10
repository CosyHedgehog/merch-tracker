export function formatCurrency(value) {
    if (typeof value !== 'number' || isNaN(value)) return '0';
    return value.toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    });
}

export function calculatePriceAfterTax(currentPrice) {
    if (currentPrice === null || typeof currentPrice !== 'number' || isNaN(currentPrice)) {
        return null;
    }
    const taxAmount = currentPrice * 0.02;
    const cappedTaxAmount = Math.min(taxAmount, 5000000);
    return Math.round(currentPrice - cappedTaxAmount);
}

export function parseCSV(csvString) {
    const lines = csvString.trim().split('\n');
    if (lines.length < 2) return [];

    const header = lines[0].split(',').map(h => h.trim());
    const expectedHeaders = ['Item Name', 'Purchase Price', 'Quantity'];
    
    if (!expectedHeaders.every(eh => header.includes(eh))) {
        throw new Error("CSV header does not match expected format (Item Name, Purchase Price, Quantity).");
    }

    return lines.slice(1).map(line => {
        const values = line.split(',');
        const item = {};
        header.forEach((colName, index) => {
            if (expectedHeaders.includes(colName)) {
                item[colName] = values[index] ? values[index].trim() : '';
            }
        });
        return item;
    });
}

export function isValidImportedItem(item) {
    return item['Item Name'] &&
           !isNaN(parseFloat(item['Purchase Price'])) &&
           !isNaN(parseInt(item['Quantity'])) &&
           parseInt(item['Quantity']) > 0;
} 