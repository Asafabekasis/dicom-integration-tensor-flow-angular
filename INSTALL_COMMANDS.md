# TensorFlow.js Installation Commands for Git Bash

# Navigate to your client directory first:
cd "/c/Users/asaf.abekasis/OneDrive - Brainlab AG/Desktop/tf new/client"

# Then run these commands one by one:

# 1. Core TensorFlow.js library
npm install @tensorflow/tfjs

# 2. Visualization library
npm install @tensorflow/tfjs-vis

# 3. Data pipeline library
npm install @tensorflow/tfjs-data

# 4. Pre-trained models (IMPORTANT: Note the new package names!)
npm install @tensorflow-models/mobilenet

npm install @tensorflow-models/posenet

npm install @tensorflow-models/coco-ssd

# 5. Optional additional models:
npm install @tensorflow-models/blazeface

npm install @tensorflow-models/handpose

npm install @tensorflow-models/body-pix

# 6. Check that everything is installed:
npm list | grep tensorflow

echo "Installation complete! The imports in your component should now work."