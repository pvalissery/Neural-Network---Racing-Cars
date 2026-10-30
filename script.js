// script.js

const canvas = document.getElementById("simulationCanvas");
canvas.width = 800;
canvas.height = 600;
const ctx = canvas.getContext("2d");

// The 5 fixed colors for our population
const CAR_COLORS = ["#FF3366", "#33FF66", "#3366FF", "#FFFF33", "#FF9933"];

// Utility Math for Sensors
function getIntersection(A, B, C, D) { 
    const tTop = (D.x - C.x) * (A.y - C.y) - (D.y - C.y) * (A.x - C.x);
    const uTop = (C.y - A.y) * (A.x - B.x) - (C.x - A.x) * (A.y - B.y);
    const bottom = (D.y - C.y) * (B.x - A.x) - (D.x - C.x) * (B.y - A.y);
    
    if (bottom !== 0) {
        const t = tTop / bottom;
        const u = uTop / bottom;
        if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
            return { x: lerp(A.x, B.x, t), y: lerp(A.y, B.y, t), offset: t };
        }
    }
    return null;
}
function lerp(A, B, t) { return A + (B - A) * t; }

class Car {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.width = 20;
        this.height = 30;
        this.color = color; // Assign color

        this.speed = 0;
        this.acceleration = 0.2;
        this.maxSpeed = 4;
        this.friction = 0.05;
        this.angle = 0; 
        this.crashed = false;

        this.rayCount = 5;
        this.rayLength = 120;
        this.raySpread = Math.PI / 2; 
        this.sensorReadings = [];
        this.brain = new NeuralNetwork([this.rayCount, 6, 4]); 
    }

    update(trackBorders) {
        if (!this.crashed) {
            this.#move();
            this.#updateSensors(trackBorders);
            if (this.sensorReadings.some(r => r && r.offset < 0.1)) this.crashed = true;

            const inputs = this.sensorReadings.map(s => s ? 1 - s.offset : 0);
            const controls = NeuralNetwork.feedForward(inputs, this.brain);
            this.#applyControls(controls);
        }
    }

    #applyControls(controls) {
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
            const end = { x: this.x - Math.sin(rayAngle) * this.rayLength, y: this.y - Math.cos(rayAngle) * this.rayLength };
            let closest = null;
            trackBorders.forEach(border => {
                for (let j = 0; j < border.length - 1; j++) {
                    const touch = getIntersection(start, end, border[j], border[j + 1]);
                    if (touch && (!closest || touch.offset < closest.offset)) closest = touch;
                }
            });
            this.sensorReadings.push(closest);
        }
    }

    draw(ctx) {
        if (!this.crashed) {
            this.sensorReadings.forEach((reading, i) => {
                const rayAngle = lerp(this.raySpread / 2, -this.raySpread / 2, this.rayCount === 1 ? 0.5 : i / (this.rayCount - 1)) + this.angle;
                const end = { x: this.x - Math.sin(rayAngle) * this.rayLength, y: this.y - Math.cos(rayAngle) * this.rayLength };
                ctx.beginPath();
                ctx.lineWidth = 2;
                ctx.strokeStyle = "rgba(255,255,255,0.3)";
                ctx.moveTo(this.x, this.y);
                ctx.lineTo(reading ? reading.x : end.x, reading ? reading.y : end.y);
                ctx.stroke();
            });
        }
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(-this.angle);
        ctx.fillStyle = this.crashed ? "#555" : this.color;
        ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
        ctx.restore();
    }
}

function createOvalTrack() {
    const outer = [], inner = [];
    const centerX = canvas.width / 2, centerY = canvas.height / 2;
    for (let i = 0; i <= 24; i++) {
        const angle = (i / 24) * Math.PI * 2;
        outer.push({ x: centerX + Math.cos(angle) * 350, y: centerY + Math.sin(angle) * 250 });
        inner.push({ x: centerX + Math.cos(angle) * 200, y: centerY + Math.sin(angle) * 100 });
    }
    return [outer, inner];
}
const trackBorders = createOvalTrack();

// Setup Population of exactly 5
const POPULATION_SIZE = 5;
const startX = canvas.width / 2;
const startY = canvas.height / 2 + 175; 
let cars = GeneticAlgorithm.populateNextGeneration(POPULATION_SIZE, startX, startY, CAR_COLORS);
cars.forEach(car => car.angle = -Math.PI / 2);

// Inject Sliders into UI
const sliderPanel = document.getElementById("sliderPanel");
CAR_COLORS.forEach((color, i) => {
    // Default the first car to 100 influence, others to 0, just to start
    const defaultVal = i === 0 ? 100 : 0;
    sliderPanel.innerHTML += `
        <div class="slider-row">
            <span style="color: ${color}; text-shadow: 1px 1px 2px black;">Car ${i + 1}</span>
            <input type="range" id="influence-${i}" min="0" max="100" value="${defaultVal}">
        </div>
    `;
});

function animate() {
    canvas.height = window.innerHeight;
    canvas.width = window.innerWidth;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

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

    cars.forEach(car => {
        car.update(trackBorders);
        car.draw(ctx);
    });

    requestAnimationFrame(animate);
}

// UI Triggers
function saveAndRestart() {
    const sliderValues = CAR_COLORS.map((_, i) => document.getElementById(`influence-${i}`).value);
    GeneticAlgorithm.saveManualBrains(cars, sliderValues);
    location.reload();
}

function clearBrain() {
    localStorage.removeItem("breedingPool");
    location.reload();
}

animate();