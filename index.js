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

// Map lưu trữ thời gian cooldown nhận tiền cứu trợ khi tag bot (delay 3 phút)
const tagBotCooldown = new Map();

// ==========================================================
// 👑 DANH SÁCH CONFIG WHITELIST & ID ROLE ĐẠI GIA REAL-TIME
const CONFIG_ADMIN_ID = [
    "1354110406456643597"
]; 

const CONFIG_ADMIN_ROLES = [
    "1494228787469090988"
];

const CONFIG_TOP_ROLES = {
    top1: "1526953792216502312",
    top2: "1527672222477717615",
    top3: "1527672430787821668"
};
// ==========================================================

// Thuật toán sinh điểm phát nổ (Crash Point) đưa lên đầu để tránh lỗi ReferenceError
function generateCrashPoint() {
    const rand = Math.random();
    if (rand < 0.05) return 1.08 + parseFloat((Math.random() * 0.1).toFixed(2)); 
    return parseFloat((1.08 / (1 - Math.random())).toFixed(2));
}

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
// 🎨 RENDER GIAO DIỆN CANAVAS GAME CRASH (CÓ ĐẦY ĐỦ TRỤC TỌA ĐỘ RÕ NÉT CỦA BẢN V2)
// ==========================================================
async function drawRocketCanvas(currentMultiplier, isCrashed = false) {
    const canvas = createCanvas(600, 350);
    const ctx = canvas.getContext('2d');

    // 1. Phông nền Thiên hà chuyển sắc sâu (Deep Cosmic Space)
    const bgGrad = ctx.createLinearGradient(0, 0, 0, 350);
    bgGrad.addColorStop(0, '#090514');
    bgGrad.addColorStop(0.5, '#05030a');
    bgGrad.addColorStop(1, '#020105');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 600, 350);

    // 2. Vẽ dải Ngân Hà phát sáng đa tầng (Multi-layered Nebula)
    ctx.save();
    const purpleNebula = ctx.createRadialGradient(420, 120, 5, 420, 120, 180);
    purpleNebula.addColorStop(0, 'rgba(139, 92, 246, 0.25)'); 
    purpleNebula.addColorStop(0.6, 'rgba(236, 72, 153, 0.05)'); 
    purpleNebula.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = purpleNebula;
    ctx.beginPath(); ctx.arc(420, 120, 180, 0, Math.PI * 2); ctx.fill();

    const cyanNebula = ctx.createRadialGradient(150, 180, 20, 150, 180, 140);
    cyanNebula.addColorStop(0, 'rgba(6, 182, 212, 0.12)'); 
    cyanNebula.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = cyanNebula;
    ctx.beginPath(); ctx.arc(150, 180, 140, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // 3. Hiệu ứng bụi sao lấp lánh (Sci-Fi Cross Stars)
    for (let i = 0; i < 30; i++) {
        let starX = (Math.sin(i * 12345) * 0.5 + 0.5) * 600;
        let starY = (Math.cos(i * 67890) * 0.5 + 0.5) * 350;
        ctx.save();
        if (i % 6 === 0) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(starX - 4, starY); ctx.lineTo(starX + 4, starY);
            ctx.moveTo(starX, starY - 4); ctx.lineTo(starX, starY + 4);
            ctx.stroke();
        } else {
            ctx.fillStyle = i % 2 === 0 ? '#ffffff' : '#a7f3d0';
            ctx.fillRect(starX, starY, i % 3 === 0 ? 2 : 1, i % 3 === 0 ? 2 : 1);
        }
        ctx.restore();
    }

    const startX = 80, startY = 270;
    const factor = Math.min(currentMultiplier, 8); 
    const endX = startX + (factor - 1) * 55; 
    const endY = startY - (factor - 1) * 26;

    // 4. TRỤC TỌA ĐỘ VÀ ĐƯỜNG LƯỚI KHUNG BIỂU ĐỒ RÕ NÉT
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'; 
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    // Vẽ Trục Hoành
    ctx.moveTo(startX - 15, startY); ctx.lineTo(550, startY);
    // Vẽ Trục Tung
    ctx.moveTo(startX, startY + 15); ctx.lineTo(startX, 40);
    ctx.stroke();

    // Các đường vạch lưới phụ dạng nét đứt
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]); 
    for (let h = 1; h <= 4; h++) {
        let gridY = startY - h * 50;
        ctx.beginPath(); ctx.moveTo(startX, gridY); ctx.lineTo(540, gridY); ctx.stroke();
    }
    ctx.restore();

    if (!isCrashed) {
        // 5. Đường chạy Parabol Laser rực rỡ
        ctx.save();
        const laserGrad = ctx.createLinearGradient(startX, startY, endX, endY);
        laserGrad.addColorStop(0, '#10b981'); 
        laserGrad.addColorStop(0.5, '#06b6d4'); 
        laserGrad.addColorStop(1, '#67e8f9'); 
        ctx.strokeStyle = laserGrad;
        ctx.shadowColor = '#06b6d4';
        ctx.shadowBlur = 15;
        ctx.lineWidth = 5.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.quadraticCurveTo((startX + endX) / 1.8, startY + 5, endX, endY);
        ctx.stroke();
        ctx.restore();

        // 6. Thiết kế Tàu Vũ Trụ Alpha Mech bóng bẩy
        ctx.save();
        const angle = Math.atan2(endY - startY, endX - startX) * 0.45; 
        ctx.translate(endX, endY);
        ctx.rotate(angle);

        // Đuôi lửa phản lực Plasma nhiều lớp
        ctx.save();
        ctx.shadowColor = '#f97316'; ctx.shadowBlur = 15;
        const fireGrad = ctx.createLinearGradient(-35, 0, -10, 0);
        fireGrad.addColorStop(0, 'rgba(239, 68, 68, 0)');
        fireGrad.addColorStop(0.4, '#ef4444'); 
        fireGrad.addColorStop(0.8, '#f97316'); 
        fireGrad.addColorStop(1, '#ffffff'); 
        ctx.fillStyle = fireGrad;
        ctx.beginPath();
        ctx.moveTo(-10, -6); ctx.lineTo(-35, 0); ctx.lineTo(-10, 6);
        ctx.closePath(); ctx.fill();
        ctx.restore();

        // Thân chính của phi thuyền
        ctx.fillStyle = '#f1f5f9';
        ctx.beginPath();
        ctx.moveTo(-14, -8); ctx.lineTo(16, 0); ctx.lineTo(-14, 8);
        ctx.closePath(); ctx.fill();

        // Điểm nhấn sọc công nghệ màu Cyan
        ctx.fillStyle = '#06b6d4';
        ctx.beginPath();
        ctx.moveTo(-4, -4); ctx.lineTo(6, 0); ctx.lineTo(-4, 4);
        ctx.closePath(); ctx.fill();

        // Đuôi cánh tên lửa
        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.moveTo(-14, -8); ctx.lineTo(-20, -14); ctx.lineTo(-8, -6);
        ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-14, 8); ctx.lineTo(-20, 14); ctx.lineTo(-8, 6);
        ctx.closePath(); ctx.fill();

        ctx.fillStyle = '#38bdf8';
        ctx.beginPath(); ctx.arc(4, 0, 3.5, 0, Math.PI * 2); ctx.fill();

        ctx.restore();
    } else {
        // 7. Hiệu ứng Vụ Nổ Siêu Tân Tinh
        ctx.save();
        ctx.shadowColor = '#ef4444'; ctx.shadowBlur = 40;
        
        ctx.fillStyle = 'rgba(239, 68, 68, 0.75)';
        for (let a = 0; a < Math.PI * 2; a += Math.PI / 5) {
            let rx = endX + Math.cos(a) * (22 + Math.random() * 15);
            let ry = endY + Math.sin(a) * (22 + Math.random() * 15);
            ctx.beginPath(); ctx.arc(rx, ry, 18, 0, Math.PI * 2); ctx.fill();
        }

        ctx.fillStyle = '#f59e0b';
        ctx.beginPath(); ctx.arc(endX, endY, 24, 0, Math.PI * 2); ctx.fill();

        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
        for (let j = 0; j < 8; j++) {
            let angleSpark = (j * Math.PI) / 4;
            ctx.beginPath();
            ctx.moveTo(endX, endY);
            ctx.lineTo(endX + Math.cos(angleSpark) * 35, endY + Math.sin(angleSpark) * 35);
            ctx.stroke();
        }

        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(endX, endY, 12, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }

    // 8. Hộp hiển thị Glassmorphism Neon VIP trung tâm
    ctx.save();
    ctx.fillStyle = 'rgba(10, 10, 22, 0.82)';
    ctx.strokeStyle = isCrashed ? 'rgba(239, 68, 68, 0.4)' : 'rgba(6, 182, 212, 0.4)';
    ctx.lineWidth = 2;
    ctx.shadowBlur = 15;
    ctx.shadowColor = isCrashed ? '#ef4444' : '#06b6d4';
    ctx.beginPath(); ctx.roundRect?.(200, 135, 200, 72, 12); ctx.fill(); ctx.stroke();
    ctx.restore();

    // 9. Chữ Số Hệ Nhân Phong Cách Digital sắc nét
    ctx.fillStyle = isCrashed ? '#f87171' : '#34d399';
    ctx.font = 'bold 42px Impact, Arial Black, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${currentMultiplier.toFixed(2)}x`, 300, 186);

    return canvas.toBuffer('image/png');
}

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // Tự động tạo user mới nếu chưa có dữ liệu
    if (!db.hasUser(message.author.id)) {
        await db.addMoney(message.author.id, 50000);
        await updateTopRanksRoles(message.guild); 
    }

    // ==========================================================
    // 🤖 TỰ ĐỘNG TRỢ CẤP KHI TAG TRỰC TIẾP BOT (@Tên_Bot) - KHÔNG PREFIX
    // ==========================================================
    const hasDirectTagInText = message.content.includes(`<@${client.user.id}>`) || message.content.includes(`<@!${client.user.id}>`);

    if (hasDirectTagInText) {
        const userId = message.author.id;
        const userMoney = db.getMoney(userId);
        
        const lastUsed = tagBotCooldown.get(userId) || 0;
        const now = Date.now();
        const cooldownTime = 1.5 * 60 * 1000; 

        if (now - lastUsed < cooldownTime) {
            const timeLeft = cooldownTime - (now - lastUsed);
            const minutesLeft = Math.floor(timeLeft / 60000);
            const secondsLeft = Math.floor((timeLeft % 60000) / 1000);
            return message.reply(`⏰ Mày vội à?! Mày có **${minutesLeft} phút ${secondsLeft} giây** để suy nghĩ về cuộc đời rồi quay lại xin tiếp nhé!`);
        }

        if (userMoney <= 0) {
            const subsidyAmount = 300000;
            const finalMoney = await db.addMoney(userId, subsidyAmount);
            await updateTopRanksRoles(message.guild);
            
            tagBotCooldown.set(userId, now);
            return message.reply(`🪙 Xem <@${userId}> nó chơi ngu hết tiền lại đi xin tiền Bot này anh em, Nhà Đực phát cho **+${subsidyAmount.toLocaleString()}** làm lại cuộc đời nha.\n💰 Số dư mới: **${finalMoney.toLocaleString()}** xu.`);
        } else {
            return message.reply(`❌ Bạn vẫn đang còn **${userMoney.toLocaleString()}** xu trong ví mà, bao giờ về **0 xu** rồi hãy tag tôi cứu trợ nhé!`);
        }
    }

    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

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
        const totalBetSum = userStats.totalBetAmount || 0; // Đọc tổng lượng cược tích lũy[cite: 1]

        const profileEmbed = new EmbedBuilder().setColor('#2b2d42').setTitle(`📊 Hồ Sơ — ${target.username}`)
            .addFields(
                { name: '🪙 Số dư', value: `**${(userStats.money || 0).toLocaleString()}** 🪙`, inline: true },
                { name: '🏆 Hạng', value: `#${rank}`, inline: true },
                { name: '📈 Tỷ lệ thắng', value: `**${totalWinRate}%**`, inline: true },
                { name: '💸 Tổng tiền đã cược', value: `**${totalBetSum.toLocaleString()}** 🪙`, inline: false },
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
        const { PermissionFlagsBits } = require('discord.js');
        if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages) && 
            !message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('❌ Quyền hạn không đủ! Bạn không thể thực hiện lệnh này.');
        }

        if (args[0]?.toLowerCase() === 'all') {
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
            const GITHUB_REPO = "0908653503/KeoMut"; 
            const GITHUB_FILE_PATH = "data.json"; 
            if (!GITHUB_TOKEN) return backupMsg.edit('❌ Không tìm thấy GITHUB_TOKEN.');

            const contentStr = JSON.stringify(parsedData, null, 2);
            const base64Content = Buffer.from(contentStr, 'utf8').toString('base64');
            const getUrl = `https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_FILE_PATH}`;
            let sha = null;
            const resGet = await fetch(getUrl, { headers: { "Authorization": `Bearer ${GITHUB_TOKEN}`, "Accept": "application/vnd.github+json" } }).catch(() => null);
            if (resGet && resGet.ok) { const fileData = await resGet.json(); sha = fileData.sha; }

            const body = { message: `𗄖 [Manual Backup] Kích hoạt bởi Manual Admin ${message.author.username}`, content: base64Content };
            if (sha) body.sha = sha;

            const resPut = await fetch(getUrl, { method: "PUT", headers: { "Authorization": `Bearer ${GITHUB_TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
            if (resPut && resPut.ok) return backupMsg.edit('✅ **Sao lưu thành công!**');
            else return backupMsg.edit(`❌ **Thất bại:** \`${resPut ? resPut.status : 'Unknown'}\`.`);
        } catch (err) {
            return backupMsg.edit(`🚨 **Lỗi:** \`${err.message}\`.`);
        }
    }

    // ==========================================================
    // 🚀 GAME: TÀU VŨ TRỤ SIÊU TỐC (CRASH GAME) - ĐÃ FIX TREO SẢNH & TIMEOUT CHỜ
    // ==========================================================
    if (command === 'crash') {
        const channelId = message.channel.id;
        if (activeCrash.has(channelId)) {
            return message.reply('❌ Đang có một chuyến du hành vũ trụ chuẩn bị cất cánh tại kênh này rồi!');
        }

        const crashState = {
            channelId,
            status: 'lobby', 
            players: new Map(), 
            crashPoint: generateCrashPoint(),
            currentMultiplier: 1.0
        };
        activeCrash.set(channelId, crashState);

        const lobbyEmbed = new EmbedBuilder()
            .setColor('#7289da')
            .setTitle('🚀 PHÒNG CHỜ TÀU VŨ TRỤ SIÊU TỐC 🚀')
            .setDescription(`👤 Cơ trưởng: <@${message.author.id}>\n⏰ Cổng đăng ký vé bay đang mở trong **15 giây**!\n👉 Bấm các nút cược nhỏ gọn bên dưới để lên tàu nào!`);

        const lobbyButtons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`crash_join_10k_${channelId}`).setLabel('10K 🪙').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`crash_join_50k_${channelId}`).setLabel('50K 🪙').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`crash_join_100k_${channelId}`).setLabel('100K 🪙').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`crash_join_500k_${channelId}`).setLabel('500K 🪙').setStyle(ButtonStyle.Primary), 
            new ButtonBuilder().setCustomId(`crash_join_all_${channelId}`).setLabel('All-in 💀').setStyle(ButtonStyle.Danger)
        );

        const response = await message.reply({ embeds: [lobbyEmbed], components: [lobbyButtons] }).catch(() => null);
        if (!response) { activeCrash.delete(channelId); return; }

        const lobbyCollector = response.createMessageComponentCollector({ time: 15000 });

        lobbyCollector.on('collect', async i => {
            await i.deferUpdate().catch(() => null);

            const userId = i.user.id;
            const action = i.customId.split('_')[2];

            if (!db.hasUser(userId)) await db.addMoney(userId, 50000);

            const userMoney = db.getMoney(userId);
            let bet = 10000;
            if (action === '50k') bet = 50000;
            else if (action === '100k') bet = 100000;
            else if (action === '500k') bet = 500000; 
            else if (action === 'all') bet = userMoney;

            if (userMoney < bet || bet <= 0) {
                return i.followUp({ content: '❌ Tài khoản không đủ số dư để mua thêm vé bay này!', flags: [MessageFlags.Ephemeral] }).catch(() => null);
            }

            await db.addMoney(userId, -bet, null, null, bet);

            if (crashState.players.has(userId)) {
                const currentTicket = crashState.players.get(userId);
                currentTicket.bet += bet;
                crashState.players.set(userId, currentTicket);
            } else {
                crashState.players.set(userId, { bet, username: i.user.username, cashedOut: false, payoutMultiplier: null });
            }

            const passengerList = Array.from(crashState.players.entries())
                .map(([pId, p]) => `• <@${pId}>: \`${p.bet.toLocaleString()}\` 🪙`)
                .join('\n');

            const updatedLobbyEmbed = new EmbedBuilder()
                .setColor('#7289da')
                .setTitle('🚀 PHÒNG CHỜ TÀU VŨ TRỤ SIÊU TỐC 🚀')
                .setDescription(`👤 Cơ trưởng: <@${message.author.id}>\n⏰ Cổng cược đang mở...\n\n👥 **HÀNH KHÁCH ĐÃ LÊN TÀU (${crashState.players.size}):**\n${passengerList}`);

            await i.editReply({ embeds: [updatedLobbyEmbed] }).catch(() => null);
        });

        lobbyCollector.on('end', async () => {
            if (crashState.players.size === 0) {
                activeCrash.delete(channelId);
                const failEmbed = new EmbedBuilder().setColor('#3d3a3a').setTitle('🛑 CHUYẾN BAY BỊ HỦY').setDescription('Không có hành khách nào lên tàu sau 30 giây đăng ký.');
                return response.edit({ embeds: [failEmbed], components: [] }).catch(() => null);
            }

            try {
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
                    for (const [pId, p] of crashState.players.entries()) await db.addMoney(pId, p.bet, null, null, -p.bet);
                    activeCrash.delete(channelId);
                    return;
                }

                const gameCollector = gameMsg.createMessageComponentCollector({ time: 180000 });

                gameCollector.on('collect', async i => {
                    const userId = i.user.id;
                    if (i.customId.startsWith('crash_cashout_')) {
                        const player = crashState.players.get(userId);
                        if (!player) return i.reply({ content: '❌ Bạn không có vé trong chuyến bay này!', flags: [MessageFlags.Ephemeral] }).catch(() => null);
                        if (player.cashedOut) return i.reply({ content: '❌ Bạn đã nhảy dù chốt lời rồi!', flags: [MessageFlags.Ephemeral] }).catch(() => null);

                        player.cashedOut = true;
                        player.payoutMultiplier = crashState.currentMultiplier;
                        const winAmount = Math.floor(player.bet * crashState.currentMultiplier);
                        await db.addMoney(userId, winAmount, true, 'crash');

                        await i.reply({ content: `🎉 **CHỐT LỜI THÀNH CÔNG!** Bạn đã nhảy dù ở mốc **x${crashState.currentMultiplier.toFixed(2)}**, nhận về **+${winAmount.toLocaleString()}** 🪙.`, flags: [MessageFlags.Ephemeral] }).catch(() => null);
                    }
                });

                const interval = setInterval(async () => {
                    try {
                        const speed = 0.04 + (crashState.currentMultiplier * 0.02); 
                        crashState.currentMultiplier = parseFloat((crashState.currentMultiplier + speed).toFixed(2));

                        if (crashState.currentMultiplier >= crashState.crashPoint) {
                            clearInterval(interval);
                            gameCollector.stop('crashed');

                            const finalBuffer = await drawRocketCanvas(crashState.crashPoint, true);
                            const finalAttachment = new AttachmentBuilder(finalBuffer, { name: `crash_boom_${Date.now()}.png` });

                            let winText = ""; let loseText = "";

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
                        } else {
                            const nextBuffer = await drawRocketCanvas(crashState.currentMultiplier);
                            const nextAttachment = new AttachmentBuilder(nextBuffer, { name: `crash_${Date.now()}.png` });

                            const passengerStatus = Array.from(crashState.players.entries())
                                .map(([pId, p]) => p.cashedOut ? `<@${pId}> (\`đã chốt x${p.payoutMultiplier.toFixed(2)}\`)` : `<@${pId}> (\`đang đợi...\`)`)
                                .join(', ');

                            const nextEmbed = new EmbedBuilder()
                                .setColor('#f1c40f')
                                .setTitle('🚀 TÀU VŨ TRỤ ĐÃ ĐANG BAY!')
                                .setDescription(`👥 **Tình trạng khoang tàu:** ${passengerStatus}`)
                                .setImage(`attachment://${nextAttachment.name}`);

                            await gameMsg.edit({
                                embeds: [nextEmbed],
                                files: [nextAttachment],
                                components: [cashOutRow],
                                attachments: []
                            }).catch(() => null);
                        }
                    } catch (loopErr) {
                        console.error("Lỗi trong vòng lặp bay Crash:", loopErr);
                        clearInterval(interval);
                        activeCrash.delete(channelId);
                    }
                }, 1200);

            } catch (endErr) {
                console.error("Lỗi khởi động cất cánh Crash:", endErr);
                for (const [pId, p] of crashState.players.entries()) await db.addMoney(pId, p.bet, null, null, -p.bet);
                activeCrash.delete(channelId);
                await response.edit({ content: "🚨 Hệ thống điều khiển tên lửa gặp sự cố kỹ thuật! Đã thu hồi lệnh cất cánh và hoàn trả tiền cược.", components: [] }).catch(() => null);
            }
        });
    }

    // ==========================================================
    // 🎲 GAME 1: TÀI XỈU LẬT VIÊN [LAYER GLOW FIXED]
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
            
            ctx.save();
            ctx.shadowColor = 'rgba(16, 185, 129, 0.4)'; 
            ctx.shadowBlur = 10;
            ctx.strokeStyle = '#10b981'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.roundRect?.(15, 15, 570, 290, 18); ctx.stroke();
            ctx.restore();
            
            const slotsX = [95, 250, 405];
            const diceY = 48;
            
            for (let i = 0; i < 3; i++) {
                if (!openedStatus[i]) {
                    ctx.save();
                    ctx.fillStyle = '#1f2937'; ctx.beginPath(); ctx.roundRect?.(slotsX[i], diceY, 100, 100, 18); ctx.fill();
                    ctx.strokeStyle = '#374151'; ctx.lineWidth = 2; ctx.stroke();
                    ctx.restore();
                    ctx.fillStyle = '#f87171'; ctx.font = 'bold 45px Arial'; ctx.fillText('?', slotsX[i] + 35, diceY + 65);
                } else {
                    ctx.save();
                    ctx.shadowColor = 'rgba(0, 242, 254, 0.7)';
                    ctx.shadowBlur = 22; 
                    ctx.fillStyle = 'rgba(0, 242, 254, 0.2)';
                    ctx.beginPath(); ctx.roundRect?.(slotsX[i] - 4, diceY - 4, 108, 108, 20); ctx.fill();
                    ctx.restore();

                    ctx.save();
                    ctx.fillStyle = '#ffffff'; 
                    ctx.beginPath(); ctx.roundRect?.(slotsX[i], diceY, 100, 100, 18); ctx.fill();
                    ctx.restore();

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
                
                ctx.save();
                ctx.shadowColor = 'rgba(4, 120, 87, 0.5)'; ctx.shadowBlur = 8;
                ctx.fillStyle = '#047857'; ctx.beginPath(); ctx.roundRect?.(210, diceY + 132, 180, 38, 10); ctx.fill();
                ctx.restore();
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
                finalMoney = await db.addMoney(userId, game.bet * 5, true, 'taixiu', game.bet);
                winMsg = `🔥 **NỔ BÃO x6 THƯỞNG!** Số dư: **${finalMoney.toLocaleString()}** xu.`; mauEmbed = "#ffbb00";
            } else if (game.luaChon === game.ketQua) {
                finalMoney = await db.addMoney(userId, game.bet, true, 'taixiu', game.bet);
                winMsg = `🎉 **Bạn đã THẮNG!** Số dư: **${finalMoney.toLocaleString()}** xu.`; mauEmbed = "#00ff00";
            } else {
                finalMoney = await db.addMoney(userId, -game.bet, false, 'taixiu', game.bet);
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
            const finalMoney = await db.addMoney(userId, totalProfit, true, 'domin', game.bet);

            const generateFinalComponents = () => {
                const rows = [];
                for (let i = 0; i < 5; i++) {
                    const row = new ActionRowBuilder();
                    for (let j = 0; j < 5; j++) {
                        const index = i * 5 + j;
                        const button = new ButtonBuilder().setCustomId(`mine_${index}_${userId}`).setDisabled(true);
                        if (game.board[index] === '💣') button.setStyle(ButtonStyle.Danger).setLabel('💣');
                        else button.setStyle(ButtonStyle.Success).setLabel('💎');
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
                const finalMoney = await db.addMoney(userId, -game.bet, false, 'domin', game.bet); 

                const generateLoseComponents = () => {
                    const rows = [];
                    for (let a = 0; a < 5; a++) {
                        const row = new ActionRowBuilder();
                        for (let b = 0; b < 5; b++) {
                            const idxLose = a * 5 + b;
                            const btn = new ButtonBuilder().setCustomId(`mine_${idxLose}_${userId}`).setDisabled(true);
                            if (game.board[idxLose] === '💣') btn.setStyle(ButtonStyle.Danger).setLabel('💣'); 
                            else btn.setStyle(ButtonStyle.Success).setLabel('💎'); 
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
                    const finalMoney = await db.addMoney(userId, game.bet * 5, true, 'domin', game.bet); 
                    
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
                const finalMoney = await db.addMoney(userId, totalProfit, true, 'domin', game.bet); 

                const generateFinalComponents = () => {
                    const rows = [];
                    for (let i = 0; i < 5; i++) {
                        const row = new ActionRowBuilder();
                        for (let j = 0; j < 5; j++) {
                            const index = i * 5 + j;
                            const button = new ButtonBuilder().setCustomId(`mine_${index}_${userId}`).setDisabled(true);
                            if (game.board[index] === '💣') button.setStyle(ButtonStyle.Danger).setLabel('💣');
                            else button.setStyle(ButtonStyle.Success).setLabel('💎');
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
    // 🃏 GAME 3: BLACKJACK XÌ DÁCH [LAYER GLOW FIXED]
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
            
            ctx.save();
            ctx.shadowColor = 'rgba(197, 160, 89, 0.4)'; 
            ctx.shadowBlur = 10;
            ctx.strokeStyle = '#c5a059'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect?.(25, 25, 600, 370, 20); ctx.stroke();
            ctx.restore();

            ctx.fillStyle = '#c5a059'; ctx.font = 'bold 15px Arial'; ctx.fillText(`CƯỢC: ${bet.toLocaleString()}`, 480, 55);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'; ctx.fillText(`NHÀ CÁI`, 55, 55); ctx.fillText(`BẠN`, 55, 380);

            const drawVectorCard = (cardObj, x, y, isHidden = false) => {
                ctx.save();
                ctx.shadowColor = isHidden ? 'rgba(239, 68, 68, 0.6)' : 'rgba(0, 242, 254, 0.5)';
                ctx.shadowBlur = 24; 
                ctx.fillStyle = isHidden ? 'rgba(239, 68, 68, 0.15)' : 'rgba(0, 242, 254, 0.15)';
                ctx.beginPath(); ctx.roundRect?.(x - 4, y - 4, 84, 116, 12); ctx.fill();
                ctx.restore();

                ctx.save();
                ctx.fillStyle = isHidden ? '#9b2226' : '#fcfdfe'; 
                ctx.beginPath(); ctx.roundRect?.(x, y, 76, 108, 10); ctx.fill();
                ctx.restore();

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
                finalMoney = await db.addMoney(userId, bet, true, 'blackjack', bet); 
            } else {
                finalMoney = await db.addMoney(userId, -bet, false, 'blackjack', bet); 
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
                    const finalMoney = await db.addMoney(userId, -game.bet, false, 'blackjack', game.bet); 
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
                    const finalMoney = await db.addMoney(userId, game.bet * 3, true, 'blackjack', game.bet); 
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
                    finalMoney = await db.addMoney(userId, -game.bet, false, 'blackjack', game.bet); 
                    msg = `😢 **Nhà cái lật bài đạt XÌ BÀN ngầm! Bạn đã thua cuộc.**`;
                }
                else if (dFinal > 21) { 
                    finalMoney = await db.addMoney(userId, game.bet, true, 'blackjack', game.bet); 
                    msg = `🎉 **Nhà cái quắc bài (${dFinal}đ)! Bạn thắng nhận về +${(game.bet * 2).toLocaleString()} xu.**`; 
                    embedColor = "#00ff00"; 
                }
                else if (game.dealerHand.length === 5 && dFinal <= 21) {
                    finalMoney = await db.addMoney(userId, -game.bet, false, 'blackjack', game.bet); 
                    msg = `😢 **Nhà cái kéo đủ 5 lá đạt bộ NGŨ LINH (${dFinal}đ)! Bạn đã thua cuộc.**`;
                }
                else if (pFinal > dFinal) { 
                    finalMoney = await db.addMoney(userId, game.bet, true, 'blackjack', game.bet); 
                    msg = `🎉 **Bạn đã thắng cuộc!** (${pFinal}đ vs ${dFinal}đ).`; 
                    embedColor = "#00ff00"; 
                }
                else if (pFinal < dFinal) { 
                    finalMoney = await db.addMoney(userId, -game.bet, false, 'blackjack', game.bet); 
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
                const finalMoney = await db.addMoney(userId, -game.bet, false, 'blackjack', game.bet); 
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
                    const finalMoney = await db.addMoney(userId, -game.bet, false, 'blackjack', game.bet); 
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
                        finalMoney = await db.addMoney(userId, -game.bet, false, 'blackjack', game.bet); 
                        msg = `😢 **Nhà cái lật bài đạt XÌ BÀN ngầm! Bạn đã thua cuộc.**`;
                    }
                    else if (dFinal > 21) { 
                        finalMoney = await db.addMoney(userId, game.bet, true, 'blackjack', game.bet); 
                        msg = `🎉 **Nhà cái quắc bài (${dFinal}đ)! Bạn thắng nhận về +${(game.bet * 2).toLocaleString()} xu.**`; 
                        embedColor = "#00ff00"; 
                    }
                    else if (pFinal > dFinal) { 
                        finalMoney = await db.addMoney(userId, game.bet, true, 'blackjack', game.bet); 
                        msg = `🎉 **Bạn đã thắng cuộc!** (${pFinal}đ vs ${dFinal}đ).`; 
                        embedColor = "#00ff00"; 
                    }
                    else if (pFinal < dFinal) { 
                        finalMoney = await db.addMoney(userId, -game.bet, false, 'blackjack', game.bet); 
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
    // 🎰 GAME 4: MINI SLOTS [LAYER GLOW FIXED]
    // ==========================================================
    if (command === 'slots' || command === 'sl') {
        const userId = message.author.id;
        if (activeSlots.has(userId)) return message.reply('❌ Bạn đang có một ván Slots chưa lật hết!');

        const currentMoney = db.getMoney(userId);
        const rawBet = args[0]?.replace(/[\.,]/g, '');
        let bet = rawBet?.toLowerCase() === 'all' ? currentMoney : parseInt(rawBet);

        if (isNaN(bet) || bet <= 0 || currentMoney < bet) return message.reply('❌ Số tiền cược không hợp lệ!');

        await db.addMoney(userId, -bet, null, null, bet);

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
            
            ctx.save();
            ctx.shadowColor = 'rgba(234, 179, 8, 0.4)'; 
            ctx.shadowBlur = 10;
            ctx.strokeStyle = '#eab308'; ctx.lineWidth = 4;
            ctx.beginPath(); ctx.roundRect?.(15, 15, 570, 230, 18); ctx.stroke(); 
            ctx.restore();

            const slotsX = [40, 225, 410]; 
            const cellW = 150; const cellH = 170; const cellY = 45;

            for (let i = 0; i < 3; i++) {
                ctx.save();
                let glowColor = 'rgba(59, 130, 246, 0.5)'; 
                if (openedStatus[i]) {
                    const type = currentArr[i];
                    if (type === 'crown') glowColor = 'rgba(234, 179, 8, 0.6)';
                    else if (type === 'diamond') glowColor = 'rgba(0, 242, 254, 0.6)';
                    else if (type === 'fire') glowColor = 'rgba(239, 68, 68, 0.6)';
                    else if (type === 'cherry') glowColor = 'rgba(236, 72, 153, 0.6)';
                }
                ctx.shadowColor = glowColor;
                ctx.shadowBlur = 24; 
                ctx.fillStyle = openedStatus[i] ? 'rgba(30, 41, 59, 0.2)' : 'rgba(59, 130, 246, 0.15)';
                ctx.beginPath(); ctx.roundRect?.(slotsX[i] - 4, cellY - 4, cellW + 8, cellH + 8, 18); ctx.fill();
                ctx.restore();

                ctx.save();
                ctx.fillStyle = '#1e293b';
                ctx.beginPath(); ctx.roundRect?.(slotsX[i], cellY, cellW, cellH, 15); ctx.fill();
                ctx.restore();

                ctx.strokeStyle = '#475569'; ctx.lineWidth = 2; ctx.strokeRect(slotsX[i], cellY, cellW, cellH);

                const cx = slotsX[i] + cellW / 2; const cy = cellY + cellH / 2;
                if (!openedStatus[i]) {
                    ctx.save();
                    ctx.shadowColor = 'rgba(239, 68, 68, 0.4)'; ctx.shadowBlur = 6;
                    ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, 30, 0, Math.PI * 2); ctx.stroke();
                    ctx.restore();
                    ctx.fillStyle = '#f87171'; ctx.font = 'bold 36px Arial'; ctx.fillText('?', cx - 10, cy + 12);
                } else {
                    const type = currentArr[i];
                    ctx.save();
                    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 4;

                    if (type === 'diamond') {
                        let grad = ctx.createLinearGradient(cx, cy - 35, cx, cy + 35); grad.addColorStop(0, '#38bdf8'); grad.addColorStop(1, '#0369a1'); ctx.fillStyle = grad;
                        ctx.beginPath(); ctx.moveTo(cx, cy - 35); ctx.lineTo(cx + 32, cy); ctx.lineTo(cx, cy + 35); ctx.lineTo(cx - 32, cy); ctx.closePath(); ctx.fill();
                        ctx.fillStyle = 'rgba(255, 255, 255, 0.25)'; ctx.beginPath(); ctx.moveTo(cx, cy - 35); ctx.lineTo(cx + 32, cy); ctx.lineTo(cx, cy); ctx.closePath(); ctx.fill();
                        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'; ctx.beginPath(); ctx.moveTo(cx, cy - 35); ctx.lineTo(cx - 32, cy); ctx.lineTo(cx, cy); ctx.closePath(); ctx.fill();
                    } else if (type === 'crown') {
                        let grad = ctx.createLinearGradient(cx, cy - 30, cx, cy + 30); grad.addColorStop(0, '#fde047'); grad.addColorStop(1, '#a16207'); ctx.fillStyle = grad;
                        ctx.beginPath(); ctx.moveTo(cx - 40, cy + 22); ctx.lineTo(cx + 40, cy + 22); ctx.lineTo(cx + 45, cy - 15); ctx.lineTo(cx + 20, cy + 2); ctx.lineTo(cx, cy - 35); ctx.lineTo(cx - 20, cy + 2); ctx.lineTo(cx - 45, cy - 15); ctx.closePath(); ctx.fill();
                        ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(cx, cy - 35, 6, 0, Math.PI*2); ctx.fill(); 
                        ctx.fillStyle = '#38bdf8'; ctx.beginPath(); ctx.arc(cx - 45, cy - 15, 5, 0, Math.PI*2); ctx.fill(); 
                        ctx.fillStyle = '#fbbf24'; ctx.fillRect(cx - 35, cy + 16, 70, 4);
                    } else if (type === 'fire') {
                        let grad = ctx.createLinearGradient(cx, cy - 30, cx, cy + 30);
                        grad.addColorStop(0, '#f43f5e');
                        grad.addColorStop(1, '#f97316');
                        ctx.fillStyle = grad;
                        ctx.beginPath();
                        ctx.arc(cx, cy + 10, 25, 0, Math.PI * 2);
                        ctx.arc(cx - 12, cy - 10, 18, 0, Math.PI * 2);
                        ctx.arc(cx + 12, cy - 10, 18, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.fillStyle = '#eab308';
                        ctx.beginPath();
                        ctx.arc(cx, cy + 12, 14, 0, Math.PI * 2);
                        ctx.fill();
                    } else if (type === 'cherry') {
                        ctx.fillStyle = '#dc2626'; ctx.beginPath(); ctx.arc(cx - 16, cy + 10, 15, 0, Math.PI * 2); ctx.arc(cx + 14, cy + 13, 14, 0, Math.PI * 2); ctx.fill();
                        ctx.strokeStyle = '#22c55e'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(cx - 12, cy - 4); ctx.quadraticCurveTo(cx - 5, cy - 25, cx + 10, cy - 25); ctx.stroke();
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

        let initialAttachment;
        try {
            initialAttachment = await drawSlotsCanvas([false, false, false], finalSlots);
        } catch (canvasErr) {
            console.error("Lỗi vẽ Canvas Slots ban đầu:", canvasErr);
            activeSlots.delete(userId);
            return message.reply("❌ Đã có lỗi xảy ra trong quá trình dựng hình vẽ Slots!");
        }

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
                try {
                    const updateAttachment = await drawSlotsCanvas(game.openedStatus, game.finalSlots);
                    const updateEmbed = new EmbedBuilder().setColor('#ffaa00').setTitle('🎰 ĐANG KHUI TỪNG Ô HŨ...').setDescription(`👉 Bạn đang nặn hũ rất hồi hộp! Bấm tiếp các ô còn lại để mở toàn bộ.`).setImage(`attachment://${updateAttachment.name}`);
                    await i.editReply({ embeds: [updateEmbed], files: [updateAttachment], components: generateSlotButtons(game.openedStatus, false), attachments: [] }).catch(() => null);
                } catch (canvasErr) {
                    console.error("Lỗi vẽ Canvas Slots lúc lật:", canvasErr);
                }
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

            try {
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
            } catch (canvasErr) {
                console.error("Lỗi vẽ Canvas Slots lúc hoàn tất:", canvasErr);
                await response.edit({ content: `🎰 Ván slots hoàn tất! Trạng thái: **${winMsg}**.\nSố dư ví: **${finalMoney.toLocaleString()}** xu.`, components: [] }).catch(() => null);
            }
            activeSlots.delete(userId); 
            await updateTopRanksRoles(message.guild);
        });
    }

    // ==========================================================
    // 🃏 GAME 5: CAO THẤP (HI-LO) [LAYER GLOW FIXED]
    // ==========================================================
    if (command === 'caothap' || command === 'ct') {
        const userId = message.author.id;
        if (activeCaoThap.has(userId)) return message.reply('❌ Bạn đang có một ván Cao Thấp chưa nhận thưởng!');

        const CONFIG_CT_WIN_RATE = 95; 

        const currentMoney = db.getMoney(userId);
        const rawBet = args[0]?.replace(/[\.,]/g, '');
        let bet = rawBet?.toLowerCase() === 'all' ? currentMoney : parseInt(rawBet);
        if (isNaN(bet) || bet <= 0 || currentMoney < bet) return message.reply('❌ Tiền cược không hợp lệ!');

        await db.addMoney(userId, -bet, null, null, bet); 

        const suits = ['C','D','H','S']; const vals = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
        let deck = []; for(let s of suits) for(let v of vals) deck.push({val:v, suit:s});
        deck.sort(() => Math.random() - 0.5);

        const currentCard = deck.pop();
        activeCaoThap.set(userId, { bet, deck, currentCard, multiplier: 1.0, isProcessing: false });

        const drawCaoThapCanvas = async (card, mul) => {
            const canvas = createCanvas(400, 300); const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#111827'; ctx.fillRect(0, 0, 400, 300);
            
            ctx.save();
            ctx.shadowColor = 'rgba(245, 158, 11, 0.4)'; 
            ctx.shadowBlur = 10;
            ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 4;
            ctx.beginPath(); ctx.roundRect?.(15, 15, 370, 270, 15); ctx.stroke();
            ctx.restore();

            ctx.save();
            ctx.shadowColor = 'rgba(245, 158, 11, 0.7)';
            ctx.shadowBlur = 24; 
            ctx.fillStyle = 'rgba(245, 158, 11, 0.2)';
            ctx.beginPath(); ctx.roundRect?.(141, 41, 118, 168, 14); ctx.fill();
            ctx.restore();

            ctx.save();
            ctx.fillStyle = '#f8fafc'; 
            ctx.beginPath(); ctx.roundRect?.(145, 45, 110, 160, 12); ctx.fill();
            ctx.restore();

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
            
            ctx.save();
            ctx.shadowColor = 'rgba(16, 185, 129, 0.7)';
            ctx.shadowBlur = 24; 
            ctx.fillStyle = 'rgba(16, 185, 129, 0.2)';
            ctx.beginPath(); ctx.roundRect?.(46, 71, 98, 138, 12); ctx.fill();
            ctx.restore();

            ctx.save();
            ctx.fillStyle = '#ffffff'; 
            ctx.beginPath(); ctx.roundRect?.(50, 75, 90, 130, 10); ctx.fill(); 
            ctx.restore();

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
    // 🦀 GAME 6: BẦU CUA NHÀ ĐỰC [HIỂN THỊ MÀU THẮNG + GLOW NEON]
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
            ctx.shadowColor = 'rgba(0, 0, 0, 0.5)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 5;
            
            if (id === 'bau') {
                let grad1 = ctx.createLinearGradient(x-size*0.3, y, x+size*0.3, y+size*0.3); grad1.addColorStop(0, '#ef4444'); grad1.addColorStop(1, '#991b1b'); ctx.fillStyle = grad1; ctx.beginPath(); ctx.arc(x, y + size*0.15, size*0.3, 0, Math.PI*2); ctx.fill();
                let grad2 = ctx.createLinearGradient(x-size*0.2, y-size*0.3, x+size*0.2, y); grad2.addColorStop(0, '#fca5a5'); grad2.addColorStop(1, '#dc2626'); ctx.fillStyle = grad2; ctx.beginPath(); ctx.arc(x, y - size*0.15, size*0.2, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = '#fbbf24'; ctx.beginPath(); ctx.ellipse?.(x, y - size*0.02, size*0.18, size*0.06, 0, 0, Math.PI*2); ctx.fill();
                ctx.strokeStyle = '#15803d'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, y - size*0.3, size*0.1, Math.PI * 1.5, Math.PI * 2); ctx.stroke();
            } 
            else if (id === 'cua') {
                let grad = ctx.createLinearGradient(x-size*0.35, y, x+size*0.35, y); grad.addColorStop(0, '#f97316'); grad.addColorStop(1, '#9a3412'); ctx.fillStyle = grad; ctx.beginPath(); ctx.ellipse?.(x, y + size*0.05, size*0.35, size*0.25, 0, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x - size*0.1, y - size*0.2, 8, 0, Math.PI*2); ctx.arc(x + size*0.1, y - size*0.2, 8, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = '#000000'; ctx.beginPath(); ctx.arc(x - size*0.1, y - size*0.2, 4, 0, Math.PI*2); ctx.arc(x + size*0.1, y - size*0.2, 4, 0, Math.PI*2); ctx.fill();
                ctx.strokeStyle = '#ea580c'; ctx.lineWidth = 8;
                ctx.beginPath(); ctx.arc(x - size*0.25, y - size*0.1, size*0.2, Math.PI, Math.PI * 1.6); ctx.stroke();
                ctx.beginPath(); ctx.arc(x + size*0.25, y - size*0.1, size*0.2, Math.PI * 1.4, Math.PI * 2); ctx.stroke();
            } 
            else if (id === 'tom') {
                let grad = ctx.createLinearGradient(x-size*0.2, y-size*0.2, x+size*0.2, y+size*0.2); grad.addColorStop(0, '#facc15'); grad.addColorStop(1, '#a16207'); ctx.fillStyle = grad; 
                ctx.beginPath(); ctx.arc(x, y, size*0.25, Math.PI * 0.8, Math.PI * 1.9); ctx.lineTo(x, y + size*0.2); ctx.closePath(); ctx.fill();
                ctx.fillStyle = '#eab308'; ctx.beginPath(); ctx.moveTo(x - size*0.2, y + size*0.1); ctx.lineTo(x - size*0.35, y + size*0.25); ctx.lineTo(x - size*0.15, y + size*0.25); ctx.closePath(); ctx.fill();
                ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x + size*0.15, y - size*0.15, 4, 0, Math.PI*2); ctx.fill();
                ctx.strokeStyle = '#eab308'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x + size*0.15, y - size*0.15); ctx.quadraticCurveTo(x + size*0.35, y - size*0.35, x + size*0.4, y - size*0.1); ctx.stroke();
            } 
            else if (id === 'ca') {
                let grad = ctx.createLinearGradient(x-size*0.4, y, x+size*0.2, y); grad.addColorStop(0, '#06b6d4'); grad.addColorStop(1, '#0891b2'); ctx.fillStyle = grad; ctx.beginPath(); ctx.ellipse?.(x - size*0.05, y, size*0.4, size*0.22, 0, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = '#22d3ee'; ctx.beginPath(); ctx.moveTo(x - size*0.38, y); ctx.lineTo(x - size*0.58, y - size*0.2); ctx.lineTo(x - size*0.58, y + size*0.2); ctx.closePath(); ctx.fill();
                ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x + size*0.18, y - size*0.05, 7, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = '#000000'; ctx.beginPath(); ctx.arc(x + size*0.18, y - size*0.05, 3, 0, Math.PI*2); ctx.fill();
            } 
            else if (id === 'ga') {
                let grad = ctx.createLinearGradient(x, y-size*0.2, x, y+size*0.3); grad.addColorStop(0, '#f472b6'); grad.addColorStop(1, '#be185d'); ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(x, y + size*0.05, size*0.28, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(x - size*0.08, y - size*0.22, size*0.08, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = '#fbbf24'; ctx.beginPath(); ctx.moveTo(x + size*0.2, y - size*0.05); ctx.lineTo(x + size*0.35, y); ctx.lineTo(x + size*0.2, y + size*0.05); ctx.closePath(); ctx.fill();
            } 
            else if (id === 'nai') {
                let grad = ctx.createLinearGradient(x, y-size*0.2, x, y+size*0.3); grad.addColorStop(0, '#c084fc'); grad.addColorStop(1, '#7e22ce'); ctx.fillStyle = grad; ctx.beginPath(); ctx.ellipse?.(x, y + size*0.08, size*0.25, size*0.22, 0, 0, Math.PI*2); ctx.fill();
                ctx.strokeStyle = '#a855f7'; ctx.lineWidth = 5; ctx.lineCap = 'round';
                ctx.beginPath(); ctx.moveTo(x - size*0.1, y - size*0.1); ctx.quadraticCurveTo(x - size*0.25, y - size*0.35, x - size*0.2, y - size*0.45); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(x + size*0.1, y - size*0.1); ctx.quadraticCurveTo(x + size*0.25, y - size*0.35, x + size*0.2, y - size*0.45); ctx.stroke();
            }
            ctx.restore();
        };

        const drawBauCuaCanvas = async (slots, rolledDice = null) => {
            const canvas = createCanvas(650, 420); const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#0f172a'; ctx.fillRect(0, 0, 650, 420);
            
            ctx.save();
            ctx.shadowColor = 'rgba(56, 189, 248, 0.4)'; 
            ctx.shadowBlur = 10;
            ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 4; ctx.strokeRect(15, 15, 620, 390);
            ctx.restore();

            if (!rolledDice) {
                ctx.fillStyle = 'rgba(56, 189, 248, 0.08)'; ctx.fillRect(30, 30, 590, 80);
                ctx.fillStyle = '#38bdf8'; ctx.font = 'bold 20px Arial'; ctx.fillText('🎰 SẢNH ĐẶT CƯỢC BẦU CUA REAL-TIME', 150, 62);
            } else {
                ctx.fillStyle = 'rgba(234, 179, 8, 0.08)'; ctx.fillRect(30, 30, 590, 80);
                ctx.fillStyle = '#eab308'; ctx.font = 'bold 16px Arial'; ctx.fillText('🎲 KẾT QUẢ KỲ QUAY NHÀ ĐỰC:', 50, 75);
                const itemMap = bcItems.reduce((acc, curr) => ({ ...acc, [curr.id]: curr }), {});
                for (let d = 0; d < 3; d++) {
                    const info = itemMap[rolledDice[d]]; 
                    ctx.save();
                    ctx.shadowColor = info.color;
                    ctx.shadowBlur = 10;
                    ctx.fillStyle = '#1e293b'; ctx.beginPath(); ctx.roundRect?.(340 + d * 85, 40, 64, 60, 10); ctx.fill();
                    ctx.strokeStyle = info.color; ctx.lineWidth = 2.5; ctx.stroke(); 
                    ctx.restore();
                    drawLinhVatVector(ctx, info.id, 340 + d * 85 + 32, 40 + 30, 50); 
                }
            }

            const startX = 45, startY = 135, cellW = 175, cellH = 115, gap = 18;
            for (let idx = 0; idx < bcItems.length; idx++) {
                const info = bcItems[idx]; const col = idx % 3; const row = Math.floor(idx / 3); const cx = startX + col * (cellW + gap); const cy = startY + row * (cellH + gap);

                let borderStrokeColor = '#334155';
                let strokeLineWidth = 1.5;
                let applyNeonGlow = false;

                if (rolledDice) {
                    const isWinningItem = rolledDice.includes(info.id);
                    if (isWinningItem && slots[info.id] > 0) {
                        borderStrokeColor = '#eab308';
                        strokeLineWidth = 4.0;
                        applyNeonGlow = true;
                    } else if (isWinningItem) {
                        borderStrokeColor = '#10b981';
                        strokeLineWidth = 2.5;
                    } else if (slots[info.id] > 0) {
                        borderStrokeColor = '#ef4444';
                        strokeLineWidth = 2.0;
                    }
                } else {
                    if (slots[info.id] > 0) {
                        borderStrokeColor = '#ea3546';
                        strokeLineWidth = 3.0;
                    }
                }

                ctx.save();
                ctx.shadowColor = applyNeonGlow ? borderStrokeColor : 'rgba(56, 189, 248, 0.6)';
                ctx.shadowBlur = applyNeonGlow ? 24 : 15; 
                ctx.fillStyle = applyNeonGlow ? 'rgba(234, 179, 8, 0.15)' : 'rgba(56, 189, 248, 0.1)';
                ctx.beginPath(); ctx.roundRect?.(cx - 4, cy - 4, cellW + 8, cellH + 8, 18); ctx.fill();
                ctx.restore();

                ctx.save();
                ctx.fillStyle = '#1e293b'; 
                ctx.beginPath(); ctx.roundRect?.(cx, cy, cellW, cellH, 15); ctx.fill();
                ctx.restore();

                ctx.save();
                ctx.strokeStyle = borderStrokeColor; 
                ctx.lineWidth = strokeLineWidth; 
                ctx.strokeRect(cx, cy, cellW, cellH);
                ctx.restore();

                drawLinhVatVector(ctx, info.id, cx + cellW / 2, cy + 45, 80); ctx.fillStyle = '#94a3b8'; ctx.font = 'bold 13px Arial'; ctx.fillText(info.name, cx + 15, cy + 100);
                ctx.fillStyle = slots[info.id] > 0 ? '#eab308' : '#475569'; ctx.font = 'bold 12px Arial'; ctx.fillText(slots[info.id] > 0 ? `${(slots[info.id]).toLocaleString()} xu` : '0', cx + 90, cy + 100);
            }
            const nonce = Date.now(); return new AttachmentBuilder(await canvas.toBuffer('image/png'), { name: `baucua_${nonce}.png` });
        };

        const generateBCButtons = (slots, disableAll = false) => {
            const r1 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`bc_bet_bau_${userId}`).setLabel(`🍇 Bầu (${(slots.bau/1000).toFixed(0)}K)`).setStyle(ButtonStyle.Primary).setDisabled(disableAll),
                new ButtonBuilder().setCustomId(`bc_bet_cua_${userId}`).setLabel(`🦀 Cua (${(slots.cua/1000).toFixed(0)}K)`).setStyle(ButtonStyle.Primary).setDisabled(disableAll),
                new ButtonBuilder().setCustomId(`bc_bet_tom_${userId}`).setLabel(`🦐 Tôm (${(slots.tom/1000).toFixed(0)}K)`).setStyle(ButtonStyle.Primary).setDisabled(disableAll)
            );
            const r2 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`bc_bet_ca_${userId}`).setLabel('🐟 Cá (' + (slots.ca/1000).toFixed(0) + 'K)').setStyle(ButtonStyle.Primary).setDisabled(disableAll),
                new ButtonBuilder().setCustomId(`bc_bet_ga_${userId}`).setLabel(`🐓 Gà (${(slots.ga/1000).toFixed(0)}K)`).setStyle(ButtonStyle.Primary).setDisabled(disableAll),
                new ButtonBuilder().setCustomId(`bc_bet_nai_${userId}`).setLabel(`🦌 Nai (${(slots.nai/1000).toFixed(0)}K)`).setStyle(ButtonStyle.Primary).setDisabled(disableAll)
            );
            const r3 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`bc_action_lac_${userId}`).setLabel('🎲 LẮC XÚC XẮC').setStyle(ButtonStyle.Success).setDisabled(disableAll),
                new ButtonBuilder().setCustomId(`bc_action_huy_${userId}`).setLabel('❌ HỦY CƯỢC').setStyle(ButtonStyle.Danger).setDisabled(disableAll)
            );
            return [r1, r2, r3];
        };

        const initialAttach = await drawBauCuaCanvas(gameState.slots);
        const startEmbed = new EmbedBuilder().setColor('#38bdf8').setTitle('🦀 SẢNH BẦU CUA TÔM CÁ ĐA Ô 🦀').setDescription(`👤 Người chơi: <@${userId}>\n🪙 Click các nút linh vật bên dưới để đặt **+${betPerClick.toLocaleString()} xu** vào ô tương ứng.\n⏰ Hạn giờ: **Hệ thống tự động lắc hoặc tự hủy nếu không đặt tiền sau 60 giây**.`);
        const response = await message.reply({ embeds: [startEmbed], files: [initialAttach], components: generateBCButtons(gameState.slots, false) });

        const collector = response.createMessageComponentCollector({ time: 60000 });
        collector.on('collect', async i => {
            if (i.user.id !== userId) return i.reply({ content: '❌ Đây không phải ván cược của bạn!', flags: [MessageFlags.Ephemeral] });
            const game = activeBauCua.get(userId); if (!game || game.isProcessing) return i.deferUpdate().catch(() => null);

            const parts = i.customId.split('_'); const type = parts[1]; const target = parts[2]; 
            game.isProcessing = true; activeBauCua.set(userId, game); await i.deferUpdate().catch(() => null);

            if (type === 'bet') {
                const userMoney = db.getMoney(userId);
                if (userMoney < game.betPerClick) { game.isProcessing = false; activeBauCua.set(userId, game); return i.followUp({ content: '❌ Số dư ví không đủ để đặt tiếp!', flags: [MessageFlags.Ephemeral] }); }
                await db.addMoney(userId, -game.betPerClick, null, null, game.betPerClick); 
                game.slots[target] += game.betPerClick; game.totalBet += game.betPerClick; activeBauCua.set(userId, game);
                await i.editReply({ components: generateBCButtons(game.slots, true) }).catch(() => null);
                const updateAttach = await drawBauCuaCanvas(game.slots); game.isProcessing = false; activeBauCua.set(userId, game);
                await i.editReply({ files: [updateAttach], components: generateBCButtons(game.slots, false), attachments: [] }).catch(() => null); collector.resetTimer();
            } else if (type === 'action') {
                if (target === 'huy') { collector.stop('cancelled'); return; }
                if (target === 'lac') {
                    if (game.totalBet === 0) { game.isProcessing = false; activeBauCua.set(userId, game); return i.followUp({ content: '❌ Bạn chưa đặt cược vào ô nào!', flags: [MessageFlags.Ephemeral] }); }
                    collector.stop('completed');
                }
            }
        });

        collector.on('end', async (collected, reason) => {
            const game = activeBauCua.get(userId); if (!game) return;
            if (reason === 'cancelled') {
                if (game.totalBet > 0) await db.addMoney(userId, game.totalBet, null, null, -game.totalBet); 
                const cancelEmbed = new EmbedBuilder().setColor('#64748b').setTitle('❌ ĐÃ HỦY VÁN BẦU CUA').setDescription(`Bàn cược đã được đóng, hoàn trả lại **${game.totalBet.toLocaleString()} xu** cho <@${userId}>.`);
                await response.edit({ embeds: [cancelEmbed], components: [], attachments: [] }).catch(() => null); activeBauCua.delete(userId); return;
            }
            if (reason === 'completed' || reason === 'time') {
                if (game.totalBet === 0) {
                    const noBetEmbed = new EmbedBuilder().setColor('#64748b').setTitle('🛑 SẢNH ĐẤU HẾT HẠN CHỜ').setDescription(`Ván cược đã bị đóng tự động do không có lượt đặt tiền nào sau 60 giây.`);
                    await response.edit({ embeds: [noBetEmbed], components: [], attachments: [] }).catch(() => null); activeBauCua.delete(userId); return;
                }
                const cuaKeys = ['bau', 'cua', 'tom', 'ca', 'ga', 'nai']; const diceResult = [cuaKeys[Math.floor(Math.random()*6)], cuaKeys[Math.floor(Math.random()*6)], cuaKeys[Math.floor(Math.random()*6)]];
                let totalPayout = 0;
                for (const key of cuaKeys) { if (game.slots[key] > 0) { const matches = diceResult.filter(d => d === key).length; if (matches > 0) totalPayout += game.slots[key] * (matches + 1); } }
                const netProfit = totalPayout - game.totalBet; const finalMoney = await db.addMoney(userId, totalPayout, netProfit > 0, 'baucua');
                const finalAttach = await drawBauCuaCanvas(game.slots, diceResult);
                const resultEmbed = new EmbedBuilder().setColor(netProfit >= 0 ? '#00ff00' : '#ff0000').setTitle(reason === 'time' ? '🎲 KẾT QUẢ (TỰ ĐỘNG LẮC)' : '🎲 KẾT QUẢ SẢNH BẦU CUA').setDescription(`👤 Người chơi: <@${userId}>\n💵 Tổng vốn đặt: **${game.totalBet.toLocaleString()}** xu\n💰 Tổng thưởng rút: **${totalPayout.toLocaleString()}** xu\n📊 Biến động: **${netProfit >= 0 ? `+${netProfit.toLocaleString()}` : `${netProfit.toLocaleString()}`}** xu\n💰 Số dư: **${finalMoney.toLocaleString()}** xu`);
                await response.edit({ embeds: [resultEmbed], files: [finalAttach], components: [], attachments: [] }).catch(() => null); activeBauCua.delete(userId); await updateTopRanksRoles(message.guild);
            }
        });
    }

    // ==========================================================
    // ✌️✊🖐️ GAME 7: XÙ XÌ NHÀ ĐỰC [LAYER GLOW FIXED]
    // ==========================================================
    if (command === 'xuxi' || command === 'xx') {
        const userId = message.author.id; const target = message.mentions.users.first(); 

        const generateXXButtons = (disableAll = false) => {
            return new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`xx_keo_${userId}`).setLabel('✂️ Kéo').setStyle(ButtonStyle.Primary).setDisabled(disableAll),
                new ButtonBuilder().setCustomId(`xx_bua_${userId}`).setLabel('🔨 Búa').setStyle(ButtonStyle.Primary).setDisabled(disableAll),
                new ButtonBuilder().setCustomId(`xx_bao_${userId}`).setLabel('📄 Bao').setStyle(ButtonStyle.Primary).setDisabled(disableAll)
            );
        };

        const drawXuXiCanvas = async (playerChoice = null, botChoice = null, resultText = "Đang chờ hai bên ra chiêu...", leftLabel = "BẠN", rightLabel = "NHÀ CÁI", isFinished = false, isWinner = false, userNewMoney = 0, betAmount = 0) => {
            const canvas = createCanvas(600, 320); const ctx = canvas.getContext('2d');
            const bgGrad = ctx.createLinearGradient(0, 0, 0, 320); bgGrad.addColorStop(0, '#0f172a'); bgGrad.addColorStop(1, '#020617'); ctx.fillStyle = bgGrad; ctx.fillRect(0, 0, 600, 320);
            
            ctx.save();
            ctx.shadowColor = 'rgba(16, 185, 129, 0.4)'; ctx.shadowBlur = 10; 
            ctx.strokeStyle = '#10b981'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect?.(20, 20, 560, 280, 20); ctx.stroke(); 
            ctx.restore();

            ctx.fillStyle = '#ffffff'; ctx.font = 'bold 22px Arial'; ctx.fillText('QUYẾT ĐẤU XÙ XÌ MINIGAME', 40, 58);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(40, 72); ctx.lineTo(560, 72); ctx.stroke();

            const drawCardFrame = (x, y, w, h, label, isTargetGlow = false) => {
                ctx.save();
                ctx.shadowColor = isTargetGlow ? 'rgba(16, 185, 129, 0.7)' : 'rgba(59, 130, 246, 0.5)';
                ctx.shadowBlur = 24; 
                ctx.fillStyle = isTargetGlow ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.1)';
                ctx.beginPath(); ctx.roundRect?.(x - 4, y - 4, w + 8, h + 8, 20); ctx.fill();
                ctx.restore();

                ctx.save();
                ctx.fillStyle = 'rgba(30, 41, 59, 0.9)';
                ctx.beginPath(); ctx.roundRect?.(x, y, w, h, 16); ctx.fill();
                ctx.restore();

                ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)'; ctx.lineWidth = 1.5; ctx.strokeRect(x, y, w, h);
                ctx.fillStyle = '#94a3b8'; ctx.font = 'bold 12px Arial'; ctx.fillText(label.toUpperCase(), x + 20, y + 25);
            };
            drawCardFrame(50, 90, 220, 150, leftLabel, playerChoice !== null); drawCardFrame(330, 90, 220, 150, rightLabel, botChoice !== null);

            const drawSymbol = (x, y, type) => {
                ctx.save(); ctx.shadowColor = 'rgba(0, 0, 0, 0.5)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 4;
                if (type === 'keo') {
                    const grad = ctx.createLinearGradient(x - 20, y - 20, x + 20, y + 20); grad.addColorStop(0, '#f43f5e'); grad.addColorStop(1, '#9f1239'); ctx.strokeStyle = grad; ctx.lineWidth = 7; ctx.lineCap = 'round';
                    ctx.beginPath(); ctx.arc(x - 14, y + 16, 9, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.arc(x + 14, y + 16, 9, 0, Math.PI * 2); ctx.stroke();
                    ctx.strokeStyle = '#f87171'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(x - 5, y + 5); ctx.lineTo(x + 18, y - 22); ctx.moveTo(x + 5, y + 5); ctx.lineTo(x - 18, y - 22); ctx.stroke();
                    ctx.fillStyle = '#fbbf24'; ctx.beginPath(); ctx.arc(x, y + 5, 4, 0, Math.PI * 2); ctx.fill();
                } else if (type === 'bua') {
                    ctx.fillStyle = '#334155'; ctx.fillRect(x - 4, y + 2, 8, 30); 
                    const hammerGrad = ctx.createLinearGradient(x - 28, y - 22, x + 28, y - 2); hammerGrad.addColorStop(0, '#cbd5e1'); hammerGrad.addColorStop(0.5, '#64748b'); hammerGrad.addColorStop(1, '#334155'); ctx.fillStyle = hammerGrad;
                    ctx.beginPath(); ctx.roundRect?.(x - 26, y - 18, 52, 20, 4); ctx.fill(); 
                    ctx.fillStyle = '#475569'; ctx.beginPath(); ctx.moveTo(x - 26, y - 8); ctx.lineTo(x - 34, y - 13); ctx.lineTo(x - 26, y - 18); ctx.closePath(); ctx.fill(); 
                    ctx.fillStyle = '#cbd5e1'; ctx.fillRect(x + 22, y - 16, 4, 16);
                } else if (type === 'bao') {
                    const cardGrad = ctx.createLinearGradient(x - 20, y - 28, x + 20, y + 22); cardGrad.addColorStop(0, '#06b6d4'); cardGrad.addColorStop(1, '#0891b2'); ctx.fillStyle = cardGrad;
                    ctx.beginPath(); ctx.roundRect?.(x - 22, y - 26, 44, 52, 10); ctx.fill(); ctx.strokeStyle = '#22d3ee'; ctx.lineWidth = 1.5; ctx.stroke();
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)'; ctx.fillRect(x - 22, y - 8, 44, 16);
                    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 12px Arial'; ctx.fillText('BAO', x - 13, y + 4);
                } else {
                    ctx.fillStyle = '#475569'; ctx.font = 'bold 45px Arial'; ctx.fillText('?', x - 12, y + 15);
                }
                ctx.restore();
            };
            drawSymbol(160, 165, playerChoice); drawSymbol(440, 165, botChoice);

            let resultColor = '#f59e0b'; if (resultText.includes('thắng') || resultText.includes('chiến thắng')) resultColor = '#10b981'; if (resultText.includes('thua') || resultText.includes('bỏ cuộc')) resultColor = '#ef4444';
            ctx.fillStyle = resultColor; ctx.font = 'bold 16px Arial';
            const textWidth = ctx.measureText(resultText).width; const textX = (600 - textWidth) / 2;
            
            if (!isFinished) {
                ctx.beginPath(); ctx.arc(textX - 14, 269, 5, 0, Math.PI * 2); ctx.fill(); ctx.fillText(resultText, textX, 275);
            }

            if (isFinished) {
                ctx.fillStyle = '#1e293b'; ctx.beginPath(); ctx.roundRect?.(35, 248, 530, 48, 10); ctx.fill();
                ctx.fillStyle = '#94a3b8'; ctx.font = 'bold 10px Arial';
                ctx.fillText('ĐẶT CƯỢC', 100, 263);
                ctx.fillText('THẰNG', 285, 263);
                ctx.fillText('SỐ DƯ', 460, 263);
                ctx.fillStyle = '#ffffff'; ctx.font = 'bold 13px Arial';
                
                const displayBet = betAmount >= 1000 ? `${(betAmount / 1000).toFixed(1)}K` : betAmount.toString();
                ctx.fillText(displayBet, 102, 282);

                if (isWinner === 'draw') {
                    ctx.fillStyle = '#fbbf24';
                    ctx.fillText('HÒA (+0)', 270, 282);
                } else if (isWinner === true) {
                    ctx.fillStyle = '#10b981';
                    ctx.fillText(`+${betAmount.toLocaleString()}`, 270, 282);
                } else {
                    ctx.fillStyle = '#ef4444';
                    ctx.fillText(`-${betAmount.toLocaleString()}`, 270, 282);
                }

                ctx.fillStyle = '#ffffff';
                const displayMoney = userNewMoney >= 1000 ? `${(userNewMoney / 1000).toFixed(1)}K` : userNewMoney.toString();
                ctx.fillText(displayMoney, 458, 282);
            }

            const nonce = Date.now(); return new AttachmentBuilder(await canvas.toBuffer('image/png'), { name: `xuxi_${nonce}.png` });
        };

        if (target) {
            if (target.id === userId) return message.reply('❌ Bạn không thể tự thách đấu chính mình!'); if (target.bot) return message.reply('❌ Bạn không thể thách đấu bot!');
            if (activeXuXi.has(userId)) return message.reply('❌ Bạn đang bận tham gia một ván Xù Xì khác!'); if (activeXuXi.has(target.id)) return message.reply('❌ Đối thủ đang bận ván đấu khác!');

            const currentMoney = db.getMoney(userId); const targetMoney = db.getMoney(target.id);
            const rawBet = args[1]?.replace(/[\.,]/g, ''); let bet = rawBet?.toLowerCase() === 'all' ? currentMoney : parseInt(rawBet);
            if (isNaN(bet) || bet <= 0 || currentMoney < bet) return message.reply('❌ Tiền cược thách đấu không hợp lệ!');
            if (targetMoney < bet) return message.reply(`❌ <@${target.id}> không đủ tiền cược (Yêu cầu: **${bet.toLocaleString()}** xu, hiện có: **${targetMoney.toLocaleString()}** xu)!`);

            await db.addMoney(userId, -bet, null, null, bet); 
            const pvpState = { mode: 'pvp', challengerId: userId, opponentId: target.id, bet, status: 'pending', challengerChoice: null, opponentChoice: null, challengerInteraction: null, opponentInteraction: null, isProcessing: false, response: null };
            activeXuXi.set(userId, pvpState); activeXuXi.set(target.id, pvpState);

            const inviteEmbed = new EmbedBuilder().setColor('#f59e0b').setTitle('⚔️ LỜI THÁCH ĐẤU XÙ XÌ ĐẤU TRƯỜNG').setDescription(`🔥 <@${userId}> thách đấu Xù Xì với <@${target.id}>!\n💰 Tiền cược: **${bet.toLocaleString()}** xu\n⏰ Hạn giờ phản hồi: **60 giây**`);
            const inviteRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId?.(`xx_pvp_accept_${userId}_${target.id}`).setLabel('✅ Chấp Nhận').setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId?.(`xx_pvp_decline_${userId}_${target.id}`).setLabel('❌ Từ Chối').setStyle(ButtonStyle.Danger));
            const inviteMsg = await message.reply({ embeds: [inviteEmbed], components: [inviteRow] }).catch(() => null);
            if (!inviteMsg) { await db.addMoney(userId, bet, null, null, -bet); activeXuXi.delete(userId); activeXuXi.delete(target.id); return; } 
            pvpState.response = inviteMsg;

            const inviteCollector = inviteMsg.createMessageComponentCollector({ time: 60000 });
            inviteCollector.on('collect', async i => {
                if (i.user.id !== target.id && i.user.id !== userId) return i.reply({ content: '❌ Bạn không liên quan!', flags: [MessageFlags.Ephemeral] });
                if (i.customId.startsWith('xx_pvp_decline_')) { inviteCollector.stop('declined'); await i.deferUpdate().catch(() => null); }
                if (i.customId.startsWith('xx_pvp_accept_')) {
                    if (i.user.id !== target.id) return i.reply({ content: '❌ Chỉ đối thủ mới có quyền bấm!', flags: [MessageFlags.Ephemeral] });
                    if (db.getMoney(target.id) < bet) { inviteCollector.stop('insufficient_funds'); return i.reply({ content: '❌ Không đủ tiền!', flags: [MessageFlags.Ephemeral] }); }
                    await i.deferUpdate().catch(() => null); inviteCollector.stop('accepted');
                }
            });

            inviteCollector.on('end', async (collected, reason) => {
                const game = activeXuXi.get(userId); if (!game || game.status !== 'pending') return;
                if (reason !== 'accepted') {
                    await db.addMoney(userId, bet, null, null, -bet); 
                    const errText = reason === 'time' ? 'Lời thách đấu tự động hủy do đối thủ không phản hồi.' : 'Lời thách đấu đã bị từ chối.';
                    await inviteMsg.edit({ embeds: [new EmbedBuilder().setColor('#ef4444').setTitle('❌ THÁCH ĐẤU BỊ HỦY').setDescription(errText)], components: [] }).catch(() => null);
                    activeXuXi.delete(userId); activeXuXi.delete(target.id);
                } else {
                    game.status = 'playing'; await db.addMoney(target.id, -bet, null, null, bet); 
                    activeXuXi.set(userId, game); activeXuXi.set(target.id, game);
                    const initialAttach = await drawXuXiCanvas(null, null, "Đang chờ hai bên ra chiêu...", message.author.username, target.username);
                    const playEmbed = new EmbedBuilder().setColor('#10b981').setTitle('⚔️ ĐẤU TRƯỜNG XÙ XÌ PvP').setDescription(`🔥 Quyết đấu giữa <@${userId}> và <@${target.id}>!\n💰 Tổng hũ thưởng: **${(bet * 2).toLocaleString()}** xu\n⏰ Hạn giờ ra chiêu: **60 giây**`).setImage(`attachment://${initialAttach.name}`);
                    const playRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId?.(`xx_pvp_keo_${userId}_${target.id}`).setLabel('✂️ Kéo').setStyle(ButtonStyle.Primary), new ButtonBuilder().setCustomId?.(`xx_pvp_bua_${userId}_${target.id}`).setLabel('🔨 Búa').setStyle(ButtonStyle.Primary), new ButtonBuilder().setCustomId?.(`xx_pvp_bao_${userId}_${target.id}`).setLabel('📄 Bao').setStyle(ButtonStyle.Primary));
                    
                    const gameMsg = await inviteMsg.edit({ embeds: [playEmbed], files: [initialAttach], components: [playRow], attachments: [] }).catch(() => null);
                    if (!gameMsg) { await db.addMoney(userId, bet, null, null, -bet); await db.addMoney(target.id, bet, null, null, -bet); activeXuXi.delete(userId); activeXuXi.delete(target.id); return; } 

                    const gameCollector = gameMsg.createMessageComponentCollector({ time: 60000 });
                    gameCollector.on('collect', async i => {
                        if (i.user.id !== userId && i.user.id !== target.id) return i.reply({ content: '❌ Tránh ra chỗ khác chơi!', flags: [MessageFlags.Ephemeral] });
                        const currentGame = activeXuXi.get(userId); if (!currentGame || currentGame.status !== 'playing') return i.deferUpdate().catch(() => null);
                        
                        const choice = i.customId.split('_')[2];

                        if (i.user.id === userId) {
                            if (currentGame.challengerChoice) return i.reply({ content: '❌ Bạn đã ra chiêu rồi!', flags: [MessageFlags.Ephemeral] });
                            currentGame.challengerChoice = choice; currentGame.challengerInteraction = i;
                            await i.reply({ content: `✅ Bạn đã ra **${choice === 'keo' ? 'Kéo ✂️' : choice === 'bua' ? 'Búa 🔨' : 'Bao 📄'}** thành công! Vui lòng chờ đối thủ.`, flags: [MessageFlags.Ephemeral] });
                        } else {
                            if (currentGame.opponentChoice) return i.reply({ content: '❌ Bạn đã ra chiêu rồi!', flags: [MessageFlags.Ephemeral] });
                            currentGame.opponentChoice = choice; currentGame.opponentInteraction = i;
                            await i.reply({ content: `✅ Bạn đã ra **${choice === 'keo' ? 'Kéo ✂️' : choice === 'bua' ? 'Búa 🔨' : 'Bao 📄'}** thành công! Vui lòng chờ đối thủ.`, flags: [MessageFlags.Ephemeral] });
                        }
                        activeXuXi.set(userId, currentGame); activeXuXi.set(target.id, currentGame);
                        const statusDesc = `👤 <@${userId}>: ${currentGame.challengerChoice ? '✅ Đã ra chiêu 🔒' : '⏳ Đang suy nghĩ...'}\n👤 <@${target.id}>: ${currentGame.opponentChoice ? '✅ Đã ra chiêu 🔒' : '⏳ Đang suy nghĩ...'}`;
                        
                        await gameMsg.edit({ embeds: [new EmbedBuilder().setColor('#ffaa00').setTitle('⚔️ ĐẤU TRƯỜNG XÙ XÌ PvP').setDescription(`🔥 Trận đấu đang diễn ra!\n💰 Cược: **${bet.toLocaleString()}** xu\n\n${statusDesc}`).setImage(`attachment://${initialAttach.name}`)] }).catch(() => null);
                        if (currentGame.challengerChoice && currentGame.opponentChoice) gameCollector.stop('both_chosen');
                    });

                    gameCollector.on('end', async (collected, reason) => {
                        const currentGame = activeXuXi.get(userId); if (!currentGame) return;
                        try {
                            if (currentGame.challengerInteraction) await currentGame.challengerInteraction.editReply({ content: '🔒 Trận đấu hoàn tất! Đang lật kết quả thưởng...', components: [] }).catch(() => null);
                            if (currentGame.opponentInteraction) await currentGame.opponentInteraction.editReply({ content: '🔒 Trận đấu hoàn tất! Đang lật kết quả thưởng...', components: [] }).catch(() => null);
                        } catch (err) {}

                        let status = 'draw'; let resultText = ""; let finalEmbedColor = '#f59e0b'; let refC = 0, refO = 0;
                        if (reason === 'both_chosen') {
                            const cC = currentGame.challengerChoice; const oC = currentGame.opponentChoice;
                            if (cC === oC) { status = 'draw'; resultText = "Hai bên hòa nhau, hoàn tiền cược!"; refC = bet; refO = bet; } 
                            else if ((cC === 'keo' && oC === 'bao') || (cC === 'bua' && oC === 'keo') || (cC === 'bao' && oC === 'bua')) {
                                status = 'c_win'; resultText = `${message.author.username} CHIẾN THẮNG!`; finalEmbedColor = '#10b981'; refC = bet * 2;
                            } else {
                                status = 'o_win'; resultText = `${target.username} CHIẾN THẮNG!`; finalEmbedColor = '#10b981'; refO = bet * 2;
                            }

                            let bC = 0, bO = 0;
                            if (status === 'draw') { bC = await db.addMoney(userId, refC); bO = await db.addMoney(target.id, refO); } 
                            else if (status === 'c_win') { bC = await db.addMoney(userId, refC, true, 'xuxi'); bO = await db.addMoney(target.id, 0, false, 'xuxi'); } 
                            else { bC = await db.addMoney(userId, 0, false, 'xuxi'); bO = await db.addMoney(target.id, refO, true, 'xuxi'); }

                            const resultAttach = await drawXuXiCanvas(cC, oC, resultText, message.author.username, target.username, true, status === 'draw' ? 'draw' : (status === 'c_win'), bC, bet);
                            const resultEmbed = new EmbedBuilder().setColor(finalEmbedColor).setTitle('⚔️ KẾT QUẢ ĐẤU TRƯỜNG NHÀ ĐỰC').setDescription(`👤 <@${userId}>: Ra **${cC.toUpperCase()}** (Số dư: **${bC.toLocaleString()}** xu)\n👤 <@${target.id}>: Ra **${oC.toUpperCase()}** (Số dư: **${bO.toLocaleString()}** xu)\n\n🏆 **Kết quả:** ${status === 'draw' ? '**HÒA NHAU**' : status === 'c_win' ? `<@${userId}> thắng cuộc!` : `<@${target.id}> thắng cuộc!`}`).setImage(`attachment://${resultAttach.name}`);
                            
                            await gameMsg.edit({ embeds: [resultEmbed], files: [resultAttach], components: [], attachments: [] }).catch(() => null);
                        } else {
                            if (!currentGame.challengerChoice && !currentGame.opponentChoice) { await db.addMoney(userId, bet); await db.addMoney(target.id, bet); resultText = "Cả hai đều bỏ cuộc, hoàn tiền cược."; }
                            else if (currentGame.challengerChoice) { await db.addMoney(userId, bet * 2, true, 'xuxi'); await db.addMoney(target.id, 0, false, 'xuxi'); resultText = `Đối thủ bỏ cuộc, <@${userId}> thắng nhận cả hũ.`; }
                            else { await db.addMoney(userId, 0, false, 'xuxi'); await db.addMoney(target.id, bet * 2, true, 'xuxi'); resultText = `<@${target.id}> thắng do người thách đấu bỏ cuộc.`; }
                            await gameMsg.edit({ embeds: [new EmbedBuilder().setColor('#ef4444').setTitle('⏰ TRẬN ĐẤU QUÁ HẠN PHẢN HỒI').setDescription(resultText)], components: [], attachments: [] }).catch(() => null);
                        }
                        activeXuXi.delete(userId); activeXuXi.delete(target.id); await updateTopRanksRoles(message.guild);
                    });
                }
            });
            return;
        }

        // CHẾ ĐỘ PvE (ĐẤU VỚI MÁY)
        if (activeXuXi.has(userId)) return message.reply('❌ Bạn đang có một ván Xù Xì chưa hoàn thành!');
        const currentMoney = db.getMoney(userId); const rawBet = args[0]?.replace(/[\.,]/g, ''); let bet = rawBet?.toLowerCase() === 'all' ? currentMoney : parseInt(rawBet);
        if (isNaN(bet) || bet <= 0 || currentMoney < bet) return message.reply('❌ Số tiền cược không hợp lệ!');

        await db.addMoney(userId, -bet, null, null, bet); activeXuXi.set(userId, { bet, isProcessing: false, mode: 'pve' }); 
        const initialAttach = await drawXuXiCanvas(null, null, "Đang chờ bạn ra chiêu...");
        const startEmbed = new EmbedBuilder().setColor('#10b981').setTitle('✌️✊🖐️ SẢNH ĐẤU XÙ XÌ NHÀ ĐỰC').setDescription(`👤 Người chơi: <@${userId}>\n💰 Tiền cược: **${bet.toLocaleString()}** xu\n⏰ Hạn giờ ra chiêu: **60 giây**`).setImage(`attachment://${initialAttach.name}`);
        
        const response = await message.reply({ embeds: [startEmbed], files: [initialAttach], components: [generateXXButtons(false)] }).catch(() => null);
        if (!response) { activeXuXi.delete(userId); return; }

        const collector = response.createMessageComponentCollector({ time: 60000 });
        collector.on('collect', async i => {
            if (i.user.id !== userId) return i.reply({ content: '❌ Tránh ra chỗ khác chơi!', flags: [MessageFlags.Ephemeral] });
            const game = activeXuXi.get(userId); if (!game || game.isProcessing) return i.deferUpdate().catch(() => null);
            game.isProcessing = true; activeXuXi.set(userId, game); await i.deferUpdate().catch(() => null);

            const pChoice = i.customId.split('_')[1]; const options = ['keo', 'bua', 'bao']; const bChoice = options[Math.floor(Math.random() * 3)];
            let status = 'draw'; if (pChoice === bChoice) status = 'draw'; else if ((pChoice === 'keo' && bChoice === 'bao') || (pChoice === 'bua' && bChoice === 'keo') || (pChoice === 'bao' && bChoice === 'bua')) status = 'win'; else status = 'lose';

            let resultText = "HÒA NHAU!"; let finalMoney = 0; let embedColor = '#f59e0b';
            if (status === 'win') { finalMoney = await db.addMoney(userId, bet * 2, true, 'xuxi'); resultText = "BẠN CHIẾN THẮNG!"; embedColor = '#10b981'; } 
            else if (status === 'lose') { finalMoney = await db.addMoney(userId, 0, false, 'xuxi'); resultText = "MÁY CHIẾN THẮNG!"; embedColor = '#ef4444'; } 
            else { finalMoney = await db.addMoney(userId, bet); }

            collector.stop('completed');
            const resultAttach = await drawXuXiCanvas(pChoice, bChoice, resultText, "BẠN", "NHÀ CÁI", true, status === 'draw' ? 'draw' : (status === 'win'), finalMoney, bet);
            const resultEmbed = new EmbedBuilder().setColor(embedColor).setTitle('✌️✊🖐️ KẾT QUẢ XÙ XÌ NHÀ ĐỰC').setDescription(`👤 Người chơi: <@${userId}>\n💰 Số dư ví hiện tại: **${finalMoney.toLocaleString()}** xu.\n\n🏆 **Kết quả:** ${status === 'draw' ? '**HÒA BÀI** (Hoàn cược)' : status === 'win' ? '**BẠN THẮNG!**' : '**BẠN THUA!**'}`).setImage(`attachment://${resultAttach.name}`);
            await i.editReply({ embeds: [resultEmbed], files: [resultAttach], components: [], attachments: [] }).catch(() => null);
            activeXuXi.delete(userId); await updateTopRanksRoles(message.guild);
        });

        collector.on('end', async (collected, reason) => {
            const game = activeXuXi.get(userId); if (!game || game.mode !== 'pve') return;
            if (reason === 'time') {
                await db.addMoney(userId, Math.floor(game.bet * 0.5));
                await response.edit({ embeds: [new EmbedBuilder().setColor('#ef4444').setTitle('⏰ VÁN ĐẤU HẾT HẠN PHẢN HỒI').setDescription(`Bạn không ra chiêu sau 60 giây. Hệ thống phạt **50% tiền cược gốc**.\n💰 Hoàn trả ví: **${Math.floor(game.bet * 0.5).toLocaleString()}** xu.`)], components: [], attachments: [] }).catch(() => null); activeXuXi.delete(userId); await updateTopRanksRoles(message.guild);
            }
        });
    }
});

client.on('error', console.error);
client.login(BOT_TOKEN);
