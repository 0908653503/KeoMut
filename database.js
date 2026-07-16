const fs = require('fs');
const fsPromises = require('fs').promises; 
const path = './data.json';

// =========================================================================
// ⚙️ CẤU HÌNH ĐỒNG BỘ GITHUB API (Đã ẩn token cứng để bảo mật)
const GITHUB_TOKEN = process.env.GITHUB_TOKEN; 
const GITHUB_REPO = "emsgachacity/nhaduc"; 
const GITHUB_FILE_PATH = "data.json"; 
// =========================================================================

if (!GITHUB_TOKEN) {
    console.warn("⚠️ [Database] Không tìm thấy GITHUB_TOKEN trong biến môi trường. Tính năng đồng bộ GitHub sẽ bị vô hiệu hóa!");
}

if (!fs.existsSync(path)) {
    fs.writeFileSync(path, JSON.stringify({ users: {}, taixiuHistory: [], giftcodes: {} }, null, 2));
}

let memoryCache = null;
let isSyncing = false;
let needsGitHubSync = false; 

let isSavingLocal = false;
let pendingLocalSave = false;

function getData() { 
    if (memoryCache) return memoryCache;
    try {
        const raw = fs.readFileSync(path, 'utf8');
        memoryCache = JSON.parse(raw);
        return memoryCache;
    } catch (err) {
        if (memoryCache) return memoryCache;
        return { users: {}, taixiuHistory: [], giftcodes: {} };
    }
}

async function fetchInitialData() {
    if (!GITHUB_TOKEN) return;
    try {
        const getUrl = `https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_FILE_PATH}`;
        const resGet = await fetch(getUrl, {
            headers: {
                "Authorization": `Bearer ${GITHUB_TOKEN}`,
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28"
            }
        }).catch(() => null);

        if (resGet && resGet.ok) {
            const fileData = await resGet.json();
            const contentStr = Buffer.from(fileData.content, 'base64').toString('utf8');
            memoryCache = JSON.parse(contentStr);
            fs.writeFileSync(path, contentStr, 'utf8');
            console.log("📥 [Database] Đã đồng bộ dữ liệu ví từ GitHub khi khởi động bot!");
        }
    } catch (err) {
        console.error("🚨 Lỗi đồng bộ ban đầu từ GitHub:", err.message);
    }
}
fetchInitialData();

async function syncToGitHub(data) {
    if (!GITHUB_TOKEN || isSyncing) return;
    isSyncing = true;
    
    try {
        const contentStr = JSON.stringify(data, null, 2);
        const base64Content = Buffer.from(contentStr, 'utf8').toString('base64');
        const getUrl = `https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_FILE_PATH}`;
        let sha = null;
        
        const resGet = await fetch(getUrl, {
            headers: {
                "Authorization": `Bearer ${GITHUB_TOKEN}`,
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28"
            }
        }).catch(() => null);

        if (resGet && resGet.ok) {
            const fileData = await resGet.json();
            sha = fileData.sha;
        }

        const body = {
            message: "🤖 [Bot System] Đồng bộ dữ liệu ví người chơi real-time",
            content: base64Content
        };
        if (sha) body.sha = sha;

        const resPut = await fetch(getUrl, {
            method: "PUT",
            headers: {
                "Authorization": `Bearer ${GITHUB_TOKEN}`,
                "Content-Type": "application/json",
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28"
            },
            body: JSON.stringify(body)
        });

        if (resPut && resPut.ok) {
            console.log("💾 [Database] Đã sao lưu dữ liệu ví an toàn lên GitHub thành công!");
            needsGitHubSync = false;
        }
        
    } catch (err) {
        console.error("🚨 Lỗi đồng bộ dữ liệu lên GitHub:", err.message);
        needsGitHubSync = true; 
    } finally {
        isSyncing = false;
    }
}

async function processLocalSave() {
    if (isSavingLocal) {
        pendingLocalSave = true; 
        return;
    }
    
    isSavingLocal = true;
    try {
        const dataToSave = JSON.stringify(memoryCache, null, 2);
        await fsPromises.writeFile(path, dataToSave, 'utf8');
    } catch (err) {
        console.error("🚨 Lỗi lưu file cục bộ:", err);
    } finally {
        isSavingLocal = false;
        if (pendingLocalSave) {
            pendingLocalSave = false;
            await processLocalSave();
        }
    }
}

