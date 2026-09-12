import React from "react";
import { Box, Container, Typography } from "@mui/material";
import PublicLayout from "../../components/PublicLayout/PublicLayout";
import HelmetHeader from "../../components/HelmetHeader/Helmet";

const privacySections = [
  {
    title: "1. Overview",
    body: [
      "This Privacy Policy explains how Tipsyverse collects, uses, stores, shares, and protects information when you use our website, mobile experiences, customer event booking tools, bartender portal, administrative tools, support features, and related services.",
      "By creating an account, browsing Tipsyverse, submitting an event request, applying to bartend, communicating with our team, or otherwise using the platform, you acknowledge that you have read and understand this Privacy Policy.",
    ],
  },
  {
    title: "2. Information We Collect",
    body: [
      "We may collect account information such as your name, username, email address, phone number, password credentials, profile photo, date of birth or age verification confirmation, account status, role, communication preferences, and support history.",
      "For event customers, we may collect event details including venue address, event date and time, timezone, guest count, event type, bar setup, procurement requests, payment status, billing details, notes, special instructions, and related communications.",
      "For bartenders and applicants, we may collect profile information, licenses, training progress, onboarding document statuses, emergency contact information, payout preferences, availability, assignment history, attendance records, reviews, incident reports, rewards, and compensation-related settings.",
      "We may collect user-generated content, including drink submissions, comments, likes, saved drinks, reviews, support ticket messages, uploaded photos, receipt images, and other content you choose to provide.",
      "We automatically collect technical information such as IP address, browser type, device identifiers, operating system, pages viewed, access times, referring URLs, cookie identifiers, crash logs, and other diagnostic or analytics data.",
    ],
  },
  {
    title: "3. How We Use Information",
    body: [
      "We use information to create and manage accounts, verify eligibility, provide customer support, process event requests, coordinate bartenders, manage assignments, track attendance, process payments and payouts, send invoices or payment requests, and communicate operational updates.",
      "We use information to improve safety, prevent fraud, investigate policy violations, enforce platform rules, review incidents, monitor system health, manage permissions, and protect Tipsyverse, our users, customers, bartenders, employees, and partners.",
      "We may use information to personalize platform content, improve drink recommendations, maintain saved preferences, analyze trends, improve our software, test new features, and develop business reporting.",
      "We may send transactional emails, reminders, assignment notices, support updates, event updates, onboarding requests, payment notices, policy notices, and other service-related communications.",
    ],
  },
  {
    title: "4. Payments, Payouts, and Financial Records",
    body: [
      "Tipsyverse may collect and store payment-related records such as event balances, payment status, invoices, transaction references, refunds, voids, receipt-backed charges, payout status, provider names, payout notes, and related financial history.",
      "We do not intend to store full payment card numbers directly in Tipsyverse. Payment processors, banks, or third-party payment providers may collect and process payment information under their own privacy policies and security standards.",
      "Financial records may be retained as needed for accounting, tax, audit, fraud prevention, dispute resolution, compliance, and legitimate business purposes.",
    ],
  },
  {
    title: "5. Location and Event Address Information",
    body: [
      "Event addresses and venue details are used to plan service, determine availability, calculate travel or service requirements, send assignments, support bartenders, and communicate event logistics.",
      "Bartender location-related information may be collected only when enabled or required for operational features such as live location sharing, event attendance, clock-in/clock-out, or safety support.",
    ],
  },
  {
    title: "6. Cookies and Similar Technologies",
    body: [
      "We may use cookies, local storage, session storage, pixels, analytics tools, and similar technologies to keep you signed in, remember preferences, improve performance, secure the platform, understand usage, and diagnose technical issues.",
      "You can adjust cookie settings through your browser. Some features may not function properly if cookies or local storage are disabled.",
    ],
  },
  {
    title: "7. How We Share Information",
    body: [
      "We may share information with service providers who help operate Tipsyverse, including hosting providers, email providers, file storage providers, analytics tools, payment processors, customer support tools, and security vendors.",
      "We may share relevant event details with assigned bartenders, employees, operations managers, customers, or staffing partners when needed to provide services, coordinate an event, resolve an issue, or protect safety.",
      "We may disclose information if required by law, subpoena, court order, legal process, government request, or if we believe disclosure is necessary to protect rights, safety, property, users, the public, or Tipsyverse.",
      "We do not sell personal information in the ordinary meaning of selling a customer list for money. If our practices change, we will update this policy as required by applicable law.",
    ],
  },
  {
    title: "8. Data Security",
    body: [
      "We use administrative, technical, and organizational safeguards designed to protect information from unauthorized access, loss, misuse, alteration, or disclosure. These safeguards may include authentication controls, role-based permissions, encryption in transit, access logging, and limited internal access.",
      "No system can be guaranteed to be completely secure. You are responsible for maintaining the confidentiality of your login credentials and notifying us promptly if you believe your account has been compromised.",
    ],
  },
  {
    title: "9. Data Retention",
    body: [
      "We retain information for as long as reasonably necessary to provide services, maintain accounts, comply with legal obligations, resolve disputes, enforce agreements, prevent fraud, support tax and accounting records, and maintain business records.",
      "Some information may remain in backups, logs, financial records, or archival systems for a limited period even after account deletion or deactivation.",
    ],
  },
  {
    title: "10. Your Choices and Rights",
    body: [
      "Depending on your location and applicable law, you may have rights to access, correct, update, delete, export, restrict, or object to certain processing of your personal information.",
      "You may update certain account information directly in your account settings. To request access, correction, deletion, or export of information that is not available in your settings, contact us at support@tipsyverse.com.",
      "We may need to verify your identity before fulfilling certain requests. We may deny or limit a request where permitted by law, including when retention is required for legal, tax, security, fraud prevention, dispute, or legitimate business purposes.",
    ],
  },
  {
    title: "11. Children and Age Restrictions",
    body: [
      "Tipsyverse is intended for users who are legally permitted to access alcohol-related content and services in their location. We do not knowingly collect personal information from children under 13.",
      "Certain features, including alcohol-related content, event booking, bartender work, and age-restricted interactions, may require users to be of legal drinking age or otherwise legally eligible.",
    ],
  },
  {
    title: "12. Third-Party Links and Services",
    body: [
      "Tipsyverse may link to or integrate with third-party websites, payment providers, social platforms, cloud storage services, email services, or other tools. Their privacy practices are governed by their own policies, not this Privacy Policy.",
      "We encourage you to review third-party privacy policies before providing information to those services.",
    ],
  },
  {
    title: "13. Business Transfers",
    body: [
      "If Tipsyverse is involved in a merger, acquisition, financing, reorganization, sale of assets, bankruptcy, or similar business transaction, information may be transferred or disclosed as part of that transaction, subject to applicable law.",
    ],
  },
  {
    title: "14. Changes to This Policy",
    body: [
      "We may update this Privacy Policy from time to time. When we make material changes, we may notify users through the platform, by email, or by updating the effective date on this page.",
      "Your continued use of Tipsyverse after an updated policy becomes effective means you acknowledge the updated policy.",
    ],
  },
  {
    title: "15. Contact Us",
    body: [
      "If you have questions, concerns, or requests about this Privacy Policy or how Tipsyverse handles personal information, contact us at support@tipsyverse.com.",
    ],
  },
];

