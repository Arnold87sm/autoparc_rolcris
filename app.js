const express = require('express');
const path = require('path');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const session = require('express-session');
const fs = require('fs');
const util = require('util');
const unlink = util.promisify(fs.unlink);
const multer = require('multer');
const nodemailer = require('nodemailer');


// Create the app
const app = express();

// Set up middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public'))); // Serve static files

// Set up EJS as the templating engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Set up sessions
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: true,
}));

// Database connection
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '6782',
  database: 'car_dealer_db'
}).promise();

async function connectDB() {
  try {
    await db.connect();
    console.log('Connected to database.');
  } catch (err) {
    console.error('DB connection failed: ' + err.message);
  }
}
connectDB();

// Admin authentication middleware
function isAdmin(req, res, next) {
  if (req.session.admin) {
    return next();
  } else {
    res.redirect('/login');
  }
}

// ------- EMAIL FORM --------
app.use(bodyParser.urlencoded({ extended: true }));

app.post('/contact', async (req, res) => {
  const { name, email, phone, message } = req.body;

  // Option 1: Send an Email Notification
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail', // or another email provider
      auth: {
        user: 'infosapcreation@gmail.com', // Replace with your email
        pass: 'heqq zjdk tbam xpaq'         // Replace with your email password
      }
    });

    const mailOptions = {
      from: email,
      to: 'sap87sm@gmail.com', // Replace with admin email
      subject: 'New Contact Form Submission',
      text: `Name: ${name}\nEmail: ${email}\nPhone: ${phone}\nMessage: ${message}`
    };

    await transporter.sendMail(mailOptions);
    // Redirect to contact page with a success query parameter
    res.redirect('/?success=1');
  } catch (error) {
    console.error('Error sending email:', error);
    res.redirect('/contact?error=1');
  }
});


// Home page - display all cars
app.get('/', async (req, res) => {
  try {
    const [cars] = await db.query(`
      SELECT cars.*, 
        (SELECT car_images.image_path 
         FROM car_images 
         WHERE car_images.car_id = cars.id 
         LIMIT 1) AS image_path 
      FROM cars;
    `);

    res.render('index', { cars });
  } catch (err) {
    console.error('Error fetching cars for homepage:', err.message);
    res.send('An error occurred while fetching the cars data: ' + err.message);
  }
});


// Display login form
app.get('/login', (req, res) => {
  res.render('login');
});

// Handle login submission
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const [results] = await db.query('SELECT * FROM admins WHERE username = ? AND password = ?', [username, password]);
    if (results.length > 0) {
      req.session.admin = true;
      res.redirect('/admin');
    } else {
      res.send('Invalid credentials. Please <a href="/login">try again</a>.');
    }
  } catch (err) {
    console.error('Login query failed:', err.message);
    res.send('An error occurred during login.');
  }
});

// Display admin dashboard with all cars
app.get('/admin', isAdmin, async (req, res) => {
  try {
    // Modified query to include the main image for each car
    const [cars] = await db.query(`
      SELECT cars.*, 
        (SELECT car_images.image_path 
         FROM car_images 
         WHERE car_images.car_id = cars.id 
         LIMIT 1) AS image_path 
      FROM cars;
    `);
    
    res.render('admin', { cars });
  } catch (err) {
    console.error('Error fetching cars:', err.message);
    res.send('Error occurred while fetching cars.');
  }
});


// Route to display all cars on the "Masini de Vanzare" page
app.get('/masini-de-vanzare', async (req, res) => {
  const { marca, model, an_fabricatie, combustibil, cutie_viteza, min_price, max_price } = req.query;

  let query = `
    SELECT cars.*, 
      (SELECT car_images.image_path 
       FROM car_images 
       WHERE car_images.car_id = cars.id 
       LIMIT 1) AS image_path 
    FROM cars 
    WHERE 1 = 1
  `;

  const params = [];

  // Add filters dynamically based on input
  if (marca) {
    query += ' AND marca LIKE ?';
    params.push(`%${marca}%`);
  }
  if (model) {
    query += ' AND model LIKE ?';
    params.push(`%${model}%`);
  }
  if (an_fabricatie) {
    query += ' AND an_fabricatie = ?';
    params.push(an_fabricatie);
  }
  if (combustibil) {
    query += ' AND combustibil LIKE ?';
    params.push(`%${combustibil}%`);
  }
  if (cutie_viteza) {
    query += ' AND cutie_viteza LIKE ?';
    params.push(`%${cutie_viteza}%`);
  }
  
  if (min_price) {
    query += ' AND price >= ?';
    params.push(min_price);
  }
  if (max_price) {
    query += ' AND price <= ?';
    params.push(max_price);
  }

  try {
    const [cars] = await db.query(query, params);
    res.render('cars-list', { cars });
  } catch (err) {
    console.error('Error fetching filtered cars:', err.message);
    res.send('Error occurred while fetching cars.');
  }
});


// Display-Render Contact page
app.get('/contact', (req, res) => {
  res.render('contact'); // This will render profesional.ejs
});

// Display-Render Finantare page
app.get('/finantare', (req, res) => {
  res.render('finantare'); // This will render profesional.ejs
});

// Display Despre Noi page
app.get('/despre-noi', (req, res) => {
  res.render('despre-noi'); // This will render profesional.ejs
});

