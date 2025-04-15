type GemType = 0 | 1 | 2 | 3 | 4;

enum GameMode {
    CLASSIC = 'classic',   // Any match of 3+ counts
    EXACT3 = 'exact3',     // Only exact 3-in-a-row matches count
    EXACT4 = 'exact4',     // Only exact 4-in-a-row matches count
    EXACT5 = 'exact5',     // Only exact 5-in-a-row matches count
}
interface AnimationState {
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

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
    color: string;
    life: number;
}

interface ComboText {
    x: number;
    y: number;
    text: string;
    color: string;
    life: number;
    initialLife: number;
}

interface MatchPosition {
    row: number;
    col: number;
}



// Create background particles with reduced count for better performance
function createParticles(): void {
    const container = document.getElementById('particles');
    if (!container) return;

    const colors: string[] = ['#FF5252', '#448AFF', '#4CAF50', '#FFC107', '#9C27B0'];

    const particleCount = 25; // Reduced from 50

    // Create particles in a documentFragment for better performance
    const fragment = document.createDocumentFragment();

    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = `${Math.random() * 100}%`;
        particle.style.top = `${Math.random() * 100}%`;
        particle.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];

        particle.style.animationDuration = `${20 + Math.random() * 30}s`;
        particle.style.animationDelay = `${Math.random() * 5}s`;

        fragment.appendChild(particle);
    }

    container.appendChild(fragment);
}

// Add polyfill for roundRect if not available in the browser
if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function(
        x: number,
        y: number,
        width: number,
        height: number,
        radius: number
    ): CanvasRenderingContext2D {
        if (width < 2 * radius) radius = width / 2;
        if (height < 2 * radius) radius = height / 2;
        this.beginPath();
        this.moveTo(x + radius, y);
        this.arcTo(x + width, y, x + width, y + height, radius);
        this.arcTo(x + width, y + height, x, y + height, radius);
        this.arcTo(x, y + height, x, y, radius);
        this.arcTo(x, y, x + width, y, radius);
        this.closePath();
        return this;
    };
}

class Match3Game {
    // Game board dimensions
    private readonly BOARD_SIZE: number = 8;
    private readonly GEM_TYPES: number = 5;
    private readonly GEM_SIZE: number = 50; // Size in pixels
    private readonly ANIMATION_SPEED: number = 250; // Animation speed in ms
    private readonly MAX_PARTICLES: number = 75; // Cap max particles for performance

    // Game elements
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private offscreenCanvas: HTMLCanvasElement;
    private offscreenCtx: CanvasRenderingContext2D;
    private board: (GemType | null)[][];
    private animationBoard: AnimationState[][];
    private isDragging: boolean = false;
    private selectedRow: number = -1;
    private selectedCol: number = -1;
    private score: number = 0;
    private animating: boolean = false;
    private matchesFound: number = 0;
    private gameTime: number = 0;
    private lastFrameTime: number = 0;
    private particles: Particle[] = [];
    private comboTexts: ComboText[] = [];
    private gemTemplates: HTMLCanvasElement[] = []; // Pre-rendered gem templates

    private mouseX: number = 0;
    private mouseY: number = 0;
    private dragOffsetX: number = 0;
    private dragOffsetY: number = 0;
    private dragTargetRow: number = -1;
    private dragTargetCol: number = -1;
    private isLiveDragging: boolean = false;

    private frameCount: number = 0;
    private fps: number = 0;
    private lastFpsUpdate: number = 0;

    private gameMode: GameMode = GameMode.CLASSIC;

    private readonly GEM_COLORS: string[] = [
        "#FF5252", // Red
        "#448AFF", // Blue
        "#4CAF50", // Green
        "#FFC107", // Yellow
        "#9C27B0"  // Purple
    ];

    // Shapes for gems (0: circle, 1: square, 2: triangle, 3: diamond, 4: star)
    private readonly GEM_SHAPES: number[] = [0, 1, 2, 3, 4];

