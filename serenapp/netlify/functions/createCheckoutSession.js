const admin = require("firebase-admin");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

// Inicializa Firebase Admin (necesitarás configurar tus credenciales en Netlify)
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { priceId, successUrl, cancelUrl, userId, userEmail } = JSON.parse(event.body);

  if (!userId) {
     return { statusCode: 401, body: JSON.stringify({ error: "Debes estar autenticado." }) };
  }

  const db = admin.firestore();
  let customerId;
  const userRef = db.collection("userProfiles").doc(userId);
  const userDoc = await userRef.get();
  
  if (userDoc.exists && userDoc.data().stripeCustomerId) {
    customerId = userDoc.data().stripeCustomerId;
  } else {
    const customer = await stripe.customers.create({
      email: userEmail,
      metadata: { firebaseUID: userId },
    });
    customerId = customer.id;
    await userRef.set({ stripeCustomerId: customerId }, { merge: true });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ sessionId: session.id }),
    };
  } catch (error) {
    console.error("Error al crear la sesión de Stripe:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "No se pudo crear la sesión de pago." }),
    };
  }
};

