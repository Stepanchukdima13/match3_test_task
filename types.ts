
export type GemType = 0 | 1 | 2 | 3 | 4;

export interface AnimationState {
    scale: number;
    rotation: number;
    opacity: number;
    offsetX: number;
    offsetY: number;
    shake: number;
    pulse: boolean;
    glow: boolean;
    spinSpeed: number;
}

export interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
    color: string;
    life: number;
}

export interface ComboText {
    x: number;
    y: number;
    text: string;
    color: string;
    life: number;
    initialLife: number;
}

export interface MatchPosition {
    row: number;
    col: number;
}
