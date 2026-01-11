// app.js - TinyCoin Donation dApp Logic
// =========================
// GLOBAL VARIABLES
// =========================
let web3;
let account;
let tnc;
let hub;
let TNC_DECIMALS = 18;
let TNC_SYMBOL = "TNC";
let CREATE_FEE_WEI = null;
let selectedCampaignId = null;
let balanceInterval;
let subscribed = false;

// =========================
// DOM ELEMENTS
// =========================
let connectBtn, walletInfo, walletAddressEl, networkStatusEl, tncBalanceEl;
let copyAddressBtn, logoutBtn;
let campaignTitleEl, recipientAddressEl, createCampaignBtn;
let createStatusBox, createStatusText, createTxLink;
let refreshCampaignsBtn, campaignsContainer;
let selectedCampaignText, selectedCampaignIdEl, donationAmountEl, donateBtn;
let donateStatusBox, donateStatusText, donateTxLink;
let toast, toastIcon, toastMessage;

// =========================
// INITIALIZATION
// =========================
document.addEventListener("DOMContentLoaded", () => {
    initializeDOMElements();
    init();
});

function initializeDOMElements() {
    connectBtn = document.getElementById("connect-btn");
    walletInfo = document.getElementById("wallet-info");
    walletAddressEl = document.getElementById("wallet-address");
    networkStatusEl = document.getElementById("network-status");
    tncBalanceEl = document.getElementById("tnc-balance");
    copyAddressBtn = document.getElementById("copy-address");
    logoutBtn = document.getElementById("logout-btn");

    campaignTitleEl = document.getElementById("campaign-title");
    recipientAddressEl = document.getElementById("recipient-address");
    createCampaignBtn = document.getElementById("create-campaign-btn");
    createStatusBox = document.getElementById("create-status");
    createStatusText = document.getElementById("create-status-text");
    createTxLink = document.getElementById("create-tx-link");

    refreshCampaignsBtn = document.getElementById("refresh-campaigns-btn");
    campaignsContainer = document.getElementById("campaigns-container");

    selectedCampaignText = document.getElementById("selected-campaign-text");
    selectedCampaignIdEl = document.getElementById("selected-campaign-id");
    donationAmountEl = document.getElementById("donation-amount");
    donateBtn = document.getElementById("donate-btn");
    
    donateStatusBox = document.getElementById("donate-status");
    donateStatusText = document.getElementById("donate-status-text");
    donateTxLink = document.getElementById("donate-tx-link");

    toast = document.getElementById("toast");
    toastIcon = document.getElementById("toast-icon");
    toastMessage = document.getElementById("toast-message");
}

function init() {
    if (!window.ethereum) {
        showToast("MetaMask tidak ditemukan. Install MetaMask.", "error");
        connectBtn.textContent = "Install MetaMask";
        connectBtn.onclick = () => window.open("https://metamask.io/download.html", "_blank");
        disableAll();
        return;
    }

    setupEventListeners();
    disableAll();
    renderPlaceholder("Silakan connect MetaMask untuk memuat campaign.");
    
    checkExistingConnection();
}

async function checkExistingConnection() {
    try {
        const accounts = await window.ethereum.request({ method: "eth_accounts" });
        if (accounts && accounts.length > 0) {
            account = accounts[0];
            await initializeWeb3();
            await afterConnected();
        }
    } catch (err) {
        console.log("No existing connection:", err.message);
    }
}

function setupEventListeners() {
    connectBtn.addEventListener("click", connectWallet);
    copyAddressBtn.addEventListener("click", copyAddressToClipboard);
    logoutBtn.addEventListener("click", disconnectWallet);

    document.getElementById("create-campaign-form").addEventListener("submit", onCreateCampaignOneClick);
    refreshCampaignsBtn.addEventListener("click", refreshCampaigns);
    document.getElementById("donate-form").addEventListener("submit", onDonateOneClick);

    campaignTitleEl.addEventListener("input", validateCreateForm);
    recipientAddressEl.addEventListener("input", validateCreateForm);
    donationAmountEl.addEventListener("input", validateDonateForm);
    recipientAddressEl.addEventListener("blur", validateAddress);

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);
}

// =========================
// WALLET FUNCTIONS
// =========================
async function connectWallet() {
    try {
        setButtonLoading(connectBtn, "Connecting...");
        const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
        account = accounts[0];

        await initializeWeb3();
        await afterConnected();

        showToast("Wallet berhasil terhubung!", "success");
    } catch (err) {
        showToast(parseError(err), "error");
    } finally {
        resetButton(connectBtn, `<i class="fas fa-plug"></i> Connect MetaMask`);
    }
}

