/* ==========================================================================
   GUYS&CO WEBSITE SETTINGS
   Paste values between the quotes, save, and commit the change to GitHub.
   Vercel republishes the site by itself. Leave a value as "" to keep it off.
   (Form email and Supabase keys are NOT set here. They live in Vercel's
   Environment Variables, see the README.)
   ========================================================================== */
window.GUYSCO_CONFIG = {

  /* Your live web address, with https and no slash at the end. */
  siteUrl: "https://theguysandco.com",

  /* A contact email to SHOW on the site. Leave "" to show none (visitors use
     the forms, which are delivered to your inbox either way). */
  contactEmail: "",

  /* MEMBER LOGIN LINK. Set to true when you are ready to open the Member Lounge
     to members. While false, the site shows no "Member login" link (your own
     back office still works at theguysandco.com/login). */
  memberLogin: false,

  /* Where every "Book a Strategy Call" button goes. */
  strategyCallUrl: "https://forms.gle/EfPKTW35xcUaSWyP6",

  /* STRIPE PAYMENT LINKS for The Growth Plan (homepage, "Pay your way").
     Create each link in Stripe > Payment Links, then paste it here.
     They look like https://buy.stripe.com/xxxxxxxx
     While a value is "", that tile shows its price with no pay button.
       payInFull  $5,000 one time
       threePay   $1,800 a month for 3 months (a Stripe subscription that ends after 3)
       sixPay     $950 a month for 6 months  (a Stripe subscription that ends after 6) */
  stripe: {
    payInFull: "",
    threePay:  "",
    sixPay:    ""
  },

  /* ANALYTICS (optional). Fill in one, or leave both empty.
     ga4Id looks like G-XXXXXXXXXX. plausibleDomain looks like theguysandco.com */
  analytics: {
    ga4Id: "",
    plausibleDomain: ""
  }
};
