const { web3WalletService } = require("./src/services/web3WalletService");
async function test() {
    try {
        const mnemonic = await web3WalletService.generateMnemonic();
        console.log("Success:", mnemonic);
    } catch (e) {
        console.error("Error:", e.message);
    }
}
test();
