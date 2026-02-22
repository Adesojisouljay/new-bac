const axios = require("axios");

async function test() {
    try {
        const response = await axios.get('http://localhost:4001/api/wallet/mnemonic');
        console.log("Success:", response.data);
    } catch (error) {
        console.error("Error:", error.message);
    }
}
test();
