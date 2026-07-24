import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Stack,
} from '@mui/material';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import LocalDrinkIcon from '@mui/icons-material/LocalDrink';
import GroupsIcon from '@mui/icons-material/Groups';


const features = [
  {
    icon: <EmojiEventsIcon fontSize="large" sx={{ color: 'var(--primary-color)' }} />,
    title: 'Curated by Experts',
    description: 'Recipes are handpicked and refined by bartenders and enthusiasts.',
  },
  {
    icon: <LocalDrinkIcon fontSize="large" sx={{ color: 'var(--primary-color)' }} />,
    title: 'Community Recipes',
    description: 'Anyone can share, like, and comment on drinks they love.',
  },
  {
    icon: <GroupsIcon fontSize="large" sx={{ color: 'var(--primary-color)' }} />,
    title: 'Social Engagement',
    description: 'Save and engage with cocktails in real-time with others.',
  }
];

const UniqueFeatures = () => {


  return (
    <Box sx={{ py: 10, px: 2, backgroundColor: '#fff' }}>
      <Box maxWidth="lg" mx="auto" textAlign="center">
        <Typography variant="h4" fontWeight="bold" gutterBottom>
          What Makes Tipsyverse Different
        </Typography>
        <Typography variant="subtitle1" sx={{ mb: 6 }}>
          We're more than just recipes — we bring the bar experience to your fingertips.
        </Typography>

        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            gap: 4,
            alignItems: 'stretch',
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}
        >
          {features.map((feature, index) => (
            <Paper
              key={index}
              elevation={3}
              sx={{
                flex: '1 1 300px',
                width: { xs: '100%' },
                minWidth: 280,
                p: 4,
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'scale(1.03)',
                  boxShadow: 6,
                  cursor: 'pointer',
                },
              }}
            >
              <Stack spacing={2} alignItems="center">
                {feature.icon}
                <Typography variant="h6" fontWeight="bold">
                  {feature.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {feature.description}
                </Typography>
              </Stack>
            </Paper>
          ))}
        </Box>
      </Box>
    </Box>
  );
};

export default UniqueFeatures;