const PrivacyPolicyScreen = () => {
  return (
    <PublicLayout>
      <HelmetHeader
        title="Tipsyverse | Privacy Policy"
        description="Read the Tipsyverse Privacy Policy to learn how we handle account, event, bartender, support, payment, location, and activity information."
        keywords="Tipsyverse privacy policy, data privacy, account privacy, event privacy, bartender data, payment privacy"
      />
      <Container maxWidth="md" sx={{ py: 6 }}>
        <Typography component="h1" variant="h3" gutterBottom textAlign="center" fontWeight={700}>
          Privacy Policy
        </Typography>

        <Typography variant="body1" color="text.secondary" paragraph>
          Effective Date: July 18, 2026
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          This policy is provided for transparency and general business purposes.
          It is not legal advice. Tipsyverse should have final legal language
          reviewed by qualified counsel before public launch or production use.
        </Typography>

        {privacySections.map((section) => (
          <Box key={section.title} sx={{ mt: 3 }}>
            <Typography component="h2" variant="h6" fontWeight={700} gutterBottom>
              {section.title}
            </Typography>
            {section.body.map((paragraph) => (
              <Typography
                key={paragraph}
                variant="body2"
                color="text.secondary"
                paragraph
              >
                {paragraph}
              </Typography>
            ))}
          </Box>
        ))}

        <Box mt={4}>
          <Typography variant="caption" color="text.secondary">
            Last updated: July 18, 2026
          </Typography>
        </Box>
      </Container>
    </PublicLayout>
  );
};

export default PrivacyPolicyScreen;
