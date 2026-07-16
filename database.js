const fs = require('fs');
const fsPromises = require('fs').promises; 
const path = './data.json';

// =========================================================================
// ⚙️ CẤU HÌNH ĐỒNG BỘ GITHUB API
const GITHUB_TOKEN = process.env.GITHUB_TOKEN; 
const GITHUB_REPO = "09086535503/KeoMut"; 
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

function saveData(data) { 
    memoryCache = data; 
    needsGitHubSync = true;
    processLocalSave().then(() => {
        syncToGitHub(memoryCache);
    }); 
}

function createDefaultUser() {
    return { 
        money: 50000, // Đã sửa từ 0 thành 50000 để tránh lỗi reset tài sản khi người dùng mới nhắn tin
        lastDaily: 0, 
        maxWinBet: 0,
        streak: 0, 
        maxStreak: 0,
        lastXinTien: 0,     
        xinTienCount: 0,    
        taixiu: { total: 0, win: 0 },
        domin: { total: 0, win: 0 },
        blackjack: { total: 0, win: 0 },
        slots: { total: 0, win: 0 },
        caothap: { total: 0, win: 0 },    
        baucua: { total: 0, win: 0 },
        xuxi: { total: 0, win: 0 },
        crash: { total: 0, win: 0 }
    };
}

function getVNStringDate() {
    const d = new Date();
    const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
    return new Date(utc + (3600000 * 7)).toDateString();
}

function getMsUntilVNTomorrow() {
    const d = new Date();
    const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
    const vnTime = new Date(utc + (3600000 * 7));
    
    const vnTomorrow = new Date(vnTime);
    vnTomorrow.setDate(vnTime.getDate() + 1);
    vnTomorrow.setHours(0, 0, 0, 0);
    
    return vnTomorrow - vnTime;
}

// Hàm bổ trợ để khởi tạo cấu trúc guild/user nếu chưa có trong data
function ensureUserExists(data, guildId, userId) {
    if (!data.users) data.users = {};
    if (!data.users[guildId]) data.users[guildId] = {};
    if (!data.users[guildId][userId]) data.users[guildId][userId] = createDefaultUser();
    return data.users[guildId][userId];
}

