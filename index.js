const { Client, GatewayIntentBits, EmbedBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, MessageFlags } = require('discord.js');
const db = require('./database.js');
const fs = require('fs');
const { createCanvas } = require('@napi-rs/canvas'); 

const activeGames = new Map(); 
const activeTaiXiu = new Map(); 
const activeBlackjack = new Map();
const activeSlots = new Map(); 
const activeCaoThap = new Map(); 
const activeBauCua = new Map(); 

// ==========================================================
// 👑 DANH SÁCH CONFIG WHITELIST & ID ROLE ĐẠI GIA REAL-TIME
const CONFIG_ADMIN_ID = [
    "1354110406456643597" // 👈 THAY BẰNG ID DISCORD CỦA BẠN VÀO ĐÂY ĐỂ LÀM ADMIN BOT (Ví dụ: "750012040432582776")
]; 

const CONFIG_ADMIN_ROLES = [
    "1354110406456643597",
    "750012040432582776"
];

const CONFIG_TOP_ROLES = {
    top1: "ID_ROLE_TOP_1", // 👈 Điền ID Role dành cho Top 1 tài phiệt vào đây
    top2: "ID_ROLE_TOP_2", // 👈 Điền ID Role dành cho Top 2 tài phiệt vào đây
    top3: "ID_ROLE_TOP_3"  // 👈 Điền ID Role dành cho Top 3 tài phiệt vào đây
};
// ==========================================================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers 
    ]
});

const BOT_TOKEN = process.env.BOT_TOKEN;
const PREFIX = "-"; 

if (!BOT_TOKEN) {
    console.error("🚨 CHƯA CẤU HÌNH BOT_TOKEN TRONG BIẾN MÔI TRƯỜNG (.env)! Bot không thể khởi động.");
    process.exit(1);
}

