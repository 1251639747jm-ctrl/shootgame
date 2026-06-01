import { Player, Enemy } from "../Entities";
import { RogueState, RoguePhase, PerkDef, STARTER_OPTIONS, PERK_POOL, PerkId, CircleElement } from "./RogueTypes";

/**
 * 肉鸽模式 UI 绘制 + 点击判定 (响应式).
 *
 * 纯 Canvas 2D 绘制, 不依赖 DOM.
 * 所有尺寸都通过 this.s() 缩放, 在窄屏 (<640px) 自动收紧:
 *   - 卡片更小, 字号更小, 间距更紧
 *   - 卡片改为竖排或网格 (避免横向溢出)
 *   - HUD 全部自动缩放
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

    /** 是否是窄屏 (移动端) */
    private get isMobile(): boolean {
        return this.width < 640;
    }

    /** UI 缩放系数: 移动端 0.7~0.8x */
    private get uiScale(): number {
        if (this.width < 380) return 0.65;
        if (this.width < 480) return 0.7;
        if (this.width < 640) return 0.8;
        return 1;
    }

    /** 把基准像素值按 uiScale 缩放后取整 */
    private s(px: number): number {
        return Math.round(px * this.uiScale);
    }

    // ================== 武器选择画面 ==================
    drawWeaponSelect(state: RogueState) {
        const ctx = this.ctx;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.fillRect(0, 0, this.width, this.height);

        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${this.s(30)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('选择初始武器', this.width / 2, this.s(60));

        ctx.font = `${this.s(13)}px sans-serif`;
        ctx.fillStyle = '#94a3b8';
        ctx.fillText('肉鸽模式 · 每层击败 Boss 后选择增益', this.width / 2, this.s(96));

        // 卡片: 移动端竖排, 桌面横排
        const stackVertical = this.isMobile;
        const cardW = stackVertical
            ? Math.min(this.s(280), this.width - 32)
            : this.s(180);
        const cardH = stackVertical ? this.s(110) : this.s(240);
        const gap = this.s(stackVertical ? 14 : 28);

        this.starterCardRects = [];

        if (stackVertical) {
            const totalH = cardH * 3 + gap * 2;
            const startY = Math.max(this.s(120), (this.height - totalH) / 2);
            const startX = (this.width - cardW) / 2;

            STARTER_OPTIONS.forEach((opt, i) => {
                const cx = startX;
                const cy = startY + i * (cardH + gap);
                this.starterCardRects.push({ x: cx, y: cy, w: cardW, h: cardH });
                this.drawCardFrame(cx, cy, cardW, cardH, opt.color, this.s(10));

                // 横向布局: 左侧大图标 + 右侧文字
                ctx.font = `${this.s(40)}px sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = opt.color;
                ctx.fillText(opt.icon, cx + this.s(46), cy + cardH / 2);

                ctx.font = `bold ${this.s(18)}px sans-serif`;
                ctx.textAlign = 'left';
                ctx.fillText(opt.name, cx + this.s(92), cy + this.s(28));

                ctx.font = `${this.s(11)}px sans-serif`;
                ctx.fillStyle = '#cbd5e1';
                this.wrapText(opt.desc, cx + this.s(92), cy + this.s(54),
                              cardW - this.s(108), this.s(14), 'left');
            });
        } else {
            const totalW = cardW * 3 + gap * 2;
            const startX = (this.width - totalW) / 2;
            const startY = (this.height - cardH) / 2;

            STARTER_OPTIONS.forEach((opt, i) => {
                const cx = startX + i * (cardW + gap);
                const cy = startY;
                this.starterCardRects.push({ x: cx, y: cy, w: cardW, h: cardH });
                this.drawCardFrame(cx, cy, cardW, cardH, opt.color, this.s(10));

                ctx.font = `${this.s(42)}px sans-serif`;
                ctx.textAlign = 'center';
                ctx.fillStyle = opt.color;
                ctx.fillText(opt.icon, cx + cardW / 2, cy + this.s(54));

                ctx.font = `bold ${this.s(20)}px sans-serif`;
                ctx.fillText(opt.name, cx + cardW / 2, cy + this.s(102));

                ctx.font = `${this.s(12)}px sans-serif`;
                ctx.fillStyle = '#cbd5e1';
                this.wrapText(opt.desc, cx + cardW / 2, cy + this.s(132),
                              cardW - this.s(22), this.s(16));
            });
        }

        ctx.font = `${this.s(11)}px sans-serif`;
        ctx.fillStyle = '#64748b';
        ctx.textAlign = 'center';
        ctx.fillText('选择魔法阵后还需选择元素派系', this.width / 2, this.height - this.s(24));
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
        ctx.font = `bold ${this.s(28)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('选择魔法阵派系', this.width / 2, this.s(70));

        ctx.font = `${this.s(12)}px sans-serif`;
        ctx.fillStyle = '#a5b4fc';
        ctx.fillText('两种派系路线相互独立, 法术池完全不同', this.width / 2, this.s(102));

        const stackVertical = this.isMobile;
        const cardW = stackVertical
            ? Math.min(this.s(300), this.width - 32)
            : this.s(220);
        const cardH = stackVertical ? this.s(140) : this.s(280);
        const gap = this.s(stackVertical ? 16 : 36);

        this.elementCardRects = [];
        const options = [
            { key: CircleElement.FIRE, name: '火系', icon: '🔥', color: '#fb923c',
              desc: '5 个法术: 流星雨 / 火焰新星 / 熔岩飞弹 / 烈焰风暴 / 火神之锤' },
            { key: CircleElement.ELECTRIC, name: '电系', icon: '⚡', color: '#a78bfa',
              desc: '5 个法术: 闪电链 / 天雷 / 静电场 / 电磁轨道炮 / 电浆轰炸' }
        ];

        if (stackVertical) {
            const totalH = cardH * 2 + gap;
            const startY = Math.max(this.s(130), (this.height - totalH) / 2);
            const startX = (this.width - cardW) / 2;

            options.forEach((opt, i) => {
                const cx = startX;
                const cy = startY + i * (cardH + gap);
                this.elementCardRects.push({ x: cx, y: cy, w: cardW, h: cardH });
                this.drawCardFrame(cx, cy, cardW, cardH, opt.color, this.s(12));

                ctx.font = `${this.s(50)}px sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = opt.color;
                ctx.fillText(opt.icon, cx + this.s(58), cy + cardH / 2);

                ctx.font = `bold ${this.s(22)}px sans-serif`;
                ctx.textAlign = 'left';
                ctx.fillText(opt.name, cx + this.s(112), cy + this.s(34));

                ctx.font = `${this.s(11)}px sans-serif`;
                ctx.fillStyle = '#cbd5e1';
                this.wrapText(opt.desc, cx + this.s(112), cy + this.s(64),
                              cardW - this.s(128), this.s(15), 'left');
            });
        } else {
            const totalW = cardW * 2 + gap;
            const startX = (this.width - totalW) / 2;
            const startY = (this.height - cardH) / 2;

            options.forEach((opt, i) => {
                const cx = startX + i * (cardW + gap);
                const cy = startY;
                this.elementCardRects.push({ x: cx, y: cy, w: cardW, h: cardH });
                this.drawCardFrame(cx, cy, cardW, cardH, opt.color, this.s(12));

                ctx.font = `${this.s(64)}px sans-serif`;
                ctx.textAlign = 'center';
                ctx.fillStyle = opt.color;
                ctx.fillText(opt.icon, cx + cardW / 2, cy + this.s(80));

                ctx.font = `bold ${this.s(24)}px sans-serif`;
                ctx.fillText(opt.name, cx + cardW / 2, cy + this.s(150));

                ctx.font = `${this.s(13)}px sans-serif`;
                ctx.fillStyle = '#cbd5e1';
                this.wrapText(opt.desc, cx + cardW / 2, cy + this.s(190),
                              cardW - this.s(34), this.s(20));
            });
        }
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
        ctx.font = `bold ${this.s(26)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`第 ${state.layer} 层通关!`, this.width / 2, this.s(48));

        ctx.font = `${this.s(14)}px sans-serif`;
        ctx.fillStyle = '#a5b4fc';
        ctx.fillText('选择一项增益', this.width / 2, this.s(78));

        const stackVertical = this.isMobile;
        const count = state.perkChoices.length;

        const cardW = stackVertical
            ? Math.min(this.s(300), this.width - 32)
            : this.s(190);
        const cardH = stackVertical ? this.s(96) : this.s(260);
        const gap = this.s(stackVertical ? 10 : 18);

        this.perkCardRects = [];

        if (stackVertical) {
            const totalH = cardH * count + gap * (count - 1);
            const startY = Math.max(this.s(100), (this.height - totalH) / 2);
            const startX = (this.width - cardW) / 2;

            state.perkChoices.forEach((perk, i) => {
                const cx = startX;
                const cy = startY + i * (cardH + gap);
                this.perkCardRects.push({ x: cx, y: cy, w: cardW, h: cardH });
                this.drawCardFrame(cx, cy, cardW, cardH, perk.color, this.s(10));
                ctx.fillStyle = perk.color;
                ctx.beginPath();
                ctx.roundRect(cx, cy, cardW, this.s(4), [this.s(10), this.s(10), 0, 0]);
                ctx.fill();

                ctx.font = `${this.s(28)}px sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = perk.color;
                ctx.fillText(perk.icon, cx + this.s(36), cy + cardH / 2);

                ctx.font = `bold ${this.s(15)}px sans-serif`;
                ctx.textAlign = 'left';
                ctx.fillText(perk.name, cx + this.s(70), cy + this.s(28));

                ctx.font = `${this.s(11)}px sans-serif`;
                ctx.fillStyle = '#e2e8f0';
                this.wrapText(perk.desc, cx + this.s(70), cy + this.s(52),
                              cardW - this.s(84), this.s(14), 'left');

                const stacks = state.perks.filter(p => p === perk.id).length;
                if (stacks > 0) {
                    ctx.font = `${this.s(10)}px sans-serif`;
                    ctx.fillStyle = '#64748b';
                    ctx.textAlign = 'right';
                    ctx.fillText(`x${stacks}`, cx + cardW - this.s(8), cy + this.s(28));
                }
            });
        } else {
            const totalW = cardW * count + gap * (count - 1);
            const startX = (this.width - totalW) / 2;
            const startY = (this.height - cardH) / 2;

            state.perkChoices.forEach((perk, i) => {
                const cx = startX + i * (cardW + gap);
                const cy = startY;
                this.perkCardRects.push({ x: cx, y: cy, w: cardW, h: cardH });
                this.drawCardFrame(cx, cy, cardW, cardH, perk.color, this.s(10));
                ctx.fillStyle = perk.color;
                ctx.beginPath();
                ctx.roundRect(cx, cy, cardW, this.s(5), [this.s(10), this.s(10), 0, 0]);
                ctx.fill();

                ctx.font = `${this.s(40)}px sans-serif`;
                ctx.textAlign = 'center';
                ctx.fillText(perk.icon, cx + cardW / 2, cy + this.s(52));

                ctx.font = `bold ${this.s(18)}px sans-serif`;
                ctx.fillStyle = perk.color;
                ctx.fillText(perk.name, cx + cardW / 2, cy + this.s(96));

                ctx.font = `${this.s(13)}px sans-serif`;
                ctx.fillStyle = '#e2e8f0';
                this.wrapText(perk.desc, cx + cardW / 2, cy + this.s(128),
                              cardW - this.s(26), this.s(18));

                const stacks = state.perks.filter(p => p === perk.id).length;
                if (stacks > 0) {
                    ctx.font = `${this.s(11)}px sans-serif`;
                    ctx.fillStyle = '#64748b';
                    ctx.fillText(`已拥有 x${stacks}`, cx + cardW / 2, cy + cardH - this.s(18));
                }
            });
        }
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
        const badgeX = this.s(12), badgeY = this.s(10);
        const badgeW = this.s(96), badgeH = this.s(26);
        ctx.fillStyle = 'rgba(3, 7, 18, 0.85)';
        ctx.strokeStyle = 'rgba(244, 114, 182, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(badgeX, badgeY, badgeW, badgeH, this.s(5));
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#f472b6';
        ctx.font = `bold ${this.s(11)}px sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(`LAYER ${state.layer} · ∞`, badgeX + this.s(8), badgeY + badgeH / 2);

        // Boss 血条
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

        // ========== 右下: 主动技能 (已解锁的) ==========
        // 注意: 法术轮由 React HUD 绘制 (App.tsx), 不在这里画
        if (player) {
            this.drawSkillBadges(state, player);
        }
    }

    private drawBossBar(boss: Enemy) {
        const ctx = this.ctx;
        // 移动端 Boss 条窄一些, 让两侧 UI 不重叠
        const reserve = this.isMobile ? this.s(180) : this.s(280);
        const w = Math.min(this.s(440), this.width - reserve);
        const h = this.s(13);
        const x = (this.width - w) / 2;
        const y = this.s(12);

        ctx.fillStyle = 'rgba(3, 7, 18, 0.9)';
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.7)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, this.s(3));
        ctx.fill();
        ctx.stroke();

        const ratio = Math.max(0, Math.min(1, boss.health / boss.maxHealth));
        const grad = ctx.createLinearGradient(x, 0, x + w, 0);
        grad.addColorStop(0, '#7f1d1d');
        grad.addColorStop(1, '#f87171');
        ctx.fillStyle = grad;
        ctx.fillRect(x + 2, y + 2, (w - 4) * ratio, h - 4);

        ctx.fillStyle = '#fecaca';
        ctx.font = `bold ${this.s(10)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const txt = this.isMobile
            ? `BOSS · ${Math.ceil(boss.health)}/${Math.ceil(boss.maxHealth)}`
            : `BOSS · ${Math.ceil(boss.health)} / ${Math.ceil(boss.maxHealth)}`;
        ctx.fillText(txt, x + w / 2, y + h / 2);
    }

    private drawWeaponBadge(state: RogueState) {
        const ctx = this.ctx;
        const w = this.s(108), h = this.s(26);
        const x = this.width - w - this.s(12);
        const y = this.s(10);

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
        ctx.roundRect(x, y, w, h, this.s(5));
        ctx.fill();
        ctx.stroke();

        ctx.font = `${this.s(14)}px sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(icon, x + this.s(7), y + h / 2);

        ctx.font = `bold ${this.s(10)}px sans-serif`;
        ctx.fillStyle = color;
        ctx.fillText(name, x + this.s(28), y + h / 2);
    }

    /** 右上: 已拥有的 Perks, 按 id 聚合后显示图标 + 层数 */
    private drawPerksPanel(state: RogueState) {
        const ctx = this.ctx;
        if (state.perks.length === 0) return;

        const counts = new Map<PerkId, number>();
        for (const p of state.perks) counts.set(p, (counts.get(p) || 0) + 1);
        const lookup = new Map<PerkId, PerkDef>();
        for (const def of PERK_POOL) lookup.set(def.id, def);

        const startX = this.width - this.s(12);
        const startY = this.s(42);
        const iconSize = this.s(24);
        const gap = this.s(3);

        // 移动端每行 4 个, 桌面 6 个
        const perRow = this.isMobile ? 4 : 6;
        let idx = 0;
        const entries = Array.from(counts.entries());
        entries.forEach(([id, count]) => {
            const def = lookup.get(id);
            if (!def) return;
            const row = Math.floor(idx / perRow);
            const col = idx % perRow;
            const x = startX - (col + 1) * (iconSize + gap);
            const y = startY + row * (iconSize + gap);

            ctx.fillStyle = 'rgba(3, 7, 18, 0.9)';
            ctx.strokeStyle = def.color + 'aa';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.roundRect(x, y, iconSize, iconSize, this.s(3));
            ctx.fill();
            ctx.stroke();

            ctx.font = `${this.s(14)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(def.icon, x + iconSize / 2, y + iconSize / 2);

            if (count > 1) {
                ctx.fillStyle = def.color;
                ctx.fillRect(x + iconSize - this.s(9), y + iconSize - this.s(9), this.s(9), this.s(9));
                ctx.fillStyle = '#000';
                ctx.font = `bold ${this.s(8)}px sans-serif`;
                ctx.fillText(String(count), x + iconSize - this.s(4.5), y + iconSize - this.s(4.5));
            }
            idx++;
        });
    }

    private drawPlayerStatBars(player: Player) {
        const ctx = this.ctx;
        const barW = this.isMobile ? this.s(150) : this.s(180);
        const barH = this.s(10);
        const x = this.s(12);
        const baseY = this.height - this.s(50);

        this.drawStatBar(x, baseY, barW, barH,
            player.health, player.maxHealth,
            '#22c55e', '#166534', 'HP');
        this.drawStatBar(x, baseY + this.s(20), barW, barH,
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
        ctx.font = `bold ${this.s(9)}px sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${label} ${Math.ceil(value)}/${Math.floor(max)}`, x + this.s(5), y + h / 2);
    }

    private drawSkillBadges(state: RogueState, player: Player) {
        const ctx = this.ctx;
        const skills: Array<{ key: 'shield' | 'blackhole' | 'shockwave'; hasFlag: boolean; icon: string; color: string; hotkey: string; name: string }> = [
            { key: 'shield',    hasFlag: state.modifiers.hasShield,    icon: '🛡️', color: '#3b82f6', hotkey: '1', name: '护盾' },
            { key: 'blackhole', hasFlag: state.modifiers.hasBlackhole, icon: '🌀', color: '#6366f1', hotkey: '2', name: '黑洞' },
            { key: 'shockwave', hasFlag: state.modifiers.hasShockwave, icon: '💫', color: '#fbbf24', hotkey: '3', name: '冲击' },
        ];

        const btnSize = this.s(38);
        const gap = this.s(6);
        const startX = this.width - this.s(12) - btnSize;
        // 给法术轮 (React HUD) 留出底部空间; 主动技能往上挪
        const startY = this.height - btnSize - this.s(80);

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

            ctx.fillStyle = 'rgba(3, 7, 18, 0.9)';
            ctx.strokeStyle = isReady ? s.color : '#444';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.roundRect(x, y, btnSize, btnSize, this.s(7));
            ctx.fill();
            ctx.stroke();

            ctx.font = `${this.s(18)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.globalAlpha = isReady ? 1 : 0.4;
            ctx.fillText(s.icon, x + btnSize / 2, y + btnSize / 2);
            ctx.globalAlpha = 1;

            if (!isReady) {
                ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
                ctx.fillRect(x + 2, y + 2, btnSize - 4, (btnSize - 4) * ratio);
                ctx.fillStyle = '#fff';
                ctx.font = `bold ${this.s(11)}px sans-serif`;
                ctx.fillText(Math.ceil(cd.current).toString(), x + btnSize / 2, y + btnSize / 2);
            }

            ctx.fillStyle = s.color;
            ctx.fillRect(x + btnSize - this.s(12), y - this.s(2), this.s(12), this.s(12));
            ctx.fillStyle = '#000';
            ctx.font = `bold ${this.s(9)}px sans-serif`;
            ctx.fillText(s.hotkey, x + btnSize - this.s(6), y + this.s(4));
        }
    }

    // ================== 结束画面 ==================
    drawEndScreen(state: RogueState, victory: boolean) {
        const ctx = this.ctx;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(0, 0, this.width, this.height);

        ctx.textAlign = 'center';
        ctx.fillStyle = victory ? '#4ade80' : '#f87171';
        ctx.font = `bold ${this.s(38)}px sans-serif`;
        ctx.textBaseline = 'middle';
        ctx.fillText(victory ? '通关!' : '阵亡', this.width / 2, this.height / 2 - this.s(36));

        ctx.fillStyle = '#e2e8f0';
        ctx.font = `${this.s(16)}px sans-serif`;
        ctx.fillText(`到达第 ${state.layer} 层 · 获得 ${state.perks.length} 个增益`,
                     this.width / 2, this.height / 2 + this.s(8));

        ctx.fillStyle = '#64748b';
        ctx.font = `${this.s(13)}px sans-serif`;
        ctx.fillText('点击任意位置返回主菜单',
                     this.width / 2, this.height / 2 + this.s(50));
    }

    // ================== 工具 ==================
    /** 卡片底框 (统一样式) */
    private drawCardFrame(x: number, y: number, w: number, h: number, color: string, radius: number) {
        const ctx = this.ctx;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, radius);
        ctx.fill();
        ctx.stroke();
    }

    private wrapText(text: string, x: number, y: number, maxWidth: number, lineHeight: number,
                     align: CanvasTextAlign = 'center') {
        const ctx = this.ctx;
        ctx.textAlign = align;
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