module.exports = {
    getMoney: (guildId, userId) => {
        const data = getData();
        return data.users?.[guildId]?.[userId]?.money !== undefined ? data.users[guildId][userId].money : 50000;
    },
    
    hasUser: (guildId, userId) => {
        const data = getData();
        return !!data.users?.[guildId]?.[userId];
    },

    getGiftcodes: () => getData().giftcodes || {},

    addMoney: (guildId, userId, amount, isWin = null, gameType = null) => {
        const data = getData();
        const user = ensureUserExists(data, guildId, userId);
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

    getDetailedProfile: (guildId, userId) => {
        const data = getData();
        const guildUsers = data.users?.[guildId] || {};
        
        const sortedUsers = Object.entries(guildUsers)
            .map(([id, info]) => ({ id, money: info.money !== undefined ? info.money : 50000 }))
            .sort((a, b) => b.money - a.money);
            
        const rankIndex = sortedUsers.findIndex(u => u.id === userId);
        const currentRank = rankIndex !== -1 ? rankIndex + 1 : sortedUsers.length + 1;
        
        const userStats = ensureUserExists(data, guildId, userId);
        return { userStats, rank: currentRank };
    },

    getTop10: (guildId) => {
        const data = getData();
        const guildUsers = data.users?.[guildId] || {};
        
        return Object.entries(guildUsers)
            .map(([id, info]) => ({ id, money: info.money !== undefined ? info.money : 50000 }))
            .sort((a, b) => b.money - a.money)
            .slice(0, 10);
    },

    doDaily: (guildId, userId) => {
        const data = getData();
        const user = ensureUserExists(data, guildId, userId);
        
        const currentVNString = getVNStringDate();
        const lastDailyDateStr = user.lastDaily ? new Date(user.lastDaily + (3600000 * 7)).toDateString() : "";
        
        if (currentVNString === lastDailyDateStr) {
            const timeLeft = getMsUntilVNTomorrow();
            const hours = Math.floor(timeLeft / (1000 * 60 * 60));
            const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
            return { success: false, msg: `⏰ Bạn đã điểm danh hôm nay rồi! Vui lòng quay lại sau **${hours} giờ ${minutes} phút** (Hệ thống tự động gia hạn lúc 00:00 ngày mới).` };
        }
        
        const gift = 50000; 
        user.money = (user.money || 0) + gift;
        user.lastDaily = Date.now();
        saveData(data);
        return { success: true, money: user.money, gift };
    },

    doXinTien: (guildId, userId) => {
        const data = getData();
        const user = ensureUserExists(data, guildId, userId);
        
        const currentVNString = getVNStringDate();
        const lastXinDateStr = user.lastXinTien ? new Date(user.lastXinTien + (3600000 * 7)).toDateString() : "";

        if (currentVNString !== lastXinDateStr) {
            user.xinTienCount = 0; 
        }

        if ((user.xinTienCount || 0) >= 10) {
            const timeLeft = getMsUntilVNTomorrow();
            const hours = Math.floor(timeLeft / (1000 * 60 * 60));
            const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));

            return { 
                success: false, 
                msg: `❌ Bạn đã dùng hết **10/10 lượt** xin trợ cấp của ngày hôm nay!\n⏰ Vui lòng chờ **${hours} giờ ${minutes} phút** nữa để hệ thống reset lúc 00:00 ngày mới.` 
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

    getTaiXiuHistory: () => getData().taixiuHistory || [],
    
    createGiftcode: (codeName, money, maxUses) => {
        const data = getData();
        if (!data.giftcodes) data.giftcodes = {};
        data.giftcodes[codeName] = { money, maxUses, usedUsers: [] };
        saveData(data);
    },

    // Hàm mới: Hỗ trợ xóa giftcode nhanh chóng
    deleteGiftcode: (codeName) => {
        const data = getData();
        if (!data.giftcodes || !data.giftcodes[codeName]) {
            return false;
        }
        delete data.giftcodes[codeName];
        saveData(data);
        return true;
    },

    redeemGiftcode: (guildId, userId, codeName) => {
        const data = getData();
        if (!data.giftcodes || !data.giftcodes[codeName]) return { success: false, msg: '❌ Mã quà tặng không tồn tại!' };
        const code = data.giftcodes[codeName];
        
        const currentVNString = getVNStringDate();
        const userClaimIndex = code.usedUsers.findIndex(record => record.userId === userId && record.guildId === guildId);

        if (userClaimIndex !== -1) {
            const lastClaimedDateStr = new Date(code.usedUsers[userClaimIndex].claimedAt + (3600000 * 7)).toDateString();
            if (currentVNString === lastClaimedDateStr) {
                const timeLeft = getMsUntilVNTomorrow();
                const hours = Math.floor(timeLeft / (1000 * 60 * 60));
                const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
                return { 
                    success: false, 
                    msg: `❌ Bạn đã nhận mã này hôm nay rồi! Vui lòng chờ **${hours} giờ ${minutes} phút** để nhập lại vào ngày mai.` 
                };
            }
        }

        if (code.usedUsers.length >= code.maxUses) return { success: false, msg: '❌ Mã quà tặng đã hết lượt!' };

        if (userClaimIndex !== -1) {
            code.usedUsers[userClaimIndex].claimedAt = Date.now();
        } else {
            code.usedUsers.push({ guildId, userId, claimedAt: Date.now() });
        }

        const user = ensureUserExists(data, guildId, userId);
        user.money = (user.money || 0) + code.money;
        saveData(data);
        return { success: true, money: code.money, total: user.money };
    },

    getAllUsers: (guildId) => {
        const data = getData();
        return data.users?.[guildId] || {};
    },
    
    resetUserMoney: (guildId, userId) => {
        const data = getData();
        if (data.users?.[guildId]?.[userId]) { 
            data.users[guildId][userId].money = 50000; 
            saveData(data); 
        }
        return 50000;
    },
    
    resetAllMoney: (guildId) => {
        const data = getData();
        if (data.users?.[guildId]) {
            for (const id in data.users[guildId]) { 
                data.users[guildId][id].money = 50000; 
            }
            saveData(data);
        }
    }
};
