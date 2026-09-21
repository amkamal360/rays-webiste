-- Starter content. Run once in Supabase → SQL Editor (it replaces the website content).
-- Editors can also load it from Portal → Brand, contact and links → Load latest starter content.
insert into public.site (id, data) values ('content', $rays${
 "brand": {
  "name": "Rays Microfinance",
  "short": "Rays",
  "tagline": "A digital banking and ethical finance infrastructure powering Ethiopia's financial ecosystem.",
  "motto": "Bank with us. Finance with us. Build with us.",
  "meaning": "Rays: a Somali word for earth made wet by rain, the moment dry ground can grow again.",
  "tagline2": "Ahead of the curve.",
  "domain": "raysfinance.com"
 },
 "home": {
  "lead": "Accounts, ethical financing and payments for people and businesses across Ethiopia. Ask us anything, or pick what you want to do.",
  "capabilities": [
   {
    "title": "Banking",
    "text": "Accounts, savings, cards, cheques and payments for people, groups, NGOs and businesses.",
    "href": "#/personal"
   },
   {
    "title": "Ethical financing",
    "text": "Interest-free Murabaha, Musharaka and Ijara, with digital applications through eMurabaha.",
    "href": "#/financing"
   },
   {
    "title": "Partner with us",
    "text": "Banking as a Service for fintechs and PSPs, white-label wallets with SahayPay, and merchant payments with QPay.",
    "href": "#/partners"
   }
  ],
  "askPlaceholder": "Ask Rays, e.g. How do I open an account?",
  "suggestions": [
   "How do I open an account?",
   "How does eMurabaha work?",
   "Is SahayPay part of Rays?",
   "How do I report fraud?"
  ],
  "tasks": [
   {
    "title": "Open an account",
    "text": "Digitally or at a branch",
    "href": "#/personal/accounts",
    "icon": "account"
   },
   {
    "title": "Get financing",
    "text": "eMurabaha, Murabaha, Ijara",
    "href": "#/financing",
    "icon": "finance"
   },
   {
    "title": "Send and pay",
    "text": "SahayPay app and USSD",
    "href": "#/personal/payments",
    "icon": "wallet"
   },
   {
    "title": "Accept payments",
    "text": "QPay for businesses",
    "href": "#/business/qpay",
    "icon": "qr"
   },
   {
    "title": "Find a branch",
    "text": "40+ branches, 4,000+ agents",
    "href": "#/about/locations",
    "icon": "pin"
   },
   {
    "title": "Get help",
    "text": "FAQs, complaints, fraud",
    "href": "#/about/help",
    "icon": "help"
   }
  ]
 },
 "stats": [
  {
   "value": "1.2M+",
   "label": "Customers"
  },
  {
   "value": "40+",
   "label": "Branches"
  },
  {
   "value": "4,000+",
   "label": "Agents"
  },
  {
   "value": "5M+",
   "label": "Wallet users on SahayPay"
  }
 ],
 "sections": [
  {
   "id": "personal",
   "title": "Personal",
   "nav": true,
   "intro": "Save, pay and get cash, from your phone or a branch.",
   "pages": [
    {
     "id": "accounts",
     "title": "Accounts and savings",
     "lead": "Open a current or savings account digitally or at any branch. Your ATM card and cheque book can be delivered to you.",
     "body": "Bring a valid ID to any branch, or start online. Once your account is approved, Rays can deliver your ATM card and cheque book to your address within Ethiopia.",
     "features": [
      {
       "title": "Current account",
       "text": "For everyday spending and receiving money."
      },
      {
       "title": "Savings account",
       "text": "Save toward your goals, alone or as a group."
      },
      {
       "title": "Group and NGO accounts",
       "text": "For associations, community groups and programmes."
      },
      {
       "title": "Open digitally",
       "text": "Start without visiting a branch."
      }
     ],
     "cta": {
      "label": "Open an account",
      "href": "#/about/contact"
     }
    },
    {
     "id": "payments",
     "title": "SahayPay wallet",
     "lead": "Send money, pay merchants, buy airtime and pay bills from one wallet, on the app or by USSD on any phone.",
     "body": "SahayPay is operated by SahayPay Financial Technologies PLC, a Rays company. It works across mobile networks, and you can cash in and out at thousands of agents.",
     "features": [
      {
       "title": "Send money",
       "text": "To people, banks and mobile money."
      },
      {
       "title": "Pay and top up",
       "text": "Merchants, airtime, bills and utilities."
      },
      {
       "title": "Cash in and out",
       "text": "At supported agents near you."
      },
      {
       "title": "Any phone",
       "text": "App on smartphones, USSD on basic phones."
      }
     ],
     "cta": {
      "label": "Get SahayPay",
      "href": "#/about/contact"
     }
    },
    {
     "id": "cards",
     "title": "ATM cards and cheques",
     "lead": "Withdraw cash with your Rays ATM card and pay by cheque from your current account.",
     "body": "Cards and cheque books are issued after your account is approved and can be delivered to your address.",
     "features": [
      {
       "title": "ATM card",
       "text": "Cash access from your account."
      },
      {
       "title": "Cheque book",
       "text": "For eligible current accounts."
      }
     ],
     "cta": {
      "label": "Open an account",
      "href": "#/about/contact"
     }
    }
   ]
  },
  {
   "id": "business",
   "title": "Business",
   "nav": true,
   "intro": "Get paid, pay people and grow, on one connected account.",
   "pages": [
    {
     "id": "accounts",
     "title": "Business and MSME accounts",
     "lead": "Accounts for businesses of every size, with collections, payments and financing in one place.",
     "body": "Built for micro, small and medium enterprises as well as larger companies and institutions.",
     "features": [
      {
       "title": "Business account",
       "text": "Receive, pay and manage money."
      },
      {
       "title": "MSME support",
       "text": "Working capital and inventory financing."
      }
     ],
     "cta": {
      "label": "Talk to us",
      "href": "#/about/contact"
     }
    },
    {
     "id": "qpay",
     "title": "QPay: accept payments",
     "lead": "Accept QR and digital payments, then settle them straight into your account.",
     "body": "QPay is Rays' merchant payments platform, operated by a Rays company. Want to become a QPay merchant? See Partner with QPay.",
     "features": [
      {
       "title": "QR payments",
       "text": "Customers scan and pay."
      },
      {
       "title": "Collections",
       "text": "From customers, merchants and counterparties."
      },
      {
       "title": "Instant settlement",
       "text": "Through connected payment rails."
      }
     ],
     "cta": {
      "label": "Partner with QPay",
      "href": "#/partners/merchants"
     }
    },
    {
     "id": "payroll",
     "title": "Pay staff and suppliers",
     "lead": "Run salaries, supplier payments, petty cash and bulk disbursements from one account.",
     "body": "Every payment leaves a clear digital trail.",
     "features": [
      {
       "title": "Salaries",
       "text": "Pay staff digitally."
      },
      {
       "title": "Bulk payments",
       "text": "One instruction, many recipients."
      },
      {
       "title": "Supplier payments",
       "text": "Direct and traceable."
      },
      {
       "title": "Petty cash",
       "text": "Less physical cash to manage."
      }
     ],
     "cta": {
      "label": "Talk to us",
      "href": "#/about/contact"
     }
    }
   ]
  },
  {
   "id": "financing",
   "title": "Financing",
   "nav": true,
   "intro": "Interest-free financing tied to real assets, with transparent terms.",
   "pages": [
    {
     "id": "emurabaha",
     "title": "eMurabaha",
     "lead": "Apply for Murabaha financing from your phone: register, apply, get verified and receive a decision without starting at a branch.",
     "body": "eMurabaha combines digital onboarding, verification and scoring for individuals and MSMEs.",
     "calculator": true,
     "steps": [
      {
       "title": "Register",
       "text": "Create your profile digitally."
      },
      {
       "title": "Apply",
       "text": "Provide the information required for your financing request."
      },
      {
       "title": "Verify",
       "text": "Rays validates your information through digital and risk-management processes."
      },
      {
       "title": "Score",
       "text": "The platform evaluates eligibility and risk."
      },
      {
       "title": "Qualify",
       "text": "Eligible customers receive a financing decision."
      },
      {
       "title": "Finance",
       "text": "Approved financing is processed through Rays infrastructure."
      }
     ],
     "cta": {
      "label": "Apply with eMurabaha",
      "href": "#/about/contact"
     }
    },
    {
     "id": "murabaha",
     "title": "Murabaha",
     "lead": "Rays buys the asset or goods you need and sells them to you at the disclosed cost plus an agreed profit, paid in instalments.",
     "body": "You know the full price from the start, and every financing is tied to a real purchase.",
     "calculator": true,
     "features": [
      {
       "title": "Transparent price",
       "text": "Cost and profit agreed upfront."
      },
      {
       "title": "Real assets",
       "text": "No cash loans, no interest."
      }
     ],
     "cta": {
      "label": "Talk to us",
      "href": "#/about/contact"
     }
    },
    {
     "id": "musharaka",
     "title": "Musharaka",
     "lead": "Partnership financing: Rays and you share in a productive business activity and its outcome.",
     "body": "Suited to ventures with real economic output.",
     "cta": {
      "label": "Talk to us",
      "href": "#/about/contact"
     }
    },
    {
     "id": "ijara",
     "title": "Ijara",
     "lead": "Leasing: Rays buys equipment, vehicles or property and leases it to you for an agreed rental and period.",
     "body": "Put assets to work without paying the full cost upfront.",
     "cta": {
      "label": "Talk to us",
      "href": "#/about/contact"
     }
    }
   ]
  },
  {
   "id": "partners",
   "title": "Partner with Us",
   "nav": true,
   "intro": "Rays owns a fintech hub. Pick the company that fits what you want to build.",
   "pages": [
    {
     "id": "group",
     "title": "The Rays group",
     "kind": "group",
     "lead": "Rays Microfinance owns the group. SahayPay, QPay, eMurabaha and FinSharia are each operated by a Rays company.",
     "body": "Customers, merchants and partners get one connected ecosystem, with a clear owner for every platform.",
     "cta": {
      "label": "Talk to us",
      "href": "#/about/contact"
     }
    },
    {
     "id": "baas",
     "title": "Banking as a Service",
     "lead": "For fintechs, tech companies, PSPs and payment gateways: build on Rays' licensed banking layer through our APIs.",
     "body": "Rays provides the regulated accounts, settlement and payment connectivity, so you can focus on your product. Rays holds a National Settlement Account and connects to EthSwitch, major banks and mobile money.",
     "features": [
      {
       "title": "Accounts and wallets",
       "text": "Open and run accounts for your customers."
      },
      {
       "title": "Collections and disbursements",
       "text": "Receive and pay out at scale."
      },
      {
       "title": "Settlement",
       "text": "Through Rays' National Settlement Account."
      },
      {
       "title": "APIs with controls",
       "text": "Limits, idempotency and audit trails built in."
      }
     ],
     "list": [
      "National banking infrastructure",
      "EthSwitch",
      "Commercial Bank of Ethiopia",
      "Dashen Bank",
      "Awash Bank",
      "Bank of Abyssinia",
      "Cooperative Bank of Oromia",
      "Telebirr"
     ],
     "cta": {
      "label": "Talk to Rays about BaaS",
      "href": "#/about/contact"
     }
    },
    {
     "id": "white-label",
     "title": "White-label wallet: partner with SahayPay",
     "lead": "Banks and MFIs can launch a wallet under their own brand on SahayPay, already live with Hijra Bank and Rammis Bank.",
     "body": "SahayPay is operated by SahayPay Financial Technologies PLC, a Rays company. You keep your brand and customers; SahayPay runs the platform: app, USSD, agents and merchants.",
     "features": [
      {
       "title": "Your brand",
       "text": "Your name and app, your customers."
      },
      {
       "title": "Proven platform",
       "text": "Powering deployments with 5M+ registered users."
      },
      {
       "title": "App and USSD",
       "text": "Works on smartphones and basic phones."
      },
      {
       "title": "Agents and merchants",
       "text": "Cash-in, cash-out and payments built in."
      }
     ],
     "cta": {
      "label": "Partner with SahayPay",
      "href": "#/about/contact"
     }
    },
    {
     "id": "merchants",
     "title": "Merchants: partner with QPay",
     "lead": "Shops, businesses and institutions accept QR and digital payments with QPay and get settled into their account.",
     "body": "QPay is operated by a Rays company. It also handles bulk, salary and supplier payments.",
     "features": [
      {
       "title": "Accept QR payments",
       "text": "Customers scan and pay."
      },
      {
       "title": "Fast settlement",
       "text": "Into your account."
      },
      {
       "title": "Pay out",
       "text": "Salaries, suppliers and bulk payments."
      }
     ],
     "cta": {
      "label": "Partner with QPay",
      "href": "#/about/contact"
     }
    },
    {
     "id": "finsharia",
     "title": "FinSharia core banking",
     "lead": "The in-house ethical core banking platform behind the group: ledger, accounts, financing structures, controls and reporting.",
     "body": "FinSharia is developed and operated by a Rays company, so the core evolves with our products.",
     "list": [
      "Customer management",
      "Accounts and transactions",
      "Branch operations",
      "General ledger",
      "Ethical financing structures",
      "Workflows",
      "Charges and financial rules",
      "Financial controls",
      "Reporting and auditability",
      "Digital channel integration"
     ],
     "cta": {
      "label": "Talk to us",
      "href": "#/about/contact"
     }
    },
    {
     "id": "partnerships",
     "title": "Our partners",
     "kind": "partners",
     "lead": "Development partners, banks and businesses we work with.",
     "body": "Want to work with us? Tell us what you have in mind.",
     "cta": {
      "label": "Become a partner",
      "href": "#/about/contact"
     }
    }
   ]
  },
  {
   "id": "about",
   "title": "About",
   "nav": false,
   "intro": "Building financial infrastructure for growth.",
   "pages": [
    {
     "id": "story",
     "title": "Our story",
     "lead": "Established in 2014 to expand access to finance, and to build the technology to deliver it.",
     "body": "Rays is a Somali word for earth made wet by rain: the transformation of dry ground when rain arrives and creates the conditions for new growth.\n\nRays Microfinance was established in 2014 with a simple objective: expand access to financial services while building the technology required to deliver them. Today we serve individuals, groups, NGOs, businesses and MSMEs directly, and provide technology and infrastructure to other financial institutions and fintechs.",
     "features": [
      {
       "title": "Simple",
       "text": "Financial services should be understandable and easy to access."
      },
      {
       "title": "Connected",
       "text": "Customers shouldn't have to think about which institution sits behind a transaction."
      },
      {
       "title": "Ethical",
       "text": "Financing structured around transparent, responsible principles."
      },
      {
       "title": "Digital",
       "text": "Remove friction, don't just move paper onto a screen."
      },
      {
       "title": "Reliable",
       "text": "Infrastructure must work when people depend on it."
      },
      {
       "title": "Inclusive",
       "text": "Accessible to individuals, businesses and communities across Ethiopia."
      }
     ]
    },
    {
     "id": "help",
     "title": "Help and FAQs",
     "kind": "faq",
     "lead": "Answers to the questions we hear most.",
     "body": "Can't find what you need? Contact us and our team will help."
    },
    {
     "id": "locations",
     "title": "Branches and agents",
     "kind": "locations",
     "lead": "Find a Rays branch or agent near you.",
     "body": "Rays serves customers through 40+ branches and 4,000+ agents across Ethiopia."
    },
    {
     "id": "careers",
     "title": "Careers",
     "lead": "Build the infrastructure behind financial services.",
     "body": "We build financial technology in Ethiopia, from the core banking layer to digital wallets, payments, financing and connectivity. If you want to work where software meets real financial infrastructure, we'd like to hear from you.\n\nWe also hire across branch operations, finance, risk, compliance and customer service.",
     "cta": null,
     "kind": "careers"
    },
    {
     "id": "downloads",
     "title": "Downloads",
     "kind": "downloads",
     "lead": "Forms, tariffs, reports and brochures.",
     "body": ""
    },
    {
     "id": "regulatory",
     "title": "Regulatory",
     "lead": "A regulated financial institution.",
     "body": "Rays operates as a regulated microfinance institution in Ethiopia. Our services are supported by national financial infrastructure, settlement capabilities, payment connectivity and internally developed technology platforms.\n\nWe work within the applicable regulatory framework and maintain the operational, financial and technology controls our customers and institutional partners rely on."
    },
    {
     "id": "contact",
     "title": "Contact",
     "kind": "contact",
     "lead": "Let's build what comes next.",
     "body": "Whether you're looking for an account, ethical financing, merchant payments, wallet infrastructure or a technology partnership, our teams are ready to help."
    }
   ]
  }
 ],
 "contact": {
  "phone": "",
  "email": "",
  "address": "Addis Ababa, Ethiopia",
  "hours": "",
  "whatsapp": "",
  "telegram": "",
  "ussd": "",
  "tollfree": ""
 },
 "languages": [
  "English",
  "አማርኛ",
  "Soomaali",
  "Afaan Oromoo",
  "العربية"
 ],
 "calculator": {
  "enabled": false,
  "profitRate": null,
  "minMonths": 3,
  "maxMonths": 36,
  "note": "This is an indicative estimate only. Your actual financing amount, profit and instalments depend on eligibility, the asset and the terms in your signed agreement."
 },
 "announcement": {
  "active": false,
  "text": "",
  "link": ""
 },
 "social": {
  "facebook": "",
  "telegram": "",
  "linkedin": "",
  "x": "",
  "youtube": "",
  "tiktok": "",
  "instagram": ""
 },
 "apps": {
  "android": "",
  "ios": ""
 },
 "branches": [],
 "downloads": [],
 "jobs": [
  {
   "id": "example-backend-engineer",
   "title": "Backend Engineer (Java)",
   "department": "Technology",
   "location": "Addis Ababa",
   "type": "Full-time",
   "closes": "",
   "status": "draft",
   "summary": "Example listing. Edit it, or delete it, in the portal before opening it.",
   "body": "## About the role\nYou'll build and run the services behind SahayPay, QPay, eMurabaha and FinSharia.\n\n## What you'll do\n- Design and build APIs and payment integrations\n- Keep transaction processing correct, idempotent and auditable\n- Work with product, risk and operations on new features\n\n## What we're looking for\n- Strong Java experience (Spring Boot or Vert.x)\n- SQL Server or another relational database\n- Care for correctness in financial systems"
  }
 ],
 "faqs": [
  {
   "q": "Are SahayPay, QPay, eMurabaha and FinSharia part of Rays?",
   "a": "Yes. Rays Microfinance owns a fintech hub, and each platform is operated by a Rays company: SahayPay by SahayPay Financial Technologies PLC, and QPay, eMurabaha and FinSharia by other Rays companies. See The Rays group page for who does what.",
   "category": "About Rays"
  },
  {
   "q": "How do I open an account?",
   "a": "You can start digitally or visit any Rays branch. Bring a valid identification document. Once your account is approved, Rays can arrange delivery of your ATM card and cheque book to your address within Ethiopia.",
   "category": "Accounts"
  },
  {
   "q": "Is Rays financing Sharia-compliant?",
   "a": "Rays financing is built on ethical structures such as Murabaha, Musharaka and Ijara, which are tied to real assets and economic activity rather than interest-bearing loans. See our Sharia compliance statement for details.",
   "category": "Financing"
  },
  {
   "q": "How does eMurabaha work?",
   "a": "Register, apply with the required information, and Rays verifies and scores your application digitally. Eligible customers receive a financing decision, and approved financing is processed through Rays infrastructure.",
   "category": "Financing"
  },
  {
   "q": "Can I use SahayPay without a smartphone?",
   "a": "Yes. SahayPay works through the app and through USSD on basic phones, across supported mobile networks.",
   "category": "SahayPay"
  },
  {
   "q": "Which banks and wallets can I send money to?",
   "a": "Rays is connected to national payment infrastructure including EthSwitch, major banks such as CBE, Dashen, Awash, Bank of Abyssinia and Cooperative Bank of Oromia, and mobile money services such as Telebirr.",
   "category": "Payments"
  },
  {
   "q": "How can my business accept digital payments?",
   "a": "Open a QPay merchant account to accept QR and digital payments, pay suppliers and staff, and settle collected funds.",
   "category": "Business"
  },
  {
   "q": "How do I report fraud or a suspicious transaction?",
   "a": "Contact us straight away by phone, the contact form or at any branch, and tell us what happened. If you shared your PIN or code, or lost your phone, say so, so we can protect your account. Rays will never ask for your PIN, password or one-time code.",
   "category": "Security"
  },
  {
   "q": "Someone asked me for my PIN or code. What should I do?",
   "a": "Never share your PIN, password or one-time code with anyone, including people who say they are from Rays. Rays staff will never ask for them. Contact us immediately and read our security and fraud guidance.",
   "category": "Security"
  },
  {
   "q": "How do I make a complaint?",
   "a": "Contact any branch or use the contact form. Our complaints policy explains how we handle complaints, how long it takes and how to escalate if you're not satisfied.",
   "category": "Support"
  },
  {
   "q": "Our bank or MFI wants its own wallet. Who do we talk to?",
   "a": "Partner with SahayPay for a white-label wallet under your own brand. SahayPay already powers wallets for Hijra Bank and Rammis Bank. Contact us and choose \"A bank or MFI\".",
   "category": "Partners"
  },
  {
   "q": "I'm a merchant. How do I start accepting payments?",
   "a": "Partner with QPay to accept QR and digital payments and get settled into your account. Contact us and choose \"A merchant\".",
   "category": "Partners"
  },
  {
   "q": "We're a fintech, PSP or payment gateway. How can we work with Rays?",
   "a": "Talk to Rays about Banking as a Service: accounts, collections, disbursements and settlement through our APIs, on a licensed banking layer. Contact us and choose \"A fintech, PSP or payment gateway\".",
   "category": "Partners"
  }
 ],
 "policies": [
  {
   "id": "privacy",
   "title": "Privacy policy",
   "summary": "How Rays collects, uses, shares and protects your personal data, and your rights over it.",
   "updated": "2026-09-21",
   "published": true,
   "reviewed": false,
   "body": "Rays Microfinance Institution S.C. (\"Rays\", \"we\", \"us\") respects your privacy. This policy explains how we handle personal data when you use our website, digital channels (including SahayPay, QPay and eMurabaha), branches and agents, and when you apply for a job with us.\n\nWe process personal data in line with the Personal Data Protection Proclamation of Ethiopia and the directives of the National Bank of Ethiopia that apply to us.\n\n## Who is responsible for your data\nRays Microfinance Institution S.C., [registered address], Addis Ababa, Ethiopia, is the controller of your personal data. You can contact our data protection officer at [privacy email] or at any branch.\n\n## What we collect\n- Identity and contact details: name, date of birth, national ID or other identification, photo, phone number, email and address\n- Account and transaction information: account numbers, balances, payments, transfers and financing records\n- Know-your-customer and risk information we're required to collect by law, including information from verification and credit-reference sources\n- Device and usage information when you use our digital channels, such as device identifiers, IP address and app activity\n- Information you give us when you contact us, make a complaint or apply for a job, including CVs\n- Business information for merchant, MSME and institutional customers\n\n## Why we use it\n- To open and run your accounts and provide the services you ask for\n- To assess eligibility and manage financing, including scoring and verification\n- To meet legal and regulatory duties, including anti-money-laundering, counter-terrorist-financing, sanctions screening and reporting to regulators\n- To prevent and detect fraud and keep our services secure\n- To respond to your enquiries and complaints\n- To improve our products and services\n- To send service messages, and marketing only where you have agreed or the law allows\n\nWe rely on one or more of these grounds: performing a contract with you, complying with the law, our legitimate interests (such as fraud prevention and service improvement), and your consent where it's required.\n\n## Questions you ask on our website\nIf you use Ask Rays, we send your question and relevant parts of our public website to an AI service provider to write the answer. Please don't include personal details such as account numbers, PINs or ID numbers. We keep questions for up to 90 days, with long numbers removed, to improve our answers.\n\n## Website statistics\nWe count page visits, searches and button clicks to understand what visitors need. We don't use cookies for this, don't store your IP address, and can't identify you from these statistics.\n\n## Who we share it with\nWe share personal data only where needed, with:\n- Regulators, law enforcement and other authorities where the law requires it\n- Payment networks and partners that process your transactions, such as EthSwitch, banks and mobile money providers\n- Credit-reference and identity-verification services\n- Service providers who work for us under contract, such as IT, hosting, messaging and card-production providers\n- Financial institutions that use Rays infrastructure, where you are their customer\n\nWe don't sell your personal data.\n\n## Transfers outside Ethiopia\nSome of our service providers may store or process data outside Ethiopia. Where that happens, we put safeguards in place as required by law.\n\n## How long we keep it\nWe keep personal data for as long as your relationship with us lasts, and afterwards for the period the law requires, generally [number] years for account and transaction records. Job applications are kept for [number] months unless you ask us to keep them longer.\n\n## Your rights\nSubject to the law, you can ask us to:\n- Give you access to your personal data\n- Correct inaccurate data\n- Delete data we no longer need\n- Restrict or object to certain processing\n- Withdraw consent you've given, without affecting earlier processing\n\nTo make a request, contact us at [privacy email] or visit a branch. If you're not satisfied with our response, you can complain to the Ethiopian data protection authority.\n\n## Security\nWe protect personal data with technical and organisational measures, including access controls, encryption, monitoring and staff training.\n\n## Changes\nWe may update this policy. We'll post the new version here with its date, and tell you directly about significant changes."
  },
  {
   "id": "terms",
   "title": "Terms and conditions",
   "summary": "The terms that apply when you use the Rays website and digital channels.",
   "updated": "2026-09-21",
   "published": true,
   "reviewed": false,
   "body": "These terms apply to your use of the Rays website and our digital channels. Your use of specific products (accounts, SahayPay, QPay, eMurabaha and others) is also governed by the product terms and agreements you sign with us. If there's a conflict, the product terms apply.\n\n## Using this website\nThe information on this website is general. It isn't an offer, advice or a commitment to provide any product. Products, eligibility, fees and profit rates are subject to our assessment, applicable law and the terms of your agreement.\n\n## Digital channels\n- Keep your PIN, password and one-time codes secret. You're responsible for transactions made with your credentials until you tell us they've been compromised.\n- Tell us immediately if your phone is lost or stolen, or you suspect unauthorised use.\n- We may suspend access to protect you or us, for maintenance, or where the law requires.\n- Transaction limits set by us and by the National Bank of Ethiopia apply.\n\n## Calculators and estimates\nAny calculator on this website gives an indicative estimate only. It isn't an approval or an offer of financing.\n\n## Intellectual property\nThe Rays name, logo, the \"Ahead of the curve.\" tagline, and the content of this website belong to Rays or its licensors. You may not copy or use them without our written permission.\n\n## Links to other websites\nWe're not responsible for the content or security of websites we link to.\n\n## Liability\nWe work to keep this website accurate and available, but we don't guarantee it will always be error-free or uninterrupted. To the extent the law allows, we're not liable for loss arising from your use of this website. Nothing in these terms limits rights you have under Ethiopian consumer protection law.\n\n## Governing law\nThese terms are governed by the laws of the Federal Democratic Republic of Ethiopia. Disputes are subject to the courts of Ethiopia.\n\n## Changes\nWe may update these terms by posting a new version here."
  },
  {
   "id": "cookies",
   "title": "Cookies and storage",
   "summary": "What this website stores on your device and why.",
   "updated": "2026-09-21",
   "published": true,
   "reviewed": false,
   "body": "This website doesn't use advertising or tracking cookies.\n\n## What we store\n- **Page content cache.** A copy of the public website content is kept in your browser's local storage so pages open faster on your next visit. It contains no personal data.\n- **Portal sign-in.** If you're a Rays website editor, your sign-in session is kept in local storage so you stay signed in.\n\nThese are strictly necessary for the website to work as you'd expect, so we don't ask for consent to use them.\n\n## Statistics without cookies\nWe count visits, searches and clicks without cookies and without storing your IP address. A daily, one-way code lets us count unique visitors for that day only; it can't be linked back to you or across days. If your browser sends a \"Do Not Track\" signal, we don't count you at all.\n\n## Removing stored data\nYou can clear this website's data at any time in your browser settings."
  },
  {
   "id": "complaints",
   "title": "Complaints and customer feedback",
   "summary": "How to raise a complaint, what happens next, and how to escalate.",
   "updated": "2026-09-21",
   "published": true,
   "reviewed": false,
   "body": "We want to hear when something goes wrong, so we can put it right.\n\n## How to complain\n- Visit any Rays branch\n- Call us on [phone number]\n- Email [complaints email]\n- Use the contact form on this website\n\nPlease tell us your name, how to reach you, your account or transaction reference if you have one, and what happened.\n\n## What happens next\n1. We acknowledge your complaint within [number] working days.\n2. We investigate and aim to resolve it within [number] working days. If it's complex, we'll tell you why it's taking longer and when to expect an answer.\n3. We tell you the outcome in writing and explain what we've done.\n\nMaking a complaint is free.\n\n## If you're not satisfied\nIf you're not happy with our response, or we haven't responded in time, you can escalate your complaint to the National Bank of Ethiopia's financial consumer protection function.\n\n## Feedback\nCompliments and suggestions are welcome too. Use the same channels."
  },
  {
   "id": "security",
   "title": "Security and fraud awareness",
   "summary": "How to protect yourself, and what Rays will never ask you for.",
   "updated": "2026-09-21",
   "published": true,
   "reviewed": false,
   "body": "Fraudsters often pretend to be from banks or wallet providers. Knowing what we will and won't do helps you stay safe.\n\n## Rays will never\n- Ask for your PIN, password or one-time code, by phone, SMS, email or social media\n- Ask you to send money to \"verify\" or \"unlock\" your account\n- Ask you to install remote-access apps on your phone\n- Send you links asking you to sign in to a website that isn't ours\n\n## Protect yourself\n- Keep your PIN secret and cover the keypad when you enter it\n- Don't let anyone else use your phone to make transactions\n- Check the recipient's name before you confirm a transfer\n- Download the SahayPay app only from the official app stores\n- Be wary of offers that seem too good to be true, or messages that create urgency\n\n## If something goes wrong\nContact us immediately on [phone number] or visit a branch. Tell us if:\n- Your phone or SIM is lost or stolen\n- You shared your PIN or code with someone\n- You see a transaction you don't recognise\n\nThe sooner you tell us, the more we can do to help.\n\n## Reporting a security issue\nIf you've found a security vulnerability in our systems, please email [security email]. Don't test it against real customer accounts."
  },
  {
   "id": "aml",
   "title": "Anti-money laundering and KYC",
   "summary": "Our commitment to preventing financial crime, and why we ask for identification.",
   "updated": "2026-09-21",
   "published": true,
   "reviewed": false,
   "body": "Rays is committed to preventing money laundering, terrorist financing and other financial crime. We comply with Ethiopian anti-money-laundering and counter-terrorist-financing law, the requirements of the Financial Intelligence Service, and the directives of the National Bank of Ethiopia.\n\n## What this means for you\n- **Identification.** We verify the identity of every customer before opening an account, and of business owners and controllers for business accounts.\n- **Keeping information up to date.** We may ask you to update your details or documents from time to time.\n- **Understanding transactions.** We may ask about the purpose of a transaction or the source of funds.\n- **Monitoring.** We monitor transactions, screen against sanctions lists, and report suspicious activity to the authorities as the law requires.\n\nWe may decline or delay a transaction, or close an account, where we're required to by law or where we can't complete our checks.\n\n## Our programme\nOur programme includes customer due diligence, risk assessment, transaction monitoring, record keeping, staff training and independent review, overseen by our compliance officer."
  },
  {
   "id": "sharia",
   "title": "Sharia compliance statement",
   "summary": "How Rays ethical financing is structured and governed.",
   "updated": "2026-09-21",
   "published": true,
   "reviewed": false,
   "body": "Rays offers financing based on ethical, Sharia-compliant structures, including Murabaha, e-Murabaha, Musharaka and Ijara.\n\n## Our principles\n- **No interest.** Financing is not based on interest-bearing lending.\n- **Real assets and activity.** Every financing is linked to a real asset purchase, lease or productive activity.\n- **Transparency.** In Murabaha, the cost of the asset and the agreed profit are disclosed before you sign.\n- **Shared risk.** In Musharaka, Rays and the customer share in the outcome of the underlying activity according to agreed terms.\n\n## Governance\nOur products and their documentation are reviewed by [name of Sharia advisory committee or scholar], who provide guidance and periodic review of our operations.\n\n## Questions\nIf you have a question about how a product is structured, ask at any branch or contact us."
  },
  {
   "id": "accessibility",
   "title": "Accessibility",
   "summary": "Our commitment to making the website usable for everyone.",
   "updated": "2026-09-21",
   "published": true,
   "reviewed": false,
   "body": "We want everyone to be able to use this website, including people who use screen readers, keyboard navigation, larger text or reduced motion.\n\n## What we do\n- We aim to meet the Web Content Accessibility Guidelines (WCAG) 2.1 at level AA\n- Pages work without a mouse, and focus is always visible\n- Animation is reduced or removed if your device asks for less motion\n- Pages are light and fast, so they work well on basic smartphones and slower connections\n\n## Tell us about a problem\nIf you find something hard to use, contact us and tell us the page and what happened. We'll work to fix it."
  }
 ],
 "group": {
  "intro": "Rays Microfinance owns a fintech hub. Each platform is run by its own Rays company, so you always know who to talk to.",
  "companies": [
   {
    "name": "Rays Microfinance",
    "product": "Banking and Banking as a Service",
    "operator": "Rays Microfinance Institution S.C.",
    "for": "Individuals, businesses, fintechs, tech companies, PSPs and payment gateways",
    "text": "Accounts, savings, financing, payments, settlement and the licensed banking layer behind the group.",
    "href": "#/partners/baas",
    "cta": "Banking as a Service"
   },
   {
    "name": "SahayPay",
    "product": "Digital wallet",
    "operator": "SahayPay Financial Technologies PLC",
    "for": "Wallet users, and banks and MFIs that want their own wallet",
    "text": "The telco-agnostic wallet (app and USSD), also offered to institutions as a white-label wallet.",
    "href": "#/partners/white-label",
    "cta": "Partner with SahayPay"
   },
   {
    "name": "QPay",
    "product": "Merchant payments",
    "operator": "",
    "for": "Merchants, businesses and institutions",
    "text": "QR acceptance, collections, settlement, bulk and supplier payments.",
    "href": "#/partners/merchants",
    "cta": "Partner with QPay"
   },
   {
    "name": "eMurabaha",
    "product": "Digital financing",
    "operator": "",
    "for": "Individuals and MSMEs",
    "text": "Digital origination, verification and scoring for Sharia-compliant Murabaha financing.",
    "href": "#/financing/emurabaha",
    "cta": "Apply with eMurabaha"
   },
   {
    "name": "FinSharia",
    "product": "Core banking",
    "operator": "",
    "for": "Financial institutions",
    "text": "The in-house ethical core banking platform: ledger, accounts, financing structures and controls.",
    "href": "#/partners/finsharia",
    "cta": "About FinSharia"
   }
  ]
 },
 "partners": [
  {
   "name": "Mercy Corps",
   "category": "NGOs and development partners",
   "text": "",
   "url": "",
   "mediaId": ""
  },
  {
   "name": "SNV",
   "category": "NGOs and development partners",
   "text": "",
   "url": "",
   "mediaId": ""
  },
  {
   "name": "Hijra Bank",
   "category": "Banks running a white-label SahayPay wallet",
   "text": "",
   "url": "",
   "mediaId": ""
  },
  {
   "name": "Rammis Bank",
   "category": "Banks running a white-label SahayPay wallet",
   "text": "",
   "url": "",
   "mediaId": ""
  },
  {
   "name": "HudHud Express",
   "category": "Business partners",
   "text": "",
   "url": "",
   "mediaId": ""
  },
  {
   "name": "CommercePal",
   "category": "Business partners",
   "text": "",
   "url": "",
   "mediaId": ""
  }
 ]
}$rays$::jsonb)
on conflict (id) do update set data = excluded.data, updated_at = now();

insert into public.posts (id, data, published, date) values ('welcome', $rays${"title": "SahayPay now powers 5 million+ wallet customers", "kind": "article", "excerpt": "Hijra Bank and Rammis Bank run white-label wallets on SahayPay, the digital wallet operated by SahayPay Financial Technologies PLC, a Rays company.", "body": "SahayPay, the telco-agnostic digital wallet operated by SahayPay Financial Technologies PLC, now powers wallet deployments serving a combined 5 million+ registered customers.\n\nBanks and MFIs can launch a wallet under their own brand without building the platform themselves. See Partner with Us.", "coverId": "", "videoId": "", "mediaIds": []}$rays$::jsonb, true, '2026-09-21')
on conflict (id) do update set data = excluded.data;