const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Bot Game Economy đang chạy 24/7!');
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Cổng web mồi đang chạy trên port: ${port}`);
});

async function updateTopRanksRoles(guild) {
    if (!guild) return;
    const topList = db.getTop10() || [];
    const currentTopIds = {
        top1: topList[0]?.id || null,
        top2: topList[1]?.id || null,
        top3: topList[2]?.id || null
    };

    try {
        const roleIds = [CONFIG_TOP_ROLES.top1, CONFIG_TOP_ROLES.top2, CONFIG_TOP_ROLES.top3];
        for (const roleId of roleIds) {
            // Bỏ qua nếu ID role chưa được cấu hình đúng
            if (!roleId || roleId.startsWith("ID_ROLE_TOP")) continue;
            const role = await guild.roles.fetch(roleId).catch(() => null);
            if (!role) continue;
            for (const [memberId, member] of role.members) {
                if (roleId === CONFIG_TOP_ROLES.top1 && memberId !== currentTopIds.top1) await member.roles.remove(CONFIG_TOP_ROLES.top1).catch(() => null);
                if (roleId === CONFIG_TOP_ROLES.top2 && memberId !== currentTopIds.top2) await member.roles.remove(CONFIG_TOP_ROLES.top2).catch(() => null);
                if (roleId === CONFIG_TOP_ROLES.top3 && memberId !== currentTopIds.top3) await member.roles.remove(CONFIG_TOP_ROLES.top3).catch(() => null);
            }
        }
        
        // Gán Role mới cho Top 3 người chơi giàu nhất theo thời gian thực
        if (currentTopIds.top1 && CONFIG_TOP_ROLES.top1 && !CONFIG_TOP_ROLES.top1.startsWith("ID_ROLE_TOP")) {
            const m1 = await guild.members.fetch(currentTopIds.top1).catch(() => null);
            if (m1 && !m1.roles.cache.has(CONFIG_TOP_ROLES.top1)) await m1.roles.add(CONFIG_TOP_ROLES.top1).catch(() => null);
        }
        if (currentTopIds.top2 && CONFIG_TOP_ROLES.top2 && !CONFIG_TOP_ROLES.top2.startsWith("ID_ROLE_TOP")) {
            const m2 = await guild.members.fetch(currentTopIds.top2).catch(() => null);
            if (m2 && !m2.roles.cache.has(CONFIG_TOP_ROLES.top2)) await m2.roles.add(CONFIG_TOP_ROLES.top2).catch(() => null);
        }
        if (currentTopIds.top3 && CONFIG_TOP_ROLES.top3 && !CONFIG_TOP_ROLES.top3.startsWith("ID_ROLE_TOP")) {
            const m3 = await guild.members.fetch(currentTopIds.top3).catch(() => null);
            if (m3 && !m3.roles.cache.has(CONFIG_TOP_ROLES.top3)) await m3.roles.add(CONFIG_TOP_ROLES.top3).catch(() => null);
        }
    } catch (err) {
        console.log("Lỗi cập nhật role real-time từ bxh -top:", err);
    }
}

client.once('ready', () => {
    console.log(`🤖 Bot Game Economy đã sẵn sàng! Đăng nhập thành công: ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (!db.hasUser(message.author.id)) {
        await db.addMoney(message.author.id, 50000);
        await updateTopRanksRoles(message.guild); 
    }

    if (command === 'check') {
        const checkEmbed = new EmbedBuilder()
            .setColor('#2f3136')
            .setAuthor({ name: message.author.username, iconURL: message.author.displayAvatarURL() })
            .setTitle('Hướng Dẫn Lệnh Nhanh')
            .setDescription(
                `• \`-play\` — Mở danh sách menu các trò chơi Casino\n` +
                `• \`-domin [tiền]\` hoặc \`-dm [tiền]\` — Chơi Dò Mìn (Minesweeper)\n` +
                `• \`-taixiu\` hoặc \`-tx\` — Chơi Tài Xỉu lật viên\n` +
                `• \`-blackjack\` hoặc \`-bj\` — Chơi Blackjack Xì Dách Việt Nam\n` +
                `• \`-slots [tiền]\` hoặc \`-sl [tiền]\` — Chơi Quay Hũ Mini Slot VIP\n` +
                `• \`-caothap [tiền]\` hoặc \`-ct [tiền]\` — Chơi Cao Thấp (Hi-Lo) chuỗi nhân thưởng\n` +
                `• \`-baucua [tiền_mỗi_click]\` hoặc \`-bc [tiền_mỗi_click]\` — Sảnh cược Bầu Cua tương tác nhiều ô\n` +
                `• \`-tien [@mention]\` — Xem số dư tài khoản\n` +
                `• \`-top\` — Xem bảng xếp hạng 10 người giàu nhất\n` +
                `• \`-daily\` — Điểm danh nhận thưởng hàng ngày\n` +
                `• \`-xintien\` — Xin tiền trợ cấp từ hệ thống (Tối đa 10 lần/ngày)\n` +
                `• \`-chuyentien @mention [tiền]\` — Chuyển tiền cho người khác\n` +
                `• \`-soicau\` — Xem bảng phân tích lịch sử Tài Xỉu\n` +
                `• \`-profile\` — Xem hồ sơ và chi tiết tỷ lệ thắng cá nhân\n` +
                `• \`-code\` — Xem danh sách hoặc nhập mã quà tặng\n` +
                `• \`-backup\` — Ép sao lưu (backup) thủ công dữ liệu lên GitHub (Admin Only)\n` +
                `• \`-check\` — Mở bảng điều khiển này`
            );
        return message.reply({ embeds: [checkEmbed] });
    }

    if (command === 'daily') {
        const res = db.doDaily(message.author.id);
        if (!res.success) return message.reply(res.msg);
        const msgReply = await message.reply(`🎉 **Điểm danh thành công!** Bạn nhận được \`+${res.gift.toLocaleString()}\` 🪙.\n💰 Số dư hiện tại: **${res.money.toLocaleString()}** 🪙.`);
        await updateTopRanksRoles(message.guild); 
        return msgReply;
    }

    if (command === 'xintien') {
        const res = db.doXinTien(message.author.id);
        if (!res.success) return message.reply(res.msg);
        const msgReply = await message.reply(`💸 **Trợ cấp thành công!** Bạn nhận được trợ cấp \`+${res.gift.toLocaleString()}\` 🪙.\n💰 Số dư hiện tại: **${res.money.toLocaleString()}** 🪙 (Hôm nay đã xin **${res.count}/10** lần).`);
        await updateTopRanksRoles(message.guild);
        return msgReply;
    }

    if (command === 'tien') {
        const target = message.mentions.users.first() || message.author;
        const money = db.getMoney(target.id) || 0;
        return message.reply(`💰 Số dư tài khoản của ${target.id === message.author.id ? 'bạn' : target.username} là: **${money.toLocaleString()}** 🪙.`);
    }

    if (command === 'chuyentien') {
        const target = message.mentions.users.first();
        const rawAmount = args[1]?.replace(/[\.,]/g, '');
        const amount = parseInt(rawAmount);
        if (!target || isNaN(amount) || amount <= 0) return message.reply(`❌ Sai cú pháp! Hãy gõ: \`-chuyentien @mention [số tiền]\``);
        if (target.id === message.author.id) return message.reply(`❌ Bạn không thể tự chuyển tiền cho mình!`);
        if (db.getMoney(message.author.id) < amount) return message.reply(`❌ Bạn không đủ tiền!`);

        await db.addMoney(message.author.id, -amount);
        await db.addMoney(target.id, amount);
        const msgReply = await message.reply(`💸 Bạn đã chuyển thành công **${amount.toLocaleString()}** 🪙 cho <@${target.id}>!`);
        await updateTopRanksRoles(message.guild); 
        return msgReply;
    }

    if (command === 'top') {
        const topList = db.getTop10() || [];
        if (topList.length === 0) return message.reply('Server chưa có ai có tiền cả!');
        let text = "";
        for (let i = 0; i < topList.length; i++) {
            text += `🏆 **Hạng ${i + 1}**: <@${topList[i].id}> — ${topList[i].money.toLocaleString()} 🪙\n`;
        }
        const topEmbed = new EmbedBuilder().setColor('#ffbb00').setTitle('🥇 BẢNG XẾP HẠNG ĐẠI GIA SERVER').setDescription(text);
        return message.reply({ embeds: [topEmbed] });
    }

    if (command === 'soicau') {
        const history = db.getTaiXiuHistory() || [];
        if (history.length === 0) return message.reply('📝 Hệ thống chưa ghi nhận lịch sử ván cược Tài Xỉu nào!');
        
        const taiCount = history.filter(h => h.result === 'TÀI').length;
        const xiuCount = history.filter(h => h.result === 'XỈU').length;
        const trendLine = history.map(h => h.result === 'TÀI' ? '🔴' : '🔵').join(' ➔ ');
        
        let listText = "";
        for (let i = history.length - 1; i >= 0; i--) {
            const h = history[i];
            const icon = h.result === 'TÀI' ? '🔴' : '🔵';
            const moneyIcon = h.amountChange.startsWith('+') ? '📈' : '📉';
            listText += `• **Ván #${String(i + 1).padStart(2, '0')}**: ${icon} **${h.result.toUpperCase()}** (${String(h.total).padStart(2, '0')}đ) ➔ \`[ ${h.diceString} ]\` | ${moneyIcon} \`${h.amountChange}\`\n`;
        }

        const scEmbed = new EmbedBuilder()
            .setColor('#00b4d8')
            .setTitle('📊 BẢNG SOI CẦU THỐNG KÊ TÀI XỈU')
            .setDescription(
                `⚡ **Thống kê xu hướng (10 ván qua):**\n` +
                `• Tổng số **Tài (🔴):** \`${taiCount}\` ván | **Xỉu (🔵):** \`${xiuCount}\` ván\n\n` +
                `📈 **Chuỗi cầu di chuyển (Mới nhất bên phải):**\n🔹 ${trendLine}\n\n` +
                `──────────────────────────────────\n` +
                `📜 **CHI TIẾT LỊCH SỬ KẾT QUẢ:**\n${listText}`
            )
            .setFooter({ text: 'Nhà Đức Casino • Chúc các đại gia bắt cầu chuẩn xác!' });

        return message.reply({ embeds: [scEmbed] });
    }

    if (command === 'profile') {
        const target = message.mentions.users.first() || message.author;
        const profileData = db.getDetailedProfile(target.id) || { userStats: {}, rank: 'N/A' };
        const userStats = profileData.userStats || {};
        const rank = profileData.rank || 'N/A';
        
        const txTotal = userStats.taixiu?.total || 0; const txWin = userStats.taixiu?.win || 0;
        const dmTotal = userStats.domin?.total || 0; const dmWin = userStats.domin?.win || 0;
        const bjTotal = userStats.blackjack?.total || 0; const bjWin = userStats.blackjack?.win || 0;
        const slTotal = userStats.slots?.total || 0; const slWin = userStats.slots?.win || 0;
        const ctTotal = userStats.caothap?.total || 0; const ctWin = userStats.caothap?.win || 0;
        const bcTotal = userStats.baucua?.total || 0; const bcWin = userStats.baucua?.win || 0;

        const totalGames = txTotal + dmTotal + bjTotal + slTotal + ctTotal + bcTotal; 
        const totalWins = txWin + dmWin + bjWin + slWin + ctWin + bcWin;
        const totalWinRate = totalGames > 0 ? ((totalWins / totalGames) * 100).toFixed(1) : "0.0";

        const profileEmbed = new EmbedBuilder().setColor('#2b2d42').setTitle(`📊 Hồ Sơ — ${target.username}`)
            .addFields(
                { name: '🪙 Số dư', value: `**${(userStats.money || 0).toLocaleString()}** 🪙`, inline: true },
                { name: '🏆 Hạng', value: `#${rank}`, inline: true },
                { name: '📈 Tỷ lệ thắng', value: `**${totalWinRate}%**`, inline: true },
                { name: '📊 Thống Kê Các Trò Chơi', value: 
                    `🎲 **Tài Xỉu:** ${txTotal} ván (${txWin} thắng)\n` +
                    `💣 **Dò Mìn:** ${dmTotal} ván (${dmWin} thắng)\n` +
                    `🃏 **Blackjack:** ${bjTotal} ván (${bjWin} thắng)\n` +
                    `🎰 **Mini Slots:** ${slTotal} ván (${slWin} thắng)\n` +
                    `🃏 **Cao Thấp:** ${ctTotal} ván (${ctWin} thắng)\n` +
                    `🦀 **Bầu Cua:** ${bcTotal} ván (${bcWin} thắng)`
                }
            );
        return message.reply({ embeds: [profileEmbed] });
    }

    if (command === 'play') {
        const playEmbed = new EmbedBuilder().setColor('#1093ff').setTitle('🎮 SÒNG BÀI CASINO MINIGAME')
            .setDescription(
                `👉 Hệ thống trò chơi Casino đã sẵn sàng, hãy gõ đúng cú pháp để mở bàn cược:\n\n` +
                `🎲 **Tài Xỉu:** \`-tx [tai/xiu] [tiền cược]\` — Thí dụ: \`-tx tai 10000\`\n` +
                `💣 **Dò Mìn:** \`-dm [tiền]\` — Tìm kim cương an toàn. Gõ \`-dm out\` để chốt rút lời.\n` +
                `🃏 **Blackjack:** \`-bj [tiền]\` — Đấu bài Xì Dách chuẩn với Nhà Cái.\n` +
                `🎰 **Mini Slots:** \`-sl [tiền]\` — Quay hũ nhận siêu Jackpot x10 thưởng.\n` +
                `🃏 **Cao Thấp:** \`-ct [tiền]\` — Đoán lá bài tiếp theo Cao hay Thấp để tích chuỗi nhân tiền.\n` +
                `🦀 **Bầu Cua:** \`-bc [tiền_mỗi_click]\` — Mở sảnh cược Bầu Cua tương tác nhiều ô qua nút bấm.`
            )
            .setFooter({ text: 'Nhà Đức Casino • Chúc các đại gia chơi game vui vẻ thắng lớn!' });
        return message.reply({ embeds: [playEmbed] });
    }

    if (command === 'addtien') {
        const laIdAdmin = CONFIG_ADMIN_ID.includes(message.author.id);
        const coRoleAdmin = message.member.roles.cache.some(role => CONFIG_ADMIN_ROLES.includes(role.id));
        if (!laIdAdmin && !coRoleAdmin) return message.reply('❌ Bạn không có quyền Admin!');
        
        const target = message.mentions.users.first(); 
        const rawAmount = args[1]?.replace(/[\.,]/g, '');
        const amount = parseInt(rawAmount);
        if (!target || isNaN(amount) || amount <= 0) return message.reply('❌ Cú pháp: `-addtien @mention [số tiền]`');
        
        db.addMoney(target.id, amount);
        await updateTopRanksRoles(message.guild);
        return message.reply(`💰 Đã cộng thành công \`+${amount.toLocaleString()}\` xu cho <@${target.id}>.`);
    }

    if (command === 'taocode') {
        const { PermissionFlagsBits } = require('discord.js');
        if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages) && !message.member.permissions.has(PermissionFlagsBits.Administrator)) return message.reply('❌ Quyền hạn không đủ!');
        const codeName = args[0]; 
        const rawMoney = args[1]?.replace(/[\.,]/g, '');
        const money = parseInt(rawMoney); 
        const maxUses = parseInt(args[2]);
        if (!codeName || isNaN(money) || isNaN(maxUses)) return message.reply('❌ Cú pháp: `-taocode [tên] [tiền] [lượt]`');
        db.createGiftcode(codeName, money, maxUses);
        return message.reply(`🎉 Tạo mã code **\`${codeName}\`** thành công!`);
    }

    if (command === 'code') {
        const codeName = args[0];
        if (!codeName) {
            const giftcodes = db.getGiftcodes();
            const activeList = [];
            for (const [name, info] of Object.entries(giftcodes)) {
                const conLuot = info.maxUses - (info.usedUsers?.length || 0);
                if (conLuot > 0) activeList.push(`• 🔑 Mã: **\`${name}\`** | Còn: \`${conLuot}/${info.maxUses}\` lượt (Nhập lại sau mỗi 24h)`);
            }
            
            const formatDescription = 
                `💡 **Cách nhập code:** Bạn hãy gõ theo cú pháp: \`-code [tên_mã]\` để nhận quà!\n` +
                `*Ví dụ: Nếu mã là BANCA, hãy gõ: \`-code BANCA\`*\n\n` +
                `──────────────────────────────────\n` +
                `📜 **DANH SÁCH MÃ QUÀ TẶNG ĐANG HOẠT ĐỘNG:**\n` +
                (activeList.length > 0 ? activeList.join('\n') : '• Hiện tại không có mã nào đang hoạt động.');

            const embed = new EmbedBuilder()
                .setColor('#2ecc71')
                .setTitle('🎁 HỆ THỐNG QUÀ TẶNG GIFTCODE')
                .setDescription(formatDescription);
            return message.reply({ embeds: [embed] });
        }
        const res = db.redeemGiftcode(message.author.id, codeName);
        if (!res.success) return message.reply(res.msg);
        await updateTopRanksRoles(message.guild);
        return message.reply(`🎁 Nhập mã thành công! Bạn nhận được **+${res.money.toLocaleString()}** 🪙.`);
    }

    if (command === 'resettien') {
        const laIdAdmin = CONFIG_ADMIN_ID.includes(message.author.id);
        const coRoleAdmin = message.member.permissions.has('Administrator');
        if (!laIdAdmin && !coRoleAdmin) return message.reply('❌ Thiếu quyền Admin!');

        if (args[0]?.toLowerCase() === 'all') {
            db.resetAllMoney();
            await updateTopRanksRoles(message.guild);
            return message.reply('🚨 **ĐẠI THANH LỌC!** Toàn bộ số dư của server đã được đưa về mức **50,000đ** gốc.');
        }
        const target = message.mentions.users.first() || message.author;
        db.resetUserMoney(target.id);
        await updateTopRanksRoles(message.guild);
        return message.reply(`🔄 Đã đặt lại ví của <@${target.id}> về mức **50,000đ**.`);
    }

    // ==========================================================
    // 💾 LỆNH ADMIN: BACKUP DỮ LIỆU THỦ CÔNG LÊN GITHUB
    // ==========================================================
    if (command === 'backup') {
        const { PermissionFlagsBits } = require('discord.js');
        const laIdAdmin = CONFIG_ADMIN_ID.includes(message.author.id);
        
        // Kiểm tra quyền Administrator của người gõ lệnh hoặc whitelist ID
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator) && !laIdAdmin) {
            return message.reply('❌ Bạn không có quyền Administrator hoặc không nằm trong danh sách Admin Whitelist để thực hiện lệnh này!');
        }

        const backupMsg = await message.reply('⏳ Đang tiến hành đồng bộ và backup dữ liệu lên GitHub, vui lòng chờ...');

        try {
            const rawData = fs.readFileSync('./data.json', 'utf8');
            const parsedData = JSON.parse(rawData);

            const GITHUB_TOKEN = process.env.GITHUB_TOKEN; 
            const GITHUB_REPO = "emsgachacity/nhaduc"; 
            const GITHUB_FILE_PATH = "data.json"; 

            if (!GITHUB_TOKEN) {
                return backupMsg.edit('❌ Thất bại: Không tìm thấy `GITHUB_TOKEN` trong biến môi trường (.env)!');
            }

            const contentStr = JSON.stringify(parsedData, null, 2);
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
                message: `🗄️ [Manual Backup] Kích hoạt bởi Admin ${message.author.username}`,
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
                return backupMsg.edit('✅ **Sao lưu thành công!** Toàn bộ dữ liệu ví người chơi đã được ép đồng bộ an toàn lên kho lưu trữ GitHub.');
            } else {
                return backupMsg.edit(`❌ **Thất bại:** GitHub API trả về trạng thái lỗi \`${resPut ? resPut.status : 'Unknown'}\`.`);
            }

        } catch (err) {
            console.error("Lỗi khi chạy lệnh backup thủ công:", err);
            return backupMsg.edit(`🚨 **Lỗi hệ thống:** \`${err.message}\`. Vui lòng kiểm tra log console.`);
        }
    }

    // ==========================================================
    // 🎲 GAME 1: TÀI XỈU LẬT VIÊN
    // ==========================================================
    if (command === 'taixiu' || command === 'tx') {
        const luaChon = args[0]?.toLowerCase();
        const userId = message.author.id;
        if (!luaChon || (luaChon !== 'tai' && luaChon !== 'xiu')) return message.reply('❌ Cú pháp: `-taixiu [tai/xiu] [tiền cược]`');

        if (activeTaiXiu.has(userId)) return message.reply('❌ Bạn đang có một ván Tài Xỉu chưa lật hết!');

        const currentMoney = db.getMoney(userId);
        const rawBet = args[1]?.replace(/[\.,]/g, '');
        let bet = rawBet?.toLowerCase() === 'all' ? currentMoney : parseInt(rawBet);
        if (isNaN(bet) || bet <= 0 || currentMoney < bet) return message.reply('❌ Số tiền cược không hợp lệ!');

        const xucXac = [Math.floor(Math.random() * 6) + 1, Math.floor(Math.random() * 6) + 1, Math.floor(Math.random() * 6) + 1];
        const tongDiem = xucXac[0] + xucXac[1] + xucXac[2];
        const ketQua = (tongDiem >= 11) ? 'tai' : 'xiu';

        const drawTaiXiuCanvas = async (openedStatus = [false, false, false], currentDice = xucXac, currentRes = ketQua, currentTotal = tongDiem) => {
            const canvas = createCanvas(600, 320); const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#1a1c23'; ctx.fillRect(0, 0, 600, 320);
            ctx.strokeStyle = '#ff3344'; ctx.lineWidth = 4;
            ctx.beginPath(); ctx.roundRect?.(20, 20, 560, 280, 20); ctx.stroke();
            ctx.fillStyle = '#ffffff'; ctx.font = 'bold 22px Arial'; ctx.fillText('TÀI XỈU - LẬT VIÊN', 40, 56);
            const slotsX = [95, 250, 405];
            
            for (let i = 0; i < 3; i++) {
                if (!openedStatus[i]) {
                    ctx.fillStyle = '#ff1f4b'; ctx.beginPath(); ctx.roundRect?.(slotsX[i], 100, 100, 100, 18); ctx.fill();
                    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 45px Arial'; ctx.fillText('?', slotsX[i] + 35, 165);
                } else {
                    ctx.fillStyle = '#fdfefe'; ctx.beginPath(); ctx.roundRect?.(slotsX[i], 100, 100, 100, 18); ctx.fill();
                    const cx = slotsX[i] + 50; const cy = 150; const r = 6.5; const p = 24;
                    const num = currentDice[i];
                    
                    const drawDot = (x, y, color = '#111827') => {
                        ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
                    };

                    if (num === 1) {
                        drawDot(cx, cy, '#e63946');
                    } else {
                        if (num === 3 || num === 5) drawDot(cx, cy);
                        if (num === 2 || num === 3 || num === 4 || num === 5 || num === 6) {
                            drawDot(cx - p, cy - p); drawDot(cx + p, cy + p);
                        }
                        if (num === 4 || num === 5 || num === 6) {
                            drawDot(cx + p, cy - p); drawDot(cx - p, cy + p);
                        }
                        if (num === 6) {
                            drawDot(cx - p, cy); drawDot(cx + p, cy);
                        }
                    }
                }
            }
            if (openedStatus[0] && openedStatus[1] && openedStatus[2]) {
                ctx.fillStyle = '#ffcc00'; ctx.font = 'bold 24px Arial';
                ctx.fillText(`Tổng điểm: ${currentTotal} ➡️ ${currentRes.toUpperCase()}`, 180, 260);
            }
            const nonce = Date.now();
            return new AttachmentBuilder(await canvas.toBuffer('image/png'), { name: `taixiu_${nonce}.png` });
        };

        const generateButtons = (openedStatus = [false, false, false], disableAll = false) => {
            const row = new ActionRowBuilder();
            for (let i = 0; i < 3; i++) {
                row.addComponents(new ButtonBuilder().setCustomId(`tx_${i}_${userId}`).setLabel(`Viên ${i + 1}`).setStyle(openedStatus[i] ? ButtonStyle.Success : ButtonStyle.Primary).setDisabled(disableAll || openedStatus[i]));
            }
            return [row];
        };

        const gameState = { bet, luaChon, xucXac, tongDiem, ketQua, openedStatus: [false, false, false], isProcessing: false };
        activeTaiXiu.set(userId, gameState);

        const initialAttachment = await drawTaiXiuCanvas([false, false, false], xucXac, ketQua, tongDiem);
        const filename = initialAttachment.name;
        
        const txEmbed = new EmbedBuilder().setColor('#2f3136').setTitle('🎲 TÀI XỈU - ĐANG ÚP BÁT!').setDescription(`👤 Người chơi: <@${userId}>\n💰 Tiền cược: **${bet.toLocaleString()}**\n🎯 Dự đoán: **${luaChon.toUpperCase()}**\n⏰ Hạn giờ lật: **60 giây**`).setImage(`attachment://${filename}`);
        const response = await message.reply({ embeds: [txEmbed], files: [initialAttachment], components: generateButtons([false, false, false]) });
        
        const canvasCollector = response.createMessageComponentCollector({ time: 60000 });
        
        canvasCollector.on('collect', async i => {
            if (i.user.id !== userId) return;
            await i.deferUpdate().catch(() => null);
            
            const game = activeTaiXiu.get(userId);
            if (!game || game.isProcessing) return; 

            const xucXacIndex = parseInt(i.customId.split('_')[1]);
            if (game.openedStatus[xucXacIndex]) return; 
            
            game.isProcessing = true;
            activeTaiXiu.set(userId, game);
            await i.editReply({ components: generateButtons(game.openedStatus, true) }).catch(() => null);

            game.openedStatus[xucXacIndex] = true;
            game.isProcessing = false;
            activeTaiXiu.set(userId, game);

            const isAllOpened = game.openedStatus[0] && game.openedStatus[1] && game.openedStatus[2];
            if (isAllOpened) {
                canvasCollector.stop('completed');
            } else {
                const updateAttachment = await drawTaiXiuCanvas(game.openedStatus, game.xucXac, game.ketQua, game.tongDiem);
                const updateEmbed = new EmbedBuilder().setColor('#ffaa00').setTitle('🎲 ĐANG MỞ TỪNG VIÊN...').setDescription(`👉 Bấm tiếp các nút còn lại để lật xúc xắc!`).setImage(`attachment://${updateAttachment.name}`);
                await i.editReply({ embeds: [updateEmbed], files: [updateAttachment], components: generateButtons(game.openedStatus, false), attachments: [] }).catch(() => null);
            }
        });

        canvasCollector.on('end', async (collected, reason) => {
            const game = activeTaiXiu.get(userId);
            if (!game) return;

            const finalOpened = [true, true, true];
            const mapEmoji = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
            const diceString = `${mapEmoji[game.xucXac[0]-1]}${mapEmoji[game.xucXac[1]-1]}${mapEmoji[game.xucXac[2]-1]}`;
            const resultText = game.tongDiem >= 11 ? 'TÀI' : 'XỈU';
            const isWinFinal = game.luaChon === game.ketQua;
            const formatChange = isWinFinal ? `+${(game.bet / 1000).toFixed(1)}K` : `-${(game.bet / 1000).toFixed(1)}K`;

            db.saveTaiXiuLog({ diceString, total: game.tongDiem, result: resultText, isWin: isWinFinal, amountChange: formatChange });

            let mauEmbed = "#ff0000"; 
            let winMsg = "";
            let finalMoney = 0;

            if (game.xucXac[0] === game.xucXac[1] && game.xucXac[1] === game.xucXac[2]) {
                finalMoney = await db.addMoney(userId, game.bet * 5, true, 'taixiu'); 
                winMsg = `🔥 **NỔ BÃO x6 THƯỞNG!** Số dư: **${finalMoney.toLocaleString()}** xu.`; mauEmbed = "#ffbb00";
            } else if (game.luaChon === game.ketQua) {
                finalMoney = await db.addMoney(userId, game.bet, true, 'taixiu'); 
                winMsg = `🎉 **Bạn đã THẮNG!** Số dư: **${finalMoney.toLocaleString()}** xu.`; mauEmbed = "#00ff00";
            } else {
                finalMoney = await db.addMoney(userId, -game.bet, false, 'taixiu'); 
                winMsg = `😢 **Bạn đã THUA!** Số dư: **${finalMoney.toLocaleString()}** xu.`;
            }

            const finalAttachment = await drawTaiXiuCanvas(finalOpened, game.xucXac, game.ketQua, game.tongDiem);
            const title = reason === 'time' ? '🎲 KẾT QUẢ TÀI XỈU (TỰ ĐỘNG KHUI - HẾT GIỜ)' : '🎲 KẾT QUẢ TÀI XỈU';
            const finalEmbed = new EmbedBuilder().setColor(mauEmbed).setTitle(title).setDescription(`🎯 Dự đoán: ${game.luaChon.toUpperCase()} | Kết quả: **${game.tongDiem}** điểm (${game.ketQua.toUpperCase()})\n📊 ${winMsg}`).setImage(`attachment://${finalAttachment.name}`);
            
            await response.edit({ embeds: [finalEmbed], files: [finalAttachment], components: [], attachments: [] }).catch(() => null);
            activeTaiXiu.delete(userId); 
            await updateTopRanksRoles(message.guild);
        });
    }

    // ==========================================================
    // 💣 GAME 2: DÒ MÌN BANCA
    // ==========================================================
    if (command === 'domin' || command === 'dm') {
        const subCommand = args[0]?.toLowerCase();
        const userId = message.author.id;

        if (subCommand === 'out') {
            const game = activeGames.get(userId);
            if (!game) return message.reply('❌ Bạn không có ván dò mìn nào đang diễn ra!');

            let multiplier = 1;
            if (game.diamondsFound >= 21) multiplier = 6; 
            else if (game.diamondsFound >= 1) multiplier = 1 + (game.diamondsFound * 0.1); 
            
            const totalProfit = Math.floor(game.bet * (multiplier - 1)); 
            const finalMoney = await db.addMoney(userId, totalProfit, true, 'domin');

            const generateFinalComponents = () => {
                const rows = [];
                for (let i = 0; i < 5; i++) {
                    const row = new ActionRowBuilder();
                    for (let j = 0; j < 5; j++) {
                        const index = i * 5 + j;
                        const button = new ButtonBuilder().setCustomId(`mine_${index}_${userId}`).setDisabled(true);
                        if (game.board[index] === '💣') {
                            button.setStyle(ButtonStyle.Danger).setLabel('💣');
                        } else {
                            button.setStyle(ButtonStyle.Success).setLabel('💎');
                        }
                        row.addComponents(button);
                    }
                    rows.push(row);
                }
                return rows;
            };

            const winEmbed = new EmbedBuilder()
                .setColor('#00ff00')
                .setAuthor({ name: message.author.username, iconURL: message.author.displayAvatarURL() })
                .setTitle('💰 RÚT TIỀN THÀNH CÔNG!')
                .setDescription(`🎉 Bạn đã chủ động dừng cuộc chơi và rút về tổng cộng **${Math.floor(game.bet * multiplier).toLocaleString()}** 🪙 (Hệ số nhân: x${multiplier.toFixed(1)}).\n💰 Số dư: **${finalMoney.toLocaleString()}** xu.`);

            try {
                await game.response.edit({ embeds: [winEmbed], components: generateFinalComponents() }).catch(() => null);
            } catch (err) {}

            activeGames.delete(userId); 
            await updateTopRanksRoles(message.guild);
            return;
        }

        if (activeGames.has(userId)) return message.reply('❌ Bạn đang có ván dò mìn chưa hoàn thành! Hãy gõ `-dm out` để rút tiền.');
        const currentMoney = db.getMoney(userId);
        const rawBet = args[0]?.replace(/[\.,]/g, '');
        let bet = rawBet?.toLowerCase() === 'all' ? currentMoney : parseInt(rawBet);
        if (isNaN(bet) || bet <= 0 || currentMoney < bet) return message.reply('❌ Mức cược không hợp lệ!');
        
        let board = Array(25).fill('💎'); let mCount = 0;
        while(mCount < 4) {
            let r = Math.floor(Math.random() * 25);
            if (board[r] !== '💣') { board[r] = '💣'; mCount++; }
        }

        const buildComponents = (gBoard, disableAll = false) => {
            const rows = [];
            for (let i = 0; i < 5; i++) {
                const row = new ActionRowBuilder();
                for (let j = 0; j < 5; j++) {
                    const idx = i * 5 + j;
                    const btn = new ButtonBuilder().setCustomId(`mine_${idx}_${userId}`);
                    if (gBoard[idx] === '✅') {
                        btn.setLabel('💎').setStyle(ButtonStyle.Success).setDisabled(true);
                    } else {
                        btn.setLabel('❓').setStyle(ButtonStyle.Secondary).setDisabled(disableAll);
                    }
                    row.addComponents(btn);
                }
                rows.push(row);
            }
            return rows;
        };

        const embed = new EmbedBuilder().setColor('#2f3136').setTitle('💣 DÒ MÌN BANCA').setDescription('💡 Bấm các ô bên dưới. Gõ `-dm out` để rút tiền cược bất cứ lúc nào!\n⏰ Hạn giờ phản hồi: **60 giây**.');
        const response = await message.reply({ embeds: [embed], components: buildComponents(board) });

        activeGames.set(userId, { bet, board, diamondsFound: 0, response, isProcessing: false });

        const collector = response.createMessageComponentCollector({ time: 60000 });
        collector.on('collect', async i => {
            if (i.user.id !== userId) return i.reply({ content: '❌ Đây không phải ván chơi của bạn!', flags: [MessageFlags.Ephemeral] });
            
            const game = activeGames.get(userId);
            if (!game || game.isProcessing) return i.deferUpdate().catch(() => null);

            await i.deferUpdate().catch(() => null);
            const idx = parseInt(i.customId.split('_')[1]);
            
            game.isProcessing = true;
            activeGames.set(userId, game);

            if (game.board[idx] === '💣') {
                collector.stop('hit_bomb');
                const finalMoney = await db.addMoney(userId, -game.bet, false, 'domin'); 

                const generateLoseComponents = () => {
                    const rows = [];
                    for (let a = 0; a < 5; a++) {
                        const row = new ActionRowBuilder();
                        for (let b = 0; b < 5; b++) {
                            const idxLose = a * 5 + b;
                            const btn = new ButtonBuilder().setCustomId(`mine_${idxLose}_${userId}`).setDisabled(true);
                            if (game.board[idxLose] === '💣') {
                                btn.setStyle(ButtonStyle.Danger).setLabel('💣'); 
                            } else {
                                btn.setStyle(ButtonStyle.Success).setLabel('💎'); 
                            }
                            row.addComponents(btn);
                        }
                        rows.push(row);
                    }
                    return rows;
                };

                const loseEmbed = new EmbedBuilder()
                    .setTitle('💥 BÙM! TRÚNG MÌN TRẮNG TAY')
                    .setColor('#ff0000')
                    .setDescription(`Bạn đạp trúng mìn tại ô số ${idx + 1} và mất toàn bộ cược gốc.\n💎 Số ô an toàn đã lật: **${game.diamondsFound}** ô.\n💰 Số dư hiện tại: **${finalMoney.toLocaleString()}** xu.`);

                await i.editReply({ embeds: [loseEmbed], components: generateLoseComponents() }).catch(() => null);
                activeGames.delete(userId); 
                await updateTopRanksRoles(message.guild);
            } else {
                if (game.board[idx] !== '✅') {
                    game.diamondsFound++; 
                    game.board[idx] = '✅';
                }
                
                if (game.diamondsFound === 21) {
                    collector.stop('perfect_win');
                    const finalMoney = await db.addMoney(userId, game.bet * 5, true, 'domin'); 
                    
                    const generateWinComponents = () => {
                        const rows = [];
                        for (let a = 0; a < 5; a++) {
                            const row = new ActionRowBuilder();
                            for (let b = 0; b < 5; b++) {
                                const idxWin = a * 5 + b;
                                const btn = new ButtonBuilder().setCustomId(`mine_${idxWin}_${userId}`).setDisabled(true);
                                if (game.board[idxWin] === '💣') btn.setStyle(ButtonStyle.Danger).setLabel('💣');
                                else btn.setStyle(ButtonStyle.Success).setLabel('💎');
                                row.addComponents(btn);
                            }
                            rows.push(row);
                        }
                        return rows;
                    };

                    const winEmbed = new EmbedBuilder().setTitle('🏆 ĐẠI THẮNG DÒ MÌN x6 TIỀN!').setColor('#00ff00').setDescription(`Chúc mừng bạn đã xuất sắc lật toàn bộ ô kim cương an toàn sạch sẽ!\n💰 Số dư hiện tại: **${finalMoney.toLocaleString()}** xu.`);
                    await i.editReply({ embeds: [winEmbed], components: generateWinComponents() }).catch(() => null);
                    activeGames.delete(userId);
                    await updateTopRanksRoles(message.guild);
                } else {
                    game.isProcessing = false;
                    activeGames.set(userId, game);
                    let currentMultiplier = 1 + (game.diamondsFound * 0.1);
                    
                    const updateEmbed = new EmbedBuilder()
                        .setColor('#ffaa00')
                        .setTitle('💣 DÒ MÌN BANCA')
                        .setDescription(`🎉 An toàn! Kim cương tìm được: **${game.diamondsFound}/21** ô.\n💰 Thưởng hiện tại nếu rút tiền: **${Math.floor(game.bet * currentMultiplier).toLocaleString()}** 🪙 (x${currentMultiplier.toFixed(1)}).\n💡 Gõ \`-dm out\` để dừng lại rút tiền.`);
                    
                    await i.editReply({ embeds: [updateEmbed], components: buildComponents(game.board, false) }).catch(() => null);
                    collector.resetTimer();
                }
            }
        });

        collector.on('end', async (collected, reason) => {
            const game = activeGames.get(userId);
            if (!game) return;

            if (reason === 'time') {
                let multiplier = 1;
                if (game.diamondsFound >= 21) multiplier = 6;
                else if (game.diamondsFound >= 1) multiplier = 1 + (game.diamondsFound * 0.1);

                const totalProfit = Math.floor(game.bet * (multiplier - 1));
                const finalMoney = await db.addMoney(userId, totalProfit, true, 'domin');

                const generateFinalComponents = () => {
                    const rows = [];
                    for (let i = 0; i < 5; i++) {
                        const row = new ActionRowBuilder();
                        for (let j = 0; j < 5; j++) {
                            const index = i * 5 + j;
                            const button = new ButtonBuilder().setCustomId(`mine_${index}_${userId}`).setDisabled(true);
                            if (game.board[index] === '💣') {
                                button.setStyle(ButtonStyle.Danger).setLabel('💣');
                            } else {
                                button.setStyle(ButtonStyle.Success).setLabel('💎');
                            }
                            row.addComponents(button);
                        }
                        rows.push(row);
                    }
                    return rows;
                };

                const timeoutEmbed = new EmbedBuilder()
                    .setColor('#00ff00')
                    .setTitle('💰 TỰ ĐỘNG CHỐT LỜI (HẾT GIỜ CHỜ)')
                    .setDescription(`⏰ Đã quá 60 giây không phản hồi. Hệ thống tự động thu lưới, giúp bạn mang về **${Math.floor(game.bet * multiplier).toLocaleString()}** 🪙 (x${multiplier.toFixed(1)}).\n💰 Số dư: **${finalMoney.toLocaleString()}** xu.`);

                await response.edit({ embeds: [timeoutEmbed], components: generateFinalComponents() }).catch(() => null);
                activeGames.delete(userId);
                await updateTopRanksRoles(message.guild);
            }
        });
    }

    // ==========================================================
    // 🃏 GAME 3: BLACKJACK XÌ DÁCH
    // ==========================================================
    if (command === 'blackjack' || command === 'bj') {
        const userId = message.author.id;
        
        if (activeBlackjack.has(userId)) return message.reply('❌ Bạn đang có ván bài Blackjack chưa hoàn thành!');

        const currentMoney = db.getMoney(userId);
        const rawBet = args[0]?.replace(/[\.,]/g, '');
        let bet = rawBet?.toLowerCase() === 'all' ? currentMoney : parseInt(rawBet);
        if (isNaN(bet) || bet <= 0 || currentMoney < bet) return message.reply('❌ Ví trống hoặc mức cược không hợp lệ!');
        
        const suits = ['C','D','H','S']; const vals = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
        let deck = []; for(let s of suits) for(let v of vals) deck.push({val:v, suit:s});
        deck.sort(() => Math.random() - 0.5);

        const playerHand = [deck.pop(), deck.pop()]; const dealerHand = [deck.pop(), deck.pop()];
        
        const calculateScore = (hand) => {
            let score = 0; let aces = 0;
            for(let c of hand) {
                if (c.val === 'A') aces++;
                else if (['J','Q','K'].includes(c.val)) score += 10;
                else score += parseInt(c.val);
            }
            
            if (hand.length === 2 && aces === 2) return 22;

            for(let i = 0; i < aces; i++) {
                if (hand.length === 2) {
                    if (score + 11 <= 21) score += 11;
                    else score += 10;
                } else if (hand.length === 3) {
                    if (score + 10 <= 21) score += 10;
                    else score += 1;
                } else {
                    score += 1;
                }
            }
            return score;
        };

        const checkSpecialHand = (hand) => {
            const score = calculateScore(hand);
            if (score === 22 && hand.length === 2) return { type: 'XIBAN', power: 2 };
            if (score === 21 && hand.length === 2) return { type: 'XIDACH', power: 1 };
            return { type: 'NORMAL', power: 0 };
        };

        const drawBlackjackCanvas = async (pHand, dHand, isDone = false, statusText = "") => {
            const canvas = createCanvas(650, 420); const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#0f3024'; ctx.fillRect(0, 0, 650, 420);
            ctx.strokeStyle = '#c5a059'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect?.(25, 25, 600, 370, 20); ctx.stroke();
            ctx.fillStyle = '#c5a059'; ctx.font = 'bold 15px Arial'; ctx.fillText(`CƯỢC: ${bet.toLocaleString()}`, 480, 55);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'; ctx.fillText(`NHÀ CÁI`, 55, 55); ctx.fillText(`BẠN`, 55, 380);

            const drawVectorCard = (cardObj, x, y, isHidden = false) => {
                ctx.fillStyle = isHidden ? '#9b2226' : '#ffffff'; ctx.beginPath(); ctx.roundRect?.(x, y, 76, 108, 10); ctx.fill();
                if (isHidden) return;
                const isRed = ['H', 'D'].includes(cardObj.suit); ctx.fillStyle = isRed ? '#ae2012' : '#111827';
                ctx.font = 'bold 20px Arial'; ctx.fillText(cardObj.val, x + 10, y + 25);
                let icon = '♣'; if (cardObj.suit === 'D') icon = '♦'; if (cardObj.suit === 'H') icon = '♥'; if (cardObj.suit === 'S') icon = '♠';
                ctx.font = '36px Arial'; ctx.fillText(icon, x + 25, y + 70);
            };

            let startDX = 325 - ((dHand.length * 76 + (dHand.length - 1) * 12) / 2);
            for (let i = 0; i < dHand.length; i++) drawVectorCard(dHand[i], startDX + (i * 88), 80, (!isDone && i === 1));

            let startPX = 325 - ((pHand.length * 76 + (pHand.length - 1) * 12) / 2);
            for (let i = 0; i < pHand.length; i++) drawVectorCard(pHand[i], startPX + (i * 88), 230);

            if (isDone) {
                ctx.fillStyle = 'rgba(0, 0, 0, 0.85)'; ctx.fillRect(0, 195, 650, 36);
                ctx.fillStyle = '#ffffff'; ctx.font = 'bold 16px Arial'; ctx.fillText(statusText, 240, 218);
            }
            const nonce = Date.now();
            return new AttachmentBuilder(await canvas.toBuffer('image/png'), { name: `blackjack_${nonce}.png` });
        };

        const generateBJButtons = (disableAll = false) => {
            return new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`bj_hit_${userId}`).setLabel('🃏 Bốc bài').setStyle(ButtonStyle.Primary).setDisabled(disableAll),
                new ButtonBuilder().setCustomId(`bj_stand_${userId}`).setLabel('🛑 Dằn bài').setStyle(ButtonStyle.Success).setDisabled(disableAll)
            );
        };

        const playerSpecial = checkSpecialHand(playerHand);
        const dealerSpecial = checkSpecialHand(dealerHand);

        if (playerSpecial.power > 0 || dealerSpecial.power > 0) {
            let msg = ""; let isWin = false; let isDraw = false;
            let titleText = "KẾT THÚC SỚM VÁN BÀI";

            if (dealerSpecial.power > playerSpecial.power) {
                isWin = false;
                msg = `🧙‍♂️ Nhà cái lật ra **${dealerSpecial.type === 'XIBAN' ? 'XÌ BÀN 👑' : 'XÌ DÁCH 🃏'}**. Bạn đã thua cuộc!`;
            } else if (playerSpecial.power > dealerSpecial.power) {
                isWin = true;
                msg = `🎉 Bạn sở hữu **${playerSpecial.type === 'XIBAN' ? 'XÌ BÀN 👑' : 'XÌ DÁCH 🃏'}** ăn trọn tiền nhà cái!`;
                titleText = playerSpecial.type === 'XIBAN' ? '👑 XÌ BÀN HOÀNG GIA 👑' : '🃏 XÌ DÁCH ĐẠI CÁT 🃏';
            } else {
                isDraw = true;
                msg = `🤝 Cả hai bên đều đạt bộ bài đặc biệt tương đương nhau (**${playerSpecial.type}**). Ván đấu HOÀ!`;
            }

            let finalMoney = 0;
            if (isDraw) {
                finalMoney = db.getMoney(userId);
            } else if (isWin) {
                finalMoney = await db.addMoney(userId, bet, true, 'blackjack');
            } else {
                finalMoney = await db.addMoney(userId, -bet, false, 'blackjack');
            }

            const finalAttachment = await drawBlackjackCanvas(playerHand, dealerHand, true, `🔥 ${playerSpecial.type || dealerSpecial.type} KHAI CUỘC 🔥`);
            const finalEmbed = new EmbedBuilder().setColor(isDraw ? '#ffaa00' : (isWin ? '#ffbb00' : '#ff0000'))
                .setTitle(`🃏 ${titleText} 🃏`)
                .setDescription(`${msg}\n\n📊 Dòng tiền: ${isDraw ? 'Hoàn cược' : (isWin ? `\`+${bet.toLocaleString()}\` xu` : `\`-${bet.toLocaleString()}\` xu`)}\n💰 Số dư hiện tại: **${finalMoney.toLocaleString()}** xu.`)
                .setImage(`attachment://${finalAttachment.name}`);
                
            await message.reply({ embeds: [finalEmbed], files: [finalAttachment] });
            await updateTopRanksRoles(message.guild);
            return; 
        }

        activeBlackjack.set(userId, { bet, deck, playerHand, dealerHand, isProcessing: false });
        let pScore = calculateScore(playerHand);
        
        const initialAttachment = await drawBlackjackCanvas(playerHand, dealerHand, false);
        const embed = new EmbedBuilder().setColor('#00b4d8').setTitle('🃏 SÒNG BÀI XÌ DÁCH VIỆT NAM').setDescription(`👤 Người chơi: <@${userId}>\n💰 Cược: **${bet.toLocaleString()}** xu\n🎒 Bài của bạn: **${pScore} điểm**.\n⏰ Hạn giờ suy nghĩ: **60 giây**`).setImage(`attachment://${initialAttachment.name}`);
        const response = await message.reply({ embeds: [embed], files: [initialAttachment], components: [generateBJButtons(false)] });

        const collector = response.createMessageComponentCollector({ time: 60000 });
        collector.on('collect', async i => {
            if (i.user.id !== userId) return i.reply({ content: '❌ Không phải lượt của bạn!', flags: [MessageFlags.Ephemeral] });
            
            const game = activeBlackjack.get(userId);
            if (!game || game.isProcessing) return i.deferUpdate().catch(() => null);

            game.isProcessing = true;
            activeBlackjack.set(userId, game);

            await i.deferUpdate().catch(() => null);
            const act = i.customId.split('_')[1];
            
            if (act === 'hit') {
                game.playerHand.push(game.deck.pop());
                let pScoreNow = calculateScore(game.playerHand);

                if (pScoreNow > 21) {
                    collector.stop('busted'); 
                    const finalMoney = await db.addMoney(userId, -game.bet, false, 'blackjack'); 
                    const finalAttachment = await drawBlackjackCanvas(game.playerHand, game.dealerHand, true, 'KẾT THÚC - BẠN BỊ QUẮC BÀI 💀');
                    
                    const finalEmbed = new EmbedBuilder().setColor('#ff0000').setTitle('🃏 KẾT QUẢ BLACKJACK 🃏')
                        .setDescription(`🎒 Bài của bạn: **${pScoreNow} điểm** 💀 *(Quắc bài)*\n\n📊 Thua cuộc! Bài vượt quá 21 điểm, mất trắng ví cược.\n💰 Số dư hiện tại: **${finalMoney.toLocaleString()}** xu.`)
                        .setImage(`attachment://${finalAttachment.name}`);
                    
                    await i.editReply({ embeds: [finalEmbed], files: [finalAttachment], components: [], attachments: [] }).catch(() => null);
                    activeBlackjack.delete(userId); 
                    return;
                }

                if (game.playerHand.length === 5 && pScoreNow <= 21) {
                    collector.stop('ngulinh'); 
                    const finalMoney = await db.addMoney(userId, Math.floor(game.bet * 1.5), true, 'blackjack'); 
                    const finalAttachment = await drawBlackjackCanvas(game.playerHand, game.dealerHand, true, '👑 NGŨ LINH ĐẠI CÁT 👑');
                    
                    const finalEmbed = new EmbedBuilder().setColor('#ffbb00').setTitle('🃏 KẾT QUẢ BLACKJACK 🃏')
                        .setDescription(`🎒 Bài của bạn: **${pScoreNow} điểm** (5 lá)\n\n📊 Thắng Ngũ Linh nhận về **+${Math.floor(game.bet * 2.5).toLocaleString()}** xu!\n💰 Số dư hiện tại: **${finalMoney.toLocaleString()}** xu.`)
                        .setImage(`attachment://${finalAttachment.name}`);
                        
                    await i.editReply({ embeds: [finalEmbed], files: [finalAttachment], components: [], attachments: [] }).catch(() => null);
                    activeBlackjack.delete(userId);
                    await updateTopRanksRoles(message.guild);
                    return;
                }

                game.isProcessing = false;
                activeBlackjack.set(userId, game);
                const updateAttachment = await drawBlackjackCanvas(game.playerHand, game.dealerHand, false);
                embed.setDescription(`👤 Người chơi: <@${userId}>\n💰 Cược: **${game.bet.toLocaleString()}** xu\n🎒 Bài của bạn: **${pScoreNow} điểm** (${game.playerHand.length} lá).`).setImage(`attachment://${updateAttachment.name}`);
                await i.editReply({ embeds: [embed], files: [updateAttachment], components: [generateBJButtons(false)], attachments: [] }).catch(() => null);
                collector.resetTimer();
            }

            if (act === 'stand') {
                collector.stop('stand'); 
            }
        });

        collector.on('end', async (collected, reason) => {
            const game = activeBlackjack.get(userId);
            if (!game) return;

            let pFinal = calculateScore(game.playerHand);
            
            if (reason === 'stand' || (reason === 'time' && pFinal >= 16)) {
                let dFinal = calculateScore(game.dealerHand);
                while(dFinal < 15 && game.dealerHand.length < 5) { 
                    game.dealerHand.push(game.deck.pop()); 
                    dFinal = calculateScore(game.dealerHand);
                }

                let msg = ""; let embedColor = "#ff0000";
                let finalMoney = 0;

                if (dFinal === 22 && game.dealerHand.length === 2) {
                    finalMoney = await db.addMoney(userId, -game.bet, false, 'blackjack');
                    msg = `😢 **Nhà cái lật bài đạt XÌ BÀN ngầm! Bạn đã thua cuộc.**`;
                }
                else if (dFinal > 21) { 
                    finalMoney = await db.addMoney(userId, game.bet, true, 'blackjack'); 
                    msg = `🎉 **Nhà cái quắc bài (${dFinal}đ)! Bạn thắng nhận về +${(game.bet * 2).toLocaleString()} xu.**`; 
                    embedColor = "#00ff00"; 
                }
                else if (game.dealerHand.length === 5 && dFinal <= 21) {
                    finalMoney = await db.addMoney(userId, -game.bet, false, 'blackjack');
                    msg = `😢 **Nhà cái kéo đủ 5 lá đạt bộ NGŨ LINH (${dFinal}đ)! Bạn đã thua cuộc.**`;
                }
                else if (pFinal > dFinal) { 
                    finalMoney = await db.addMoney(userId, game.bet, true, 'blackjack'); 
                    msg = `🎉 **Bạn đã thắng cuộc!** (${pFinal}đ vs ${dFinal}đ).`; 
                    embedColor = "#00ff00"; 
                }
                else if (pFinal < dFinal) { 
                    finalMoney = await db.addMoney(userId, -game.bet, false, 'blackjack'); 
                    msg = `😢 **Bạn thua cuộc!** Bài thấp hơn nhà cái (${pFinal}đ vs ${dFinal}đ).`; 
                }
                else { 
                    finalMoney = db.getMoney(userId); 
                    msg = `🤝 **Hòa bài!** Hệ thống hoàn lại cược gốc.`; 
                    embedColor = "#ffaa00"; 
                }

                const finalAttachment = await drawBlackjackCanvas(game.playerHand, game.dealerHand, true, 'KẾT THÚC VÁN ĐẤU');
                const title = reason === 'time' ? '🃏 KẾT QUẢ BLACKJACK (TỰ ĐỘNG DẰN - HẾT GIỜ) 🃏' : '🃏 KẾT QUẢ BLACKJACK 🃏';
                embed.setColor(embedColor).setTitle(title)
                    .setDescription(`🧙‍♂️ Nhà cái: **${dFinal === 22 ? 'Xì Bàn' : dFinal + 'đ'}**\n🎒 Bạn: **${pFinal}đ**\n\n📊 ${msg}\n💰 Số dư hiện tại: **${finalMoney.toLocaleString()}** xu.`)
                    .setImage(`attachment://${finalAttachment.name}`);
                    
                await response.edit({ embeds: [embed], files: [finalAttachment], components: [], attachments: [] }).catch(() => null);
                activeBlackjack.delete(userId);
                await updateTopRanksRoles(message.guild);
            } 
            else if (reason === 'stand' && pFinal < 16) {
                const finalMoney = await db.addMoney(userId, -game.bet, false, 'blackjack');
                const finalAttachment = await drawBlackjackCanvas(game.playerHand, game.dealerHand, true, '❌ PHẠT ĐỀN DẰN NON ❌');
                const finalEmbed = new EmbedBuilder().setColor('#ff0000').setTitle('🃏 PHẠT ĐỀN BLACKJACK 🃏')
                    .setDescription(`🎒 Bạn dằn bài khi chưa đủ tuổi tối thiểu (Mới đạt **${pFinal}** điểm). Bị xử thua phạt đền toàn bộ cược.\n💰 Số dư hiện tại: **${finalMoney.toLocaleString()}** xu.`)
                    .setImage(`attachment://${finalAttachment.name}`);
                    
                await response.edit({ embeds: [finalEmbed], files: [finalAttachment], components: [], attachments: [] }).catch(() => null);
                activeBlackjack.delete(userId);
            } 
            else if (reason === 'time' && pFinal < 16) {
                while (pFinal < 16 && game.playerHand.length < 5) {
                    game.playerHand.push(game.deck.pop());
                    pFinal = calculateScore(game.playerHand);
                }

                let finalAttachment;
                let finalEmbed;
                if (pFinal > 21) {
                    const finalMoney = await db.addMoney(userId, -game.bet, false, 'blackjack');
                    finalAttachment = await drawBlackjackCanvas(game.playerHand, game.dealerHand, true, '💀 TỰ ĐỘNG BỐC - BỊ QUẮC 💀');
                    finalEmbed = new EmbedBuilder().setColor('#ff0000').setTitle('🃏 KẾT QUẢ BLACKJACK (BỊ QUẮC - HẾT GIỜ) 🃏')
                        .setDescription(`🎒 Bài của bạn: **${pFinal} điểm** 💀 *(Quắc bài do tự động bốc)*\n\n📊 Thua cuộc! Bài vượt quá 21 điểm.\n💰 Số dư hiện tại: **${finalMoney.toLocaleString()}** xu.`)
                        .setImage(`attachment://${finalAttachment.name}`);
                } else {
                    let dFinal = calculateScore(game.dealerHand);
                    while(dFinal < 15 && game.dealerHand.length < 5) { 
                        game.dealerHand.push(game.deck.pop()); 
                        dFinal = calculateScore(game.dealerHand);
                    }

                    let msg = ""; let embedColor = "#ff0000";
                    let finalMoney = 0;

                    if (dFinal === 22 && game.dealerHand.length === 2) {
                        finalMoney = await db.addMoney(userId, -game.bet, false, 'blackjack');
                        msg = `😢 **Nhà cái lật bài đạt XÌ BÀN ngầm! Bạn đã thua cuộc.**`;
                    }
                    else if (dFinal > 21) { 
                        finalMoney = await db.addMoney(userId, game.bet, true, 'blackjack'); 
                        msg = `🎉 **Nhà cái quắc bài (${dFinal}đ)! Bạn thắng nhận về +${(game.bet * 2).toLocaleString()} xu.**`; 
                        embedColor = "#00ff00"; 
                    }
                    else if (pFinal > dFinal) { 
                        finalMoney = await db.addMoney(userId, game.bet, true, 'blackjack'); 
                        msg = `🎉 **Bạn đã thắng cuộc!** (${pFinal}đ vs ${dFinal}đ).`; 
                        embedColor = "#00ff00"; 
                    }
                    else if (pFinal < dFinal) { 
                        finalMoney = await db.addMoney(userId, -game.bet, false, 'blackjack'); 
                        msg = `😢 **Bạn thua cuộc!** Bài thấp hơn nhà cái (${pFinal}đ vs ${dFinal}đ).`; 
                    }
                    else { 
                        finalMoney = db.getMoney(userId); 
                        msg = `🤝 **Hòa bài!** Hệ thống hoàn lại cược gốc.`; 
                        embedColor = "#ffaa00"; 
                    }

                    finalAttachment = await drawBlackjackCanvas(game.playerHand, game.dealerHand, true, 'TỰ ĐỘNG BỐC ĐỦ TUỔI VÀ SO ĐIỂM');
                    finalEmbed = new EmbedBuilder().setColor(embedColor).setTitle('🃏 KẾT QUẢ BLACKJACK (TỰ ĐỘNG BỐC - HẾT GIỜ) 🃏')
                        .setDescription(`🎒 Bạn: **${pFinal}đ**\n🧙‍♂️ Nhà cái: **${dFinal}đ**\n\n📊 ${msg}\n💰 Số dư: **${finalMoney.toLocaleString()}** xu.`)
                        .setImage(`attachment://${finalAttachment.name}`);
                }

                await response.edit({ embeds: [finalEmbed], files: [finalAttachment], components: [], attachments: [] }).catch(() => null);
                activeBlackjack.delete(userId);
                await updateTopRanksRoles(message.guild);
            }
        });
    }

    // ==========================================================
    // 🎰 GAME 4: MINI SLOTS
    // ==========================================================
    if (command === 'slots' || command === 'sl') {
        const userId = message.author.id;
        if (activeSlots.has(userId)) return message.reply('❌ Bạn đang có một ván Slots chưa lật hết!');

        const currentMoney = db.getMoney(userId);
        const rawBet = args[0]?.replace(/[\.,]/g, '');
        let bet = rawBet?.toLowerCase() === 'all' ? currentMoney : parseInt(rawBet);

        if (isNaN(bet) || bet <= 0 || currentMoney < bet) return message.reply('❌ Số tiền cược không hợp lệ hoặc bạn không đủ tiền!');

        await db.addMoney(userId, -bet);

        const rand = Math.random() * 100;
        const icons = ['cherry', 'diamond', 'crown', 'fire'];
        let slot1, slot2, slot3;

        if (rand < 2.0) { 
            slot1 = slot2 = slot3 = 'crown'; 
        } else if (rand < 5.5) { 
            slot1 = slot2 = slot3 = 'diamond'; 
        } else if (rand < 11.0) { 
            slot1 = slot2 = slot3 = 'fire'; 
        } else if (rand < 19.0) { 
            slot1 = slot2 = slot3 = 'cherry'; 
        } else if (rand < 40.0) { 
            const pairIcon = icons[Math.floor(Math.random() * icons.length)];
            let otherIcon = icons[Math.floor(Math.random() * icons.length)];
            while(otherIcon === pairIcon) { otherIcon = icons[Math.floor(Math.random() * icons.length)]; }
            
            const pos = Math.floor(Math.random() * 3);
            if (pos === 0) { slot1 = otherIcon; slot2 = pairIcon; slot3 = pairIcon; }
            else if (pos === 1) { slot1 = pairIcon; slot2 = otherIcon; slot3 = pairIcon; }
            else { slot1 = pairIcon; slot2 = pairIcon; slot3 = otherIcon; }
        } else { 
            const shuffled = [...icons].sort(() => 0.5 - Math.random());
            slot1 = shuffled[0]; slot2 = shuffled[1]; slot3 = shuffled[2];
        }

        const finalSlots = [slot1, slot2, slot3];

        const drawSlotsCanvas = async (openedStatus, currentArr = finalSlots) => {
            const canvas = createCanvas(600, 260); 
            const ctx = canvas.getContext('2d');
            
            ctx.fillStyle = '#0d0e15'; ctx.fillRect(0, 0, 600, 260);
            ctx.strokeStyle = '#ff9f1c'; ctx.lineWidth = 4;
            ctx.beginPath(); ctx.moveTo(30, 15);
            ctx.arcTo(585, 15, 585, 245, 18); ctx.arcTo(585, 245, 15, 245, 18); ctx.arcTo(15, 245, 15, 15, 18); ctx.arcTo(15, 15, 585, 15, 18);
            ctx.closePath(); ctx.stroke(); 

            const slotsX = [60, 235, 410]; 
            for (let i = 0; i < 3; i++) {
                const x = parseFloat(slotsX[i]); const y = 50; const w = 130; const h = 160;
                ctx.fillStyle = '#1e1f29'; ctx.beginPath();
                ctx.moveTo(x + 12, y); ctx.arcTo(x + w, y, x + w, y + h, 12); ctx.arcTo(x + w, y + h, x, y + h, 12); ctx.arcTo(x, y + h, x, y, 12); ctx.arcTo(x, y, x + w, y, 12);
                ctx.closePath(); ctx.fill();
                ctx.strokeStyle = '#3a3d52'; ctx.lineWidth = 2; ctx.stroke();

                const cx = parseFloat(x + w / 2); const cy = parseFloat(y + h / 2);
                if (!openedStatus[i]) {
                    ctx.strokeStyle = '#e63946'; ctx.lineWidth = 3;
                    ctx.beginPath(); ctx.arc(cx, cy, 30, 0, Math.PI * 2); ctx.stroke();
                    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4; ctx.lineCap = 'round';
                    ctx.beginPath(); ctx.arc(cx, Math.round(cy - 8), 10, Math.PI, Math.PI * 2.3); ctx.lineTo(cx, Math.round(cy + 5)); ctx.stroke();
                    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(cx, Math.round(cy + 14), 2.5, 0, Math.PI * 2); ctx.fill();
                } else {
                    const type = currentArr[i];
                    if (type === 'diamond') {
                        let grad = ctx.createLinearGradient(cx, Math.round(cy - 30), cx, Math.round(cy + 30)); grad.addColorStop(0, '#4ea8de'); grad.addColorStop(1, '#56cfe1'); ctx.fillStyle = grad;
                        ctx.beginPath(); ctx.moveTo(cx, Math.round(cy - 30)); ctx.lineTo(Math.round(cx + 30), Math.round(cy - 5)); ctx.lineTo(cx, Math.round(cy + 30)); ctx.lineTo(Math.round(cx - 30), Math.round(cy - 5)); ctx.closePath(); ctx.fill();
                        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(Math.round(cx - 30), Math.round(cy - 5)); ctx.lineTo(Math.round(cx + 30), Math.round(cy - 5)); ctx.moveTo(cx, Math.round(cy - 30)); ctx.lineTo(cx, Math.round(cy + 30)); ctx.stroke();
                    } else if (type === 'crown') {
                        let grad = ctx.createLinearGradient(cx, Math.round(cy - 25), cx, Math.round(cy + 25)); grad.addColorStop(0, '#ffbe0b'); grad.addColorStop(1, '#fb5607'); ctx.fillStyle = grad;
                        ctx.beginPath(); ctx.moveTo(Math.round(cx - 35), Math.round(cy + 25)); ctx.lineTo(Math.round(cx + 35), Math.round(cy + 25)); ctx.lineTo(Math.round(cx + 40), Math.round(cy - 10)); ctx.lineTo(Math.round(cx + 18), Math.round(cy + 5)); ctx.lineTo(cx, Math.round(cy - 25)); ctx.lineTo(Math.round(cx - 18), Math.round(cy + 5)); ctx.lineTo(Math.round(cx - 40), Math.round(cy - 10)); ctx.closePath(); ctx.fill();
                        ctx.fillStyle = '#ffffff'; 
                        ctx.beginPath(); 
                        ctx.arc(Math.round(cx), Math.round(cy - 25), 4, 0, Math.PI * 2); 
                        ctx.arc(Math.round(cx - 40), Math.round(cy - 10), 3, 0, Math.PI * 2); 
                        ctx.arc(Math.round(cx + 40), Math.round(cy - 10), 3, 0, Math.PI * 2); 
                        ctx.fill(); 
                    } else if (type === 'fire') {
                        let grad = ctx.createLinearGradient(cx, Math.round(cy - 30), cx, Math.round(cy + 30)); grad.addColorStop(0, '#ff0055'); grad.addColorStop(0.5, '#ff5500'); grad.addColorStop(1, '#ffcc00'); ctx.fillStyle = grad;
                        ctx.beginPath(); ctx.moveTo(cx, Math.round(cy + 30)); ctx.bezierCurveTo(Math.round(cx - 35), Math.round(cy + 20), Math.round(cx - 30), Math.round(cy - 10), Math.round(cx - 10), Math.round(cy - 30)); ctx.bezierCurveTo(Math.round(cx - 5), Math.round(cy - 15), Math.round(cx + 5), Math.round(cy - 15), Math.round(cx + 10), Math.round(cy - 25)); ctx.bezierCurveTo(Math.round(cx + 35), Math.round(cy - 5), Math.round(cx + 30), Math.round(cy + 20), cx, Math.round(cy + 30)); ctx.closePath(); ctx.fill();
                    } else if (type === 'cherry') {
                        ctx.fillStyle = '#d90429'; ctx.beginPath(); ctx.arc(Math.round(cx - 16), Math.round(cy + 12), 16, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(Math.round(cx + 14), Math.round(cy + 15), 15, 0, Math.PI * 2); ctx.fill();
                        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(Math.round(cx - 20), Math.round(cy + 6), 3, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(Math.round(cx + 10), Math.round(cy + 10), 2.5, 0, Math.PI * 2); ctx.fill();
                        ctx.strokeStyle = '#70e000'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(Math.round(cx - 12), Math.round(cy - 2)); ctx.quadraticCurveTo(Math.round(cx - 5), Math.round(cy - 25), Math.round(cx + 10), Math.round(cy - 25)); ctx.moveTo(Math.round(cx + 10), Math.round(cy - 25)); ctx.quadraticCurveTo(Math.round(cx + 10), Math.round(cy - 15), Math.round(cx + 10), Math.round(cy + 2)); ctx.stroke(); //
                    }
                }
            }
            const nonce = Date.now();
            return new AttachmentBuilder(await canvas.toBuffer('image/png'), { name: `slots_${nonce}.png` });
        };

        const generateSlotButtons = (openedStatus, disableAll = false) => {
            const row = new ActionRowBuilder();
            for (let i = 0; i < 3; i++) {
                row.addComponents(new ButtonBuilder().setCustomId(`sl_${i}_${userId}`).setLabel(`Mở Ô ${i + 1}`).setStyle(openedStatus[i] ? ButtonStyle.Success : ButtonStyle.Primary).setDisabled(disableAll || openedStatus[i]));
            }
            return [row];
        };

        activeSlots.set(userId, { bet, finalSlots, openedStatus: [false, false, false], isProcessing: false });

        const initialAttachment = await drawSlotsCanvas([false, false, false], finalSlots);
        const startEmbed = new EmbedBuilder().setColor('#ff9f1c').setTitle('🎰 SIÊU HŨ CASINO MINI SLOTS 🎰').setDescription(`👤 Người chơi: <@${userId}>\n💰 Tiền cược: **${bet.toLocaleString()}** xu\n\n⚡ Cửa cược đã sẵn sàng! Bấm các nút dưới đây để nặn từng ô nhé.\n⏰ Hạn giờ mở: **60 giây**`).setImage(`attachment://${initialAttachment.name}`);
        const response = await message.reply({ embeds: [startEmbed], files: [initialAttachment], components: generateSlotButtons([false, false, false]) }).catch(() => null);

        if (!response) { activeSlots.delete(userId); return; }

        const collector = response.createMessageComponentCollector({ time: 60000 });
        
        collector.on('collect', async i => {
            if (i.user.id !== userId) {
                return i.deferUpdate().catch(() => null);
            }
            
            const game = activeSlots.get(userId);
            if (!game || game.isProcessing) {
                return i.deferUpdate().catch(() => null); 
            }

            const slotIndex = parseInt(i.customId.split('_')[1]);
            if (game.openedStatus[slotIndex]) {
                return i.deferUpdate().catch(() => null); 
            }
            
            await i.deferUpdate().catch(() => null);
            
            game.isProcessing = true;
            activeSlots.set(userId, game);
            
            await i.editReply({ components: generateSlotButtons(game.openedStatus, true) }).catch(() => null);

            setImmediate(async () => {
                try {
                    game.openedStatus[slotIndex] = true;
                    const isAllOpened = game.openedStatus[0] && game.openedStatus[1] && game.openedStatus[2];
                    
                    if (isAllOpened) {
                        game.isProcessing = false; 
                        activeSlots.set(userId, game);
                        collector.stop('completed');
                    } else {
                        const updateAttachment = await drawSlotsCanvas(game.openedStatus, game.finalSlots);
                        const updateEmbed = new EmbedBuilder().setColor('#ffaa00').setTitle('🎰 ĐANG KHUI TỪNG Ô HŨ...').setDescription(`👉 Bạn đang nặn hũ rất hồi hộp! Bấm tiếp các ô còn lại để mở toàn bộ.`).setImage(`attachment://${updateAttachment.name}`);
                        
                        game.isProcessing = false; 
                        activeSlots.set(userId, game);
                        
                        await i.editReply({ embeds: [updateEmbed], files: [updateAttachment], components: generateSlotButtons(game.openedStatus, false), attachments: [] }).catch(() => null);
                    }
                } catch (error) {
                    console.error("🚨 Lỗi đồ họa sảnh Slots:", error);
                    game.isProcessing = false;
                    activeSlots.set(userId, game);
                    await i.editReply({ components: generateSlotButtons(game.openedStatus, false) }).catch(() => null);
                }
            });
        });

        collector.on('end', async (collected, reason) => {
            const game = activeSlots.get(userId);
            if (!game) return;

            const finalOpened = [true, true, true];
            const isTriple = (game.finalSlots[0] === game.finalSlots[1] && game.finalSlots[1] === game.finalSlots[2]);
            const isPair = (game.finalSlots[0] === game.finalSlots[1] || game.finalSlots[1] === game.finalSlots[2] || game.finalSlots[0] === game.finalSlots[2]);

            let multiplier = 0; let winMsg = ""; let embedColor = "";

            if (isTriple) {
                if (game.finalSlots[0] === 'crown') { multiplier = 10; winMsg = "👑 JACKPOT HOÀNG GIA VƯƠNG MIỆN x10!!!"; embedColor = "#ffbe0b"; }
                else if (game.finalSlots[0] === 'diamond') { multiplier = 7; winMsg = "💎 ĐẠI THẮNG KIM CƯƠNG x7 THƯỞNG!!"; embedColor = "#00b4d8"; }
                else if (game.finalSlots[0] === 'fire') { multiplier = 5; winMsg = "🔥 NỔ HŨ THẦN LỬA SIÊU CẤP x5!"; embedColor = "#ff5500"; }
                else { multiplier = 3; winMsg = "🍒 TRÚNG TRIPLE CHERRY x3 THƯỞNG!"; embedColor = "#00ff00"; }
            } else if (isPair) {
                multiplier = 1.5; winMsg = "✨ TRÚNG CẶP ĐÔI MAY MẮN x1.5!"; embedColor = "#a2d2ff";
            } else {
                multiplier = 0; winMsg = "😢 Bài lệch hoàn toàn, chúc bạn may mắn lần sau!"; embedColor = "#3d3a3a";
            }

            let finalMoney = 0;
            if (multiplier > 0) {
                finalMoney = await db.addMoney(userId, game.bet * multiplier, true, 'slots');
            } else {
                finalMoney = await db.addMoney(userId, 0, false, 'slots');
            }

            try {
                const finalAttachment = await drawSlotsCanvas(finalOpened, game.finalSlots);
                const title = reason === 'time' ? '🎰 KẾT QUẢ QUAY HŨ (TỰ ĐỘNG KHUI - HẾT GIỜ)' : '🎰 KẾT QUẢ QUAY HŨ';
                const finalEmbed = new EmbedBuilder().setColor(embedColor).setTitle(title)
                    .setDescription(`🎯 Trạng thái: **${winMsg}**\n💵 Dòng tiền: ${multiplier > 0 ? `\`+${Math.floor(game.bet * multiplier).toLocaleString()}\` xu` : `\`-${game.bet.toLocaleString()}\` xu`}\n💰 Số dư hiện tại: **${finalMoney.toLocaleString()}** xu.`)
                    .setImage(`attachment://${finalAttachment.name}`);
                
                await response.edit({ embeds: [finalEmbed], files: [finalAttachment], components: [], attachments: [] }).catch(() => null);
            } catch (err) {
                console.error("🚨 Lỗi khi dựng hình kết quả Slots:", err);
                await response.edit({ content: `🎰 Kết quả Slots: **${winMsg}** (Số dư: ${finalMoney.toLocaleString()} xu)`, components: [] }).catch(() => null);
            }
            activeSlots.delete(userId); 
            await updateTopRanksRoles(message.guild);
        });
    }

    // ==========================================================
    // 🃏 GAME 5: CAO THẤP (HI-LO)
    // ==========================================================
    if (command === 'caothap' || command === 'ct') {
        const userId = message.author.id;
        if (activeCaoThap.has(userId)) return message.reply('❌ Bạn đang có một ván Cao Thấp chưa nhận thưởng!');

        const CONFIG_CT_WIN_RATE = 65; 

        const currentMoney = db.getMoney(userId);
        const rawBet = args[0]?.replace(/[\.,]/g, '');
        let bet = rawBet?.toLowerCase() === 'all' ? currentMoney : parseInt(rawBet);
        if (isNaN(bet) || bet <= 0 || currentMoney < bet) return message.reply('❌ Tiền cược không hợp lệ!');

        await db.addMoney(userId, -bet);

        const suits = ['C','D','H','S']; const vals = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
        let deck = []; for(let s of suits) for(let v of vals) deck.push({val:v, suit:s});
        deck.sort(() => Math.random() - 0.5);

        const currentCard = deck.pop();
        activeCaoThap.set(userId, { bet, deck, currentCard, multiplier: 1.0, isProcessing: false });

        const drawCaoThapCanvas = async (card, mul) => {
            const canvas = createCanvas(400, 300); const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#111827'; ctx.fillRect(0, 0, 400, 300);
            ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 4;
            ctx.beginPath(); ctx.roundRect?.(15, 15, 370, 270, 15); ctx.stroke();
            ctx.fillStyle = '#f8fafc'; ctx.beginPath(); ctx.roundRect?.(145, 45, 110, 160, 12); ctx.fill();
            const isRed = ['H', 'D'].includes(card.suit); ctx.fillStyle = isRed ? '#ef4444' : '#0f172a';
            ctx.font = 'bold 26px Arial'; ctx.fillText(card.val, 158, 80);
            let icon = '♣'; if (card.suit === 'D') icon = '♦'; if (card.suit === 'H') icon = '♥'; if (card.suit === 'S') icon = '♠';
            ctx.font = '48px Arial'; ctx.fillText(icon, 175, 140);
            ctx.fillStyle = '#f59e0b'; ctx.font = 'bold 22px Arial';
            ctx.fillText(`HỆ SỐ NHÂN: x${mul.toFixed(2)}`, 105, 250);
            return new AttachmentBuilder(await canvas.toBuffer('image/png'), { name: `caothap_${Date.now()}.png` });
        };

        const drawCaoThapWinCanvas = async (card, mul) => {
            const canvas = createCanvas(400, 300); const ctx = canvas.getContext('2d');
            let bgGrad = ctx.createRadialGradient(200, 150, 10, 200, 150, 220);
            bgGrad.addColorStop(0, '#065f46'); bgGrad.addColorStop(1, '#022c22');
            ctx.fillStyle = bgGrad; ctx.fillRect(0, 0, 400, 300);
            ctx.strokeStyle = '#10b981'; ctx.lineWidth = 5;
            ctx.beginPath(); ctx.roundRect?.(15, 15, 370, 270, 15); ctx.stroke(); 
            const particles = [{x: 50, y: 50, r: 4}, {x: 80, y: 220, r: 6}, {x: 320, y: 60, r: 5}, {x: 350, y: 230, r: 3}, {x: 90, y: 120, r: 3.5}, {x: 310, y: 170, r: 4}];
            ctx.fillStyle = '#fbbf24'; for (let p of particles) { ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill(); }
            ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.roundRect?.(50, 75, 90, 130, 10); ctx.fill(); 
            const isRed = ['H', 'D'].includes(card.suit); ctx.fillStyle = isRed ? '#ef4444' : '#0f172a';
            ctx.font = 'bold 22px Arial'; ctx.fillText(card.val, 62, 105);
            let icon = '♣'; if (card.suit === 'D') icon = '♦'; if (card.suit === 'H') icon = '♥'; if (card.suit === 'S') icon = '♠';
            ctx.font = '36px Arial'; ctx.fillText(icon, 78, 155);
            ctx.fillStyle = '#34d399'; ctx.font = 'bold 28px Arial'; ctx.fillText('VICTORY!', 195, 110); 
            ctx.fillStyle = '#ffffff'; ctx.font = '14px Arial'; ctx.fillText('ĐÃ RÚT TIỀN THÀNH CÔNG', 180, 140);
            ctx.fillStyle = '#fbbf24'; ctx.font = 'bold 36px Arial'; ctx.fillText(`x${mul.toFixed(2)}`, 210, 195); 
            return new AttachmentBuilder(await canvas.toBuffer('image/png'), { name: `caothap_win_${Date.now()}.png` });
        };

        const generateCTButtons = (disableAll = false) => new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`ct_cao_${userId}`).setLabel('🔺 Cao Hơn').setStyle(ButtonStyle.Primary).setDisabled(disableAll),
            new ButtonBuilder().setCustomId(`ct_thap_${userId}`).setLabel('🔻 Thấp Hơn').setStyle(ButtonStyle.Primary).setDisabled(disableAll),
            new ButtonBuilder().setCustomId(`ct_rut_${userId}`).setLabel('💰 Rút Tiền').setStyle(ButtonStyle.Success).setDisabled(disableAll)
        );

        const attach = await drawCaoThapCanvas(currentCard, 1.0);
        const embed = new EmbedBuilder().setColor('#f59e0b').setTitle('🃏 GAME CAO THẤP VIP').setDescription(`👤 Người chơi: <@${userId}>\n💵 Vốn gốc: **${bet.toLocaleString()}** xu\n\n🔮 Đoán xem lá tiếp theo Cao hơn hay Thấp hơn lá này?\n⚠️ **Lưu ý:** Rút tiền ngay tại mốc đầu tiên khi chưa đoán sẽ bị phạt **phí hủy ván 50% cược gốc**!\n⏰ Hạn giờ: **60 giây**`).setImage(`attachment://${attach.name}`);
        const response = await message.reply({ embeds: [embed], files: [attach], components: [generateCTButtons(false)] });

        const collector = response.createMessageComponentCollector({ time: 60000 });
        collector.on('collect', async i => {
            if (i.user.id !== userId) return i.reply({ content: '❌ Không phải lượt của bạn!', flags: [MessageFlags.Ephemeral] });
            const game = activeCaoThap.get(userId);
            if (!game || game.isProcessing) return i.deferUpdate().catch(() => null);

            game.isProcessing = true; activeCaoThap.set(userId, game);
            await i.deferUpdate().catch(() => null);

            const act = i.customId.split('_')[1];
            const cardWeight = {'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14};

            if (act === 'rut') {
                collector.stop('payout');
                return;
            }

            if (game.deck.length === 0) {
                const suits2 = ['C','D','H','S']; const vals2 = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
                for(let s of suits2) for(let v of vals2) game.deck.push({val:v, suit:s});
                game.deck.sort(() => Math.random() - 0.5);
            }

            let nextCard = game.deck.pop();
            let oldWeight = cardWeight[game.currentCard.val];
            let nextWeight = cardWeight[nextCard.val];

            const xucXacTyLe = Math.random() * 100;
            if (xucXacTyLe > CONFIG_CT_WIN_RATE) {
                let foundRiggedCardIdx = game.deck.findIndex(c => {
                    let w = cardWeight[c.val];
                    if (act === 'cao' && w < oldWeight) return true;
                    if (act === 'thap' && w > oldWeight) return true;
                    return false;
                });

                if (foundRiggedCardIdx !== -1) {
                    game.deck.push(nextCard);
                    nextCard = game.deck.splice(foundRiggedCardIdx, 1)[0];
                    nextWeight = cardWeight[nextCard.val];
                }
            }

            let isCorrect = false;
            if (act === 'cao' && nextWeight >= oldWeight) isCorrect = true;
            if (act === 'thap' && nextWeight <= oldWeight) isCorrect = true;

            if (isCorrect) {
                game.multiplier += 0.35; 
                game.currentCard = nextCard;
                game.isProcessing = false;
                activeCaoThap.set(userId, game);

                const nextAttach = await drawCaoThapCanvas(nextCard, game.multiplier);
                const nextEmbed = new EmbedBuilder().setColor('#f59e0b').setTitle('💎 ĐOÁN CHÍNH XÁC!').setDescription(`👤 Người chơi: <@${userId}>\n💵 Hệ số hiện tại: **x${game.multiplier.toFixed(2)}**\n\nTiếp tục đoán lá kế tiếp nào!`).setImage(`attachment://${nextAttach.name}`);
                await i.editReply({ embeds: [nextEmbed], files: [nextAttach], components: [generateCTButtons(false)], attachments: [] }).catch(() => null);
                collector.resetTimer();
            } else {
                collector.stop('wrong_guess');
                await db.addMoney(userId, 0, false, 'caothap');
                const loseAttach = await drawCaoThapCanvas(nextCard, 0.0);
                const loseEmbed = new EmbedBuilder().setColor('#ef4444').setTitle('💥 ĐOÁN SAI - THUA CUỘC').setDescription(`😢 Lá bài ra là **${nextCard.val}**. Bạn đã đoán sai và mất trắng số tiền cược gốc!\n💰 Số dư: **${db.getMoney(userId).toLocaleString()}** xu.`).setImage(`attachment://${loseAttach.name}`);
                await i.editReply({ embeds: [loseEmbed], files: [loseAttach], components: [], attachments: [] }).catch(() => null);
                activeCaoThap.delete(userId);
            }
        });

        collector.on('end', async (collected, reason) => {
            const game = activeCaoThap.get(userId);
            if (!game) return;

            if (reason === 'payout' || reason === 'time') {
                let totalWin = 0;
                let textResult = "";
                let title = "";
                let colorEmbed = '#10b981';

                if (game.multiplier === 1.0) {
                    totalWin = Math.floor(game.bet * 0.5); 
                    title = reason === 'time' ? '💰 TỰ ĐỘNG CHỐT LỜI (PHẠT 50% DO HẾT GIỜ)' : '⚠️ ĐÃ HỦY VÁN SỚM (PHẠT 50% CƯỢC)';
                    colorEmbed = '#ef4444';
                    textResult = `⚠️ Bạn đã rút tiền ngay tại mốc khai cuộc khi chưa thực hiện dự đoán nào.\n💵 Cược gốc: **${game.bet.toLocaleString()}** xu\n💸 Phí phạt hủy ván (50%): **-${Math.floor(game.bet * 0.5).toLocaleString()}** xu\n💰 Hoàn lại ví: **${totalWin.toLocaleString()}** xu.`;
                } else {
                    totalWin = Math.floor(game.bet * game.multiplier);
                    title = reason === 'time' ? '💰 TỰ ĐỘNG CHỐT LỜI (HẾT GIỜ)' : '💰 ĐÃ RÚT TIỀN THÀNH CÔNG';
                    textResult = `🎉 Chúc mừng bạn đã bảo toàn lợi nhuận thành công!\n💵 Tổng thưởng nhận được: **${totalWin.toLocaleString()}** xu (Hệ số nhân: x${game.multiplier.toFixed(2)})`;
                }

                const finalMoney = await db.addMoney(userId, totalWin, game.multiplier > 1.0, 'caothap');
                const winAttach = await drawCaoThapWinCanvas(game.currentCard, game.multiplier);
                const winEmbed = new EmbedBuilder().setColor(colorEmbed).setTitle(title).setDescription(`${textResult}\n💰 Số dư hiện tại: **${finalMoney.toLocaleString()}** xu.`).setImage(`attachment://${winAttach.name}`);
                
                await response.edit({ embeds: [winEmbed], files: [winAttach], components: [], attachments: [] }).catch(() => null);
                activeCaoThap.delete(userId);
                await updateTopRanksRoles(message.guild);
            }
        });
    }

    // ==========================================================
    // 🦀 GAME 6: BẦU CUA CASINO
    // ==========================================================
    if (command === 'baucua' || command === 'bc') {
        const userId = message.author.id;
        if (activeBauCua.has(userId)) return message.reply('❌ Bạn đang có một phòng cược Bầu Cua chưa lắc xúc xắc!');

        const betPerClick = parseInt(args[0]?.replace(/[\.,]/g, '')) || 10000;
        const currentMoney = db.getMoney(userId);
        if (currentMoney < betPerClick || betPerClick <= 0) return message.reply('❌ Ví của bạn không đủ tiền cược cho mỗi lần click!');

        const gameState = {
            betPerClick,
            slots: { bau: 0, cua: 0, tom: 0, ca: 0, ga: 0, nai: 0 },
            totalBet: 0,
            isProcessing: false
        };
        activeBauCua.set(userId, gameState);

        const bcItems = [
            { id: 'bau', name: 'BẦU', emoji: '🍇', color: '#f43f5e' },
            { id: 'cua', name: 'CUA', emoji: '🦀', color: '#f97316' },
            { id: 'tom', name: 'TÔM', emoji: '🦐', color: '#eab308' },
            { id: 'ca', name: 'CÁ', emoji: '🐟', color: '#06b6d4' },
            { id: 'ga', name: 'GÀ', emoji: '🐓', color: '#ec4899' },
            { id: 'nai', name: 'NAI', emoji: '🦌', color: '#a855f7' }
        ];

        const drawLinhVatVector = (ctx, id, x, y, size) => {
            ctx.save();
            ctx.shadowColor = 'rgba(0, 0, 0, 0.4)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 4;
            
            if (id === 'bau') {
                let grad1 = ctx.createLinearGradient(x-size*0.3, y, x+size*0.3, y+size*0.3);
                grad1.addColorStop(0, '#f43f5e'); grad1.addColorStop(1, '#9f1239'); ctx.fillStyle = grad1;
                ctx.beginPath(); ctx.arc(x, y + size*0.14, size*0.27, 0, Math.PI*2); ctx.fill();
                let grad2 = ctx.createLinearGradient(x-size*0.2, y-size*0.3, x+size*0.2, y);
                grad2.addColorStop(0, '#fda4af'); grad2.addColorStop(1, '#e11d48'); ctx.fillStyle = grad2;
                ctx.beginPath(); ctx.arc(x, y - size*0.18, size*0.19, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = '#fbbf24'; ctx.beginPath(); ctx.ellipse?.(x, y - size*0.02, size*0.16, size*0.05, 0, 0, Math.PI*2); ctx.fill();
                ctx.strokeStyle = '#10b981'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x, y - size*0.35); ctx.quadraticCurveTo(x + size*0.1, y - size*0.46, x + size*0.15, y - size*0.38); ctx.stroke();
            } 
            else if (id === 'cua') {
                let grad = ctx.createLinearGradient(x-size*0.3, y, x+size*0.3, y);
                grad.addColorStop(0, '#fb923c'); grad.addColorStop(1, '#c2410c'); ctx.fillStyle = grad;
                ctx.beginPath(); ctx.ellipse?.(x, y + size*0.06, size*0.34, size*0.23, 0, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x - size*0.08, y - size*0.18, 5, 0, Math.PI*2); ctx.arc(x + size*0.08, y - size*0.18, 5, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = '#000000'; ctx.beginPath(); ctx.arc(x - size*0.08, y - size*0.18, 2.5, 0, Math.PI*2); ctx.arc(x + size*0.08, y - size*0.18, 2.5, 0, Math.PI*2); ctx.fill();
                ctx.strokeStyle = '#ea580c'; ctx.lineWidth = 6; ctx.lineCap = 'round';
                ctx.beginPath(); ctx.arc(x - size*0.22, y - size*0.1, size*0.15, Math.PI*0.8, Math.PI*1.8); ctx.stroke();
                ctx.beginPath(); ctx.arc(x + size*0.22, y - size*0.1, size*0.15, Math.PI*1.2, Math.PI*2.2); ctx.stroke();
                ctx.strokeStyle = '#c2410c'; ctx.lineWidth = 4; ctx.beginPath();
                for (let sign of [-1, 1]) {
                    ctx.moveTo(x + sign*size*0.2, y + size*0.1); ctx.lineTo(x + sign*size*0.4, y + size*0.22);
                    ctx.moveTo(x + sign*size*0.15, y + size*0.16); ctx.lineTo(x + sign*size*0.32, y + size*0.32);
                }
                ctx.stroke();
            } 
            else if (id === 'tom') {
                let grad = ctx.createLinearGradient(x-size*0.2, y-size*0.2, x+size*0.2, y+size*0.2);
                grad.addColorStop(0, '#fde047'); grad.addColorStop(1, '#ca8a04'); ctx.fillStyle = grad;
                ctx.beginPath(); ctx.arc(x + size*0.06, y + size*0.06, size*0.23, 0, Math.PI*2); ctx.fill();
                ctx.beginPath(); ctx.arc(x - size*0.08, y - size*0.03, size*0.18, 0, Math.PI*2); ctx.fill();
                ctx.beginPath(); ctx.arc(x - size*0.19, y - size*0.12, size*0.14, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = '#a16207'; ctx.beginPath(); ctx.moveTo(x + size*0.2, y + size*0.16); ctx.lineTo(x + size*0.4, y + size*0.3); ctx.lineTo(x + size*0.32, y + size*0.06); ctx.closePath(); ctx.fill();
                ctx.strokeStyle = '#eab308'; ctx.lineWidth = 2.5; ctx.beginPath();
                ctx.moveTo(x - size*0.22, y - size*0.16); ctx.quadraticCurveTo(x - size*0.32, y - size*0.46, x - size*0.2, y - size*0.58); ctx.stroke();
            } 
            else if (id === 'ca') {
                let grad = ctx.createLinearGradient(x-size*0.4, y, x+size*0.2, y);
                grad.addColorStop(0, '#22d3ee'); grad.addColorStop(1, '#0e7490'); ctx.fillStyle = grad;
                ctx.beginPath(); ctx.ellipse?.(x - size*0.04, y, size*0.38, size*0.22, 0, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = '#0891b2'; ctx.beginPath(); ctx.moveTo(x + size*0.28, y); ctx.lineTo(x + size*0.46, y - size*0.23); ctx.lineTo(x + size*0.46, y + size*0.23); ctx.closePath(); ctx.fill();
                ctx.beginPath(); ctx.moveTo(x - size*0.04, y - size*0.16); ctx.lineTo(x + size*0.12, y - size*0.35); ctx.lineTo(x + size*0.16, y - size*0.15); ctx.closePath(); ctx.fill();
                ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x - size*0.22, y - size*0.04, 5, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = '#000000'; ctx.beginPath(); ctx.arc(x - size*0.23, y - size*0.04, 2.5, 0, Math.PI*2); ctx.fill();
            } 
            else if (id === 'ga') {
                let grad = ctx.createLinearGradient(x, y-size*0.2, x, y+size*0.3);
                grad.addColorStop(0, '#fbcfe8'); grad.addColorStop(1, '#be185d'); ctx.fillStyle = grad;
                ctx.beginPath(); ctx.arc(x + size*0.06, y + size*0.09, size*0.27, 0, Math.PI*2); ctx.fill();
                ctx.beginPath(); ctx.arc(x - size*0.15, y - size*0.13, size*0.18, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = '#f97316'; ctx.beginPath(); ctx.moveTo(x - size*0.31, y - size*0.13); ctx.lineTo(x - size*0.44, y - size*0.07); ctx.lineTo(x - size*0.31, y - size*0.02); ctx.closePath(); ctx.fill();
                ctx.fillStyle = '#dc2626'; ctx.beginPath(); ctx.arc(x - size*0.14, y - size*0.31, 7, 0, Math.PI*2); ctx.arc(x - size*0.22, y - size*0.26, 6, 0, Math.PI*2); ctx.arc(x - size*0.06, y - size*0.28, 5, 0, Math.PI*2); ctx.fill();
            } 
            else if (id === 'nai') {
                let grad = ctx.createLinearGradient(x, y-size*0.2, x, y+size*0.3);
                grad.addColorStop(0, '#c084fc'); grad.addColorStop(1, '#6b21a8'); ctx.fillStyle = grad;
                ctx.beginPath(); ctx.arc(x, y + size*0.09, size*0.25, 0, Math.PI*2); ctx.fill();
                ctx.beginPath(); ctx.ellipse?.(x - size*0.2, y - size*0.1, size*0.09, size*0.18, Math.PI*0.15, 0, Math.PI*2); ctx.fill();
                ctx.beginPath(); ctx.ellipse?.(x + size*0.2, y - size*0.1, size*0.09, size*0.18, -Math.PI*0.15, 0, Math.PI*2); ctx.fill();
                ctx.strokeStyle = '#f8fafc'; ctx.lineWidth = 3; ctx.stroke();
            }
            ctx.restore();
        };
    }
});

client.login(BOT_TOKEN);