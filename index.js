// Importing required middleware
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import path from 'path';
import multer from 'multer';
import nodemailer from 'nodemailer';
import moment from 'moment';  // Import moment.js to work with dates
import { sendEmail } from './emailUtils.js';
import pg from 'pg';
const { Pool } = pg; // This is the correct import
import dotenv from 'dotenv';
dotenv.config();
import cron from 'node-cron';

// Creating an instance of Express
const app = express();

// PostgreSQL pool definition to manage database connections
const pool = new Pool({
  user: 'postgres',          // Database user
  host: 'localhost',         // Database host
  database: 'Insurance',     // Database name
  password: 'Marvelous9194', // Database password
  port: 5432,                // Database port
});



// Setting up middleware
app.use(cors()); // Enable CORS
app.use(bodyParser.json()); // Parse JSON bodies
app.use(bodyParser.urlencoded({ extended: true })); // Parse URL-encoded bodies
app.use(morgan('dev')); // HTTP request logger
app.use(cookieParser()); // Parse cookies

// Serve static files from the 'uploads' directory
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Serve static files from the public directory
app.use(express.static(path.join(process.cwd(), 'public')));


// Set the view engine to EJS
app.set('view engine', 'ejs');
app.set('views', path.join(process.cwd(), 'views'));
  

// Set storage engine
const storage = multer.diskStorage({
    destination: './uploads/', // Specify the upload directory
    filename: (req, file, cb) => {
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname)); // Create a unique filename
    }
});

// Initialize upload
const upload = multer({
    storage: storage,
    limits: { fileSize: 1000000 }, // Limit file size to 1MB
    fileFilter: (req, file, cb) => {
        checkFileType(file, cb);
    }
}).single('file'); // Specify the field name for the file input

// Check file type function
function checkFileType(file, cb) {
    // Allowed ext
    const filetypes = /jpeg|jpg|png|pdf/;
    // Check ext
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    // Check mime
    const mimetype = filetypes.test(file.mimetype);

    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb('Error: Images and PDFs only!');
    }
}

// Cron job to run every day at 23:43 Tokyo time
cron.schedule('45 23 * * *', async () => {
    console.log('Cron job started at 23:43 Tokyo time every day');
    await sendReminderEmails();  // Call the sendReminderEmails function when the cron job runs
  }, {
    scheduled: true,
    timezone: "Asia/Tokyo" // Tokyo timezone
  });
  
// Function that contains the logic for sending emails
async function sendReminderEmails() {
    try {
      const result = await pool.query(`
        SELECT policy.*, client.first_name AS client_first_name, client.last_name AS client_last_name , client.email AS client_email
        FROM policy 
        LEFT JOIN client ON policy.client_id = client.id
        WHERE end_date <= CURRENT_DATE + INTERVAL '14 days'
        AND end_date > CURRENT_DATE
      `);
  
      if (result.rows.length === 0) {
        console.log('No policies expiring in the next two weeks.');
        return;
      }
  
      for (const policy of result.rows) {
        // Check if the reminder has already been sent
        if (policy.reminder_sent) {
          console.log(`Reminder already sent for policy ${policy.policy_number}`);
          continue; // Skip this policy if reminder was already sent
        }
  
        const clientEmail = policy.client_email; // Ensure this column exists in your database
  
        const formattedDate = new Date(policy.end_date).toLocaleDateString('it-IT');
        const subject = `Scadenza Polizza`;
        const message = `
          Gentile ${policy.client_first_name} ${policy.client_last_name},
  
          Ci teniamo a ricordarle che la sua polizza ${policy.policy_number}, 
          targata ${policy.license_plate}, è in scadenza giorno ${formattedDate}.
          La invitiamo a recarsi in assicurazione entro la data indicata.
  
          Questa è una comunicazione automatica, si prega di non rispondere a questo messaggio.
  
          Cordiali saluti
          Vinciguerra & Barbagallo SNC Assicurazioni
  
          Via Concetto Marchesi, 7b, 95125 Catania CT, Italia
          Orari: Lunedì - Venerdì: 9:00 - 13:00, 15:30 - 18:30
          Telefono: +39 095 749 6781
        `;
  
        // Send the email
        await sendEmail(clientEmail, subject, message);
  
        // Update the policy to mark the reminder as sent
        await pool.query(`
          UPDATE policy
          SET reminder_sent = TRUE
          WHERE id = $1
        `, [policy.id]);
  
        console.log(`Reminder sent for policy ${policy.policy_number}`);
      }
  
      console.log('Reminder emails sent successfully!');
    } catch (error) {
      console.error('Error sending reminder emails:', error);
    }
  }
  

