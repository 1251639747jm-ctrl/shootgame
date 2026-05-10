import { Player } from "../Entities";
import { RogueState, RoguePhase, PerkDef, STARTER_OPTIONS, StarterConfig } from "./RogueTypes";

/**
 * 肉鸽模式 UI 绘制 + 点击判定
 *
 * 纯 Canvas 2D 绘制, 不依赖 DOM.
 * 包含:
 * - 初始武器选择 (3 张大卡片)
 * - Perk 选择 (3 张卡片)
 * - 战斗 HUD (层数, 血条)
 * - 结束画面
 */
export class RogueUI {
    ctx: CanvasRenderingContext2D;
    width: number;
    height: number;

    // 卡片布局缓存
    private starterCardRects: { x: number; y: number; w: number; h: number }[] = [];
    private perkCardRects: { x: number; y: number; w: number; h: number }[] = [];

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
        // 半透明遮罩
        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.fillRect(0, 0, this.width, this.height);

        // 标题
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 36px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('选择初始武器', this.width / 2, 80);

        ctx.font = '16px sans-serif';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText('肉鸽模式 · 每层击败 Boss 后选择增益', this.width / 2, 120);

        // 3 张卡片
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

            // 卡片背景
            ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
            ctx.strokeStyle = opt.color;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.roundRect(cx, cy, cardW, cardH, 12);
            ctx.fill();
            ctx.stroke();

            // 图标
            ctx.font = '48px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(opt.icon, cx + cardW / 2, cy + 60);

            // 名称
            ctx.font = 'bold 22px sans-serif';
            ctx.fillStyle = opt.color;
            ctx.fillText(opt.name, cx + cardW / 2, cy + 110);

            // 描述 (自动换行)
            ctx.font = '13px sans-serif';
            ctx.fillStyle = '#cbd5e1';
            this.wrapText(opt.desc, cx + cardW / 2, cy + 145, cardW - 24, 18);
        });

        // 魔法阵提示
        ctx.font = '13px sans-serif';
        ctx.fillStyle = '#64748b';
        ctx.textAlign = 'center';
        ctx.fillText('魔法阵: 点左半=火系 | 点右半=电系', this.width / 2, this.height - 40);
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

    // ================== Perk 选择画面 ==================
    drawPerkSelect(state: RogueState) {
        const ctx = this.ctx;
        // 遮罩
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(0, 0, this.width, this.height);

        // 标题
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 32px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`第 ${state.layer} 层通关!`, this.width / 2, 60);

        ctx.font = '18px sans-serif';
        ctx.fillStyle = '#a5b4fc';
        ctx.fillText('选择一项增益', this.width / 2, 95);

        // 卡片
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

            // 卡片
            ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
            ctx.strokeStyle = perk.color;
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.roundRect(cx, cy, cardW, cardH, 12);
            ctx.fill();
            ctx.stroke();

            // 顶部彩色条
            ctx.fillStyle = perk.color;
            ctx.beginPath();
            ctx.roundRect(cx, cy, cardW, 6, [12, 12, 0, 0]);
            ctx.fill();

            // 图标
            ctx.font = '44px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(perk.icon, cx + cardW / 2, cy + 60);

            // 名称
            ctx.font = 'bold 20px sans-serif';
            ctx.fillStyle = perk.color;
            ctx.fillText(perk.name, cx + cardW / 2, cy + 105);

            // 描述
            ctx.font = '14px sans-serif';
            ctx.fillStyle = '#e2e8f0';
            this.wrapText(perk.desc, cx + cardW / 2, cy + 140, cardW - 28, 20);

            // 底部: 已叠加层数
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
    drawFightingHUD(state: RogueState, player: Player | null) {
        const ctx = this.ctx;

        // 层数
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 18px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`第 ${state.layer} / ${state.maxLayers} 层`, 16, 28);

        // 武器
        ctx.font = '14px sans-serif';
        ctx.fillStyle = '#94a3b8';
        const weaponLabel = state.starterWeapon === 'VULCAN' ? '机枪' :
                           state.starterWeapon === 'LASER' ? '激光' : '魔法阵';
        ctx.fillText(`武器: ${weaponLabel}`, 16, 50);

        // 血条
        if (player) {
            const barW = 200;
            const barH = 14;
            const bx = 16;
            const by = 62;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.fillRect(bx, by, barW, barH);
            const ratio = Math.max(0, player.health / player.maxHealth);
            ctx.fillStyle = ratio > 0.5 ? '#22c55e' : ratio > 0.25 ? '#f59e0b' : '#ef4444';
            ctx.fillRect(bx, by, barW * ratio, barH);
            ctx.strokeStyle = '#475569';
            ctx.lineWidth = 1;
            ctx.strokeRect(bx, by, barW, barH);

            ctx.fillStyle = '#ffffff';
            ctx.font = '11px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`${Math.ceil(player.health)} / ${player.maxHealth}`, bx + barW / 2, by + 11);
        }

        // Perks 数量
        ctx.textAlign = 'right';
        ctx.fillStyle = '#a5b4fc';
        ctx.font = '14px sans-serif';
        ctx.fillText(`增益 x${state.perks.length}`, this.width - 16, 28);

        // 技能图标 (如果已解锁)
        let skillY = 50;
        ctx.textAlign = 'right';
        ctx.font = '13px sans-serif';
        if (state.modifiers.hasShield) {
            ctx.fillStyle = '#3b82f6';
            ctx.fillText('[1] 护盾', this.width - 16, skillY); skillY += 18;
        }
        if (state.modifiers.hasBlackhole) {
            ctx.fillStyle = '#6366f1';
            ctx.fillText('[2] 黑洞', this.width - 16, skillY); skillY += 18;
        }
        if (state.modifiers.hasShockwave) {
            ctx.fillStyle = '#fbbf24';
            ctx.fillText('[3] 冲击波', this.width - 16, skillY);
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
