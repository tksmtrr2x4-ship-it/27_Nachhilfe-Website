import Stripe from "stripe";

let stripe;

export function getStripe() {
  if (!stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error(
        "STRIPE_SECRET_KEY fehlt in den Umgebungsvariablen (siehe .env.local.example)."
      );
    }
    stripe = new Stripe(key);
  }
  return stripe;
}
