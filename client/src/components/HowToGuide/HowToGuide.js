import React, { useMemo, useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Chip,
  Divider,
  Grid,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  ExpandMore,
  OpenInNew,
  Search,
} from "@mui/icons-material";
import { Link } from "react-router-dom";

const GUIDES = {
  customer: {
    title: "Frequently Asked Questions and How To Guides",
    subtitle: "If you have a question, we probably have an answer. Browse through our most common inquiries below. Quick answers for booking events, managing drinks, reporting content, and getting help.",
    sections: [
      {
        title: "Book an event",
        category: "Events",
        path: "/book",
        steps: [
          "Go to **Events**, then choose **Book Event**.",
          "Fill out the event **location**, **date**, **time**, **guest count**, and **event type**.",
          "Answer the event questions so the team has enough detail to price and staff it.",
          "Review the details on **Review**, accept the policies, then submit the request.",
        ],
      },
      {
        title: "View your event details",
        category: "Events",
        path: "/my-events",
        steps: [
          "Open **Events** from the header.",
          "Select the event you want to review.",
          "Use **Event Details**, **Payments**, and **Attendance** to track the event.",
        ],
      },
      {
        title: "Review event payments and balance",
        category: "Events",
        path: "/my-events",
        steps: [
          "Open **Events** from the header.",
          "Select the event and go to **Payments**.",
          "Review **Total**, **Paid**, and **Balance Due**.",
          "Contact Tipsyverse if the balance, payment history, or invoice looks incorrect.",
        ],
      },
      {
        title: "Verify bartender attendance",
        category: "Events",
        path: "/my-events",
        steps: [
          "Open your event once it has started.",
          "Go to **Attendance** in the event details.",
          "Mark whether each bartender is present, absent, or needs review.",
          "Add notes if something does not match what happened at the event.",
        ],
      },
      {
        title: "Like, save, or share a drink",
        category: "Drinks",
        path: "/drinks",
        steps: [
          "Open **Drinks** and choose a drink.",
          "Use the **heart** to like it or the **bookmark** to save it.",
          "Use **Share** to send a preview link with the drink photo and title.",
        ],
      },
       {
        title: "Can users create their own drinks?",
        category: "Drinks",
        path: "/drinks",
        steps: [
          "At the moment, only admins can create and manage drinks. Users can interact with existing drinks by commenting, liking, sharing, or bookmarking them."
        ],
      },
      {
        title: "How do I comment or like a drink?",
        category: "Drinks",
        path: "/drinks",
        steps: [
          "Visit any drink page and scroll down to the comment section. You can like, reply, and share your thoughts easily."
        ],
      },
      {
        title: "How are analytics calculated?",
        category: "Drinks",
        path: "/drinks",
        steps: [
          "We track views, likes, shares, bookmarks, and comments over time."
        ],
      },
       {
        title: "Why can't I see a certain drink?",
        category: "Drinks",
        path: "/drinks",
        steps: [
          "Drinks may be inactive, unpublished, or suspended. Only active and published drinks are shown to users."
        ],
      },
      {
        title: "Who can see my bookmarks or likes?",
        category: "Drinks",
        path: "/settings/activity",
        steps: [
          "Open **Settings**, then **Activity** to review your saved and liked drinks.",
          "Your bookmarks and likes are private to you unless explicitly shared. Admins do not have access to your personal activity log.",
        ],
      },
      {
        title: "Report a comment",
        category: "Safety",
        path: "/drinks",
        steps: [
          "Open the drink with the comment.",
          "Use **Report** next to the comment or reply.",
          "Choose the best reason and submit it for review.",
        ],
      },
      {
        title: "Submit a tech support ticket",
        category: "Support",
        path: "/settings/support",
        steps: [
          "Open **Settings**, then **Support**.",
          "Choose a **category** and **priority**.",
          "Describe what happened, including the page you were on and any error message.",
          "Add photos if they help explain the issue.",
          "Choose **Submit** so the team can review it.",
        ],
      },
      {
        title: "Add photos to a support ticket",
        category: "Support",
        path: "/settings/support",
        steps: [
          "Open **Settings**, then **Support**.",
          "Create a new ticket or open the ticket you are updating.",
          "Use the photo upload area to add screenshots, error messages, or examples of what happened.",
          "Review the previews before submitting so the support team receives the right images.",
          "Choose **Submit** or **Send Response** to save the photos with the ticket.",
        ],
      },
      {
        title: "Complete your account profile",
        category: "Account",
        path: "/settings/account",
        steps: [
          "Open **Settings**, then **Account**.",
          "Review **Profile Completion** to see what is missing.",
          "Choose **Fix** to go straight to the **Profile** tab.",
          "Add your name, username, birthday, photo, or other missing details, then choose **Save**.",
        ],
      },
      {
        title: "Understand profile completion",
        category: "Account",
        path: "/settings/account",
        steps: [
          "Open **Settings**, then **Account**.",
          "Look at **Profile Completion** to see your current percentage.",
          "Review the checklist for missing items like **full legal name**, **username**, **birthday**, **profile photo**, or **email address**.",
          "Choose **Fix** on any missing item to go straight to the **Profile** tab.",
        ],
      },
      {
        title: "Update your username or birthday",
        category: "Account",
        path: "/settings",
        steps: [
          "Open **Settings**, then **Profile**.",
          "Update **Username** or **Birthday**.",
          "Make sure your username only uses letters, numbers, dots, or underscores.",
          "Choose **Save** to update your profile.",
        ],
      },
      {
        title: "Change your password",
        category: "Account",
        path: "/settings/security",
        steps: [
          "Open **Settings**, then **Security**.",
          "Enter your current password if required.",
          "Enter and confirm your new password.",
          "Choose **Save** or **Update Password** to apply the change.",
        ],
      },
      {
        title: "Recover a forgotten password",
        category: "Account",
        path: "/forgot-password",
        steps: [
          "Go to **Login**.",
          "Choose **Forgot Password**.",
          "Enter the email address on your Tipsyverse account.",
          "Open the password reset email and follow the secure reset link.",
          "Set a new password, then return to **Login**.",
        ],
      },
      {
        title: "Manage preferences",
        category: "Account",
        path: "/settings/preferences",
        steps: [
          "Open **Settings**, then **Preferences**.",
          "Update your preferred locations, event types, drink interests, or availability if shown.",
          "Review your choices for accuracy.",
          "Choose **Save** so Tipsyverse can use the updated preferences.",
        ],
      },
      {
        title: "View saved and liked drinks",
        category: "Account",
        path: "/settings/activity",
        steps: [
          "Open **Settings**, then **Activity**.",
          "Review your saved drinks, liked drinks, and recent drink activity.",
          "Open a drink from the list to view the recipe again.",
          "Use the **heart** or **bookmark** on a drink page to update your activity.",
        ],
      },
      {
        title: "Deactivate or delete your account",
        category: "Account",
        path: "/settings/account",
        steps: [
          "Open **Settings**, then **Account**.",
          "Scroll to **Danger Zone**.",
          "Choose **Deactivate Account** if you want to temporarily turn off access.",
          "Choose **Delete Account** only if you want to permanently remove your account.",
          "Read the confirmation dialog carefully before continuing.",
        ],
      },
      {
        title: "Log out safely",
        category: "Account",
        path: "/settings/account",
        steps: [
          "Open **Settings**, then **Account**.",
          "Go to **Sign Out**.",
          "Choose **Logout** when you are finished using Tipsyverse on the device.",
          "On shared devices, close the browser tab after logging out.",
        ],
      },
     
    ],
  },
  bartender: {
    title: "Bartender How To",
    subtitle: "A quick field guide for schedule, clock in, incident reports, earnings, and payout links.",
    sections: [
      {
        title: "View your schedule",
        category: "Schedule",
        path: "/bartend/schedule",
        steps: [
          "Open the **Bartender** dashboard.",
          "Go to **Schedule**.",
          "Review upcoming assignments, event times, addresses, and event notes.",
        ],
      },
      {
        title: "Find events ready to assign",
        category: "Schedule",
        path: "/bartend",
        steps: [
          "Open the **Bartender** dashboard.",
          "Go to **Home** and review **Events Ready To Assign**.",
          "Use the date range and pagination to find available events.",
          "Open an event and choose the available action to show interest or accept when eligible.",
        ],
      },
      {
        title: "Clock in and clock out",
        category: "Attendance",
        path: "/bartend/schedule",
        steps: [
          "Open **Schedule** near the event start time.",
          "Choose **Clock In** for the assigned event when you arrive.",
          "Choose **Clock Out** when your work is finished.",
          "The event contact can verify whether you were present.",
        ],
      },
      {
        title: "Submit an incident report",
        category: "Safety",
        path: "/bartend/schedule",
        steps: [
          "Open the assigned event from **Schedule**.",
          "Choose **Report Incident**.",
          "Select the **incident type**, **severity**, and describe what happened.",
          "Choose **Submit** immediately for guest injury, underage drinking attempts, refused service, damage, or misconduct.",
          "You should receive an email confirmation after the report is submitted.",
        ],
      },
      {
        title: "Update payout links",
        category: "Earnings",
        path: "/bartend/earnings",
        steps: [
          "Go to **Earnings**.",
          "Add your Cash App, Zelle, PayPal, Venmo, or payout notes.",
          "Choose **Save** so admin knows how to pay you.",
        ],
      },
      {
        title: "Review earnings",
        category: "Earnings",
        path: "/bartend/earnings",
        steps: [
          "Open **Earnings**.",
          "Review expected pay, recorded paid amount, and remaining balance by event.",
          "Use the reminder option if a balance is still unpaid after the allowed window.",
        ],
      },
      {
        title: "Claim bartender rewards",
        category: "Rewards",
        path: "/bartend",
        steps: [
          "Open the **Bartender** dashboard.",
          "Go to **Rewards**.",
          "Unlocked rewards appear after completed event milestones.",
          "Choose **Claim Reward**, enter your delivery address and any reward-specific answers, then submit the claim for admin review.",
          "Locked rewards stay blurred until you meet the milestone.",
        ],
      },
      {
        title: "Update licenses",
        category: "Profile",
        path: "/bartend/licenses",
        steps: [
          "Go to **Licenses**.",
          "Add or update required license details.",
          "Choose **Submit** so admin can review and approve it.",
        ],
      },
      {
        title: "Update contact and emergency contact",
        category: "Profile",
        path: "/bartend/preferences",
        steps: [
          "Go to **Preferences**.",
          "Add your **phone number**, **emergency contact name**, **relationship**, and **emergency contact phone**.",
          "Choose **Save Contact Info** so Tipsyverse can reach you before or during events.",
        ],
      },
      {
        title: "Track onboarding documents",
        category: "Profile",
        path: "/bartend",
        steps: [
          "Open **Home** and review **Checklist / Eligibility**.",
          "Look for **Sign all documents** to see whether your onboarding documents are complete.",
          "Documents are emailed to you. Return signed copies to admin so they can mark them received.",
        ],
      },
    ],
  },
  admin: {
    title: "Admin How To",
    subtitle: "Common admin workflows for events, finance, operations, users, drinks, and support.",
    sections: [
      {
        title: "Review and manage events",
        category: "Events",
        path: "/admin",
        steps: [
          "Open **Admin**, then **Events**.",
          "Use **Refresh** to load the latest event records.",
          "Use the summary cards and **Search** to narrow the table.",
          "Open an event to confirm details, assign bartenders, record payments, or review workflow status.",
          "Use **Download Excel** when you need an offline event report.",
        ],
      },
      {
        title: "Use the Needs Attention overview",
        category: "Admin",
        path: "/admin",
        steps: [
          "Open **Admin**, then **Overview**.",
          "Review items grouped by **understaffed events**, **unpaid balances**, **pending documents**, **support tickets**, **incidents**, and **expiring licenses**.",
          "Choose the action on the item to open the correct drawer or admin section.",
        ],
      },
      {
        title: "Track company finance",
        category: "Finance",
        path: "/admin/finance",
        steps: [
          "Open **Finance**.",
          "Choose a **date range** or **custom range**.",
          "Use **Search** to find an event, customer, status, or event type.",
          "Review received payments, customer balances, bartender balances, and projected profit.",
          "Open **Review** to see event finance details and record bartender payouts after the event is complete.",
        ],
      },
      {
        title: "Send an event invoice",
        category: "Finance",
        path: "/admin",
        steps: [
          "Open **Admin**, then **Events**.",
          "Find the event and choose **Invoice**.",
          "Review the confirmation dialog to make sure the invoice should be sent.",
          "Choose **Send Invoice** to email the main contact the current invoice and remaining balance.",
        ],
      },
      {
        title: "Review incident reports",
        category: "Operations",
        path: "/admin/operations",
        steps: [
          "Open **Operations**, then **Incidents & Support**.",
          "Use the **Incidents** tab to review guest injury, refused service, damage, misconduct, or underage drinking reports.",
          "Use **Need Reviewing** to focus only on open work.",
          "Open **Review**, update status or severity, and add resolution notes.",
        ],
      },
      {
        title: "Resolve tech support tickets",
        category: "Operations",
        path: "/admin/operations",
        steps: [
          "Open **Operations**, then **Incidents & Support**.",
          "Go to the **Support** tab.",
          "Open **Review** to update priority, status, comments, and notes.",
          "Use **Notes** for internal findings and **Comments** for customer-facing communication.",
        ],
      },
      {
        title: "Manage promo codes",
        category: "Operations",
        path: "/admin/operations",
        steps: [
          "Open **Operations**, then **Promo Codes**.",
          "Use **Add Code** to create fixed amount or percentage discounts.",
          "Set the effective start date, end date, minimum event subtotal, audience, redemption limits, and whether the code is enabled.",
          "Use **Edit** to change future dates, disable a code, or make a code indefinite.",
          "Only Owners, Technology, and Finance can add, edit, disable, or delete promo codes; everyone else can view them.",
        ],
      },
      {
        title: "Preview effective permissions",
        category: "Operations",
        path: "/admin/operations",
        steps: [
          "Open **Operations**, then **Permissions**.",
          "Choose the **Acting User**, **Collection**, and **Action**.",
          "For user edit or delete checks, choose the second user you want to compare against.",
          "Choose **Search Permission** to preview hierarchy, department, position, and override results.",
        ],
      },
      {
        title: "Handle reported comments",
        category: "Operations",
        path: "/admin/operations",
        steps: [
          "Open **Operations**.",
          "Go to **Reported Comments**.",
          "Use **Need Reviewing** or **Search** to find the report.",
          "Review the report, inspect the content, and take the appropriate moderation action.",
        ],
      },
      {
        title: "Manage users and bartenders",
        category: "Users",
        path: "/admin/users",
        steps: [
          "Open **Users**.",
          "Use the **Customers**, **Bartenders**, **Licenses**, and **Our Team** subtabs.",
          "Use the summary cards and **Search** to narrow each table.",
          "Use **Refresh** or **Download Excel** when needed.",
          "Use **Our Team** for employee management and spreadsheet import workflows.",
        ],
      },
      {
        title: "Suspend a user",
        category: "Users",
        path: "/admin/users",
        steps: [
          "Open **Users**, then choose **Customers**.",
          "Search for the user and choose **Review**.",
          "Choose **Suspend** in the drawer actions.",
          "Select a **Reason**, write a clear **Explanation**, and choose either an end date or **Indefinite Suspension**.",
          "Choose **Save**. If the user is currently signed in, they will see the suspension message and be logged out.",
          "Use **Edit Suspension** or **Unsuspend** later if the account should be restored.",
        ],
      },
      {
        title: "Control whether a customer can book events",
        category: "Users",
        path: "/admin/users",
        steps: [
          "Open **Users**, then choose **Customers**.",
          "Search for the customer and choose **Review**.",
          "Go to **Booking Access**.",
          "Use **Allowed to book event** to turn booking access on or off.",
          "When booking access is off, enter the customer-facing reason so the booking form can explain what happened.",
          "Choose **Save Booking Access**.",
        ],
      },
      {
        title: "Track bartender onboarding documents",
        category: "Users",
        path: "/admin/users",
        steps: [
          "Open **Users**, then **Bartenders**.",
          "Use **Need Documents Sent** to find bartenders missing onboarding document emails.",
          "Open **Review** and go to **Documents**.",
          "Choose **Send All Onboarding Documents** to email the bartender the requested documents.",
          "Mark documents as sent or received once the bartender returns signed copies.",
        ],
      },
      {
        title: "Handle bartender reward claims",
        category: "Users",
        path: "/admin/users",
        steps: [
          "Open **Users**, then **Bartenders**.",
          "Use **Need Rewarded** to filter bartenders with pending or approved reward claims.",
          "Open **Review** and go to **Rewards**.",
          "Review the unlocked milestones and claim status before approving, fulfilling, or following up.",
          "Choose **Send Reward** only after confirming the claim details and delivery address.",
        ],
      },
      {
        title: "Manage drinks and catalog setup",
        category: "Drinks",
        path: "/admin/drinks",
        steps: [
          "Open **Drinks** to review the drink library, create recipes, or view analytics.",
          "Use **Search** and summary cards to narrow the drink table.",
          "Open **Catalog Setup** to manage liquors, mixers, glasses, hierarchies, departments, and positions.",
          "Keep recipe ingredients and instruction steps ordered clearly for users.",
        ],
      },
    ],
  },
};

