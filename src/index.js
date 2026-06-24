require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();
app.use(express.json());
const authRoutes = require('./routes/auth');
const rideRoutes = require('./routes/rides');
// mongoose connection
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGO_URI)
.then(() => console.log('MongoDB connected'))
.catch(err => console.log(err));
const port = process.env.PORT || 5000;


app.use(cors({
  origin: 'http://localhost:3000', // replace with your frontend URL
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// test route
app.get('/', (req, res) => {
  res.send('Hello World!');
});
// routes
app.use('/api/auth', authRoutes);
app.use('/api/rides', rideRoutes);

// start the server
app.listen(port, () => {
  console.log(`http://localhost:${port}`);
});