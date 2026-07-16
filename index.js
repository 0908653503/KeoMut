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
const CONFIG_ADMIN_ID = [
    "1354110406456643597"
]; 

const CONFIG_ADMIN_ROLES = [
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
        if (!response) {
            activeCrash.delete(channelId);
            return;
        }

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

            const gameMsg = await response.edit({ embeds: [flyingEmbed], files: [initialAttachment], components: [cashOutRow], attachments: [] }).catch(() => null);
            if (!gameMsg) {
                // Trả tiền nếu tin nhắn bị lỗi xóa đột ngột
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
                            const winAmount = Math.floor(p.bet * p.payoutMultiplier);
                            winText += `• <@${pId}>: Thắng **+${winAmount.toLocaleString()}** 🪙 (Chốt ở **x${p.payoutMultiplier.toFixed(2)}**)\n`;
                        } else {
                            loseText += `• <@${pId}>: Mất trắng **-${p.bet.toLocaleString()}** 🪙 (Bị nổ)\n`;
                        }
                    }

                    const crashEmbed = new EmbedBuilder()
                        .setColor('#ef4444')
                        .setTitle(`💥 TÀU ĐÃ PHÁT NỔ TẠI MỐC x${crashState.crashPoint.toFixed(2)}!`)
                        .setDescription(
                            `🏁 **DANH SÁCH THỐNG KÊ CHI TIẾT:**\n\n` +
                            `🟢 **NHỮNG AI ĐÃ CHỐT LỜI:**\n${winText || '• Không có ai kịp thoát!'}\n` +
                            `🔴 **NHỮNG AI BỊ NỔ TÀU:**\n${loseText || '• Không ai bị nổ!'}`
                        )
                        .setImage(`attachment://${finalAttachment.name}`);

                    await response.edit({ embeds: [crashEmbed], files: [finalAttachment], components: [], attachments: [] }).catch(() => null);
                    activeCrash.delete(channelId);
                    await updateTopRanksRoles(message.guild);
                } else {
                    // Cập nhật hệ số nhân đang bay trực tiếp lên Canvas
                    const nextBuffer = await drawRocketCanvas(crashState.currentMultiplier);
                    const nextAttachment = new AttachmentBuilder(nextBuffer, { name: `crash_fly_${Date.now()}.png` });

                    const updateEmbed = new EmbedBuilder()
                        .setColor('#f1c40f')
                        .setTitle('🚀 TÀU VŨ TRỤ ĐANG BAY CAO...')
                        .setDescription(`💸 Hiện tại đang đạt mức **x${crashState.currentMultiplier.toFixed(2)}**.\n👉 Bấm nút **CASH OUT** để nhảy dù chốt lời trước khi tàu phát nổ!`)
                        .setImage(`attachment://${nextAttachment.name}`);

                    await response.edit({ embeds: [updateEmbed], files: [nextAttachment], components: [cashOutRow], attachments: [] }).catch(() => null);
                }
            }, 1200);

            gameCollector.on('end', (collected, reason) => {
                clearInterval(interval);
                activeCrash.delete(channelId);
            });
        });
    }
});

client.login(BOT_TOKEN);