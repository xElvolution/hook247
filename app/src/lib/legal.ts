export type LegalBlock = {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
  after?: string[];
};

export type LegalDoc = {
  slug: string;
  href: string;
  title: string;
  short: string;
  effective: string;
  intro: string[];
  sections: LegalBlock[];
};

export const LEGAL_EFFECTIVE = "8 October 2026";

export const LEGAL_LINKS: { href: string; label: string }[] = [
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
  { href: "/cookies", label: "Cookies" },
  { href: "/guidelines", label: "Safety" },
  { href: "/payments-policy", label: "Payments" },
  { href: "/contact", label: "Contact" },
];

export const TERMS: LegalDoc = {
  slug: "terms",
  href: "/terms",
  title: "Terms of Service",
  short: "Terms of Service",
  effective: LEGAL_EFFECTIVE,
  intro: [
    "By creating an account or using Flirta247, you agree to these Terms of Service.",
    "If you do not agree with these Terms, do not use the platform.",
  ],
  sections: [
    {
      heading: "1. Eligibility",
      paragraphs: [
        "Flirta247 is strictly for persons 18 years of age or older.",
        "You must provide accurate information when creating an account.",
        "You may not create an account for another person without their authorisation.",
      ],
    },
    {
      heading: "2. Accounts",
      paragraphs: ["You are responsible for:"],
      bullets: [
        "Keeping your login information secure",
        "Providing accurate information",
        "Maintaining only permitted accounts",
        "All activity conducted through your account",
      ],
      after: ["We may suspend or terminate accounts that violate these Terms."],
    },
    {
      heading: "3. Identity verification",
      paragraphs: [
        "Flirta247 may require identity, age or facial/liveness verification.",
        "Users must provide their own genuine information and must not submit another person's identification.",
        "Attempting to manipulate or bypass verification may result in account suspension or permanent termination.",
      ],
    },
    {
      heading: "4. Profiles",
      paragraphs: ["You must not:"],
      bullets: [
        "Impersonate another person",
        "Use misleading information",
        "Upload stolen photographs",
        "Create fake accounts",
        "Misrepresent your age",
        "Misrepresent your identity",
      ],
    },
    {
      heading: "5. Messaging and interaction",
      paragraphs: [
        "Users are responsible for the content of their communications.",
        "Harassment, threats, blackmail, fraud, exploitation and abusive behaviour are prohibited.",
      ],
    },
    {
      heading: "6. Live features",
      paragraphs: [
        "Live content must comply with Flirta247's Community & Safety Guidelines.",
        "Flirta247 may remove Live sessions, restrict Live access or terminate accounts that violate the rules.",
      ],
    },
    {
      heading: "7. Virtual credits and gifts",
      paragraphs: [
        "Where available, Flirta247 may allow users to purchase credits or virtual gifts.",
        "Virtual credits are not cash, bank deposits or financial accounts.",
        "Credits may only be used within Flirta247 for permitted purposes.",
      ],
    },
    {
      heading: "8. Creator earnings",
      paragraphs: [
        "Where creator monetisation is available, eligible users may receive earnings according to the applicable Flirta247 creator programme.",
        "Eligibility, fees, minimum withdrawal amounts and payout rules may apply.",
      ],
    },
    {
      heading: "9. Prohibited activities",
      paragraphs: ["You may not use Flirta247 for:"],
      bullets: [
        "Fraud",
        "Scams",
        "Money laundering",
        "Identity theft",
        "Human trafficking",
        "Exploitation",
        "Blackmail",
        "Extortion",
        "Illegal transactions",
        "Non-consensual intimate content",
        "Content involving minors",
        "Hacking or unauthorised access",
        "Spam",
        "Automated abuse",
        "Manipulating referrals or rewards",
        "Circumventing platform restrictions",
        "Any activity that violates applicable law",
      ],
    },
    {
      heading: "10. Account suspension or termination",
      paragraphs: [
        "We may suspend, restrict or terminate accounts where we reasonably believe that a user has violated these Terms, endangered another user, committed fraud, abused the platform or created a security or legal risk.",
        "We may also restrict access to certain features while an investigation is ongoing.",
      ],
    },
    {
      heading: "11. Disclaimer",
      paragraphs: [
        "Flirta247 provides an online platform for user interaction.",
        "We do not guarantee that a user is who they claim to be or that any relationship or interaction will result in a particular outcome.",
        "Users should exercise appropriate caution when interacting with or meeting people offline.",
      ],
    },
    {
      heading: "12. Changes",
      paragraphs: [
        "We may update these Terms when necessary.",
        "Continued use of Flirta247 after an update constitutes acceptance of the revised Terms where permitted by law.",
      ],
    },
  ],
};

