import { OSRS_API_BASE_URL, USER_AGENT } from './config.js';

async function fetchAPI(endpoint) {
    try {
        const response = await fetch(`${OSRS_API_BASE_URL}/${endpoint}`, {
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
        throw error;
    }
}

export async function getLatestPrices() {
    const response = await fetchAPI('latest');
    return response ? response.data : null;
}

export async function getItemMapping() {
    const mappingData = await fetchAPI('mapping');
    if (!mappingData) return null;

    const itemMapping = {};
    mappingData.forEach(item => {
        itemMapping[item.name.toLowerCase()] = item;
    });
    return itemMapping;
} 