async function initializeWeb3() {
    web3 = new Web3(window.ethereum);
    tnc = new web3.eth.Contract(TNC_ABI, TNC_ADDRESS);
    hub = new web3.eth.Contract(HUB_ABI, HUB_ADDRESS);

    const ok = await checkNetwork();
    if (!ok) return false;

    await loadTokenMeta();
    await loadCreateFee();
    await setupEventSubscriptions();
    
    return true;
}

async function checkNetwork() {
    try {
        const chainId = await window.ethereum.request({ method: "eth_chainId" });

        if (chainId !== CHAIN_ID_HEX) {
            networkStatusEl.innerHTML = `<i class="fas fa-times-circle"></i> Wrong network`;
            networkStatusEl.className = "status-badge status-error";
            disableAll();
            showToast("Silakan switch ke Sepolia Testnet", "warning");
            
            try {
                await window.ethereum.request({
                    method: "wallet_switchEthereumChain",
                    params: [{ chainId: CHAIN_ID_HEX }],
                });
                setTimeout(() => location.reload(), 1000);
            } catch (switchError) {
                if (switchError.code === 4902) {
                    await window.ethereum.request({
                        method: "wallet_addEthereumChain",
                        params: [{
                            chainId: CHAIN_ID_HEX,
                            chainName: "Sepolia Testnet",
                            rpcUrls: ["https://rpc.sepolia.org"],
                            nativeCurrency: {
                                name: "Sepolia ETH",
                                symbol: "ETH",
                                decimals: 18
                            },
                            blockExplorerUrls: ["https://sepolia.etherscan.io"]
                        }]
                    });
                }
            }
            return false;
        }

        networkStatusEl.innerHTML = `<i class="fas fa-check-circle"></i> Connected to Sepolia`;
        networkStatusEl.className = "status-badge status-success";
        return true;
    } catch (error) {
        console.error("Network check error:", error);
        networkStatusEl.innerHTML = `<i class="fas fa-exclamation-triangle"></i> Network Error`;
        networkStatusEl.className = "status-badge status-error";
        return false;
    }
}

function disconnectWallet() {
    account = null;
    web3 = null;
    tnc = null;
    hub = null;
    selectedCampaignId = null;
    
    if (balanceInterval) {
        clearInterval(balanceInterval);
        balanceInterval = null;
    }
    
    walletInfo.classList.add("hidden");
    connectBtn.classList.remove("hidden");
    walletAddressEl.textContent = "0x0000...0000";
    tncBalanceEl.textContent = "0.00 TNC";
    
    campaignTitleEl.value = "";
    recipientAddressEl.value = "";
    donationAmountEl.value = "";
    selectedCampaignText.textContent = "Klik \"Donate\" pada campaign di daftar";
    selectedCampaignIdEl.value = "";
    
    createStatusBox.classList.add("hidden");
    donateStatusBox.classList.add("hidden");
    
    renderPlaceholder("Silakan connect MetaMask untuk memuat campaign.");
    disableAll();
    
    showToast("Wallet berhasil diputuskan", "success");
    networkStatusEl.innerHTML = `<i class="fas fa-plug"></i> Not Connected`;
    networkStatusEl.className = "status-badge status-warning";
}

async function afterConnected() {
    if (!account) return;

    walletAddressEl.textContent = shorten(account);
    walletInfo.classList.remove("hidden");
    connectBtn.classList.add("hidden");

    refreshCampaignsBtn.disabled = false;
    createCampaignBtn.disabled = false;

    await refreshBalance();
    await refreshCampaigns();
    startBalanceAutoRefresh();

    validateCreateForm();
    validateDonateForm();
}

async function refreshBalance() {
    if (!tnc || !account) return;
    try {
        const bal = await tnc.methods.balanceOf(account).call();
        const decimals = TNC_DECIMALS || 18;
        const formatted = formatUnit(bal, decimals);
        tncBalanceEl.textContent = `${formatted} ${TNC_SYMBOL}`;
    } catch (error) {
        console.error("Error refreshing balance:", error);
        tncBalanceEl.textContent = "Error";
    }
}

