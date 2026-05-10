import { Player, Enemy } from "../Entities";
import { RogueState, RoguePhase, PerkDef, STARTER_OPTIONS, PERK_POOL, PerkId, CircleElement } from "./RogueTypes";

/**
 * 肉鸽模式 UI 绘制 + 点击判定
 *
 * 纯 Canvas 2D 绘制, 不依赖 DOM.
 * 包含:
 * - 初始武器选择 (3 张大卡片)
 * - Perk 选择 (3 张卡片)
 * - 战斗 HUD (层数 / 玩家血条 / Boss 血条 / 武器 / 技能 / 已获得增益)
 * - 结束画面
 */
export class RogueUI {
    ctx: CanvasRenderingContext2D;
    width: number;
    height: number;

    // 卡片布局缓存
    private starterCardRects: { x: number; y: number; w: number; h: number }[] = [];
    private perkCardRects: { x: number; y: number; w: number; h: number }[] = [];
    private elementCardRects: { x: number; y: number; w: number; h: number }[] = [];

    constructor(ctx: CanvasRenderingContext2D, width: number, height: number) {
        this.ctx = ctx;
        this.width = width;
        this.height = height;
    }

    resize(w: number, h: number) {
        this.width = w;
        this.height = h;
    }

    // ================== 武器选择画面 ==================
    drawWeaponSelect(state: RogueState) {
        const ctx = this.ctx;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.fillRect(0, 0, this.width, this.height);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 36px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('选择初始武器', this.width / 2, 80);

        ctx.font = '16px sans-serif';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText('肉鸽模式 · 每层击败 Boss 后选择增益', this.width / 2, 120);

        const cardW = 180;
        const cardH = 260;
        const gap = 30;
        const totalW = cardW * 3 + gap * 2;
        const startX = (this.width - totalW) / 2;
        const startY = (this.height - cardH) / 2;

        this.starterCardRects = [];

        STARTER_OPTIONS.forEach((opt, i) => {
            const cx = startX + i * (cardW + gap);
            const cy = startY;
            this.starterCardRects.push({ x: cx, y: cy, w: cardW, h: cardH });

            ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
            ctx.strokeStyle = opt.color;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.roundRect(cx, cy, cardW, cardH, 12);
            ctx.fill();
            ctx.stroke();

            ctx.font = '48px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(opt.icon, cx + cardW / 2, cy + 60);

            ctx.font = 'bold 22px sans-serif';
            ctx.fillStyle = opt.color;
            ctx.fillText(opt.name, cx + cardW / 2, cy + 110);

            ctx.font = '13px sans-serif';
            ctx.fillStyle = '#cbd5e1';
            this.wrapText(opt.desc, cx + cardW / 2, cy + 145, cardW - 24, 18);
        });

        ctx.font = '13px sans-serif';
        ctx.fillStyle = '#64748b';
        ctx.textAlign = 'center';
        ctx.fillText('选择魔法阵后还需选择元素派系', this.width / 2, this.height - 40);
    }

