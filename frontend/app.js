// app.js - DonationHub dApp dengan Archive System sebagai Moderation Tool
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
let floatingWalletVisible = false;

// Owner variables
let isContractOwner = false;
let contractOwnerAddress = null;

// Campaign archive system - SEBAGAI MODERATION TOOL
let archivedCampaigns = new Set();  // Campaign yang disembunyikan dari semua user

// =========================
// LOCALSTORAGE FUNCTIONS
// =========================
function saveArchiveToLocalStorage() {
    if (!account || !isContractOwner) return;
    
    const key = `donationhub_archive_${account.toLowerCase()}`;
    const archiveData = {
        archivedCampaigns: Array.from(archivedCampaigns),
        timestamp: Date.now(),
        version: "1.1"  // Version untuk moderasi tool
    };
    
    try {
        localStorage.setItem(key, JSON.stringify(archiveData));
        console.log("Archive saved to localStorage:", {
            count: archivedCampaigns.size,
            campaigns: Array.from(archivedCampaigns)
        });
    } catch (err) {
        console.error("Error saving archive to localStorage:", err);
    }
}

function loadArchiveFromLocalStorage() {
    if (!account) return false;
    
    const key = `donationhub_archive_${account.toLowerCase()}`;
    try {
        const savedData = localStorage.getItem(key);
        if (savedData) {
            const archiveData = JSON.parse(savedData);
            
            // Load archived campaigns
            if (archiveData.archivedCampaigns && Array.isArray(archiveData.archivedCampaigns)) {
                archivedCampaigns = new Set(archiveData.archivedCampaigns);
            }
            
            console.log("Archive loaded from localStorage:", {
                archivedCount: archivedCampaigns.size,
                version: archiveData.version || "1.0"
            });
            
            return true;
        }
    } catch (err) {
        console.error("Error loading archive from localStorage:", err);
    }
    
    return false;
}

function clearArchiveFromLocalStorage() {
    if (!account) return;
    
    const key = `donationhub_archive_${account.toLowerCase()}`;
    try {
        localStorage.removeItem(key);
        console.log("Archive cleared from localStorage");
    } catch (err) {
        console.error("Error clearing archive from localStorage:", err);
    }
}

// =========================
// DOM ELEMENTS
// =========================
let campaignTitleEl, recipientAddressEl, createCampaignBtn;
let createStatusBox, createStatusText, createTxLink;
let refreshCampaignsBtn, campaignsContainer;
let selectedCampaignText, selectedCampaignIdEl, donationAmountEl, donateBtn;
let donateStatusBox, donateStatusText, donateTxLink;
let toast, toastIcon, toastMessage;
let navLinks;

// Header Wallet Elements (COMPACT VERSION)
let headerConnectBtn, headerWalletInfo, headerWalletAddressEl, headerWalletBalanceEl;
let headerCopyBtn, headerLogoutBtn;

// Floating Wallet Elements
let floatingWallet, floatingWalletAddressEl, floatingWalletBalanceEl, floatingWalletNetworkEl;
let floatingCloseBtn, floatingCopyBtn, floatingLogoutBtn;

// =========================
// INITIALIZATION
// =========================
document.addEventListener("DOMContentLoaded", () => {
    initializeDOMElements();
    init();
});

function initializeDOMElements() {
    // Create campaign elements
    campaignTitleEl = document.getElementById("campaign-title");
    recipientAddressEl = document.getElementById("recipient-address");
    createCampaignBtn = document.getElementById("create-campaign-btn");
    createStatusBox = document.getElementById("create-status");
    createStatusText = document.getElementById("create-status-text");
    createTxLink = document.getElementById("create-tx-link");

    // Campaigns list elements
    refreshCampaignsBtn = document.getElementById("refresh-campaigns-btn");
    campaignsContainer = document.getElementById("campaigns-container");

    // Donate section elements
    selectedCampaignText = document.getElementById("selected-campaign-text");
    selectedCampaignIdEl = document.getElementById("selected-campaign-id");
    donationAmountEl = document.getElementById("donation-amount");
    donateBtn = document.getElementById("donate-btn");
    
    donateStatusBox = document.getElementById("donate-status");
    donateStatusText = document.getElementById("donate-status-text");
    donateTxLink = document.getElementById("donate-tx-link");

    // Toast notification elements
    toast = document.getElementById("toast");
    toastIcon = document.getElementById("toast-icon");
    toastMessage = document.getElementById("toast-message");
    
    // Navigation elements
    navLinks = document.querySelectorAll('.nav-link');
    
    // Header wallet elements - COMPACT VERSION
    headerConnectBtn = document.getElementById("header-connect-btn");
    headerWalletInfo = document.getElementById("header-wallet-info");
    headerWalletAddressEl = document.getElementById("header-wallet-address");
    headerWalletBalanceEl = document.getElementById("header-wallet-balance");
    
    // Tombol aksi header wallet
    headerCopyBtn = document.getElementById("header-copy-btn");
    headerLogoutBtn = document.getElementById("header-logout-btn");
    
    // Floating wallet elements
    floatingWallet = document.getElementById("floating-wallet");
    floatingWalletAddressEl = document.getElementById("floating-wallet-address");
    floatingWalletBalanceEl = document.getElementById("floating-wallet-balance");
    floatingWalletNetworkEl = document.getElementById("floating-wallet-network");
    floatingCloseBtn = document.querySelector(".floating-close-btn");
    floatingCopyBtn = document.getElementById("floating-copy-btn");
    floatingLogoutBtn = document.getElementById("floating-logout-btn");
}