function startBalanceAutoRefresh() {
    if (balanceInterval) clearInterval(balanceInterval);
    balanceInterval = setInterval(async () => {
        if (account && tnc) {
            await refreshBalance();
        }
    }, 15000);
}

// =========================
// CREATE CAMPAIGN (One-Click)
// =========================
async function onCreateCampaignOneClick(e) {
    e.preventDefault();

    try {
        if (!(await checkNetwork())) return;

        const title = campaignTitleEl.value.trim();
        const recipient = recipientAddressEl.value.trim();

        if (!title) {
            showToast("Judul campaign wajib diisi.", "warning");
            return;
        }
        
        if (!web3.utils.isAddress(recipient)) {
            showToast("Alamat recipient tidak valid.", "error");
            return;
        }

        if (!CREATE_FEE_WEI) await loadCreateFee();

        setButtonLoading(createCampaignBtn, "Creating...");

        const allowance = await tnc.methods.allowance(account, HUB_ADDRESS).call();
        const needApprove = web3.utils.toBN(allowance).lt(web3.utils.toBN(CREATE_FEE_WEI));

        if (needApprove) {
            setStatus(
                createStatusBox,
                createStatusText,
                createTxLink,
                "pending",
                "Step 1/2: Approve fee 1 TNC di MetaMask..."
            );

            const txApprove = await tnc.methods
                .approve(HUB_ADDRESS, CREATE_FEE_WEI)
                .send({ from: account });

            const approveHash = txApprove.transactionHash;
            setStatus(
                createStatusBox,
                createStatusText,
                createTxLink,
                "success",
                "Approve sukses. Lanjut create campaign...",
                approveHash
            );
            
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        setStatus(
            createStatusBox,
            createStatusText,
            createTxLink,
            "pending",
            needApprove ? "Step 2/2: Create campaign di MetaMask..." : "Create campaign di MetaMask..."
        );

        const txCreate = await hub.methods
            .createCampaign(title, recipient)
            .send({ from: account });

        const createHash = txCreate.transactionHash;
        setStatus(
            createStatusBox,
            createStatusText,
            createTxLink,
            "success",
            "Campaign berhasil dibuat!",
            createHash
        );

        campaignTitleEl.value = "";
        recipientAddressEl.value = "";
        showToast("Campaign berhasil dibuat!", "success");
        await refreshBalance();
        await refreshCampaigns();
        
    } catch (err) {
        setStatus(createStatusBox, createStatusText, createTxLink, "error", parseError(err));
        showToast(parseError(err), "error");
    } finally {
        resetButton(createCampaignBtn, `<i class="fas fa-rocket"></i> Create Campaign`);
        validateCreateForm();
    }
}

// =========================
// CAMPAIGN LIST
// =========================
async function refreshCampaigns() {
    try {
        if (!hub) return;

        renderPlaceholder("Memuat campaign...");
        setButtonLoading(refreshCampaignsBtn, "Loading...");

        const count = Number(await hub.methods.campaignCount().call());

        if (count === 0) {
            renderPlaceholder("Belum ada campaign.");
            return;
        }

        const list = [];
        for (let i = 1; i <= count; i++) {
            try {
                const c = await hub.methods.campaigns(i).call();
                list.push({
                    id: Number(c.id),
                    creator: c.creator,
                    recipient: c.recipient,
                    title: c.title,
                    totalDonated: c.totalDonated,
                    active: c.active
                });
            } catch (err) {
                console.error(`Error loading campaign ${i}:`, err);
            }
        }

        renderCampaigns(list);
    } catch (err) {
        renderPlaceholder("Gagal memuat campaign. " + parseError(err));
    } finally {
        resetButton(refreshCampaignsBtn, `<i class="fas fa-sync-alt"></i> Refresh`);
    }
}

function renderCampaigns(campaigns) {
    campaignsContainer.innerHTML = "";

    if (campaigns.length === 0) {
        renderPlaceholder("Belum ada campaign.");
        return;
    }

    campaigns
        .slice()
        .reverse()
        .forEach((c) => {
            const card = document.createElement("div");
            card.className = "campaign-card";

            const statusClass = c.active ? "active" : "inactive";
            const statusText = c.active ? "Aktif" : "Nonaktif";
            const totalDonated = formatUnit(c.totalDonated, TNC_DECIMALS);
            
            const isCreator = account && c.creator.toLowerCase() === account.toLowerCase();
            const canDelete = isCreator && c.active;

            card.innerHTML = `
                <div class="campaign-header">
                    <div class="campaign-id">#${c.id}</div>
                    <div class="campaign-status ${statusClass}">${statusText}</div>
                </div>
                <div class="campaign-title">${escapeHtml(c.title)}</div>
                <div class="campaign-details">
                    <div class="campaign-detail">
                        <div class="detail-label">Creator</div>
                        <div class="detail-value" title="${c.creator}">
                            ${shorten(c.creator)}
                            ${isCreator ? ' <span class="you-badge">(Anda)</span>' : ''}
                        </div>
                    </div>
                    <div class="campaign-detail">
                        <div class="detail-label">Recipient</div>
                        <div class="detail-value" title="${c.recipient}">${shorten(c.recipient)}</div>
                    </div>
                </div>
                <div class="campaign-total">
                    <i class="fas fa-coins"></i>
                    <span>Total Donated: ${totalDonated} ${TNC_SYMBOL}</span>
                </div>
                <div class="campaign-footer">
                    <button class="btn btn-primary select-campaign-btn" data-id="${c.id}" data-title="${escapeHtml(c.title)}">
                        <i class="fas fa-donate"></i> Donate
                    </button>
                    ${canDelete ? `
                    <button class="btn btn-danger delete-campaign-btn" data-id="${c.id}" data-title="${escapeHtml(c.title)}">
                        <i class="fas fa-trash"></i> Hapus
                    </button>` : ''}
                </div>
            `;

            campaignsContainer.appendChild(card);
        });

    document.querySelectorAll(".select-campaign-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            const id = Number(btn.getAttribute("data-id"));
            const title = btn.getAttribute("data-title");
            selectCampaign(id, title);
        });
    });

    document.querySelectorAll(".delete-campaign-btn").forEach((btn) => {
        btn.addEventListener("click", async () => {
            const id = Number(btn.getAttribute("data-id"));
            const title = btn.getAttribute("data-title");
            await deleteCampaign(id, title);
        });
    });
}

