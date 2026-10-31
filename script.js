// script.js
const canvas = document.getElementById("simulationCanvas");
const ctx = canvas.getContext("2d", { willReadFrequently: true });

let trackImage = null;
let trackImageData = null;
let trackColor = null; // Stored when you set the start point

let startX = null;
let startY = null;
let cars = [];
const POPULATION_SIZE = 600;
let selectedParent = null;
let isRunning = false;
let learningCycles = 1;

// Handle Image Upload
document.getElementById('trackUpload').addEventListener('change', (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            // Resize canvas to fit image while keeping it manageable
            canvas.width = img.width > 1000 ? 1000 : img.width;
            canvas.height = img.height * (canvas.width / img.width);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            
            trackImage = img;
            trackImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            document.getElementById('status').innerHTML = "Track loaded!<br>Click on the grey road to set your starting point.";
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
});

// Utility to check if a pixel is an obstacle
function isObstacle(x, y) {
    if (!trackImageData || !trackColor) return true;
    if (x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) return true;

    const index = (Math.floor(y) * trackImageData.width + Math.floor(x)) * 4;
    const r = trackImageData.data[index];
    const g = trackImageData.data[index + 1];
    const b = trackImageData.data[index + 2];

    // Increased tolerance to 85 to handle gradient shadows and lane markings better
    const tolerance = 85; 
    if (Math.abs(r - trackColor.r) > tolerance || 
        Math.abs(g - trackColor.g) > tolerance || 
        Math.abs(b - trackColor.b) > tolerance) {
        return true; 
    }
    return false;
}

function lerp(A, B, t) { return A + (B - A) * t; }

class Car {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 15;
        this.height = 25;

        this.speed = 0;
        this.acceleration = 0.2;
        this.maxSpeed = 4;
        this.friction = 0.05;
        this.angle = -Math.PI / 2; // Start facing upwards
        this.crashed = false;
        this.isChampion = false;

        this.rayCount = 5;
        this.rayLength = 100;
        this.raySpread = Math.PI / 2; 
        this.sensorReadings = [];
        this.brain = new NeuralNetwork([this.rayCount, 6, 4]); 
    }

    update() {
        if (!this.crashed) {
            this.#move();
            this.#updateSensors();
            
            // Now the car only crashes if its center pixel hits an obstacle
            if (isObstacle(this.x, this.y)) {
                this.crashed = true;
            }

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

    #updateSensors() {
        this.sensorReadings = [];
        for (let i = 0; i < this.rayCount; i++) {
            const rayAngle = lerp(this.raySpread / 2, -this.raySpread / 2, this.rayCount === 1 ? 0.5 : i / (this.rayCount - 1)) + this.angle;
            
            let distance = 0;
            let hit = false;
            let currentX = this.x;
            let currentY = this.y;

            // Step pixel by pixel to check for obstacles
            while (distance < this.rayLength) {
                currentX -= Math.sin(rayAngle);
                currentY -= Math.cos(rayAngle);
                distance++;

                if (isObstacle(currentX, currentY)) {
                    hit = true;
                    break;
                }
            }

            if (hit) {
                this.sensorReadings.push({ x: currentX, y: currentY, offset: distance / this.rayLength });
            } else {
                this.sensorReadings.push(null);
            }
        }
    }

    draw(ctx) {
        // Only draw rays for the champion to keep performance smooth with 600 cars
        if (this.isChampion && !this.crashed) {
            this.sensorReadings.forEach((reading, i) => {
                const rayAngle = lerp(this.raySpread / 2, -this.raySpread / 2, this.rayCount === 1 ? 0.5 : i / (this.rayCount - 1)) + this.angle;
                const end = { x: this.x - Math.sin(rayAngle) * this.rayLength, y: this.y - Math.cos(rayAngle) * this.rayLength };
                ctx.beginPath();
                ctx.lineWidth = 2;
                ctx.strokeStyle = "rgba(255, 215, 0, 0.5)"; // Gold rays
                ctx.moveTo(this.x, this.y);
                ctx.lineTo(reading ? reading.x : end.x, reading ? reading.y : end.y);
                ctx.stroke();
            });
        }
        
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(-this.angle);
        
        if (this.crashed) {
            ctx.fillStyle = "rgba(100, 100, 100, 0.3)";
        } else if (this.isChampion) {
            ctx.fillStyle = "gold"; // Highlight champion
        } else {
            ctx.fillStyle = "rgba(50, 150, 255, 0.4)"; // Normal alive cars
        }
        
        ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
        ctx.restore();
    }
}

// Interactive Mouse Controls
// Interactive Mouse Controls
canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (!trackImageData) return;

    if (!isRunning) {
        // Set Start Point and sample the track color
        startX = mouseX;
        startY = mouseY;
        
        const index = (Math.floor(mouseY) * trackImageData.width + Math.floor(mouseX)) * 4;
        trackColor = {
            r: trackImageData.data[index],
            g: trackImageData.data[index + 1],
            b: trackImageData.data[index + 2]
        };

        document.getElementById('status').innerHTML = "Simulation running.<br>Click any living car to select it as the parent.";
        document.getElementById('generationCounter').style.display = "block";
        
        cars = GeneticAlgorithm.populateNextGeneration(POPULATION_SIZE, startX, startY, null);
        isRunning = true;
        animate();
    } else {
        // Select best car visually by clicking near it
        let minDist = Infinity;
        let closest = null;
        cars.forEach(car => {
            let d = Math.hypot(car.x - mouseX, car.y - mouseY);
            if (d < minDist) {
                minDist = d;
                closest = car;
            }
        });
        
        if (closest) {
            cars.forEach(c => c.isChampion = false);
            closest.isChampion = true;
            selectedParent = closest;
            document.getElementById('status').innerHTML = "Parent selected! Ready for next generation.";
        }
    }
});

function spawnNextGen() {
    if (!startX || cars.length === 0) return;
    
    // If a parent isn't explicitly clicked, fallback to the current selected parent or the first car
    let parentBrain = selectedParent ? selectedParent.brain : cars[0].brain; 
    
    cars = GeneticAlgorithm.populateNextGeneration(POPULATION_SIZE, startX, startY, parentBrain);
    selectedParent = null; // Reset selection for the new batch
    
    // Increment and update UI
    learningCycles++;
    document.getElementById('generationCounter').innerText = `Learning Cycles: ${learningCycles}`;
    document.getElementById('status').innerHTML = "New generation spawned.<br>Click a car to select the next parent.";
}

function resetLearning() {
    if (!startX || !isRunning) return;
    
    // Passing null trashes the brains and randomizes the weights completely
    cars = GeneticAlgorithm.populateNextGeneration(POPULATION_SIZE, startX, startY, null);
    selectedParent = null;
    
    // Reset counter
    learningCycles = 1;
    document.getElementById('generationCounter').innerText = `Learning Cycles: ${learningCycles}`;
    document.getElementById('status').innerHTML = "Brains trashed. Learning reset to random mutations.";
}

function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (trackImage) {
        ctx.drawImage(trackImage, 0, 0, canvas.width, canvas.height);
    }

    // Draw start point marker
    if (startX) {
        ctx.fillStyle = "lime";
        ctx.beginPath();
        ctx.arc(startX, startY, 5, 0, Math.PI * 2);
        ctx.fill();
    }

    cars.forEach(car => {
        car.update();
        car.draw(ctx);
    });

    requestAnimationFrame(animate);
}