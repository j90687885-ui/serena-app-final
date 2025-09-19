const admin = require("firebase-admin");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

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
    
    const { returnUrl, userId } = JSON.parse(event.body);

    if (!userId) {
        return { statusCode: 401, body: JSON.stringify({ error: "Debes estar autenticado." }) };
    }

    const db = admin.firestore();
    const userRef = db.collection("userProfiles").doc(userId);
    const userDoc = await userRef.get();
    const customerId = userDoc.data().stripeCustomerId;

    if (!customerId) {
        return { statusCode: 404, body: JSON.stringify({ error: "No se encontró un cliente de Stripe para este usuario." }) };
    }

    try {
        const portalSession = await stripe.billingPortal.sessions.create({
            customer: customerId,
            return_url: returnUrl,
        });
        return {
            statusCode: 200,
            body: JSON.stringify({ url: portalSession.url }),
        };
    } catch (error) {
        console.error("Error al crear el portal de cliente:", error);
        return { statusCode: 500, body: JSON.stringify({ error: "No se pudo abrir el portal de gestión." }) };
    }
};