export const PRIVACY: LegalDoc = {
  slug: "privacy",
  href: "/privacy",
  title: "Privacy Policy",
  short: "Privacy Policy",
  effective: LEGAL_EFFECTIVE,
  intro: [
    "Flirta247 (“Flirta247”, “we”, “us”, or “our”) respects your privacy and is committed to protecting your personal information.",
    "This Privacy Policy explains what information we collect, how we use it, how we protect it, and your rights when you use the Flirta247 website, applications and services.",
  ],
  sections: [
    {
      heading: "1. Information we collect",
      paragraphs: ["Depending on how you use Flirta247, we may collect:"],
      bullets: [
        "Full name or display name",
        "Email address",
        "Phone number",
        "Date of birth",
        "Gender",
        "Profile photographs",
        "Location and approximate location",
        "Login information",
        "Device and browser information",
        "IP address",
        "Messages and other communications",
        "Live-streaming and interaction information",
        "Transaction and payment information",
        "Referral information",
        "Identity and account verification information",
        "Government-issued identification information where required",
                "Facial and liveness verification information where required",
        "Information you voluntarily provide in your profile",
      ],
      after: ["Payment transactions may be processed through third-party payment providers."],
    },
    {
      heading: "2. How we use your information",
      paragraphs: ["We may use your information to:"],
      bullets: [
        "Create and manage your account",
        "Verify your identity and age",
        "Prevent fake accounts and fraud",
        "Operate dating, social and Live features",
        "Process payments, withdrawals and refunds",
        "Process referrals and rewards",
        "Provide customer support",
        "Improve and personalise the platform",
        "Detect fraud, abuse and suspicious activity",
        "Protect users and the platform",
        "Investigate reports and complaints",
        "Enforce our policies",
        "Comply with applicable laws and legal obligations",
      ],
    },
    {
      heading: "3. Identity and age verification",
      paragraphs: [
        "Flirta247 is an 18+ platform.",
        "We may require users to complete identity, age or account verification.",
        "Verification may involve:",
      ],
      bullets: [
        "Government-issued identification",
                "Facial verification",
        "Liveness verification",
        "Phone verification",
        "Email verification",
        "Other appropriate verification methods",
      ],
      after: [
        "Users must provide their own genuine information and must not submit another person's identity documents or attempt to bypass verification.",
        "Where third-party verification providers are used, verification information may be processed by those providers on our behalf.",
      ],
    },
    {
      heading: "4. User-generated content",
      paragraphs: [
        "Information you voluntarily publish publicly, including profile photographs, profile information, comments, Live content and other public interactions, may be visible to other users.",
        "Do not publish information that you want to remain private.",
      ],
    },
    {
      heading: "5. Information sharing",
      paragraphs: ["We may share information with:"],
      bullets: [
        "Identity-verification providers",
        "Payment processors",
        "Cloud and hosting providers",
        "Security and fraud-prevention providers",
        "Technology and service providers",
        "Customer-support providers",
        "Law-enforcement or regulatory authorities where legally required",
      ],
      after: ["We do not sell personal information simply for the purpose of selling users' private data."],
    },
    {
      heading: "6. Data security",
      paragraphs: [
        "We use reasonable technical and organisational measures to protect personal information against unauthorised access, loss, misuse, alteration or disclosure.",
        "However, no online system can guarantee absolute security.",
      ],
    },
    {
      heading: "7. Data retention",
      paragraphs: [
        "We retain personal information for as long as reasonably necessary to provide our services, maintain security, meet legal and regulatory obligations, resolve disputes, enforce agreements and protect our legitimate interests.",
        "Where information is no longer required, we may delete or anonymise it subject to applicable legal requirements.",
      ],
    },
    {
      heading: "8. Your rights",
      paragraphs: ["Subject to applicable law, you may have rights to:"],
      bullets: [
        "Request access to your personal information",
        "Request correction of inaccurate information",
        "Request deletion where legally permitted",
        "Withdraw certain consents",
        "Object to certain processing",
        "Request information about how your data is processed",
      ],
      after: ["Requests may be submitted through the contact details provided on Flirta247."],
    },
    {
      heading: "9. Children's privacy",
      paragraphs: [
        "Flirta247 is strictly an 18+ platform. We do not knowingly permit persons under 18 to create or operate accounts.",
        "If we discover that an account belongs to a person under 18, we may suspend or remove the account and take appropriate steps to protect the individual.",
      ],
    },
    {
      heading: "10. International processing",
      paragraphs: [
        "Flirta247 may serve users in different countries. Your information may therefore be processed or stored in countries other than the country where you live.",
        "Where required, appropriate safeguards will be applied.",
      ],
    },
    {
      heading: "11. Policy changes",
      paragraphs: [
        "We may update this Privacy Policy from time to time.",
        "Updated versions will be published on this page with a revised effective date.",
      ],
    },
    {
      heading: "12. Contact",
      paragraphs: [
        "For privacy-related questions or requests, contact Flirta247 through the official contact channels provided on the website.",
      ],
    },
  ],
};