    hitTestStarterCards(mx: number, my: number): 'VULCAN' | 'LASER' | 'MAGIC_CIRCLE' | null {
        for (let i = 0; i < this.starterCardRects.length; i++) {
            const r = this.starterCardRects[i];
            if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) {
                return STARTER_OPTIONS[i].key;
            }
        }
        return null;
    }

    // ================== 派系选择画面 (魔法阵专属) ==================
    drawElementSelect(state: RogueState) {
        const ctx = this.ctx;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.78)';
        ctx.fillRect(0, 0, this.width, this.height);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 34px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('选择魔法阵派系', this.width / 2, 90);

        ctx.font = '15px sans-serif';
        ctx.fillStyle = '#a5b4fc';
        ctx.fillText('两种派系路线相互独立, 对应不同的专属增益', this.width / 2, 128);

        const cardW = 240;
        const cardH = 300;
        const gap = 48;
        const totalW = cardW * 2 + gap;
        const startX = (this.width - totalW) / 2;
        const startY = (this.height - cardH) / 2;

        this.elementCardRects = [];
        const options = [
            { key: CircleElement.FIRE, name: '火系', icon: '🔥', color: '#fb923c',
              desc: '阵内 AOE 持续灼烧, 附带爆发脉冲 · 适合站桩输出' },
            { key: CircleElement.ELECTRIC, name: '电系', icon: '⚡', color: '#a78bfa',
              desc: '连锁闪电跳跃全屏, 忽略范围限制 · 适合小怪清场' }
        ];

        options.forEach((opt, i) => {
            const cx = startX + i * (cardW + gap);
            const cy = startY;
            this.elementCardRects.push({ x: cx, y: cy, w: cardW, h: cardH });

            ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
            ctx.strokeStyle = opt.color;
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.roundRect(cx, cy, cardW, cardH, 14);
            ctx.fill();
            ctx.stroke();

            // 顶部彩带
            ctx.fillStyle = opt.color;
            ctx.beginPath();
            ctx.roundRect(cx, cy, cardW, 8, [14, 14, 0, 0]);
            ctx.fill();

            ctx.font = '72px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(opt.icon, cx + cardW / 2, cy + 90);

            ctx.font = 'bold 26px sans-serif';
            ctx.fillStyle = opt.color;
            ctx.fillText(opt.name, cx + cardW / 2, cy + 160);

            ctx.font = '14px sans-serif';
            ctx.fillStyle = '#cbd5e1';
            this.wrapText(opt.desc, cx + cardW / 2, cy + 205, cardW - 36, 22);
        });
    }

    hitTestElementCards(mx: number, my: number): CircleElement | null {
        const map = [CircleElement.FIRE, CircleElement.ELECTRIC];
        for (let i = 0; i < this.elementCardRects.length; i++) {
            const r = this.elementCardRects[i];
            if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) {
                return map[i];
            }
        }
        return null;
    }

    // ================== Perk 选择画面 ==================
    drawPerkSelect(state: RogueState) {
        const ctx = this.ctx;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(0, 0, this.width, this.height);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 32px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`第 ${state.layer} 层通关!`, this.width / 2, 60);

        ctx.font = '18px sans-serif';
        ctx.fillStyle = '#a5b4fc';
        ctx.fillText('选择一项增益', this.width / 2, 95);

        const cardW = 200;
        const cardH = 280;
        const gap = 24;
        const count = state.perkChoices.length;
        const totalW = cardW * count + gap * (count - 1);
        const startX = (this.width - totalW) / 2;
        const startY = (this.height - cardH) / 2;

        this.perkCardRects = [];

        state.perkChoices.forEach((perk, i) => {
            const cx = startX + i * (cardW + gap);
            const cy = startY;
            this.perkCardRects.push({ x: cx, y: cy, w: cardW, h: cardH });

            ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
            ctx.strokeStyle = perk.color;
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.roundRect(cx, cy, cardW, cardH, 12);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = perk.color;
            ctx.beginPath();
            ctx.roundRect(cx, cy, cardW, 6, [12, 12, 0, 0]);
            ctx.fill();

            ctx.font = '44px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(perk.icon, cx + cardW / 2, cy + 60);

            ctx.font = 'bold 20px sans-serif';
            ctx.fillStyle = perk.color;
            ctx.fillText(perk.name, cx + cardW / 2, cy + 105);

            ctx.font = '14px sans-serif';
            ctx.fillStyle = '#e2e8f0';
            this.wrapText(perk.desc, cx + cardW / 2, cy + 140, cardW - 28, 20);

            const stacks = state.perks.filter(p => p === perk.id).length;
            if (stacks > 0) {
                ctx.font = '12px sans-serif';
                ctx.fillStyle = '#64748b';
                ctx.fillText(`已拥有 x${stacks}`, cx + cardW / 2, cy + cardH - 20);
            }
        });
    }

    hitTestPerkCards(mx: number, my: number, count: number): number | null {
        for (let i = 0; i < this.perkCardRects.length && i < count; i++) {
            const r = this.perkCardRects[i];
            if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) {
                return i;
            }
        }
        return null;
    }

    // ================== 战斗 HUD ==================
    drawFightingHUD(state: RogueState, player: Player | null, boss: Enemy | null) {
        const ctx = this.ctx;

        // ========== 顶部: 层数 + Boss 血条 ==========
        // 层数徽章 (左上)
        const badgeX = 16, badgeY = 12;
        const badgeW = 110, badgeH = 32;
        ctx.fillStyle = 'rgba(3, 7, 18, 0.85)';
        ctx.strokeStyle = 'rgba(244, 114, 182, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 6);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#f472b6';
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(`LAYER ${state.layer} · ∞`, badgeX + 10, badgeY + badgeH / 2);

        // Boss 血条 (屏幕顶部中央)
        if (boss && !boss.markedForDeletion && boss.position.y > -50) {
            this.drawBossBar(boss);
        }

        // ========== 右上: 武器图标 + 已拥有增益 ==========
        this.drawWeaponBadge(state);
        this.drawPerksPanel(state);

        // ========== 左下: 玩家血条 / 蓝条 ==========
        if (player) {
            this.drawPlayerStatBars(player);
        }

        // ========== 右下: 技能 (已解锁的) ==========
        if (player) {
            this.drawSkillBadges(state, player);
        }
    }

    private drawBossBar(boss: Enemy) {
        const ctx = this.ctx;
        const w = Math.min(520, this.width - 280); // 留空给两侧 UI
        const h = 16;
        const x = (this.width - w) / 2;
        const y = 16;

        // 背景
        ctx.fillStyle = 'rgba(3, 7, 18, 0.9)';
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.7)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, 4);
        ctx.fill();
        ctx.stroke();

        // 血量填充
        const ratio = Math.max(0, Math.min(1, boss.health / boss.maxHealth));
        const grad = ctx.createLinearGradient(x, 0, x + w, 0);
        grad.addColorStop(0, '#7f1d1d');
        grad.addColorStop(1, '#f87171');
        ctx.fillStyle = grad;
        ctx.fillRect(x + 2, y + 2, (w - 4) * ratio, h - 4);

        // 标题
        ctx.fillStyle = '#fecaca';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(
            `BOSS · ${Math.ceil(boss.health)} / ${Math.ceil(boss.maxHealth)}`,
            x + w / 2,
            y + h / 2
        );
    }

    private drawWeaponBadge(state: RogueState) {
        const ctx = this.ctx;
        const w = 120, h = 32;
        const x = this.width - w - 16;
        const y = 12;

        let icon = '🔫', name = 'VULCAN', color = '#facc15';
        if (state.starterWeapon === 'LASER') { icon = '⚡'; name = 'LASER'; color = '#38bdf8'; }
        else if (state.starterWeapon === 'MAGIC_CIRCLE') {
            icon = '🔮'; color = '#a855f7';
            name = state.circleElement === 'FIRE' ? 'FIRE CIRCLE' : 'ELEC CIRCLE';
        }

        ctx.fillStyle = 'rgba(3, 7, 18, 0.85)';
        ctx.strokeStyle = color + 'aa';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, 6);
        ctx.fill();
        ctx.stroke();

        ctx.font = '16px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(icon, x + 8, y + h / 2);

        ctx.font = 'bold 11px sans-serif';
        ctx.fillStyle = color;
        ctx.fillText(name, x + 32, y + h / 2);
    }

    /** 右上: 已拥有的 Perks, 按 id 聚合后显示图标 + 层数 */
    private drawPerksPanel(state: RogueState) {
        const ctx = this.ctx;
        if (state.perks.length === 0) return;

        // 聚合
        const counts = new Map<PerkId, number>();
        for (const p of state.perks) counts.set(p, (counts.get(p) || 0) + 1);
        const lookup = new Map<PerkId, PerkDef>();
        for (const def of PERK_POOL) lookup.set(def.id, def);

        // 位置: 武器徽章下方
        const startX = this.width - 16;
        const startY = 52;
        const iconSize = 28;
        const gap = 4;

        // 每行 6 个
        const perRow = 6;
        let idx = 0;
        const entries = Array.from(counts.entries());
        entries.forEach(([id, count]) => {
            const def = lookup.get(id);
            if (!def) return;
            const row = Math.floor(idx / perRow);
            const col = idx % perRow;
            const x = startX - (col + 1) * (iconSize + gap);
            const y = startY + row * (iconSize + gap);

            // 格子底
            ctx.fillStyle = 'rgba(3, 7, 18, 0.9)';
            ctx.strokeStyle = def.color + 'aa';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.roundRect(x, y, iconSize, iconSize, 4);
            ctx.fill();
            ctx.stroke();

            // 图标
            ctx.font = '16px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(def.icon, x + iconSize / 2, y + iconSize / 2);

            // 层数角标
            if (count > 1) {
                ctx.fillStyle = def.color;
                ctx.fillRect(x + iconSize - 10, y + iconSize - 10, 10, 10);
                ctx.fillStyle = '#000';
                ctx.font = 'bold 9px sans-serif';
                ctx.fillText(String(count), x + iconSize - 5, y + iconSize - 5);
            }
            idx++;
        });
    }

    private drawPlayerStatBars(player: Player) {
        const ctx = this.ctx;
        const barW = 200, barH = 12;
        const x = 16;
        const baseY = this.height - 60;

        // HP
        this.drawStatBar(x, baseY, barW, barH,
            player.health, player.maxHealth,
            '#22c55e', '#166534', 'HP');

        // MP
        this.drawStatBar(x, baseY + 24, barW, barH,
            player.mana, player.maxMana,
            '#60a5fa', '#1e3a8a', 'MP');
    }

    private drawStatBar(x: number, y: number, w: number, h: number,
                        value: number, max: number, c1: string, c2: string, label: string) {
        const ctx = this.ctx;
        const ratio = Math.max(0, Math.min(1, value / max));

        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, 2);
        ctx.fill();
        ctx.stroke();

        const grad = ctx.createLinearGradient(x, 0, x + w, 0);
        grad.addColorStop(0, c2);
        grad.addColorStop(1, c1);
        ctx.fillStyle = grad;
        ctx.fillRect(x + 1, y + 1, (w - 2) * ratio, h - 2);

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${label} ${Math.ceil(value)}/${Math.floor(max)}`, x + 6, y + h / 2);
    }

    private drawSkillBadges(state: RogueState, player: Player) {
        const ctx = this.ctx;
        const skills: Array<{ key: 'shield' | 'blackhole' | 'shockwave'; hasFlag: boolean; icon: string; color: string; hotkey: string; name: string }> = [
            { key: 'shield',    hasFlag: state.modifiers.hasShield,    icon: '🛡️', color: '#3b82f6', hotkey: '1', name: '护盾' },
            { key: 'blackhole', hasFlag: state.modifiers.hasBlackhole, icon: '🌀', color: '#6366f1', hotkey: '2', name: '黑洞' },
            { key: 'shockwave', hasFlag: state.modifiers.hasShockwave, icon: '💫', color: '#fbbf24', hotkey: '3', name: '冲击' },
        ];

        const btnSize = 44;
        const gap = 8;
        const startX = this.width - 16 - btnSize;
        const startY = this.height - btnSize - 16;

        let drawn = 0;
        for (let i = skills.length - 1; i >= 0; i--) {
            const s = skills[i];
            if (!s.hasFlag) continue;
            const cd = player.skills[s.key];
            const ratio = cd.current <= 0 ? 0 : (cd.current / cd.max);
            const isReady = cd.current <= 0;

            const x = startX - drawn * (btnSize + gap);
            const y = startY;
            drawn++;

            // 底
            ctx.fillStyle = 'rgba(3, 7, 18, 0.9)';
            ctx.strokeStyle = isReady ? s.color : '#444';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.roundRect(x, y, btnSize, btnSize, 8);
            ctx.fill();
            ctx.stroke();

            // 图标
            ctx.font = '20px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.globalAlpha = isReady ? 1 : 0.4;
            ctx.fillText(s.icon, x + btnSize / 2, y + btnSize / 2);
            ctx.globalAlpha = 1;

            // 冷却覆盖
            if (!isReady) {
                ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
                ctx.fillRect(x + 2, y + 2, btnSize - 4, (btnSize - 4) * ratio);
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 12px sans-serif';
                ctx.fillText(Math.ceil(cd.current).toString(), x + btnSize / 2, y + btnSize / 2);
            }

            // 快捷键角标
            ctx.fillStyle = s.color;
            ctx.fillRect(x + btnSize - 14, y - 2, 14, 14);
            ctx.fillStyle = '#000';
            ctx.font = 'bold 10px sans-serif';
            ctx.fillText(s.hotkey, x + btnSize - 7, y + 5);
        }
    }

    // ================== 结束画面 ==================
    drawEndScreen(state: RogueState, victory: boolean) {
        const ctx = this.ctx;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(0, 0, this.width, this.height);

        ctx.textAlign = 'center';
        ctx.fillStyle = victory ? '#4ade80' : '#f87171';
        ctx.font = 'bold 42px sans-serif';
        ctx.textBaseline = 'middle';
        ctx.fillText(victory ? '通关!' : '阵亡', this.width / 2, this.height / 2 - 40);

        ctx.fillStyle = '#e2e8f0';
        ctx.font = '20px sans-serif';
        ctx.fillText(`到达第 ${state.layer} 层 · 获得 ${state.perks.length} 个增益`, this.width / 2, this.height / 2 + 10);

        ctx.fillStyle = '#64748b';
        ctx.font = '16px sans-serif';
        ctx.fillText('点击任意位置返回主菜单', this.width / 2, this.height / 2 + 60);
    }

    // ================== 工具 ==================
    private wrapText(text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
        const ctx = this.ctx;
        const chars = text.split('');
        let line = '';
        let lineY = y;

        for (const ch of chars) {
            const test = line + ch;
            const metrics = ctx.measureText(test);
            if (metrics.width > maxWidth && line.length > 0) {
                ctx.fillText(line, x, lineY);
                line = ch;
                lineY += lineHeight;
            } else {
                line = test;
            }
        }
        if (line) ctx.fillText(line, x, lineY);
    }
}