// Route to send reminder emails
app.get('/send-reminders', async (req, res) => {
    try {
    const result = await pool.query(`
        SELECT policy.*, client.first_name AS client_first_name, client.last_name AS client_last_name, client.email AS client_email 
                FROM policy 
                LEFT JOIN client ON policy.client_id = client.id
                WHERE end_date <= CURRENT_DATE + INTERVAL '14 days'
                AND end_date > CURRENT_DATE
    `);
  
      // If no policies are expiring, send a response and stop the process
      if (result.rows.length === 0) {
        return res.status(200).send('No policies expiring in the next two weeks.');
      }
  
      // Step 3: Loop through the policies and send an email to each client
      for (const policy of result.rows) {
        const clientName = `${policy.client_first_name} ${policy.client_last_name}`;  
        const clientEmail = policy.client_email;  
        const expirationDate = policy.end_date;  
  
        // Format the expiration date for email
        const formattedDate = new Date(expirationDate).toLocaleDateString('it-IT');
  
        // Create the subject and message
        const subject = `Scadenza Polizza`;
        const message = `
          Gentile ${clientName},
  
          Ci teniamo a ricordarle che la sua polizza ${policy.policy_number}, 
          targata ${policy.license_plate}, è in scadenza giorno ${formattedDate}.
          La invitiamo a recarsi in assicurazione entro la data indicata.

          Questa è una comunicazione automatica, si prega di non rispondere a questo messaggio.
  
          Cordiali saluti
          Vinciguerra & Barbagallo SNC Assicurazioni

          Via Concetto Marchesi, 7b, 95125 Catania CT, Italia
          Orari: Lunedì - Venerdì: 9:00 - 13:00, 15:30 - 18:30
          Telefono: +39 095 749 6781

        `;
  
        // Step 4: Send the email
        await sendEmail(clientEmail, subject, message);
      }
  
      console.log('Reminder emails sent successfully!');
      // Send a success response after emails are sent
      res.status(200).send('Reminder emails sent successfully!');
    } catch (error) {
      console.error('Error sending reminder emails:', error);
      res.status(500).send('Error sending reminder emails.');
    }
  });

// File upload route
app.post('/uploadFile/:id', (req, res) => {
    upload(req, res, async (err) => {
        if (err) {
            return res.render('policies', { msg: err, policies: [] });
        }
        if (!req.file) {
            return res.render('policies', { msg: 'No file selected!', policies: [] });
        }
        try {
            // Save file metadata in the database
            const fileMetadataQuery = `
                INSERT INTO uploaded_files (policy_id, filename) VALUES ($1, $2)
            `;
            await pool.query(fileMetadataQuery, [req.params.id, req.file.filename]);

            // Fetch updated policies after upload
            const policiesResult = await pool.query(`
                SELECT policy.*, client.first_name AS client_first_name, client.last_name AS client_last_name 
                FROM policy 
                LEFT JOIN client ON policy.client_id = client.id
                WHERE policy.status = 'attiva'
            `);
           // Redirect after the file upload
        res.redirect('/viewFiles/' + req.params.id + '?msg=File uploaded successfully!');
        
        } catch (dbError) {
            console.error("Error saving file metadata or fetching policies:", dbError);
            res.render('policies', {
                msg: 'File uploaded, but error saving file metadata or fetching policies.',
                policies: []
            });
        }
    });
});

