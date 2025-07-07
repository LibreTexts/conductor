const COMMON_ITEMS = [
  {
    question: "What is your return policy?",
    answer:
      "We do not accept returns for physical books. However, if you have any issues with the processing of your order, please contact our Support Center and we will do our best to resolve the issue.",
  },
  {
    question: "Are discounts available for bulk purchases?",
    answer:
      "Yes, we offer discounts for bulk purchases. Please contact our Support Center with details about your order, and we will provide you with a custom quote.",
  },
  {
    question: "How long does shipping take?",
    answer:
      "Shipping times vary based on your location and the shipping method selected at checkout. Typically, domestic orders take 5-10 business days, while international orders may take longer depending on customs processing.",
  },
  {
    question: "Can I track my order?",
    answer:
      "Yes, once your order has been shipped, you will receive a tracking number via email to monitor the status of your shipment. Digital products do not require shipping and access information will be provided via email immediately after purchase.",
  },
  {
    question: "What payment methods do you accept?",
    answer:
      "We accept various payment methods including credit/debit cards, PayPal, and more. All payments are processed by our secure payment partner, Stripe. We never store your payment information.",
  },
  {
    question: "How can I contact customer support?",
    answer:
      "You can reach our Support Center by visiting https://support.libretexts.org. Please provide as much detail as possible about your issue to help us assist you more effectively.",
  },

]

export const BOOK_FAQS = [
  {
    question: "Why do I have to pay for this book?",
    answer:
      "You don't have to! You can read this book absolutely for free online and/or download it in various formats. However, if you prefer a physical copy of the book, the cost is to cover the printing and shipping expenses along with a minor administrative fee to help maintain the bookstore.",
  },
  ...COMMON_ITEMS
];

export const APP_LICENSE_FAQS = [
  {
    question: "Why do I have to pay for this app?",
    answer: "LibreTexts is a non-profit organization that provides a platform for Open Education Resources. Creating and reading textbooks on our platform will always be free. However, some of our specialized applications require a subscription to cover the costs of development, maintenance, and support. Your subscription helps us continue to improve our services and provide a better experience for all users.",
  },
  ...COMMON_ITEMS
];
