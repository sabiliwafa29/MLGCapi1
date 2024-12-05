const express = require('express');
const multer = require('multer');
const path = require('path');
const tf = require('@tensorflow/tfjs-node'); // Add TensorFlow.js for Node.js

const app = express();
const PORT = process.env.PORT || 3000;

let model;

// Load the model
async function loadModel() {
  model = await tf.loadLayersModel('models/model.json');
  console.log('Model loaded successfully');
}

// Call loadModel when the server starts
loadModel();

// Set up storage and file size limit
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // Appending extension
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 1000000 }, // 1MB size limit
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only images are allowed'));
    }
  }
}).single('image');

app.post('/predict', (req, res) => {
  upload(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).send({
          status: 'fail',
          message: 'Payload content length greater than maximum allowed: 1000000'
        });
      }
      return res.status(400).send({
        status: 'fail',
        message: 'Terjadi kesalahan dalam melakukan prediksi'
      });
    } else if (err) {
      return res.status(400).send({
        status: 'fail',
        message: 'Terjadi kesalahan dalam melakukan prediksi'
      });
    }
    if (!req.file) {
      return res.status(400).send({
        status: 'fail',
        message: 'No file uploaded'
      });
    }
    
    try {
      const predictionResult = await predictImage(req.file.path);
      if (predictionResult.error) {
        throw new Error(predictionResult.error);
      }
      res.send({
        status: 'success',
        message: 'Model is predicted successfully',
        data: predictionResult.data
      });
    } catch (predictionError) {
      return res.status(400).send({
        status: 'fail',
        message: 'Terjadi kesalahan dalam melakukan prediksi'
      });
    }
  });
});

// Function to preprocess the image and make a prediction
async function predictImage(filePath) {
  const imageBuffer = fs.readFileSync(filePath);
  const image = tf.node.decodeImage(imageBuffer, 3); // Decode the image as a 3-channel (RGB) tensor
  const resizedImage = tf.image.resizeBilinear(image, [224, 224]); // Resize to the expected input shape for the model
  const normalizedImage = resizedImage.div(tf.scalar(255)); // Normalize the image
  const inputTensor = normalizedImage.expandDims(0); // Add a batch dimension

  const predictions = model.predict(inputTensor);
  const predictedClass = predictions.argMax(-1).dataSync()[0];

  if (predictedClass === 1) {
    return {
      data: {
        id: "77bd90fc-c126-4ceb-828d-f048dddff746",
        result: "Cancer",
        suggestion: "Segera periksa ke dokter!",
        createdAt: new Date().toISOString()
      }
    };
  } else {
    return {
      data: {
        id: "77bd90fc-c126-4ceb-828d-f048dddff746",
        result: "Non-cancer",
        suggestion: "Penyakit kanker tidak terdeteksi.",
        createdAt: new Date().toISOString()
      }
    };
  }
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