function init() {
    // Scroll ke section yang aktif dari URL hash
    if (window.location.hash) {
        setTimeout(() => {
            const targetSection = document.querySelector(window.location.hash);
            if (targetSection) {
                window.scrollTo({
                    top: targetSection.offsetTop - 80,
                    behavior: 'smooth'
                });
                
                // Update nav link aktif
                navLinks.forEach(link => {
                    link.classList.remove('active');
                    if (link.getAttribute('href') === window.location.hash) {
                        link.classList.add('active');
                    }
                });
            }
        }, 100);
    }
    
    // Setup smooth scrolling untuk navigasi
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            const targetId = this.getAttribute('href');
            if (targetId.startsWith('#')) {
                e.preventDefault();
                const targetSection = document.querySelector(targetId);
                if (targetSection) {
                    window.scrollTo({
                        top: targetSection.offsetTop - 80,
                        behavior: 'smooth'
                    });
                    
                    // Update URL hash tanpa scroll tambahan
                    history.pushState(null, null, targetId);
                    
                    // Update active nav link
                    navLinks.forEach(navLink => {
                        navLink.classList.remove('active');
                    });
                    this.classList.add('active');
                }
            }
        });
    });
    
    // Update active nav link saat scroll
    window.addEventListener('scroll', () => {
        const sections = document.querySelectorAll('section[id]');
        const scrollPos = window.scrollY + 100;
        
        let currentSection = '';
        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.clientHeight;
            const sectionId = section.getAttribute('id');
            
            if (scrollPos >= sectionTop && scrollPos < sectionTop + sectionHeight) {
                currentSection = sectionId;
            }
        });
        
        if (currentSection) {
            navLinks.forEach(link => {
                link.classList.remove('active');
                if (link.getAttribute('href') === `#${currentSection}`) {
                    link.classList.add('active');
                }
            });
        }
    });

    // Setup event listeners
    setupEventListeners();
    
    // Check MetaMask availability
    if (!window.ethereum) {
        showToast("MetaMask tidak ditemukan. Install MetaMask.", "error");
        if (headerConnectBtn) {
            headerConnectBtn.textContent = "Install MetaMask";
            headerConnectBtn.onclick = () => window.open("https://metamask.io/download.html", "_blank");
        }
        disableAll();
        return;
    }

    // Initialize app state
    disableAll();
    renderPlaceholder("Silakan connect MetaMask untuk memuat campaign.");
    
    // Check for existing connection
    checkExistingConnection();
}

function setupEventListeners() {
    // Connect wallet button (HEADER COMPACT VERSION)
    if (headerConnectBtn) {
        headerConnectBtn.addEventListener("click", connectWallet);
    }
    
    // Header wallet actions
    if (headerCopyBtn) {
        headerCopyBtn.addEventListener("click", copyAddressToClipboard);
    }
    
    if (headerLogoutBtn) {
        headerLogoutBtn.addEventListener("click", disconnectWallet);
    }
    
    // Floating wallet actions
    if (floatingCloseBtn) {
        floatingCloseBtn.addEventListener("click", () => {
            floatingWallet.classList.remove("show");
            floatingWalletVisible = false;
        });
    }
    if (floatingCopyBtn) {
        floatingCopyBtn.addEventListener("click", copyAddressToClipboard);
    }
    if (floatingLogoutBtn) {
        floatingLogoutBtn.addEventListener("click", disconnectWallet);
    }
    
    // Form submissions
    const createCampaignForm = document.getElementById("create-campaign-form");
    if (createCampaignForm) {
        createCampaignForm.addEventListener("submit", onCreateCampaignOneClick);
    }
    
    if (refreshCampaignsBtn) {
        refreshCampaignsBtn.addEventListener("click", refreshCampaigns);
    }
    
    const donateForm = document.getElementById("donate-form");
    if (donateForm) {
        donateForm.addEventListener("submit", onDonateOneClick);
    }
    
    // Form validation
    if (campaignTitleEl) {
        campaignTitleEl.addEventListener("input", validateCreateForm);
    }
    if (recipientAddressEl) {
        recipientAddressEl.addEventListener("input", validateCreateForm);
        recipientAddressEl.addEventListener("blur", validateAddress);
    }
    if (donationAmountEl) {
        donationAmountEl.addEventListener("input", validateDonateForm);
    }
    
    // Window events
    if (window.ethereum) {
        window.ethereum.on("accountsChanged", handleAccountsChanged);
        window.ethereum.on("chainChanged", handleChainChanged);
    }
    
    // Scroll event for floating wallet
    window.addEventListener("scroll", handleScrollForFloatingWallet);
    
    // Click outside to close floating wallet
    document.addEventListener('click', (e) => {
        if (floatingWalletVisible && 
            floatingWallet && 
            !floatingWallet.contains(e.target) && 
            !e.target.closest('.header-wallet')) {
            floatingWallet.classList.remove("show");
            floatingWalletVisible = false;
        }
    });
}

