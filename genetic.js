// genetic.js

class GeneticAlgorithm {
    static populateNextGeneration(populationSize, startX, startY, parentBrain = null) {
        const cars = [];
        
        for (let i = 0; i < populationSize; i++) {
            const car = new Car(startX, startY); 
            
            if (parentBrain) {
                car.brain = JSON.parse(JSON.stringify(parentBrain)); // Deep copy the brain
                
                // Keep the first car as an exact copy (champion), mutate the rest
                if (i !== 0) {
                    NeuralNetwork.mutate(car.brain, 0.15); // 15% mutation rate
                } else {
                    car.isChampion = true; // Visually mark the pure clone
                }
            }
            cars.push(car);
        }
        return cars;
    }
}