// Route for file view
app.get('/viewFiles/:id', async (req, res) => {
    const policyId = req.params.id;

    try {
        // Fetch the files associated with the policy from the database
        const filesResult = await pool.query(`
            SELECT * FROM uploaded_files WHERE policy_id = $1
        `, [policyId]);

        // Render the view with files data
        res.render('viewFiles', {
            policyId,           // Pass policyId to the view
            files: filesResult.rows // Pass the files data from the database
        });
    } catch (err) {
        console.error("Error fetching files:", err);
        res.render('viewFiles', { 
            policyId, 
            files: [] // If an error occurs, pass an empty array for files
        });
    }
});

//Dashboard
app.get('/', async (req, res) => {
    try {
        const clientsResult = await pool.query('SELECT * FROM client'); // Fetch all clients
        const clients = clientsResult.rows; // Get the rows from the result

        const policiesResult = await pool.query('SELECT * FROM policy'); // Fetch all policies
        const policies = policiesResult.rows; // Get the rows from the result

        const dailyPoliciesResult = await pool.query(`
            SELECT * FROM policy WHERE start_date = CURRENT_DATE    
        `);
        const todayPolicies = dailyPoliciesResult.rows;

        // Calculate the total sum of annual_premium for today's policies
        const dailyAnnualPremium = todayPolicies.reduce((total, policy) => {
            return total + (parseFloat(policy.annual_premium) || 0);
        }, 0).toFixed(2); // Format to two decimal places

        // Calculate the total sum of debt for today's policies
        const dailyDebt = todayPolicies.reduce((total, policy) => {
            return total + (parseFloat(policy.debt) || 0);
        }, 0).toFixed(2); // Format to two decimal places

        // Render the dashboard view with clients, policies, total premium, total debt, total net, and number of today's policies
        res.render('dashboard', {
            clients,
            policies,
            todayPolicies,
            dailyAnnualPremium,
            dailyDebt,
            error: null
        });
    } catch (error) {
        console.error("Error fetching data:", error);
        res.status(500).send("Internal Server Error");
    }
});

// Search clients
app.get("/searchClients", async (req, res) => {
    const { q } = req.query;
    try {
        const result = await pool.query(
            "SELECT id, first_name, last_name, codice_fiscale FROM client WHERE first_name ILIKE $1 OR last_name ILIKE $1",
            [`%${q}%`]
        );
        res.json(result.rows); // Send the rows as JSON response
    } catch (error) {
        console.error("Error searching clients:", error);
        res.status(500).send("Internal Server Error");
    }
});

// Search license plate
app.get("/searchLicensePlate", async (req, res) => {
    const { q } = req.query;
    try {
        const result = await pool.query(
            "SELECT id, license_plate FROM policy WHERE license_plate ILIKE $1",
            [`%${q}%`]
        );
        res.json(result.rows); // Send the rows as JSON response
    } catch (error) {
        console.error("Error searching license plate:", error);
        res.status(500).send("Internal Server Error");
    }
});

// Shows all clients
app.get("/clients", async (req, res) => {
    try {//query also for debt from all the client's policies
        const result = await pool.query(`
            SELECT client.*, COALESCE(SUM(policy.debt), 0) AS total_debt
            FROM client
            LEFT JOIN policy ON client.id = policy.client_id
            GROUP BY client.id
            ORDER BY client.last_name, client.first_name
        `);
        res.render("clients", {
            clients: result.rows,
            error: null
        });
    } catch (error) {
        console.error("Error retrieving clients:", error);
        res.render("clients", {
            clients: [],
            error: "Errore database: " + error.message
        });
    }
});

//Adds a new client
app.post("/addClient", async (req, res) => {
    const { first_name, last_name, date_of_birth, address, email, phone, codice_fiscale, notes } = req.body;
    try {
        const result = await pool.query(
            "INSERT INTO client (first_name, last_name, date_of_birth, address, email, phone, codice_fiscale, notes) VALUES ($1, $2, TO_DATE($3, 'DD/MM/YYYY'), $4, $5, $6, $7, $8) RETURNING *",
            [first_name, last_name, date_of_birth, address, email, phone, codice_fiscale, notes]
        );
        console.log("Added client:", result.rows[0]);
        res.redirect("/");
    } catch (error) {
        console.error("Error adding client:", error.message);
        res.status(500).send("Internal Server Error");
    }
});