function renderPlaceholder(text) {
    campaignsContainer.innerHTML = `
        <div class="placeholder-text">
            <i class="fas fa-spinner fa-spin"></i>
            <p>${escapeHtml(text)}</p>
        </div>
    `;
}

function selectCampaign(id, title) {
    selectedCampaignId = id;
    selectedCampaignIdEl.value = String(id);
    selectedCampaignText.textContent = `#${id} — ${title}`;
    donationAmountEl.disabled = false;
    donateBtn.disabled = false;
    donationAmountEl.focus();
    showToast(`Campaign #${id} dipilih untuk donasi`, "success");
    validateDonateForm();
}

// =========================
// DELETE CAMPAIGN
// =========================
async function deleteCampaign(campaignId, title) {
    if (!confirm(`Apakah Anda yakin ingin menghapus campaign "#${campaignId} - ${title}"?`)) {
        return;
    }

    try {
        setStatus(donateStatusBox, donateStatusText, donateTxLink, "pending", "Menghapus campaign...");
        
        const tx = await hub.methods
            .deactivateCampaign(campaignId)
            .send({ from: account });

        const txHash = tx.transactionHash;
        setStatus(donateStatusBox, donateStatusText, donateTxLink, "success", "Campaign berhasil dihapus!", txHash);
        
        showToast("Campaign berhasil dihapus!", "success");
        await refreshCampaigns();
        
        if (selectedCampaignId === campaignId) {
            selectedCampaignId = null;
            selectedCampaignText.textContent = "Klik \"Donate\" pada campaign di daftar";
            selectedCampaignIdEl.value = "";
            donationAmountEl.value = "";
            donationAmountEl.disabled = true;
            donateBtn.disabled = true;
        }
        
    } catch (err) {
        setStatus(donateStatusBox, donateStatusText, donateTxLink, "error", parseError(err));
        showToast(parseError(err), "error");
    }
}

