import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-simple-ml',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="simple-ml-container">
      <h2>Getting Started with TensorFlow.js</h2>
      
      <!-- Basic tensor operations -->
      <section class="demo-section">
        <h3>1. Basic Tensor Operations</h3>
        <button (click)="runBasicTensorOps()">Run Basic Operations</button>
        <div *ngIf="tensorResult()">
          <p><strong>Matrix A:</strong> {{ tensorResult()?.matrixA }}</p>
          <p><strong>Matrix B:</strong> {{ tensorResult()?.matrixB }}</p>
          <p><strong>A + B:</strong> {{ tensorResult()?.sum }}</p>
          <p><strong>A × B:</strong> {{ tensorResult()?.product }}</p>
        </div>
      </section>

      <!-- Simple linear model -->
      <section class="demo-section">
        <h3>2. Simple Linear Model</h3>
        <button (click)="createSimpleModel()">Create & Test Model</button>
        <div *ngIf="modelResult()">
          <p><strong>Input:</strong> {{ modelResult()?.input }}</p>
          <p><strong>Prediction:</strong> {{ modelResult()?.prediction | number:'1.2-2' }}</p>
          <p><strong>Model Structure:</strong> {{ modelResult()?.structure }}</p>
        </div>
      </section>

      <!-- Data processing -->
      <section class="demo-section">
        <h3>3. Data Processing</h3>
        <button (click)="processData()">Process Sample Data</button>
        <div *ngIf="dataResult()">
          <p><strong>Original Data:</strong> {{ dataResult()?.original }}</p>
          <p><strong>Normalized:</strong> {{ dataResult()?.normalized }}</p>
          <p><strong>Statistics:</strong></p>
          <ul>
            <li>Mean: {{ dataResult()?.stats.mean | number:'1.2-2' }}</li>
            <li>Std: {{ dataResult()?.stats.std | number:'1.2-2' }}</li>
            <li>Min: {{ dataResult()?.stats.min | number:'1.2-2' }}</li>
            <li>Max: {{ dataResult()?.stats.max | number:'1.2-2' }}</li>
          </ul>
        </div>
      </section>
    </div>
  `,
  styles: [`
    .simple-ml-container {
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
    }

    .demo-section {
      margin: 20px 0;
      padding: 15px;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      background: #f9f9f9;
    }

    .demo-section h3 {
      color: #1976d2;
      margin-bottom: 10px;
    }

    button {
      background: #1976d2;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      margin-bottom: 10px;
    }

    button:hover {
      background: #1565c0;
    }

    p {
      margin: 5px 0;
    }

    ul {
      margin: 10px 0;
      padding-left: 20px;
    }
  `]
})
export class SimpleMlComponent implements OnInit {
  // Signals for state management
  tensorResult = signal<any>(null);
  modelResult = signal<any>(null);
  dataResult = signal<any>(null);

  ngOnInit() {
    console.log('Simple ML Component initialized');
    // Note: This component shows basic operations without external dependencies
    // Once you install TensorFlow.js, you can uncomment the imports and use them
  }

  // Simulate tensor operations (replace with actual tf.js when installed)
  runBasicTensorOps() {
    // This is simulation - replace with actual TensorFlow.js code:
    /*
    import * as tf from '@tensorflow/tfjs';
    
    const a = tf.tensor2d([[1, 2], [3, 4]]);
    const b = tf.tensor2d([[5, 6], [7, 8]]);
    const sum = a.add(b);
    const product = a.matMul(b);
    
    this.tensorResult.set({
      matrixA: a.toString(),
      matrixB: b.toString(), 
      sum: sum.toString(),
      product: product.toString()
    });
    
    // Clean up
    a.dispose();
    b.dispose();
    sum.dispose();
    product.dispose();
    */

    // Simulation for demo purposes:
    this.tensorResult.set({
      matrixA: '[[1, 2], [3, 4]]',
      matrixB: '[[5, 6], [7, 8]]',
      sum: '[[6, 8], [10, 12]]',
      product: '[[19, 22], [43, 50]]'
    });
  }

  // Simulate model creation (replace with actual tf.js when installed)
  createSimpleModel() {
    // This is simulation - replace with actual TensorFlow.js code:
    /*
    import * as tf from '@tensorflow/tfjs';
    
    const model = tf.sequential({
      layers: [
        tf.layers.dense({ inputShape: [1], units: 1, activation: 'linear' })
      ]
    });
    
    const input = tf.tensor2d([[5]]);
    const prediction = model.predict(input) as tf.Tensor;
    
    this.modelResult.set({
      input: input.dataSync()[0],
      prediction: prediction.dataSync()[0],
      structure: 'Dense layer: 1 input → 1 output (linear)'
    });
    
    input.dispose();
    prediction.dispose();
    model.dispose();
    */

    // Simulation for demo purposes:
    const inputValue = 5;
    const simulatedPrediction = inputValue * 0.8 + 0.2; // Simple linear transformation

    this.modelResult.set({
      input: inputValue,
      prediction: simulatedPrediction,
      structure: 'Dense layer: 1 input → 1 output (linear)'
    });
  }

  // Simulate data processing (replace with actual tf.js when installed)
  processData() {
    // This is simulation - replace with actual TensorFlow.js code:
    /*
    import * as tf from '@tensorflow/tfjs';
    
    const data = [1, 5, 3, 8, 2, 9, 4, 7, 6];
    const tensor = tf.tensor1d(data);
    
    const mean = tf.mean(tensor);
    const std = tf.moments(tensor).variance.sqrt();
    const normalized = tensor.sub(mean).div(std);
    
    this.dataResult.set({
      original: data.toString(),
      normalized: normalized.dataSync().map(x => x.toFixed(2)).toString(),
      stats: {
        mean: mean.dataSync()[0],
        std: std.dataSync()[0],
        min: tf.min(tensor).dataSync()[0],
        max: tf.max(tensor).dataSync()[0]
      }
    });
    
    tensor.dispose();
    mean.dispose();
    std.dispose();
    normalized.dispose();
    */

    // Simulation for demo purposes:
    const data = [1, 5, 3, 8, 2, 9, 4, 7, 6];
    const mean = data.reduce((a, b) => a + b) / data.length;
    const variance = data.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / data.length;
    const std = Math.sqrt(variance);
    const normalized = data.map(x => (x - mean) / std);

    this.dataResult.set({
      original: data.toString(),
      normalized: normalized.map(x => x.toFixed(2)).toString(),
      stats: {
        mean: mean,
        std: std,
        min: Math.min(...data),
        max: Math.max(...data)
      }
    });
  }
}