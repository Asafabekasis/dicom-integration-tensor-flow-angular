import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SimpleMlComponent } from './components/simple-ml.component';
import { TumorDetectionComponent } from './components/tumor-detection.component';
import { TumorDetection3DComponent } from './components/tumor-detection-3d.component';
// import { MlDemoComponent } from './components/ml-demo.component'; // Enable after installing TensorFlow.js

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, SimpleMlComponent, TumorDetectionComponent, TumorDetection3DComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('Advanced Medical AI - 2D & 3D Tumor Detection');
}