function updateActiveNavLinkBasedOnScroll() {
    const sections = document.querySelectorAll('section[id]');
    const scrollPos = window.scrollY + 100;
    
    let currentSection = '';
    sections.forEach(section => {
        const sectionTop = section.offsetTop;
        const sectionHeight = section.clientHeight;
        const sectionId = section.getAttribute('id');
        
        if (scrollPos >= sectionTop && scrollPos < sectionTop + sectionHeight) {
            currentSection = sectionId;
        }
    });
    
    if (currentSection) {
        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${currentSection}`) {
                link.classList.add('active');
            }
        });
        history.pushState(null, null, `#${currentSection}`);
    } else {
        // Jika tidak ada section yang aktif, set ke landing
        navLinks.forEach(link => link.classList.remove('active'));
        const landingLink = document.querySelector('a[href="#landing"]');
        if (landingLink) landingLink.classList.add('active');
        history.pushState(null, null, '#landing');
    }
}

async function checkExistingConnection() {
    try {
        if (!window.ethereum) return;
        
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

// =========================
// OWNER CHECK FUNCTIONS
// =========================
async function checkIfUserIsOwner() {
    try {
        if (!hub || !account) {
            isContractOwner = false;
            return false;
        }
        
        contractOwnerAddress = await hub.methods.owner().call();
        isContractOwner = contractOwnerAddress.toLowerCase() === account.toLowerCase();
        
        console.log("Owner check:", {
            contractOwner: contractOwnerAddress,
            user: account,
            isOwner: isContractOwner
        });
        
        return isContractOwner;
    } catch (err) {
        console.error("Error checking owner:", err);
        isContractOwner = false;
        return false;
    }
}

async function displayOwnerBadge() {
    const isOwner = await checkIfUserIsOwner();
    
    // Hapus badge lama jika ada
    const oldBadge = document.getElementById('owner-badge');
    if (oldBadge) oldBadge.remove();
    
    // Tambahkan badge owner di header jika user adalah owner
    if (isOwner) {
        const headerRight = document.querySelector('.header-right');
        if (headerRight) {
            const ownerBadge = document.createElement('div');
            ownerBadge.id = 'owner-badge';
            ownerBadge.className = 'owner-badge';
            ownerBadge.innerHTML = `
                <i class="fas fa-crown"></i>
                <span>Contract Owner</span>
                ${archivedCampaigns.size > 0 ? 
                    `<span class="archive-badge">${archivedCampaigns.size} archived</span>` : ''}
            `;
            
            // Sisipkan sebelum network-badge
            const networkBadge = document.querySelector('.network-badge');
            if (networkBadge) {
                headerRight.insertBefore(ownerBadge, networkBadge);
            } else {
                headerRight.appendChild(ownerBadge);
            }
        }
    }
    
    return isOwner;
}

// =========================
// ARCHIVE FUNCTIONS - MODERATION TOOL
// =========================
function archiveCampaign(campaignId, title) {
    if (!isContractOwner) {
        showToast("Hanya Contract Owner yang bisa meng-archive campaign!", "error");
        return;
    }
    
    if (!confirm(`📁 ARCHIVE - MODERATION ACTION\n\nArchive campaign #${campaignId}?\n\n✅ Akan disembunyikan\n✅ Hanya muncul di Archive Section (owner only)\n✅ Bisa di-restore kapan saja.`)) {
        return;
    }
    
    archivedCampaigns.add(campaignId);
    saveArchiveToLocalStorage();
    
    showToast(`Campaign #${campaignId} di-archive (tersembunyi)`, "success");
    refreshCampaigns();
}

function restoreArchivedCampaign(campaignId) {
    archivedCampaigns.delete(campaignId);
    saveArchiveToLocalStorage();
    
    showToast(`Campaign #${campaignId} dikembalikan ke daftar utama`, "success");
    refreshCampaigns();
}

function clearAllArchived() {
    if (!isContractOwner) {
        showToast("Hanya owner yang bisa clear archive", "error");
        return;
    }
    
    if (archivedCampaigns.size === 0) {
        showToast("Tidak ada campaign yang di-archive", "info");
        return;
    }
    
    if (!confirm(`⚠️  CLEAR ALL ARCHIVED CAMPAIGNS\n\nIni akan menghapus ${archivedCampaigns.size} campaign dari archive:\n\n• Semua campaign akan kembali terlihat\n• Tidak menghapus dari blockchain\n• Hanya menghapus dari daftar archive\n\nLanjutkan?`)) {
        return;
    }
    
    archivedCampaigns.clear();
    saveArchiveToLocalStorage();
    
    showToast(`Semua campaign (${archivedCampaigns.size}) dihapus dari archive`, "success");
    refreshCampaigns();
}

function clearAllOwnerData() {
    if (!isContractOwner) {
        showToast("Hanya owner yang bisa clear data", "error");
        return;
    }
    
    if (!confirm(`⚠️  CLEAR ALL OWNER DATA\n\nIni akan menghapus:\n• Semua archived campaigns (${archivedCampaigns.size})\n\nData akan hilang permanen. Lanjutkan?`)) {
        return;
    }
    
    // Clear from memory
    archivedCampaigns.clear();
    
    // Clear from localStorage
    clearArchiveFromLocalStorage();
    
    // Update UI
    refreshCampaigns();
    
    showToast("Semua data owner telah dihapus", "success");
}

// =========================
// WALLET FUNCTIONS
// =========================
async function connectWallet() {
    try {
        // Set loading state for button
        if (headerConnectBtn) setButtonLoading(headerConnectBtn, "Connecting...");
        
        const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
        account = accounts[0];

        await initializeWeb3();
        await afterConnected();

        showToast("Wallet berhasil terhubung!", "success");
        
    } catch (err) {
        showToast(parseError(err), "error");
    } finally {
        // Reset button
        if (headerConnectBtn) resetButton(headerConnectBtn, `<i class="fas fa-plug"></i> Connect Wallet`);
    }
}

async function initializeWeb3() {
    if (!window.ethereum || !account) return false;
    
    try {
        web3 = new Web3(window.ethereum);
        
        // Periksa config.js sudah dimuat
        if (typeof TNC_ADDRESS === 'undefined' || typeof HUB_ADDRESS === 'undefined') {
            console.error("Config.js belum dimuat atau ada error");
            showToast("Error: Konfigurasi kontrak tidak ditemukan", "error");
            return false;
        }
        
        tnc = new web3.eth.Contract(TNC_ABI, TNC_ADDRESS);
        hub = new web3.eth.Contract(HUB_ABI, HUB_ADDRESS);

        const ok = await checkNetwork();
        if (!ok) return false;

        await loadTokenMeta();
        await loadCreateFee();
        await setupEventSubscriptions();
        
        return true;
    } catch (err) {
        console.error("Error initializing Web3:", err);
        showToast("Gagal menginisialisasi Web3: " + err.message, "error");
        return false;
    }
}

async function checkNetwork() {
    try {
        const chainId = await window.ethereum.request({ method: "eth_chainId" });

        if (chainId !== CHAIN_ID_HEX) {
            // Update floating wallet network status
            if (floatingWalletNetworkEl) {
                floatingWalletNetworkEl.innerHTML = `<i class="fas fa-times-circle"></i> Wrong network`;
                floatingWalletNetworkEl.className = "floating-wallet-status";
                floatingWalletNetworkEl.style.color = "var(--danger-color)";
            }
            
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

        // Update floating wallet network status
        if (floatingWalletNetworkEl) {
            const isOwner = await checkIfUserIsOwner();
            if (isOwner) {
                floatingWalletNetworkEl.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 5px;">
                        <i class="fas fa-crown" style="color: gold;"></i>
                        <span>Owner • Sepolia</span>
                    </div>
                `;
                floatingWalletNetworkEl.style.color = "var(--text-color)";
            } else {
                floatingWalletNetworkEl.innerHTML = `<i class="fas fa-check-circle"></i> Sepolia`;
                floatingWalletNetworkEl.className = "floating-wallet-status";
                floatingWalletNetworkEl.style.color = "var(--success-color)";
            }
        }
        
        return true;
    } catch (error) {
        console.error("Network check error:", error);
        
        if (floatingWalletNetworkEl) {
            floatingWalletNetworkEl.innerHTML = `<i class="fas fa-exclamation-triangle"></i> Network Error`;
            floatingWalletNetworkEl.className = "floating-wallet-status";
            floatingWalletNetworkEl.style.color = "var(--warning-color)";
   
