const API_URL = "https://script.google.com/macros/s/AKfycbxhrJwGOTMQsGhMEurvODftQhK80iMbE9_Ml5_U7P1TnjSekdHFpBc1uNQot5bMrhMPVw/exec";

async function fetchDades() {
    try {
        const response = await fetch(`${API_URL}?action=getDades`);
        const dades = await response.json();
        return dades;
    } catch (error) {
        console.error("Error connectant amb Google Sheets:", error);
    }
}