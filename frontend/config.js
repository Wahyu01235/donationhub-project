// config.js - GANTI DENGAN CONTRACT ADDRESS ANDA
// =========================
// CONTRACT CONFIGURATION
// =========================

const CONFIG = {
    // Network Configuration
    CHAIN_ID_HEX: "0xaa36a7", // Sepolia 11155111
    EXPLORER_TX: "https://sepolia.etherscan.io/tx/",
    
    // ⚠️ GANTI DENGAN CONTRACT ADDRESS ANDA SETELAH DEPLOY
    TNC_ADDRESS: "", // Alamat TinyCoin contract
    HUB_ADDRESS: "", // Alamat DonationHub contract
    
    // ABI (dapat dari Remix setelah compile)
    TNC_ABI: [
        { "constant": true, "inputs": [{"name":"owner","type":"address"}], "name":"balanceOf", "outputs":[{"name":"","type":"uint256"}], "type":"function" },
        { "constant": true, "inputs": [], "name":"decimals", "outputs":[{"name":"","type":"uint8"}], "type":"function" },
        { "constant": true, "inputs": [], "name":"symbol", "outputs":[{"name":"","type":"string"}], "type":"function" },
        { "constant": true, "inputs": [{"name":"owner","type":"address"},{"name":"spender","type":"address"}], "name":"allowance", "outputs":[{"name":"","type":"uint256"}], "type":"function" },
        { "constant": false, "inputs": [{"name":"spender","type":"address"},{"name":"value","type":"uint256"}], "name":"approve", "outputs":[{"name":"","type":"bool"}], "type":"function" }
    ],
    
    HUB_ABI: [
        { "constant": true, "inputs": [], "name":"campaignCount", "outputs":[{"name":"","type":"uint256"}], "type":"function" },
        { "constant": true, "inputs": [{"name":"","type":"uint256"}], "name":"campaigns", "outputs":[
            {"name":"id","type":"uint256"},
            {"name":"creator","type":"address"},
            {"name":"recipient","type":"address"},
            {"name":"title","type":"string"},
            {"name":"totalDonated","type":"uint256"},
            {"name":"active","type":"bool"}
        ], "type":"function" },
        { "constant": true, "inputs": [], "name":"createFee", "outputs":[{"name":"","type":"uint256"}], "type":"function" },
        { "constant": false, "inputs": [{"name":"title","type":"string"},{"name":"recipient","type":"address"}], "name":"createCampaign", "outputs":[], "type":"function" },
        { "constant": false, "inputs": [{"name":"campaignId","type":"uint256"},{"name":"amount","type":"uint256"}], "name":"donate", "outputs":[], "type":"function" },
        { "constant": false, "inputs": [{"name":"campaignId","type":"uint256"}], "name":"deactivateCampaign", "outputs":[], "type":"function" },
        { "anonymous": false, "inputs": [
            {"indexed": true, "name":"id","type":"uint256"},
            {"indexed": true, "name":"creator","type":"address"},
            {"indexed": true, "name":"recipient","type":"address"},
            {"indexed": false, "name":"title","type":"string"}
        ], "name":"CampaignCreated", "type":"event" },
        { "anonymous": false, "inputs": [
            {"indexed": true, "name":"id","type":"uint256"},
            {"indexed": true, "name":"donor","type":"address"},
            {"indexed": true, "name":"recipient","type":"address"},
            {"indexed": false, "name":"amount","type":"uint256"}
        ], "name":"Donated", "type":"event" }
    ]
};

// Export config
const CHAIN_ID_HEX = CONFIG.CHAIN_ID_HEX;
const EXPLORER_TX = CONFIG.EXPLORER_TX;
const TNC_ADDRESS = CONFIG.TNC_ADDRESS;
const HUB_ADDRESS = CONFIG.HUB_ADDRESS;
const TNC_ABI = CONFIG.TNC_ABI;
const HUB_ABI = CONFIG.HUB_ABI;
