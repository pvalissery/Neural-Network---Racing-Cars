// genetic.js

class GeneticAlgorithm {
    static getBestCar(cars) {
        // Assuming your track goes upwards (negative Y axis)
        // Fitness = minimum Y value (furthest distance traveled)
        return cars.find(
            c => c.y === Math.min(...cars.map(car => car.y))
        );
    }

    static saveBestBrain(bestCar) {
        // Drop it into localStorage so it persists across page reloads
        localStorage.setItem("bestBrain", JSON.stringify(bestCar.brain));
    }

    static loadBestBrain() {
        const brainData = localStorage.getItem("bestBrain");
        return brainData ? JSON.parse(brainData) : null;
    }

    static populateNextGeneration(populationSize, startingX, startingY) {
        const cars = [];
        const bestBrain = this.loadBestBrain();

        for (let i = 0; i < populationSize; i++) {
            // Instantiate your custom Car class (assumed to be in your physics logic)
            const car = new Car(startingX, startingY); 
            
            if (bestBrain) {
                car.brain = JSON.parse(JSON.stringify(bestBrain)); // Deep copy
                // Keep the first car as the pure champion, mutate the rest
                if (i !== 0) {
                    NeuralNetwork.mutate(car.brain, 0.1); // 10% mutation rate
                }
            }
            cars.push(car);
        }
        return cars;
    }
}