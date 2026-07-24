// FAQScreen.jsx
import React from "react";
import {
  Container,
} from "@mui/material";
//import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import PublicLayout from "../../components/PublicLayout/PublicLayout";
import HelmetHeader from "../../components/HelmetHeader/Helmet";
import HowToGuide from "../../components/HowToGuide/HowToGuide";



const FAQScreen = () => {
  return (
    <PublicLayout>

    <HelmetHeader title="Tipsyverse | FAQ" 
    description="Find answers to common questions about commenting, liking, bookmarking drinks, and how admin-created cocktails work on our platform. Explore user interactions, privacy, and drink visibility in our FAQ."
    keywords="FAQ, Tipsyverse FAQ, cocktail questions, user drink permissions, comment on drinks, like cocktails, bookmark drinks, share cocktails, admin created drinks, drink analytics, user privacy, Tipsyverse support"
    />
    <Container maxWidth="md" sx={{ py: 5 }}>
        <HowToGuide audience="customer" />
    </Container>
    </PublicLayout>
  );
};

export default FAQScreen;
