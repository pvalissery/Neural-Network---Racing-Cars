// script.js

const canvas = document.getElementById("simulationCanvas");
canvas.width = 800;
canvas.height = 600;
const ctx = canvas.getContext("2d");

// 1. UTILITY MATH FOR SENSORS
// Calculates where two line segments intersect (returns x, y, and distance offset)
function getIntersection(A, B, C, D) { 
    const tTop = (D.x - C.x) * (A.y - C.y) - (D.y - C.y) * (A.x - C.x);
    const uTop = (C.y - A.y) * (A.x - B.x) - (C.x - A.x) * (A.y - B.y);
    const bottom = (D.y - C.y) * (B.x - A.x) - (D.x - C.x) * (B.y - A.y);
    
    if (bottom !== 0) {
        const t = tTop / bottom;
        const u = uTop / bottom;
        if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
            return {
                x: lerp(A.x, B.x, t),
                y: lerp(A.y, B.y, t),
                offset: t
            };
        }
    }
    return null;
}

// 2. THE CAR & SENSOR CLASS
class Car {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 20;
        this.height = 30;

        // Kinematic Physics
        this.speed = 0;
        this.acceleration = 0.2;
        this.maxSpeed = 4;
        this.friction = 0.05;
        this.angle = 0; 
        
        // Fitness metric for the genetic algorithm
        this.odometer = 0; 
        this.crashed = false;

        // 5 Sensors (Rays), 6 Hidden Nodes, 4 Outputs (Up, Down, Left, Right)
        this.rayCount = 5;
        this.rayLength = 120;
        this.raySpread = Math.PI / 2; // 90 degree field of view
        this.sensorReadings = [];
        this.brain = new NeuralNetwork([this.rayCount, 6, 4]); 
    }

    update(trackBorders) {
        if (!this.crashed) {
            this.#move();
            this.odometer += this.speed; // Reward forward movement
            this.#updateSensors(trackBorders);
            
            // Crash if hitting a wall
            if (this.sensorReadings.some(r => r && r.offset < 0.1)) {
                this.crashed = true;
            }

            // AI taking control
            const inputs = this.sensorReadings.map(s => s ? 1 - s.offset : 0);
            const controls = NeuralNetwork.feedForward(inputs, this.brain);
            this.#applyControls(controls);
        }
    }

    #applyControls(controls) {
        // controls = [forward, backward, left, right]
        if (controls[0]) this.speed += this.acceleration;
        if (controls[1]) this.speed -= this.acceleration;
        
        if (this.speed !== 0) {
            const flip = this.speed > 0 ? 1 : -1;
            if (controls[2]) this.angle += 0.05 * flip;
            if (controls[3]) this.angle -= 0.05 * flip;
        }
    }

    #move() {
        if (this.speed > this.maxSpeed) this.speed = this.maxSpeed;
        if (this.speed < -this.maxSpeed / 2) this.speed = -this.maxSpeed / 2;

        if (this.speed > 0) this.speed -= this.friction;
        if (this.speed < 0) this.speed += this.friction;
        if (Math.abs(this.speed) < this.friction) this.speed = 0;

        this.x -= Math.sin(this.angle) * this.speed;
        this.y -= Math.cos(this.angle) * this.speed;
    }

    #updateSensors(trackBorders) {
        this.sensorReadings = [];
        for (let i = 0; i < this.rayCount; i++) {
            const rayAngle = lerp(this.raySpread / 2, -this.raySpread / 2, this.rayCount === 1 ? 0.5 : i / (this.rayCount - 1)) + this.angle;
            const start = { x: this.x, y: this.y };
            const end = {
                x: this.x - Math.sin(rayAngle) * this.rayLength,
                y: this.y - Math.cos(rayAngle) * this.rayLength
            };

            let closest = null;
            trackBorders.forEach(border => {
                for (let j = 0; j < border.length - 1; j++) {
                    const touch = getIntersection(start, end, border[j], border[j + 1]);
                    if (touch && (!closest || touch.offset < closest.offset)) {
                        closest = touch;
                    }
                }
            });
            this.sensorReadings.push(closest);
        }
    }

    draw(ctx) {
        // Draw Sensors
        if (!this.crashed) {
            this.sensorReadings.forEach((reading, i) => {
                const rayAngle = lerp(this.raySpread / 2, -this.raySpread / 2, this.rayCount === 1 ? 0.5 : i / (this.rayCount - 1)) + this.angle;
                const end = {
                    x: this.x - Math.sin(rayAngle) * this.rayLength,
                    y: this.y - Math.cos(rayAngle) * this.rayLength
                };
                ctx.beginPath();
                ctx.lineWidth = 2;
                ctx.strokeStyle = "yellow";
                ctx.moveTo(this.x, this.y);
                ctx.lineTo(reading ? reading.x : end.x, reading ? reading.y : end.y);
                ctx.stroke();
            });
        }

        // Draw Car Body
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(-this.angle);
        ctx.fillStyle = this.crashed ? "#555" : "cyan";
        ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
        ctx.restore();
    }
}

// 3. GENERATE A LOOPED TRACK (OVAL)
function createOvalTrack() {
    const outer = [];
    const inner = [];
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const segments = 24;

    for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        // Outer wall
        outer.push({
            x: centerX + Math.cos(angle) * 350,
            y: centerY + Math.sin(angle) * 250
        });
        // Inner wall
        inner.push({
            x: centerX + Math.cos(angle) * 200,
            y: centerY + Math.sin(angle) * 100
        });
    }
    return [outer, inner];
}

const trackBorders = createOvalTrack();

// 4. SPAWN POPULATION
const POPULATION_SIZE = 150;
const startX = canvas.width / 2;
const startY = canvas.height / 2 + 175; // Positioned on the bottom curve
let cars = GeneticAlgorithm.populateNextGeneration(POPULATION_SIZE, startX, startY);

// Make sure they face forward along the track (pointing right)
cars.forEach(car => car.angle = -Math.PI / 2);

// 5. ANIMATION LOOP
function animate() {
    canvas.height = window.innerHeight;
    canvas.width = window.innerWidth;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw Track
    ctx.strokeStyle = "white";
    ctx.lineWidth = 4;
    trackBorders.forEach(border => {
        ctx.beginPath();
        for (let i = 0; i < border.length - 1; i++) {
            ctx.moveTo(border[i].x, border[i].y);
            ctx.lineTo(border[i+1].x, border[i+1].y);
        }
        ctx.stroke();
    });

    // Update and Draw Cars
    cars.forEach(car => {
        car.update(trackBorders);
        car.draw(ctx);
    });

    requestAnimationFrame(animate);
}

// UI Controls
function saveAndRestart() {
    // Re-implemented to use Odometer instead of Y-axis
    const bestCar = cars.reduce((best, current) => current.odometer > best.odometer ? current : best, cars[0]);
    GeneticAlgorithm.saveBestBrain(bestCar);
    location.reload();
}

function clearBrain() {
    localStorage.removeItem("bestBrain");
    location.reload();
}

animate();