const renderStep = (step) =>
  String(step)
    .split(/(\*\*[^*]+\*\*)/g)
    .filter(Boolean)
    .map((part, index) =>
      part.startsWith("**") && part.endsWith("**") ? (
        <Box component="strong" key={`${part}-${index}`} sx={{ fontWeight: 800 }}>
          {part.slice(2, -2)}
        </Box>
      ) : (
        <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>
      )
    );

function HowToGuide({ audience = "customer" }) {
  const guide = GUIDES[audience] || GUIDES.customer;
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");

  const categories = useMemo(
    () => ["All", ...new Set(guide.sections.map((item) => item.category))],
    [guide.sections]
  );

  const filteredSections = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return guide.sections.filter((item) => {
      const matchesCategory = category === "All" || item.category === category;
      const haystack = `${item.title} ${item.category} ${item.steps.join(" ")}`.toLowerCase();
      return matchesCategory && (!normalizedQuery || haystack.includes(normalizedQuery));
    });
  }, [category, guide.sections, query]);

  return (
    <Box>
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1 }}>
        <Box>
          <Typography variant="h5" fontWeight={800}>
            {guide.title}
          </Typography>
          <Typography variant="body2" color="text.secondary">{guide.subtitle}</Typography>
        </Box>
      </Stack>

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={1.5} alignItems="center">
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              size="small"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search how-to articles"
              InputProps={{ startAdornment: <Search fontSize="small" sx={{ mr: 1 }} /> }}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              {categories.map((name) => (
                <Chip
                  key={name}
                  label={name}
                  sx={{backgroundColor: category === name ? "var(--primary-color)" : "default",
                     color: category === name ? "white" : "black" }}
                  //color={category === name ? "primary" : "default"}
                  variant={category === name ? "filled" : "outlined"}
                  onClick={() => setCategory(name)}
                />
              ))}
            </Stack>
          </Grid>
        </Grid>
      </Paper>

      <Stack spacing={1.5}>
        {filteredSections.map((item, index) => (
          <Accordion key={item.title} defaultExpanded={index === 0}>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1}
                alignItems={{ xs: "flex-start", sm: "center" }}
                sx={{ width: "100%" }}
              >
                <Typography fontWeight={700}>{item.title}</Typography>
                <Chip size="small" label={item.category} variant="outlined" />
              </Stack>
            </AccordionSummary>
            <AccordionDetails>
              <Stack spacing={1.5}>
                <Divider />
                <Box component="ol" sx={{ m: 0, pl: 3 }}>
                  {item.steps.map((step) => (
                    <Typography component="li" key={step} sx={{ mb: 0.75 }}>
                      {renderStep(step)}
                    </Typography>
                  ))}
                </Box>
                {item.path && (
                  <Box>
                    <Button
                      component={Link}
                      to={item.path}
                      variant="outlined"
                      sx={{color: 'var(--primary-color)', borderColor: 'var(--primary-color)'}}
                      size="small"
                      endIcon={<OpenInNew />}
                    >
                      Go there
                    </Button>
                  </Box>
                )}
              </Stack>
            </AccordionDetails>
          </Accordion>
        ))}

        {!filteredSections.length && (
          <Paper variant="outlined" sx={{ p: 3 }}>
            <Typography fontWeight={700}>No matching how-to articles.</Typography>
            <Typography color="text.secondary">
              Try another search term or choose a different category.
            </Typography>
          </Paper>
        )}
      </Stack>
    </Box>
  );
}

export default HowToGuide;
