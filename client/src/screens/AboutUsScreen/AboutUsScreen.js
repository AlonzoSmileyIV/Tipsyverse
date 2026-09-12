
import { Box, Typography, Container, Grid } from "@mui/material";
import HelmetHeader from '../../components/HelmetHeader/Helmet';
import PublicLayout from '../../components/PublicLayout/PublicLayout';

const AboutUsScreen = () => {
  return (
    <PublicLayout>
      <HelmetHeader
        title="Tipsyverse | About Cocktail Discovery and Bartending Services"
        description="Learn about Tipsyverse, a cocktail discovery, mocktail recipe, bartender training, and event bartending platform built for customers and bartenders."
        keywords="about Tipsyverse, cocktail community, bartending services, mobile bartenders, cocktail discovery, bartender training"
      />
    <Container maxWidth="md" sx={{ py: 6 }}>
        <Typography component="h1" variant="h3" gutterBottom textAlign="center" fontWeight={700}>
          About Us
        </Typography>

        <Typography component="p" variant="h6" textAlign="center" color="text.secondary" mb={4}>
          Tipsyverse is your digital lounge to discover, share, and enjoy cocktail recipes from around the world.
        </Typography>

        <Grid container spacing={4}>
          <Grid item xs={12} md={6}>
            <Typography component="h2" variant="h5" fontWeight={600} gutterBottom>
              Who We Are
            </Typography>
            <Typography variant="body1" color="text.secondary">
              We’re a team of cocktail enthusiasts, mixologists, and designers who believe drinking culture should be
              creative, inclusive, and accessible. Whether you’re a bartender or a home mixer, Tipsyverse is the place
              to find inspiration and pass the bottle — digitally, of course.
            </Typography>
          </Grid>

          <Grid item xs={12} md={6}>
            <Typography component="h2" variant="h5" fontWeight={600} gutterBottom>
              Why Tipsyverse?
            </Typography>
            <Typography variant="body1" color="text.secondary">
              We noticed it was hard to find fun, curated drink recipes and a community that celebrates flavor and
              flair. So we built one. We’re here to make discovering new cocktails feel like a party — smooth, bold,
              and responsibly enjoyed.
            </Typography>
          </Grid>

          <Grid item xs={12}>
            <Typography component="h2" variant="h5" fontWeight={600} gutterBottom>
              What We Believe
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Tipsyverse believes that cocktails are more than drinks — they’re conversation starters, creative expressions,
              and cultural bridges. We value inclusivity, curiosity, and responsible enjoyment. We aim to foster a
              space where everyone from seasoned bartenders to first-time shakers can learn, share, and explore.
            </Typography>
          </Grid>

          <Grid item xs={12}>
            <Typography component="h2" variant="h5" fontWeight={600} gutterBottom>
              Our Mission
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Our mission is to build a vibrant, global cocktail community that inspires connection through creativity.
              We’re here to empower people to mix better drinks, tell better stories, and enjoy every sip with style
              and safety. Whether you’re discovering a new liqueur or perfecting your garnish game — Tipsyverse is your
              bar-side buddy.
            </Typography>
          </Grid>
        </Grid>

        <Box mt={6} textAlign="center">
          <Typography component="p" variant="subtitle1" color="text.secondary">
            Always sip responsibly. Never drink and drive.
          </Typography>
        </Box>
      </Container>
    </PublicLayout>
  );
};

export default AboutUsScreen;