export const COOKIES: LegalDoc = {
  slug: "cookies",
  href: "/cookies",
  title: "Cookie & Tracking Policy",
  short: "Cookie & Tracking Policy",
  effective: LEGAL_EFFECTIVE,
  intro: ["Flirta247 uses cookies and similar technologies to operate, secure and improve the platform."],
  sections: [
    {
      heading: "1. What are cookies?",
      paragraphs: [
        "Cookies are small files or similar technologies that may be stored on your device when you visit a website.",
      ],
    },
    {
      heading: "2. How we use cookies",
      paragraphs: ["Flirta247 may use cookies and similar technologies for:"],
      bullets: [
        "Login and authentication",
        "Account security",
        "Remembering preferences",
        "Platform functionality",
        "Analytics",
        "Performance monitoring",
        "Fraud prevention",
        "Personalisation",
        "Understanding how users interact with the platform",
      ],
    },
    {
      heading: "3. Essential cookies",
      paragraphs: [
        "Some cookies are necessary for Flirta247 to operate correctly.",
        "These may be used for authentication, security, account management and essential platform functions.",
      ],
    },
    {
      heading: "4. Non-essential cookies",
      paragraphs: [
        "Where applicable, non-essential cookies may be used for analytics, personalisation, advertising or other optional functions.",
        "Where required by applicable law, Flirta247 will provide appropriate controls allowing users to accept or decline non-essential cookies.",
      ],
    },
    {
      heading: "5. Third-party services",
      paragraphs: [
        "Certain Flirta247 features may use third-party services that place cookies or similar technologies on your device.",
        "These services may include analytics, payment, security, advertising or other technology providers.",
      ],
    },
    {
      heading: "6. Managing cookies",
      paragraphs: [
        "You may manage or disable cookies through your browser settings.",
        "Disabling certain cookies may affect the functionality of some Flirta247 features.",
      ],
    },
    {
      heading: "7. Policy changes",
      paragraphs: [
        "We may update this Cookie & Tracking Policy when necessary.",
        "Any updated version will be published on this page with a revised effective date.",
      ],
    },
  ],
};