// Display Profesional page
app.get('/profesional', (req, res) => {
  res.render('profesional'); // This will render profesional.ejs
});

// Display form to add new car
app.get('/admin/add-car', isAdmin, (req, res) => {
  res.render('add-car'); // Ensure add-car.ejs is in the views folder
});

// Handle adding a new car (including uploading images)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/images/'); // Save to the correct folder
  },
  filename: function (req, file, cb) {
    // Rename the file to keep the original extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const fileExtension = file.originalname.split('.').pop(); // Get the file extension
    cb(null, file.fieldname + '-' + uniqueSuffix + '.' + fileExtension); // Example: carImages-162763738.jpg
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only images are allowed!'), false);
    }
  }
});


app.post('/admin/add-car', isAdmin, upload.array('carImages', 12), async (req, res) => {
  const { marca, model, an_fabricatie, combustibil, capacitate_cilindrica, putere, cutie_viteza, kilometrii_rulati, transmisie, caroserie, numar_portiere, culoare, norma_poluare, vin, price, description } = req.body;

  try {
    // Insert the car details first
    const [result] = await db.query(
      'INSERT INTO cars (marca, model, an_fabricatie, combustibil, capacitate_cilindrica, putere, cutie_viteza, kilometrii_rulati, transmisie, caroserie, numar_portiere, culoare, norma_poluare, vin, price, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [marca, model, an_fabricatie, combustibil, capacitate_cilindrica, putere, cutie_viteza, kilometrii_rulati, transmisie, caroserie, numar_portiere, culoare, norma_poluare, vin, price, description]
    );

    const carId = result.insertId;

    // Save each uploaded image path in the car_images table
    const imagePaths = req.files.map(file => `/images/${file.filename}`);

    for (const path of imagePaths) {
      await db.query('INSERT INTO car_images (car_id, image_path) VALUES (?, ?)', [carId, path]);
    }

    res.redirect('/admin');
  } catch (err) {
    console.error('Error adding car:', err.message);
    res.send('Error occurred while adding the car.');
  }
});


// Car detail page route
app.get('/car/:id', async (req, res) => {
  const carId = req.params.id;
  try {
    const [carResult] = await db.query('SELECT * FROM cars WHERE id = ?', [carId]);
    const [imagesResult] = await db.query('SELECT image_path FROM car_images WHERE car_id = ?', [carId]);
    
    if (carResult.length > 0) {
      res.render('car-detail', { car: carResult[0], images: imagesResult });
    } else {
      res.send('Car not found');
    }
  } catch (err) {
    console.error('Error fetching car:', err.message);
    res.send('Error occurred while fetching the car data.');
  }
});

// Display Edit Car Form
app.get('/admin/edit-car/:id', isAdmin, async (req, res) => {
  const carId = req.params.id;
  try {
    const [cars] = await db.query('SELECT * FROM cars WHERE id = ?', [carId]);
    if (cars.length > 0) {
      res.render('edit-car', { car: cars[0] });
    } else {
      res.send('Car not found');
    }
  } catch (err) {
    console.error('Error fetching car:', err.message);
    res.send('Error occurred while fetching the car data.');
  }
});

// Handle Car Edit Submission
app.post('/admin/edit-car/:id', isAdmin, async (req, res) => {
  const carId = req.params.id;
  const {
    type, detalii, marca, model, an_fabricatie, combustibil, capacitate_cilindrica,
    putere, cutie_viteza, kilometrii_rulati, transmisie, caroserie, numar_portiere,
    culoare, norma_poluare, vin, price, description
  } = req.body;

  try {
    await db.query(
      'UPDATE cars SET type = ?, detalii = ?, marca = ?, model = ?, an_fabricatie = ?, combustibil = ?, capacitate_cilindrica = ?, putere = ?, cutie_viteza = ?, kilometrii_rulati = ?, transmisie = ?, caroserie = ?, numar_portiere = ?, culoare = ?, norma_poluare = ?, vin = ?, price = ?, description = ? WHERE id = ?',
      [
        type, detalii, marca, model, an_fabricatie, combustibil, capacitate_cilindrica,
        putere, cutie_viteza, kilometrii_rulati, transmisie, caroserie, numar_portiere,
        culoare, norma_poluare, vin, price, description, carId
      ]
    );
    res.redirect('/admin');
  } catch (err) {
    console.error('Error updating car:', err.message);
    res.send('Error occurred while updating the car.');
  }
});

// Handle Deleting a Car
app.get('/admin/delete-car/:id', isAdmin, async (req, res) => {
  const carId = req.params.id;

  try {
    // Get all image paths associated with the car
    const [images] = await db.query('SELECT image_path FROM car_images WHERE car_id = ?', [carId]);

    // Delete each image from the filesystem
    for (const image of images) {
      try {
        if (fs.existsSync(`public${image.image_path}`)) {
          await unlink(`public${image.image_path}`);
        }
      } catch (err) {
        console.error(`Error deleting image: ${image.image_path}`, err.message);
      }
    }

    // Delete car images from the database
    await db.query('DELETE FROM car_images WHERE car_id = ?', [carId]);

    // Delete the car from the database
    await db.query('DELETE FROM cars WHERE id = ?', [carId]);

    res.redirect('/admin');
  } catch (err) {
    console.error('Error deleting car:', err.message);
    res.send('Error occurred while deleting the car.');
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server started on http://localhost:${PORT}`);
});