//Shows add client form
app.get("/addClient", async (req, res) => {
    try {
        res.render("addClient");
    } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
    }
});

// Fetch notes for a specific policy
app.get("/policyNotes/:id", async (req, res) => {
    const { id } = req.params; // This should be the policy ID
    try {
        const result = await pool.query(`
            SELECT notes FROM policy WHERE id = $1
        `, [id]);

        if (result.rows.length > 0) {
            res.send(result.rows[0].notes); // Send the policy notes back
        } else {
            res.status(404).send("No notes found for this policy.");
        }
    } catch (error) {
        console.error("Error fetching policy notes:", error);
        res.status(500).send("Internal Server Error");
    }
});

// Fetch notes for a specific client
app.get("/clientNotes/:id", async (req, res) => {
    const { id } = req.params; // This should be the client ID
    try {
        const result = await pool.query(`
            SELECT notes FROM client WHERE id = $1
        `, [id]);

        if (result.rows.length > 0) {
            res.send(result.rows[0].notes); // Send the client notes back
        } else {
            res.status(404).send("No notes found for this client.");
        }
    } catch (error) {
        console.error("Error fetching client notes:", error);
        res.status(500).send("Internal Server Error");
    }
});

// Shows edit client form
app.get("/editClient/:id", async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query("SELECT * FROM client WHERE id = $1", [id]);
        const client = result.rows[0];
        res.render("editClient", { client });
    } catch (error) {
        console.error("Error retrieving client:", error.message);
        res.status(500).send("Internal Server Error");
    }
});

// Edits a client
app.post("/editClient/:id", async (req, res) => {
    const { id } = req.params;
    console.log(req.body); // Log the entire request body to check the data sent
    const { first_name, last_name, date_of_birth, address, email, phone, codice_fiscale, notes } = req.body;

    try {
        const result = await pool.query(
            "UPDATE client SET first_name = $1, last_name = $2, date_of_birth = TO_DATE($3, 'DD/MM/YYYY'), address = $4, email = $5, phone = $6, codice_fiscale = $7, notes = $8 WHERE id = $9 RETURNING *",
            [first_name, last_name, date_of_birth, address, email, phone, codice_fiscale, notes, id]
        );
        console.log("Edited client:", result.rows[0]);
        res.redirect("/"); // Redirect to the clients list page
    } catch (error) {
        console.error("Error editing client:", error.message);
        res.status(500).send("Internal Server Error");
    }
});

// Deletes a client
app.post("/deleteClient/:id", async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query("DELETE FROM client WHERE id = $1 RETURNING *", [id]);
        console.log("Deleted client:", result.rows[0]);
        res.redirect("/"); // Redirect to the clients list page
    } catch (error) {
        console.error("Error deleting client:", error.message);
        res.status(500).send("Impossibile eliminare il cliente perchè ha polizze attive");
    }
});

// Shows the info of a specific client
app.get("/specificClientInfo/:id", async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query(`
            SELECT 
                client.id, 
                client.first_name, 
                client.last_name, 
                client.date_of_birth, 
                client.address, 
                client.email, 
                client.phone, 
                client.codice_fiscale, 
                COALESCE(SUM(policy.debt), 0) AS total_debt,
                client.notes
            FROM client
            LEFT JOIN policy ON client.id = policy.client_id
            WHERE client.id = $1
            GROUP BY client.id
        `, [id]);

        const client = result.rows[0];

        // Check if client exists
        if (!client) {
            return res.status(404).send("Client not found");
        }

        res.render("specificClientInfo", { client });
    } catch (error) {
        console.error("Error fetching client information:", error);
        res.status(500).send("Internal Server Error");
    }
});


