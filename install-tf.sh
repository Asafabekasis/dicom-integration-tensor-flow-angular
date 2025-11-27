#!/bin/bash

# TensorFlow.js Installation Script for Git Bash
# Run this script from the client directory

echo "Installing TensorFlow.js packages..."

# Core TensorFlow.js
npm install @tensorflow/tfjs

# Visualization library
npm install @tensorflow/tfjs-vis

# Data pipeline library  
npm install @tensorflow/tfjs-data

# Pre-trained models (new package structure)
npm install @tensorflow-models/mobilenet
npm install @tensorflow-models/posenet  
npm install @tensorflow-models/coco-ssd

# Additional useful models
npm install @tensorflow-models/blazeface
npm install @tensorflow-models/handpose
npm install @tensorflow-models/body-pix

echo "Installation complete!"
echo "All TensorFlow.js packages have been installed successfully."