// =========================
// DONATE (ONE-CLICK)
// =========================
async function onDonateOneClick(e) {
    e.preventDefault();

    try {
        if (!(await checkNetwork())) return;
        if (!selectedCampaignId) {
            showToast("Pilih campaign dulu dari daftar.", "warning");
            return;
        }

        const amtStr = String(donationAmountEl.value || "").trim();
        if (!amtStr || Number(amtStr) <= 0) {
            showToast("Masukkan jumlah donasi yang valid.", "error");
            return;
        }

        const amountWei = toUnit(amtStr);
        setButtonLoading(donateBtn, "Processing...");

        const allowance = await tnc.methods.allowance(account, HUB_ADDRESS).call();
        const needApprove = web3.utils.toBN(allowance).lt(web3.utils.toBN(amountWei));

        if (needApprove) {
            setStatus(
                donateStatusBox,
                donateStatusText,
                donateTxLink,
                "pending",
                "Step 1/2: Approve donasi di MetaMask..."
            );

            const txApprove = await tnc.methods
                .approve(HUB_ADDRESS, amountWei)
                .send({ from: account });

            const approveHash = txApprove.transactionHash;
            setStatus(
                donateStatusBox,
                donateStatusText,
                donateTxLink,
                "success",
                "Approve sukses. Lanjut donasi...",
                approveHash
            );
            
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        setStatus(
            donateStatusBox,
            donateStatusText,
            donateTxLink,
            "pending",
            needApprove ? "Step 2/2: Donasi di MetaMask..." : "Donasi di MetaMask..."
        );

        const txDonate = await hub.methods
            .donate(selectedCampaignId, amountWei)
            .send({ from: account });

        const donateHash = txDonate.transactionHash;
        setStatus(
            donateStatusBox,
            donateStatusText,
            donateTxLink,
            "success",
            "Donasi berhasil dikirim!",
            donateHash
        );

        donationAmountEl.value = "";
        donateBtn.disabled = true;
        showToast("Donasi berhasil!", "success");
        await refreshBalance();
        await refreshCampaigns();
        
    } catch (err) {
        setStatus(donateStatusBox, donateStatusText, donateTxLink, "error", parseError(err));
        showToast(parseError(err), "error");
    } finally {
        resetButton(donateBtn, `<i class="fas fa-heart"></i> Donate Sekarang`);
        validateDonateForm();
    }
}

// =========================
// FORM VALIDATION
// =========================
function validateAddress() {
    const address = recipientAddressEl.value.trim();
    if (!address) {
        recipientAddressEl.style.borderColor = "";
        return;
    }
    
    if (web3 && !web3.utils.isAddress(address)) {
        recipientAddressEl.style.borderColor = "var(--danger-color)";
        showToast("Alamat tidak valid", "warning");
    } else if (web3 && web3.utils.isAddress(address)) {
        recipientAddressEl.style.borderColor = "var(--success-color)";
    }
}

function validateCreateForm() {
    const titleOk = campaignTitleEl.value.trim().length > 0;
    const addr = recipientAddressEl.value.trim();
    const addrOk = addr.length > 0 && (web3 ? web3.utils.isAddress(addr) : addr.length === 42);
    createCampaignBtn.disabled = !(titleOk && addrOk);
}

function validateDonateForm() {
    const hasCampaign = !!selectedCampaignIdEl.value;
    const amtOk = Number(donationAmountEl.value || 0) > 0;
    donateBtn.disabled = !(hasCampaign && amtOk);
}

// =========================
// EVENT HANDLERS
// =========================
async function handleAccountsChanged(accounts) {
    if (!accounts || accounts.length === 0) {
        disconnectWallet();
    } else if (accounts[0] !== account) {
        account = accounts[0];
        await afterConnected();
        showToast("Akun berubah", "warning");
    }
}

async function handleChainChanged() {
    await checkNetwork();
    await afterConnected();
    showToast("Network berubah", "warning");
}

async function setupEventSubscriptions() {
    if (!hub || subscribed) return;

    try {
        hub.events.CampaignCreated({ fromBlock: "latest" })
            .on("data", async () => {
                console.log("New campaign created event detected");
                await refreshCampaigns();
            })
            .on("error", (err) => console.error("Event error:", err));

        hub.events.Donated({ fromBlock: "latest" })
            .on("data", async () => {
                console.log("New donation event detected");
                await refreshCampaigns();
                await refreshBalance();
            })
            .on("error", (err) => console.error("Event error:", err));

        subscribed = true;
    } catch (err) {
        console.error("Error setting up event subscriptions:", err);
    }
}

// =========================
// HELPER FUNCTIONS
// =========================
async function loadTokenMeta() {
    try {
        TNC_DECIMALS = Number(await tnc.methods.decimals().call());
    } catch {
        TNC_DECIMALS = 18;
    }
    try {
        TNC_SYMBOL = await tnc.methods.symbol().call();
    } catch {
        TNC_SYMBOL = "TNC";
    }
}

async function loadCreateFee() {
    try {
        CREATE_FEE_WEI = await hub.methods.createFee().call();
        console.log("Create Fee:", CREATE_FEE_WEI);
    } catch (err) {
        console.error("Error loading create fee:", err);
        CREATE_FEE_WEI = toUnit("1");
    }
}

function disableAll() {
    createCampaignBtn.disabled = true;
    refreshCampaignsBtn.disabled = true;
    donationAmountEl.disabled = true;
    donateBtn.disabled = true;
}

function setButtonLoading(btn, text) {
    btn.disabled = true;
    btn.dataset._old = btn.innerHTML;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${text}`;
}

function resetButton(btn, html) {
    btn.disabled = false;
    btn.innerHTML = html;
}

function setStatus(box, textEl, linkEl, type, message, txHash) {
    box.classList.remove("hidden", "pending", "success", "error");
    box.classList.add(type);
    textEl.textContent = message;

    if (txHash) {
        linkEl.href = EXPLORER_TX + txHash;
        linkEl.classList.remove("hidden");
    } else {
        linkEl.classList.add("hidden");
    }
    
    box.classList.remove("hidden");
}

function showToast(msg, type) {
    toast.classList.remove("hidden", "success", "error", "warning");
    toast.classList.add(type);

    const icons = {
        'success': 'fa-check-circle',
        'error': 'fa-times-circle',
        'warning': 'fa-exclamation-triangle',
        'info': 'fa-info-circle'
    };
    
    toastIcon.className = `fas ${icons[type] || icons.info}`;
    toastMessage.textContent = msg;
    
    toast.classList.remove("hidden");
    setTimeout(() => toast.classList.add("hidden"), 2500);
}

function copyAddressToClipboard() {
    if (!account) return;
    navigator.clipboard.writeText(account)
        .then(() => showToast("Alamat wallet disalin!", "success"))
        .catch(() => showToast("Gagal menyalin alamat", "error"));
}

// =========================
// UNIT CONVERSION
// =========================
function toUnit(amountStr) {
    if (!web3) return "0";
    
    try {
        const parts = String(amountStr).split(".");
        const whole = parts[0] || "0";
        const frac = (parts[1] || "").padEnd(TNC_DECIMALS, "0").slice(0, TNC_DECIMALS);
        const base = web3.utils.toBN(10).pow(web3.utils.toBN(TNC_DECIMALS));
        const wholeBN = web3.utils.toBN(whole).mul(base);
        const fracBN = web3.utils.toBN(frac || "0");
        return wholeBN.add(fracBN).toString();
    } catch (error) {
        console.error("Error converting to unit:", error);
        return "0";
    }
}

function formatUnit(weiStr, decimals = TNC_DECIMALS) {
    if (!web3 || !weiStr) return "0";
    
    try {
        const bn = web3.utils.toBN(weiStr);
        const base = web3.utils.toBN(10).pow(web3.utils.toBN(decimals));
        const whole = bn.div(base).toString();
        let frac = bn.mod(base).toString().padStart(decimals, "0");
        frac = frac.replace(/0+$/, "");
        
        if (frac.length > 4) {
            frac = frac.substring(0, 4);
        }
        
        return frac ? `${whole}.${frac}` : whole;
    } catch (error) {
        console.error("Error formatting unit:", error);
        return "0";
    }
}

function shorten(addr) {
    if (!addr || addr.length < 10) return "-";
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function escapeHtml(s) {
    if (!s) return "";
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
}

function parseError(err) {
    if (!err) return "Unknown error";
    const msg = err?.message || String(err);
    
    if (msg.includes("User denied") || msg.includes("denied transaction")) 
        return "Transaksi dibatalkan oleh user.";
    if (msg.includes("insufficient funds")) 
        return "Saldo ETH tidak cukup untuk gas fee.";
    if (msg.includes("allowance") || msg.includes("transfer amount exceeds allowance")) 
        return "Allowance tidak cukup, approve terlebih dahulu.";
    if (msg.includes("revert")) {
        if (msg.includes("Campaign not active")) return "Campaign tidak aktif.";
        if (msg.includes("Invalid recipient")) return "Alamat recipient tidak valid.";
        if (msg.includes("Donation failed")) return "Transfer donasi gagal.";
        if (msg.includes("Ownable: caller is not the owner")) return "Hanya owner yang bisa menghapus campaign.";
        return "Smart contract error.";
    }
    
    return msg.length > 100 ? msg.substring(0, 100) + "..." : msg;
}