// Shows all policies
app.get("/policies", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT policy.*, client.first_name AS client_first_name, client.last_name AS client_last_name, policy.notes 
            FROM policy 
            LEFT JOIN client ON policy.client_id = client.id 
            ORDER BY client.last_name, client_first_name
        `);
        console.log("Policies retrieved:", result.rows);
        res.render("policies", { policies: result.rows });
    } catch (error) {
        console.error("Error retrieving policies:", error);
        res.status(500).send("Internal Server Error");
    }
});

// Search policies inside the policies page
app.post("/policies", async (req, res) => {
    const { policyName } = req.body;
    if (!policyName.trim()) {
        return res.render("policies", { policies: [], error: "Please enter a policy name." });
    }
    try {
        const result = await pool.query(`
            SELECT policy.*, client.first_name AS client_first_name, client.last_name AS client_last_name 
            FROM policy 
            JOIN client ON policy.client_id = client.id 
            WHERE policy_number ILIKE $1 
            ORDER BY client.last_name
        `, [`%${policyName}%`]);
        console.log("Policies retrieved:", result.rows);
        res.render("policies", { policies: result.rows, error: null });
    } catch (error) {
        console.error("Error retrieving policies:", error);
        res.render("policies", { policies: [], error: "Error retrieving policies: " + error.message });
    }
});

// Adds a new policy
app.post("/addPolicy", async (req, res) => {
    const { policy_number, client_id, type, start_date, end_date, annual_premium, status, payment_frequency, license_plate, payment_method, debt, notes } = req.body;

    console.log("Incoming Data:", {
        policy_number,
        client_id,
        type,
        start_date,
        end_date,
        annual_premium,
        status,
        payment_frequency,
        license_plate,
        payment_method,
        debt,
        notes
    });

    try {
        const result = await pool.query(
            `INSERT INTO policy 
             (policy_number, client_id, type, license_plate, start_date, end_date, annual_premium, status, payment_frequency, payment_method, debt, notes) 
             VALUES ($1, $2, $3, $4, TO_DATE($5, 'DD/MM/YYYY'), TO_DATE($6, 'DD/MM/YYYY'), $7, $8, $9, $10, $11, $12) 
             RETURNING *`,
            [policy_number, client_id, type, license_plate, start_date, end_date, annual_premium, status, payment_frequency, payment_method, debt, notes]
        );

        console.log("Added new policy:", result.rows[0]);
        res.redirect("/");
    } catch (error) {
        console.error("Error adding policy:", error); // Log the entire error object
        res.status(500).send("Internal Server Error");
    }
});

// Show add policy form
app.get("/addPolicies", async (req, res) => {
    try {
        res.render("addPolicies");
    } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
    }
});

// Shows edit policies form
app.get("/editPolicies/:id", async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query("SELECT * FROM policy WHERE id = $1", [id]);
        const policy = result.rows[0];
        res.render("editPolicies", { policy, formatDate }); // Pass formatDate to the view
    } catch (error) {
        console.error("Error retrieving policy:", error.message);
        res.status(500).send("Internal Server Error");
    }
});

// Edits a policy
app.post("/editPolicies/:id", async (req, res) => {
    const { id } = req.params;
    const { policy_number, client_id, type, start_date, end_date, annual_premium, status, payment_frequency, payment_method, debt, notes } = req.body;

    console.log("Request Body:", req.body); // Log the request body

    // Validate date formats
    if (!isValidDate(start_date) || !isValidDate(end_date)) {
        return res.status(400).send("Invalid date format. Please use DD/MM/YYYY.");
    }

    function isValidDate(dateString) {
        const regex = /^\d{2}\/\d{2}\/\d{4}$/; // Matches DD/MM/YYYY
        return regex.test(dateString);
    }

    // Convert dates from DD/MM/YYYY to YYYY-MM-DD for SQL
    const formattedStartDate = convertDateFormat(start_date);
    const formattedEndDate = convertDateFormat(end_date);

    function convertDateFormat(dateString) {
        const parts = dateString.split('/');
        return `${parts[2]}-${parts[1]}-${parts[0]}`; // Converts to YYYY-MM-DD
    }

    try {
        const result = await pool.query(
            "UPDATE policy SET policy_number = $1, client_id = $2, type = $3, start_date = TO_DATE($4, 'YYYY-MM-DD'), end_date = TO_DATE($5, 'YYYY-MM-DD'), annual_premium = $6, status = $7, payment_frequency = $8, payment_method = $9, debt = $10, notes = $11 WHERE id = $12 RETURNING *",
            [policy_number, client_id, type, formattedStartDate, formattedEndDate, annual_premium, status, payment_frequency, payment_method, debt, notes, id]
        );
        console.log("Edited policy:", result.rows[0]);
        res.redirect( "/"); // 
    } catch (error) {
        console.error("Error editing policy:", error.message);
        res.status(500).send("Internal Server Error");
    }
});

// Deletes a policy
app.post("/deletePolicies/:id", async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query("DELETE FROM policy WHERE id = $1 RETURNING *", [id]);
        console.log("Deleted policies:", result.rows[0]);
        res.redirect("/"); 
    } catch (error) {
        console.error("Error deleting policy:", error.message);
        res.status(500).send("Internal Server Error");
    }
});

// Shows all daily policies
app.get("/dailyPolicies", async (req, res) => {
    try {
        // Calculate the sum of policies with payment method 'Contanti' or 'Assegno' for today's policies
        const dareResult = await pool.query(`
            SELECT SUM(annual_premium) AS total_dare 
            FROM policy 
            WHERE payment_method IN ('Contanti', 'Assegno') 
            AND start_date = CURRENT_DATE
        `);
        const dare = dareResult.rows[0].total_dare || 0; // Default to 0 if no records found

        const avereResult = await pool.query(`
            SELECT SUM(annual_premium) AS total_avere 
            FROM policy 
            WHERE payment_method IN ('POS', 'Bonifico') 
            AND start_date = CURRENT_DATE
        `);
        const avere = avereResult.rows[0].total_avere || 0;

        //Calculate avere - dare
        const cassa = avere - dare;

        // Retrieve daily policies along with client information
        const result = await pool.query(`
            SELECT policy.*, client.first_name AS client_first_name, client.last_name AS client_last_name 
            FROM policy 
            LEFT JOIN client ON policy.client_id = client.id 
            WHERE policy.start_date = CURRENT_DATE
            ORDER BY client.last_name
        `);
        
        // Render the daily policies view with the calculated dare value
        res.render("dailyPolicies", {
            policies: result.rows,
            dare: dare, // Pass the dare value to the view
            avere: avere,
            cassa: cassa,
            error: null
        });
    } catch (error) {
        console.error("Error fetching daily policies:", error);
        res.status(500).send("Internal Server Error");
    }
});

// Search policies
app.post("/dailyPolicies", async (req, res) => {
    const { policyName } = req.body; // Get the policy name from the request body

    if (!policyName.trim()) {
        return res.render("dailyPolicies", { policies: [], error: "Please enter a policy name." });
    }

    try {
        // Retrieve policies based on the policy name
        const result = await pool.query(`
            SELECT policy.*, client.first_name AS client_first_name, client.last_name AS client_last_name 
            FROM policy 
            LEFT JOIN client ON policy.client_id = client.id 
            WHERE policy_number ILIKE $1 
            AND start_date = CURRENT_DATE
            ORDER BY client.last_name
        `, [`%${policyName}%`]);        

        // Calculate dare based on the retrieved policies
        const dareResult = await pool.query(`
            SELECT SUM(annual_premium) AS total_dare 
            FROM policy 
            WHERE payment_method IN ('Contanti', 'Assegno') 
            AND start_date = CURRENT_DATE
            AND policy_number ILIKE $1
        `, [`%${policyName}%`]); // Use the same search criteria
        const dare = dareResult.rows[0].total_dare || 0; // Default to 0 if no records found

        // Calculate avere based on the retrieved policies
        const avereResult = await pool.query(`
            SELECT SUM(annual_premium) AS total_avere 
            FROM policy 
            WHERE payment_method IN ('POS', 'Bonifico') 
            AND start_date = CURRENT_DATE
            AND policy_number ILIKE $1
        `, [`%${policyName}%`]); // Use the same search criteria
        const avere = avereResult.rows[0].total_avere || 0;

        // Render the daily policies view with updated dare and avere values
        res.render("dailyPolicies", {
            policies: result.rows,
            dare: dare,
            avere: avere,
            error: null
        });
    } catch (error) {
        console.error("Error fetching daily policies:", error);
        res.render("dailyPolicies", {
            policies: [],
            dare: 0,
            avere: 0,
            error: "Error retrieving policies."
        });
    }
});


// Shows all the policies for a specific client
app.get("/specificClientPolicies/:id", async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(`
            SELECT policy.*, client.first_name AS client_first_name, client.last_name AS client_last_name 
            FROM policy 
            JOIN client ON policy.client_id = client.id 
            WHERE policy.client_id = $1 
            ORDER BY client.first_name, client_last_name
        `, [id]);
        console.log(result.rows); // Log the result to check the data structure
        res.render("specificClientPolicies", {
            policies: result.rows,
            error: null
        });
    } catch (error) {
        console.error("Error retrieving client policies:", error);
        res.render("specificClientPolicies", {
            policies: [],
            error: "Errore database: " + error.message
        });
    }
});

// Shows specific policy info 
app.get("/specificPolicy/:id", async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(`
            SELECT policy.*, client.first_name AS client_first_name, client.last_name AS client_last_name 
            FROM policy 
            JOIN client ON policy.client_id = client.id 
            WHERE policy.id = $1
        `, [id]);
        console.log(result.rows); // Log the result to check the data structure
        res.render("specificPolicy", {
            policies: result.rows,
            error: null
        });
    } catch (error) {
        console.error("Error retrieving policy info:", error);
        res.render("specificPolicy", {
            policies: [],
            error: "Errore database: " + error.message
        });
    }
});

// Shows debiti
app.get("/debiti", async (req, res) => {
    try {
        // Calculate sum of debt of all displayed policies 
        const totalDebtResult = await pool.query(`
            SELECT SUM(debt) AS total_debt  
            FROM policy
            WHERE debt > 0
        `);
        
        // Extract the total debt value
        const totalDebt = totalDebtResult.rows[0].total_debt || 0; // Default to 0 if null

        const result = await pool.query(`
            SELECT policy.*, client.first_name AS client_first_name, client.last_name AS client_last_name 
            FROM policy 
            LEFT JOIN client ON policy.client_id = client.id
            WHERE policy.debt > 0
            ORDER BY client.last_name, client_first_name
        `);
        
        res.render("debiti", {
            policies: result.rows,
            totalDebt: totalDebt, // Pass the total debt to the view
            error: null
        });
    } catch (error) {
        console.error("Error retrieving policies:", error);
        res.render("debiti", {
            policies: [],
            totalDebt: 0, // Default to 0 in case of error
            error: "Error retrieving policies."
        });
    }
});

//Month search bar 
app.post("/debiti", async (req, res) => {
    const { timePeriod } = req.body; // Get the selected time period from the form input
    try {
        // Calculate the date range based on the selected time period
        const currentDate = new Date();
        const startDate = new Date();
        startDate.setMonth(currentDate.getMonth() - timePeriod); // Subtract the selected months

        // Query for filtered policies
        const result = await pool.query(`
            SELECT policy.*, client.first_name AS client_first_name, client.last_name AS client_last_name 
            FROM policy 
            LEFT JOIN client ON policy.client_id = client.id 
            WHERE policy.debt > 0 AND policy.start_date >= $1
            ORDER BY client.last_name
        `, [startDate]);

        // Query for the total debt with the same filtering
        const totalDebtResult = await pool.query(`
            SELECT SUM(debt) AS total_debt  
            FROM policy
            WHERE debt > 0 AND start_date >= $1
        `, [startDate]);

        // Extract the total debt value
        const totalDebt = totalDebtResult.rows[0].total_debt || 0;

        res.render("debiti", {
            policies: result.rows,
            totalDebt: totalDebt,
            error: null
        });
    } catch (error) {
        console.error("Error retrieving policies:", error);
        res.render("debiti", {
            policies: [],
            totalDebt: 0,
            error: "Error retrieving policies."
        });
    }
});


function formatDate(dateString) {
    const options = { year: 'numeric', month: '2-digit', day: '2-digit' };
    const date = new Date(dateString);
    return date.toLocaleDateString('it-IT', options);
}

// Start the server
const PORT = process.env.PORT || 8081; // You can change this to 80, but Elastic Beanstalk typically uses dynamic ports
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});


// Export the app for use in other files
export default app;