// Hàm cập nhật mới: Tự động gọi đồng bộ GitHub sau khi lưu local thành công
function saveData(data) { 
    memoryCache = data; 
    needsGitHubSync = true;
    processLocalSave().then(() => {
        syncToGitHub(memoryCache);
    }); 
}

// Hàm khởi tạo dữ liệu mẫu tránh trùng lặp code
function createDefaultUser() {
    return { 
        money: 0, 
        lastDaily: 0, 
        maxWinBet: 0,
        streak: 0, 
        maxStreak: 0,
        lastXinTien: 0,     // Thời gian xin tiền gần nhất
        xinTienCount: 0,    // Số lần xin tiền trong ngày
        taixiu: { total: 0, win: 0 },
        domin: { total: 0, win: 0 },
        blackjack: { total: 0, win: 0 },
        slots: { total: 0, win: 0 },
        caothap: { total: 0, win: 0 },    
        baucua: { total: 0, win: 0 }
    };
}

module.exports = {
    getMoney: (userId) => getData().users[userId]?.money || 0,
    
    hasUser: (userId) => !!getData().users[userId],

    getGiftcodes: () => getData().giftcodes || {},

    addMoney: (userId, amount, isWin = null, gameType = null) => {
        const data = getData();
        if (!data.users[userId]) {
            data.users[userId] = createDefaultUser();
        }
        
        const user = data.users[userId];
        user.money += amount;

        if (isWin !== null && gameType) {
            if (!user[gameType]) user[gameType] = { total: 0, win: 0 };
            user[gameType].total += 1;

            if (isWin === true) {
                user[gameType].win += 1;
                user.streak = (user.streak || 0) + 1;
                if (user.streak > (user.maxStreak || 0)) user.maxStreak = user.streak;
                if (amount > (user.maxWinBet || 0)) user.maxWinBet = amount;
            } else if (isWin === false) {
                user.streak = 0; 
            }
        }

        saveData(data); 
        return user.money;
    },

    getDetailedProfile: (userId) => {
        const data = getData();
        const sortedUsers = Object.entries(data.users)
            .map(([id, info]) => ({ id, money: info.money || 0 }))
            .sort((a, b) => b.money - a.money);
        
        const rankIndex = sortedUsers.findIndex(u => u.id === userId);
        const currentRank = rankIndex !== -1 ? rankIndex + 1 : sortedUsers.length + 1;

        if (!data.users[userId]) {
            data.users[userId] = createDefaultUser();
        }

        return { userStats: data.users[userId], rank: currentRank };
    },

    getTop10: () => {
        const data = getData();
        return Object.entries(data.users)
            .map(([id, info]) => ({ id, money: info.money || 0 }))
            .sort((a, b) => b.money - a.money)
            .slice(0, 10);
    },

    doDaily: (userId) => {
        const data = getData();
        if (!data.users[userId]) {
            data.users[userId] = createDefaultUser();
        }
        const now = Date.now();
        const oneDay = 24 * 60 * 60 * 1000; 
        
        if (now - data.users[userId].lastDaily < oneDay) {
            const timeLeft = oneDay - (now - data.users[userId].lastDaily);
            const hours = Math.floor(timeLeft / (1000 * 60 * 60));
            const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
            return { success: false, msg: `⏰ Hãy quay lại sau **${hours} giờ ${minutes} phút**.` };
        }
        
        const gift = 50000; 
        data.users[userId].money = (data.users[userId].money || 0) + gift;
        data.users[userId].lastDaily = now;
        saveData(data);
        return { success: true, money: data.users[userId].money, gift };
    },

    doXinTien: (userId) => {
        const data = getData();
        if (!data.users[userId]) {
            data.users[userId] = createDefaultUser();
        }
        
        const user = data.users[userId];
        const now = new Date();
        const todayString = now.toDateString(); 

        const lastXinDate = user.lastXinTien ? new Date(user.lastXinTien).toDateString() : "";

        if (todayString !== lastXinDate) {
            user.xinTienCount = 0;
        }

        if ((user.xinTienCount || 0) >= 10) {
            const tomorrow = new Date();
            tomorrow.setDate(now.getDate() + 1);
            tomorrow.setHours(0, 0, 0, 0);
            
            const timeLeft = tomorrow - now;
            const hours = Math.floor(timeLeft / (1000 * 60 * 60));
            const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));

            return { 
                success: false, 
                msg: `❌ Bạn đã dùng hết **10/10 lượt** xin tiền trợ cấp của ngày hôm nay!\n⏰ Vui lòng chờ **${hours} giờ ${minutes} phút** nữa để hệ thống reset lượt mới.` 
            };
        }

        const gift = 50000;
        user.money = (user.money || 0) + gift;
        user.xinTienCount = (user.xinTienCount || 0) + 1;
        user.lastXinTien = Date.now();
        
        saveData(data);
        return { success: true, money: user.money, gift, count: user.xinTienCount };
    },

    saveTaiXiuLog: (result) => {
        const data = getData();
        if (!data.taixiuHistory) data.taixiuHistory = [];
        data.taixiuHistory.push(result);
        if (data.taixiuHistory.length > 10) data.taixiuHistory.shift(); 
        saveData(data);
    },

    getTaiXiuHistory: () => {
        return getData().taixiuHistory || [];
    },

    createGiftcode: (codeName, money, maxUses) => {
        const data = getData();
        if (!data.giftcodes) data.giftcodes = {};
        data.giftcodes[codeName] = { money, maxUses, usedUsers: [] };
        saveData(data);
    },

    redeemGiftcode: (userId, codeName) => {
        const data = getData();
        if (!data.giftcodes || !data.giftcodes[codeName]) return { success: false, msg: '❌ Mã quà tặng không tồn tại!' };
        const code = data.giftcodes[codeName];
        
        const now = Date.now();
        const oneDay = 24 * 60 * 60 * 1000;

        const userClaimIndex = code.usedUsers.findIndex(record => record.userId === userId);

        if (userClaimIndex !== -1) {
            const lastClaimedAt = code.usedUsers[userClaimIndex].claimedAt;
            if (now - lastClaimedAt < oneDay) {
                const timeLeft = oneDay - (now - lastClaimedAt);
                const hours = Math.floor(timeLeft / (1000 * 60 * 60));
                const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
                return { 
                    success: false, 
                    msg: `❌ Bạn đã nhận mã này rồi! Hãy quay lại sau **${hours} giờ ${minutes} phút** để nhập lại.` 
                };
            }
        }

        if (code.usedUsers.length >= code.maxUses) return { success: false, msg: '❌ Mã quà tặng đã hết lượt!' };

        if (userClaimIndex !== -1) {
            code.usedUsers[userClaimIndex].claimedAt = now;
        } else {
            code.usedUsers.push({ userId, claimedAt: now });
        }

        if (!data.users[userId]) {
            data.users[userId] = createDefaultUser();
        }
        data.users[userId].money = (data.users[userId].money || 0) + code.money;
        saveData(data);
        return { success: true, money: code.money, total: data.users[userId].money };
    },

    getAllUsers: () => {
        return getData().users || {};
    },

    resetUserMoney: (userId) => {
        const data = getData();
        if (data.users[userId]) { data.users[userId].money = 50000; saveData(data); }
        return 50000;
    },

    resetAllMoney: () => {
        const data = getData();
        for (const id in data.users) { data.users[id].money = 50000; }
        saveData(data);
    }
};

// ... [Giữ nguyên phần code phía trên của database.js] ...

    getAllUsers: () => {
        return getData().users || {};
    },

    resetUserMoney: (userId) => {
        const data = getData();
        if (data.users[userId]) { data.users[userId].money = 50000; saveData(data); }
        return 50000;
    },

    resetAllMoney: () => {
        const data = getData();
        for (const id in data.users) { data.users[id].money = 50000; }
        saveData(data);
    },

    // 🆕 THÊM HÀM XÓA TẤT CẢ GIFTCODE
    clearAllGiftcodes: () => {
        const data = getData();
        data.giftcodes = {}; // Đưa danh sách giftcodes về rỗng
        saveData(data);
        return true;
    },

    // 🆕 THÊM HÀM RESET BẢNG XẾP HẠNG
    // Tùy chọn 1: Xóa hoàn toàn danh sách người chơi khỏi database để làm sạch bảng xếp hạng
    resetLeaderboard: () => {
        const data = getData();
        data.users = {}; // Xóa sạch tất cả tài khoản người chơi
        saveData(data);
        return true;
    }
};