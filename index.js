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
const activeXuXi = new Map(); 
const activeCrash = new Map(); // Lưu trữ game Crash tập thể theo Kênh (Channel ID)

// ==========================================================
// 👑 DANH SÁCH CONFIG WHITELIST & ID ROLE ĐẠI GIA REAL-TIME
// ==========================================================
const CONFIG_SERVER_ID = "1379097900323180665"; // ID Server của bạn

const CONFIG_ADMIN_ID = [
    "1354110406456643597"
]; 

const CONFIG_ADMIN_ROLES = [
    "1457040413020913685",
    "1494228787469090988"
];

const CONFIG_TOP_ROLES = {
    top1: "1526090056924659742",
    top2: "1526090239058247811",
    top3: "1526090219231903794"
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
    // Kiểm tra nếu bot đang chạy ở đúng server config mới thực hiện cập nhật role
    if (guild.id !== CONFIG_SERVER_ID) return;

    const topList = db.getTop10() || [];
    const currentTopIds = {
        top1: topList[0]?.id || null,
        top2: topList[1]?.id || null,
        top3: topList[2]?.id || null
    };

    try {
        const roleIds = [CONFIG_TOP_ROLES.top1, CONFIG_TOP_ROLES.top2, CONFIG_TOP_ROLES.top3];
        for (const roleId of roleIds) {
            const role = await guild.roles.fetch(roleId).catch(() => null);
            if (!role) continue;
            for (const [memberId, member] of role.members) {
                if (roleId === CONFIG_TOP_ROLES.top1 && memberId !== currentTopIds.top1) await member.roles.remove(CONFIG_TOP_ROLES.top1).catch(() => null);
                if (roleId === CONFIG_TOP_ROLES.top2 && memberId !== currentTopIds.top2) await member.roles.remove(CONFIG_TOP_ROLES.top2).catch(() => null);
                if (roleId === CONFIG_TOP_ROLES.top3 && memberId !== currentTopIds.top3) await member.roles.remove(CONFIG_TOP_ROLES.top3).catch(() => null);
            }
        }
        if (currentTopIds.top1) {
            const m1 = await guild.members.fetch(currentTopIds.top1).catch(() => null);
            if (m1 && !m1.roles.cache.has(CONFIG_TOP_ROLES.top1)) await m1.roles.add(CONFIG_TOP_ROLES.top1).catch(() => null);
        }
        if (currentTopIds.top2) {
            const m2 = await guild.members.fetch(currentTopIds.top2).catch(() => null);
            if (m2 && !m2.roles.cache.has(CONFIG_TOP_ROLES.top2)) await m2.roles.add(CONFIG_TOP_ROLES.top2).catch(() => null);
        }
        if (currentTopIds.top3) {
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

// ==========================================================
// 🎨 RENDER GIAO DIỆN CANAVAS GAME CRASH (TÀU VŨ TRỤ) SIÊU ĐẸP
// ==========================================================
async function drawRocketCanvas(currentMultiplier, isCrashed = false) {
    const canvas = createCanvas(600, 350);
    const ctx = canvas.getContext('2d');

    // 1. Phông nền Không gian chuyển sắc Gradient sâu thẳm
    const bgGrad = ctx.createLinearGradient(0, 0, 0, 350);
    bgGrad.addColorStop(0, '#0d0c1d');
    bgGrad.addColorStop(1, '#040308');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 600, 350);

    // 2. Vẽ dải ngân hà phát sáng mờ ảo bằng Radial Gradient
    const galaxyGrad = ctx.createRadialGradient(450, 100, 10, 450, 100, 150);
    galaxyGrad.addColorStop(0, 'rgba(124, 58, 237, 0.25)'); // Tím Nebulae
    galaxyGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = galaxyGrad;
    ctx.beginPath();
    ctx.arc(450, 100, 150, 0, Math.PI * 2);
    ctx.fill();

    // 3. Hiệu ứng hạt bụi sao lấp lánh (Golden Stars)
    ctx.fillStyle = '#fde047';
    for (let i = 0; i < 25; i++) {
        let starX = (Math.sin(i * 98765) * 0.5 + 0.5) * 600;
        let starY = (Math.cos(i * 56789) * 0.5 + 0.5) * 350;
        let starSize = (i % 3 === 0) ? 2 : 1;
        ctx.save();
        ctx.shadowColor = '#facc15';
        ctx.shadowBlur = (i % 3 === 0) ? 5 : 0;
        ctx.fillRect(starX, starY, starSize, starSize);
        ctx.restore();
    }

    // 4. Các đường quỹ đạo hành tinh mờ ảo chạy ngang
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    for(let r = 1; r <= 3; r++) {
        ctx.beginPath();
        ctx.arc(300, 500, r * 150, Math.PI, Math.PI * 2);
        ctx.stroke();
    }

    // Tọa độ điểm bắt đầu và điểm mút của quỹ đạo parabol
    const startX = 80, startY = 270;
    const factor = Math.min(currentMultiplier, 8); // Tỷ lệ kéo dốc đồ thị
    const endX = startX + (factor - 1) * 55; 
    const endY = startY - (factor - 1) * 26;

    if (!isCrashed) {
        // 5. Vẽ đường cong Neon chuyển màu tuyệt đẹp
        ctx.save();
        const curveGrad = ctx.createLinearGradient(startX, startY, endX, endY);
        curveGrad.addColorStop(0, '#39ff14'); // Xanh lục Neon
        curveGrad.addColorStop(1, '#00f2fe'); // Xanh Neon
        ctx.strokeStyle = curveGrad;
        ctx.shadowColor = '#00f2fe';
        ctx.shadowBlur = 20;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.quadraticCurveTo((startX + endX) / 2, startY, endX, endY);
        ctx.stroke();
        ctx.restore();

        // 6. Vẽ Tàu Vũ Trụ (Rocket Vector) cực ngầu ngay đầu đường cong
        ctx.save();
        // Tính toán góc nghiêng của tàu vũ trụ để bám sát độ dốc đường parabol
        const angle = Math.atan2(endY - startY, endX - startX) * 0.5; // Góc nghiêng giảm nhẹ để tàu nhìn cân đối
        ctx.translate(endX, endY);
        ctx.rotate(angle);

        // Vẽ lửa phản lực phía đuôi tàu vũ trụ
        const flameGrad = ctx.createLinearGradient(-30, 0, -10, 0);
        flameGrad.addColorStop(0, 'rgba(239, 68, 68, 0)');
        flameGrad.addColorStop(0.5, '#ef4444');
        flameGrad.addColorStop(1, '#f97316');
        ctx.fillStyle = flameGrad;
        ctx.beginPath();
        ctx.moveTo(-10, -5);
        ctx.lineTo(-28, 0);
        ctx.lineTo(-10, 5);
        ctx.closePath();
        ctx.fill();

        // Vẽ thân tàu vũ trụ màu bạc kim loại
        ctx.fillStyle = '#cbd5e1';
        ctx.beginPath();
        ctx.moveTo(-12, -7);
        ctx.lineTo(12, 0);
        ctx.lineTo(-12, 7);
        ctx.closePath();
        ctx.fill();

        // Vẽ cánh tên lửa màu đỏ nổi bật
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.moveTo(-12, -7);
        ctx.lineTo(-18, -12);
        ctx.lineTo(-8, -5);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(-12, 7);
        ctx.lineTo(-18, 12);
        ctx.lineTo(-8, 5);
        ctx.closePath();
        ctx.fill();

        // Vẽ cửa kính của buồng lái phi hành gia
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(2, 0, 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    } else {
        // 7. Render Vụ nổ siêu thực (Explosion) bùng cháy nếu tàu Crash
        ctx.save();
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = 35;
        
        // Lớp khói bụi nổ đỏ cam ngoài cùng
        ctx.fillStyle = 'rgba(239, 68, 68, 0.85)';
        ctx.beginPath();
        for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
            let rx = endX + Math.cos(a) * (20 + Math.random() * 18);
            let ry = endY + Math.sin(a) * (20 + Math.random() * 18);
            ctx.arc(rx, ry, 15, 0, Math.PI * 2);
        }
        ctx.fill();

        // Nhân vụ nổ rực vàng trung tâm
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(endX, endY, 20, 0, Math.PI * 2);
        ctx.fill();

        // Điểm phát sáng chói trắng lõi nổ
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(endX, endY, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    // 8. Khung viền mờ Glassmorphism chứa Hệ Số Nhân cực xịn
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
    ctx.strokeStyle = isCrashed ? 'rgba(239, 68, 68, 0.4)' : 'rgba(0, 242, 254, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.shadowBlur = 10;
    ctx.shadowColor = isCrashed ? '#ef4444' : '#00f2fe';
    ctx.beginPath();
    ctx.roundRect?.(200, 130, 200, 75, 15);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // 9. Hiển thị hệ số nhân real-time siêu to rõ nét
    ctx.fillStyle = isCrashed ? '#ef4444' : '#00ff66';
    ctx.font = 'bold 44px Impact, Arial Black, Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`${currentMultiplier.toFixed(2)}x`, 300, 182);

    // Trục biểu đồ mờ để canh tọa độ
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(startX - 15, startY);
    ctx.lineTo(540, startY);
    ctx.moveTo(startX, startY + 15);
    ctx.lineTo(startX, 40);
    ctx.stroke();

    return canvas.toBuffer('image/png');
}

// Thuật toán sinh điểm phát nổ (Crash Point) cực kỳ công bằng
// Tối thiểu là x1.08, ngăn chặn việc vừa vào nổ ngay (Insta-crash)
function generateCrashPoint() {
    const rand = Math.random();
    if (rand < 0.05) return 1.08 + parseFloat((Math.random() * 0.1).toFixed(2)); // 5% cơ hội nổ sớm tại mốc x1.08 -> x1.18
    return parseFloat((1.08 / (1 - Math.random())).toFixed(2));
}

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
                `• \`-play\` — Mở danh sách menu các trò chơi Minigame\n` +
                `• \`-crash\` — Game Tàu Vũ Trụ siêu tốc (Chơi chung cả Server cực cháy) 🚀\n` +
                `• \`-domin [tiền]\` hoặc \`-dm [tiền]\` — Chơi Dò Mìn (Minesweeper)\n` +
                `• \`-taixiu\` hoặc \`-tx\` — Chơi Tài Xỉu lật viên\n` +
                `• \`-blackjack\` hoặc \`-bj\` — Chơi Blackjack Xì Dách Việt Nam\n` +
                `• \`-slots [tiền]\` hoặc \`-sl [tiền]\` — Chơi Quay Hũ Mini Slot VIP\n` +
                `• \`-caothap [tiền]\` hoặc \`-ct [tiền]\` — Chơi Cao Thấp (Hi-Lo) chuỗi nhân thưởng\n` +
                `• \`-baucua [tiền_mỗi_click]\` hoặc \`-bc [tiền_mỗi_click]\` — Sảnh cược Bầu Cua tương tác nhiều ô\n` +
                `• \`-xuxi [tiền]\` hoặc \`-xx [tiền]\` — Đấu với Máy (PvE)\n` +
                `• \`-xuxi @user [tiền]\` hoặc \`-xx @user [tiền]\` — Quyết đấu Kéo Búa Bao với bạn bè (PvP)\n` +
                `• \`-tien [@mention]\` — Xem số dư tài khoản\n` +
                `• \`-top\` — Xem bảng xếp hạng 10 người giàu nhất\n` +
                `• \`-daily\` — Điểm danh nhận thưởng hàng ngày\n` +
                `• \`-xintien\` — Xin tiền trợ cấp từ hệ thống (Tối đa 10 lần/ngày)\n` +
                `• \`-chuyentien @mention [tiền]\` — Chuyển tiền cho người khác\n` +
                `• \`-soicau\` — Xem bảng phân tích lịch sử Tài Xỉu\n` +
                `• \`-profile\` — Xem hồ sơ và chi tiết tỷ lệ thắng cá nhân\n` +
                `• \`-code\` — Xem danh sách hoặc nhập mã quà tặng\n` +
                `• \`-delcode [tên_code]\` — Xóa mã quà tặng khỏi hệ thống\n` +
                `• \`-check\` — Mở bảng điều khiển này`
            );
        return message.reply({ embeds: [checkEmbed] });
    }

    if (command === 'daily') {
        const res = db.doDaily(message.author.id);
        if (!res.success) return message.reply(res.msg);
        const msgReply = await message.reply('🎉 **Điểm danh thành công!** Bạn nhận được `+' + res.gift.toLocaleString() + '` 🪙.\n💰 Số dư hiện tại: **' + res.money.toLocaleString() + '** 🪙.');
        await updateTopRanksRoles(message.guild); 
        return msgReply;
    }

    if (command === 'xintien') {
        const res = db.doXinTien(message.author.id);
        if (!res.success) return message.reply(res.msg);
        const msgReply = await message.reply('💸 **Trợ cấp thành công!** Bạn nhận được trợ cấp `+' + res.gift.toLocaleString() + '` 🪙.\n💰 Số dư hiện tại: **' + res.money.toLocaleString() + '** 🪙 (Hôm nay đã xin **' + res.count + '/10** lần).');
        await updateTopRanksRoles(message.guild);
        return msgReply;
    }

    if (command === 'tien') {
        const target = message.mentions.users.first() || message.author;
        const money = db.getMoney(target.id) || 0;
        return message.reply('💰 Số dư tài khoản của ' + (target.id === message.author.id ? 'bạn' : target.username) + ' là: **' + money.toLocaleString() + '** 🪙.');
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
        const msgReply = await message.reply('💸 Bạn đã chuyển thành công **' + amount.toLocaleString() + '** 🪙 cho <@' + target.id + '>?');
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
            .setFooter({ text: 'Nhà Đực Minigame • Chúc các đại gia bắt cầu chuẩn xác!' });

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
        const xxTotal = userStats.xuxi?.total || 0; const xxWin = userStats.xuxi?.win || 0;
        const crTotal = userStats.crash?.total || 0; const crWin = userStats.crash?.win || 0;

        const totalGames = txTotal + dmTotal + bjTotal + slTotal + ctTotal + bcTotal + xxTotal + crTotal; 
        const totalWins = txWin + dmWin + bjWin + slWin + ctWin + bcWin + xxWin + crWin;
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
                    `🦀 **Bầu Cua:** ${bcTotal} ván (${bcWin} thắng)\n` +
                    `🚀 **Tàu Vũ Trụ:** ${crTotal} ván (${crWin} thắng)\n` +
                    `✌️ **Xù Xì:** ${xxTotal} ván (${xxWin} thắng)`
                }
            );
        return message.reply({ embeds: [profileEmbed] });
    }

    if (command === 'play') {
        const playEmbed = new EmbedBuilder().setColor('#1093ff').setTitle('🎮 SÒNG BÀI NHÀ ĐỰC MINIGAME')
            .setDescription(
                `👉 Hệ thống trò chơi Nhà Đực đã sẵn sàng, hãy gõ đúng cú pháp để mở bàn cược:\n\n` +
                `🚀 **Tàu Vũ Trụ:** \`-crash\` — Lập phòng chơi tập thể cho toàn bộ Server.\n` +
                `🎲 **Tài Xỉu:** \`-tx [tai/xiu] [tiền cược]\` — Thí dụ: \`-tx tai 10000\`\n` +
                `💣 **Dò Mìn:** \`-dm [tiền]\` — Tìm kim cương an toàn. Gõ \`-dm out\` để chốt rút lời.\n` +
                `🃏 **Blackjack:** \`-bj [tiền]\` — Đấu bài Xì Dách chuẩn với Nhà Cái.\n` +
                `🎰 **Mini Slots:** \`-sl [tiền]\` — Quay hũ nhận siêu Jackpot x10 thưởng.\n` +
                `🃏 **Cao Thấp:** \`-ct [tiền]\` — Đoán lá bài tiếp theo Cao hay Thấp để tích chuỗi nhân tiền.\n` +
                `🦀 **Bầu Cua:** \`-bc [tiền_mỗi_click]\` — Mở sảnh cược Bầu Cua tương tác nhiều ô qua nút bấm.\n` +
                `✌️ **Xù Xì (Máy):** \`-xx [tiền]\` — Quyết đấu Kéo Búa Bao với Nhà Cái bằng Canvas tinh tế.\n` +
                `⚔️ **Xù Xì (Người):** \`-xx @người_chơi [tiền]\` — Thách đấu Xù Xì cực căng với bạn bè.`
            )
            .setFooter({ text: 'Nhà Đực Minigame • Chúc các đại gia chơi game vui vẻ thắng lớn!' });
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
        return message.reply('💰 Đã cộng thành công `+' + amount.toLocaleString() + '` xu cho <@' + target.id + '>.');
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

    if (command === 'delcode') {
        const { PermissionFlagsBits } = require('discord.js');
        if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages) && !message.member.permissions.has(PermissionFlagsBits.Administrator)) return message.reply('❌ Quyền hạn không đủ!');
        const codeName = args[0];
        if (!codeName) return message.reply('❌ Cú pháp: `-delcode [tên_code]`');
        
        // Kiểm tra xem database có hàm delete hoặc sửa đổi trực tiếp từ danh sách
        const giftcodes = db.getGiftcodes();
        if (!giftcodes || !giftcodes[codeName]) {
            return message.reply(`❌ Không tìm thấy mã code **\`${codeName}\`** trong cơ sở dữ liệu!`);
        }
        
        delete giftcodes[codeName];
        
        // Đồng bộ dữ liệu mới ghi đè vào data.json (nếu thư viện db của bạn lưu trữ theo cơ chế file này)
        try {
            fs.writeFileSync('./data.json', JSON.stringify(JSON.parse(fs.readFileSync('./data.json', 'utf8')), null, 2));
            // Tuy nhiên do db quản lý, tùy thuộc cấu trúc file database.js của bạn, ta gọi lưu trực tiếp:
            if (typeof db.save === 'function') {
                db.save();
            } else if (db.data && typeof db.write === 'function') {
                db.write();
            } else {
                // Sửa trực tiếp thông qua API nếu db hỗ trợ hoặc tự ghi đè
                const fullData = JSON.parse(fs.readFileSync('./data.json', 'utf8'));
                if (fullData.giftcodes) {
                    delete fullData.giftcodes[codeName];
                    fs.writeFileSync('./data.json', JSON.stringify(fullData, null, 2));
                }
            }
        } catch (err) {
            console.error("Lỗi khi ghi đè tệp dữ liệu delcode: ", err);
        }

        return message.reply(`🗑️ Đã xóa mã code **\`${codeName}\`** khỏi hệ thống thành công!`);
    }

    if (command === 'code') {
        const codeName = args[0];
        if (!codeName) {
            const giftcodes = db.getGiftcodes();
            const activeList = [];
            for (const [name, info] of Object.entries(giftcodes)) {
                const conLuot = info.maxUses - (info.usedUsers?.length || 0);
                if (conLuot > 0) activeList.push(`• 🔑 Mã: **\`${name}\`** | Còn: \`${conLuot}/${info.maxUses}\` lượt (Nhập lại vào ngày mai)`);
            }
            
            const formatDescription = 
                `💡 **Cách nhập code:** Bạn hãy gõ theo cú pháp: \`-code [tên_mã]\` để nhận quà!\n` +
                `*Ví dụ: Nếu mã là lmtp, hãy gõ: \`-code lmtp\`*\n\n` +
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
        return message.reply({ content: '🎁 Nhập mã thành công! Bạn nhận được **+' + res.money.toLocaleString() + '** 🪙.' });
    }

    if (command === 'resettien') {
        // Phân quyền: Yêu cầu quyền Quản lý tin nhắn (Whitelist) hoặc Admin hệ thống
        const { PermissionFlagsBits } = require('discord.js');
        if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages) && 
            !message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('❌ Quyền hạn không đủ! Bạn không thể thực hiện lệnh này.');
        }

        if (args[0]?.toLowerCase() === 'all') {
            // Lệnh reset "all" nhạy cảm vẫn yêu cầu bắt buộc quyền Administrator gốc
            if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return message.reply('❌ Bạn cần quyền Administrator hệ thống để thực hiện Đại Thanh Lọc!');
            }
            db.resetAllMoney();
            await updateTopRanksRoles(message.guild);
            return message.reply('🚨 **ĐẠI THANH LỌC!** Toàn bộ số dư của server đã được đưa về mức **50,000đ** gốc.');
        }

        const target = message.mentions.users.first() || message.author;
        db.resetUserMoney(target.id);
        await updateTopRanksRoles(message.guild);
        return message.reply('🔄 Đã đặt lại ví của <@' + target.id + '> về mức **50,000đ**.');
    }

    if (command === 'backup') {
        const { PermissionFlagsBits } = require('discord.js');
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('❌ Bạn không có quyền Administrator để thực hiện lệnh này!');
        }
        const backupMsg = await message.reply('⏳ Đang tiến hành đồng bộ và backup dữ liệu lên GitHub, vui lòng chờ...');
        try {
            const rawData = fs.readFileSync('./data.json', 'utf8');
            const parsedData = JSON.parse(rawData);
            const GITHUB_TOKEN = process.env.GITHUB_TOKEN; 
            const GITHUB_REPO = "emsgachacity/nhaduc"; 
            const GITHUB_FILE_PATH = "data.json"; 
            if (!GITHUB_TOKEN) return backupMsg.edit('❌ Không tìm thấy GITHUB_TOKEN.');

            const contentStr = JSON.stringify(parsedData, null, 2);
            const base64Content = Buffer.from(contentStr, 'utf8').toString('base64');
            const getUrl = `https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_FILE_PATH}`;
            let sha = null;
            const resGet = await fetch(getUrl, { headers: { "Authorization": `Bearer ${GITHUB_TOKEN}`, "Accept": "application/vnd.github+json" } }).catch(() => null);
            if (resGet && resGet.ok) { const fileData = await resGet.json(); sha = fileData.sha; }

            const body = { message: `🗄️ [Manual Backup] Kích hoạt bởi Admin ${message.author.username}`, content: base64Content };
            if (sha) body.sha = sha;

            const resPut = await fetch(getUrl, { method: "PUT", headers: { "Authorization": `Bearer ${GITHUB_TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
            if (resPut && resPut.ok) return backupMsg.edit('✅ **Sao lưu thành công!**');
            else return backupMsg.edit(`❌ **Thất bại:** \`${resPut ? resPut.status : 'Unknown'}\`.`);
        } catch (err) {
            return backupMsg.edit(`🚨 **Lỗi:** \`${err.message}\`.`);
        }
    }

    // ==========================================================
    // 🚀 GAME: TÀU VŨ TRỤ SIÊU TỐC (CRASH GAME) - MULTIPLAYER (HẠN CHẾ SPAM NHẬN THÔNG BÁO)
    // ==========================================================
    if (command === 'crash') {
        const channelId = message.channel.id;
        if (activeCrash.has(channelId)) {
            return message.reply('❌ Đang có một chuyến du hành vũ trụ chuẩn bị cất cánh tại kênh này rồi!');
        }

        const crashState = {
            channelId,
            status: 'lobby', // 'lobby' | 'flying' | 'crashed'
            players: new Map(), // userId -> { bet, username, cashedOut: false, payoutMultiplier: null }
            crashPoint: generateCrashPoint(),
            currentMultiplier: 1.0
        };
        activeCrash.set(channelId, crashState);

        const lobbyEmbed = new EmbedBuilder()
            .setColor('#7289da')
            .setTitle('🚀 PHÒNG CHỜ TÀU VŨ TRỤ SIÊU TỐC 🚀')
            .setDescription(`👤 Cơ trưởng: <@${message.author.id}>\n⏰ Cổng đăng ký vé bay đang mở trong **30 giây**!\n👉 Bấm các nút bên dưới để lên tàu cùng mọi người nào!`);

        const lobbyButtons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`crash_join_10k_${channelId}`).setLabel('Đặt 10K 🪙').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`crash_join_50k_${channelId}`).setLabel('Đặt 50K 🪙').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`crash_join_100k_${channelId}`).setLabel('Đặt 100K 🪙').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`crash_join_all_${channelId}`).setLabel('All-in Toàn Bộ 🪙').setStyle(ButtonStyle.Danger)
        );

        const response = await message.reply({ embeds: [lobbyEmbed], components: [lobbyButtons] }).catch(() => null);
        if (!response) { activeCrash.delete(channelId); return; }

        const lobbyCollector = response.createMessageComponentCollector({ time: 30000 });

        lobbyCollector.on('collect', async i => {
            const userId = i.user.id;
            const action = i.customId.split('_')[2];

            if (!db.hasUser(userId)) {
                await db.addMoney(userId, 50000);
            }

            const userMoney = db.getMoney(userId);
            let bet = 10000;
            if (action === '50k') bet = 50000;
            else if (action === '100k') bet = 100000;
            else if (action === 'all') bet = userMoney;

            // Kiểm tra số dư người chơi
            if (userMoney < bet || bet <= 0) {
                return i.reply({ content: '❌ Tài khoản không đủ số dư để mua thêm vé bay này!', flags: [MessageFlags.Ephemeral] });
            }

            // Trừ tiền cược cục bộ
            await db.addMoney(userId, -bet);

            // Tích lũy tiền cược thay vì chặn ghi đè nếu hành khách đã lên tàu
            if (crashState.players.has(userId)) {
                const currentTicket = crashState.players.get(userId);
                currentTicket.bet += bet;
                crashState.players.set(userId, currentTicket);
            } else {
                crashState.players.set(userId, { bet, username: i.user.username, cashedOut: false, payoutMultiplier: null });
            }

            // Dùng i.update để sửa đổi trạng thái cược ngay tại thời gian thực mà KHÔNG gửi thêm bong bóng thông báo ẩn
            const passengerList = Array.from(crashState.players.entries())
                .map(([pId, p]) => `• <@${pId}>: \`${p.bet.toLocaleString()}\` 🪙`)
                .join('\n');

            const updatedLobbyEmbed = new EmbedBuilder()
                .setColor('#7289da')
                .setTitle('🚀 PHÒNG CHỜ TÀU VŨ TRỤ SIÊU TỐC 🚀')
                .setDescription(`👤 Cơ trưởng: <@${message.author.id}>\n⏰ Cổng cược đang mở...\n\n👥 **HÀNH KHÁCH ĐÃ LÊN TÀU (${crashState.players.size}):**\n${passengerList}`);

            await i.update({ embeds: [updatedLobbyEmbed] }).catch(() => null);
        });

        lobbyCollector.on('end', async () => {
            if (crashState.players.size === 0) {
                activeCrash.delete(channelId);
                const failEmbed = new EmbedBuilder().setColor('#3d3a3a').setTitle('🛑 CHUYẾN BAY BỊ HỦY').setDescription('Không có hành khách nào lên tàu sau 30 giây đăng ký.');
                return response.edit({ embeds: [failEmbed], components: [] }).catch(() => null);
            }

            crashState.status = 'flying';
            activeCrash.set(channelId, crashState);

            const cashOutRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`crash_cashout_${channelId}`).setLabel('💰 CASH OUT (CHỐT LỜI)').setStyle(ButtonStyle.Success)
            );

            const initialBuffer = await drawRocketCanvas(1.0);
            const initialAttachment = new AttachmentBuilder(initialBuffer, { name: `crash_${Date.now()}.png` });

            const flyingEmbed = new EmbedBuilder()
                .setColor('#f1c40f')
                .setTitle('🚀 TÀU VŨ TRỤ ĐÃ CẤT CÁNH!')
                .setImage(`attachment://${initialAttachment.name}`);

            const gameMsg = await response.edit({
                embeds: [flyingEmbed],
                files: [initialAttachment],
                components: [cashOutRow],
                attachments: []
            }).catch(() => null);

            if (!gameMsg) {
                for (const [pId, p] of crashState.players.entries()) {
                    await db.addMoney(pId, p.bet);
                }
                activeCrash.delete(channelId);
                return;
            }

            const gameCollector = gameMsg.createMessageComponentCollector({ time: 180000 });

            gameCollector.on('collect', async i => {
                const userId = i.user.id;
                if (i.customId.startsWith('crash_cashout_')) {
                    const player = crashState.players.get(userId);
                    if (!player) {
                        return i.reply({ content: '❌ Bạn không có vé trong chuyến bay này!', flags: [MessageFlags.Ephemeral] });
                    }
                    if (player.cashedOut) {
                        return i.reply({ content: '❌ Bạn đã nhảy dù chốt lời rồi!', flags: [MessageFlags.Ephemeral] });
                    }

                    player.cashedOut = true;
                    player.payoutMultiplier = crashState.currentMultiplier;
                    const winAmount = Math.floor(player.bet * crashState.currentMultiplier);
                    await db.addMoney(userId, winAmount, true, 'crash');

                    await i.reply({ content: `🎉 **CHỐT LỜI THÀNH CÔNG!** Bạn đã nhảy dù ở mốc **x${crashState.currentMultiplier.toFixed(2)}**, nhận về **+${winAmount.toLocaleString()}** 🪙.`, flags: [MessageFlags.Ephemeral] });
                }
            });

            // Tăng tốc độ bay mượt mà: cập nhật ảnh sau mỗi 1.2 giây
            const interval = setInterval(async () => {
                const speed = 0.04 + (crashState.currentMultiplier * 0.02); 
                crashState.currentMultiplier = parseFloat((crashState.currentMultiplier + speed).toFixed(2));

                if (crashState.currentMultiplier >= crashState.crashPoint) {
                    clearInterval(interval);
                    gameCollector.stop('crashed');

                    const finalBuffer = await drawRocketCanvas(crashState.crashPoint, true);
                    const finalAttachment = new AttachmentBuilder(finalBuffer, { name: `crash_boom_${Date.now()}.png` });

                    let winText = "";
                    let loseText = "";

                    for (const [pId, p] of crashState.players.entries()) {
                        if (p.cashedOut) {
                            winText += `• <@${pId}>: Chốt **x${p.payoutMultiplier.toFixed(2)}** ➔ \`+${Math.floor(p.bet * p.payoutMultiplier).toLocaleString()}\` 🪙\n`;
                        } else {
                            await db.addMoney(pId, 0, false, 'crash'); 
                            loseText += `• <@${pId}>: Bị nổ tung tại **x${crashState.crashPoint.toFixed(2)}** ➔ \`-${p.bet.toLocaleString()}\` 🪙\n`;
                        }
                    }

                    const summaryEmbed = new EmbedBuilder()
                        .setColor('#ff3333')
                        .setTitle(`💥 TÀU ĐÃ NỔ TẠI MỐC x${crashState.crashPoint.toFixed(2)} 💥`)
                        .setDescription(
                            `📋 **BÁO CÁO TOÀN CHUYẾN BAY:**\n\n` +
                            `🟢 **Thoát hiểm thành công (Có lời):**\n${winText || '• Không ai thoát kịp.'}\n` +
                            `🔴 **Tan biến trong vụ nổ (Thua cuộc):**\n${loseText || '• Không có ai.'}`
                        )
                        .setImage(`attachment://${finalAttachment.name}`);

                    await gameMsg.edit({
                        embeds: [summaryEmbed],
                        files: [finalAttachment],
                        components: [],
                        attachments: []
                    }).catch(() => null);

                    activeCrash.delete(channelId);
                    await updateTopRanksRoles(message.guild);
                } else {
                    const nextBuffer = await drawRocketCanvas(crashState.currentMultiplier);
                    const nextAttachment = new AttachmentBuilder(nextBuffer, { name: `crash_${Date.now()}.png` });

                    const passengerStatus = Array.from(crashState.players.entries())
                        .map(([pId, p]) => {
                            if (p.cashedOut) return `<@${pId}> (\`đã chốt x${p.payoutMultiplier.toFixed(2)}\`)`;
                            return `<@${pId}> (\`đang đợi...\`)`;
                        })
                        .join(', ');

                    const nextEmbed = new EmbedBuilder()
                        .setColor('#f1c40f')
                        .setTitle('🚀 TÀU VŨ TRỤ ĐANG BAY!')
                        .setDescription(`👥 **Tình trạng khoang tàu:** ${passengerStatus}`)
                        .setImage(`attachment://${nextAttachment.name}`);

                    await gameMsg.edit({
                        embeds: [nextEmbed],
                        files: [nextAttachment],
                        components: [cashOutRow],
                        attachments: []
                    }).catch(() => null);
                }
            }, 1200);

        });
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

        const drawTaiXiuCanvas = async (openedStatus = [false, false, false], currentDice = xucXac, currentRes = ketQua, currentTotal = tongDiem, isFinished = false, isWinner = false, userNewMoney = 0) => {
            const canvas = createCanvas(600, 320); const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#111827'; ctx.fillRect(0, 0, 600, 320);
            
            ctx.strokeStyle = '#10b981'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.roundRect?.(15, 15, 570, 290, 18); ctx.stroke();
            
            const slotsX = [95, 250, 405];
            const diceY = 48;
            
            for (let i = 0; i < 3; i++) {
                if (!openedStatus[i]) {
                    ctx.fillStyle = '#1f2937'; ctx.beginPath(); ctx.roundRect?.(slotsX[i], diceY, 100, 100, 18); ctx.fill();
                    ctx.strokeStyle = '#374151'; ctx.lineWidth = 2; ctx.stroke();
                    ctx.fillStyle = '#f87171'; ctx.font = 'bold 45px Arial'; ctx.fillText('?', slotsX[i] + 35, diceY + 65);
                } else {
                    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.roundRect?.(slotsX[i], diceY, 100, 100, 18); ctx.fill();
                    const cx = slotsX[i] + 50; const cy = diceY + 50; const r = 6.5; const p = 24;
                    const num = currentDice[i];
                    
                    const drawDot = (x, y, color = '#111827') => {
                        ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
                    };

                    if (num === 1) {
                        drawDot(cx, cy, '#ef4444');
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
                ctx.fillStyle = '#ffffff'; ctx.font = 'bold 16px Arial';
                ctx.fillText(`Tổng: ${currentTotal}`, 270, diceY + 120);
                
                ctx.fillStyle = '#047857'; ctx.beginPath(); ctx.roundRect?.(210, diceY + 132, 180, 38, 10); ctx.fill();
                ctx.fillStyle = '#ffffff'; ctx.font = 'bold 15px Arial';
                const labelText = currentRes === 'tai' ? 'TÀI (11-18)' : 'XỈU (3-10)';
                ctx.fillText(labelText, 255, diceY + 156);
            }

            if (isFinished) {
                ctx.fillStyle = '#1f2937'; ctx.beginPath(); ctx.roundRect?.(35, 235, 530, 56, 10); ctx.fill();
                ctx.fillStyle = '#9ca3af'; ctx.font = 'bold 10px Arial';
                ctx.fillText('ĐẶT CƯỢC', 100, 253);
                ctx.fillText('THẰNG', 285, 253);
                ctx.fillText('SỐ DƯ', 460, 253);
                ctx.fillStyle = '#ffffff'; ctx.font = 'bold 14px Arial';
                
                const displayBet = bet >= 1000 ? `${(bet / 1000).toFixed(1)}K` : bet.toString();
                ctx.fillText(displayBet, 102, 276);

                if (isWinner) {
                    ctx.fillStyle = '#10b981';
                    ctx.fillText(`+${bet.toLocaleString()}`, 270, 276);
                } else {
                    ctx.fillStyle = '#ef4444';
                    ctx.fillText(`-${bet.toLocaleString()}`, 270, 276);
                }

                ctx.fillStyle = '#ffffff';
                const displayMoney = userNewMoney >= 1000 ? `${(userNewMoney / 1000).toFixed(1)}K` : userNewMoney.toString();
                ctx.fillText(displayMoney, 458, 276);
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

            const finalAttachment = await drawTaiXiuCanvas(finalOpened, game.xucXac, game.ketQua, game.tongDiem, true, isWinFinal, finalMoney);
            const title = reason === 'time' ? '🎲 KẾT QUẢ TÀI XỈU (TỰ ĐỘNG KHUI)' : '🎲 KẾT QUẢ TÀI XỈU';
            const finalEmbed = new EmbedBuilder().setColor(mauEmbed).setTitle(title).setDescription(`🎯 Dự đoán: ${game.luaChon.toUpperCase()} | Kết quả: **${game.tongDiem}** điểm (${game.ketQua.toUpperCase()})\n📊 ${winMsg}`).setImage(`attachment://${finalAttachment.name}`);
            
            await response.edit({ embeds: [finalEmbed], files: [finalAttachment], components: [], attachments: [] }).catch(() => null);
            activeTaiXiu.delete(userId); 
            await updateTopRanksRoles(message.guild);
        });
    }

    // ==========================================================
    // 💣 GAME 2: DÒ MÌN
    // ==========================================================
    if (command === 'domin' || command === 'dm') {
        const subCommand = args[0]?.toLowerCase();
        const userId = message.author.id;

        const getMineMultiplier = (diamonds) => {
            if (diamonds >= 21) return 6.0;
            if (diamonds >= 20) return 5.0;
            if (diamonds >= 15) return 4.0;
            if (diamonds >= 10) return 3.0;
            if (diamonds >= 5) return 2.0;
            return 1.0;
        };

        if (subCommand === 'out') {
            const game = activeGames.get(userId);
            if (!game) return message.reply('❌ Bạn không có ván dò mìn nào đang diễn ra!');

            const multiplier = getMineMultiplier(game.diamondsFound);
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

        const embed = new EmbedBuilder().setColor('#2f3136').setTitle('💣 DÒ MÌN PHIÊN BẢN MỚI').setDescription('💡 Bấm các ô bên dưới. Cơ chế nâng cấp:\n⭐ **5 ô = x2.0** | **10 ô = x3.0** | **15 ô = x4.0** | **20 ô = x5.0** | **21 ô = x6.0**\n⏰ Hạn giờ phản hồi: **60 giây**.');
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

                    const winEmbed = new EmbedBuilder().setTitle('🏆 ĐẠI THẮNG DÒ MÌN x6.0 TIỀN!').setColor('#00ff00').setDescription(`Chúc mừng bạn đã xuất sắc lật toàn bộ ô kim cương an toàn sạch sẽ!\n💰 Số dư hiện tại: **${finalMoney.toLocaleString()}** xu.`);
                    await i.editReply({ embeds: [winEmbed], components: generateWinComponents() }).catch(() => null);
                    activeGames.delete(userId);
                    await updateTopRanksRoles(message.guild);
                } else {
                    game.isProcessing = false;
                    activeGames.set(userId, game);
                    let currentMultiplier = getMineMultiplier(game.diamondsFound);
                    
                    const updateEmbed = new EmbedBuilder()
                        .setColor('#ffaa00')
                        .setTitle('💣 DÒ MÌN CHUYÊN NGHIỆP')
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
                const multiplier = getMineMultiplier(game.diamondsFound);
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
        
        if (activeBlackjack.has(userId)) return message.reply('❌ Bạn đang có một ván bài Blackjack chưa hoàn thành!');

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
                    const finalMoney = await db.addMoney(userId, game.bet * 3, true, 'blackjack'); 
                    const finalAttachment = await drawBlackjackCanvas(game.playerHand, game.dealerHand, true, '👑 NGŨ LINH ĐẠI CÁT 👑');
                    const tongNhanVe = game.bet * 4;

                    const finalEmbed = new EmbedBuilder().setColor('#ffbb00').setTitle('🃏 KẾT QUẢ BLACKJACK 🃏')
                        .setDescription(`🎒 Bài của bạn: **${pScoreNow} điểm** (5 lá)\n\n📊 Thắng Ngũ Linh cực lớn nhận về **+${tongNhanVe.toLocaleString()}** xu (Ăn x3 cược gốc)!\n💰 Số dư hiện tại: **${finalMoney.toLocaleString()}** xu.`)
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
                const title = reason === 'time' ? '🃏 KẾT QUẢ BLACKJACK (TỰ ĐỘNG DẰN) 🃏' : '🃏 KẾT QUẢ BLACKJACK 🃏';
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
                    
                await response.edit({ embeds: [embed], files: [finalAttachment], components: [], attachments: [] }).catch(() => null);
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
                    finalEmbed = new EmbedBuilder().setColor('#ff0000').setTitle('🃏 KẾT QUẢ BLACKJACK (BỊ QUẮC) 🃏')
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
                    finalEmbed = new EmbedBuilder().setColor(embedColor).setTitle('🃏 KẾT QUẢ BLACKJACK (TỰ ĐỘNG BỐC) 🃏')
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

        if (isNaN(bet) || bet <= 0 || currentMoney < bet) return message.reply('❌ Số tiền cược không hợp lệ!');

        await db.addMoney(userId, -bet);

        const rand = Math.random() * 100;
        const icons = ['cherry', 'diamond', 'crown', 'fire'];
        let slot1, slot2, slot3;

        if (rand < 2.0) { slot1 = slot2 = slot3 = 'crown'; } 
        else if (rand < 5.5) { slot1 = slot2 = slot3 = 'diamond'; } 
        else if (rand < 11.0) { slot1 = slot2 = slot3 = 'fire'; } 
        else if (rand < 19.0) { slot1 = slot2 = slot3 = 'cherry'; } 
        else if (rand < 40.0) { 
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
            const canvas = createCanvas(600, 260); const ctx = canvas.getContext('2d');
            
            ctx.fillStyle = '#0f172a'; ctx.fillRect(0, 0, 600, 260);
            ctx.strokeStyle = '#eab308'; ctx.lineWidth = 4;
            ctx.beginPath(); ctx.roundRect?.(15, 15, 570, 230, 18); ctx.stroke(); 

            const slotsX = [40, 225, 410]; 
            const cellW = 150;
            const cellH = 170;
            const cellY = 45;

            for (let i = 0; i < 3; i++) {
                ctx.fillStyle = '#1e293b'; ctx.beginPath(); ctx.roundRect?.(slotsX[i], cellY, cellW, cellH, 15); ctx.fill();
                ctx.strokeStyle = '#475569'; ctx.lineWidth = 2; ctx.stroke();

                const cx = slotsX[i] + cellW / 2; const cy = cellY + cellH / 2;
                if (!openedStatus[i]) {
                    ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, 30, 0, Math.PI * 2); ctx.stroke();
                    ctx.fillStyle = '#f87171'; ctx.font = 'bold 36px Arial'; ctx.fillText('?', cx - 10, cy + 12);
                } else {
                    const type = currentArr[i];
                    ctx.save();
                    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 4;

                    if (type === 'diamond') {
                        let grad = ctx.createLinearGradient(cx, cy - 35, cx, cy + 35); grad.addColorStop(0, '#38bdf8'); grad.addColorStop(1, '#0369a1'); ctx.fillStyle = grad;
                        ctx.beginPath(); ctx.moveTo(cx, cy - 35); ctx.lineTo(cx + 32, cy); ctx.lineTo(cx, cy + 35); ctx.lineTo(cx - 32, cy); ctx.closePath(); ctx.fill();
                        ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
                        ctx.beginPath(); ctx.moveTo(cx, cy - 35); ctx.lineTo(cx + 32, cy); ctx.lineTo(cx, cy); ctx.closePath(); ctx.fill();
                        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
                        ctx.beginPath(); ctx.moveTo(cx, cy - 35); ctx.lineTo(cx - 32, cy); ctx.lineTo(cx, cy); ctx.closePath(); ctx.fill();
                    } else if (type === 'crown') {
                        let grad = ctx.createLinearGradient(cx, cy - 30, cx, cy + 30); grad.addColorStop(0, '#fde047'); grad.addColorStop(1, '#a16207'); ctx.fillStyle = grad;
                        ctx.beginPath(); 
                        ctx.moveTo(cx - 40, cy + 22); ctx.lineTo(cx + 40, cy + 22); 
                        ctx.lineTo(cx + 45, cy - 15); 
                        ctx.lineTo(cx + 20, cy + 2);   
                        ctx.lineTo(cx, cy - 35);       
                        ctx.lineTo(cx - 20, cy + 2);   
                        ctx.lineTo(cx - 45, cy - 15);  
                        ctx.closePath(); ctx.fill();
                        ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(cx, cy - 35, 6, 0, Math.PI*2); ctx.fill(); 
                        ctx.fillStyle = '#38bdf8'; ctx.beginPath(); ctx.arc(cx - 45, cy - 15, 5, 0, Math.PI*2); ctx.fill(); 
                        ctx.fillStyle = '#fbbf24'; ctx.fillRect(cx - 35, cy + 16, 70, 4);
                    } else if (type === 'fire') {
                        let grad = ctx.createLinearGradient(cx, cy - 35, cx, cy + 25); grad.addColorStop(0, '#f43f5e'); grad.addColorStop(0.5, '#f97316'); grad.addColorStop(1, '#eab308'); ctx.fillStyle = grad;
                        ctx.beginPath(); ctx.moveTo(cx, cy + 25); ctx.bezierCurveTo(cx - 35, cy + 15, cx - 30, cy - 15, cx - 10, cy - 35); ctx.bezierCurveTo(cx - 5, cy - 20, cx + 5, cy - 20, cx + 10, cy - 30); ctx.bezierCurveTo(cx + 35, cy - 10, cx + 30, cy + 15, cx, cy + 25); ctx.closePath(); ctx.fill();
                    } else if (type === 'cherry') {
                        ctx.fillStyle = '#dc2626'; ctx.beginPath(); ctx.arc(cx - 16, cy + 10, 15, 0, Math.PI * 2); ctx.arc(cx + 14, cy + 13, 14, 0, Math.PI * 2); ctx.fill();
                        ctx.strokeStyle = '#22c55e'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(cx - 12, cy - 4); ctx.quadraticCurveTo(cx - 5, cy - 25, cx + 10, cy - 25); ctx.moveTo(cx + 10, cy - 25); ctx.quadraticCurveTo(cx + 10, cy - 15, cx + 10, cy + 10); ctx.stroke();
                    }
                    ctx.restore();
                }
            }
            const nonce = Date.now(); return new AttachmentBuilder(await canvas.toBuffer('image/png'), { name: `slots_${nonce}.png` });
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
        const startEmbed = new EmbedBuilder().setColor('#ff9f1c').setTitle('🎰 SIÊU HŨ MINI SLOTS 🎰').setDescription(`👤 Người chơi: <@${userId}>\n💰 Tiền cược: **${bet.toLocaleString()}** xu\n\n⚡ Cửa cược đã sẵn sàng! Bấm các nút dưới đây để nặn từng ô nhé.\n⏰ Hạn giờ mở: **60 giây**`).setImage(`attachment://${initialAttachment.name}`);
        const response = await message.reply({ embeds: [startEmbed], files: [initialAttachment], components: generateSlotButtons([false, false, false]) }).catch(() => null);

        if (!response) { activeSlots.delete(userId); return; }
        const collector = response.createMessageComponentCollector({ time: 60000 });
        
        collector.on('collect', async i => {
            if (i.user.id !== userId) return;
            const game = activeSlots.get(userId);
            if (!game || game.isProcessing) return;

            const slotIndex = parseInt(i.customId.split('_')[1]);
            if (game.openedStatus[slotIndex]) return; 
            
            await i.deferUpdate().catch(() => null);
            game.openedStatus[slotIndex] = true;
            activeSlots.set(userId, game);

            const isAllOpened = game.openedStatus[0] && game.openedStatus[1] && game.openedStatus[2];
            if (isAllOpened) {
                collector.stop('completed');
            } else {
                const updateAttachment = await drawSlotsCanvas(game.openedStatus, game.finalSlots);
                const updateEmbed = new EmbedBuilder().setColor('#ffaa00').setTitle('🎰 ĐANG KHUI TỪNG Ô HŨ...').setDescription(`👉 Bạn đang nặn hũ rất hồi hộp! Bấm tiếp các ô còn lại để mở toàn bộ.`).setImage(`attachment://${updateAttachment.name}`);
                await i.editReply({ embeds: [updateEmbed], files: [updateAttachment], components: generateSlotButtons(game.openedStatus, false), attachments: [] }).catch(() => null);
            }
        });

        collector.on('end', async (collected, reason) => {
            const game = activeSlots.get(userId);
            if (!game) return;

            const finalOpened = [true, true, true];
            const isTriple = (game.finalSlots[0] === game.finalSlots[1] && game.finalSlots[1] === game.finalSlots[2]);
            const isPair = (game.finalSlots[0] === game.finalSlots[1] || game.finalSlots[1] === game.finalSlots[2] || game.finalSlots[0] === game.finalSlots[2]);

            let multiplier = 0; let winMsg = ""; let embedColor = "";
            if (isTriple) {
                if (game.finalSlots[0] === 'crown') { multiplier = 10; winMsg = "👑 JACKPOT HOÀNG GIA x10!!!"; embedColor = "#ffbe0b"; }
                else if (game.finalSlots[0] === 'diamond') { multiplier = 7; winMsg = "💎 ĐẠI THẮNG KIM CƯƠNG x7!!"; embedColor = "#00b4d8"; }
                else if (game.finalSlots[0] === 'fire') { multiplier = 5; winMsg = "🔥 NỔ HŨ THẦN LỬA x5!"; embedColor = "#ff5500"; }
                else { multiplier = 3; winMsg = "🍒 TRÚNG TRIPLE CHERRY x3!"; embedColor = "#00ff00"; }
            } else if (isPair) { multiplier = 1.5; winMsg = "✨ TRÚNG CẶP ĐÔI MAY MẮN x1.5!"; embedColor = "#a2d2ff"; } 
            else { multiplier = 0; winMsg = "😢 Bài lệch, chúc bạn may mắn lần sau!"; embedColor = "#3d3a3a"; }

            let finalMoney = 0;
            if (multiplier > 0) finalMoney = await db.addMoney(userId, game.bet * multiplier, true, 'slots');
            else finalMoney = await db.addMoney(userId, 0, false, 'slots');

            const finalAttachment = await drawSlotsCanvas(finalOpened, game.finalSlots);
            
            let textResult = "";
            if (multiplier > 0) {
                const totalWinAmount = Math.floor(game.bet * multiplier);
                const netProfit = totalWinAmount - game.bet;
                textResult = `💵 Vốn đặt cược: **${game.bet.toLocaleString()}** xu\n📈 Số tiền thắng ròng: **+${netProfit.toLocaleString()}** xu\n💰 Tổng thưởng nhận được: **${totalWinAmount.toLocaleString()}** xu`;
            } else {
                textResult = `💵 Vốn đặt cược: **${game.bet.toLocaleString()}** xu\n📉 Thua lỗ: **-${game.bet.toLocaleString()}** xu\n💰 Tổng thưởng nhận được: **0** xu`;
            }

            const finalEmbed = new EmbedBuilder().setColor(embedColor)
                .setTitle('🎰 KẾT QUẢ QUAY HŨ')
                .setDescription(`🎯 Trạng thái: **${winMsg}**\n\n${textResult}\n💰 Số dư: **${finalMoney.toLocaleString()}** xu.`)
                .setImage(`attachment://${finalAttachment.name}`);
                
            await response.edit({ embeds: [finalEmbed], files: [finalAttachment], components: [], attachments: [] }).catch(() => null);
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

        const CONFIG_CT_WIN_RATE = 80; 

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
                const loseEmbed = new EmbedBuilder().setColor('#ef4444').setTitle('💥 ĐOÁN SAI - THUA CUỘC').setDescription(`😢 Lá bài ra là **${nextCard.val}**. Bạn đã đoán sai và mất trắng số tiền cược gốc: **${game.bet.toLocaleString()}** xu!\n💰 Số dư: **${db.getMoney(userId).toLocaleString()}** xu.`).setImage(`attachment://${loseAttach.name}`);
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
                    textResult = `⚠️ Bạn đã rút tiền ngay tại mốc khai cuộc khi chưa thực hiện dự đoán nào.\n💵 Vốn đặt cược: **${game.bet.toLocaleString()}** xu\n💸 Phí phạt hủy ván (50%): **-${Math.floor(game.bet * 0.5).toLocaleString()}** xu\n💰 Hoàn lại ví: **${totalWin.toLocaleString()}** xu.`;
                } else {
                    totalWin = Math.floor(game.bet * game.multiplier);
                    const netProfit = totalWin - game.bet;
                    title = reason === 'time' ? '💰 TỰ ĐỘNG CHỐT LỜI' : '💰 ĐÃ RÚT TIỀN THÀNH CÔNG';
                    textResult = `🎉 Chúc mừng bạn đã bảo toàn lợi nhuận thành công!\n💵 Vốn đặt cược: **${game.bet.toLocaleString()}** xu\n📈 Số tiền thắng ròng: **+${netProfit.toLocaleString()}** xu\n💰 Tổng thưởng nhận được: **${totalWin.toLocaleString()}** xu (Hệ số nhân: x${game.multiplier.toFixed(2)})`;
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
    // 🦀 GAME 6: BẦU CUA NHÀ ĐỰC (HOÀN CHỈNH)
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
            { id: 'tom', name: 'TÔM', emoji: '🦐', color: '#ff5500' }, // Rút gọn chuỗi để khớp với tệp gốc của bạn
        ];
    }
});