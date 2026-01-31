const API_URL = "https://script.google.com/macros/s/AKfycbyc7Bhtvo2dt3588lagysfD_cKezwrgVzn-JpbI7TkTjbzbrpl_9d0oWMuRri71qds2Hw/exec";

async function fetchDades() {
    try {
        const response = await fetch(`${API_URL}?action=getDades`);
        const dades = await response.json();
        return dades;
    } catch (error) {
        console.error("Error connectant amb Google Sheets:", error);
    }
}