var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var GameMode;
(function (GameMode) {
    GameMode["CLASSIC"] = "classic";
    GameMode["EXACT3"] = "exact3";
    GameMode["EXACT4"] = "exact4";
    GameMode["EXACT5"] = "exact5";
})(GameMode || (GameMode = {}));
// Create background particles with reduced count for better performance
function createParticles() {
    var container = document.getElementById('particles');
    if (!container)
        return;
    var colors = ['#FF5252', '#448AFF', '#4CAF50', '#FFC107', '#9C27B0'];
    var particleCount = 25; // Reduced from 50
    // Create particles in a documentFragment for better performance
    var fragment = document.createDocumentFragment();
    for (var i = 0; i < particleCount; i++) {
        var particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = "".concat(Math.random() * 100, "%");
        particle.style.top = "".concat(Math.random() * 100, "%");
        particle.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        particle.style.animationDuration = "".concat(20 + Math.random() * 30, "s");
        particle.style.animationDelay = "".concat(Math.random() * 5, "s");
        fragment.appendChild(particle);
    }
    container.appendChild(fragment);
}
// Add polyfill for roundRect if not available in the browser
if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, width, height, radius) {
        if (width < 2 * radius)
            radius = width / 2;
        if (height < 2 * radius)
            radius = height / 2;
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
var Match3Game = /** @class */ (function () {
    function Match3Game() {
        var _this = this;
        // Game board dimensions
        this.BOARD_SIZE = 8;
        this.GEM_TYPES = 5;
        this.GEM_SIZE = 50; // Size in pixels
        this.ANIMATION_SPEED = 250; // Animation speed in ms
        this.MAX_PARTICLES = 75; // Cap max particles for performance
        this.isDragging = false;
        this.selectedRow = -1;
        this.selectedCol = -1;
        this.score = 0;
        this.animating = false;
        this.matchesFound = 0;
        this.gameTime = 0;
        this.lastFrameTime = 0;
        this.particles = [];
        this.comboTexts = [];
        this.gemTemplates = []; // Pre-rendered gem templates
        this.mouseX = 0;
        this.mouseY = 0;
        this.dragOffsetX = 0;
        this.dragOffsetY = 0;
        this.dragTargetRow = -1;
        this.dragTargetCol = -1;
        this.isLiveDragging = false;
        this.frameCount = 0;
        this.fps = 0;
        this.lastFpsUpdate = 0;
        this.gameMode = GameMode.CLASSIC;
        this.GEM_COLORS = [
            "#FF5252", // Red
            "#448AFF", // Blue
            "#4CAF50", // Green
            "#FFC107", // Yellow
            "#9C27B0" // Purple
        ];
        // Shapes for gems (0: circle, 1: square, 2: triangle, 3: diamond, 4: star)
        this.GEM_SHAPES = [0, 1, 2, 3, 4];
        // Create the canvas element
        this.canvas = document.createElement('canvas');
        this.canvas.width = this.BOARD_SIZE * this.GEM_SIZE;
        this.canvas.height = this.BOARD_SIZE * this.GEM_SIZE;
        var canvasContainer = document.getElementById('canvas-container');
        if (!canvasContainer) {
            throw new Error("Canvas container not found");
        }
        canvasContainer.appendChild(this.canvas);
        // Create an offscreen canvas for better performance
        this.offscreenCanvas = document.createElement('canvas');
        this.offscreenCanvas.width = this.BOARD_SIZE * this.GEM_SIZE;
        this.offscreenCanvas.height = this.BOARD_SIZE * this.GEM_SIZE;
        // Get the rendering contexts with optimization flags
        var ctx = this.canvas.getContext('2d', { alpha: false });
        var offscreenCtx = this.offscreenCanvas.getContext('2d', { alpha: false });
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
            .map(function () { return Array(_this.BOARD_SIZE).fill(null); });
        // Initialize animation board
        this.animationBoard = Array(this.BOARD_SIZE).fill(null)
            .map(function () { return Array(_this.BOARD_SIZE).fill(null)
            .map(function () { return ({
            scale: 1,
            rotation: 0,
            opacity: 1,
            offsetX: 0,
            offsetY: 0,
            shake: 0,
            pulse: false,
            glow: false,
            spinSpeed: 0
        }); }); });
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
        this.canvas.style.animation = "fadeIn 0.8s ease forwards";
    }
    // Pre-render gem templates for faster drawing
    Match3Game.prototype.createGemTemplates = function () {
        this.gemTemplates = [];
        var size = this.GEM_SIZE;
        for (var type = 0; type < this.GEM_TYPES; type++) {
            var canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            var ctx = canvas.getContext('2d');
            if (!ctx)
                continue;
            // Main gem color
            ctx.fillStyle = this.GEM_COLORS[type];
            var centerX = size / 2;
            var centerY = size / 2;
            var gemSize = size * 0.7;
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
                    var spikes = 5;
                    var outerRadius = gemSize / 2;
                    var innerRadius = gemSize / 4;
                    ctx.beginPath();
                    for (var i = 0; i < spikes * 2; i++) {
                        var radius = i % 2 === 0 ? outerRadius : innerRadius;
                        var angle = (Math.PI / spikes) * i + Math.PI / 2;
                        var pointX = centerX + Math.cos(angle) * radius;
                        var pointY = centerY + Math.sin(angle) * radius;
                        if (i === 0) {
                            ctx.moveTo(pointX, pointY);
                        }
                        else {
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
    };
    Match3Game.prototype.setupGameModeSelector = function () {
        var _this = this;
        var buttons = document.querySelectorAll('.mode-btn');
        var instructionsElement = document.getElementById('mode-instructions');
        if (!buttons || !instructionsElement) {
            console.error("Не знайдено кнопки режиму гри або елемент інструкцій");
            return;
        }
        console.log("Ініціалізація селектора режиму гри");
        console.log("Поточний режим гри:", this.gameMode);
        console.log("Доступні режими:", Object.values(GameMode));
        // Встановлюємо початковий активний стан на основі поточного режиму
        buttons.forEach(function (button) {
            var buttonMode = button.getAttribute('data-mode');
            console.log("Перевірка кнопки:", buttonMode);
            if (buttonMode === _this.gameMode) {
                button.classList.add('active');
            }
            else {
                button.classList.remove('active');
            }
        });
        buttons.forEach(function (button) {
            var _a;
            // Видаляємо існуючі обробники подій для уникнення дублювання
            var newButton = button.cloneNode(true);
            (_a = button.parentNode) === null || _a === void 0 ? void 0 : _a.replaceChild(newButton, button);
            newButton.addEventListener('click', function (e) {
                var target = e.currentTarget;
                var modeAttr = target.getAttribute('data-mode');
                console.log("Натиснуто кнопку, режим:", modeAttr);
                // Пряма перевірка режиму гри за значенням
                if (modeAttr === 'classic' || modeAttr === 'exact3' ||
                    modeAttr === 'exact4' || modeAttr === 'exact5') {
                    // Не змінюємо режим під час анімацій
                    if (_this.animating) {
                        console.log("Неможливо змінити режим під час анімацій");
                        return;
                    }
                    console.log("\u0417\u043C\u0456\u043D\u0430 \u0440\u0435\u0436\u0438\u043C\u0443 \u0433\u0440\u0438 \u043D\u0430: ".concat(modeAttr));
                    // Оновлюємо UI
                    buttons.forEach(function (btn) { return btn.classList.remove('active'); });
                    target.classList.add('active');
                    // Оновлюємо режим гри, використовуючи пряме приведення типу
                    _this.gameMode = modeAttr;
                    // Оновлюємо інструкції
                    if (instructionsElement) {
                        switch (modeAttr) {
                            case 'classic':
                                instructionsElement.textContent = "Класичний режим: Будь-які збіги 3+ елементів зараховуються.";
                                break;
                            case 'exact3':
                                instructionsElement.textContent = "Режим '3 в ряд': Тільки точні збіги з 3 елементів зараховуються.";
                                break;
                            case 'exact4':
                                instructionsElement.textContent = "Режим '4 в ряд': Тільки точні збіги з 4 елементів зараховуються.";
                                break;
                            case 'exact5':
                                instructionsElement.textContent = "Режим '5 в ряд': Тільки точні збіги з 5 елементів зараховуються.";
                                break;
                        }
                    }
                    // Скидаємо гру до нового режиму
                    _this.resetGame();
                }
                else {
                    console.error("\u041D\u0435\u0434\u0456\u0439\u0441\u043D\u0438\u0439 \u0440\u0435\u0436\u0438\u043C \u0433\u0440\u0438: ".concat(modeAttr));
                }
            });
        });
    };
    Match3Game.prototype.resetGame = function () {
        // Reset score
        this.score = 0;
        var scoreElement = document.querySelector('.score-value');
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
    };
    // Game loop with optimized rendering
    Match3Game.prototype.startGameLoop = function () {
        var _this = this;
        var lastUpdateTime = 0;
        var targetFPS = 60;
        var frameDuration = 1000 / targetFPS;
        var gameLoop = function (timestamp) {
            // Calculate delta time
            if (!_this.lastFrameTime)
                _this.lastFrameTime = timestamp;
            var deltaTime = timestamp - _this.lastFrameTime;
            _this.lastFrameTime = timestamp;
            _this.gameTime += deltaTime;
            // FPS calculation (every second)
            _this.frameCount++;
            if (timestamp - _this.lastFpsUpdate >= 1000) {
                _this.fps = Math.round(_this.frameCount * 1000 / (timestamp - _this.lastFpsUpdate));
                _this.frameCount = 0;
                _this.lastFpsUpdate = timestamp;
            }
            // Update animations
            _this.updateAnimations(deltaTime);
            // Render the game
            _this.render();
            // Request next frame
            requestAnimationFrame(gameLoop);
        };
        requestAnimationFrame(gameLoop);
    };
    // Update all animations with optimized batching
    Match3Game.prototype.updateAnimations = function (deltaTime) {
        // Update particles with reduced calculations
        this.updateParticles(deltaTime);
        // Update combo texts with reduced calculations
        this.updateComboTexts(deltaTime);
        // Update gem animations with optimized calculations
        for (var row = 0; row < this.BOARD_SIZE; row++) {
            for (var col = 0; col < this.BOARD_SIZE; col++) {
                var anim = this.animationBoard[row][col];
                // Apply pulse effect to selected gem only when needed
                if (row === this.selectedRow && col === this.selectedCol && !this.isLiveDragging) {
                    anim.pulse = true;
                    // Use a simpler sine calculation for pulse
                    anim.scale = 1 + 0.08 * Math.sin(this.gameTime / 300);
                    anim.glow = true;
                }
                else if (anim.pulse || anim.glow || Math.abs(anim.scale - 1) > 0.01) {
                    // Only update animations that need changes
                    anim.pulse = false;
                    anim.glow = false;
                    // Smooth scale back to normal if not at 1
                    if (Math.abs(anim.scale - 1) > 0.01 && !this.isLiveDragging) {
                        anim.scale += (1 - anim.scale) * 0.2;
                        if (Math.abs(anim.scale - 1) < 0.01)
                            anim.scale = 1;
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
                }
                else if (!(row === this.selectedRow && col === this.selectedCol && this.isLiveDragging)) {
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
            var anim = this.animationBoard[this.selectedRow][this.selectedCol];
            anim.offsetX = this.dragOffsetX;
            anim.offsetY = this.dragOffsetY;
        }
    };
    // Update particle effects with optimized physics
    Match3Game.prototype.updateParticles = function (deltaTime) {
        // Cap the number of particles for performance
        if (this.particles.length > this.MAX_PARTICLES) {
            this.particles.length = this.MAX_PARTICLES;
        }
        // Calculate common factor once for efficiency
        var deltaFactor = deltaTime * 0.05;
        // Update particles in batches for better performance
        for (var i = this.particles.length - 1; i >= 0; i--) {
            var particle = this.particles[i];
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
    };
    // Update floating combo texts with optimized animations
    Match3Game.prototype.updateComboTexts = function (deltaTime) {
        var deltaFactor = deltaTime * 0.05;
        for (var i = this.comboTexts.length - 1; i >= 0; i--) {
            var text = this.comboTexts[i];
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
    };
    // Create particle effects with reduced particle count
    Match3Game.prototype.createParticles = function (row, col, gemType, count) {
        if (count === void 0) { count = 8; }
        // Skip particles if we already have too many
        if (this.particles.length >= this.MAX_PARTICLES)
            return;
        // Limit the number of new particles based on current count
        var actualCount = Math.min(count, this.MAX_PARTICLES - this.particles.length);
        var centerX = col * this.GEM_SIZE + this.GEM_SIZE / 2;
        var centerY = row * this.GEM_SIZE + this.GEM_SIZE / 2;
        for (var i = 0; i < actualCount; i++) {
            var angle = Math.random() * Math.PI * 2;
            var speed = 1 + Math.random() * 3;
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
    };
    // Create floating combo text
    Match3Game.prototype.createComboText = function (row, col, text, color) {
        var centerX = col * this.GEM_SIZE + this.GEM_SIZE / 2;
        var centerY = row * this.GEM_SIZE;
        this.comboTexts.push({
            x: centerX,
            y: centerY,
            text: text,
            color: color,
            life: 1500,
            initialLife: 1500
        });
    };
    // Initialize the board with optimized startup animations
    Match3Game.prototype.initializeBoard = function () {
        var _this = this;
        var _loop_1 = function (row) {
            var _loop_2 = function (col) {
                var validTypes = [0, 1, 2, 3, 4];
                // Remove types that would create matches
                if (row >= 2) {
                    if (this_1.board[row - 1][col] === this_1.board[row - 2][col]) {
                        validTypes = validTypes.filter(function (type) { return type !== _this.board[row - 1][col]; });
                    }
                }
                if (col >= 2) {
                    if (this_1.board[row][col - 1] === this_1.board[row][col - 2]) {
                        validTypes = validTypes.filter(function (type) { return type !== _this.board[row][col - 1]; });
                    }
                }
                // Pick a random valid type
                this_1.board[row][col] = validTypes[Math.floor(Math.random() * validTypes.length)];
                // Set initial animation with scale effect
                var anim = this_1.animationBoard[row][col];
                anim.scale = 0;
                // Faster staggered animation for initial appearance
                var delay = (row * this_1.BOARD_SIZE + col) * 10; // Reduced from 20 for better startup
                setTimeout(function () {
                    anim.scale = 1.2;
                    setTimeout(function () {
                        anim.scale = 1;
                    }, 100); // Reduced from 150 for faster startup
                }, delay);
            };
            for (var col = 0; col < this_1.BOARD_SIZE; col++) {
                _loop_2(col);
            }
        };
        var this_1 = this;
        // Fill the board with random gems
        for (var row = 0; row < this.BOARD_SIZE; row++) {
            _loop_1(row);
        }
    };
    // Render the game with optimized drawing
    Match3Game.prototype.render = function () {
        // Clear the offscreen canvas with a solid color for better performance
        this.offscreenCtx.fillStyle = "rgba(20, 22, 42, 1)";
        this.offscreenCtx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        // Draw the background grid
        this.drawGrid();
        // Draw each gem using pre-rendered templates
        for (var row = 0; row < this.BOARD_SIZE; row++) {
            for (var col = 0; col < this.BOARD_SIZE; col++) {
                var gemType = this.board[row][col];
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
            var offsetX = this.isLiveDragging ? this.dragOffsetX : 0;
            var offsetY = this.isLiveDragging ? this.dragOffsetY : 0;
            this.offscreenCtx.beginPath();
            this.offscreenCtx.roundRect(this.selectedCol * this.GEM_SIZE + 3 + offsetX, this.selectedRow * this.GEM_SIZE + 3 + offsetY, this.GEM_SIZE - 6, this.GEM_SIZE - 6, 8);
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
    };
    // Draw the background grid with optimized rendering
    Match3Game.prototype.drawGrid = function () {
        // Draw grid cells using direct rectangles instead of rounded rects for better performance
        for (var row = 0; row < this.BOARD_SIZE; row++) {
            for (var col = 0; col < this.BOARD_SIZE; col++) {
                // Alternating pattern
                if ((row + col) % 2 === 0) {
                    this.offscreenCtx.fillStyle = "rgba(35, 38, 65, 0.6)";
                }
                else {
                    this.offscreenCtx.fillStyle = "rgba(45, 48, 75, 0.6)";
                }
                // Highlight possible drop target during drag
                if (this.isLiveDragging && row === this.dragTargetRow && col === this.dragTargetCol) {
                    this.offscreenCtx.fillStyle = "rgba(70, 80, 120, 0.7)";
                }
                // Use fillRect instead of path operations for better performance
                this.offscreenCtx.fillRect(col * this.GEM_SIZE + 1, row * this.GEM_SIZE + 1, this.GEM_SIZE - 2, this.GEM_SIZE - 2);
            }
        }
    };
    // Draw particles with batched rendering
    Match3Game.prototype.drawParticles = function () {
        // Skip if no particles
        if (this.particles.length === 0)
            return;
        // Disable shadow effects for particles for better performance
        this.offscreenCtx.shadowBlur = 0;
        for (var _i = 0, _a = this.particles; _i < _a.length; _i++) {
            var particle = _a[_i];
            this.offscreenCtx.fillStyle = particle.color;
            this.offscreenCtx.globalAlpha = Math.min(1, particle.life / 300);
            // Use faster arc drawing without beginPath for performance
            this.offscreenCtx.beginPath();
            this.offscreenCtx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
            this.offscreenCtx.fill();
        }
        this.offscreenCtx.globalAlpha = 1;
    };
    // Draw combo texts with optimized rendering
    Match3Game.prototype.drawComboTexts = function () {
        // Skip if no texts
        if (this.comboTexts.length === 0)
            return;
        this.offscreenCtx.textAlign = "center";
        this.offscreenCtx.font = "bold 20px Poppins";
        this.offscreenCtx.shadowColor = "rgba(0, 0, 0, 0.5)";
        for (var _i = 0, _a = this.comboTexts; _i < _a.length; _i++) {
            var text = _a[_i];
            this.offscreenCtx.fillStyle = text.color;
            this.offscreenCtx.globalAlpha = Math.min(1, text.life / text.initialLife);
            // Apply shadow effect only once for better performance
            this.offscreenCtx.shadowBlur = 4;
            this.offscreenCtx.fillText(text.text, text.x, text.y);
        }
        // Reset shadow and opacity
        this.offscreenCtx.shadowBlur = 0;
        this.offscreenCtx.globalAlpha = 1;
    };
    // Draw an individual gem using pre-rendered templates
    Match3Game.prototype.drawGem = function (row, col, type) {
        var anim = this.animationBoard[row][col];
        var x = col * this.GEM_SIZE + anim.offsetX;
        var y = row * this.GEM_SIZE + anim.offsetY;
        var centerX = x + this.GEM_SIZE / 2;
        var centerY = y + this.GEM_SIZE / 2;
        // Skip rendering if outside of visible area (optimization)
        if (centerX < -this.GEM_SIZE || centerY < -this.GEM_SIZE ||
            centerX > this.canvas.width + this.GEM_SIZE || centerY > this.canvas.height + this.GEM_SIZE) {
            return;
        }
        // Apply rotation transform if needed
        this.offscreenCtx.save();
        // Only apply transformations if needed
        var needsTransform = anim.scale !== 1 || anim.rotation !== 0;
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
        }
        else {
            this.offscreenCtx.shadowBlur = 0;
        }
        // Apply opacity
        if (anim.opacity !== 1) {
            this.offscreenCtx.globalAlpha = anim.opacity;
        }
        // Use pre-rendered gem template for better performance
        var templateCanvas = this.gemTemplates[type];
        if (templateCanvas) {
            var size = this.GEM_SIZE;
            var scaledSize = size * (needsTransform ? 1 : anim.scale);
            var offsetX = (size - scaledSize) / 2;
            this.offscreenCtx.drawImage(templateCanvas, x + (needsTransform ? 0 : offsetX), y + (needsTransform ? 0 : offsetX), needsTransform ? size : scaledSize, needsTransform ? size : scaledSize);
        }
        // Reset transformations
        this.offscreenCtx.restore();
        // Reset shadow and opacity
        this.offscreenCtx.shadowBlur = 0;
        this.offscreenCtx.globalAlpha = 1;
    };
    // Handle touch start event
    Match3Game.prototype.handleTouchStart = function (event) {
        event.preventDefault();
        if (this.animating)
            return;
        var touch = event.touches[0];
        var rect = this.canvas.getBoundingClientRect();
        var col = Math.floor((touch.clientX - rect.left) / this.GEM_SIZE);
        var row = Math.floor((touch.clientY - rect.top) / this.GEM_SIZE);
        if (this.isValidPosition(row, col)) {
            this.isDragging = true;
            this.selectedRow = row;
            this.selectedCol = col;
            this.isLiveDragging = true;
            this.dragOffsetX = 0;
            this.dragOffsetY = 0;
        }
    };
    // Handle touch move event
    Match3Game.prototype.handleTouchMove = function (event) {
        event.preventDefault();
        if (!this.isDragging || this.animating)
            return;
        var touch = event.touches[0];
        var rect = this.canvas.getBoundingClientRect();
        // Calculate drag offset
        var touchX = touch.clientX - rect.left;
        var touchY = touch.clientY - rect.top;
        var gemCenterX = (this.selectedCol + 0.5) * this.GEM_SIZE;
        var gemCenterY = (this.selectedRow + 0.5) * this.GEM_SIZE;
        // Limit drag distance
        var offsetX = touchX - gemCenterX;
        var offsetY = touchY - gemCenterY;
        // Find drag direction and potential target
        this.calculateDragTarget(offsetX, offsetY);
        // Limit drag to one direction (horizontal or vertical)
        if (Math.abs(offsetX) > Math.abs(offsetY)) {
            offsetY = 0;
            offsetX = Math.max(-this.GEM_SIZE / 2, Math.min(this.GEM_SIZE / 2, offsetX));
        }
        else {
            offsetX = 0;
            offsetY = Math.max(-this.GEM_SIZE / 2, Math.min(this.GEM_SIZE / 2, offsetY));
        }
        this.dragOffsetX = offsetX;
        this.dragOffsetY = offsetY;
    };
    // Handle touch end event
    Match3Game.prototype.handleTouchEnd = function (event) {
        event.preventDefault();
        if (!this.isDragging || this.animating)
            return;
        if (this.dragTargetRow !== -1 && this.dragTargetCol !== -1) {
            // Complete the swap
            this.handleSwap(this.dragTargetRow, this.dragTargetCol);
        }
        else {
            // Reset drag state
            this.resetDragState();
        }
    };
    // Handle mouse down event (start dragging)
    Match3Game.prototype.handleMouseDown = function (event) {
        event.preventDefault();
        if (this.animating)
            return;
        var rect = this.canvas.getBoundingClientRect();
        var col = Math.floor((event.clientX - rect.left) / this.GEM_SIZE);
        var row = Math.floor((event.clientY - rect.top) / this.GEM_SIZE);
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
    };
    // Handle mouse move event
    Match3Game.prototype.handleMouseMove = function (event) {
        if (this.animating)
            return;
        var rect = this.canvas.getBoundingClientRect();
        var col = Math.floor((event.clientX - rect.left) / this.GEM_SIZE);
        var row = Math.floor((event.clientY - rect.top) / this.GEM_SIZE);
        if (this.isValidPosition(row, col)) {
            this.canvas.style.cursor = 'pointer';
        }
        else {
            this.canvas.style.cursor = 'default';
        }
        // Update the dragged gem position
        if (this.isDragging && this.isLiveDragging) {
            var gemCenterX = (this.selectedCol + 0.5) * this.GEM_SIZE;
            var gemCenterY = (this.selectedRow + 0.5) * this.GEM_SIZE;
            // Calculate drag offset from gem's center
            var offsetX = event.clientX - rect.left - gemCenterX;
            var offsetY = event.clientY - rect.top - gemCenterY;
            // Find drag direction and potential target
            this.calculateDragTarget(offsetX, offsetY);
            // Limit drag to one direction (horizontal or vertical)
            if (Math.abs(offsetX) > Math.abs(offsetY)) {
                offsetY = 0;
                offsetX = Math.max(-this.GEM_SIZE / 2, Math.min(this.GEM_SIZE / 2, offsetX));
            }
            else {
                offsetX = 0;
                offsetY = Math.max(-this.GEM_SIZE / 2, Math.min(this.GEM_SIZE / 2, offsetY));
            }
            this.dragOffsetX = offsetX;
            this.dragOffsetY = offsetY;
            this.mouseX = event.clientX;
            this.mouseY = event.clientY;
        }
    };
    // Calculate drag target based on offset
    Match3Game.prototype.calculateDragTarget = function (offsetX, offsetY) {
        this.dragTargetRow = -1;
        this.dragTargetCol = -1;
        // Determine drag direction and calculate target position
        if (Math.abs(offsetX) > Math.abs(offsetY)) {
            // Horizontal drag
            if (offsetX > this.GEM_SIZE / 4 && this.selectedCol < this.BOARD_SIZE - 1) {
                this.dragTargetRow = this.selectedRow;
                this.dragTargetCol = this.selectedCol + 1;
            }
            else if (offsetX < -this.GEM_SIZE / 4 && this.selectedCol > 0) {
                this.dragTargetRow = this.selectedRow;
                this.dragTargetCol = this.selectedCol - 1;
            }
        }
        else {
            // Vertical drag
            if (offsetY > this.GEM_SIZE / 4 && this.selectedRow < this.BOARD_SIZE - 1) {
                this.dragTargetRow = this.selectedRow + 1;
                this.dragTargetCol = this.selectedCol;
            }
            else if (offsetY < -this.GEM_SIZE / 4 && this.selectedRow > 0) {
                this.dragTargetRow = this.selectedRow - 1;
                this.dragTargetCol = this.selectedCol;
            }
        }
    };
    // Reset drag state
    Match3Game.prototype.resetDragState = function () {
        var _this = this;
        // Animate the selected gem back to its position
        if (this.selectedRow >= 0 && this.selectedCol >= 0) {
            var anim_1 = this.animationBoard[this.selectedRow][this.selectedCol];
            // Animate back to original position with fewer steps
            var steps_1 = 3; // Reduced from 5
            var step_1 = 0;
            var animate_1 = function () {
                step_1++;
                // Ease back to original position
                anim_1.offsetX = _this.dragOffsetX * (1 - step_1 / steps_1);
                anim_1.offsetY = _this.dragOffsetY * (1 - step_1 / steps_1);
                if (step_1 < steps_1) {
                    setTimeout(animate_1, 10);
                }
                else {
                    anim_1.offsetX = 0;
                    anim_1.offsetY = 0;
                    _this.isLiveDragging = false;
                }
            };
            animate_1();
        }
        this.selectedRow = -1;
        this.selectedCol = -1;
        this.isDragging = false;
        this.dragTargetRow = -1;
        this.dragTargetCol = -1;
    };
    // Handle mouse up event (end dragging)
    Match3Game.prototype.handleMouseUp = function (event) {
        if (!this.isDragging || this.animating)
            return;
        if (this.dragTargetRow !== -1 && this.dragTargetCol !== -1) {
            // Complete the swap
            this.handleSwap(this.dragTargetRow, this.dragTargetCol);
        }
        else {
            // Reset drag state
            this.resetDragState();
        }
    };
    // Handle the gem swap
    Match3Game.prototype.handleSwap = function (targetRow, targetCol) {
        var _this = this;
        this.animating = true;
        // Complete the swap animation
        this.swapGems(this.selectedRow, this.selectedCol, targetRow, targetCol);
        // Check if the swap created any matches
        setTimeout(function () {
            var matches = _this.findMatches();
            if (matches.length > 0) {
                _this.processMatches(matches);
            }
            else {
                // If no matches, swap back with shake animation
                setTimeout(function () {
                    _this.swapGems(targetRow, targetCol, _this.selectedRow, _this.selectedCol);
                    // Add shake effect to both gems
                    _this.animationBoard[_this.selectedRow][_this.selectedCol].shake = 5;
                    _this.animationBoard[targetRow][targetCol].shake = 5;
                    // Reset state
                    _this.selectedRow = -1;
                    _this.selectedCol = -1;
                    _this.isDragging = false;
                    _this.isLiveDragging = false;
                    _this.animating = false;
                    _this.dragTargetRow = -1;
                    _this.dragTargetCol = -1;
                }, _this.ANIMATION_SPEED);
            }
        }, this.ANIMATION_SPEED);
    };
    // Check if a position is valid
    Match3Game.prototype.isValidPosition = function (row, col) {
        return row >= 0 && row < this.BOARD_SIZE && col >= 0 && col < this.BOARD_SIZE;
    };
    // Check if two positions are adjacent
    Match3Game.prototype.isAdjacent = function (row1, col1, row2, col2) {
        var rowDiff = Math.abs(row1 - row2);
        var colDiff = Math.abs(col1 - col2);
        return (rowDiff === 1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1);
    };
    // Swap two gems with optimized animation
    Match3Game.prototype.swapGems = function (row1, col1, row2, col2) {
        var _this = this;
        // Animate the swap
        var anim1 = this.animationBoard[row1][col1];
        var anim2 = this.animationBoard[row2][col2];
        // Calculate the direction of movement
        var dx = col2 - col1;
        var dy = row2 - row1;
        // Set initial offsets for animation (handle live dragging case)
        if (this.isLiveDragging) {
            // The dragged gem is already partially on the way
            anim2.offsetX = -dx * this.GEM_SIZE;
            anim2.offsetY = -dy * this.GEM_SIZE;
        }
        else {
            anim1.offsetX = 0;
            anim1.offsetY = 0;
            anim2.offsetX = -dx * this.GEM_SIZE;
            anim2.offsetY = -dy * this.GEM_SIZE;
        }
        // First update the board data
        var temp = this.board[row1][col1];
        this.board[row1][col1] = this.board[row2][col2];
        this.board[row2][col2] = temp;
        // Animate the transition with fewer steps
        var steps = 8; // Reduced from 10
        var step = 0;
        var animate = function () {
            step++;
            // Calculate animation progress (ease out)
            var progress = 1 - Math.pow(1 - step / steps, 3);
            // Update offsets
            if (_this.isLiveDragging) {
                // For the dragged gem, continue from current position
                anim1.offsetX = _this.dragOffsetX + (dx * _this.GEM_SIZE - _this.dragOffsetX) * progress;
                anim1.offsetY = _this.dragOffsetY + (dy * _this.GEM_SIZE - _this.dragOffsetY) * progress;
            }
            else {
                anim1.offsetX = dx * _this.GEM_SIZE * progress;
                anim1.offsetY = dy * _this.GEM_SIZE * progress;
            }
            anim2.offsetX = -dx * _this.GEM_SIZE * (1 - progress);
            anim2.offsetY = -dy * _this.GEM_SIZE * (1 - progress);
            // Continue animation until complete
            if (step < steps) {
                setTimeout(animate, _this.ANIMATION_SPEED / steps);
            }
            else {
                // Reset offsets when animation is complete
                anim1.offsetX = 0;
                anim1.offsetY = 0;
                anim2.offsetX = 0;
                anim2.offsetY = 0;
                // Swap animation states too
                var tempAnim = __assign({}, _this.animationBoard[row1][col1]);
                _this.animationBoard[row1][col1] = __assign({}, _this.animationBoard[row2][col2]);
                _this.animationBoard[row2][col2] = __assign({}, tempAnim);
                _this.isLiveDragging = false;
            }
        };
        // Start animation
        animate();
    };
    // Find all matches on the board with optimized algorithm
    Match3Game.prototype.findMatches = function () {
        var _this = this;
        var allMatches = [];
        var visited = new Set(); // Track visited positions for optimization
        // Check horizontal matches with optimization
        for (var row = 0; row < this.BOARD_SIZE; row++) {
            var currentType = null;
            var matchLength = 1;
            var matchStart = 0;
            for (var col = 0; col < this.BOARD_SIZE; col++) {
                var key = "".concat(row, ",").concat(col);
                if (visited.has(key))
                    continue;
                if (this.board[row][col] === currentType && currentType !== null) {
                    matchLength++;
                }
                else {
                    if (matchLength >= 3) {
                        var match = [];
                        for (var i = 0; i < matchLength; i++) {
                            var pos = { row: row, col: matchStart + i };
                            match.push(pos);
                            visited.add("".concat(pos.row, ",").concat(pos.col));
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
                var match = [];
                for (var i = 0; i < matchLength; i++) {
                    var pos = { row: row, col: matchStart + i };
                    match.push(pos);
                    visited.add("".concat(pos.row, ",").concat(pos.col));
                }
                allMatches.push(match);
            }
        }
        // Check vertical matches with optimization
        for (var col = 0; col < this.BOARD_SIZE; col++) {
            var currentType = null;
            var matchLength = 1;
            var matchStart = 0;
            for (var row = 0; row < this.BOARD_SIZE; row++) {
                var key = "".concat(row, ",").concat(col);
                if (visited.has(key))
                    continue;
                if (this.board[row][col] === currentType && currentType !== null) {
                    matchLength++;
                }
                else {
                    if (matchLength >= 3) {
                        var match = [];
                        for (var i = 0; i < matchLength; i++) {
                            var pos = { row: matchStart + i, col: col };
                            match.push(pos);
                            visited.add("".concat(pos.row, ",").concat(pos.col));
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
                var match = [];
                for (var i = 0; i < matchLength; i++) {
                    var pos = { row: matchStart + i, col: col };
                    match.push(pos);
                    visited.add("".concat(pos.row, ",").concat(pos.col));
                }
                allMatches.push(match);
            }
        }
        // Filter matches based on game mode
        var filteredMatches = allMatches.filter(function (match) {
            switch (_this.gameMode) {
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
    };
    // Process matches, remove gems, and calculate score with optimized animations
    Match3Game.prototype.processMatches = function (matches) {
        var _this = this;
        // Remove matched gems
        this.matchesFound += matches.length;
        matches.forEach(function (match) {
            // Update score based on match length
            var matchLength = match.length;
            var points = 0;
            switch (matchLength) {
                case 3:
                    points = _this.gameMode === GameMode.EXACT3 ? 50 : 30; // Bonus for exact3 mode
                    break;
                case 4:
                    points = _this.gameMode === GameMode.EXACT4 ? 100 : 60; // Bonus for exact4 mode
                    break;
                case 5:
                    points = _this.gameMode === GameMode.EXACT5 ? 200 : 100; // Bonus for exact5 mode
                    break;
                default:
                    points = matchLength * 20;
            }
            // Bonus points for cascading matches
            if (_this.matchesFound > 1) {
                points *= (1 + (_this.matchesFound - 1) * 0.5);
            }
            _this.score += Math.floor(points);
            var scoreElement = document.querySelector('.score-value');
            if (scoreElement) {
                scoreElement.textContent = _this.score.toString();
                // Явно приводим к HTMLElement перед использованием свойств DOM
                var htmlScoreElement = scoreElement;
                htmlScoreElement.style.animation = 'none';
                // Используем явное приведение типа
                void htmlScoreElement.offsetWidth; // Trigger reflow
                htmlScoreElement.style.animation = 'pop 0.3s ease';
            }
            // Create combo text
            if (match.length > 0) {
                var middlePos = match[Math.floor(match.length / 2)];
                var comboText = "";
                if (matchLength >= 5) {
                    comboText = "AWESOME!";
                }
                else if (matchLength === 4) {
                    comboText = "GREAT!";
                }
                else {
                    comboText = "+" + Math.floor(points);
                }
                _this.createComboText(middlePos.row, middlePos.col, comboText, "#FFC107");
            }
            // Remove gems with explosion animation
            match.forEach(function (pos) {
                // Get gem type before removal for particle effects
                var gemType = _this.board[pos.row][pos.col];
                if (gemType !== null) {
                    // Create particle explosion with fewer particles
                    _this.createParticles(pos.row, pos.col, gemType, 10);
                    // Animate gem disappearance
                    var anim_2 = _this.animationBoard[pos.row][pos.col];
                    anim_2.scale = 1.5; // Expand
                    anim_2.opacity = 0.8; // Start fading
                    // Actually remove the gem from board data (with delay)
                    setTimeout(function () {
                        anim_2.scale = 0;
                        anim_2.opacity = 0;
                        _this.board[pos.row][pos.col] = null;
                    }, 100); // Reduced from 150
                }
            });
        });
        // After a delay, make gems fall and fill empty spaces
        setTimeout(function () {
            _this.dropGems();
            setTimeout(function () {
                _this.fillEmptySpaces();
                // Check for cascading matches after a proper delay
                setTimeout(function () {
                    var newMatches = _this.findMatches();
                    if (newMatches.length > 0) {
                        _this.processMatches(newMatches);
                    }
                    else {
                        // Reset matching state
                        _this.matchesFound = 0;
                        _this.selectedRow = -1;
                        _this.selectedCol = -1;
                        _this.isDragging = false;
                        _this.isLiveDragging = false;
                        _this.animating = false;
                        _this.dragTargetRow = -1;
                        _this.dragTargetCol = -1;
                    }
                }, _this.ANIMATION_SPEED);
            }, _this.ANIMATION_SPEED * 1.2);
        }, this.ANIMATION_SPEED * 1.5);
    };
    Match3Game.prototype.dropGems = function () {
        var _this = this;
        var _loop_3 = function (col) {
            var emptySpaces = 0;
            // Process from bottom to top
            for (var row = this_2.BOARD_SIZE - 1; row >= 0; row--) {
                if (this_2.board[row][col] === null) {
                    emptySpaces++;
                }
                else if (emptySpaces > 0) {
                    // This gem needs to drop down by 'emptySpaces' positions
                    var targetRow = row + emptySpaces;
                    // Store the gem type to move
                    var gemType = this_2.board[row][col];
                    // Move the gem data
                    this_2.board[targetRow][col] = gemType;
                    this_2.board[row][col] = null;
                    // Move gem animation state
                    var anim = this_2.animationBoard[row][col];
                    // Use a closure to capture current values for the animation
                    (function (currentRow, targetRow, currentAnim) {
                        // Animate the drop with fewer steps
                        var distance = (targetRow - currentRow) * _this.GEM_SIZE;
                        var steps = 8; // Reduced from 10
                        var step = 0;
                        // Set target animation to same values
                        _this.animationBoard[targetRow][col] = __assign(__assign({}, currentAnim), { offsetY: -distance });
                        // Make original position invisible
                        currentAnim.opacity = 0;
                        var animate = function () {
                            step++;
                            var progress = 1 - Math.pow(1 - step / steps, 2); // Ease out
                            // Animate target position
                            _this.animationBoard[targetRow][col].offsetY = -distance * (1 - progress);
                            if (step < steps) {
                                setTimeout(animate, 12); // Faster animation
                            }
                            else {
                                _this.animationBoard[targetRow][col].offsetY = 0;
                            }
                        };
                        animate();
                    })(row, targetRow, __assign({}, anim));
                }
            }
        };
        var this_2 = this;
        // For each column, find the lowest empty space and drop gems down to fill it
        for (var col = 0; col < this.BOARD_SIZE; col++) {
            _loop_3(col);
        }
    };
    // Fill empty spaces with new random gems with optimized animation
    Match3Game.prototype.fillEmptySpaces = function () {
        var _this = this;
        var _loop_4 = function (col) {
            // Count empty spaces at the top of the column
            var emptyCount = 0;
            for (var row = 0; row < this_3.BOARD_SIZE; row++) {
                if (this_3.board[row][col] === null) {
                    emptyCount++;
                    // Create a new gem
                    this_3.board[row][col] = Math.floor(Math.random() * this_3.GEM_TYPES);
                    // Animate new gem appearing from top
                    var anim = this_3.animationBoard[row][col];
                    anim.scale = 0.5;
                    anim.offsetY = -(emptyCount + 1) * this_3.GEM_SIZE;
                    anim.opacity = 1;
                    // Staggered animation for a more natural feel but faster overall
                    (function (currentRow, fallingDistance) {
                        setTimeout(function () {
                            // Animate drop and scale with fewer steps
                            var steps = 8; // Reduced from 12
                            var step = 0;
                            var animate = function () {
                                step++;
                                var progress = 1 - Math.pow(1 - step / steps, 2); // Ease out
                                _this.animationBoard[currentRow][col].offsetY = -fallingDistance * (1 - progress);
                                _this.animationBoard[currentRow][col].scale = 0.5 + (1 - 0.5) * progress;
                                if (step < steps) {
                                    setTimeout(animate, 12); // Faster animation
                                }
                                else {
                                    // Ensure final state is clean
                                    _this.animationBoard[currentRow][col].offsetY = 0;
                                    _this.animationBoard[currentRow][col].scale = 1;
                                    // Add a little bounce
                                    setTimeout(function () {
                                        _this.animationBoard[currentRow][col].scale = 1.1;
                                        setTimeout(function () {
                                            _this.animationBoard[currentRow][col].scale = 1;
                                        }, 80); // Faster bounce
                                    }, 40); // Faster delay
                                }
                            };
                            animate();
                        }, col * 20); // Faster stagger by column
                    })(row, (emptyCount + 1) * this_3.GEM_SIZE);
                }
            }
        };
        var this_3 = this;
        for (var col = 0; col < this.BOARD_SIZE; col++) {
            _loop_4(col);
        }
    };
    return Match3Game;
}());
document.addEventListener('DOMContentLoaded', function () {
    // Create background particles
    createParticles();
    // Start the game
    new Match3Game();
    // Add score animation
    var scoreElement = document.getElementById('score');
    if (scoreElement) {
        // Add glow effect to score container when score changes
        scoreElement.addEventListener('animationend', function () {
            var scoreContainer = document.querySelector('.score-container');
            if (scoreContainer) {
                var htmlScoreContainer_1 = scoreContainer;
                htmlScoreContainer_1.style.animation = 'glow 1.5s ease';
                setTimeout(function () {
                    htmlScoreContainer_1.style.animation = '';
                }, 1500);
            }
        });
    }
});
