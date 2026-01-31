const API_URL = "https://script.google.com/macros/s/AKfycbxNZiRcnv-SVDWwmfMt5Os5Ba2CakNVcBhfn4_7epzNgtG8KWN_UQGgjrGj4jfuUnwKKQ/exec";

async function fetchDades() {
    try {
        const response = await fetch(`${API_URL}?action=getDades`);
        const dades = await response.json();
        return dades;
    } catch (error) {
        console.error("Error connectant amb Google Sheets:", error);
    }
}