    constructor() {
        // Create the canvas element
        this.canvas = document.createElement('canvas');
        this.canvas.width = this.BOARD_SIZE * this.GEM_SIZE;
        this.canvas.height = this.BOARD_SIZE * this.GEM_SIZE;
        const canvasContainer = document.getElementById('canvas-container');
        if (!canvasContainer) {
            throw new Error("Canvas container not found");
        }
        canvasContainer.appendChild(this.canvas);

        // Create an offscreen canvas for better performance
        this.offscreenCanvas = document.createElement('canvas');
        this.offscreenCanvas.width = this.BOARD_SIZE * this.GEM_SIZE;
        this.offscreenCanvas.height = this.BOARD_SIZE * this.GEM_SIZE;

        // Get the rendering contexts with optimization flags
        const ctx = this.canvas.getContext('2d', { alpha: false });
        const offscreenCtx = this.offscreenCanvas.getContext('2d', { alpha: false });
        if (!ctx || !offscreenCtx) {
            throw new Error("Unable to get canvas context");
        }
        this.ctx = ctx;
        this.offscreenCtx = offscreenCtx;

        // Disable image smoothing for better performance
        this.ctx.imageSmoothingEnabled = false;
        this.offscreenCtx.imageSmoothingEnabled = false;

        // Initialize the board
        this.board = Array(this.BOARD_SIZE).fill(null)
            .map(() => Array(this.BOARD_SIZE).fill(null));

        // Initialize animation board
        this.animationBoard = Array(this.BOARD_SIZE).fill(null)
            .map(() => Array(this.BOARD_SIZE).fill(null)
                .map(() => ({
                    scale: 1,
                    rotation: 0,
                    opacity: 1,
                    offsetX: 0,
                    offsetY: 0,
                    shake: 0,
                    pulse: false,
                    glow: false,
                    spinSpeed: 0
                }))
            );

        // Generate pre-rendered gem templates for better performance
        this.createGemTemplates();

        // Set up event listeners with passive flag for better performance
        this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this), { passive: false });
        this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this), { passive: true });
        this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this), { passive: true });

        // Add touch support with passive flags for better performance
        this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
        this.canvas.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
        this.canvas.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });

        // Start the game
        this.initializeBoard();
        this.setupGameModeSelector();
        this.startGameLoop();

        // Add a subtle animation to the canvas
        (this.canvas as HTMLElement).style.animation = "fadeIn 0.8s ease forwards";
    }

    // Pre-render gem templates for faster drawing
    private createGemTemplates(): void {
        this.gemTemplates = [];
        const size = this.GEM_SIZE;

        for (let type = 0; type < this.GEM_TYPES; type++) {
            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');

            if (!ctx) continue;

            // Main gem color
            ctx.fillStyle = this.GEM_COLORS[type];

            const centerX = size / 2;
            const centerY = size / 2;
            const gemSize = size * 0.7;

            // Add a slight glow effect
            ctx.shadowBlur = 10;
            ctx.shadowColor = this.GEM_COLORS[type];

            // Draw different shapes based on the gem type
            switch (this.GEM_SHAPES[type]) {
                case 0: // Circle with shiny effect
                    // Main circle
                    ctx.beginPath();
                    ctx.arc(centerX, centerY, gemSize / 2, 0, Math.PI * 2);
                    ctx.fill();

                    // Add shiny highlight
                    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
                    ctx.beginPath();
                    ctx.arc(centerX - gemSize / 6, centerY - gemSize / 6, gemSize / 10, 0, Math.PI * 2);
                    ctx.fill();
                    break;

                case 1: // Square with beveled edges
                    ctx.beginPath();
                    ctx.roundRect(centerX - gemSize / 2, centerY - gemSize / 2, gemSize, gemSize, 8);
                    ctx.fill();

                    // Add shiny highlight
                    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
                    ctx.beginPath();
                    ctx.moveTo(centerX - gemSize / 4, centerY - gemSize / 4);
                    ctx.lineTo(centerX - gemSize / 10, centerY - gemSize / 10);
                    ctx.lineTo(centerX + gemSize / 10, centerY - gemSize / 10);
                    ctx.lineTo(centerX + gemSize / 4, centerY - gemSize / 4);
                    ctx.fill();
                    break;

                case 2: // Triangle
                    ctx.beginPath();
                    ctx.moveTo(centerX, centerY - gemSize / 2);
                    ctx.lineTo(centerX + gemSize / 2, centerY + gemSize / 2);
                    ctx.lineTo(centerX - gemSize / 2, centerY + gemSize / 2);
                    ctx.closePath();
                    ctx.fill();

                    // Add shiny highlight
                    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
                    ctx.beginPath();
                    ctx.moveTo(centerX - gemSize / 8, centerY);
                    ctx.lineTo(centerX, centerY - gemSize / 4);
                    ctx.lineTo(centerX + gemSize / 8, centerY);
                    ctx.fill();
                    break;

                case 3: // Diamond
                    ctx.beginPath();
                    ctx.moveTo(centerX, centerY - gemSize / 2);
                    ctx.lineTo(centerX + gemSize / 2, centerY);
                    ctx.lineTo(centerX, centerY + gemSize / 2);
                    ctx.lineTo(centerX - gemSize / 2, centerY);
                    ctx.closePath();
                    ctx.fill();

                    // Add shiny highlight
                    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
                    ctx.beginPath();
                    ctx.moveTo(centerX - gemSize / 6, centerY - gemSize / 6);
                    ctx.lineTo(centerX, centerY - gemSize / 3);
                    ctx.lineTo(centerX + gemSize / 6, centerY - gemSize / 6);
                    ctx.fill();
                    break;

                case 4: // Star
                    const spikes = 5;
                    const outerRadius = gemSize / 2;
                    const innerRadius = gemSize / 4;

                    ctx.beginPath();

                    for (let i = 0; i < spikes * 2; i++) {
                        const radius = i % 2 === 0 ? outerRadius : innerRadius;
                        const angle = (Math.PI / spikes) * i + Math.PI / 2;
                        const pointX = centerX + Math.cos(angle) * radius;
                        const pointY = centerY + Math.sin(angle) * radius;

                        if (i === 0) {
                            ctx.moveTo(pointX, pointY);
                        } else {
                            ctx.lineTo(pointX, pointY);
                        }
                    }

                    ctx.closePath();
                    ctx.fill();

                    // Add shiny highlight
                    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
                    ctx.beginPath();
                    ctx.arc(centerX - gemSize / 8, centerY - gemSize / 8, gemSize / 12, 0, Math.PI * 2);
                    ctx.fill();
                    break;
            }

            // Reset shadow
            ctx.shadowBlur = 0;

            this.gemTemplates.push(canvas);
        }
    }

    private setupGameModeSelector(): void {
        const buttons = document.querySelectorAll('.mode-btn');
        const instructionsElement = document.getElementById('mode-instructions');

        if (!buttons || !instructionsElement) return;

        buttons.forEach(button => {
            button.addEventListener('click', (e) => {
                const target = e.currentTarget as HTMLElement;
                const mode = target.getAttribute('data-mode') as GameMode;

                if (mode && Object.values(GameMode).includes(mode)) {
                    // Don't change mode if animations are in progress
                    if (this.animating) return;

                    // Update UI
                    buttons.forEach(btn => btn.classList.remove('active'));
                    target.classList.add('active');

                    // Update game mode
                    this.gameMode = mode;

                    // Update instructions
                    switch (mode) {
                        case GameMode.CLASSIC:
                            instructionsElement.textContent = "Classic mode: Any matches of 3+ gems count.";
                            break;
                        case GameMode.EXACT3:
                            instructionsElement.textContent = "3-in-a-row mode: Only exact 3-gem matches count.";
                            break;
                        case GameMode.EXACT4:
                            instructionsElement.textContent = "4-in-a-row mode: Only exact 4-gem matches count.";
                            break;
                        case GameMode.EXACT5:
                            instructionsElement.textContent = "5-in-a-row mode: Only exact 5-gem matches count.";
                            break;
                    }

                    // Reset the game with the new mode
                    this.resetGame();
                }
            });
        });
    }

    private resetGame(): void {
        // Reset score
        this.score = 0;
        const scoreElement = document.querySelector('.score-value');
        if (scoreElement) {
            scoreElement.textContent = "0";
        }

        // Clear particles and combo texts
        this.particles = [];
        this.comboTexts = [];

        // Reset state
        this.selectedRow = -1;
        this.selectedCol = -1;
        this.isDragging = false;
        this.isLiveDragging = false;
        this.animating = false;
        this.dragTargetRow = -1;
        this.dragTargetCol = -1;
        this.matchesFound = 0;

        // Reinitialize the board with new gems
        this.initializeBoard();
    }

    // Game loop with optimized rendering
    private startGameLoop(): void {
        let lastUpdateTime = 0;
        const targetFPS = 60;
        const frameDuration = 1000 / targetFPS;

        const gameLoop = (timestamp: number): void => {
            // Calculate delta time
            if (!this.lastFrameTime) this.lastFrameTime = timestamp;
            const deltaTime = timestamp - this.lastFrameTime;
            this.lastFrameTime = timestamp;
            this.gameTime += deltaTime;

            // FPS calculation (every second)
            this.frameCount++;
            if (timestamp - this.lastFpsUpdate >= 1000) {
                this.fps = Math.round(this.frameCount * 1000 / (timestamp - this.lastFpsUpdate));
                this.frameCount = 0;
                this.lastFpsUpdate = timestamp;

            }

            // Update animations
            this.updateAnimations(deltaTime);

            // Render the game
            this.render();

            // Request next frame
            requestAnimationFrame(gameLoop);
        };

        requestAnimationFrame(gameLoop);
    }

    // Update all animations with optimized batching
    private updateAnimations(deltaTime: number): void {
        // Update particles with reduced calculations
        this.updateParticles(deltaTime);

        // Update combo texts with reduced calculations
        this.updateComboTexts(deltaTime);

        // Update gem animations with optimized calculations
        for (let row = 0; row < this.BOARD_SIZE; row++) {
            for (let col = 0; col < this.BOARD_SIZE; col++) {
                const anim = this.animationBoard[row][col];

                // Apply pulse effect to selected gem only when needed
                if (row === this.selectedRow && col === this.selectedCol && !this.isLiveDragging) {
                    anim.pulse = true;
                    // Use a simpler sine calculation for pulse
                    anim.scale = 1 + 0.08 * Math.sin(this.gameTime / 300);
                    anim.glow = true;
                } else if (anim.pulse || anim.glow || Math.abs(anim.scale - 1) > 0.01) {
                    // Only update animations that need changes
                    anim.pulse = false;
                    anim.glow = false;

                    // Smooth scale back to normal if not at 1
                    if (Math.abs(anim.scale - 1) > 0.01 && !this.isLiveDragging) {
                        anim.scale += (1 - anim.scale) * 0.2;
                        if (Math.abs(anim.scale - 1) < 0.01) anim.scale = 1;
                    }
                }

                // Apply shake effect only if needed
                if (anim.shake > 0) {
                    anim.offsetX = (Math.random() - 0.5) * anim.shake;
                    anim.offsetY = (Math.random() - 0.5) * anim.shake;
                    anim.shake *= 0.9;
                    if (anim.shake < 0.1) {
                        anim.shake = 0;
                        anim.offsetX = 0;
                        anim.offsetY = 0;
                    }
                } else if (!(row === this.selectedRow && col === this.selectedCol && this.isLiveDragging)) {
                    // Only reset if needed
                    if (anim.offsetX !== 0 || anim.offsetY !== 0) {
                        anim.offsetX = 0;
                        anim.offsetY = 0;
                    }
                }

                // Apply spin effect to star gems only (type 4)
                if (this.board[row][col] === 4 && anim.spinSpeed === 0) { // Star gem
                    anim.spinSpeed = 0.0005 + Math.random() * 0.001;
                }

                if (anim.spinSpeed > 0) {
                    anim.rotation += anim.spinSpeed * deltaTime;
                }
            }
        }

        // Update drag animation for the selected gem - only if dragging
        if (this.isLiveDragging && this.selectedRow >= 0 && this.selectedCol >= 0) {
            const anim = this.animationBoard[this.selectedRow][this.selectedCol];
            anim.offsetX = this.dragOffsetX;
            anim.offsetY = this.dragOffsetY;
        }
    }

    // Update particle effects with optimized physics
    private updateParticles(deltaTime: number): void {
        // Cap the number of particles for performance
        if (this.particles.length > this.MAX_PARTICLES) {
            this.particles.length = this.MAX_PARTICLES;
        }

        // Calculate common factor once for efficiency
        const deltaFactor = deltaTime * 0.05;

        // Update particles in batches for better performance
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const particle = this.particles[i];

            // Move particle with simplified physics
            particle.x += particle.vx * deltaFactor;
            particle.y += particle.vy * deltaFactor;

            // Update lifetime
            particle.life -= deltaTime;

            // Remove dead particles
            if (particle.life <= 0) {
                // Fast array removal by swapping with last element
                if (i < this.particles.length - 1) {
                    this.particles[i] = this.particles[this.particles.length - 1];
                }
                this.particles.pop();
            }
        }
    }

    // Update floating combo texts with optimized animations
    private updateComboTexts(deltaTime: number): void {
        const deltaFactor = deltaTime * 0.05;

        for (let i = this.comboTexts.length - 1; i >= 0; i--) {
            const text = this.comboTexts[i];

            // Update lifetime
            text.life -= deltaTime;

            // Move upward
            text.y -= deltaFactor;

            // Remove expired texts
            if (text.life <= 0) {
                // Fast array removal by swapping with last element
                if (i < this.comboTexts.length - 1) {
                    this.comboTexts[i] = this.comboTexts[this.comboTexts.length - 1];
                }
                this.comboTexts.pop();
            }
        }
    }

    // Create particle effects with reduced particle count
    private createParticles(row: number, col: number, gemType: GemType, count: number = 8): void {
        // Skip particles if we already have too many
        if (this.particles.length >= this.MAX_PARTICLES) return;

        // Limit the number of new particles based on current count
        const actualCount = Math.min(count, this.MAX_PARTICLES - this.particles.length);

        const centerX = col * this.GEM_SIZE + this.GEM_SIZE / 2;
        const centerY = row * this.GEM_SIZE + this.GEM_SIZE / 2;

        for (let i = 0; i < actualCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 1 + Math.random() * 3;

            this.particles.push({
                x: centerX,
                y: centerY,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                radius: 2 + Math.random() * 3,
                color: this.GEM_COLORS[gemType],
                life: 500 + Math.random() * 500
            });
        }
    }

    // Create floating combo text
    private createComboText(row: number, col: number, text: string, color: string): void {
        const centerX = col * this.GEM_SIZE + this.GEM_SIZE / 2;
        const centerY = row * this.GEM_SIZE;

        this.comboTexts.push({
            x: centerX,
            y: centerY,
            text: text,
            color: color,
            life: 1500,
            initialLife: 1500
        });
    }

    // Initialize the board with optimized startup animations
    private initializeBoard(): void {
        // Fill the board with random gems
        for (let row = 0; row < this.BOARD_SIZE; row++) {
            for (let col = 0; col < this.BOARD_SIZE; col++) {
                let validTypes: number[] = [0, 1, 2, 3, 4];

                // Remove types that would create matches
                if (row >= 2) {
                    if (this.board[row-1][col] === this.board[row-2][col]) {
                        validTypes = validTypes.filter(type => type !== this.board[row-1][col]);
                    }
                }

                if (col >= 2) {
                    if (this.board[row][col-1] === this.board[row][col-2]) {
                        validTypes = validTypes.filter(type => type !== this.board[row][col-1]);
                    }
                }

                // Pick a random valid type
                this.board[row][col] = validTypes[Math.floor(Math.random() * validTypes.length)] as GemType;

                // Set initial animation with scale effect
                const anim = this.animationBoard[row][col];
                anim.scale = 0;

                // Faster staggered animation for initial appearance
                const delay = (row * this.BOARD_SIZE + col) * 10; // Reduced from 20 for better startup

                setTimeout(() => {
                    anim.scale = 1.2;
                    setTimeout(() => {
                        anim.scale = 1;
                    }, 100); // Reduced from 150 for faster startup
                }, delay);
            }
        }
    }

    // Render the game with optimized drawing
    private render(): void {
        // Clear the offscreen canvas with a solid color for better performance
        this.offscreenCtx.fillStyle = "rgba(20, 22, 42, 1)";
        this.offscreenCtx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw the background grid
        this.drawGrid();

        // Draw each gem using pre-rendered templates
        for (let row = 0; row < this.BOARD_SIZE; row++) {
            for (let col = 0; col < this.BOARD_SIZE; col++) {
                const gemType = this.board[row][col];
                if (gemType !== null && gemType !== undefined) {
                    this.drawGem(row, col, gemType);
                }
            }
        }

        // Draw particles
        this.drawParticles();

        // Draw combo texts
        this.drawComboTexts();

        // Draw selection highlight if a gem is selected
        if (this.selectedRow !== -1 && this.selectedCol !== -1) {
            this.offscreenCtx.strokeStyle = "#FFFFFF";
            this.offscreenCtx.lineWidth = 3;

            // The highlight follows the gem when being dragged
            const offsetX = this.isLiveDragging ? this.dragOffsetX : 0;
            const offsetY = this.isLiveDragging ? this.dragOffsetY : 0;

            this.offscreenCtx.beginPath();
            this.offscreenCtx.roundRect(
                this.selectedCol * this.GEM_SIZE + 3 + offsetX,
                this.selectedRow * this.GEM_SIZE + 3 + offsetY,
                this.GEM_SIZE - 6,
                this.GEM_SIZE - 6,
                8
            );
            this.offscreenCtx.stroke();

            // Add glow effect to selected gem
            this.offscreenCtx.shadowBlur = 15;
            this.offscreenCtx.shadowColor = "#FFFFFF";
            this.offscreenCtx.strokeStyle = "rgba(255, 255, 255, 0.7)";
            this.offscreenCtx.stroke();
            this.offscreenCtx.shadowBlur = 0;
        }

        // Copy from offscreen canvas to visible canvas in one operation
        this.ctx.drawImage(this.offscreenCanvas, 0, 0);
    }

    // Draw the background grid with optimized rendering
    private drawGrid(): void {
        // Draw grid cells using direct rectangles instead of rounded rects for better performance
        for (let row = 0; row < this.BOARD_SIZE; row++) {
            for (let col = 0; col < this.BOARD_SIZE; col++) {
                // Alternating pattern
                if ((row + col) % 2 === 0) {
                    this.offscreenCtx.fillStyle = "rgba(35, 38, 65, 0.6)";
                } else {
                    this.offscreenCtx.fillStyle = "rgba(45, 48, 75, 0.6)";
                }

                // Highlight possible drop target during drag
                if (this.isLiveDragging && row === this.dragTargetRow && col === this.dragTargetCol) {
                    this.offscreenCtx.fillStyle = "rgba(70, 80, 120, 0.7)";
                }

                // Use fillRect instead of path operations for better performance
                this.offscreenCtx.fillRect(
                    col * this.GEM_SIZE + 1,
                    row * this.GEM_SIZE + 1,
                    this.GEM_SIZE - 2,
                    this.GEM_SIZE - 2
                );
            }
        }
    }

    // Draw particles with batched rendering
    private drawParticles(): void {
        // Skip if no particles
        if (this.particles.length === 0) return;

        // Disable shadow effects for particles for better performance
        this.offscreenCtx.shadowBlur = 0;

        for (const particle of this.particles) {
            this.offscreenCtx.fillStyle = particle.color;
            this.offscreenCtx.globalAlpha = Math.min(1, particle.life / 300);

            // Use faster arc drawing without beginPath for performance
            this.offscreenCtx.beginPath();
            this.offscreenCtx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
            this.offscreenCtx.fill();
        }

        this.offscreenCtx.globalAlpha = 1;
    }

    // Draw combo texts with optimized rendering
    private drawComboTexts(): void {
        // Skip if no texts
        if (this.comboTexts.length === 0) return;

        this.offscreenCtx.textAlign = "center";
        this.offscreenCtx.font = "bold 20px Poppins";
        this.offscreenCtx.shadowColor = "rgba(0, 0, 0, 0.5)";

        for (const text of this.comboTexts) {
            this.offscreenCtx.fillStyle = text.color;
            this.offscreenCtx.globalAlpha = Math.min(1, text.life / text.initialLife);

            // Apply shadow effect only once for better performance
            this.offscreenCtx.shadowBlur = 4;
            this.offscreenCtx.fillText(text.text, text.x, text.y);
        }

        // Reset shadow and opacity
        this.offscreenCtx.shadowBlur = 0;
        this.offscreenCtx.globalAlpha = 1;
    }

    // Draw an individual gem using pre-rendered templates
    private drawGem(row: number, col: number, type: GemType): void {
        const anim = this.animationBoard[row][col];
        const x = col * this.GEM_SIZE + anim.offsetX;
        const y = row * this.GEM_SIZE + anim.offsetY;
        const centerX = x + this.GEM_SIZE / 2;
        const centerY = y + this.GEM_SIZE / 2;

        // Skip rendering if outside of visible area (optimization)
        if (centerX < -this.GEM_SIZE || centerY < -this.GEM_SIZE ||
            centerX > this.canvas.width + this.GEM_SIZE || centerY > this.canvas.height + this.GEM_SIZE) {
            return;
        }

        // Apply rotation transform if needed
        this.offscreenCtx.save();

        // Only apply transformations if needed
        const needsTransform = anim.scale !== 1 || anim.rotation !== 0;

        if (needsTransform) {
            this.offscreenCtx.translate(centerX, centerY);

            if (anim.rotation !== 0) {
                this.offscreenCtx.rotate(anim.rotation);
            }

            if (anim.scale !== 1) {
                this.offscreenCtx.scale(anim.scale, anim.scale);
            }

            this.offscreenCtx.translate(-centerX, -centerY);
        }

        // Enhanced glow for selected or special gems
        if (anim.glow) {
            this.offscreenCtx.shadowBlur = 15;
            this.offscreenCtx.shadowColor = "#FFFFFF";
        } else {
            this.offscreenCtx.shadowBlur = 0;
        }

        // Apply opacity
        if (anim.opacity !== 1) {
            this.offscreenCtx.globalAlpha = anim.opacity;
        }

        // Use pre-rendered gem template for better performance
        const templateCanvas = this.gemTemplates[type];
        if (templateCanvas) {
            const size = this.GEM_SIZE;
            const scaledSize = size * (needsTransform ? 1 : anim.scale);
            const offsetX = (size - scaledSize) / 2;

            this.offscreenCtx.drawImage(
                templateCanvas,
                x + (needsTransform ? 0 : offsetX),
                y + (needsTransform ? 0 : offsetX),
                needsTransform ? size : scaledSize,
                needsTransform ? size : scaledSize
            );
        }

        // Reset transformations
        this.offscreenCtx.restore();

        // Reset shadow and opacity
        this.offscreenCtx.shadowBlur = 0;
        this.offscreenCtx.globalAlpha = 1;
    }

    // Handle touch start event
    private handleTouchStart(event: TouchEvent): void {
        event.preventDefault();
        if (this.animating) return;

        const touch = event.touches[0];
        const rect = this.canvas.getBoundingClientRect();
        const col = Math.floor((touch.clientX - rect.left) / this.GEM_SIZE);
        const row = Math.floor((touch.clientY - rect.top) / this.GEM_SIZE);

        if (this.isValidPosition(row, col)) {
            this.isDragging = true;
            this.selectedRow = row;
            this.selectedCol = col;
            this.isLiveDragging = true;
            this.dragOffsetX = 0;
            this.dragOffsetY = 0;
        }
    }

    // Handle touch move event
    private handleTouchMove(event: TouchEvent): void {
        event.preventDefault();
        if (!this.isDragging || this.animating) return;

        const touch = event.touches[0];
        const rect = this.canvas.getBoundingClientRect();

        // Calculate drag offset
        const touchX = touch.clientX - rect.left;
        const touchY = touch.clientY - rect.top;
        const gemCenterX = (this.selectedCol + 0.5) * this.GEM_SIZE;
        const gemCenterY = (this.selectedRow + 0.5) * this.GEM_SIZE;

        // Limit drag distance
        let offsetX = touchX - gemCenterX;
        let offsetY = touchY - gemCenterY;

        // Find drag direction and potential target
        this.calculateDragTarget(offsetX, offsetY);

        // Limit drag to one direction (horizontal or vertical)
        if (Math.abs(offsetX) > Math.abs(offsetY)) {
            offsetY = 0;
            offsetX = Math.max(-this.GEM_SIZE / 2, Math.min(this.GEM_SIZE / 2, offsetX));
        } else {
            offsetX = 0;
            offsetY = Math.max(-this.GEM_SIZE / 2, Math.min(this.GEM_SIZE / 2, offsetY));
        }

        this.dragOffsetX = offsetX;
        this.dragOffsetY = offsetY;
    }

    // Handle touch end event
    private handleTouchEnd(event: TouchEvent): void {
        event.preventDefault();
        if (!this.isDragging || this.animating) return;

        if (this.dragTargetRow !== -1 && this.dragTargetCol !== -1) {
            // Complete the swap
            this.handleSwap(this.dragTargetRow, this.dragTargetCol);
        } else {
            // Reset drag state
            this.resetDragState();
        }
    }

    // Handle mouse down event (start dragging)
    private handleMouseDown(event: MouseEvent): void {
        event.preventDefault();
        if (this.animating) return;

        const rect = this.canvas.getBoundingClientRect();
        const col = Math.floor((event.clientX - rect.left) / this.GEM_SIZE);
        const row = Math.floor((event.clientY - rect.top) / this.GEM_SIZE);

        if (this.isValidPosition(row, col)) {
            this.isDragging = true;
            this.selectedRow = row;
            this.selectedCol = col;
            this.isLiveDragging = true;
            this.dragOffsetX = 0;
            this.dragOffsetY = 0;
            this.mouseX = event.clientX;
            this.mouseY = event.clientY;
        }
    }

    // Handle mouse move event
    private handleMouseMove(event: MouseEvent): void {
        if (this.animating) return;

        const rect = this.canvas.getBoundingClientRect();
        const col = Math.floor((event.clientX - rect.left) / this.GEM_SIZE);
        const row = Math.floor((event.clientY - rect.top) / this.GEM_SIZE);

        if (this.isValidPosition(row, col)) {
            this.canvas.style.cursor = 'pointer';
        } else {
            this.canvas.style.cursor = 'default';
        }

        // Update the dragged gem position
        if (this.isDragging && this.isLiveDragging) {
            const gemCenterX = (this.selectedCol + 0.5) * this.GEM_SIZE;
            const gemCenterY = (this.selectedRow + 0.5) * this.GEM_SIZE;

            // Calculate drag offset from gem's center
            let offsetX = event.clientX - rect.left - gemCenterX;
            let offsetY = event.clientY - rect.top - gemCenterY;

            // Find drag direction and potential target
            this.calculateDragTarget(offsetX, offsetY);

            // Limit drag to one direction (horizontal or vertical)
            if (Math.abs(offsetX) > Math.abs(offsetY)) {
                offsetY = 0;
                offsetX = Math.max(-this.GEM_SIZE / 2, Math.min(this.GEM_SIZE / 2, offsetX));
            } else {
                offsetX = 0;
                offsetY = Math.max(-this.GEM_SIZE / 2, Math.min(this.GEM_SIZE / 2, offsetY));
            }

            this.dragOffsetX = offsetX;
            this.dragOffsetY = offsetY;

            this.mouseX = event.clientX;
            this.mouseY = event.clientY;
        }
    }

    // Calculate drag target based on offset
    private calculateDragTarget(offsetX: number, offsetY: number): void {
        this.dragTargetRow = -1;
        this.dragTargetCol = -1;

        // Determine drag direction and calculate target position
        if (Math.abs(offsetX) > Math.abs(offsetY)) {
            // Horizontal drag
            if (offsetX > this.GEM_SIZE / 4 && this.selectedCol < this.BOARD_SIZE - 1) {
                this.dragTargetRow = this.selectedRow;
                this.dragTargetCol = this.selectedCol + 1;
            } else if (offsetX < -this.GEM_SIZE / 4 && this.selectedCol > 0) {
                this.dragTargetRow = this.selectedRow;
                this.dragTargetCol = this.selectedCol - 1;
            }
        } else {
            // Vertical drag
            if (offsetY > this.GEM_SIZE / 4 && this.selectedRow < this.BOARD_SIZE - 1) {
                this.dragTargetRow = this.selectedRow + 1;
                this.dragTargetCol = this.selectedCol;
            } else if (offsetY < -this.GEM_SIZE / 4 && this.selectedRow > 0) {
                this.dragTargetRow = this.selectedRow - 1;
                this.dragTargetCol = this.selectedCol;
            }
        }
    }

    // Reset drag state
    private resetDragState(): void {
        // Animate the selected gem back to its position
        if (this.selectedRow >= 0 && this.selectedCol >= 0) {
            const anim = this.animationBoard[this.selectedRow][this.selectedCol];

            // Animate back to original position with fewer steps
            const steps = 3; // Reduced from 5
            let step = 0;

            const animate = () => {
                step++;

                // Ease back to original position
                anim.offsetX = this.dragOffsetX * (1 - step / steps);
                anim.offsetY = this.dragOffsetY * (1 - step / steps);

                if (step < steps) {
                    setTimeout(animate, 10);
                } else {
                    anim.offsetX = 0;
                    anim.offsetY = 0;
                    this.isLiveDragging = false;
                }
            };

            animate();
        }

        this.selectedRow = -1;
        this.selectedCol = -1;
        this.isDragging = false;
        this.dragTargetRow = -1;
        this.dragTargetCol = -1;
    }

    // Handle mouse up event (end dragging)
    private handleMouseUp(event: MouseEvent): void {
        if (!this.isDragging || this.animating) return;

        if (this.dragTargetRow !== -1 && this.dragTargetCol !== -1) {
            // Complete the swap
            this.handleSwap(this.dragTargetRow, this.dragTargetCol);
        } else {
            // Reset drag state
            this.resetDragState();
        }
    }

    // Handle the gem swap
    private handleSwap(targetRow: number, targetCol: number): void {
        this.animating = true;

        // Complete the swap animation
        this.swapGems(this.selectedRow, this.selectedCol, targetRow, targetCol);

        // Check if the swap created any matches
        setTimeout(() => {
            const matches = this.findMatches();

            if (matches.length > 0) {
                this.processMatches(matches);
            } else {
                // If no matches, swap back with shake animation
                setTimeout(() => {
                    this.swapGems(targetRow, targetCol, this.selectedRow, this.selectedCol);

                    // Add shake effect to both gems
                    this.animationBoard[this.selectedRow][this.selectedCol].shake = 5;
                    this.animationBoard[targetRow][targetCol].shake = 5;

                    // Reset state
                    this.selectedRow = -1;
                    this.selectedCol = -1;
                    this.isDragging = false;
                    this.isLiveDragging = false;
                    this.animating = false;
                    this.dragTargetRow = -1;
                    this.dragTargetCol = -1;
                }, this.ANIMATION_SPEED);
            }
        }, this.ANIMATION_SPEED);
    }

    // Check if a position is valid
    private isValidPosition(row: number, col: number): boolean {
        return row >= 0 && row < this.BOARD_SIZE && col >= 0 && col < this.BOARD_SIZE;
    }

    // Check if two positions are adjacent
    private isAdjacent(row1: number, col1: number, row2: number, col2: number): boolean {
        const rowDiff = Math.abs(row1 - row2);
        const colDiff = Math.abs(col1 - col2);

        return (rowDiff === 1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1);
    }

    // Swap two gems with optimized animation
    private swapGems(row1: number, col1: number, row2: number, col2: number): void {
        // Animate the swap
        const anim1 = this.animationBoard[row1][col1];
        const anim2 = this.animationBoard[row2][col2];

        // Calculate the direction of movement
        const dx = col2 - col1;
        const dy = row2 - row1;

        // Set initial offsets for animation (handle live dragging case)
        if (this.isLiveDragging) {
            // The dragged gem is already partially on the way
            anim2.offsetX = -dx * this.GEM_SIZE;
            anim2.offsetY = -dy * this.GEM_SIZE;
        } else {
            anim1.offsetX = 0;
            anim1.offsetY = 0;
            anim2.offsetX = -dx * this.GEM_SIZE;
            anim2.offsetY = -dy * this.GEM_SIZE;
        }

        // First update the board data
        const temp = this.board[row1][col1];
        this.board[row1][col1] = this.board[row2][col2];
        this.board[row2][col2] = temp;

        // Animate the transition with fewer steps
        const steps = 8; // Reduced from 10
        let step = 0;

        const animate = () => {
            step++;

            // Calculate animation progress (ease out)
            const progress = 1 - Math.pow(1 - step / steps, 3);

            // Update offsets
            if (this.isLiveDragging) {
                // For the dragged gem, continue from current position
                anim1.offsetX = this.dragOffsetX + (dx * this.GEM_SIZE - this.dragOffsetX) * progress;
                anim1.offsetY = this.dragOffsetY + (dy * this.GEM_SIZE - this.dragOffsetY) * progress;
            } else {
                anim1.offsetX = dx * this.GEM_SIZE * progress;
                anim1.offsetY = dy * this.GEM_SIZE * progress;
            }

            anim2.offsetX = -dx * this.GEM_SIZE * (1 - progress);
            anim2.offsetY = -dy * this.GEM_SIZE * (1 - progress);

            // Continue animation until complete
            if (step < steps) {
                setTimeout(animate, this.ANIMATION_SPEED / steps);
            } else {
                // Reset offsets when animation is complete
                anim1.offsetX = 0;
                anim1.offsetY = 0;
                anim2.offsetX = 0;
                anim2.offsetY = 0;

                // Swap animation states too
                const tempAnim = {...this.animationBoard[row1][col1]};
                this.animationBoard[row1][col1] = {...this.animationBoard[row2][col2]};
                this.animationBoard[row2][col2] = {...tempAnim};

                this.isLiveDragging = false;
            }
        };

        // Start animation
        animate();
    }

    // Find all matches on the board with optimized algorithm
    private findMatches(): MatchPosition[][] {
        const allMatches: MatchPosition[][] = [];
        const visited = new Set<string>(); // Track visited positions for optimization

        // Check horizontal matches with optimization
        for (let row = 0; row < this.BOARD_SIZE; row++) {
            let currentType: GemType | null = null;
            let matchLength = 1;
            let matchStart = 0;

            for (let col = 0; col < this.BOARD_SIZE; col++) {
                const key = `${row},${col}`;
                if (visited.has(key)) continue;

                if (this.board[row][col] === currentType && currentType !== null) {
                    matchLength++;
                } else {
                    if (matchLength >= 3) {
                        const match: MatchPosition[] = [];
                        for (let i = 0; i < matchLength; i++) {
                            const pos = {row, col: matchStart + i};
                            match.push(pos);
                            visited.add(`${pos.row},${pos.col}`);
                        }
                        allMatches.push(match);
                    }

                    currentType = this.board[row][col];
                    matchLength = 1;
                    matchStart = col;
                }
            }

            // Check if a match ends at the right edge
            if (matchLength >= 3) {
                const match: MatchPosition[] = [];
                for (let i = 0; i < matchLength; i++) {
                    const pos = {row, col: matchStart + i};
                    match.push(pos);
                    visited.add(`${pos.row},${pos.col}`);
                }
                allMatches.push(match);
            }
        }

        // Check vertical matches with optimization
        for (let col = 0; col < this.BOARD_SIZE; col++) {
            let currentType: GemType | null = null;
            let matchLength = 1;
            let matchStart = 0;

            for (let row = 0; row < this.BOARD_SIZE; row++) {
                const key = `${row},${col}`;
                if (visited.has(key)) continue;

                if (this.board[row][col] === currentType && currentType !== null) {
                    matchLength++;
                } else {
                    if (matchLength >= 3) {
                        const match: MatchPosition[] = [];
                        for (let i = 0; i < matchLength; i++) {
                            const pos = {row: matchStart + i, col};
                            match.push(pos);
                            visited.add(`${pos.row},${pos.col}`);
                        }
                        allMatches.push(match);
                    }

                    currentType = this.board[row][col];
                    matchLength = 1;
                    matchStart = row;
                }
            }

            // Check if a match ends at the bottom edge
            if (matchLength >= 3) {
                const match: MatchPosition[] = [];
                for (let i = 0; i < matchLength; i++) {
                    const pos = {row: matchStart + i, col};
                    match.push(pos);
                    visited.add(`${pos.row},${pos.col}`);
                }
                allMatches.push(match);
            }
        }

        // Filter matches based on game mode
        const filteredMatches = allMatches.filter(match => {
            switch (this.gameMode) {
                case GameMode.CLASSIC:
                    return true; // Accept all matches
                case GameMode.EXACT3:
                    return match.length === 3;
                case GameMode.EXACT4:
                    return match.length === 4;
                case GameMode.EXACT5:
                    return match.length === 5;
                default:
                    return true;
            }
        });

        return filteredMatches;
    }


    // Process matches, remove gems, and calculate score with optimized animations
    private processMatches(matches: MatchPosition[][]): void {
        // Remove matched gems
        this.matchesFound += matches.length;

        matches.forEach(match => {
            // Update score based on match length
            const matchLength = match.length;
            let points = 0;

            switch (matchLength) {
                case 3:
                    points = this.gameMode === GameMode.EXACT3 ? 50 : 30; // Bonus for exact3 mode
                    break;
                case 4:
                    points = this.gameMode === GameMode.EXACT4 ? 100 : 60; // Bonus for exact4 mode
                    break;
                case 5:
                    points = this.gameMode === GameMode.EXACT5 ? 200 : 100; // Bonus for exact5 mode
                    break;
                default:
                    points = matchLength * 20;
            }

            // Bonus points for cascading matches
            if (this.matchesFound > 1) {
                points *= (1 + (this.matchesFound - 1) * 0.5);
            }

            this.score += Math.floor(points);
            const scoreElement = document.querySelector('.score-value');
            if (scoreElement) {
                scoreElement.textContent = this.score.toString();

                // Явно приводим к HTMLElement перед использованием свойств DOM
                const htmlScoreElement = scoreElement as HTMLElement;
                htmlScoreElement.style.animation = 'none';
                // Используем явное приведение типа
                void htmlScoreElement.offsetWidth; // Trigger reflow
                htmlScoreElement.style.animation = 'pop 0.3s ease';
            }


            // Create combo text
            if (match.length > 0) {
                const middlePos = match[Math.floor(match.length / 2)];
                let comboText = "";

                if (matchLength >= 5) {
                    comboText = "AWESOME!";
                } else if (matchLength === 4) {
                    comboText = "GREAT!";
                } else {
                    comboText = "+" + Math.floor(points);
                }

                this.createComboText(middlePos.row, middlePos.col, comboText, "#FFC107");
            }

            // Remove gems with explosion animation
            match.forEach(pos => {
                // Get gem type before removal for particle effects
                const gemType = this.board[pos.row][pos.col];
                if (gemType !== null) {
                    // Create particle explosion with fewer particles
                    this.createParticles(pos.row, pos.col, gemType, 10);

                    // Animate gem disappearance
                    const anim = this.animationBoard[pos.row][pos.col];
                    anim.scale = 1.5; // Expand
                    anim.opacity = 0.8; // Start fading

                    // Actually remove the gem from board data (with delay)
                    setTimeout(() => {
                        anim.scale = 0;
                        anim.opacity = 0;
                        this.board[pos.row][pos.col] = null;
                    }, 100); // Reduced from 150
                }
            });
        });

        // After a delay, make gems fall and fill empty spaces
        setTimeout(() => {
            this.dropGems();

            setTimeout(() => {
                this.fillEmptySpaces();

                // Check for cascading matches after a proper delay
                setTimeout(() => {
                    const newMatches = this.findMatches();
                    if (newMatches.length > 0) {
                        this.processMatches(newMatches);
                    } else {
                        // Reset matching state
                        this.matchesFound = 0;
                        this.selectedRow = -1;
                        this.selectedCol = -1;
                        this.isDragging = false;
                        this.isLiveDragging = false;
                        this.animating = false;
                        this.dragTargetRow = -1;
                        this.dragTargetCol = -1;
                    }
                }, this.ANIMATION_SPEED);
            }, this.ANIMATION_SPEED * 1.2);
        }, this.ANIMATION_SPEED * 1.5);
    }

    private dropGems(): void {
        // For each column, find the lowest empty space and drop gems down to fill it
        for (let col = 0; col < this.BOARD_SIZE; col++) {
            let emptySpaces = 0;

            // Process from bottom to top
            for (let row = this.BOARD_SIZE - 1; row >= 0; row--) {
                if (this.board[row][col] === null) {
                    emptySpaces++;
                } else if (emptySpaces > 0) {
                    // This gem needs to drop down by 'emptySpaces' positions
                    const targetRow = row + emptySpaces;

                    // Store the gem type to move
                    const gemType = this.board[row][col];

                    // Move the gem data
                    this.board[targetRow][col] = gemType;
                    this.board[row][col] = null;

                    // Move gem animation state
                    const anim = this.animationBoard[row][col];

                    // Use a closure to capture current values for the animation
                    ((currentRow: number, targetRow: number, currentAnim: AnimationState) => {
                        // Animate the drop with fewer steps
                        const distance = (targetRow - currentRow) * this.GEM_SIZE;
                        const steps = 8; // Reduced from 10
                        let step = 0;

                        // Set target animation to same values
                        this.animationBoard[targetRow][col] = {...currentAnim, offsetY: -distance};

                        // Make original position invisible
                        currentAnim.opacity = 0;

                        const animate = () => {
                            step++;
                            const progress = 1 - Math.pow(1 - step / steps, 2); // Ease out

                            // Animate target position
                            this.animationBoard[targetRow][col].offsetY = -distance * (1 - progress);

                            if (step < steps) {
                                setTimeout(animate, 12); // Faster animation
                            } else {
                                this.animationBoard[targetRow][col].offsetY = 0;
                            }
                        };

                        animate();
                    })(row, targetRow, {...anim});
                }
            }
        }
    }

    // Fill empty spaces with new random gems with optimized animation
    private fillEmptySpaces(): void {
        for (let col = 0; col < this.BOARD_SIZE; col++) {
            // Count empty spaces at the top of the column
            let emptyCount = 0;
            for (let row = 0; row < this.BOARD_SIZE; row++) {
                if (this.board[row][col] === null) {
                    emptyCount++;

                    // Create a new gem
                    this.board[row][col] = Math.floor(Math.random() * this.GEM_TYPES) as GemType;

                    // Animate new gem appearing from top
                    const anim = this.animationBoard[row][col];
                    anim.scale = 0.5;
                    anim.offsetY = -(emptyCount + 1) * this.GEM_SIZE;
                    anim.opacity = 1;

                    // Staggered animation for a more natural feel but faster overall
                    ((currentRow: number, fallingDistance: number) => {
                        setTimeout(() => {
                            // Animate drop and scale with fewer steps
                            const steps = 8; // Reduced from 12
                            let step = 0;

                            const animate = () => {
                                step++;
                                const progress = 1 - Math.pow(1 - step / steps, 2); // Ease out

                                this.animationBoard[currentRow][col].offsetY = -fallingDistance * (1 - progress);
                                this.animationBoard[currentRow][col].scale = 0.5 + (1 - 0.5) * progress;

                                if (step < steps) {
                                    setTimeout(animate, 12); // Faster animation
                                } else {
                                    // Ensure final state is clean
                                    this.animationBoard[currentRow][col].offsetY = 0;
                                    this.animationBoard[currentRow][col].scale = 1;

                                    // Add a little bounce
                                    setTimeout(() => {
                                        this.animationBoard[currentRow][col].scale = 1.1;
                                        setTimeout(() => {
                                            this.animationBoard[currentRow][col].scale = 1;
                                        }, 80); // Faster bounce
                                    }, 40); // Faster delay
                                }
                            };

                            animate();
                        }, col * 20); // Faster stagger by column
                    })(row, (emptyCount + 1) * this.GEM_SIZE);
                }
            }
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Create background particles
    createParticles();

    // Start the game
    new Match3Game();

    // Add score animation
    const scoreElement = document.getElementById('score');
    if (scoreElement) {
        // Add glow effect to score container when score changes
        scoreElement.addEventListener('animationend', () => {
            const scoreContainer = document.querySelector('.score-container');
            if (scoreContainer) {
                const htmlScoreContainer = scoreContainer as HTMLElement;
                htmlScoreContainer.style.animation = 'glow 1.5s ease';
                setTimeout(() => {
                    htmlScoreContainer.style.animation = '';
                }, 1500);
            }
        });
    }
});

