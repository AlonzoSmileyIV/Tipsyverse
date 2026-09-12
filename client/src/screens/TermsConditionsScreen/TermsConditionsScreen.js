import React from "react";
import { Box, Container, Typography } from "@mui/material";
import HelmetHeader from "../../components/HelmetHeader/Helmet";
import PublicLayout from "../../components/PublicLayout/PublicLayout";

const termsSections = [
  {
    title: "1. Acceptance of Terms",
    body: [
      "These Terms & Conditions govern your access to and use of Tipsyverse, including our website, account features, drink content, event booking tools, bartender portal, administrative tools, support tools, communications, and related services.",
      "By accessing or using Tipsyverse, creating an account, submitting content, requesting an event, applying to bartend, accepting an assignment, or communicating with us through the platform, you agree to be bound by these Terms.",
      "If you do not agree to these Terms, you may not use Tipsyverse.",
    ],
  },
  {
    title: "2. Eligibility and Age Requirements",
    body: [
      "You must be at least 13 years old to create a general account and must be of legal drinking age in your jurisdiction to access alcohol-related content, book alcohol-related services, or participate in age-restricted features.",
      "Bartenders, contractors, employees, and event service providers must meet all age, licensing, training, identity, employment eligibility, and legal requirements that apply to their work location and assigned event.",
      "Tipsyverse may request age verification, identity verification, license documentation, onboarding documents, or other information before allowing access to certain features.",
    ],
  },
  {
    title: "3. Accounts and Security",
    body: [
      "You are responsible for maintaining the confidentiality of your login credentials and for all activity that occurs under your account.",
      "You agree to provide accurate, current, and complete information and to update your information when it changes.",
      "You may not share accounts, impersonate another person, create accounts using false information, access another user's account without permission, or interfere with account security.",
      "Tipsyverse may suspend, restrict, or terminate accounts that appear fraudulent, abusive, unauthorized, inactive, unsafe, or in violation of these Terms.",
    ],
  },
  {
    title: "4. Platform Use and Community Conduct",
    body: [
      "You agree not to use Tipsyverse for unlawful, harmful, threatening, abusive, harassing, discriminatory, defamatory, obscene, fraudulent, deceptive, spammy, or otherwise objectionable activity.",
      "You may not upload malicious code, scrape data without permission, disrupt platform operations, bypass security controls, misuse administrative tools, manipulate reviews, or attempt to access data or systems you are not authorized to access.",
      "Tipsyverse may moderate, remove, restrict, or refuse content or activity that violates these Terms, platform policies, applicable law, safety expectations, or business requirements.",
    ],
  },
  {
    title: "5. User Content",
    body: [
      "You retain ownership of content you submit to Tipsyverse, including comments, reviews, drink submissions, photos, support messages, event notes, and other materials you provide.",
      "By submitting content, you grant Tipsyverse a non-exclusive, worldwide, royalty-free, sublicensable, transferable license to host, store, reproduce, display, publish, distribute, modify, adapt, and use that content as needed to operate, improve, market, and provide the platform and services.",
      "You represent that you have the rights necessary to submit your content and that your content does not violate intellectual property rights, privacy rights, publicity rights, contractual rights, or applicable law.",
      "Tipsyverse may remove or limit content at any time, including content that is inaccurate, unsafe, illegal, infringing, misleading, promotional, abusive, or inconsistent with platform standards.",
    ],
  },
  {
    title: "6. Drink Content and Alcohol Responsibility",
    body: [
      "Drink recipes, alcohol-related content, guides, recommendations, and educational information are provided for informational and entertainment purposes only.",
      "Tipsyverse does not encourage illegal alcohol consumption, underage drinking, unsafe serving practices, intoxicated driving, or violation of venue rules or alcohol laws.",
      "Users are responsible for complying with all applicable alcohol laws and making responsible decisions. Bartenders and event customers are responsible for following local laws, licensing rules, venue requirements, and safety standards.",
    ],
  },
  {
    title: "7. Event Booking Requests",
    body: [
      "Submitting an event request does not guarantee final pricing, staffing, bartender assignment, procurement, service availability, or event confirmation. Tipsyverse must review event details and may accept, decline, modify, or request additional information before confirming service.",
      "Customers are responsible for providing accurate event information, including date, time, timezone, venue address, guest count, event type, contact information, bar setup, procurement requests, and special instructions.",
      "Event pricing, balances, deposits, taxes, fees, procurement costs, travel costs, overtime, replacement supplies, and other charges may change if event details change, staffing needs change, bartenders assigned require higher approved rates, procurement is requested, or additional costs are incurred.",
      "Tipsyverse may contact customers by email, phone, text, or platform message regarding event confirmation, payments, assignments, reminders, staffing updates, support issues, or changes.",
    ],
  },
  {
    title: "8. Payments, Invoices, Refunds, and Balances",
    body: [
      "Customers agree to pay all approved charges associated with their event, including deposits, remaining balances, additional approved charges, procurement costs, overtime, taxes, fees, and any other amounts communicated by Tipsyverse.",
      "A deposit, partial payment, or full payment may be required before Tipsyverse reserves staff, begins assignment, confirms service, or continues event planning.",
      "Unless Tipsyverse approves different written terms, remaining event balances are due seven calendar days before the event. Events confirmed within seven days require full payment when confirmed.",
      "Tipsyverse may send a balance reminder fourteen days before the event and a past-due warning five days before the event. At seventy-two hours before the event, an unpaid event may be placed on Payment Hold. Assigned bartenders may remain assigned while final instructions, optional purchases, and additional event changes are paused.",
      "By forty-eight hours before the event, Tipsyverse may require either full payment, a documented staff-approved payment arrangement, or cancellation for nonpayment.",
      "If an event is canceled for nonpayment, the deposit and already-incurred, nonrecoverable costs may be retained to the extent permitted by the booking terms and applicable law. Tipsyverse will not automatically charge the remaining balance unless the customer expressly authorized that charge.",
      "Payment records, invoices, receipts, transaction references, refunds, voids, and balances may be maintained in Tipsyverse for accounting, tax, audit, dispute, and operational purposes.",
      "Refunds, credits, cancellations, rescheduling, and transferred payments are subject to the cancellation terms communicated for the event and may depend on timing, staff commitments, expenses incurred, payment processor rules, and applicable law.",
      "Tipsyverse may suspend, delay, cancel, or decline service if required payments are not received, payment methods fail, balances remain unpaid, disputes occur, or risk concerns arise.",
    ],
  },
  {
    title: "9. Procurement and Receipt-Backed Charges",
    body: [
      "If Tipsyverse agrees to purchase or pick up items for an event, the customer remains responsible for approved procurement costs, applicable fees, and any receipt-backed charges added to the event bill.",
      "Procurement estimates are not guarantees. Actual quantities, prices, availability, substitutions, taxes, and fees may vary.",
      "Customers are responsible for ensuring that alcohol and supplies comply with applicable laws, venue rules, and event requirements unless Tipsyverse separately agrees in writing to handle specific compliance responsibilities.",
    ],
  },
  {
    title: "10. Staffing, Bartender Assignments, and Event Changes",
    body: [
      "Tipsyverse will make reasonable efforts to staff confirmed events with qualified bartenders, but staffing is subject to availability, licensing, scheduling, safety, eligibility, and operational factors.",
      "Bartender assignments may change due to illness, emergencies, scheduling conflicts, licensing issues, safety concerns, or business needs. Tipsyverse may substitute bartenders or adjust staffing plans when necessary.",
      "If an event is understaffed or cannot be staffed, Tipsyverse may send additional assignment requests, escalate internally, contact staffing partners, notify the customer, adjust service expectations, or cancel service if necessary.",
      "Once bartenders are assigned, customers acknowledge that event balances may change if selected bartenders require additional approved compensation based on experience, tenure, assignment terms, or other compensation rules communicated by Tipsyverse.",
    ],
  },
  {
    title: "11. Bartender and Contractor Terms",
    body: [
      "Bartenders and applicants may be required to complete onboarding, training, license verification, document submission, tax forms, contractor agreements, service standards acknowledgements, payout setup, contact information, and emergency contact information before being eligible for assignments.",
      "Bartenders are responsible for reviewing assignment details, arriving on time, following applicable alcohol laws, checking identification when required, refusing service when appropriate, communicating issues promptly, maintaining professionalism, and complying with Tipsyverse standards.",
      "Tipsyverse may remove, suspend, deny, deactivate, or restrict bartender access based on incomplete requirements, expired licenses, safety concerns, misconduct, poor performance, customer complaints, incident reports, fraud, or violation of these Terms or other applicable agreements.",
      "Independent-contractor bartenders must obtain and continuously maintain every alcohol-service permit and server-training credential required for each assignment. A current permit matching the event's state, verified by Tipsyverse, and the bartender's confirmation that required server training was completed are required before bidding or assignment.",
      "Bartenders must promptly replace expired or superseded permit proof, attest that submitted documents are authentic and current, and redact Social Security numbers, driver-license numbers, and unrelated personal information before upload. Tipsyverse may request additional training proof when legally necessary or when a permit cannot be verified.",
      "Compensation, hourly rates, payouts, bonuses, rewards, reimbursement, and taxes are subject to the terms communicated by Tipsyverse and any applicable contractor, employment, or service agreement.",
    ],
  },
  {
    title: "12. Support Tickets, Reviews, Reports, and Administrative Notes",
    body: [
      "Users may submit support tickets, comments, incident reports, reviews, and other communications through Tipsyverse. You agree that information you submit may be reviewed by authorized Tipsyverse personnel to provide support, investigate issues, enforce policies, improve service, and maintain records.",
      "Internal notes, findings, audit logs, status updates, and administrative records may be maintained for operational, compliance, dispute, and safety purposes.",
    ],
  },
  {
    title: "13. Intellectual Property",
    body: [
      "Tipsyverse, including its name, logos, branding, designs, software, interfaces, workflows, graphics, text, compilation, and platform features, is owned by Tipsyverse or its licensors and is protected by intellectual property and other laws.",
      "You may not copy, modify, distribute, sell, lease, reverse engineer, scrape, reproduce, frame, or create derivative works from Tipsyverse without written permission, except as permitted by law.",
    ],
  },
  {
    title: "14. Third-Party Services",
    body: [
      "Tipsyverse may use or link to third-party services, including payment processors, email providers, storage providers, analytics tools, social platforms, maps, cloud image hosting, and other vendors.",
      "Tipsyverse is not responsible for third-party websites, services, policies, actions, availability, or content. Your use of third-party services may be governed by separate terms and privacy policies.",
    ],
  },
  {
    title: "15. Disclaimers",
    body: [
      "Tipsyverse is provided on an as-is and as-available basis. We do not guarantee that the platform will be uninterrupted, error-free, secure, accurate, complete, or available at all times.",
      "Tipsyverse does not provide legal, tax, medical, safety, accounting, insurance, or professional advice. Any platform content, estimates, recommendations, guides, or policies are provided for general informational purposes.",
      "Event availability, staffing, pricing, recommendations, payout estimates, profit allocation suggestions, procurement estimates, and other calculations may be estimates and are subject to review, correction, and change.",
    ],
  },
  {
    title: "16. Limitation of Liability",
    body: [
      "To the fullest extent permitted by law, Tipsyverse and its owners, employees, contractors, affiliates, service providers, and representatives will not be liable for indirect, incidental, special, consequential, exemplary, punitive, or lost-profit damages arising from or related to your use of the platform or services.",
      "Tipsyverse is not responsible for injuries, damages, losses, misconduct, unlawful alcohol consumption, guest behavior, venue issues, transportation decisions, customer-supplied alcohol, third-party actions, or circumstances outside our reasonable control, except where liability cannot be limited under applicable law.",
    ],
  },
  {
    title: "17. Indemnification",
    body: [
      "You agree to defend, indemnify, and hold harmless Tipsyverse and its owners, employees, contractors, affiliates, service providers, and representatives from claims, damages, losses, liabilities, costs, and expenses arising from your use of Tipsyverse, your content, your event, your conduct, your violation of these Terms, your violation of law, or your infringement of another person's rights.",
    ],
  },
  {
    title: "18. Suspension and Termination",
    body: [
      "Tipsyverse may suspend, restrict, deactivate, or terminate access to the platform or services at any time if we believe a user has violated these Terms, created risk, provided false information, failed to pay, abused the platform, violated safety standards, or engaged in unlawful or harmful conduct.",
      "You may stop using Tipsyverse at any time. Certain obligations, including payment obligations, intellectual property provisions, disclaimers, limitations of liability, indemnification, and dispute provisions, may survive termination.",
    ],
  },
  {
    title: "19. Changes to Terms",
    body: [
      "Tipsyverse may update these Terms from time to time. We may notify users by posting the updated Terms, sending a notice, or otherwise communicating through the platform.",
      "Your continued use of Tipsyverse after updated Terms become effective constitutes acceptance of the updated Terms.",
    ],
  },
  {
    title: "20. Governing Law and Venue",
    body: [
      "These Terms are governed by the laws of the State of Indiana, without regard to conflict-of-law principles.",
      "To the extent a dispute is not subject to another written agreement, the parties agree to resolve disputes in the state or federal courts located in Indiana, unless applicable law requires otherwise.",
    ],
  },
  {
    title: "21. Contact",
    body: [
      "Questions about these Terms may be sent to support@tipsyverse.com.",
    ],
  },
];

const TermsConditionsScreen = () => {
  return (
    <PublicLayout>
      <HelmetHeader
        title="Tipsyverse | Terms and Conditions"
        description="Review the Tipsyverse Terms and Conditions for account use, event bookings, bartender requirements, payments, content, and platform rules."
        keywords="Tipsyverse terms, terms and conditions, event booking terms, bartender agreement, platform rules, payment terms"
      />
      <Container maxWidth="md" sx={{ py: 6 }}>
        <Typography component="h1" variant="h3" gutterBottom textAlign="center" fontWeight={700}>
          Terms & Conditions
        </Typography>

        <Typography variant="body1" color="text.secondary" paragraph>
          Effective Date: July 18, 2026
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          These Terms are written as detailed business-facing platform terms.
          They are not legal advice. Tipsyverse should have final terms reviewed
          by qualified counsel before public launch or production use.
        </Typography>

        {termsSections.map((section) => (
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

export default TermsConditionsScreen;
