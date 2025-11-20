// ===== GAME CONFIGURATION =====
const CONFIG = {
    canvasWidth: 800,
    canvasHeight: 600,
    playerSpeed: 5,
    playerShootCooldown: 300,
    bulletSpeed: 7,
    alienRows: 5,
    alienCols: 11,
    alienSpeed: 1,
    alienSpeedIncrease: 0.3,
    alienShootChance: 0.001,
    alienMoveInterval: 500,
    ufoChance: 0.001,
    ufoSpeed: 2,
    barrierCount: 4,
    barrierWidth: 60,
    barrierHeight: 40
};

// ===== GAME STATE =====
class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = CONFIG.canvasWidth;
        this.canvas.height = CONFIG.canvasHeight;

        this.gameState = 'menu'; // menu, playing, paused, gameover
        this.score = 0;
        this.level = 1;
        this.lives = 3;

        this.player = null;
        this.aliens = [];
        this.barriers = [];
        this.playerBullets = [];
        this.alienBullets = [];
        this.ufo = null;
        this.particles = [];

        this.keys = {};
        this.lastShootTime = 0;
        this.lastAlienMoveTime = 0;
        this.alienDirection = 1; // 1 = right, -1 = left
        this.alienMoveDown = false;
        this.isTransitioning = false;

        this.setupEventListeners();
    }

    setupEventListeners() {
        // Start button
        document.getElementById('startBtn').addEventListener('click', () => {
            soundSystem.init();
            this.startGame();
        });

        // Restart button
        document.getElementById('restartBtn').addEventListener('click', () => {
            this.startGame();
        });

        // Menu button
        document.getElementById('menuBtn').addEventListener('click', () => {
            this.showScreen('startScreen');
            this.gameState = 'menu';
        });

        // Keyboard controls
        document.addEventListener('keydown', (e) => {
            this.keys[e.key] = true;

            if (e.key === 'p' || e.key === 'P') {
                if (this.gameState === 'playing') {
                    this.gameState = 'paused';
                } else if (this.gameState === 'paused') {
                    this.gameState = 'playing';
                    this.gameLoop();
                }
            }
        });

        document.addEventListener('keyup', (e) => {
            this.keys[e.key] = false;
        });
    }

    startGame() {
        this.score = 0;
        this.level = 1;
        this.lives = 3;
        this.gameState = 'playing';
        this.isTransitioning = false;

        this.showScreen('gameScreen');
        this.updateHUD();
        this.initLevel();
        this.gameLoop();
    }

    initLevel() {
        // Create player
        this.player = {
            x: CONFIG.canvasWidth / 2,
            y: CONFIG.canvasHeight - 60,
            width: 40,
            height: 30,
            speed: CONFIG.playerSpeed
        };

        // Create aliens
        this.aliens = [];
        const startX = 100;
        const startY = 80;
        const spacingX = 50;
        const spacingY = 45;

        for (let row = 0; row < CONFIG.alienRows; row++) {
            for (let col = 0; col < CONFIG.alienCols; col++) {
                let type, points;
                if (row === 0) {
                    type = 'large';
                    points = 30;
                } else if (row <= 2) {
                    type = 'medium';
                    points = 20;
                } else {
                    type = 'small';
                    points = 10;
                }

                this.aliens.push({
                    x: startX + col * spacingX,
                    y: startY + row * spacingY,
                    width: 35,
                    height: 30,
                    type: type,
                    points: points,
                    alive: true,
                    frame: 0
                });
            }
        }

        // Create barriers
        this.barriers = [];
        const barrierY = CONFIG.canvasHeight - 150;
        const spacing = (CONFIG.canvasWidth - CONFIG.barrierWidth * CONFIG.barrierCount) / (CONFIG.barrierCount + 1);

        for (let i = 0; i < CONFIG.barrierCount; i++) {
            const x = spacing + i * (CONFIG.barrierWidth + spacing);
            this.barriers.push({
                x: x,
                y: barrierY,
                width: CONFIG.barrierWidth,
                height: CONFIG.barrierHeight,
                health: 100
            });
        }

        // Clear bullets
        this.playerBullets = [];
        this.alienBullets = [];
        this.ufo = null;
        this.particles = [];

        this.alienDirection = 1;
        this.alienMoveDown = false;
        this.isTransitioning = false;
    }

    gameLoop() {
        if (this.gameState !== 'playing') return;

        this.update();
        this.render();

        requestAnimationFrame(() => this.gameLoop());
    }

    update() {
        const now = Date.now();

        // Update player
        if (this.keys['ArrowLeft'] || this.keys['a'] || this.keys['A']) {
            this.player.x = Math.max(0, this.player.x - this.player.speed);
        }
        if (this.keys['ArrowRight'] || this.keys['d'] || this.keys['D']) {
            this.player.x = Math.min(CONFIG.canvasWidth - this.player.width, this.player.x + this.player.speed);
        }
        if (this.keys[' '] && now - this.lastShootTime > CONFIG.playerShootCooldown) {
            this.shootPlayerBullet();
            this.lastShootTime = now;
        }

        // Move aliens
        if (now - this.lastAlienMoveTime > CONFIG.alienMoveInterval / (1 + this.level * 0.1)) {
            this.moveAliens();
            this.lastAlienMoveTime = now;
            soundSystem.playAlienMove();
        }

        // Alien shooting
        this.aliens.filter(a => a.alive).forEach(alien => {
            if (Math.random() < CONFIG.alienShootChance * (1 + this.level * 0.5)) {
                this.shootAlienBullet(alien);
            }
        });

        // UFO spawning
        if (!this.ufo && Math.random() < CONFIG.ufoChance) {
            this.spawnUFO();
        }

        // Update bullets
        this.playerBullets.forEach(bullet => bullet.y -= CONFIG.bulletSpeed);
        this.alienBullets.forEach(bullet => bullet.y += CONFIG.bulletSpeed * 0.7);

        // Update UFO
        if (this.ufo) {
            this.ufo.x += this.ufo.direction * CONFIG.ufoSpeed;
            if (this.ufo.x < -50 || this.ufo.x > CONFIG.canvasWidth + 50) {
                this.ufo = null;
            }
        }

        // Update particles
        this.particles = this.particles.filter(p => {
            p.life--;
            p.x += p.vx;
            p.y += p.vy;
            p.alpha = p.life / p.maxLife;
            return p.life > 0;
        });

        // Remove off-screen bullets
        this.playerBullets = this.playerBullets.filter(b => b.y > 0);
        this.alienBullets = this.alienBullets.filter(b => b.y < CONFIG.canvasHeight);

        // Collision detection
        this.checkCollisions();

        // Check win condition
        if (this.aliens.filter(a => a.alive).length === 0) {
            this.levelComplete();
        }

        // Check lose condition (alien reached bottom)
        if (this.aliens.some(a => a.alive && a.y + a.height > this.player.y)) {
            this.gameOver();
        }
    }

    moveAliens() {
        let moveDown = false;

        // Check if any alien hit the edge
        const aliveAliens = this.aliens.filter(a => a.alive);
        const rightmost = Math.max(...aliveAliens.map(a => a.x + a.width));
        const leftmost = Math.min(...aliveAliens.map(a => a.x));

        if (rightmost >= CONFIG.canvasWidth - 10 && this.alienDirection === 1) {
            this.alienDirection = -1;
            moveDown = true;
        } else if (leftmost <= 10 && this.alienDirection === -1) {
            this.alienDirection = 1;
            moveDown = true;
        }

        // Move aliens
        aliveAliens.forEach(alien => {
            if (moveDown) {
                alien.y += 20;
            }
            alien.x += this.alienDirection * (CONFIG.alienSpeed + this.level * CONFIG.alienSpeedIncrease);
            alien.frame = (alien.frame + 1) % 2;
        });
    }

    shootPlayerBullet() {
        soundSystem.playShoot();
        this.playerBullets.push({
            x: this.player.x + this.player.width / 2 - 2,
            y: this.player.y,
            width: 4,
            height: 15
        });
    }

    shootAlienBullet(alien) {
        this.alienBullets.push({
            x: alien.x + alien.width / 2 - 2,
            y: alien.y + alien.height,
            width: 4,
            height: 15
        });
    }

    spawnUFO() {
        const direction = Math.random() < 0.5 ? 1 : -1;
        this.ufo = {
            x: direction === 1 ? -50 : CONFIG.canvasWidth + 50,
            y: 40,
            width: 50,
            height: 25,
            direction: direction,
            points: [50, 100, 150, 200, 300][Math.floor(Math.random() * 5)]
        };
        soundSystem.playUFO();
    }

    checkCollisions() {
        // Player bullets vs aliens
        this.playerBullets.forEach((bullet, bIndex) => {
            this.aliens.forEach(alien => {
                if (alien.alive && this.collision(bullet, alien)) {
                    alien.alive = false;
                    this.score += alien.points;
                    this.updateHUD();
                    this.createExplosion(alien.x + alien.width / 2, alien.y + alien.height / 2, this.getAlienColor(alien.type));
                    soundSystem.playExplosion();
                    this.playerBullets.splice(bIndex, 1);
                }
            });

            // Player bullets vs UFO
            if (this.ufo && this.collision(bullet, this.ufo)) {
                this.score += this.ufo.points;
                this.updateHUD();
                this.createExplosion(this.ufo.x + this.ufo.width / 2, this.ufo.y + this.ufo.height / 2, '#ffdc00');
                soundSystem.playExplosion();
                this.ufo = null;
                this.playerBullets.splice(bIndex, 1);
            }

            // Player bullets vs barriers
            this.barriers.forEach(barrier => {
                if (barrier.health > 0 && this.collision(bullet, barrier)) {
                    barrier.health -= 20;
                    this.playerBullets.splice(bIndex, 1);
                }
            });
        });

        // Alien bullets vs player
        this.alienBullets.forEach((bullet, bIndex) => {
            if (this.collision(bullet, this.player)) {
                this.lives--;
                this.updateHUD();
                this.createExplosion(this.player.x + this.player.width / 2, this.player.y + this.player.height / 2, ' #00ff41');
                soundSystem.playExplosion();
                this.alienBullets.splice(bIndex, 1);

                if (this.lives <= 0) {
                    this.gameOver();
                }
            }

            // Alien bullets vs barriers
            this.barriers.forEach(barrier => {
                if (barrier.health > 0 && this.collision(bullet, barrier)) {
                    barrier.health -= 10;
                    this.alienBullets.splice(bIndex, 1);
                }
            });
        });
    }

    collision(a, b) {
        return a.x < b.x + b.width &&
            a.x + a.width > b.x &&
            a.y < b.y + b.height &&
            a.y + a.height > b.y;
    }

    createExplosion(x, y, color) {
        for (let i = 0; i < 20; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 3 + 1;
            this.particles.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                color,
                life: 30,
                maxLife: 30,
                alpha: 1,
                size: Math.random() * 3 + 1
            });
        }
    }

    levelComplete() {
        if (this.isTransitioning) return;
        this.isTransitioning = true;
        this.level++;
        soundSystem.playLevelComplete();
        setTimeout(() => {
            this.initLevel();
        }, 2000);
    }

    gameOver() {
        this.gameState = 'gameover';
        soundSystem.playGameOver();

        document.getElementById('finalScore').textContent = this.score;
        document.getElementById('finalLevel').textContent = this.level;

        setTimeout(() => {
            this.showScreen('gameOverScreen');
        }, 1000);
    }

    updateHUD() {
        document.getElementById('score').textContent = String(this.score).padStart(4, '0');
        document.getElementById('level').textContent = String(this.level).padStart(2, '0');
        document.getElementById('lives').textContent = '❤️'.repeat(this.lives);
    }

    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById(screenId).classList.add('active');
    }

    // ===== RENDERING =====
    render() {
        const ctx = this.ctx;

        // Clear canvas
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight);

        // Draw barriers
        this.barriers.forEach(barrier => {
            if (barrier.health > 0) {
                ctx.fillStyle = `rgba(0, 255, 65, ${barrier.health / 100})`;
                ctx.fillRect(barrier.x, barrier.y, barrier.width, barrier.height);

                // Add glow
                ctx.shadowBlur = 10;
                ctx.shadowColor = '#00ff41';
                ctx.fillRect(barrier.x, barrier.y, barrier.width, barrier.height);
                ctx.shadowBlur = 0;
            }
        });

        // Draw player
        ctx.fillStyle = '#00ff41';
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#00ff41';

        // Simple triangle ship
        ctx.beginPath();
        ctx.moveTo(this.player.x + this.player.width / 2, this.player.y);
        ctx.lineTo(this.player.x, this.player.y + this.player.height);
        ctx.lineTo(this.player.x + this.player.width, this.player.y + this.player.height);
        ctx.closePath();
        ctx.fill();

        ctx.shadowBlur = 0;

        // Draw aliens using emoji
        this.aliens.forEach(alien => {
            if (alien.alive) {
                const color = this.getAlienColor(alien.type);
                ctx.fillStyle = color;
                ctx.shadowBlur = 10;
                ctx.shadowColor = color;
                ctx.font = `${alien.height}px Arial`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';

                // Draw alien emoji with slight offset for animation
                const offset = alien.frame === 0 ? 0 : 2;
                ctx.fillText('👾', alien.x + alien.width / 2, alien.y + alien.height / 2 + offset);

                ctx.shadowBlur = 0;
            }
        });

        // Draw UFO using emoji
        if (this.ufo) {
            ctx.fillStyle = '#ffdc00';
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#ffdc00';
            ctx.font = `${this.ufo.height}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            // Draw UFO emoji
            ctx.fillText('🛸', this.ufo.x + this.ufo.width / 2, this.ufo.y + this.ufo.height / 2);

            ctx.shadowBlur = 0;
        }

        // Draw bullets
        ctx.fillStyle = '#00d9ff';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#00d9ff';

        this.playerBullets.forEach(bullet => {
            ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
        });

        ctx.fillStyle = '#ff00ff';
        ctx.shadowColor = '#ff00ff';

        this.alienBullets.forEach(bullet => {
            ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
        });

        ctx.shadowBlur = 0;

        // Draw particles
        this.particles.forEach(p => {
            ctx.fillStyle = p.color;
            ctx.globalAlpha = p.alpha;
            ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
        });

        ctx.globalAlpha = 1;
    }

    getAlienColor(type) {
        switch (type) {
            case 'small': return '#00ff41';
            case 'medium': return '#00d9ff';
            case 'large': return '#ff00ff';
            default: return '#ffffff';
        }
    }
}

// ===== INITIALIZE GAME =====
let game;
window.addEventListener('load', () => {
    game = new Game();
});
