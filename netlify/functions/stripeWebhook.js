const admin = require("firebase-admin");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

exports.handler = async (event) => {
    const sig = event.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
    let stripeEvent;

    try {
        stripeEvent = stripe.webhooks.constructEvent(event.body, sig, endpointSecret);
    } catch (err) {
        console.error("⚠️  Error en la verificación del webhook.", err.message);
        return {
            statusCode: 400,
            body: `Webhook Error: ${err.message}`
        };
    }
    
    const db = admin.firestore();
    const subscription = stripeEvent.data.object;
    const customerId = subscription.customer;
    const userQuery = await db.collection("userProfiles").where("stripeCustomerId", "==", customerId).get();

    if (!userQuery.empty) {
        const userId = userQuery.docs[0].id;
        const subscriptionEndDate = new Date(subscription.current_period_end * 1000);
        
        // Usamos los IDs de precio reales para determinar el plan
        const annualPriceId = 'price_1S5LtFKRu7M7maFSTqnqvPh0'; 
        const planName = subscription.items.data[0].price.id === annualPriceId ? "Anual" : "Mensual";
        
        const subscriptionData = {
            planId: subscription.items.data[0].price.id,
            planName: planName,
            subscriptionStatus: subscription.status,
            subscriptionEndDate: admin.firestore.Timestamp.fromDate(subscriptionEndDate),
        };

        await db.collection("userProfiles").doc(userId).set(subscriptionData, { merge: true });
    }
    
    return { statusCode: 200, body: 'ok' };
};