export const GUIDELINES: LegalDoc = {
  slug: "guidelines",
  href: "/guidelines",
  title: "Community & Safety Guidelines",
  short: "Community & Safety Guidelines",
  effective: LEGAL_EFFECTIVE,
  intro: [
    "Flirta247 is designed for adults to meet, interact, socialise and connect.",
    "We want the platform to remain enjoyable while protecting users from abuse, fraud, exploitation and harmful behaviour.",
  ],
  sections: [
    {
      heading: "1. You may",
      bullets: [
        "Flirt",
        "Chat",
        "Date",
        "Make friends",
        "Share permitted photos",
        "Participate in Live sessions",
        "Send permitted virtual gifts",
        "Promote yourself within permitted platform features",
        "Discuss adult relationships between consenting adults",
      ],
    },
    {
      heading: "2. You may not",
      bullets: [
        "Create fake accounts",
        "Impersonate another person",
        "Misrepresent your age or identity",
        "Use stolen photographs",
        "Harass another user",
        "Threaten another person",
        "Blackmail or extort anyone",
        "Publish another person's private information",
        "Upload non-consensual intimate material",
        "Involve minors in sexual or adult content",
        "Promote trafficking or exploitation",
        "Conduct scams or financial fraud",
        "Promote illegal activities",
        "Use bots or automated accounts without permission",
        "Manipulate referrals or rewards",
        "Abuse payment or withdrawal systems",
        "Circumvent platform restrictions",
      ],
    },
    {
      heading: "3. Live content",
      paragraphs: [
        "Live creators must comply with Flirta247's rules and applicable law.",
        "Content involving minors, exploitation, non-consensual sexual material, trafficking, abuse or other prohibited activity is not permitted.",
        "Flirta247 may remove Live sessions, restrict Live access or terminate accounts that violate the rules.",
      ],
    },
    {
      heading: "4. Reporting",
      paragraphs: [
        "Users can report profiles, messages, content or Live sessions that violate Flirta247's rules.",
        "Reports may be reviewed by our moderation and safety team.",
        "Users should provide sufficient information to allow us to investigate the report.",
      ],
    },
    {
      heading: "5. Blocking",
      paragraphs: [
        "Users may block another account to prevent unwanted interaction where the feature is available.",
      ],
    },
    {
      heading: "6. Offline meetings",
      paragraphs: ["If you decide to meet another user:"],
      bullets: [
        "Meet in a public location",
        "Tell someone you trust where you are going",
        "Arrange your own transportation",
        "Avoid sending money to someone you have just met",
        "Do not share sensitive personal information unnecessarily",
        "Leave immediately if you feel unsafe",
      ],
    },
    {
      heading: "7. Protect your information",
      paragraphs: ["Do not publicly share:"],
      bullets: [
        "Home address",
        "Bank details",
        "Passwords",
        "Verification codes",
        "Government identification",
        "Private financial information",
      ],
    },
    {
      heading: "8. Enforcement",
      paragraphs: ["Depending on the seriousness of a violation, we may:"],
      bullets: [
        "Remove content",
        "Issue a warning",
        "Restrict features",
        "Suspend an account",
        "Remove Live privileges",
        "Restrict withdrawals",
        "Freeze suspicious earnings while an investigation is conducted",
        "Permanently terminate an account",
        "Report serious matters to appropriate authorities where required",
      ],
    },
    {
      heading: "9. Emergency situations",
      paragraphs: [
        "Flirta247 is not an emergency service.",
        "If you believe that you or another person is in immediate danger, contact the appropriate emergency or law-enforcement service in your location.",
      ],
    },
  ],
};

