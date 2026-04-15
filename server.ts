import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import cors from "cors";
import crypto from "crypto";
import admin from "firebase-admin";
import fs from "fs";
import { v2 as cloudinary } from "cloudinary";
import multer from "multer";

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const upload = multer({ dest: "uploads/" });

// Initialize Firebase Admin
let dbAdmin: admin.firestore.Firestore | null = null;
try {
  if (fs.existsSync('./firebase-applet-config.json')) {
    const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf-8'));
    
    if (admin.apps.length === 0) {
      admin.initializeApp({
        projectId: firebaseConfig.projectId,
      });
    }
    
    dbAdmin = admin.firestore();
    if (firebaseConfig.firestoreDatabaseId) {
      dbAdmin.settings({ databaseId: firebaseConfig.firestoreDatabaseId });
    }
  }
} catch (e) {
  console.warn("Could not initialize firebase-admin. Webhook database updates will be skipped.", e);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // Chapa API initialization
  app.post("/api/chapa/initialize", async (req, res) => {
    try {
      const { amount, currency, email, first_name, last_name, tx_ref, return_url, payment_options } = req.body;

      // Use environment variable with the provided test key as fallback
      const CHAPA_SECRET_KEY = (process.env.CHAPA_SECRET_KEY || 'CHASECK_TEST-ZamSfUix4DrtVBRbkvPNz8jx8aiQL3L3').trim();
      
      if (!CHAPA_SECRET_KEY || CHAPA_SECRET_KEY.includes('your_secret_key')) {
        return res.status(500).json({ error: "CHAPA_SECRET_KEY is not configured correctly. Please set it in the Settings menu." });
      }

      const host = req.get('host');
      const protocol = req.protocol;
      const baseUrl = `${protocol}://${host}`;

      const payload: any = {
        amount: Number(amount),
        currency: currency || 'ETB',
        email,
        first_name: first_name || 'Customer',
        last_name: last_name || 'User',
        tx_ref,
        callback_url: `${baseUrl}/api/chapa/webhook`,
        return_url: return_url,
        "customization[title]": "Clothify Payment",
        "customization[description]": "Order Payment for " + tx_ref
      };

      if (payment_options) {
        payload.payment_options = payment_options;
      }

      const response = await fetch("https://api.chapa.co/v1/transaction/initialize", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${CHAPA_SECRET_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      console.log("Chapa API Response:", data);
      
      if (data.status === "success") {
        res.json({ checkoutUrl: data.data.checkout_url });
      } else {
        res.status(400).json({ 
          error: data.message || "Failed to initialize payment",
          details: data
        });
      }
    } catch (error) {
      console.error("Chapa initialization error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Chapa Verify
  app.get("/api/chapa/verify/:tx_ref", async (req, res) => {
    try {
      const { tx_ref } = req.params;
      const CHAPA_SECRET_KEY = (process.env.CHAPA_SECRET_KEY || 'CHASECK_TEST-ZamSfUix4DrtVBRbkvPNz8jx8aiQL3L3').trim();
      
      if (!CHAPA_SECRET_KEY) {
        return res.status(500).json({ error: "CHAPA_SECRET_KEY is not configured" });
      }

      const response = await fetch(`https://api.chapa.co/v1/transaction/verify/${tx_ref}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${CHAPA_SECRET_KEY}`
        }
      });

      const data = await response.json();
      
      if (data.status === 'success' && data.data?.status === 'success') {
        if (dbAdmin) {
          await distributeFunds(tx_ref);
        }
      }
      
      res.json(data);
    } catch (error) {
      console.error("Chapa verify error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Chapa Webhook
  app.post("/api/chapa/webhook", async (req, res) => {
    const CHAPA_WEBHOOK_SECRET = process.env.CHAPA_WEBHOOK_SECRET;
    const signature = req.headers['chapa-signature'] || req.headers['x-chapa-signature'];

    if (CHAPA_WEBHOOK_SECRET && signature) {
      const hash = crypto.createHmac('sha256', CHAPA_WEBHOOK_SECRET).update(JSON.stringify(req.body)).digest('hex');
      if (hash !== signature) {
        console.error("Invalid Chapa webhook signature");
        return res.status(400).json({ error: "Invalid signature" });
      }
    } else if (!CHAPA_WEBHOOK_SECRET) {
      console.warn("CHAPA_WEBHOOK_SECRET is not set. Skipping signature verification.");
    }

    console.log("Chapa Webhook received:", req.body);

    const { event, status, tx_ref } = req.body;

    if ((event === 'charge.success' || status === 'success') && tx_ref) {
      if (dbAdmin) {
        await distributeFunds(tx_ref);
      } else {
        console.warn("dbAdmin not initialized. Cannot update order status in Firestore.");
      }
    }

    res.status(200).send("OK");
  });

  // Cloudinary Upload Endpoint
  app.post("/api/upload", upload.single("file"), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "clothify_verification",
      });

      // Remove local file after upload
      fs.unlinkSync(req.file.path);

      res.json({ url: result.secure_url });
    } catch (error) {
      console.error("Cloudinary upload error:", error);
      res.status(500).json({ error: "Failed to upload image" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

async function distributeFunds(tx_ref: string) {
  if (!dbAdmin) return;

  try {
    const ordersRef = dbAdmin.collection('orders');
    const snapshot = await ordersRef.where('tx_ref', '==', tx_ref).get();

    if (snapshot.empty) {
      console.warn(`No order found with tx_ref: ${tx_ref}`);
      return;
    }

    const orderDoc = snapshot.docs[0];
    const orderData = orderDoc.data();

    if (orderData.paymentStatus === 'Paid' && orderData.fundsDistributed) {
      console.log(`Funds already distributed for tx_ref: ${tx_ref}`);
      return;
    }

    const batch = dbAdmin.batch();
    batch.update(orderDoc.ref, { 
      paymentStatus: 'Paid',
      fundsDistributed: true 
    });

    let totalCommission = 0;
    const sellerEarnings: { [sellerId: string]: number } = {};

    // Calculate earnings per seller
    if (orderData.items && Array.isArray(orderData.items)) {
      orderData.items.forEach((item: any) => {
        const itemTotal = (item.price || 0) * (item.quantity || 1);
        const commission = itemTotal * 0.05;
        const sellerShare = itemTotal - commission;

        totalCommission += commission;
        
        if (item.sellerId) {
          sellerEarnings[item.sellerId] = (sellerEarnings[item.sellerId] || 0) + sellerShare;
        }
      });
    }

    // Update seller balances
    for (const sellerId in sellerEarnings) {
      const sellerRef = dbAdmin.collection('users').doc(sellerId);
      batch.update(sellerRef, {
        balance: admin.firestore.FieldValue.increment(sellerEarnings[sellerId])
      });
    }

    // Update Admin Stats
    const statsRef = dbAdmin.collection('adminStats').doc('global');
    batch.set(statsRef, {
      totalProfit: admin.firestore.FieldValue.increment(totalCommission),
      totalSales: admin.firestore.FieldValue.increment(orderData.total || 0),
      lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    await batch.commit();
    console.log(`Successfully distributed funds and updated stats for tx_ref: ${tx_ref}`);
  } catch (error) {
    console.error("Error in distributeFunds:", error);
  }
}

startServer();
