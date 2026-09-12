import React from "react";
import {
  Box,
  Container,
  Typography,
  Grid,
  IconButton,
  Stack,
} from "@mui/material";
import {
  Facebook,
  Instagram,
  YouTube,
  LinkedIn,
  X,
} from "@mui/icons-material";
import { Link } from "react-router-dom";

const Footer = () => {
  return (
    <Box component="footer" sx={{ backgroundColor: "#111", color: "#fff", py: 4 }}>
      <Container>
        <Grid
          container
          spacing={4}
          justifyContent="space-between"
          alignItems="flex-start"
        >
          {/* Logo & Tagline */}
          <Grid item xs={12} md={3}>
            <Typography component="h2" variant="h6" sx={{ mb: 1 }}>
              Tipsyverse 🍸
            </Typography>
            <Typography variant="body2">
              Discover and share amazing cocktails with a vibrant community.
            </Typography>
          </Grid>

          {/* Navigation */}
          {/* Links */}
          <Grid item xs={12} sm={6} md={2}>
            <Typography component="h2" variant="h6" gutterBottom>
              Pages
            </Typography>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              <Link to="/" style={{ color: "#fff", textDecoration: "underline" }}>
                Home
              </Link>
              <Link
                to="/drinks"
                style={{ color: "#fff", textDecoration: "underline" }}
              >
                Drinks
              </Link>
              <Link
                to="/about"
                style={{ color: "#fff", textDecoration: "underline" }}
              >
                About
              </Link>
              <Link
                to="/contact"
                style={{ color: "#fff", textDecoration: "underline" }}
              >
                Contact
              </Link>
              <Link
                to="/faq"
                style={{ color: "#fff", textDecoration: "underline" }}
              >
                FAQ
              </Link>
            </Box>
          </Grid>

          {/* Contact Info */}
          <Grid item xs={12} sm={6} md={3}>
            <Typography component="h2" variant="h6" gutterBottom>
              Contact Us
            </Typography>
            <Stack spacing={1}>
              <Typography variant="body2">hello@tipsyverse.com</Typography>
              <Typography variant="body2">(317) 608-7361</Typography>
              <Typography variant="body2">Indianapolis, IN</Typography>
            </Stack>
          </Grid>

          {/* Newsletter & Socials */}
          <Grid item xs={12} md={4}>
            
            
            {/* Social Icons */}
            <Box
              mt={3}
              display="flex"
              gap={1}
              flexWrap="wrap"
              justifyContent={{ xs: "flex-start", md: "flex-start" }}
            >
              <IconButton
                component="a"
                href="https://www.facebook.com/"
                target="_blank"
                rel="noopener noreferrer"
                sx={{ backgroundColor: "var(--primary-color)", color: "white" }}
                aria-label="Facebook (opens in a new tab)"
              >
                <Facebook />
              </IconButton>
              <IconButton
                component="a"
                href="https://www.twitter.com/tipsyverse"
                target="_blank"
                rel="noopener noreferrer"
                sx={{ backgroundColor: "var(--primary-color)", color: "white" }}
                aria-label="X (opens in a new tab)"
              >
                <X />
              </IconButton>
              <IconButton
                component="a"
                href="https://www.instagram.com/tipsyverse_"
                target="_blank"
                rel="noopener noreferrer"
                sx={{ backgroundColor: "var(--primary-color)", color: "white" }}
                aria-label="Instagram (opens in a new tab)"
              >
                <Instagram />
              </IconButton>
                <IconButton
                  component="a"
                  href="https://www.youtube.com/@tipsyverse2"
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{
                    backgroundColor: "var(--primary-color)",
                    color: "white",
                  }}
                  aria-label="YouTube (opens in a new tab)"
                >
                  <YouTube />
                </IconButton>
                <IconButton
                  component="a"
                  href="https://www.linkedin.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{
                    backgroundColor: "var(--primary-color)",
                    color: "white",
                  }}
                  aria-label="LinkedIn (opens in a new tab)"
                >
                  <LinkedIn />
                </IconButton>
            </Box>
          </Grid>
        </Grid>

        {/* Copyright */}
        <Box mt={6} textAlign="center">
          <Typography variant="caption" color="gray">
            &copy; {new Date().getFullYear()} Tipsyverse. All rights reserved.
          </Typography>
        </Box>
      </Container>
    </Box>
  );
};

export default Footer;