export const PAYMENTS: LegalDoc = {
  slug: "payments",
  href: "/payments-policy",
  title: "Payments, Refunds & Virtual Credits Policy",
  short: "Payments, Refunds & Virtual Credits",
  effective: LEGAL_EFFECTIVE,
  intro: [
    "This policy explains how payments, subscriptions, virtual credits, gifts, creator earnings, withdrawals and refunds may operate on Flirta247.",
  ],
  sections: [
    {
      heading: "1. Payments",
      paragraphs: ["Flirta247 may offer paid services including:"],
      bullets: [
        "Subscriptions",
        "Virtual credits",
        "Virtual gifts",
        "Promotional purchases",
        "Other paid platform features",
      ],
      after: [
        "Payments may be processed through third-party payment providers.",
        "Additional terms from the applicable payment provider may also apply.",
      ],
    },
    {
      heading: "2. Virtual credits",
      paragraphs: ["Virtual credits are digital units used within Flirta247.", "Virtual credits:"],
      bullets: [
        "Are not cash",
        "Are not bank deposits",
        "Are not financial accounts",
        "Cannot be used outside Flirta247 unless expressly permitted",
        "Do not represent ownership of Flirta247",
        "Have no independent monetary value outside the platform",
      ],
    },
    {
      heading: "3. Virtual gifts",
      paragraphs: [
        "Where available, users may use virtual credits to send virtual gifts to eligible creators or other users.",
        "The availability and value of gifts may be determined by Flirta247.",
      ],
    },
    {
      heading: "4. Creator earnings",
      paragraphs: [
        "Eligible creators may receive earnings from permitted platform activities.",
        "Creator earnings are subject to:",
      ],
      bullets: [
        "Eligibility requirements",
        "Applicable platform fees",
        "Minimum withdrawal thresholds",
        "Identity verification",
        "Fraud and security checks",
        "Applicable tax and legal requirements",
        "Applicable payout rules",
      ],
      after: [
        "Flirta247 may delay or restrict a withdrawal where there is a reasonable concern regarding fraud, chargebacks, account abuse or violation of platform rules.",
      ],
    },
    {
      heading: "5. Withdrawals",
      paragraphs: [
        "Creators must complete any required identity and account verification before withdrawals can be processed.",
        "Withdrawals may be subject to minimum amounts, processing times, fees and payment-provider requirements.",
      ],
    },
    {
      heading: "6. Subscriptions",
      paragraphs: [
        "Where recurring subscriptions are offered, users may cancel future renewals through the applicable account settings or available cancellation process.",
        "Cancellation normally prevents future charges but does not automatically reverse previous charges.",
      ],
    },
    {
      heading: "7. Refunds",
      paragraphs: [
        "Used virtual credits, gifts or completed digital transactions may generally not be refundable except where required by applicable law or where Flirta247 determines that a refund is appropriate.",
        "Refund requests may be reviewed individually.",
      ],
    },
    {
      heading: "8. Unauthorised transactions",
      paragraphs: [
        "If you believe a transaction was made without your authorisation, contact Flirta247 as soon as possible.",
        "We may investigate suspicious transactions and may request supporting information.",
      ],
    },
    {
      heading: "9. Chargebacks and payment abuse",
      paragraphs: [
        "Users must not abuse chargeback processes or deliberately reverse legitimate payments after receiving a service, virtual credit or other benefit.",
        "Suspected payment abuse may result in account restrictions or termination.",
      ],
    },
    {
      heading: "10. Changes to pricing",
      paragraphs: [
        "Flirta247 may change prices, fees, credit packages or other payment terms.",
        "Where required, users will be notified of material changes before they take effect.",
      ],
    },
    {
      heading: "11. Payment provider rules",
      paragraphs: [
        "Where a third-party payment provider processes a transaction, that provider's applicable terms, policies and requirements may also apply.",
      ],
    },
  ],
};

export const LEGAL_DOCS: LegalDoc[] = [TERMS, PRIVACY, GUIDELINES, PAYMENTS, COOKIES];
