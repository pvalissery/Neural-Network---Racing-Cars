// script.js

const canvas = document.getElementById("simulationCanvas");
canvas.width = 400; // Track width
canvas.height = window.innerHeight;
const ctx = canvas.getContext("2d");

const POPULATION_SIZE = 100;
// Generate the cars using the GeneticAlgorithm class
let cars = GeneticAlgorithm.populateNextGeneration(POPULATION_SIZE, canvas.width / 2, canvas.height - 100);

// Placeholder for your environment/track data
const trackBorders = [
    [{x: 50, y: 0}, {x: 50, y: canvas.height}], // Left wall
    [{x: 350, y: 0}, {x: 350, y: canvas.height}] // Right wall
];

function animate() {
    // 1. Clear the canvas
    canvas.height = window.innerHeight; 
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 2. Draw Track
    ctx.strokeStyle = "white";
    ctx.lineWidth = 5;
    trackBorders.forEach(border => {
        ctx.beginPath();
        ctx.moveTo(border[0].x, border[0].y);
        ctx.lineTo(border[1].x, border[1].y);
        ctx.stroke();
    });

    // 3. Update & Draw Cars
    cars.forEach(car => {
        if (!car.crashed) {
            // a. Read sensors (dummy array: [front, front-left, front-right, left, right])
            // In reality, calculate distance from car to track borders here
            const sensorData = [Math.random(), Math.random(), Math.random(), 0.5, 0.5]; 
            
            // b. Feed sensor data into the neural net
            const outputs = NeuralNetwork.feedForward(sensorData, car.brain);
            
            // c. Apply outputs to car controls [Forward, Backward, Left, Right]
            car.updatePhysics(outputs);
        }
        
        // d. Render car
        ctx.fillStyle = car.crashed ? "gray" : "blue";
        ctx.fillRect(car.x - 15, car.y - 25, 30, 50); // Simple rectangle car
    });

    // Loop
    requestAnimationFrame(animate);
}

// UI Controls
function saveAndRestart() {
    const bestCar = GeneticAlgorithm.getBestCar(cars);
    GeneticAlgorithm.saveBestBrain(bestCar);
    location.reload(); // Quickest way to reset the environment for the next generation
}

function clearBrain() {
    localStorage.removeItem("bestBrain");
    location.reload();
}

// Dummy Car Class for boilerplate completeness
class Car {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.crashed = false;
        // 5 inputs (sensors), 6 hidden neurons, 4 outputs (directions)
        this.brain = new NeuralNetwork([5, 6, 4]); 
    }
    updatePhysics(controls) {
        // controls = [forward, backward, left, right]
        if (controls[0]) this.y -= 2;
        if (controls[1]) this.y += 2;
        if (controls[2]) this.x -= 2;
        if (controls[3]) this.x += 2;
        
        // Basic crash detection
        if (this.x < 50 || this.x > 350) this.crashed = true; 
    }
}

// Start the simulation
animate();